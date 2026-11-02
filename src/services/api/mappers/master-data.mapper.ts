import type { MasterItem } from "@/data/demoData"
import type { MasterDataSnapshot } from "@/services/api/masterDataCache"
import { generateAssetId } from "@/utils/masterData"

const relationId = (id: number | null | undefined) =>
  id == null ? "" : String(id)

export function toMasterItems(data: MasterDataSnapshot) {
  const categories: MasterItem[] = data.categories.map((category) => ({
    id: String(category.catId),
    name: category.catName ?? "",
    code: category.catCode ?? category.catPrefix ?? "",
    active: category.isActive,
    category_id: String(category.catId),
    category_name: category.catName ?? "",
    category_code: category.catCode ?? category.catPrefix ?? "",
  }))
  const categoryById = new Map(
    categories.map((category) => [category.category_id, category]),
  )

  const groups: MasterItem[] = data.groups.map((group) => {
    const category = categoryById.get(relationId(group.catId))
    return {
      id: String(group.groupId),
      name: group.groupName ?? "",
      code: group.groupCode ?? group.groupPrefix ?? "",
      active: group.isActive,
      parent: category?.name ?? "",
      group_id: String(group.groupId),
      group_name: group.groupName ?? "",
      group_code: group.groupCode ?? group.groupPrefix ?? "",
      category_id: relationId(group.catId),
      category_name: category?.name ?? "",
      category_code: category?.code ?? "",
    }
  })
  const groupById = new Map(groups.map((group) => [group.group_id, group]))

  const types: MasterItem[] = data.types.map((type) => {
    const group = groupById.get(relationId(type.groupId))
    const category =
      categoryById.get(relationId(type.catId)) ??
      categoryById.get(group?.category_id ?? "")
    return {
      id: String(type.typeId),
      name: type.typeName ?? "",
      code: type.typeCode ?? type.typePrefix ?? "",
      active: type.isActive,
      parent: group?.name ?? "",
      type_id: String(type.typeId),
      type_name: type.typeName ?? "",
      type_code: type.typeCode ?? type.typePrefix ?? "",
      group_id: relationId(type.groupId),
      group_name: group?.name ?? "",
      group_code: group?.code ?? "",
      category_id: relationId(type.catId),
      category_name: category?.name ?? "",
      category_code: category?.code ?? "",
    }
  })
  const typeById = new Map(types.map((type) => [type.type_id, type]))

  const brands: MasterItem[] = data.brands.map((brand) => {
    const type = typeById.get(relationId(brand.typeId))
    return {
      id: String(brand.brandId),
      name: brand.brandName ?? "",
      code: brand.brandCode ?? brand.brandPrefix ?? "",
      active: brand.isActive,
      parent: type?.name ?? "",
      brand_id: String(brand.brandId),
      brand_name: brand.brandName ?? "",
      brand_code: brand.brandCode ?? brand.brandPrefix ?? "",
      type_id: relationId(brand.typeId),
      type_name: type?.name ?? "",
    }
  })
  const brandById = new Map(brands.map((brand) => [brand.brand_id, brand]))

  const models: MasterItem[] = data.models.map((model) => {
    const category = categoryById.get(relationId(model.catId))
    const group = groupById.get(relationId(model.groupId))
    const type = typeById.get(relationId(model.typeId))
    const brand = brandById.get(relationId(model.brandId))
    return {
      id: String(model.modelId),
      name: model.modelName ?? "",
      code: model.modelCode ?? "",
      active: model.isActive,
      parent: brand?.name ?? "",
      model_id: String(model.modelId),
      model_name: model.modelName ?? "",
      model_code: model.modelCode ?? "",
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
