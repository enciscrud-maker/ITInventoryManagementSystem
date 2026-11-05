import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import type { ApiFailure, ApiResult } from "@/lib/api/types"

export type MasterDataPage<T,> = {
  items: T[] | null
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

export type MasterDataQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: string
  safePage?: number
  safeSize?: number
  desc?: boolean
}

export type BrandDto = {
  brandId: number
  typeId: number | null
  brandName: string | null
  brandCode: string | null
  brandPrefix: string | null
  isActive: boolean
}

export type BrandRequest = {
  typeId?: number | null
  brandName?: string | null
  brandCode?: string | null
  brandPrefix?: string | null
  isActive?: boolean
}

export type CategoryDto = {
  catId: number
  catName: string | null
  catCode: string | null
  catPrefix: string | null
  isActive: boolean
}

export type CategoryRequest = {
  catName?: string | null
  catCode?: string | null
  catPrefix?: string | null
  isActive?: boolean
}

export type AssetTypeDto = {
  typeId: number
  groupId: number
  catId: number
  typeName: string | null
  typeCode: string | null
  typePrefix: string | null
  isActive: boolean
}

export type AssetTypeRequest = {
  groupId?: number
  catId?: number
  typeName?: string | null
  typeCode?: string | null
  typePrefix?: string | null
  isActive?: boolean
}

export type AssetModelDto = {
  modelId: number
  assetId: number | null
  catId: number
  brandId: number
  groupId: number
  typeId: number
  modelName: string | null
  modelCode: string | null
  isActive: boolean
}

export type AssetModelRequest = {
  assetId?: number | null
  catId?: number
  brandId?: number
  groupId?: number
  typeId?: number
  modelName?: string | null
  modelCode?: string | null
  isActive?: boolean
}

export type AssetGroupDto = {
  groupId: number
  catId: number
  groupName: string | null
  groupCode: string | null
  groupPrefix: string | null
  isActive: boolean
}

export type AssetGroupRequest = {
  catId?: number
  groupName?: string | null
  groupCode?: string | null
  groupPrefix?: string | null
  isActive?: boolean
}

export type BusinessUnitDto = {
  busUnitId: number
  busUnitCode: string | null
  busUnitPrefix: string | null
  isActive: boolean
}

export type BusinessUnitRequest = {
  busUnitCode?: string | null
  busUnitPrefix?: string | null
  isActive?: boolean
}

export type LocationDto = {
  locationId: number
  busUnitId: number
  locationName: string | null
}

export type LocationRequest = {
  busUnitId?: number
  locationName?: string | null
}

export type ConditionDto = {
  conditionId: number
  conditionCode: string | null
  conditionName: string | null
  isActive: boolean
}

export type ConditionRequest = {
  conditionCode?: string | null
  conditionName?: string | null
  isActive?: boolean
}

export type AssetStatusDto = {
  statusId: number
  statusCode: string | null
  statusName: string | null
  isActive: boolean
}

export type AssetStatusRequest = {
  statusCode?: string | null
  statusName?: string | null
  isActive?: boolean
}

export type MasterDataApi<TDto,
TCreate,> = {
  getAll: (query?: MasterDataQuery) => Promise<ApiResult<MasterDataPage<TDto>>>
  getById: (id: number | string) => Promise<ApiResult<TDto>>
  create: (input: TCreate) => Promise<ApiResult<TDto>>
  update: (id: number | string, input: TCreate) => Promise<ApiResult<TDto>>
  destroy: (id: number | string) => Promise<ApiResult<void>>
}

const requestOptions = {
  baseUrl: "same-origin" as const,
}

const invalidId = (): ApiFailure => ({
  success: false,
  error: "ID harus berupa bilangan bulat positif.",
  code: "INVALID_ID",
})

function normalizeId(id: number | string): number | null {
  const parsed = typeof id === "number" ? id : Number(id)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647
    ? parsed
    : null
}

function makeQueryString(query: MasterDataQuery = {}) {
  const params = new URLSearchParams()
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ["Page", query.page],
    ["PageSize", query.pageSize],
    ["Search", query.search],
    ["SortBy", query.sortBy],
    ["SortDir", query.sortDir],
    ["SafePage", query.safePage],
    ["SafeSize", query.safeSize],
    ["Desc", query.desc],
  ]
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `?${search}` : ""
}

function createResourceApi<TDto, TCreate>(
  route: string,
): MasterDataApi<TDto, TCreate> {
  return {
    getAll: (query) =>
      httpRequest<MasterDataPage<TDto>>(
        `${route}${makeQueryString(query)}`,
        { method: "GET" },
        requestOptions,
      ),
    getById: (id) => {
      const normalizedId = normalizeId(id)
      if (normalizedId === null) return Promise.resolve(invalidId())
      return httpRequest<TDto>(
        `${route}/${normalizedId}`,
        { method: "GET" },
        requestOptions,
      )
    },
    create: (input) =>
      httpRequest<TDto>(
        route,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        requestOptions,
      ),
    update: (id, input) => {
      const normalizedId = normalizeId(id)
      if (normalizedId === null) return Promise.resolve(invalidId())
      return httpRequest<TDto>(
        `${route}/${normalizedId}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
        requestOptions,
      )
    },
    destroy: (id) => {
      const normalizedId = normalizeId(id)
      if (normalizedId === null) return Promise.resolve(invalidId())
      return httpRequest<void>(
        `${route}/${normalizedId}`,
        { method: "DELETE" },
        requestOptions,
      )
    },
  }
}

export const brandsApi = createResourceApi<BrandDto, BrandRequest>(
  apiRoutes.masterData.brands,
)

export const categoriesApi = createResourceApi<CategoryDto, CategoryRequest>(
  apiRoutes.masterData.categories,
)

export const assetTypesApi = createResourceApi<AssetTypeDto, AssetTypeRequest>(
  apiRoutes.masterData.types,
)

export const assetModelsApi =
  createResourceApi<AssetModelDto, AssetModelRequest>(
    apiRoutes.masterData.models,
  )

export const assetGroupsApi =
  createResourceApi<AssetGroupDto, AssetGroupRequest>(
    apiRoutes.masterData.groups,
  )

export const businessUnitsApi =
  createResourceApi<BusinessUnitDto, BusinessUnitRequest>(
    apiRoutes.masterData.businessUnits,
  )

export const locationsApi = createResourceApi<LocationDto, LocationRequest>(
  apiRoutes.masterData.locations,
)

export const conditionsApi = createResourceApi<ConditionDto, ConditionRequest>(
  apiRoutes.masterData.conditions,
)

export const assetStatusesApi =
  createResourceApi<AssetStatusDto, AssetStatusRequest>(
    apiRoutes.masterData.assetStatuses,
  )

export const masterDataApi = {
  brands: brandsApi,
  categories: categoriesApi,
  types: assetTypesApi,
  models: assetModelsApi,
  groups: assetGroupsApi,
  businessUnits: businessUnitsApi,
  locations: locationsApi,
  conditions: conditionsApi,
  assetStatuses: assetStatusesApi,
}
