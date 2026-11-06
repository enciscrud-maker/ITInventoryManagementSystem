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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  demoMaster,
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
  generateBusinessUnitCode,
  generateAssetId,
  generateMasterId,
  getBusinessUnitByValue,
  getLocationsForBusinessUnit,
  isAssetClassificationValid,
  migrateMasterData,
  normalizeBusinessUnitLocation,
  normalizeAssetClassification,
  defaultConditionTagColor,
  generateStatusCode,
  generateMasterInternalId,
  getMasterInternalId,
  isValidTagColor,
  reserveDeletedBusinessUnit,
  reserveDeletedLocation,
  reserveMasterId,
  reserveMasterInternalId,
  resolveCategoryById,
  resolveBrandById,
  resolveGroupById,
  resolveTypeById,
  serializeMasterData,
  type MasterKey,
  validateCategory,
  validateGroup,
} from "../utils/masterData"
import { useAuth } from "../auth/AuthContext"
import {
  canApprove,
  canAccessPage,
  canCreateInModule,
  canDelete,
  canManageExisting,
} from "../services/authorizationService"
import { reserveRequestNumber } from "../utils/requestNumber"
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
} from "../services/historyService"
import {
  getCachedMasterData,
  invalidateMasterDataCache,
  type MasterDataSnapshot,
} from "@/services/api/masterDataCache"
import {
  toBusinessUnitItem,
  toLocationItem,
  toMasterItems,
} from "@/services/api/mappers/master-data.mapper"
import { assetsApi } from "@/services/api/assets.api"
import { businessUnitsApi, locationsApi } from "@/services/api/masterData.api"
import { transactionsApi } from "@/services/api/transactions.api"
import { stockAuditsApi } from "@/services/api/stockAudits.api"

type State = {
  assets: Asset[]
  transactions: Transaction[]
  audits: Audit[]
  auditDataStatus: "loading" | "ready" | "error"
  auditDataError: string
  refreshAudits: () => Promise<boolean>
  loadAuditDetails: (id: string) => Promise<Audit | null>
  deleteAudit: (id: string) => Promise<boolean>
  uploadAuditEvidence: (
    auditId: string,
    assetId: string,
    file: File,
  ) => Promise<boolean>
  removeAuditEvidence: (
    auditId: string,
    assetId: string,
    index: number,
  ) => Promise<boolean>
  master: Record<string, MasterItem[]>
  businessUnit: string
  theme: "light" | "dark"
  sidebarCollapsed: boolean
  selectedAsset: Asset | null
  toast: string
  masterDataStatus: "loading" | "ready" | "error"
  masterDataError: string
  masterDataRefreshing: boolean
  refreshMasterData: () => Promise<boolean>
  refreshAssets: () => Promise<boolean>
  saveAsset: (asset: Asset) => Promise<boolean>
  saveTransaction: (tx: Transaction, files?: File[]) => Promise<boolean>
  updateTransactionStatus: (
    id: string,
    direction: Transaction["direction"],
    status: TransactionStatus,
    notes?: string,
  ) => Promise<boolean>
  loadTransactionDetails: (
    direction: Transaction["direction"],
    id: string,
  ) => Promise<Transaction | null>
  saveAudit: (audit: Audit) => Promise<Audit | null>
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
  ) => Promise<boolean>
  setBusinessUnit: (v: string) => void
  setTheme: (v: "light" | "dark") => void
  setSidebarCollapsed: (v: boolean) => void
  setSelectedAsset: (v: Asset | null) => void
  notify: (v: string) => void
  saveMaster: (key: MasterKey, item: MasterItem) => boolean
  deleteMaster: (key: MasterKey, id: string) => boolean
  saveBusinessUnit: (name: string, id?: string) => Promise<boolean>
  saveLocation: (
    name: string,
    businessUnitId: string,
    id?: string,
  ) => Promise<boolean>
  deleteBusinessUnit: (id: string) => Promise<boolean>
  deleteLocation: (id: string) => Promise<boolean>
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
  const masterStatus = demoMaster.statuses.find(
    (item) =>
      item.usage === transaction.direction &&
      (item.id === transaction.statusId ||
        item.name.toLocaleLowerCase() === transaction.type.toLocaleLowerCase()),
  )
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
    statusId: transaction.statusId ?? masterStatus?.id,
    statusCode: transaction.statusCode ?? masterStatus?.code,
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
  const [assets, setAssets] = useState<Asset[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [auditDataStatus, setAuditDataStatus] =
    useState<"loading" | "ready" | "error">("loading")
  const [auditDataError, setAuditDataError] = useState("")
  const auditsRef = useRef(audits)
  auditsRef.current = audits
  const [master, setMaster] = useState(() =>
    migrateMasterData(read("iti-master", demoMaster), {
      assets,
      transactions,
      audits,
      conditionNames: [
        ...assets.map((asset) => asset.condition),
        ...transactions.flatMap((transaction) =>
          (transaction.assets ?? []).flatMap((row) =>
            row.condition ? [row.condition] : [],
          ),
        ),
      ],
    }),
  )
  const [businessUnit, setBusinessUnit] = useState(() => {
    const saved = read<string>("iti-unit", "All Business Units")
    return saved === "All Business Units"
      ? saved
      : (getBusinessUnitByValue(master.businessUnits, saved)?.id ??
          "All Business Units")
  })
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    read("iti-theme", "light"),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    read("iti-sidebar", false),
  )
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [toast, setToast] = useState("")
  const [masterDataStatus, setMasterDataStatus] =
    useState<"loading" | "ready" | "error">("loading")
  const [masterDataError, setMasterDataError] = useState("")
  const [masterDataRefreshing, setMasterDataRefreshing] = useState(false)
  const masterDataRequestId = useRef(0)
  const masterDataLoaded = useRef(false)
  const appliedMasterData = useRef<MasterDataSnapshot | null>(null)
  const masterDataScope = useRef(currentUser.id)
  useEffect(() => {
    localStorage.setItem(
      "iti-master",
      JSON.stringify(serializeMasterData(master)),
    )
  }, [master])
  useEffect(() => {
    setAssets((current) =>
      current.map((asset) => {
        const normalized = normalizeBusinessUnitLocation(asset, master)
        const classified = normalizeAssetClassification(normalized, master)
        return classified.businessUnitId === asset.businessUnitId &&
          classified.locationId === asset.locationId &&
          classified.businessUnit === asset.businessUnit &&
          classified.location === asset.location
          ? asset
          : classified
      }),
    )
    setTransactions((current) =>
      current.map((transaction) => {
        const normalized = normalizeBusinessUnitLocation(transaction, master)
        const status =
          master.statuses.find(
            (item) =>
              item.id === transaction.statusId &&
              item.usage === transaction.direction,
          ) ??
          master.statuses.find(
            (item) =>
              item.usage === transaction.direction &&
              item.name.toLocaleLowerCase() ===
                transaction.type.toLocaleLowerCase(),
          )
        return normalized.businessUnitId === transaction.businessUnitId &&
          normalized.locationId === transaction.locationId &&
          normalized.businessUnit === transaction.businessUnit &&
          normalized.location === transaction.location &&
          (!status ||
            (transaction.statusId === status.id &&
              transaction.statusCode === status.code &&
              transaction.type === status.name))
          ? transaction
          : {
              ...normalized,
              ...(status
                ? {
                    statusId: status.id,
                    statusCode: status.code,
                    type: status.name,
                  }
                : {}),
            }
      }),
    )
    setAudits((current) =>
      current.map((audit) => {
        const normalized = normalizeBusinessUnitLocation(audit, master)
        const items = audit.items.map((item) => {
          const actual = normalizeBusinessUnitLocation(
            {
              businessUnit: normalized.businessUnit,
              businessUnitId: normalized.businessUnitId,
              location: item.actualLocation,
              locationId: item.actualLocationId,
            },
            master,
          )
          const system = normalizeBusinessUnitLocation(
            {
              businessUnit: normalized.businessUnit,
              businessUnitId: normalized.businessUnitId,
              location: item.systemLocation,
              locationId: item.systemLocationId,
            },
            master,
          )
          return {
            ...item,
            actualLocation: actual.location ?? item.actualLocation,
            actualLocationId: actual.locationId,
            systemLocation: system.location ?? item.systemLocation,
            systemLocationId: system.locationId,
          }
        })
        const same =
          normalized.businessUnitId === audit.businessUnitId &&
          normalized.locationId === audit.locationId &&
          normalized.businessUnit === audit.businessUnit &&
          normalized.location === audit.location &&
          items.every(
            (item, index) =>
              item.actualLocationId === audit.items[index]?.actualLocationId &&
              item.systemLocationId === audit.items[index]?.systemLocationId,
          )
        return same ? audit : { ...normalized, items }
      }),
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
  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3000)
  }, [])
  const refreshAssets = useCallback(async () => {
    const shouldLoad = [
      "asset-inventory",
      "goods-in",
      "goods-out",
      "stock-opname",
      "dashboard",
    ] as const
    const canReadAssets = shouldLoad.some((page) =>
      canAccessPage(currentUser, page),
    )
    if (!canReadAssets) {
      setAssets([])
      return true
    }
    const result = await assetsApi.list()
    if (!result.success) {
      notify(result.error)
      return false
    }
    setAssets(result.data)
    return true
  }, [currentUser, notify])
  useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])
  const refreshAudits = useCallback(async () => {
    if (
      !canAccessPage(currentUser, "stock-opname") &&
      !canAccessPage(currentUser, "dashboard")
    ) {
      setAudits([])
      setAuditDataError("")
      setAuditDataStatus("ready")
      return true
    }
    setAuditDataStatus("loading")
    const result = await stockAuditsApi.list({}, [], master.locations)
    if (!result.success) {
      setAuditDataError(result.error)
      setAuditDataStatus("error")
      return false
    }
    const existing = new Map(
      auditsRef.current
        .filter((audit) => audit.detailsLoaded)
        .map((audit) => [audit.id, audit]),
    )
    const next = result.data.map((audit) => {
      const detailed = existing.get(audit.id)
      return detailed ? { ...detailed, ...audit, items: detailed.items } : audit
    })
    auditsRef.current = next
    setAudits(next)
    setAuditDataError("")
    setAuditDataStatus("ready")
    return true
  }, [currentUser, master.locations])
  useEffect(() => {
    void refreshAudits()
  }, [currentUser.id, refreshAudits])
  const loadAuditDetails = useCallback(
    async (id: string) => {
      const result = await stockAuditsApi.getById(id, assets, master.locations)
      if (!result.success) {
        notify(result.error)
        return null
      }
      const detail = normalizeAudit(result.data, assets)
      const next = auditsRef.current.some((audit) => audit.id === id)
        ? auditsRef.current.map((audit) => (audit.id === id ? detail : audit))
        : [detail, ...auditsRef.current]
      auditsRef.current = next
      setAudits(next)
      return detail
    },
    [assets, master.locations, notify],
  )
  const refreshTransactions = useCallback(async () => {
    const loadGoodsIn =
      canAccessPage(currentUser, "goods-in") ||
      canAccessPage(currentUser, "dashboard")
    const loadGoodsOut =
      canAccessPage(currentUser, "goods-out") ||
      canAccessPage(currentUser, "dashboard")
    const [goodsInResult, goodsOutResult] = await Promise.all([
      loadGoodsIn ? transactionsApi.list("In") : Promise.resolve(null),
      loadGoodsOut ? transactionsApi.list("Out") : Promise.resolve(null),
    ])
    if (goodsInResult && !goodsInResult.success) {
      notify(goodsInResult.error)
      return false
    }
    if (goodsOutResult && !goodsOutResult.success) {
      notify(goodsOutResult.error)
      return false
    }
    setTransactions(
      [
        ...(goodsInResult?.data ?? []),
        ...(goodsOutResult?.data ?? []),
      ].sort((a, b) =>
        (b.formIssueDate ?? b.date).localeCompare(a.formIssueDate ?? a.date),
      ),
    )
    return true
  }, [currentUser, notify])
  useEffect(() => {
    void refreshTransactions()
  }, [currentUser.id, refreshTransactions])
  const loadTransactionDetails = useCallback(
    async (direction: Transaction["direction"], id: string) => {
      const current = transactions.find(
        (item) => item.id === id && item.direction === direction,
      )
      if (!current) return null
      const result = await transactionsApi.getById(direction, id)
      if (!result.success) {
        notify(result.error)
        return null
      }
      const loaded = normalizeTransaction({
        ...result.data,
        businessUnitId: current.businessUnitId,
        locationId: current.locationId,
        statusId: current.statusId,
        statusCode: current.statusCode,
      })
      setTransactions((value) =>
        value.map((item) =>
          item.id === id && item.direction === current.direction
            ? loaded
            : item,
        ),
      )
      return loaded
    },
    [notify, transactions],
  )
  const refreshMasterData = useCallback(async () => {
    const shouldLoad = [
      "asset-inventory",
      "goods-in",
      "goods-out",
      "stock-opname",
      "master-data",
      "dashboard",
    ] as const
    const canReadLookups = shouldLoad.some((page) =>
      canAccessPage(currentUser, page),
    )
    if (!canReadLookups) {
      setMasterDataStatus("ready")
      setMasterDataError("")
      setMasterDataRefreshing(false)
      return true
    }
    if (masterDataScope.current !== currentUser.id) {
      masterDataScope.current = currentUser.id
      masterDataLoaded.current = false
      appliedMasterData.current = null
      setMasterDataStatus("loading")
      setMasterDataError("")
    }
    const requestId = ++masterDataRequestId.current
    setMasterDataRefreshing(true)
    const result = await getCachedMasterData(currentUser.id)
    if (requestId !== masterDataRequestId.current) return false

    if (!result.success) {
      setMasterDataError(result.error)
      if (!masterDataLoaded.current) setMasterDataStatus("error")
      setMasterDataRefreshing(false)
      return false
    }

    masterDataLoaded.current = true
    if (appliedMasterData.current !== result.data) {
      appliedMasterData.current = result.data
      setMaster((value) => ({ ...value, ...toMasterItems(result.data) }))
    }
    setMasterDataStatus("ready")
    setMasterDataError("")
    setMasterDataRefreshing(false)
    return true
  }, [currentUser])
  useEffect(() => {
    void refreshMasterData()

    const refreshIfVisible = () => {
      if (!document.hidden) void refreshMasterData()
    }
    const interval = window.setInterval(refreshIfVisible, 30_000)
    window.addEventListener("focus", refreshIfVisible)
    document.addEventListener("visibilitychange", refreshIfVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshIfVisible)
      document.removeEventListener("visibilitychange", refreshIfVisible)
    }
  }, [refreshMasterData])
  const saveAsset = async (asset: Asset) => {
    if (!master.conditions.some((item) => item.name === asset.condition)) {
      notify("Select a valid Condition from Master Data")
      return false
    }
    const businessUnit = master.businessUnits.find(
      (unit) => unit.id === asset.businessUnitId,
    )
    const location = getLocationsForBusinessUnit(
      master.locations,
      asset.businessUnitId ?? "",
    ).find((item) => item.id === asset.locationId)
    if (!businessUnit || !location) {
      notify("Select a Location that belongs to the selected Business Unit")
      return false
    }
    const normalizedAsset = normalizeAssetClassification(
      {
        ...asset,
        businessUnit: businessUnit.name,
        location: location.name,
        conditionId: master.conditions.find(
          (item) => item.name === asset.condition,
        )?.id,
      },
      master,
    )
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
      return false
    }
    const existing = normalizedAsset.id
      ? assets.find((item) => item.id === normalizedAsset.id)
      : undefined
    if (
      existing
        ? !canManageExisting(currentUser, "asset-inventory")
        : !canCreateInModule(currentUser, "asset-inventory")
    ) {
      notify("You do not have permission to save this asset")
      return false
    }
    const result = existing
      ? await assetsApi.update(normalizedAsset)
      : await assetsApi.create(normalizedAsset)
    if (!result.success) {
      notify(result.error)
      return false
    }
    const savedAsset = result.data
    setAssets((value) =>
      existing
        ? value.map((item) => (item.id === existing.id ? savedAsset : item))
        : [savedAsset, ...value],
    )
    setSelectedAsset((current) =>
      current?.id === savedAsset.id ? savedAsset : current,
    )
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          savedAsset as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: "Asset Inventory",
        action: existing ? "Update" : "Create",
        recordId: savedAsset.id,
        recordLabel: `${savedAsset.brand} ${savedAsset.model}`,
        changes,
      })
    }
    notify(
      existing ? "Asset updated successfully" : "Asset created successfully",
    )
    return true
  }
  const saveTransaction = async (
    transaction: Transaction,
    files: File[] = [],
  ) => {
    const permission = transaction.direction === "In" ? "goods-in" : "goods-out"
    if (!canCreateInModule(currentUser, permission)) {
      notify(
        `You do not have permission to create Goods ${transaction.direction}`,
      )
      return false
    }
    const invalidFile = files.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase()
      return (
        file.size > 10 * 1024 * 1024 ||
        !["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"].includes(
          extension ?? "",
        )
      )
    })
    if (invalidFile) {
      notify(
        `${invalidFile.name} tidak didukung. Gunakan PDF, PNG, JPG, DOC, DOCX, XLS, atau XLSX maksimal 10 MB.`,
      )
      return false
    }
    const masterStatus = master.statuses.find(
      (item) =>
        item.id === transaction.statusId &&
        item.usage === transaction.direction &&
        item.name === transaction.type &&
        item.code === transaction.statusCode,
    )
    if (!masterStatus) {
      notify("Select a valid Status for this Goods-In or Goods-Out transaction")
      return false
    }
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

    const selectedBusinessUnit = master.businessUnits.find(
      (unit) => unit.id === transaction.businessUnitId,
    )
    const selectedLocation = transaction.locationId
      ? getLocationsForBusinessUnit(
          master.locations,
          transaction.businessUnitId ?? "",
        ).find((location) => location.id === transaction.locationId)
      : undefined
    if (
      !selectedBusinessUnit ||
      (transaction.locationId && !selectedLocation)
    ) {
      notify("Select a valid Business Unit and a Location belonging to it")
      return false
    }
    const requestNumber = reserveRequestNumber(
      selectedBusinessUnit.code,
      today(),
      transactions,
    )
    if (!requestNumber) {
      notify("Select a valid Business Unit and transaction date")
      return false
    }
    const tx = normalizeTransaction({
      ...transaction,
      businessUnit: selectedBusinessUnit.name,
      location: selectedLocation?.name ?? transaction.location,
      requestNumber,
    })
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
          (tx.direction === "In" &&
            !master.conditions.some(
              (condition) => condition.name === row.condition,
            )) ||
          (tx.direction === "Out" && row.quantity > asset.quantity)
        )
      })
    if (invalidRows) {
      notify("Transaction assets or stock quantities are no longer valid")
      return false
    }

    const result = await transactionsApi.create(tx)
    if (!result.success) {
      notify(result.error)
      return false
    }
    const savedStatus = master.statuses.find(
      (item) =>
        item.usage === result.data.direction && item.name === result.data.type,
    )
    const saved = normalizeTransaction({
      ...result.data,
      businessUnitId: selectedBusinessUnit.id,
      locationId: selectedLocation?.id ?? undefined,
      statusId: savedStatus?.id ?? tx.statusId,
      statusCode: savedStatus?.code ?? tx.statusCode,
      assets: result.data.assets?.length ? result.data.assets : tx.assets,
      supportingDocuments: tx.supportingDocuments,
    })
    setTransactions((value) => [saved, ...value])
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
          location: selectedLocation?.name ?? asset.location,
          locationId: selectedLocation?.id ?? asset.locationId,
          businessUnit: selectedLocation?.name
            ? selectedBusinessUnit.name
            : asset.businessUnit,
          businessUnitId: selectedLocation
            ? selectedBusinessUnit.id
            : asset.businessUnitId,
          condition: tx.type === "Disposal" ? "Disposal" : asset.condition,
          updatedAt: tx.date,
        }
      }),
    )
    recordDataActivity({
      actor: currentUser,
      module: saved.direction === "In" ? "Assets In" : "Assets Out",
      action: "Create",
      recordId: saved.id,
      recordLabel: saved.document,
    })
    const failedUploads: string[] = []
    const uploadedDocuments: NonNullable<Transaction["supportingDocuments"]> =
      []
    for (const [index, file] of files.entries()) {
      const upload = await transactionsApi.uploadAttachment(saved, file)
      if (!upload.success) {
        failedUploads.push(`${file.name} (${upload.error})`)
      } else {
        const document = tx.supportingDocuments?.[index]
        if (document) uploadedDocuments.push(document)
      }
    }
    if (files.length) {
      setTransactions((value) =>
        value.map((item) =>
          item.id === saved.id && item.direction === saved.direction
            ? { ...item, supportingDocuments: uploadedDocuments }
            : item,
        ),
      )
    }
    notify(
      failedUploads.length
        ? `${
            saved.direction === "In" ? "Goods-In" : "Goods-Out"
          } recorded, but these attachments could not be uploaded: ${failedUploads.join(", ")}`
        : `${saved.direction === "In" ? "Goods-In" : "Goods-Out"} recorded`,
    )
    return true
  }
  const updateTransactionStatus = async (
    id: string,
    direction: Transaction["direction"],
    status: TransactionStatus,
    notes?: string,
  ) => {
    const page = direction === "In" ? "goods-in" : "goods-out"
    if (!canManageExisting(currentUser, page)) {
      notify("You do not have permission to update existing transactions")
      return false
    }
    const transaction = transactions.find(
      (item) => item.id === id && item.direction === direction,
    )
    if (!transaction || transaction.status === status) return false
    const result = await transactionsApi.updateStatus(
      transaction,
      status,
      notes,
    )
    if (!result.success) {
      notify(result.error)
      return false
    }
    const updated = normalizeTransaction({
      ...result.data,
      businessUnitId: transaction.businessUnitId,
      locationId: transaction.locationId,
      statusId: transaction.statusId,
      statusCode: transaction.statusCode,
    })
    const timestamp = new Date().toISOString()
    setTransactions((value) =>
      value.map((item) =>
        item.id === id && item.direction === direction
          ? {
              ...updated,
              statusHistory: [
                ...(updated.statusHistory ?? []),
                ...(result.data.statusHistory?.length
                  ? []
                  : [
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
                    ]),
              ],
            }
          : item,
      ),
    )
    recordDataActivity({
      actor: currentUser,
      module: transaction.direction === "In" ? "Assets In" : "Assets Out",
      action: "Update",
      recordId: updated.id,
      recordLabel: updated.document,
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
  const auditSyncTimers = useRef(new Map<string, number>())
  const auditSyncQueues = useRef(new Map<string, Promise<boolean>>())
  const persistAuditItems = async (auditId: string) => {
    const audit = findAudit(auditId)
    if (!audit) return false
    const result = await stockAuditsApi.updateItems(
      audit,
      assets,
      master.locations,
    )
    if (!result.success) {
      notify(`Stock Opname changes were not saved: ${result.error}`)
      return false
    }
    const itemIds = new Map(
      result.data.items.map((item) => [item.assetId, item.apiItemId]),
    )
    if (findAudit(auditId)) {
      commitAudits((list) =>
        list.map((entry) =>
          entry.id === auditId
            ? {
                ...entry,
                items: entry.items.map((item) => ({
                  ...item,
                  apiItemId: itemIds.get(item.assetId) ?? item.apiItemId,
                })),
              }
            : entry,
        ),
      )
    }
    return true
  }
  const scheduleAuditItemsSave = (auditId: string) => {
    const timer = auditSyncTimers.current.get(auditId)
    if (timer) window.clearTimeout(timer)
    const nextTimer = window.setTimeout(() => {
      auditSyncTimers.current.delete(auditId)
      const previous =
        auditSyncQueues.current.get(auditId) ?? Promise.resolve(true)
      const next = previous
        .catch(() => false)
        .then(() => persistAuditItems(auditId))
        .catch((error: unknown) => {
          notify(
            error instanceof Error
              ? `Stock Opname changes were not saved: ${error.message}`
              : "Stock Opname changes were not saved because of an unexpected error.",
          )
          return false
        })
      auditSyncQueues.current.set(auditId, next)
    }, 350)
    auditSyncTimers.current.set(auditId, nextTimer)
  }
  const flushAuditItems = async (auditId: string) => {
    const timer = auditSyncTimers.current.get(auditId)
    if (timer) {
      window.clearTimeout(timer)
      auditSyncTimers.current.delete(auditId)
    }
    const previous = auditSyncQueues.current.get(auditId)
    if (previous && !(await previous)) return false
    const saved = await persistAuditItems(auditId)
    auditSyncQueues.current.delete(auditId)
    return saved
  }
  const saveAudit = async (audit: Audit) => {
    const existing = findAudit(audit.id)
    if (
      existing
        ? !canManageExisting(currentUser, "stock-opname")
        : !canCreateInModule(currentUser, "stock-opname")
    ) {
      notify("You do not have permission to save this stock opname")
      return null
    }
    const auditBusinessUnit = master.businessUnits.find(
      (unit) => unit.id === audit.businessUnitId,
    )
    const auditLocation = audit.locationId
      ? getLocationsForBusinessUnit(
          master.locations,
          audit.businessUnitId ?? "",
        ).find((location) => location.id === audit.locationId)
      : undefined
    if (!auditBusinessUnit || (audit.locationId && !auditLocation)) {
      notify("Select a valid Business Unit and a Location belonging to it")
      return null
    }
    if (audit.status === "Completed" || existing?.status === "Completed") {
      notify("Completed sessions are locked. Use Complete Audit to finish one.")
      return null
    }
    const approvesSomething = audit.items.some(
      (item) =>
        item.confirmed &&
        !existing?.items.find((x) => x.assetId === item.assetId)?.confirmed,
    )
    if (approvesSomething && !canApprove(currentUser, "stock-opname")) {
      notify("Only approvers can confirm stock opname results")
      return null
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
      return null
    }
    const next = normalizeAudit(
      {
        ...audit,
        businessUnit: auditBusinessUnit.name,
        location: auditLocation?.name ?? audit.location,
      },
      assets,
    )
    const result = existing
      ? await stockAuditsApi.updateItems(next, assets, master.locations)
      : await stockAuditsApi.create(next, assets, master.locations)
    if (!result.success) {
      notify(result.error)
      return null
    }
    const saved = {
      ...result.data,
      auditor: result.data.auditor || audit.auditor,
      detailsLoaded: true,
    }
    commitAudits((list) =>
      existing
        ? list.map((a) => (a.id === saved.id ? saved : a))
        : [saved, ...list],
    )
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: existing ? "Update" : "Create",
      recordId: saved.id,
      recordLabel: saved.name,
    })
    notify(existing ? "Audit progress saved" : "Audit session created")
    return saved
  }
  const deleteAudit = async (auditId: string) => {
    if (!canDelete(currentUser, "stock-opname")) {
      notify("You do not have permission to delete Stock Opname sessions")
      return false
    }
    const audit = findAudit(auditId)
    if (!audit) {
      notify("Stock Opname session was not found. Refresh the table and try again.")
      return false
    }
    const result = await stockAuditsApi.delete(auditId)
    if (!result.success) {
      notify(result.error)
      return false
    }
    commitAudits((list) => list.filter((entry) => entry.id !== auditId))
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: "Delete",
      recordId: audit.id,
      recordLabel: audit.name,
    })
    const refreshed = await refreshAudits()
    notify(
      refreshed
        ? "Stock Opname session deleted"
        : "Stock Opname session deleted, but the table could not be refreshed",
    )
    return true
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
      return null
    }
    if (!canManageExisting(currentUser, "stock-opname")) {
      notify("You do not have permission to update this stock opname")
      return
    }
    const confirmChanged =
      changes.confirmed !== undefined && changes.confirmed !== item.confirmed
    if (confirmChanged && !canApprove(currentUser, "stock-opname")) {
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
    if (changes.actualLocationId !== undefined) {
      const location = getLocationsForBusinessUnit(
        master.locations,
        audit.businessUnitId ?? "",
      ).find((candidate) => candidate.id === changes.actualLocationId)
      if (!location) {
        notify("Select an actual Location within this Business Unit")
        return
      }
      next.actualLocationId = location.id
      next.actualLocation = location.name
    } else if (changes.actualLocation !== undefined) {
      next.actualLocation = changes.actualLocation
      const location = getLocationsForBusinessUnit(
        master.locations,
        audit.businessUnitId ?? "",
      ).find(
        (candidate) =>
          candidate.name.toLocaleLowerCase() ===
          changes.actualLocation?.toLocaleLowerCase(),
      )
      next.actualLocationId = location?.id
    }
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
    scheduleAuditItemsSave(auditId)
  }
  const scanAuditAsset = (auditId: string, code: string): AuditScanResult => {
    const audit = findAudit(auditId)
    if (!audit) return { ok: false, message: "Session not found" }
    if (audit.status === "Completed")
      return { ok: false, message: "This session is completed" }
    if (!canManageExisting(currentUser, "stock-opname"))
      return { ok: false, message: "You do not have permission to scan" }
    const clean = code.trim()
    const assetIdByInternalId = matchAssetId(
      clean,
      audit.items.map((item) => item.assetId),
      true,
    )
    const scannedCode = clean.toLocaleUpperCase()
    const assetIdByCode = audit.items.find((item) => {
      const assetCode = item.assetCode?.toLocaleUpperCase()
      return (
        assetCode === scannedCode ||
        Boolean(assetCode && scannedCode.includes(assetCode))
      )
    })?.assetId
    const assetId = assetIdByInternalId ?? assetIdByCode
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
    scheduleAuditItemsSave(auditId)
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
    if (!canManageExisting(currentUser, "stock-opname")) {
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
    scheduleAuditItemsSave(auditId)
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
    if (!canManageExisting(currentUser, "stock-opname")) {
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
    scheduleAuditItemsSave(auditId)
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
  const uploadAuditEvidence = async (
    auditId: string,
    assetId: string,
    file: File,
  ) => {
    const audit = findAudit(auditId)
    if (!audit || audit.status === "Completed") {
      notify("This session is locked")
      return false
    }
    if (!canManageExisting(currentUser, "stock-opname")) {
      notify("You do not have permission to upload evidence")
      return false
    }
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      notify("Evidence must be a PNG or JPEG file no larger than 10 MB")
      return false
    }
    let item = audit.items.find((candidate) => candidate.assetId === assetId)
    if (!item) return false
    if (!item.apiItemId) {
      if (!(await flushAuditItems(auditId))) return false
      item = findAudit(auditId)?.items.find(
        (candidate) => candidate.assetId === assetId,
      )
    }
    if (!item?.apiItemId) {
      notify("Save this audit item before uploading evidence")
      return false
    }
    const result = await stockAuditsApi.uploadEvidence(
      auditId,
      item.apiItemId,
      file,
    )
    if (!result.success) {
      notify(result.error)
      return false
    }
    const evidencePath =
      result.data.evidencePath ?? result.data.evidencePaths?.at(-1)
    if (!evidencePath) {
      notify("The server did not return an accessible evidence path")
      return false
    }
    commitAudits((list) =>
      list.map((entry) =>
        entry.id === auditId
          ? {
              ...entry,
              items: entry.items.map((candidate) =>
                candidate.assetId === assetId
                  ? {
                      ...candidate,
                      apiItemId: String(result.data.stockOpnameDetailId),
                      evidence: [...(candidate.evidence ?? []), evidencePath],
                    }
                  : candidate,
              ),
            }
          : entry,
      ),
    )
    return true
  }
  const removeAuditEvidence = async (
    auditId: string,
    assetId: string,
    index: number,
  ) => {
    const audit = findAudit(auditId)
    const item = audit?.items.find((candidate) => candidate.assetId === assetId)
    const evidencePath = item?.evidence?.[index]
    if (!audit || audit.status === "Completed" || !item || !evidencePath)
      return false
    if (!canManageExisting(currentUser, "stock-opname")) {
      notify("You do not have permission to remove evidence")
      return false
    }
    const result = await stockAuditsApi.deleteEvidence(evidencePath)
    if (!result.success) {
      notify(result.error)
      return false
    }
    commitAudits((list) =>
      list.map((entry) =>
        entry.id === auditId
          ? {
              ...entry,
              items: entry.items.map((candidate) =>
                candidate.assetId === assetId
                  ? {
                      ...candidate,
                      evidence: (candidate.evidence ?? []).filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    }
                  : candidate,
              ),
            }
          : entry,
      ),
    )
    return true
  }
  const completeAudit = async (
    auditId: string,
    options?: { updateLocation?: boolean },
  ): Promise<boolean> => {
    const audit = findAudit(auditId)
    if (!audit || audit.status === "Completed" || audit.inventoryAdjusted)
      return false
    if (!canApprove(currentUser, "stock-opname")) {
      notify("Only approvers can complete a stock opname")
      return false
    }
    if (!(await flushAuditItems(auditId))) return false
    const result = await stockAuditsApi.complete(
      auditId,
      options?.updateLocation ?? false,
      assets,
      master.locations,
    )
    if (!result.success) {
      notify(result.error)
      return false
    }
    const completed = normalizeAudit(result.data, assets)
    recordDataActivity({
      actor: currentUser,
      module: "Stock Opname",
      action: "Update",
      recordId: audit.id,
      recordLabel: audit.name,
      changes: {
        status: { before: audit.status, after: completed.status },
      },
    })
    commitAudits((list) =>
      list.map((entry) => (entry.id === auditId ? completed : entry)),
    )
    const assetsRefreshed = await refreshAssets()
    notify(
      assetsRefreshed
        ? "Stock opname completed and inventory refreshed"
        : "Stock opname completed. Inventory refresh failed; refresh it before relying on local values.",
    )
    return true
  }
  const saveMaster = (key: MasterKey, item: MasterItem) => {
    const existingRecord = master[key]?.some(
      (candidate) => candidate.id === item.id,
    )
    if (
      existingRecord
        ? !canManageExisting(currentUser, "master-data")
        : !canCreateInModule(currentUser, "master-data")
    ) {
      notify("You do not have permission to save this master record")
      return false
    }
    if (key === "conditions" || key === "statuses") {
      const records = master[key]
      const existing = records.find((candidate) => candidate.id === item.id)
      const name = item.name.trim()
      if (!name) {
        notify(
          `${key === "conditions" ? "Condition" : "Status"} name is required`,
        )
        return false
      }

      let normalized: MasterItem
      if (key === "conditions") {
        if (existing && existing.name !== name) {
          notify("Condition names cannot be changed after creation")
          return false
        }
        if (
          records.some(
            (candidate) =>
              candidate.id !== existing?.id &&
              candidate.name.trim().toLocaleLowerCase() ===
                name.toLocaleLowerCase(),
          )
        ) {
          notify("Condition name already exists")
          return false
        }
        if (!isValidTagColor(item.tagColor ?? "")) {
          notify("Choose a valid Condition tag color")
          return false
        }
        normalized = {
          id: existing?.id ?? item.id,
          name: existing?.name ?? name,
          code: "",
          tagColor: item.tagColor,
        }
      } else {
        const usage = item.usage
        if (usage !== "In" && usage !== "Out") {
          notify("Choose a valid Status usage direction")
          return false
        }
        const code = generateStatusCode(name, usage)
        if (!code) {
          notify("Status name must contain at least one supported character")
          return false
        }
        if (
          records.some(
            (candidate) =>
              candidate.id !== existing?.id && candidate.code === code,
          )
        ) {
          notify("Status code already exists")
          return false
        }
        if (
          existing &&
          usage !== existing.usage &&
          transactions.some(
            (transaction) =>
              transaction.statusId === existing.id &&
              transaction.direction !== usage,
          )
        ) {
          notify(
            "Usage cannot change while this Status is referenced by transactions in the other direction",
          )
          return false
        }
        normalized = { id: existing?.id ?? item.id, name, usage, code }
      }

      reserveMasterId(normalized.id)
      setMaster((value) => ({
        ...value,
        [key]: existing
          ? value[key].map((candidate) =>
              candidate.id === existing.id ? normalized : candidate,
            )
          : [normalized, ...value[key]],
      }))
      if (key === "statuses" && existing) {
        setTransactions((value) =>
          value.map((transaction) =>
            transaction.statusId === existing.id
              ? {
                  ...transaction,
                  type: normalized.name,
                  statusCode: normalized.code,
                }
              : transaction,
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
          module: key === "conditions" ? "Condition" : "Status",
          action: existing ? "Update" : "Create",
          recordId: normalized.id,
          recordLabel: normalized.name,
          changes,
        })
      }
      notify(`${key === "conditions" ? "Condition" : "Status"} saved`)
      return true
    }
    if (key === "categories") {
      const businessId = String(item.category_id ?? item.display_id ?? item.id)
      const existing = master.categories.find(
        (candidate) =>
          candidate.id === item.id || candidate.category_id === businessId,
      )
      const validation = validateCategory(item, master.categories)
      if (!validation.valid) {
        notify(validation.errors.join(" "))
        return false
      }
      if (existing && existing.id !== item.id) {
        notify("Category ID cannot be changed after creation")
        return false
      }
      if (
        existing &&
        (existing.category_id ?? existing.display_id) !== businessId
      ) {
        notify("Category ID cannot be changed after creation")
        return false
      }
      const internalId =
        existing?.id ??
        generateMasterInternalId(master.categories, "categories")
      const normalized = createCategoryRecord(
        internalId,
        businessId,
        item.category_name ?? item.name,
        item.category_code ?? item.code,
        item.active !== false,
      )
      reserveMasterInternalId("categories", internalId)
      setMaster((value) => ({
        ...value,
        categories: value.categories.some(
          (candidate) => candidate.id === internalId,
        )
          ? value.categories.map((candidate) =>
              candidate.id === internalId ? normalized : candidate,
            )
          : [normalized, ...value.categories],
        groups: value.groups.map((group) =>
          group.category_id === internalId
            ? {
                ...group,
                parent: normalized.name,
                category_name: normalized.name,
                category_code: normalized.code,
              }
            : group,
        ),
        types: value.types.map((type) =>
          type.category_id === internalId
            ? {
                ...type,
                category_name: normalized.name,
                category_code: normalized.code,
              }
            : type,
        ),
        models: value.models.map((model) => {
          if (model.category_id !== internalId) return model
          const group = value.groups.find(
            (entry) => entry.id === model.group_id,
          )
          const type = value.types.find((entry) => entry.id === model.type_id)
          const brand = value.brands.find(
            (entry) => entry.id === model.brand_id,
          )
          return {
            ...model,
            category_name: normalized.name,
            category_code: normalized.code,
            asset_id: generateAssetId(normalized, group, type, brand),
          }
        }),
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
          recordId: businessId,
          recordLabel: normalized.name,
          changes,
        })
      }
      notify("Category saved successfully")
      return true
    }
    if (key === "groups") {
      const businessId = String(item.group_id ?? item.display_id ?? item.id)
      const existing = master.groups.find(
        (candidate) =>
          candidate.id === item.id || candidate.group_id === businessId,
      )
      const validation = validateGroup(item, master.groups, master.categories)
      if (!validation.valid) {
        notify(validation.errors.join(" "))
        return false
      }
      if (existing && existing.id !== item.id) {
        notify("Group ID cannot be changed after creation")
        return false
      }
      if (
        existing &&
        (existing.group_id ?? existing.display_id) !== businessId
      ) {
        notify("Group ID cannot be changed after creation")
        return false
      }
      const category = resolveCategoryById(
        master.categories,
        item.category_id ?? "",
      )
      if (!category) {
        notify("Cannot save Group: select a valid Category")
        return false
      }
      if (
        existing &&
        existing.category_id !== category.id &&
        (master.types.some((type) => type.group_id === existing.id) ||
          master.models.some((model) => model.group_id === existing.id) ||
          assets.some((asset) => asset.groupId === existing.id))
      ) {
        notify(
          "Category cannot change while Types, Models, or Assets reference this Group",
        )
        return false
      }
      const internalId =
        existing?.id ?? generateMasterInternalId(master.groups, "groups")
      const normalized = createGroupRecord(
        internalId,
        businessId,
        item.group_name ?? item.name,
        category,
        item.active !== false,
        item.group_code ?? item.code,
      )
      reserveMasterInternalId("groups", internalId)
      setMaster((value) => ({
        ...value,
        groups: value.groups.some((candidate) => candidate.id === internalId)
          ? value.groups.map((candidate) =>
              candidate.id === internalId ? normalized : candidate,
            )
          : [normalized, ...value.groups],
        types: value.types.map((type) =>
          type.group_id === internalId
            ? {
                ...type,
                parent: normalized.name,
                group_name: normalized.name,
                group_code: normalized.group_code,
                category_id: normalized.category_id,
                category_name: normalized.category_name,
                category_code: normalized.category_code,
              }
            : type,
        ),
        models: value.models.map((model) => {
          if (model.group_id !== internalId) return model
          const type = value.types.find((entry) => entry.id === model.type_id)
          const brand = value.brands.find(
            (entry) => entry.id === model.brand_id,
          )
          return {
            ...model,
            group_name: normalized.name,
            group_code: normalized.group_code,
            category_id: normalized.category_id,
            category_name: normalized.category_name,
            category_code: normalized.category_code,
            asset_id: generateAssetId(
              value.categories.find(
                (entry) => entry.id === normalized.category_id,
              ),
              normalized,
              type,
              brand,
            ),
          }
        }),
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
          recordId: businessId,
          recordLabel: normalized.name,
          changes,
        })
      }
      notify("Group saved successfully")
      return true
    }
    if (key === "types" || key === "brands" || key === "models") {
      const field = {
        types: "type_id",
        brands: "brand_id",
        models: "model_id",
      }[key] as keyof MasterItem
      const businessId = String(item[field] ?? item.display_id ?? "")
      const existing = master[key].find((candidate) => candidate.id === item.id)
      const internalId =
        existing?.id ?? generateMasterInternalId(master[key], key)
      const name = item.name.trim()
      const code =
        key === "types"
          ? (item.type_code ?? item.code)
          : key === "brands"
            ? (item.brand_code ?? item.code)
            : (item.model_code ?? item.code)
      if (!name) {
        notify(`${key.slice(0, -1)} name is required`)
        return false
      }
      const businessIdPattern =
        key === "types"
          ? /^t\d{4}$/
          : key === "brands"
            ? /^b\d{4}$/
            : /^m\d{4}$/
      if (!businessIdPattern.test(businessId)) {
        notify(`${key.slice(0, -1)} ID must use its generated format`)
        return false
      }
      if (
        master[key].some(
          (candidate) =>
            candidate.id !== existing?.id && candidate[field] === businessId,
        )
      ) {
        notify(`${key.slice(0, -1)} ID already exists`)
        return false
      }
      if (existing && existing[field] !== businessId) {
        notify(`${key.slice(0, -1)} ID cannot be changed after creation`)
        return false
      }
      if (
        master[key].some(
          (candidate) =>
            candidate.id !== existing?.id &&
            candidate.name.trim().toLocaleLowerCase() ===
              name.toLocaleLowerCase(),
        )
      ) {
        notify(`${key.slice(0, -1)} name already exists`)
        return false
      }

      let normalized: MasterItem
      if (key === "types") {
        const group = resolveGroupById(
          master.groups,
          String(item.group_id ?? ""),
        )
        const category = group
          ? resolveCategoryById(
              master.categories,
              String(group.category_id ?? ""),
            )
          : undefined
        if (!group || !category || item.category_id !== category.id) {
          notify("Cannot save Type: select a Group belonging to its Category")
          return false
        }
        if (
          existing &&
          existing.group_id !== group.id &&
          (master.models.some((model) => model.type_id === existing.id) ||
            assets.some((asset) => asset.typeId === existing.id))
        ) {
          notify(
            "Group cannot change while Models or Assets reference this Type",
          )
          return false
        }
        if (!code?.trim()) {
          notify("Type code is required")
          return false
        }
        if (
          master.types.some(
            (candidate) =>
              candidate.id !== existing?.id &&
              (candidate.type_id === businessId ||
                candidate.code.toLocaleLowerCase() ===
                  code.toLocaleLowerCase()),
          )
        ) {
          notify("Type ID or code already exists")
          return false
        }
        normalized = {
          ...item,
          id: internalId,
          display_id: businessId,
          type_id: businessId,
          name,
          code,
          type_name: name,
          type_code: code,
          group_id: group.id,
          group_name: group.name,
          group_code: group.group_code ?? group.code,
          category_id: category.id,
          category_display_id: category.display_id ?? category.category_id,
          category_name: category.name,
          category_code: category.category_code ?? category.code,
          parent: group.name,
        }
      } else if (key === "brands") {
        const type = item.type_id
          ? resolveTypeById(master.types, item.type_id)
          : undefined
        if (item.type_id && !type) {
          notify("Cannot save Brand: select a valid Type or leave it empty")
          return false
        }
        if (!code?.trim()) {
          notify("Brand code is required")
          return false
        }
        if (
          master.brands.some(
            (candidate) =>
              candidate.id !== existing?.id &&
              (candidate.brand_id === businessId ||
                candidate.code.toLocaleLowerCase() ===
                  code.toLocaleLowerCase()),
          )
        ) {
          notify("Brand ID or code already exists")
          return false
        }
        if (
          existing &&
          existing.type_id !== type?.id &&
          master.models.some(
            (model) =>
              model.brand_id === existing.id &&
              type?.id &&
              model.type_id !== type.id,
          )
        ) {
          notify(
            "Brand Type cannot change while linked Models use another Type",
          )
          return false
        }
        if (
          existing &&
          existing.type_id !== type?.id &&
          assets.some(
            (asset) =>
              asset.brandId === existing.id &&
              type?.id &&
              asset.typeId !== type.id,
          )
        ) {
          notify(
            "Brand Type cannot change while linked Assets use another Type",
          )
          return false
        }
        normalized = {
          ...item,
          id: internalId,
          display_id: businessId,
          brand_id: businessId,
          name,
          code,
          brand_name: name,
          brand_code: code,
          type_id: type?.id ?? "",
          type_name: type?.name ?? "",
          type_code: type?.type_code ?? type?.code ?? "",
          type_display_id: type?.display_id ?? "",
          parent: type?.name ?? "",
        }
      } else {
        const type = resolveTypeById(master.types, String(item.type_id ?? ""))
        const group = type
          ? resolveGroupById(master.groups, String(type.group_id ?? ""))
          : undefined
        const category = group
          ? resolveCategoryById(
              master.categories,
              String(group.category_id ?? ""),
            )
          : undefined
        const brand = resolveBrandById(
          master.brands,
          String(item.brand_id ?? ""),
        )
        const assetId = generateAssetId(category, group, type, brand)
        if (
          !category ||
          !group ||
          !type ||
          !brand ||
          item.category_id !== category.id ||
          item.group_id !== group.id ||
          (brand.type_id && brand.type_id !== type.id)
        ) {
          notify(
            "Cannot save Model: the selected classification relationships are inconsistent",
          )
          return false
        }
        if (!assetId) {
          notify("Cannot save Model: all classification codes are required")
          return false
        }
        if (
          existing &&
          assets.some(
            (asset) =>
              asset.modelId === existing.id &&
              (existing.category_id !== category.id ||
                existing.group_id !== group.id ||
                existing.type_id !== type.id ||
                existing.brand_id !== brand.id),
          )
        ) {
          notify("Model classification cannot change while Assets reference it")
          return false
        }
        if (
          assetId !== existing?.asset_id &&
          master.models.some(
            (candidate) =>
              candidate.id !== existing?.id && candidate.asset_id === assetId,
          )
        ) {
          notify("Generated Asset ID already exists")
          return false
        }
        normalized = {
          ...item,
          id: internalId,
          display_id: businessId,
          model_id: businessId,
          name,
          model_name: name,
          model_code: businessId,
          asset_id: assetId,
          category_id: category.id,
          category_name: category.name,
          category_code: category.category_code ?? category.code,
          group_id: group.id,
          group_name: group.name,
          group_code: group.group_code ?? group.code,
          type_id: type.id,
          type_name: type.name,
          type_code: type.type_code ?? type.code,
          brand_id: brand.id,
          brand_name: brand.name,
          brand_code: brand.brand_code ?? brand.code,
          parent: brand.name,
        }
      }

      reserveMasterInternalId(key, internalId)
      setMaster((value) => {
        const next = {
          ...value,
          [key]: value[key].some((candidate) => candidate.id === internalId)
            ? value[key].map((candidate) =>
                candidate.id === internalId ? normalized : candidate,
              )
            : [normalized, ...value[key]],
        }
        if (key === "types") {
          next.brands = value.brands.map((brand) =>
            brand.type_id === internalId
              ? {
                  ...brand,
                  type_name: normalized.name,
                  type_code: normalized.type_code,
                  parent: normalized.name,
                }
              : brand,
          )
          next.models = value.models.map((model) => {
            if (model.type_id !== internalId) return model
            const group = value.groups.find(
              (entry) => entry.id === normalized.group_id,
            )
            const category = value.categories.find(
              (entry) => entry.id === normalized.category_id,
            )
            const brand = value.brands.find(
              (entry) => entry.id === model.brand_id,
            )
            return {
              ...model,
              type_name: normalized.name,
              type_code: normalized.type_code,
              group_id: normalized.group_id,
              group_name: group?.name ?? "",
              group_code: group?.group_code ?? group?.code ?? "",
              category_id: normalized.category_id,
              category_name: category?.name ?? "",
              category_code: category?.category_code ?? category?.code ?? "",
              asset_id: generateAssetId(category, group, normalized, brand),
            }
          })
        }
        if (key === "brands") {
          next.models = value.models.map((model) =>
            model.brand_id === internalId
              ? {
                  ...model,
                  brand_name: normalized.name,
                  brand_code: normalized.brand_code,
                  asset_id: generateAssetId(
                    value.categories.find(
                      (entry) => entry.id === model.category_id,
                    ),
                    value.groups.find((entry) => entry.id === model.group_id),
                    value.types.find((entry) => entry.id === model.type_id),
                    normalized,
                  ),
                }
              : model,
          )
        }
        return next
      })
      if (existing && existing.name !== normalized.name)
        setAssets((value) =>
          value.map((asset) =>
            key === "types" && asset.typeId === internalId
              ? { ...asset, type: normalized.name }
              : key === "brands" && asset.brandId === internalId
                ? { ...asset, brand: normalized.name }
                : key === "models" && asset.modelId === internalId
                  ? { ...asset, model: normalized.name }
                  : asset,
          ),
        )
      const changes = existing
        ? summarizeChanges(
            existing as unknown as Record<string, unknown>,
            normalized as unknown as Record<string, unknown>,
          )
        : undefined
      if (!existing || Object.keys(changes ?? {}).length)
        recordDataActivity({
          actor: currentUser,
          module:
            key === "types" ? "Type" : key === "brands" ? "Brand" : "Model",
          action: existing ? "Update" : "Create",
          recordId: businessId,
          recordLabel: name,
          changes,
        })
      notify(`${key.slice(0, -1)} saved`)
      return true
    }

    const existing = master[key].find((candidate) => candidate.id === item.id)
    reserveMasterId(item.id)
    setMaster((value) => ({
      ...value,
      [key]: value[key].some((candidate) => candidate.id === item.id)
        ? value[key].map((candidate) =>
            candidate.id === item.id ? item : candidate,
          )
        : [item, ...value[key]],
    }))
    if (existing && existing.name !== item.name) {
      setAssets((value) =>
        value.map((asset) =>
          asset.location === existing.name
            ? { ...asset, location: item.name }
            : asset,
        ),
      )
    }
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          item as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: "Location",
        action: existing ? "Update" : "Create",
        recordId: item.id,
        recordLabel: item.name,
        changes,
      })
    }
    notify("Master data saved")
    return true
  }
  const saveBusinessUnit = async (nameValue: string, id?: string) => {
    const name = nameValue.trim()
    if (!name) {
      notify("Business Unit name is required")
      return false
    }
    const existing = id
      ? master.businessUnits.find((unit) => unit.id === id)
      : undefined
    if (id && !existing) {
      notify("Business Unit not found. Refresh master data and try again.")
      return false
    }
    if (
      existing
        ? !canManageExisting(currentUser, "master-data")
        : !canCreateInModule(currentUser, "master-data")
    ) {
      notify("You do not have permission to save this Business Unit")
      return false
    }
    if (
      master.businessUnits.some(
        (unit) =>
          unit.id !== existing?.id &&
          unit.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      notify("Business Unit name already exists")
      return false
    }
    const numericId = existing ? Number(existing.id) : undefined
    if (
      existing &&
      (!Number.isSafeInteger(numericId) || (numericId ?? 0) <= 0)
    ) {
      notify("Business Unit ID must be a positive integer")
      return false
    }
    const result = existing
      ? await businessUnitsApi.update(numericId!, {
          busUnitCode: name,
          busUnitPrefix: generateBusinessUnitCode(name),
          isActive: existing.active ?? true,
        })
      : await businessUnitsApi.create({
          busUnitCode: name,
          busUnitPrefix: generateBusinessUnitCode(name),
          isActive: true,
        })
    if (!result.success) {
      notify(result.error)
      return false
    }
    if (
      !Number.isSafeInteger(result.data.busUnitId) ||
      result.data.busUnitId <= 0 ||
      !result.data.busUnitCode?.trim()
    ) {
      notify("The API returned an invalid Business Unit")
      return false
    }
    const nextUnit = toBusinessUnitItem(result.data)
    const unitId = nextUnit.id
    if (existing && existing.id !== unitId) {
      notify("The API returned a different Business Unit ID")
      return false
    }
    setMaster((value) => ({
      ...value,
      businessUnits: existing
        ? value.businessUnits.map((unit) =>
            unit.id === unitId ? nextUnit : unit,
          )
        : [nextUnit, ...value.businessUnits],
    }))
    invalidateMasterDataCache()
    if (existing && existing.name !== name) {
      setAssets((value) =>
        value.map((asset) =>
          asset.businessUnitId === unitId ||
          (!asset.businessUnitId && asset.businessUnit === existing.name)
            ? { ...asset, businessUnit: name, businessUnitId: unitId }
            : asset,
        ),
      )
      setTransactions((value) =>
        value.map((transaction) =>
          transaction.businessUnitId === unitId ||
          (!transaction.businessUnitId &&
            transaction.businessUnit === existing.name)
            ? { ...transaction, businessUnit: name, businessUnitId: unitId }
            : transaction,
        ),
      )
      setAudits((value) =>
        value.map((audit) =>
          audit.businessUnitId === unitId ||
          (!audit.businessUnitId && audit.businessUnit === existing.name)
            ? { ...audit, businessUnit: name, businessUnitId: unitId }
            : audit,
        ),
      )
    }
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          nextUnit as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: "Business Unit",
        action: existing ? "Update" : "Create",
        recordId: unitId,
        recordLabel: name,
        changes,
      })
    }
    notify(existing ? "Business Unit saved" : "Business Unit created")
    return true
  }
  const saveLocation = async (
    nameValue: string,
    businessUnitId: string,
    id?: string,
  ) => {
    const name = nameValue.trim()
    const businessUnit = master.businessUnits.find(
      (unit) => unit.id === businessUnitId,
    )
    if (!name || !businessUnit) {
      notify("Location name and a valid Business Unit are required")
      return false
    }
    const existing = id
      ? master.locations.find((location) => location.id === id)
      : undefined
    if (id && !existing) {
      notify("Location not found. Refresh master data and try again.")
      return false
    }
    if (
      existing
        ? !canManageExisting(currentUser, "master-data")
        : !canCreateInModule(currentUser, "master-data")
    ) {
      notify("You do not have permission to save this Location")
      return false
    }
    if (existing && existing.businessUnitId !== businessUnitId) {
      notify("A Location cannot be moved to another Business Unit here")
      return false
    }
    if (
      master.locations.some(
        (location) =>
          location.id !== existing?.id &&
          location.businessUnitId === businessUnitId &&
          location.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      notify("This Location name already exists in the selected Business Unit")
      return false
    }
    const numericBusinessUnitId = Number(businessUnitId)
    const numericLocationId = existing ? Number(existing.id) : undefined
    if (
      !Number.isSafeInteger(numericBusinessUnitId) ||
      numericBusinessUnitId <= 0 ||
      (existing &&
        (!Number.isSafeInteger(numericLocationId) ||
          (numericLocationId ?? 0) <= 0))
    ) {
      notify("Business Unit and Location IDs must be positive integers")
      return false
    }
    const result = existing
      ? await locationsApi.update(numericLocationId!, {
          busUnitId: numericBusinessUnitId,
          locationName: name,
        })
      : await locationsApi.create({
          busUnitId: numericBusinessUnitId,
          locationName: name,
        })
    if (!result.success) {
      notify(result.error)
      return false
    }
    if (
      !Number.isSafeInteger(result.data.locationId) ||
      result.data.locationId <= 0 ||
      result.data.busUnitId !== numericBusinessUnitId ||
      !result.data.locationName?.trim()
    ) {
      notify("The API returned an invalid Location")
      return false
    }
    const nextLocation = {
      ...existing,
      ...toLocationItem(result.data),
    }
    const locationId = nextLocation.id
    if (existing && existing.id !== locationId) {
      notify("The API returned a different Location ID")
      return false
    }
    setMaster((value) => ({
      ...value,
      locations: existing
        ? value.locations.map((location) =>
            location.id === locationId ? nextLocation : location,
          )
        : [...value.locations, nextLocation],
    }))
    invalidateMasterDataCache()
    if (existing && existing.name !== name) {
      setAssets((value) =>
        value.map((asset) =>
          asset.locationId === locationId
            ? { ...asset, location: name }
            : asset,
        ),
      )
      setTransactions((value) =>
        value.map((transaction) =>
          transaction.locationId === locationId
            ? { ...transaction, location: name }
            : transaction,
        ),
      )
      setAudits((value) =>
        value.map((audit) => ({
          ...audit,
          location: audit.locationId === locationId ? name : audit.location,
          items: audit.items.map((item) => ({
            ...item,
            actualLocation:
              item.actualLocationId === locationId ? name : item.actualLocation,
            systemLocation:
              item.systemLocationId === locationId ? name : item.systemLocation,
          })),
        })),
      )
    }
    const changes = existing
      ? summarizeChanges(
          existing as unknown as Record<string, unknown>,
          nextLocation as unknown as Record<string, unknown>,
        )
      : undefined
    if (!existing || Object.keys(changes ?? {}).length) {
      recordDataActivity({
        actor: currentUser,
        module: "Location",
        action: existing ? "Update" : "Create",
        recordId: locationId,
        recordLabel: name,
        changes,
      })
    }
    notify(existing ? "Location saved" : "Location created")
    return true
  }
  const deleteBusinessUnit = async (id: string) => {
    if (!canDelete(currentUser, "master-data")) {
      notify("Hanya Admin yang dapat melakukan penghapusan data.")
      return false
    }
    const unit = master.businessUnits.find((item) => item.id === id)
    if (!unit) return false
    const hasLocations = master.locations.some(
      (location) => location.businessUnitId === id,
    )
    const hasReferences =
      assets.some(
        (asset) =>
          asset.businessUnitId === id || asset.businessUnit === unit.name,
      ) ||
      transactions.some(
        (transaction) =>
          transaction.businessUnitId === id ||
          transaction.businessUnit === unit.name,
      ) ||
      audits.some(
        (audit) =>
          audit.businessUnitId === id || audit.businessUnit === unit.name,
      )
    if (hasLocations || hasReferences) {
      notify(
        hasLocations
          ? "Cannot delete this Business Unit while it has Locations. Remove or reassign the Locations first."
          : "Cannot delete this Business Unit because assets, transactions, or stock opname records still reference it.",
      )
      return false
    }
    const result = await businessUnitsApi.destroy(id)
    if (!result.success) {
      notify(result.error)
      return false
    }
    reserveDeletedBusinessUnit(id)
    setMaster((value) => ({
      ...value,
      businessUnits: value.businessUnits.filter((item) => item.id !== id),
    }))
    invalidateMasterDataCache()
    recordDataActivity({
      actor: currentUser,
      module: "Business Unit",
      action: "Delete",
      recordId: id,
      recordLabel: unit.name,
    })
    notify("Business Unit deleted")
    return true
  }
  const deleteLocation = async (id: string) => {
    if (!canDelete(currentUser, "master-data")) {
      notify("Hanya Admin yang dapat melakukan penghapusan data.")
      return false
    }
    const location = master.locations.find((item) => item.id === id)
    if (!location) return false
    const isUsed =
      assets.some(
        (asset) =>
          asset.locationId === id ||
          (asset.location === location.name &&
            asset.businessUnitId === location.businessUnitId),
      ) ||
      transactions.some(
        (transaction) =>
          transaction.locationId === id ||
          (transaction.location === location.name &&
            transaction.businessUnitId === location.businessUnitId),
      ) ||
      audits.some(
        (audit) =>
          audit.locationId === id ||
          audit.items.some(
            (item) =>
              item.actualLocationId === id || item.systemLocationId === id,
          ),
      )
    if (isUsed) {
      notify(
        "Cannot delete this Location because assets, transactions, or stock opname records still reference it.",
      )
      return false
    }
    const result = await locationsApi.destroy(id)
    if (!result.success) {
      notify(result.error)
      return false
    }
    reserveDeletedLocation(id)
    setMaster((value) => ({
      ...value,
      locations: value.locations.filter((item) => item.id !== id),
    }))
    invalidateMasterDataCache()
    recordDataActivity({
      actor: currentUser,
      module: "Location",
      action: "Delete",
      recordId: id,
      recordLabel: location.name,
    })
    notify("Location deleted")
    return true
  }
  const deleteMaster = (key: MasterKey, id: string) => {
    if (!canDelete(currentUser, "master-data")) {
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
    const conditionInUse =
      key === "conditions" &&
      (assets.some(
        (asset) =>
          asset.condition.trim().toLocaleLowerCase() ===
          item.name.trim().toLocaleLowerCase(),
      ) ||
        transactions.some((transaction) =>
          transaction.assets?.some(
            (row) =>
              row.condition?.trim().toLocaleLowerCase() ===
              item.name.trim().toLocaleLowerCase(),
          ),
        ) ||
        Object.values(master)
          .flat()
          .some((candidate) => candidate.condition_id === item.id))
    const statusInUse =
      key === "statuses" &&
      transactions.some(
        (transaction) =>
          transaction.statusId === item.id ||
          (!transaction.statusId &&
            transaction.direction === item.usage &&
            transaction.type.trim().toLocaleLowerCase() ===
              item.name.trim().toLocaleLowerCase()),
      )
    const categoryInUse =
      key === "categories" &&
      (master.groups.some((group) => group.category_id === item.id) ||
        master.types.some((type) => type.category_id === item.id) ||
        master.models.some((model) => model.category_id === item.id) ||
        assets.some((asset) => asset.categoryId === item.id))
    const groupInUse =
      key === "groups" &&
      (master.types.some((type) => type.group_id === item.id) ||
        master.models.some((model) => model.group_id === item.id) ||
        assets.some((asset) => asset.groupId === item.id))
    const typeInUse =
      key === "types" &&
      (master.brands.some((brand) => brand.type_id === item.id) ||
        master.models.some((model) => model.type_id === item.id) ||
        assets.some((asset) => asset.typeId === item.id))
    const brandInUse =
      key === "brands" &&
      (master.models.some((model) => model.brand_id === item.id) ||
        assets.some((asset) => asset.brandId === item.id))
    const modelInUse =
      key === "models" && assets.some((asset) => asset.modelId === item.id)
    const genericMasterUse =
      key !== "conditions" &&
      key !== "statuses" &&
      (assets.some((a) => Object.values(a).includes(item.name)) ||
        Object.values(master)
          .flat()
          .some((x) => x.parent === item.name))
    const used =
      conditionInUse ||
      statusInUse ||
      categoryInUse ||
      groupInUse ||
      typeInUse ||
      brandInUse ||
      modelInUse ||
      genericMasterUse
    if (used) {
      notify(
        key === "categories"
          ? "Cannot delete Category: reassign its Groups and Assets first"
          : key === "groups"
            ? "Cannot delete Group: reassign its Types and Assets first"
            : key === "types"
              ? "Cannot delete Type: it is still referenced by Brands, Models, or Assets"
              : key === "brands"
                ? "Cannot delete Brand: it is still referenced by Models or Assets"
                : key === "models"
                  ? "Cannot delete Model: it is still referenced by Assets"
                  : key === "conditions"
                    ? "Cannot delete Condition: it is still referenced by assets or transactions"
                    : key === "statuses"
                      ? "Cannot delete Status: it is still referenced by transactions"
                      : "Cannot delete: record is still referenced",
      )
      return false
    }
    const classificationKey =
      key === "categories" ||
      key === "groups" ||
      key === "types" ||
      key === "brands" ||
      key === "models"
    if (!classificationKey) reserveMasterId(item.id)
    if (classificationKey) {
      reserveMasterInternalId(key, item.id)
    }
    setMaster((v) => ({
      ...v,
      [key]: v[key].filter((candidate) =>
        classificationKey
          ? candidate.id !== id
          : candidate.id !== id &&
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
            : key === "conditions"
              ? "Condition"
              : key === "statuses"
                ? "Status"
                : "Master Data",
      action: "Delete",
      recordId: item.id,
      recordLabel: item.name,
    })
    notify("Master record deleted")
    return true
  }
  const value = useMemo(
    () => ({
      assets,
      transactions,
      audits,
      auditDataStatus,
      auditDataError,
      master,
      businessUnit,
      theme,
      sidebarCollapsed,
      selectedAsset,
      toast,
      masterDataStatus,
      masterDataError,
      masterDataRefreshing,
      refreshMasterData,
      refreshAssets,
      refreshAudits,
      loadAuditDetails,
      deleteAudit,
      uploadAuditEvidence,
      removeAuditEvidence,
      loadTransactionDetails,
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
      saveMaster,
      deleteMaster,
      saveBusinessUnit,
      saveLocation,
      deleteBusinessUnit,
      deleteLocation,
    }),
    [
      assets,
      transactions,
      currentUser,
      audits,
      auditDataStatus,
      auditDataError,
      master,
      businessUnit,
      theme,
      sidebarCollapsed,
      selectedAsset,
      toast,
      masterDataStatus,
      masterDataError,
      masterDataRefreshing,
      refreshMasterData,
      refreshAssets,
      refreshAudits,
      loadAuditDetails,
      deleteAudit,
      uploadAuditEvidence,
      removeAuditEvidence,
      saveBusinessUnit,
      saveLocation,
      deleteBusinessUnit,
      deleteLocation,
    ],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useInventory = () => {
  const value = useContext(Context)
  if (!value) throw new Error("InventoryProvider is missing")
  return value
}
