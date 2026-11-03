import type { MasterItem } from "@/data/demoData"
import type { MasterDataSnapshot } from "@/services/api/masterDataCache"
import { generateAssetId } from "@/utils/masterData"

const relationId = (id: number | null | undefined) =>
  id == null ? "" : String(id)
const businessId = (
  value: string | null,
  prefix: string,
  internalId: number,
) => {
  const expected = new RegExp(`^${prefix}\\d{4}$`)
  return value && expected.test(value)
    ? value
    : `${prefix}${String(internalId).padStart(4, "0")}`
}

export function toMasterItems(data: MasterDataSnapshot) {
  const categories: MasterItem[] = data.categories.map((category) => ({
    id: String(category.catId),
    name: category.catName ?? "",
    code: category.catPrefix ?? "",
    display_id: businessId(category.catCode, "c", category.catId),
    prefix: category.catPrefix ?? undefined,
    active: category.isActive,
    category_id: businessId(category.catCode, "c", category.catId),
    category_name: category.catName ?? "",
    category_code: category.catPrefix ?? "",
    category_prefix: category.catPrefix ?? undefined,
  }))
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )

  const groups: MasterItem[] = data.groups.map((group) => {
    const category = categoryById.get(relationId(group.catId))
    return {
      id: String(group.groupId),
      name: group.groupName ?? "",
      code: group.groupPrefix ?? "",
      display_id: businessId(group.groupCode, "gr", group.groupId),
      prefix: group.groupPrefix ?? undefined,
      active: group.isActive,
      parent: category?.name ?? "",
      group_id: businessId(group.groupCode, "gr", group.groupId),
      group_name: group.groupName ?? "",
      group_code: group.groupPrefix ?? "",
      group_prefix: group.groupPrefix ?? undefined,
      category_id: relationId(group.catId),
      category_display_id: category?.display_id ?? category?.category_id,
      category_name: category?.name ?? "",
      category_code: category?.code ?? "",
      category_prefix: category?.prefix,
    }
  })
  const groupByInternalId = new Map(groups.map((group) => [group.id, group]))

  const types: MasterItem[] = data.types.map((type) => {
    const group = groupByInternalId.get(relationId(type.groupId))
    const category =
      categoryById.get(relationId(type.catId)) ??
      categoryById.get(group?.category_id ?? "")
    return {
      id: String(type.typeId),
      name: type.typeName ?? "",
      code: type.typePrefix ?? "",
      display_id: businessId(type.typeCode, "t", type.typeId),
      prefix: type.typePrefix ?? undefined,
      active: type.isActive,
      parent: group?.name ?? "",
      type_id: businessId(type.typeCode, "t", type.typeId),
      type_name: type.typeName ?? "",
      type_code: type.typePrefix ?? "",
      group_id: relationId(type.groupId),
      group_name: group?.name ?? "",
      group_code: group?.code ?? "",
      category_id: relationId(type.catId),
      category_display_id: category?.display_id ?? category?.category_id,
      category_name: category?.name ?? "",
      category_code: category?.code ?? "",
    }
  })
  const typeById = new Map(types.map((type) => [type.id, type]))

  const brands: MasterItem[] = data.brands.map((brand) => {
    const type = typeById.get(relationId(brand.typeId))
    return {
      id: String(brand.brandId),
      name: brand.brandName ?? "",
      code: brand.brandPrefix ?? "",
      display_id: businessId(brand.brandCode, "b", brand.brandId),
      prefix: brand.brandPrefix ?? undefined,
      active: brand.isActive,
      parent: type?.name ?? "",
      brand_id: businessId(brand.brandCode, "b", brand.brandId),
      brand_name: brand.brandName ?? "",
      brand_code: brand.brandPrefix ?? "",
      type_id: relationId(brand.typeId),
      type_name: type?.name ?? "",
      type_code: type?.code ?? "",
      type_display_id: type?.display_id ?? type?.type_id,
    }
  })
  const brandById = new Map(brands.map((brand) => [brand.id, brand]))

  const models: MasterItem[] = data.models.map((model) => {
    const category = categoryById.get(relationId(model.catId))
    const group = groupByInternalId.get(relationId(model.groupId))
    const type = typeById.get(relationId(model.typeId))
    const brand = brandById.get(relationId(model.brandId))
    const modelBusinessId = businessId(model.modelCode, "m", model.modelId)
    return {
      id: String(model.modelId),
      name: model.modelName ?? "",
      code: modelBusinessId,
      display_id: modelBusinessId,
      active: model.isActive,
      parent: brand?.name ?? "",
      model_id: modelBusinessId,
      model_name: model.modelName ?? "",
      model_code: modelBusinessId,
      asset_id: generateAssetId(category, group, type, brand),
      category_id: relationId(model.catId),
      category_name: category?.name ?? "",
      category_code: category?.code ?? "",
      group_id: relationId(model.groupId),
      group_name: group?.name ?? "",
      group_code: group?.code ?? "",
      type_id: relationId(model.typeId),
      type_name: type?.name ?? "",
      type_code: type?.code ?? "",
      brand_id: relationId(model.brandId),
      brand_name: brand?.name ?? "",
      brand_code: brand?.code ?? "",
    }
  })

  return { categories, groups, types, brands, models }
}
