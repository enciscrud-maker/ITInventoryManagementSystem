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

const requestPage = (page: number) =>
  httpRequest<unknown>(
    `${apiRoutes.inventory.assets}?Page=${page}&PageSize=100`,
    { method: "GET" },
    { baseUrl: "same-origin" },
  )

const toAsset = (value: unknown): Asset | null => {
  if (!isRecord(value)) return null

  const id = text(
    read(value, "assetCode", "assetNumber", "assetNo", "assetId", "id", "code"),
  )
  if (!id) return null

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
    ["condition", "assetCondition", "status", "assetStatus"],
    ["conditionName", "assetConditionName", "statusName", "assetStatusName"],
    ["conditionId", "assetConditionId"],
    [
      "conditionName",
      "assetConditionName",
      "name",
      "statusName",
      "assetStatusName",
    ],
  )
  const quantityValue = read(value, "quantity", "qty", "stockQuantity")
  const assetValue = numeric(
    read(value, "value", "initialValue", "purchaseValue"),
  )

  return {
    id,
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
        error: "Data assets dari server tidak memiliki Asset ID yang valid.",
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
}
