"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  demoAssets,
  demoAudits,
  demoMaster,
  demoTransactions,
  type Asset,
  type Audit,
  type MasterItem,
  type Transaction,
  type TransactionAssetItem,
  type TransactionStatus,
} from "../data/demoData"
import {
  createCategoryRecord,
  createGroupRecord,
  generateAssetId,
  migrateMasterData,
  reserveMasterId,
  resolveCategoryById,
} from "../utils/masterData"
import { useAuth } from "../auth/AuthContext"
import { canDelete } from "../services/authorizationService"

type State = {
  assets: Asset[]
  transactions: Transaction[]
  audits: Audit[]
  master: Record<string, MasterItem[]>
  businessUnit: string
  theme: "light" | "dark"
  sidebarCollapsed: boolean
  selectedAsset: Asset | null
  toast: string
  saveAsset: (asset: Asset) => void
  saveTransaction: (tx: Transaction) => boolean
  updateTransactionStatus: (
    id: string,
    status: TransactionStatus,
    notes?: string,
  ) => boolean
  saveAudit: (audit: Audit) => void
  setBusinessUnit: (v: string) => void
  setTheme: (v: "light" | "dark") => void
  setSidebarCollapsed: (v: boolean) => void
  setSelectedAsset: (v: Asset | null) => void
  notify: (v: string) => void
  importAssets: (v: Asset[]) => void
  saveMaster: (key: string, item: MasterItem) => void
  deleteMaster: (key: string, id: string) => boolean
}

const Context = createContext<State | null>(null)
const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const normalizeTransaction = (transaction: Transaction): Transaction => {
  const status: TransactionStatus =
    transaction.status === "Completed" ? "Completed" : "In Progress"
  const assetRows: TransactionAssetItem[] = transaction.assets?.length
    ? transaction.assets
    : [
        {
          rowId: `${transaction.id}-asset-1`,
          assetId: transaction.assetId,
          itemName: transaction.assetId,
          quantity: transaction.quantity,
          serialNumber: "",
          referenceNumber: transaction.po ?? "",
          remarks: transaction.notes ?? "",
        },
      ]

  return {
    ...transaction,
    status,
    assets: assetRows,
    party: transaction.party ?? {
      name: transaction.user,
      nik: "",
      department: "",
    },
    requestDate: transaction.requestDate ?? transaction.date,
    formIssueDate: transaction.formIssueDate ?? transaction.date,
    supportingDocuments: transaction.supportingDocuments ?? [],
    statusHistory: transaction.statusHistory ?? [],
  }
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  const [assets, setAssets] = useState(() => read("iti-assets", demoAssets))
  const [transactions, setTransactions] = useState(() =>
    read<Transaction[]>("iti-transactions", demoTransactions).map(
      normalizeTransaction,
    ),
  )
  const [audits, setAudits] = useState(() => read("iti-audits", demoAudits))
  const [master, setMaster] = useState(() =>
    migrateMasterData(read("iti-master", demoMaster)),
  )
  const [businessUnit, setBusinessUnit] = useState(() =>
    read("iti-unit", "All Business Units"),
  )
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    read("iti-theme", "light"),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    read("iti-sidebar", false),
  )
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [toast, setToast] = useState("")
  useEffect(() => {
    localStorage.setItem("iti-assets", JSON.stringify(assets))
  }, [assets])
  useEffect(() => {
    localStorage.setItem("iti-transactions", JSON.stringify(transactions))
  }, [transactions])
  useEffect(() => {
    localStorage.setItem("iti-audits", JSON.stringify(audits))
  }, [audits])
  useEffect(() => {
    localStorage.setItem("iti-master", JSON.stringify(master))
  }, [master])
  useEffect(() => {
    localStorage.setItem("iti-unit", JSON.stringify(businessUnit))
  }, [businessUnit])
  useEffect(() => {
    localStorage.setItem("iti-theme", JSON.stringify(theme))
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])
  useEffect(() => {
    localStorage.setItem("iti-sidebar", JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3000)
  }
  const saveAsset = (asset: Asset) => {
    setAssets((v) =>
      v.some((a) => a.id === asset.id)
        ? v.map((a) => (a.id === asset.id ? asset : a))
        : [asset, ...v],
    )
    notify("Asset saved successfully")
  }
  const saveTransaction = (transaction: Transaction) => {
    if (
      transactions.some(
        (existing) =>
          existing.id === transaction.id ||
          existing.document === transaction.document,
      )
    ) {
      notify("Transaction was already submitted")
      return false
    }

    const tx = normalizeTransaction(transaction)
    const rows = tx.assets ?? []
    const assetIds = rows.map((row) => row.assetId)
    const invalidRows =
      !rows.length ||
      new Set(assetIds).size !== assetIds.length ||
      rows.some((row) => {
        const asset = assets.find((item) => item.id === row.assetId)
        return (
          !asset ||
          !Number.isInteger(row.quantity) ||
          row.quantity < 1 ||
          (tx.direction === "Out" && row.quantity > asset.quantity)
        )
      })
    if (invalidRows) {
      notify("Transaction assets or stock quantities are no longer valid")
      return false
    }

    setTransactions((value) => [tx, ...value])
    setAssets((value) =>
      value.map((asset) => {
        const row = rows.find((item) => item.assetId === asset.id)
        if (!row) return asset
        return {
          ...asset,
          quantity:
            tx.direction === "In"
              ? asset.quantity + row.quantity
              : Math.max(0, asset.quantity - row.quantity),
          location: tx.location || asset.location,
          businessUnit: tx.businessUnit || asset.businessUnit,
          condition: tx.type === "Disposal" ? "Disposal" : asset.condition,
          updatedAt: tx.date,
        }
      }),
    )
    notify(`${tx.direction === "In" ? "Goods-In" : "Goods-Out"} recorded`)
    return true
  }
  const updateTransactionStatus = (
    id: string,
    status: TransactionStatus,
    notes?: string,
  ) => {
    const transaction = transactions.find((item) => item.id === id)
    if (!transaction || transaction.status === status) return false
    const timestamp = new Date().toISOString()
    setTransactions((value) =>
      value.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              statusHistory: [
                {
                  id: `HIS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  previousStatus: item.status,
                  newStatus: status,
                  actorAccountId: currentUser.id,
                  actorName: currentUser.name,
                  actorNik: currentUser.nik,
                  timestamp,
                  notes: notes?.trim() || undefined,
                },
                ...(item.statusHistory ?? []),
              ],
            }
          : item,
      ),
    )
    notify("Transaction status updated")
    return true
  }
  const saveAudit = (audit: Audit) => {
    setAudits((v) =>
      v.some((a) => a.id === audit.id)
        ? v.map((a) => (a.id === audit.id ? audit : a))
        : [audit, ...v],
    )
    notify("Audit progress saved")
  }
  const saveMaster = (key: string, item: MasterItem) => {
    if (key === "categories") {
      const categoryId = item.category_id ?? item.id
      const existing = master.categories.find(
        (candidate) => (candidate.category_id ?? candidate.id) === categoryId,
      )
      const normalized = createCategoryRecord(
        categoryId,
        item.category_name ?? item.name,
        item.active !== false,
      )
      reserveMasterId(categoryId)
      setMaster((value) => ({
        ...value,
        categories: value.categories.some(
          (candidate) => (candidate.category_id ?? candidate.id) === categoryId,
        )
          ? value.categories.map((candidate) =>
              (candidate.category_id ?? candidate.id) === categoryId
                ? normalized
                : candidate,
            )
          : [normalized, ...value.categories],
        groups: value.groups.map((group) =>
          group.category_id === categoryId
            ? {
                ...group,
                parent: normalized.name,
                category_name: normalized.name,
                category_code: normalized.code,
              }
            : group,
        ),
      }))
      if (existing && existing.name !== normalized.name) {
        setAssets((value) =>
          value.map((asset) =>
            asset.category === existing.name
              ? { ...asset, category: normalized.name }
              : asset,
          ),
        )
      }
      notify("Category saved successfully")
      return
    }
    if (key === "groups") {
      const groupId = item.group_id ?? item.id
      const existing = master.groups.find(
        (candidate) => (candidate.group_id ?? candidate.id) === groupId,
      )
      const category = resolveCategoryById(
        master.categories,
        item.category_id ?? "",
      )
      if (!category) {
        notify("Cannot save Group: select a valid Category")
        return
      }
      const normalized = createGroupRecord(
        groupId,
        item.group_name ?? item.name,
        category,
        item.active !== false,
        item.group_code ?? item.code,
      )
      reserveMasterId(groupId)
      setMaster((value) => ({
        ...value,
        groups: value.groups.some(
          (candidate) => (candidate.group_id ?? candidate.id) === groupId,
        )
          ? value.groups.map((candidate) =>
              (candidate.group_id ?? candidate.id) === groupId
                ? normalized
                : candidate,
            )
          : [normalized, ...value.groups],
        types:
          existing && existing.name !== normalized.name
            ? value.types.map((type) =>
                type.parent === existing.name
                  ? { ...type, parent: normalized.name }
                  : type,
              )
            : value.types,
      }))
      if (existing && existing.name !== normalized.name) {
        setAssets((value) =>
          value.map((asset) =>
            asset.group === existing.name
              ? { ...asset, group: normalized.name }
              : asset,
          ),
        )
      }
      notify("Group saved successfully")
      return
    }
    const existing = master[key].find((candidate) => candidate.id === item.id)
    reserveMasterId(item.id)
    setMaster((value) => {
      const next = {
        ...value,
        [key]: value[key].some((candidate) => candidate.id === item.id)
          ? value[key].map((candidate) =>
              candidate.id === item.id ? item : candidate,
            )
          : [item, ...value[key]],
      }
      if (key === "types") {
        next.brands = value.brands.map((brand) =>
          brand.type_id === item.type_id
            ? { ...brand, parent: item.name, type_name: item.name }
            : brand,
        )
        next.models = value.models.map((model) =>
          model.type_id === item.type_id
            ? {
                ...model,
                type_name: item.name,
                type_code: item.type_code ?? item.code,
                group_id: item.group_id,
                group_name: item.group_name,
                group_code: item.group_code,
                category_id: item.category_id,
                category_name: item.category_name,
                category_code: item.category_code,
                asset_id: generateAssetId(
                  { ...model, category_code: item.category_code },
                  item,
                  item,
                  value.brands.find(
                    (brand) => brand.brand_id === model.brand_id,
                  ),
                ),
              }
            : model,
        )
      }
      if (key === "brands") {
        next.models = value.models.map((model) =>
          model.brand_id === item.brand_id
            ? {
                ...model,
                parent: item.name,
                brand_name: item.name,
                brand_code: item.brand_code ?? item.code,
                asset_id: generateAssetId(model, model, model, item),
              }
            : model,
        )
      }
      return next
    })
    if (existing && existing.name !== item.name) {
      setAssets((value) =>
        value.map((asset) =>
          key === "types" && asset.type === existing.name
            ? { ...asset, type: item.name }
            : key === "brands" && asset.brand === existing.name
              ? { ...asset, brand: item.name }
              : key === "models" && asset.model === existing.name
                ? { ...asset, model: item.name }
                : key === "locations" && asset.location === existing.name
                  ? { ...asset, location: item.name }
                  : key === "conditions" && asset.condition === existing.name
                    ? { ...asset, condition: item.name }
                    : asset,
        ),
      )
    }
    notify("Master data saved")
  }
  const deleteMaster = (key: string, id: string) => {
    if (!canDelete(currentUser)) {
      notify("Hanya Admin yang dapat melakukan penghapusan data.")
      return false
    }
    const item = master[key].find(
      (candidate) =>
        candidate.id === id ||
        candidate.category_id === id ||
        candidate.group_id === id,
    )
    if (!item) return false
    const categoryInUse =
      key === "categories" &&
      master.groups.some((group) => group.category_id === item.category_id)
    const groupInUse =
      key === "groups" &&
      (master.types.some((type) => type.parent === item.name) ||
        assets.some((asset) => asset.group === item.name))
    const used =
      categoryInUse ||
      groupInUse ||
      assets.some((a) => Object.values(a).includes(item.name)) ||
      Object.values(master)
        .flat()
        .some((x) => x.parent === item.name)
    if (used) {
      notify(
        key === "categories"
          ? "Cannot delete Category: reassign its Groups and Assets first"
          : key === "groups"
            ? "Cannot delete Group: reassign its Types and Assets first"
            : "Cannot delete: record is still referenced",
      )
      return false
    }
    reserveMasterId(item.id)
    setMaster((v) => ({
      ...v,
      [key]: v[key].filter(
        (candidate) =>
          candidate.id !== id &&
          candidate.category_id !== id &&
          candidate.group_id !== id,
      ),
    }))
    notify("Master record deleted")
    return true
  }
  const value = useMemo(
    () => ({
      assets,
      transactions,
      audits,
      master,
      businessUnit,
      theme,
      sidebarCollapsed,
      selectedAsset,
      toast,
      saveAsset,
      saveTransaction,
      updateTransactionStatus,
      saveAudit,
      setBusinessUnit,
      setTheme,
      setSidebarCollapsed,
      setSelectedAsset,
      notify,
      importAssets: (items: Asset[]) => {
        setAssets((v) => [...items, ...v])
        notify(`${items.length} assets imported`)
      },
      saveMaster,
      deleteMaster,
    }),
    [
      assets,
      transactions,
      currentUser,
      audits,
      master,
      businessUnit,
      theme,
      sidebarCollapsed,
      selectedAsset,
      toast,
    ],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useInventory = () => {
  const value = useContext(Context)
  if (!value) throw new Error("InventoryProvider is missing")
  return value
}
