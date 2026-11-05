import type { ApiResult } from "@/lib/api/types"
import {
  assetGroupsApi,
  assetModelsApi,
  assetStatusesApi,
  assetTypesApi,
  brandsApi,
  businessUnitsApi,
  categoriesApi,
  conditionsApi,
  locationsApi,
  type AssetGroupDto,
  type AssetModelDto,
  type AssetStatusDto,
  type AssetTypeDto,
  type BrandDto,
  type BusinessUnitDto,
  type CategoryDto,
  type ConditionDto,
  type LocationDto,
  type MasterDataApi,
  type MasterDataPage,
} from "@/services/api/masterData.api"

export type MasterDataSnapshot = {
  brands: BrandDto[]
  categories: CategoryDto[]
  types: AssetTypeDto[]
  models: AssetModelDto[]
  groups: AssetGroupDto[]
  businessUnits: BusinessUnitDto[]
  locations: LocationDto[]
  conditions: ConditionDto[]
  assetStatuses: AssetStatusDto[]
}

const cacheDurationMs = 120_000
const pageSize = 100

let cachedValue: MasterDataSnapshot | undefined
let cachedAt = 0
let inFlight: Promise<ApiResult<MasterDataSnapshot>> | undefined
let cacheRevision = 0
let cacheScope: string | undefined

async function getAllPages<T>(
  api: Pick<MasterDataApi<T, never>, "getAll">,
): Promise<ApiResult<T[]>> {
  const firstPage = await api.getAll({ page: 1, pageSize })
  if (!firstPage.success) return firstPage

  const pageCount = Math.max(1, firstPage.data.totalPages)
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      api.getAll({ page: index + 2, pageSize }),
    ),
  )
  const failedPage = remainingPages.find((result) => !result.success)
  if (failedPage && !failedPage.success) return failedPage

  return {
    success: true,
    data: [
      ...(firstPage.data.items ?? []),
      ...remainingPages.flatMap((result) =>
        result.success ? (result.data.items ?? []) : [],
      ),
    ],
  }
}

async function fetchSnapshot(): Promise<ApiResult<MasterDataSnapshot>> {
  const [
    brands,
    categories,
    types,
    models,
    groups,
    businessUnits,
    locations,
    conditions,
    assetStatuses,
  ] = await Promise.all([
    getAllPages(brandsApi),
    getAllPages(categoriesApi),
    getAllPages(assetTypesApi),
    getAllPages(assetModelsApi),
    getAllPages(assetGroupsApi),
    getAllPages(businessUnitsApi),
    getAllPages(locationsApi),
    getAllPages(conditionsApi),
    getAllPages(assetStatusesApi),
  ])
  const results = [
    brands,
    categories,
    types,
    models,
    groups,
    businessUnits,
    locations,
    conditions,
    assetStatuses,
  ]
  const failedResult = results.find((result) => !result.success)
  if (failedResult && !failedResult.success) return failedResult

  if (
    !brands.success ||
    !categories.success ||
    !types.success ||
    !models.success ||
    !groups.success ||
    !businessUnits.success ||
    !locations.success ||
    !conditions.success ||
    !assetStatuses.success
  ) {
    return {
      success: false,
      error: "Gagal memuat seluruh master data.",
      code: "MASTER_DATA_LOAD_FAILED",
    }
  }

  return {
    success: true,
    data: {
      brands: brands.data,
      categories: categories.data,
      types: types.data,
      models: models.data,
      groups: groups.data,
      businessUnits: businessUnits.data,
      locations: locations.data,
      conditions: conditions.data,
      assetStatuses: assetStatuses.data,
    },
  }
}

export function invalidateMasterDataCache() {
  cacheRevision += 1
  cachedValue = undefined
  cachedAt = 0
  inFlight = undefined
}

export function getCachedMasterData(
  scope: string,
): Promise<ApiResult<MasterDataSnapshot>> {
  if (scope !== cacheScope) {
    invalidateMasterDataCache()
    cacheScope = scope
  }
  if (cachedValue && Date.now() - cachedAt < cacheDurationMs) {
    return Promise.resolve({ success: true, data: cachedValue })
  }
  if (inFlight) return inFlight

  const requestRevision = cacheRevision
  const request = fetchSnapshot().then((result) => {
    if (result.success && requestRevision === cacheRevision) {
      cachedValue = result.data
      cachedAt = Date.now()
    }
    return result
  })
  inFlight = request
  const clearInFlight = () => {
    if (inFlight === request) inFlight = undefined
  }
  void request.then(clearInFlight, clearInFlight)
  return request
}

export function refreshMasterDataSnapshot(
  scope: string,
): Promise<ApiResult<MasterDataSnapshot>> {
  invalidateMasterDataCache()
  return getCachedMasterData(scope)
}
