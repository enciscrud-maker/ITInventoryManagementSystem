import { apiRoutes } from "@/config/api-routes"
import type { Asset } from "@/data/demoData"
import { httpRequest } from "@/lib/http/httpClient"
import type { ApiResult } from "@/lib/api/types"

type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const keyName = (value: string) => value.toLowerCase().replace(/[_-]/g, "")

const read = (record: RecordValue, ...keys: string[]): unknown => {
  const wanted = new Set(keys.map(keyName))
  const entry = Object.entries(record).find(([key]) => wanted.has(keyName(key)))
  return entry?.[1]
}

const text = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  return ""
}

const numeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined
  const parsed = typeof value === "number" ? value : Number(text(value))
  return Number.isFinite(parsed) ? parsed : undefined
}

const relatedText = (value: unknown, ...keys: string[]): string => {
  if (!isRecord(value)) return text(value)
  return text(read(value, ...keys, "name", "label", "title"))
}

const relatedValue = (
  record: RecordValue,
  foreignKeys: string[],
  relationKeys: string[],
  nameKeys: string[],
  nestedIdKeys: string[],
  nestedNameKeys: string[],
) => {
  const relation = read(record, ...relationKeys)
  const relationRecord = isRecord(relation) ? relation : {}
  const id =
    text(read(record, ...foreignKeys)) ||
    text(read(relationRecord, ...nestedIdKeys, "id"))
  const name =
    text(read(record, ...nameKeys)) || relatedText(relation, ...nestedNameKeys)

  return { id: id || undefined, name }
}

const rowsFrom = (value: unknown, depth = 0): unknown[] | null => {
  if (Array.isArray(value)) return value
  if (!isRecord(value) || depth > 3) return null

  for (const key of ["items", "assets", "records", "results", "data"]) {
    const nested = read(value, key)
    if (Array.isArray(nested)) return nested
    const rows = rowsFrom(nested, depth + 1)
    if (rows) return rows
  }
  return null
}

const pagesFrom = (value: unknown, depth = 0): number => {
  if (!isRecord(value) || depth > 3) return 1
  const totalPages = numeric(read(value, "totalPages", "pageCount"))
  if (totalPages !== undefined) return Math.max(1, Math.floor(totalPages))
  return pagesFrom(read(value, "data"), depth + 1)
}

export type AssetRequest = {
  catId?: number
  groupId?: number
  typeId?: number
  brandId?: number
  assetName?: string | null
  assetType?: "In" | "Out"
  statusId: number
  assetPrefix?: string | null
  quantity?: number | null
  unitOfMeasure?: string | null
  serialNumber?: string | null
  assetTag?: string | null
  purchaseOrderNumber?: string | null
  sapMaterialNumber?: string | null
  assetValue?: number | null
  description?: string | null
  busUnitId?: number | null
  locationId?: number | null
  conditionId?: number | null
  businessUnit?: string | null
  rowVersion?: string | null
}

export type AssetImportError = {
  rowNumber: number
  messages: string[] | null
}

export type AssetImportResult = {
  totalRows: number
  successCount: number
  failedCount: number
  errors: AssetImportError[] | null
}

const numericId = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

const requestPage = (page: number) =>
  httpRequest<unknown>(
    `${apiRoutes.inventory.assets}?Page=${page}&PageSize=100`,
    { method: "GET" },
    { baseUrl: "same-origin" },
  )

const toAsset = (value: unknown): Asset | null => {
  if (!isRecord(value)) return null

  const assetId = numeric(read(value, "assetId", "id"))
  if (!assetId || assetId <= 0) return null

  const category = relatedValue(
    value,
    ["categoryId", "assetCategoryId", "catId"],
    ["category", "assetCategory"],
    ["categoryName", "assetCategoryName", "catName"],
    ["categoryId", "assetCategoryId", "catId"],
    ["categoryName", "assetCategoryName", "catName"],
  )
  const group = relatedValue(
    value,
    ["groupId", "assetGroupId"],
    ["group", "assetGroup"],
    ["groupName", "assetGroupName"],
    ["groupId", "assetGroupId"],
    ["groupName", "name"],
  )
  const type = relatedValue(
    value,
    ["typeId", "assetTypeId"],
    ["type", "assetType"],
    ["typeName", "assetTypeName"],
    ["typeId", "assetTypeId"],
    ["typeName", "name"],
  )
  const brand = relatedValue(
    value,
    ["brandId", "assetBrandId"],
    ["brand", "assetBrand"],
    ["brandName", "assetBrandName"],
    ["brandId"],
    ["brandName", "assetBrandName", "name"],
  )
  const model = relatedValue(
    value,
    ["modelId", "assetModelId"],
    ["model", "assetModel"],
    ["modelName", "assetModelName", "assetName"],
    ["modelId", "assetModelId"],
    ["modelName", "assetModelName", "name"],
  )
  const location = relatedValue(
    value,
    ["locationId", "assetLocationId"],
    ["location", "assetLocation"],
    ["locationName", "assetLocationName"],
    ["locationId", "assetLocationId"],
    ["locationName", "name"],
  )
  const businessUnit = relatedValue(
    value,
    ["businessUnitId", "assetBusinessUnitId", "business_unit_id"],
    ["businessUnit", "assetBusinessUnit", "business_unit"],
    ["businessUnitName", "assetBusinessUnitName", "business_unit_name"],
    ["businessUnitId", "assetBusinessUnitId", "business_unit_id"],
    ["businessUnitName", "assetBusinessUnitName", "name"],
  )
  const condition = relatedValue(
    value,
    ["conditionId", "assetConditionId"],
    ["condition", "assetCondition"],
    ["conditionName", "assetConditionName"],
    ["conditionId", "assetConditionId"],
    ["conditionName", "assetConditionName", "name"],
  )
  const quantityValue = read(value, "quantity", "qty", "stockQuantity")
  const assetValue = numeric(
    read(value, "value", "initialValue", "purchaseValue"),
  )

  return {
    id: String(assetId),
    assetId: String(assetId),
    assetCode:
      text(read(value, "assetCode", "assetNumber", "assetNo")) || undefined,
    assetPrefix: text(read(value, "assetPrefix")) || undefined,
    rowVersion: text(read(value, "rowVersion")) || undefined,
    conditionId: text(read(value, "conditionId")) || undefined,
    statusId: text(read(value, "statusId")) || undefined,
    assetStatus: text(read(value, "assetStatus", "statusName")) || undefined,
    serial: text(read(value, "serial", "serialNumber", "serialNo")),
    tag:
      text(read(value, "tag", "assetTag", "tagNumber", "tagNo")) || undefined,
    categoryId: category.id,
    groupId: group.id,
    typeId: type.id,
    brandId: brand.id,
    modelId: model.id,
    category: category.name,
    group: group.name,
    type: type.name,
    brand: brand.name,
    model: model.name,
    locationId: location.id,
    location: location.name,
    businessUnitId: businessUnit.id,
    businessUnit: businessUnit.name,
    condition: condition.name,
    quantity: numeric(quantityValue) ?? 0,
    uom: text(read(value, "uom", "unitOfMeasure", "unit")) || "UNIT",
    updatedAt: text(
      read(value, "updatedAt", "lastUpdated", "modifiedAt", "lastUpdatedDate"),
    ),
    po: text(read(value, "po", "poNumber", "purchaseOrder")) || undefined,
    sap: text(read(value, "sap", "sapMaterialId", "materialId")) || undefined,
    value: assetValue,
    description: text(read(value, "description")) || undefined,
    demo: false,
  }
}

function toAssetRequest(asset: Asset): ApiResult<AssetRequest> {
  const catId = numericId(asset.categoryId)
  const groupId = numericId(asset.groupId)
  const typeId = numericId(asset.typeId)
  const brandId = numericId(asset.brandId)
  const busUnitId = numericId(asset.businessUnitId)
  const locationId = numericId(asset.locationId)
  if (!catId || !groupId || !typeId || !brandId || !busUnitId || !locationId) {
    return {
      success: false,
      error:
        "Backend membutuhkan ID numerik untuk klasifikasi, Business Unit, dan Location.",
      code: "INVALID_ASSET_REFERENCE",
    }
  }

  const statusId = numericId(asset.statusId)
  const conditionId = numericId(asset.conditionId)
  if (!statusId) {
    return {
      success: false,
      error: "Pilih Asset Status yang valid dari Master Data.",
      code: "INVALID_ASSET_STATUS",
    }
  }
  return {
    success: true,
    status: 200,
    data: {
      catId,
      groupId,
      typeId,
      brandId,
      assetName: asset.model,
      statusId,
      assetPrefix: asset.assetPrefix ?? null,
      quantity: asset.quantity,
      unitOfMeasure: asset.uom,
      serialNumber: asset.serial,
      assetTag: asset.tag ?? null,
      purchaseOrderNumber: asset.po ?? null,
      sapMaterialNumber: asset.sap ?? null,
      assetValue: asset.value ?? null,
      description: asset.description ?? null,
      busUnitId,
      locationId,
      ...(conditionId ? { conditionId } : {}),
      businessUnit: asset.businessUnit,
      rowVersion: asset.rowVersion ?? null,
    },
  }
}

export const assetsApi = {
  list: async (): Promise<ApiResult<Asset[]>> => {
    const firstPage = await requestPage(1)
    if (!firstPage.success) return firstPage

    const firstRows = rowsFrom(firstPage.data)
    if (!firstRows) {
      return {
        success: false,
        error: "Format data assets dari server tidak valid.",
        code: "INVALID_ASSETS_RESPONSE",
        status: firstPage.status,
      }
    }

    const remainingPages = await Promise.all(
      Array.from({ length: pagesFrom(firstPage.data) - 1 }, (_, index) =>
        requestPage(index + 2),
      ),
    )
    const failedPage = remainingPages.find((result) => !result.success)
    if (failedPage && !failedPage.success) return failedPage

    const pageRows = remainingPages.map((result) =>
      result.success ? rowsFrom(result.data) : null,
    )
    if (pageRows.some((rows) => rows === null)) {
      return {
        success: false,
        error: "Format data assets dari server tidak valid.",
        code: "INVALID_ASSETS_RESPONSE",
        status: firstPage.status,
      }
    }

    const rows = [...firstRows, ...pageRows.flatMap((page) => page ?? [])]
    const assets = rows.map(toAsset)
    if (assets.some((asset) => asset === null)) {
      return {
        success: false,
        error:
          "Data assets dari server tidak memiliki assetId numerik yang valid.",
        code: "INVALID_ASSET_RECORD",
        status: firstPage.status,
      }
    }

    return {
      success: true,
      data: assets.filter((asset): asset is Asset => asset !== null),
      status: firstPage.status,
    }
  },
  create: async (asset: Asset): Promise<ApiResult<Asset>> => {
    const request = toAssetRequest(asset)
    if (!request.success) return request
    const result = await httpRequest<unknown>(
      apiRoutes.inventory.assets,
      { method: "POST", body: JSON.stringify(request.data) },
      { baseUrl: "same-origin" },
    )
    if (!result.success) return result
    const created = toAsset(result.data)
    return created
      ? { success: true, data: created, status: result.status }
      : {
          success: false,
          error: "Respons create asset tidak memiliki assetId numerik.",
          code: "INVALID_ASSET_RESPONSE",
          status: result.status,
        }
  },
  update: async (asset: Asset): Promise<ApiResult<Asset>> => {
    const id = numericId(asset.assetId ?? asset.id)
    if (!id) {
      return {
        success: false,
        error: "Asset ID dari server tidak valid.",
        code: "INVALID_ASSET_ID",
      }
    }
    const request = toAssetRequest(asset)
    if (!request.success) return request
    const result = await httpRequest<unknown>(
      `${apiRoutes.inventory.assets}/${id}`,
      { method: "PUT", body: JSON.stringify(request.data) },
      { baseUrl: "same-origin" },
    )
    if (!result.success) return result
    const updated = toAsset(result.data)
    return updated
      ? { success: true, data: updated, status: result.status }
      : {
          success: false,
          error: "Respons update asset tidak memiliki assetId numerik.",
          code: "INVALID_ASSET_RESPONSE",
          status: result.status,
        }
  },
  importFile: (file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    return httpRequest<AssetImportResult>(
      `${apiRoutes.inventory.assets}/import`,
      { method: "POST", body: formData },
      { baseUrl: "same-origin" },
    )
  },
}
