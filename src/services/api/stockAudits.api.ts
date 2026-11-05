import { apiRoutes } from "@/config/api-routes"
import type { Asset, Audit, AuditItem, MasterItem } from "@/data/demoData"
import { httpRequest } from "@/lib/http/httpClient"
import type { ApiResult } from "@/lib/api/types"

type StockAuditListDto = {
  stockOpnameId: number
  stockOpnameNumber?: string | null
  stockOpnameName?: string | null
  auditDate: string
  stockOpnameStatus?: string | null
  businessUnit?: string | null
  busUnitId?: number | null
  locationId?: number | null
  locationName?: string | null
  auditorName?: string | null
  itemCount: number
  verifiedCount?: number
  discrepancyCount: number
}

type StockAuditItemDto = {
  stockOpnameDetailId: number
  assetId: number
  assetCode?: string | null
  assetName?: string | null
  assetPrefix?: string | null
  systemQuantity: number
  systemLocationId?: number | null
  systemLocationName?: string | null
  physicalQuantity: number | null
  variance?: number
  actualLocationId?: number | null
  finding?: string | null
  isConfirmed: boolean
  confirmedBy?: string | null
  confirmedAt?: string | null
  notes?: string | null
  evidencePaths?: string[] | null
  evidencePath?: string | null
}

type StockAuditDetailDto = Omit<StockAuditListDto, "itemCount" | "discrepancyCount"> & {
  itemCount?: number
  discrepancyCount?: number
  stockOpnameType?: string | null
  auditorUserId?: number | null
  auditorName?: string | null
  completedAt?: string | null
  inventoryAdjusted?: boolean
  items?: StockAuditItemDto[] | null
}

type StockAuditPageDto = {
  items?: StockAuditListDto[] | null
  page?: number
  totalPages?: number
}

type StockAuditCreateRequest = {
  stockOpnameName: string
  auditDate: string
  businessUnit: string
  busUnitId: number
  locationId: number | null
  stockOpnameStatus: string
  items: StockAuditItemRequest[]
}

type StockAuditItemRequest = {
  stockOpnameDetailId?: number
  assetId: number
  physicalQuantity: number | null
  actualLocationId: number | null
  finding: string
  isConfirmed: boolean
  notes: string
}

const requestOptions = { baseUrl: "same-origin" as const }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value)

const isStockAuditListDto = (value: unknown): value is StockAuditListDto =>
  isRecord(value) &&
  isInteger(value.stockOpnameId) &&
  typeof value.auditDate === "string" &&
  isInteger(value.itemCount) &&
  isInteger(value.discrepancyCount)

const isStockAuditItemDto = (value: unknown): value is StockAuditItemDto =>
  isRecord(value) &&
  isInteger(value.stockOpnameDetailId) &&
  isInteger(value.assetId) &&
  isInteger(value.systemQuantity) &&
  (value.physicalQuantity === null || isInteger(value.physicalQuantity)) &&
  typeof value.isConfirmed === "boolean"

const isStockAuditDetailDto = (value: unknown): value is StockAuditDetailDto =>
  isRecord(value) &&
  isInteger(value.stockOpnameId) &&
  typeof value.auditDate === "string" &&
  (value.items === undefined ||
    value.items === null ||
    (Array.isArray(value.items) && value.items.every(isStockAuditItemDto)))

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

const positiveId = (value: string | undefined) => {
  if (!value) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const rowsFrom = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return null
  for (const key of ["items", "data", "results"]) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate
    const nested = rowsFrom(candidate)
    if (nested) return nested
  }
  return null
}

const locationName = (
  id: string | undefined,
  locations: MasterItem[],
  fallback = "",
) =>
  locations.find((location) => location.id === id)?.name ??
  (id ? locations.find((location) => location.location_id === id)?.name : "") ??
  fallback
const evidenceUrl = (path: string) => {
  const apiPath = "/api/stock-audits"
  if (path.startsWith(apiPath)) {
    return `${apiRoutes.inventory.stockAudits}${path.slice(apiPath.length)}`
  }
  return path
}

function toAuditItem(
  dto: StockAuditItemDto,
  assets: Asset[],
  locations: MasterItem[],
): AuditItem {
  const assetId = String(dto.assetId)
  const asset = assets.find(
    (candidate) => (candidate.assetId ?? candidate.id) === assetId,
  )
  const actualLocationId =
    dto.actualLocationId == null
      ? dto.systemLocationId == null
        ? asset?.locationId
        : String(dto.systemLocationId)
      : String(dto.actualLocationId)
  const physicalQty =
    dto.physicalQuantity == null ? null : numberValue(dto.physicalQuantity, 0)
  const finding =
    dto.finding ??
    (physicalQty === null
      ? "Unverified"
      : physicalQty === (asset?.quantity ?? dto.systemQuantity)
        ? "Match"
        : "Fisik ada data berbeda")
  const evidence =
    dto.evidencePaths?.filter(Boolean).map(evidenceUrl) ??
    (dto.evidencePath ? [evidenceUrl(dto.evidencePath)] : [])

  return {
    assetId,
    assetCode: dto.assetCode ?? asset?.assetCode,
    apiItemId: String(dto.stockOpnameDetailId),
    systemQty: numberValue(dto.systemQuantity, asset?.quantity ?? 0),
    systemLocation: dto.systemLocationName ?? asset?.location ?? "",
    systemLocationId:
      dto.systemLocationId == null
        ? asset?.locationId
        : String(dto.systemLocationId),
    physicalQty,
    actualLocation: locationName(
      actualLocationId,
      locations,
      dto.systemLocationName ?? asset?.location,
    ),
    actualLocationId,
    finding,
    confirmed: dto.isConfirmed,
    confirmedBy: dto.confirmedBy ?? undefined,
    confirmedAt: dto.confirmedAt ?? undefined,
    notes: dto.notes ?? "",
    evidence,
  }
}

function toAudit(
  dto: StockAuditListDto | StockAuditDetailDto,
  assets: Asset[],
  locations: MasterItem[],
  detailed = false,
): Audit {
  const id = String(dto.stockOpnameId)
  const locationId = dto.locationId == null ? undefined : String(dto.locationId)
  const items =
    detailed && "items" in dto
      ? (dto.items ?? []).map((item) => toAuditItem(item, assets, locations))
      : []
  return {
    id,
    name: dto.stockOpnameName || dto.stockOpnameNumber || `Audit ${id}`,
    date: dto.auditDate.slice(0, 10),
    auditor:
      dto.auditorName ??
      ("auditorUserId" in dto && dto.auditorUserId != null
        ? `User ${dto.auditorUserId}`
        : ""),
    businessUnit: dto.businessUnit ?? "",
    businessUnitId: dto.busUnitId == null ? undefined : String(dto.busUnitId),
    locationId,
    location: locationName(
      locationId,
      locations,
      dto.locationName ?? "All Locations",
    ),
    status: dto.stockOpnameStatus ?? "In Progress",
    items,
    itemCount: dto.itemCount,
    verifiedCount: dto.verifiedCount,
    discrepancyCount: dto.discrepancyCount,
    detailsLoaded: detailed,
    completedAt:
      "completedAt" in dto ? (dto.completedAt ?? undefined) : undefined,
    inventoryAdjusted:
      "inventoryAdjusted" in dto ? dto.inventoryAdjusted : undefined,
  }
}

function toItemRequest(item: AuditItem): ApiResult<StockAuditItemRequest> {
  const assetId = positiveId(item.assetId)
  const actualLocationId = item.actualLocationId
    ? positiveId(item.actualLocationId)
    : null
  if (!assetId || (item.actualLocationId && !actualLocationId)) {
    return {
      success: false,
      error: "Asset dan Location harus memiliki ID numerik dari backend.",
      code: "INVALID_AUDIT_REFERENCE",
    }
  }
  const apiItemId = positiveId(item.apiItemId)
  return {
    success: true,
    status: 200,
    data: {
      ...(apiItemId ? { stockOpnameDetailId: apiItemId } : {}),
      assetId,
      physicalQuantity: item.physicalQty,
      actualLocationId,
      finding: item.finding,
      isConfirmed: item.confirmed,
      notes: item.notes,
    },
  }
}

async function getAllPages(query: {
  search?: string
  busUnitId?: string
}): Promise<ApiResult<StockAuditListDto[]>> {
  const items: StockAuditListDto[] = []
  let page = 1
  let totalPages = 1
  do {
    const params = new URLSearchParams({
      Page: String(page),
      PageSize: "100",
      SortBy: "auditDate",
      SortDir: "desc",
    })
    if (query.search) params.set("Search", query.search)
    if (query.busUnitId) params.set("BusUnitId", query.busUnitId)
    const result = await httpRequest<StockAuditPageDto>(
      `${apiRoutes.inventory.stockAudits}?${params}`,
      { method: "GET" },
      requestOptions,
    )
    if (!result.success) return result
    const rows = rowsFrom(result.data)
    if (!rows || !rows.every(isStockAuditListDto)) {
      return {
        success: false,
        error: "Format daftar Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_LIST",
        status: result.status,
      }
    }
    items.push(...rows)
    totalPages = Math.max(1, numberValue(result.data.totalPages, 1))
    page += 1
  } while (page <= totalPages)

  return { success: true, status: 200, data: items }
}

export const stockAuditsApi = {
  list: async (
    query: {
      search?: string
      busUnitId?: string
    },
    assets: Asset[],
    locations: MasterItem[],
  ): Promise<ApiResult<Audit[]>> => {
    const result = await getAllPages(query)
    if (!result.success) return result
    return {
      success: true,
      status: result.status,
      data: result.data.map((audit) => toAudit(audit, assets, locations)),
    }
  },
  getById: async (
    id: string,
    assets: Asset[],
    locations: MasterItem[],
  ): Promise<ApiResult<Audit>> => {
    const auditId = positiveId(id)
    if (!auditId) {
      return {
        success: false,
        error: "Stock Opname ID harus berupa bilangan bulat positif.",
        code: "INVALID_AUDIT_ID",
      }
    }
    const result = await httpRequest<StockAuditDetailDto>(
      `${apiRoutes.inventory.stockAudits}/${auditId}`,
      { method: "GET" },
      requestOptions,
    )
    if (!result.success) return result
    if (!isStockAuditDetailDto(result.data)) {
      return {
        success: false,
        error: "Format detail Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_DETAIL",
        status: result.status,
      }
    }
    return {
      success: true,
      status: result.status,
      data: toAudit(result.data, assets, locations, true),
    }
  },
  create: async (
    audit: Audit,
    assets: Asset[],
    locations: MasterItem[],
  ): Promise<ApiResult<Audit>> => {
    const busUnitId = positiveId(audit.businessUnitId)
    const locationId = audit.locationId ? positiveId(audit.locationId) : null
    const items = audit.items.map(toItemRequest)
    const invalidItem = items.find((item) => !item.success)
    if (!busUnitId || (audit.locationId && !locationId)) {
      return {
        success: false,
        error: "Business Unit dan Location harus dipilih dari Master Data.",
        code: "INVALID_AUDIT_SCOPE",
      }
    }
    if (invalidItem && !invalidItem.success) return invalidItem
    const request: StockAuditCreateRequest = {
      stockOpnameName: audit.name,
      auditDate: new Date(`${audit.date}T00:00:00.000Z`).toISOString(),
      businessUnit: audit.businessUnit,
      busUnitId,
      locationId,
      stockOpnameStatus: "In Progress",
      items: items
        .map((item) => (item.success ? item.data : null))
        .filter((item): item is StockAuditItemRequest => item !== null),
    }
    const result = await httpRequest<StockAuditDetailDto>(
      apiRoutes.inventory.stockAudits,
      { method: "POST", body: JSON.stringify(request) },
      requestOptions,
    )
    if (!result.success) return result
    if (!isStockAuditDetailDto(result.data)) {
      return {
        success: false,
        error: "Respons pembuatan Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_RESPONSE",
        status: result.status,
      }
    }
    return {
      success: true,
      status: result.status,
      data: toAudit(result.data, assets, locations, true),
    }
  },
  updateItems: async (
    audit: Audit,
    assets: Asset[],
    locations: MasterItem[],
  ): Promise<ApiResult<Audit>> => {
    const auditId = positiveId(audit.id)
    if (!auditId) {
      return {
        success: false,
        error: "Stock Opname ID harus berupa bilangan bulat positif.",
        code: "INVALID_AUDIT_ID",
      }
    }
    const items = audit.items.map(toItemRequest)
    const invalidItem = items.find((item) => !item.success)
    if (invalidItem && !invalidItem.success) return invalidItem
    const result = await httpRequest<StockAuditDetailDto>(
      `${apiRoutes.inventory.stockAudits}/${auditId}/items`,
      {
        method: "PUT",
        body: JSON.stringify({
          items: items
            .map((item) => (item.success ? item.data : null))
            .filter((item): item is StockAuditItemRequest => item !== null),
        }),
      },
      requestOptions,
    )
    if (!result.success) return result
    if (!isStockAuditDetailDto(result.data)) {
      return {
        success: false,
        error: "Respons pembaruan item Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_RESPONSE",
        status: result.status,
      }
    }
    return {
      success: true,
      status: result.status,
      data: toAudit(result.data, assets, locations, true),
    }
  },
  uploadEvidence: async (
    auditId: string,
    itemId: string,
    file: File,
  ): Promise<ApiResult<StockAuditItemDto>> => {
    const numericAuditId = positiveId(auditId)
    const numericItemId = positiveId(itemId)
    if (!numericAuditId || !numericItemId) {
      return {
        success: false as const,
        error: "Stock Opname atau item belum memiliki ID numerik dari server.",
        code: "INVALID_AUDIT_EVIDENCE_ID",
      }
    }
    const formData = new FormData()
    formData.set("file", file)
    const result = await httpRequest<StockAuditItemDto>(
      `${apiRoutes.inventory.stockAudits}/${numericAuditId}/items/${numericItemId}/evidence`,
      { method: "POST", body: formData },
      requestOptions,
    )
    if (!result.success) return result
    if (!isStockAuditItemDto(result.data)) {
      return {
        success: false,
        error: "Respons unggah bukti Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_EVIDENCE_RESPONSE",
        status: result.status,
      }
    }
    return {
      ...result,
      data: {
        ...result.data,
        evidencePath: result.data.evidencePath
          ? evidenceUrl(result.data.evidencePath)
          : null,
        evidencePaths: result.data.evidencePaths?.map(evidenceUrl),
      },
    }
  },
  deleteEvidence: async (evidencePath: string): Promise<ApiResult<void>> => {
    let path: string
    try {
      path = new URL(evidencePath, window.location.origin).pathname
    } catch {
      return {
        success: false,
        error: "Evidence path from the server is invalid.",
        code: "INVALID_AUDIT_EVIDENCE_PATH",
      }
    }
    const proxyPrefix = "/app-api/backend"
    const backendPath = path.startsWith(proxyPrefix)
      ? path.slice(proxyPrefix.length)
      : ""
    if (
      !/^\/api\/stock-audits\/[1-9]\d*\/items\/[1-9]\d*\/evidence\/[1-9]\d*$/.test(
        backendPath,
      )
    ) {
      return {
        success: false,
        error: "Evidence path is not a supported Stock Opname resource.",
        code: "INVALID_AUDIT_EVIDENCE_PATH",
      }
    }
    const result = await httpRequest<unknown>(
      path,
      { method: "DELETE" },
      requestOptions,
    )
    if (!result.success) return result
    return { success: true, status: result.status, data: undefined }
  },
  complete: async (
    auditId: string,
    updateLocation: boolean,
    assets: Asset[],
    locations: MasterItem[],
  ): Promise<ApiResult<Audit>> => {
    const numericAuditId = positiveId(auditId)
    if (!numericAuditId) {
      return {
        success: false,
        error: "Stock Opname ID harus berupa bilangan bulat positif.",
        code: "INVALID_AUDIT_ID",
      }
    }
    const result = await httpRequest<StockAuditDetailDto>(
      `${apiRoutes.inventory.stockAudits}/${numericAuditId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ updateLocation }),
      },
      requestOptions,
    )
    if (!result.success) return result
    if (!isStockAuditDetailDto(result.data)) {
      return {
        success: false,
        error: "Respons finalisasi Stock Opname dari server tidak valid.",
        code: "INVALID_AUDIT_RESPONSE",
        status: result.status,
      }
    }
    return {
      success: true,
      status: result.status,
      data: toAudit(result.data, assets, locations, true),
    }
  },
}
