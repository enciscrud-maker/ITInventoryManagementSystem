import { apiRoutes } from "@/config/api-routes"
import type {
  Transaction,
  TransactionAssetItem,
  TransactionAttachment,
  TransactionStatus,
} from "@/data/demoData"
import { httpRequest } from "@/lib/http/httpClient"
import type { ApiFailure, ApiResult } from "@/lib/api/types"

type ApiGoodStatus = "InProgress" | "Completed"
type ApiTransactionType = "Return" | "NewUnit" | "AfterService" | "Borrowing" | "Service" | "Disposal" | "OffLease" | "Handover"

type GoodItemRequest = {
  assetId: number
  quantity: number
  serialNumber?: string
  referenceNumber?: string
  assetInformation?: string
  condition?: string
  remarks?: string
  specifications?: string
  requestJustification?: string
  requiredDuration?: string
  intendedPurpose?: string
}

type GoodCreateRequest = {
  requestId: string
  transactionType: ApiTransactionType
  businessUnit: string
  requestDate: string
  formIssueDate: string
  personName: string
  personNik: string
  personDepartment: string
  destinationLocation: string
  requestNumber: string
  approverName: string
  inventoryNotes: string
  items: GoodItemRequest[]
}

type GoodItemDto = {
  goodDetailId: number
  assetId: number
  assetName: string | null
  quantity: number
  serialNumber: string | null
  referenceNumber: string | null
  assetInformation: string | null
  condition: string | null
  remarks: string | null
  specifications: string | null
  requestJustification: string | null
  requiredDuration: string | null
  intendedPurpose: string | null
}

type GoodAttachmentDto = {
  goodAttachmentId: number
  originalFileName: string | null
  contentType: string | null
  fileSize: number
}

type GoodStatusHistoryDto = {
  goodStatusHistoryId: number
  previousStatus: ApiGoodStatus
  newStatus: ApiGoodStatus
  actorUserId: number
  actorName: string | null
  actorNik: string | null
  changedAt: string
  notes: string | null
}

type GoodDetailDto = {
  goodId: number
  documentNumber: string | null
  transactionType: ApiTransactionType
  status: ApiGoodStatus
  businessUnit: string | null
  requestDate: string
  formIssueDate: string
  personName: string | null
  personNik: string | null
  personDepartment: string | null
  destinationLocation: string | null
  requestNumber: string | null
  approverName: string | null
  inventoryNotes: string | null
  inventoryAdjustmentApplied: boolean
  inventoryAdjustedAt: string | null
  items: GoodItemDto[] | null
  attachments: GoodAttachmentDto[] | null
  statusHistory: GoodStatusHistoryDto[] | null
}

type GoodListItemDto = {
  goodId: number
  date: string
  documentNumber: string | null
  totalAssets: number
  transactionType: ApiTransactionType
  sourceOrRecipient: string | null
  destination: string | null
  status: ApiGoodStatus
}

type GoodListPageDto = {
  items: GoodListItemDto[] | null
  totalPages: number
}

const requestOptions = { baseUrl: "same-origin" as const }

const typeToApi: Record<string, ApiTransactionType> = {
  Return: "Return",
  "New Unit": "NewUnit",
  "After Service": "AfterService",
  Borrowing: "Borrowing",
  Service: "Service",
  Disposal: "Disposal",
  "Off Lease": "OffLease",
  Handover: "Handover",
}

const typeFromApi: Record<ApiTransactionType, string> = {
  Return: "Return",
  NewUnit: "New Unit",
  AfterService: "After Service",
  Borrowing: "Borrowing",
  Service: "Service",
  Disposal: "Disposal",
  OffLease: "Off Lease",
  Handover: "Handover",
}

const invalidResponse = (message: string): ApiFailure => ({
  success: false,
  error: message,
  code: "INVALID_GOODS_RESPONSE",
})

const toApiStatus = (status: TransactionStatus): ApiGoodStatus =>
  status === "Completed" ? "Completed" : "InProgress"

const fromApiStatus = (status: ApiGoodStatus): TransactionStatus =>
  status === "Completed" ? "Completed" : "In Progress"

const dateTime = (date: string) =>
  date.includes("T") ? date : `${date}T00:00:00.000Z`

const dateOnly = (date: string) => date.slice(0, 10)

const text = (value: string | null | undefined) => value ?? ""

function routeFor(direction: Transaction["direction"]) {
  return direction === "In"
    ? apiRoutes.inventory.goodsIn
    : apiRoutes.inventory.goodsOut
}

function mapStatusHistory(
  entries: GoodStatusHistoryDto[] | null,
): NonNullable<Transaction["statusHistory"]> {
  return (entries ?? []).map((entry) => ({
    id: String(entry.goodStatusHistoryId),
    previousStatus: fromApiStatus(entry.previousStatus),
    newStatus: fromApiStatus(entry.newStatus),
    actorAccountId: String(entry.actorUserId),
    actorName: text(entry.actorName),
    actorNik: text(entry.actorNik),
    timestamp: entry.changedAt,
    notes: entry.notes ?? undefined,
  }))
}

function mapAttachments(
  entries: GoodAttachmentDto[] | null,
): TransactionAttachment[] {
  return (entries ?? []).map((entry) => ({
    id: String(entry.goodAttachmentId),
    name: text(entry.originalFileName),
    size: entry.fileSize,
    type: text(entry.contentType),
  }))
}

function mapItem(item: GoodItemDto): TransactionAssetItem {
  return {
    rowId: String(item.goodDetailId),
    assetId: String(item.assetId),
    itemName: text(item.assetName),
    quantity: item.quantity,
    serialNumber: text(item.serialNumber),
    referenceNumber: text(item.referenceNumber),
    assetInformation: text(item.assetInformation),
    condition: text(item.condition),
    remarks: text(item.remarks),
    specifications: text(item.specifications),
    justification: text(item.requestJustification),
    duration: text(item.requiredDuration),
    purpose: text(item.intendedPurpose),
  }
}

function fromDetail(
  direction: Transaction["direction"],
  detail: GoodDetailDto,
): Transaction | null {
  const type = typeFromApi[detail.transactionType]
  if (!Number.isSafeInteger(detail.goodId) || detail.goodId <= 0 || !type) {
    return null
  }

  const assets = (detail.items ?? []).map(mapItem)
  const firstItem = assets[0]
  const date = dateOnly(detail.formIssueDate || detail.requestDate)

  return {
    id: String(detail.goodId),
    direction,
    date,
    document: text(detail.documentNumber),
    assetId: firstItem?.assetId ?? "",
    type,
    quantity: assets.reduce((sum, item) => sum + item.quantity, 0),
    location: text(detail.destinationLocation),
    businessUnit: text(detail.businessUnit),
    status: fromApiStatus(detail.status),
    user: text(detail.personName),
    requestDate: dateOnly(detail.requestDate),
    formIssueDate: dateOnly(detail.formIssueDate),
    party: {
      name: text(detail.personName),
      nik: text(detail.personNik),
      department: text(detail.personDepartment),
    },
    assets,
    supportingDocuments: mapAttachments(detail.attachments),
    requestNumber: text(detail.requestNumber),
    approverName: text(detail.approverName),
    inventoryNotes: text(detail.inventoryNotes),
    statusHistory: mapStatusHistory(detail.statusHistory),
    inventoryAdjustmentApplied: detail.inventoryAdjustmentApplied,
    inventoryAdjustedAt: detail.inventoryAdjustedAt ?? undefined,
  }
}

function fromListItem(
  direction: Transaction["direction"],
  item: GoodListItemDto,
): Transaction | null {
  const type = typeFromApi[item.transactionType]
  if (!Number.isSafeInteger(item.goodId) || item.goodId <= 0 || !type) {
    return null
  }

  return {
    id: String(item.goodId),
    direction,
    date: dateOnly(item.date),
    document: text(item.documentNumber),
    assetId: "",
    type,
    quantity: item.totalAssets,
    location: text(item.destination),
    businessUnit: "",
    status: fromApiStatus(item.status),
    user: text(item.sourceOrRecipient),
    party: { name: text(item.sourceOrRecipient), nik: "", department: "" },
    assets: [],
    supportingDocuments: [],
    statusHistory: [],
  }
}

async function getDetail(
  direction: Transaction["direction"],
  id: string,
): Promise<ApiResult<Transaction>> {
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    return {
      success: false,
      error: "ID transaksi dari server tidak valid.",
      code: "INVALID_TRANSACTION_ID",
    }
  }

  const result = await httpRequest<GoodDetailDto>(
    `${routeFor(direction)}/${numericId}`,
    { method: "GET" },
    requestOptions,
  )
  if (!result.success) return result
  const transaction = fromDetail(direction, result.data)
  return transaction
    ? { success: true, data: transaction, status: result.status }
    : invalidResponse("Detail transaksi dari server tidak valid.")
}

function toCreateRequest(
  transaction: Transaction,
): ApiResult<GoodCreateRequest> {
  const transactionType = typeToApi[transaction.type]
  if (!transactionType) {
    return {
      success: false,
      error: `Tipe transaksi "${transaction.type}" tidak didukung oleh API Goods.`,
      code: "UNSUPPORTED_TRANSACTION_TYPE",
    }
  }

  const assets = transaction.assets ?? []
  const items: GoodItemRequest[] = []
  for (const asset of assets) {
    const assetId = Number(asset.assetId)
    if (
      !Number.isSafeInteger(assetId) ||
      assetId <= 0 ||
      assetId > 2_147_483_647
    ) {
      return {
        success: false,
        error: `Aset "${asset.itemName || asset.assetId}" tidak memiliki assetId numerik yang valid dari database.`,
        code: "INVALID_ASSET_ID",
      }
    }
    items.push({
      assetId,
      quantity: asset.quantity,
      serialNumber: asset.serialNumber,
      referenceNumber: asset.referenceNumber,
      assetInformation: asset.assetInformation,
      condition: asset.condition,
      remarks: asset.remarks,
      specifications: asset.specifications,
      requestJustification: asset.justification,
      requiredDuration: asset.duration,
      intendedPurpose: asset.purpose,
    })
  }

  return {
    success: true,
    status: 200,
    data: {
      requestId: transaction.id,
      transactionType,
      businessUnit: transaction.businessUnit,
      requestDate: dateTime(transaction.requestDate ?? transaction.date),
      formIssueDate: dateTime(transaction.formIssueDate ?? transaction.date),
      personName: transaction.party?.name ?? transaction.user,
      personNik: transaction.party?.nik ?? "",
      personDepartment: transaction.party?.department ?? "",
      destinationLocation: transaction.location,
      requestNumber: transaction.requestNumber ?? "",
      approverName: transaction.approverName ?? "",
      inventoryNotes: transaction.inventoryNotes ?? transaction.notes ?? "",
      items,
    },
  }
}

async function getPage(direction: Transaction["direction"], page: number) {
  const params = new URLSearchParams({ Page: String(page), PageSize: "100" })
  return httpRequest<GoodListPageDto>(
    `${routeFor(direction)}?${params}`,
    { method: "GET" },
    requestOptions,
  )
}

export const transactionsApi = {
  list: async (
    direction: Transaction["direction"],
  ): Promise<ApiResult<Transaction[]>> => {
    const firstPage = await getPage(direction, 1)
    if (!firstPage.success) return firstPage
    if (
      !firstPage.data ||
      !Number.isSafeInteger(firstPage.data.totalPages) ||
      firstPage.data.totalPages < 0
    ) {
      return invalidResponse("Format daftar transaksi dari server tidak valid.")
    }

    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(1, firstPage.data.totalPages) - 1 },
        (_, index) => getPage(direction, index + 2),
      ),
    )
    const pages: GoodListPageDto[] = []
    for (const result of [firstPage, ...remainingPages]) {
      if (!result.success) return result
      if (!result.data) {
        return invalidResponse(
          "Format daftar transaksi dari server tidak valid.",
        )
      }
      pages.push(result.data)
    }

    const listItems = pages.flatMap((page) => page.items ?? [])
    const rows = listItems.map((item) => fromListItem(direction, item))
    if (rows.some((item) => item === null)) {
      return invalidResponse(
        "Data transaksi server tidak memiliki ID atau tipe yang valid.",
      )
    }
    const validRows = rows.filter((item): item is Transaction => item !== null)

    const details: Transaction[] = []
    for (let index = 0; index < validRows.length; index += 10) {
      const batch = validRows.slice(index, index + 10)
      const results = await Promise.all(
        batch.map((item) => getDetail(direction, item.id)),
      )
      const failed = results.find((result) => !result.success)
      if (failed && !failed.success) return failed
      details.push(
        ...results.flatMap((result) => (result.success ? [result.data] : [])),
      )
    }

    return {
      success: true,
      data: details,
      status: firstPage.status,
    }
  },

  getById: getDetail,

  create: async (transaction: Transaction): Promise<ApiResult<Transaction>> => {
    const input = toCreateRequest(transaction)
    if (!input.success) return input

    const result = await httpRequest<GoodDetailDto>(
      routeFor(transaction.direction),
      { method: "POST", body: JSON.stringify(input.data) },
      requestOptions,
    )
    if (!result.success) return result
    const created = fromDetail(transaction.direction, result.data)
    return created
      ? { success: true, data: created, status: result.status }
      : invalidResponse("Respons transaksi yang dibuat tidak valid.")
  },

  updateStatus: async (
    transaction: Transaction,
    status: TransactionStatus,
    notes?: string,
  ): Promise<ApiResult<Transaction>> => {
    const numericId = Number(transaction.id)
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      return {
        success: false,
        error: "ID transaksi dari server tidak valid.",
        code: "INVALID_TRANSACTION_ID",
      }
    }

    const result = await httpRequest<GoodDetailDto>(
      `${routeFor(transaction.direction)}/${numericId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: toApiStatus(status), notes }),
      },
      requestOptions,
    )
    if (!result.success) return result
    const updated = fromDetail(transaction.direction, result.data)
    return updated
      ? { success: true, data: updated, status: result.status }
      : invalidResponse("Respons perubahan status transaksi tidak valid.")
  },

  uploadAttachment: async (
    transaction: Transaction,
    file: File,
  ): Promise<ApiResult<unknown>> => {
    const numericId = Number(transaction.id)
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      return {
        success: false,
        error: "ID transaksi dari server tidak valid.",
        code: "INVALID_TRANSACTION_ID",
      }
    }

    const body = new FormData()
    body.append("file", file)
    return httpRequest<unknown>(
      `${routeFor(transaction.direction)}/${numericId}/attachments`,
      { method: "POST", body },
      requestOptions,
    )
  },
}
