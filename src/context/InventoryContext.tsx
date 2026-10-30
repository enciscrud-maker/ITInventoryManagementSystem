"use client"
// Always points at the latest audits so rapid scans never overwrite each other.

// Creates a session or updates its header. Item counting, confirming and
// completing go through the dedicated functions below.
// Changing the count or location invalidates an earlier approval.

// One scan = +1 physical qty. Codes outside the session are not counted.

// Adds imported quantities to the physical qty of assets in the session.

// Marks every asset that was never counted as "not found" (physical qty 0).

// Locks the session and applies CONFIRMED results to Asset Inventory.
// Never-counted assets are closed as "not found" but are NOT adjusted
// in inventory unless an approver confirmed them beforehand.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  demoAssets,
  demoAudits,
  demoMaster,
  demoTransactions,
  type Asset,
  type Audit,
  type AuditItem,
  type AuditScanEntry,
  type MasterItem,
  type Transaction,
  type TransactionAssetItem,
  type TransactionStatus,
} from "../data/demoData"
import {
  createCategoryRecord,
  createGroupRecord,
  generateAssetId,
  isAssetClassificationValid,
  migrateMasterData,
  normalizeAssetClassification,
  reserveMasterId,
  resolveCategoryById,
} from "../utils/masterData"
import { useAuth } from "../auth/AuthContext"
import {
  canApprove,
  canCreate,
  canDelete,
  canUpdate,
} from "../services/authorizationService"
import { today } from "../utils/helpers"
import {
  MAX_EVIDENCE_PER_ASSET,
  matchAssetId,
  normalizeAudit,
  recalcItem,
  resetConfirmation,
  type AuditItemChanges,
  type AuditScanResult,
} from "../utils/audit"
import {
  recordDataActivity,
  summarizeChanges,
  type ActivityChange,
} from "../services/historyService"

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
  updateAuditItem: (
    auditId: string,
    assetId: string,
    changes: AuditItemChanges,
  ) => void
  scanAuditAsset: (auditId: string, code: string) => AuditScanResult
  importAuditQuantities: (
    auditId: string,
    rows: {
      assetId: string
      qty: number
    }[],
  ) => number
  resolveUnscannedAudit: (auditId: string) => number
  completeAudit: (
    auditId: string,
    options?: { updateLocation?: boolean },
  ) => boolean
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
  const [audits, setAudits] = useState(() =>
    read<Audit[]>("iti-audits", demoAudits).map((audit) =>
      normalizeAudit(audit, assets),
    ),
  )
  const auditsRef = useRef(audits)
  auditsRef.current = audits
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
    try {
      localStorage.setItem("iti-audits", JSON.stringify(audits))
    } catch {
      setToast(
        "Browser storage is full. Latest stock opname changes (e.g. evidence photos) could not be saved.",
      )
    }
  }, [audits])
  useEffect(() => {
    localStorage.setItem("iti-master", JSON.stringify(master))
  }, [master])
  useEffect(() => {
    setAssets((current) =>
      current.map((asset) => normalizeAssetClassification(asset, master)),
    )
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
    const normalizedAsset = normalizeAssetClassification(asset, master)
    const hasCanonicalClassification = [
      normalizedAsset.categoryId,
      normalizedAsset.groupId,
      normalizedAsset.typeId,
      normalizedAsset.brandId,
      normalizedAsset.modelId,
    ].every(Boolean)
    if (
      hasCanonicalClassification &&
      !isAssetClassificationValid(normalizedAsset, master)
    ) {
      notify("Asset classification references are no longer valid")
      return
    }
    const existing = assets.find((item) => item.id === normalizedAsset.id)
    setAssets((v) =>
      v.some((a) => a.id === normalizedAsset.id)
        ? v.map((a) => (a.id === normalizedAsset.id ? normalizedAsset : a))
        : [normalizedAsset, ...v],
    )
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          normalizedAsset as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: "Asset Inventory",
        action: existing ? "Update" : "Create",
        recordId: normalizedAsset.id,
        recordLabel: `${normalizedAsset.brand} ${normalizedAsset.model}`,
        changes,
      })
    }
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
    recordDataActivity({
      actor: currentUser,
      module: tx.direction === "In" ? "Goods In" : "Goods Out",
      action: "Create",
      recordId: tx.id,
      recordLabel: tx.document,
    })
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
    recordDataActivity({
      actor: currentUser,
      module: transaction.direction === "In" ? "Goods In" : "Goods Out",
      action: "Update",
      recordId: transaction.id,
      recordLabel: transaction.document,
      changes: {
        status: {
          before: transaction.status,
          after: status,
        },
      },
    })
    notify("Transaction status updated")
    return true
  }
  const commitAudits = (updater: (current: Audit[]) => Audit[]) => {
    const next = updater(auditsRef.current)
    auditsRef.current = next
    setAudits(next)
  }
  const findAudit = (auditId: string) =>
    auditsRef.current.find((item) => item.id === auditId)
  const newId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const saveAudit = (audit: Audit) => {
    const existing = findAudit(audit.id)
    if (!(existing ? canUpdate(currentUser) : canCreate(currentUser))) {
      notify("You do not have permission to save this stock opname")
      return
    }
    if (audit.status === "Completed" || existing?.status === "Completed") {
      notify("Completed sessions are locked. Use Complete Audit to finish one.")
      return
    }
    const approvesSomething = audit.items.some(
      (item) =>
        item.confirmed &&
        !existing?.items.find((x) => x.assetId === item.assetId)?.confirmed,
    )
    if (approvesSomething && !canApprove(currentUser)) {
      notify("Only approvers can confirm stock opname results")
      return
    }
    const hasNewMissingAsset = audit.items.some(
      (item) =>
        !assets.some((asset) => asset.id === item.assetId) &&
        !existing?.items.some(
          (existingItem) => existingItem.assetId === item.assetId,
        ),
    )
    if (hasNewMissingAsset) {
      notify("Stock opname contains an asset that no longer exists")
      return
    }
    const next = normalizeAudit(audit, assets)
    commitAudits((list) =>
      existing
        ? list.map((a) => (a.id === next.id ? next : a))
        : [next, ...list],
    )
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: existing ? "Update" : "Create",
      recordId: audit.id,
      recordLabel: audit.name,
    })
    notify(existing ? "Audit progress saved" : "Audit session created")
  }

  const updateAuditItem = (
    auditId: string,
    assetId: string,
    changes: AuditItemChanges,
  ) => {
    const audit = findAudit(auditId)
    const item = audit?.items.find((x) => x.assetId === assetId)
    if (!audit || !item) return
    if (audit.status === "Completed") {
      notify("Completed sessions are locked")
      return
    }
    if (!canUpdate(currentUser)) {
      notify("You do not have permission to update this stock opname")
      return
    }
    const confirmChanged =
      changes.confirmed !== undefined && changes.confirmed !== item.confirmed
    if (confirmChanged && !canApprove(currentUser)) {
      notify("Only approvers can confirm stock opname results")
      return
    }
    let next: AuditItem = { ...item }
    if (changes.physicalQty !== undefined) {
      const qty = changes.physicalQty
      if (qty !== null && (!Number.isInteger(qty) || qty < 0)) {
        notify("Physical quantity must be a whole number of 0 or more")
        return
      }
      next.physicalQty = qty
    }
    if (changes.actualLocation !== undefined)
      next.actualLocation = changes.actualLocation
    if (changes.notes !== undefined) next.notes = changes.notes
    if (changes.addEvidence?.length)
      next.evidence = [...(item.evidence ?? []), ...changes.addEvidence].slice(
        0,
        MAX_EVIDENCE_PER_ASSET,
      )
    if (changes.removeEvidenceAt !== undefined)
      next.evidence = (item.evidence ?? []).filter(
        (_, index) => index !== changes.removeEvidenceAt,
      )
    next = recalcItem(next)
    if (
      item.confirmed &&
      (next.physicalQty !== item.physicalQty ||
        next.actualLocation !== item.actualLocation)
    )
      next = resetConfirmation(next)
    if (confirmChanged) {
      if (changes.confirmed && next.finding === "Unverified") {
        notify("Count this asset before confirming it")
        return
      }
      next = changes.confirmed
        ? {
            ...next,
            confirmed: true,
            confirmedBy: currentUser.name,
            confirmedAt: new Date().toISOString(),
          }
        : resetConfirmation(next)
      recordDataActivity({
        actor: currentUser,
        module: "Stock Opname",
        action: "Update",
        recordId: audit.id,
        recordLabel: audit.name,
        changes: {
          [`confirmed_${assetId}`]: {
            before: String(item.confirmed),
            after: String(next.confirmed),
          },
        },
      })
    }
    commitAudits((list) =>
      list.map((a) =>
        a.id === auditId
          ? {
              ...a,
              items: a.items.map((x) => (x.assetId === assetId ? next : x)),
            }
          : a,
      ),
    )
  }
  const scanAuditAsset = (auditId: string, code: string): AuditScanResult => {
    const audit = findAudit(auditId)
    if (!audit) return { ok: false, message: "Session not found" }
    if (audit.status === "Completed")
      return { ok: false, message: "This session is completed" }
    if (!canUpdate(currentUser))
      return { ok: false, message: "You do not have permission to scan" }
    const clean = code.trim()
    const assetId = matchAssetId(
      clean,
      audit.items.map((item) => item.assetId),
      true,
    )
    if (!assetId)
      return {
        ok: false,
        message: "Not part of this session — not counted",
      }
    const item = audit.items.find((x) => x.assetId === assetId)!
    const physicalQty = (item.physicalQty ?? 0) + 1
    let next = recalcItem({ ...item, physicalQty })
    if (item.confirmed) next = resetConfirmation(next)
    const entry: AuditScanEntry = {
      id: newId("SCN"),
      assetId,
      code: clean,
      qty: 1,
      source: "scan",
      timestamp: new Date().toISOString(),
      actor: currentUser.name,
    }
    commitAudits((list) =>
      list.map((a) =>
        a.id === auditId
          ? {
              ...a,
              items: a.items.map((x) => (x.assetId === assetId ? next : x)),
              scanLog: [...(a.scanLog ?? []), entry].slice(-500),
            }
          : a,
      ),
    )
    return {
      ok: true,
      assetId,
      physicalQty,
      message: `${assetId} +1 → Physical Qty ${physicalQty}`,
    }
  }
  const importAuditQuantities = (
    auditId: string,
    rows: {
      assetId: string
      qty: number
    }[],
  ) => {
    const audit = findAudit(auditId)
    if (!audit || audit.status === "Completed") {
      notify("This session is locked")
      return 0
    }
    if (!canUpdate(currentUser)) {
      notify("You do not have permission to import quantities")
      return 0
    }
    const totals = new Map<string, number>()
    rows.forEach((row) => {
      if (
        !audit.items.some((item) => item.assetId === row.assetId) ||
        !Number.isInteger(row.qty) ||
        row.qty < 1
      )
        return
      totals.set(row.assetId, (totals.get(row.assetId) ?? 0) + row.qty)
    })
    if (!totals.size) {
      notify("No valid rows to import")
      return 0
    }
    const timestamp = new Date().toISOString()
    const entries: AuditScanEntry[] = [...totals].map(([assetId, qty]) => ({
      id: newId("IMP"),
      assetId,
      code: assetId,
      qty,
      source: "import",
      timestamp,
      actor: currentUser.name,
    }))
    commitAudits((list) =>
      list.map((a) =>
        a.id === auditId
          ? {
              ...a,
              items: a.items.map((item) => {
                const qty = totals.get(item.assetId)
                if (!qty) return item
                let next = recalcItem({
                  ...item,
                  physicalQty: (item.physicalQty ?? 0) + qty,
                })
                if (item.confirmed) next = resetConfirmation(next)
                return next
              }),
              scanLog: [...(a.scanLog ?? []), ...entries].slice(-500),
            }
          : a,
      ),
    )
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: "Update",
      recordId: audit.id,
      recordLabel: audit.name,
      changes: {
        importedAssets: { before: "0", after: String(totals.size) },
      },
    })
    notify(`Quantity added to ${totals.size} assets`)
    return totals.size
  }
  const resolveUnscannedAudit = (auditId: string) => {
    const audit = findAudit(auditId)
    if (!audit || audit.status === "Completed") return 0
    if (!canUpdate(currentUser)) {
      notify("You do not have permission to update this stock opname")
      return 0
    }
    const pending = audit.items.filter((item) => item.physicalQty === null)
    if (!pending.length) return 0
    commitAudits((list) =>
      list.map((a) =>
        a.id === auditId
          ? {
              ...a,
              items: a.items.map((item) =>
                item.physicalQty === null
                  ? recalcItem({ ...item, physicalQty: 0 })
                  : item,
              ),
            }
          : a,
      ),
    )
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: "Update",
      recordId: audit.id,
      recordLabel: audit.name,
      changes: {
        unscannedResolved: { before: "0", after: String(pending.length) },
      },
    })
    notify(`${pending.length} uncounted assets marked as physical qty 0`)
    return pending.length
  }
  const completeAudit = (
    auditId: string,
    options?: { updateLocation?: boolean },
  ) => {
    const audit = findAudit(auditId)
    if (!audit || audit.status === "Completed" || audit.inventoryAdjusted)
      return false
    if (!canApprove(currentUser)) {
      notify("Only approvers can complete a stock opname")
      return false
    }
    const day = today()
    const adjustments = new Map<string, {
      before: number
      after: number
      location?: string
    }>()
    const items = audit.items.map((item) => {
      let next = item
      if (next.physicalQty === null)
        next = recalcItem({ ...next, physicalQty: 0 })
      if (next.confirmed && next.physicalQty !== null) {
        const asset = assets.find((a) => a.id === next.assetId)
        if (asset) {
          adjustments.set(asset.id, {
            before: asset.quantity,
            after: next.physicalQty,
            location:
              options?.updateLocation && next.actualLocation
                ? next.actualLocation
                : undefined,
          })
          next = {
            ...next,
            adjustment: { before: asset.quantity, after: next.physicalQty },
          }
        }
      }
      return next
    })
    if (adjustments.size)
      setAssets((value) =>
        value.map((asset) => {
          const change = adjustments.get(asset.id)
          if (!change) return asset
          return {
            ...asset,
            quantity: change.after,
            location: change.location ?? asset.location,
            updatedAt: day,
          }
        }),
      )
    const completedAt = new Date().toISOString()
    commitAudits((list) =>
      list.map((a) =>
        a.id === auditId
          ? {
              ...a,
              items,
              status: "Completed",
              completedAt,
              completedBy: currentUser.name,
              inventoryAdjusted: true,
            }
          : a,
      ),
    )
    adjustments.forEach((change, assetId) => {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return
      const changes: Record<string, ActivityChange> = {}
      if (change.before !== change.after)
        changes.quantity = {
          before: String(change.before),
          after: String(change.after),
        }
      if (change.location && change.location !== asset.location)
        changes.location = { before: asset.location, after: change.location }
      if (!Object.keys(changes).length) return
      recordDataActivity({
        actor: currentUser,
        module: "Asset Inventory",
        action: "Update",
        recordId: asset.id,
        recordLabel: `${asset.brand} ${asset.model} (Stock Opname ${audit.id})`,
        changes,
      })
    })
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: "Update",
      recordId: audit.id,
      recordLabel: audit.name,
      changes: {
        status: { before: audit.status, after: "Completed" },
        inventoryAdjusted: { before: "0", after: String(adjustments.size) },
      },
    })
    notify(
      `Stock opname completed · ${adjustments.size} confirmed assets applied to inventory`,
    )
    return true
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
      const changes = existing
        ? summarizeChanges(
            existing as unknown as Record<string, unknown>,
            normalized as unknown as Record<string, unknown>,
          )
        : undefined
      if (!existing || Object.keys(changes ?? {}).length) {
        recordDataActivity({
          actor: currentUser,
          module: "Category",
          action: existing ? "Update" : "Create",
          recordId: categoryId,
          recordLabel: normalized.name,
          changes,
        })
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
      const changes = existing
        ? summarizeChanges(
            existing as unknown as Record<string, unknown>,
            normalized as unknown as Record<string, unknown>,
          )
        : undefined
      if (!existing || Object.keys(changes ?? {}).length) {
        recordDataActivity({
          actor: currentUser,
          module: "Group",
          action: existing ? "Update" : "Create",
          recordId: groupId,
          recordLabel: normalized.name,
          changes,
        })
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
    const moduleName =
      key === "types"
        ? "Type"
        : key === "brands"
          ? "Brand"
          : key === "models"
            ? "Model"
            : key === "locations"
              ? "Location"
              : "Condition"
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          item as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: moduleName,
        action: existing ? "Update" : "Create",
        recordId: item.id,
        recordLabel: item.name,
        changes,
      })
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
    recordDataActivity({
      actor: currentUser,
      module:
        key === "categories"
          ? "Category"
          : key === "groups"
            ? "Group"
            : "Master Data",
      action: "Delete",
      recordId: item.id,
      recordLabel: item.name,
    })
    notify("Master record deleted")
    return true
  }
  const importAssets = (items: Asset[]) => {
    setAssets((value) => [
      ...items.map((asset) => normalizeAssetClassification(asset, master)),
      ...value,
    ])
    recordDataActivity({
      actor: currentUser,
      module: "Asset Inventory",
      action: "Create",
      recordId: `IMPORT-${Date.now()}`,
      recordLabel: `${items.length} imported assets`,
    })
    notify(`${items.length} assets imported`)
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
      updateAuditItem,
      scanAuditAsset,
      importAuditQuantities,
      resolveUnscannedAudit,
      completeAudit,
      setBusinessUnit,
      setTheme,
      setSidebarCollapsed,
      setSelectedAsset,
      notify,
      importAssets,
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
