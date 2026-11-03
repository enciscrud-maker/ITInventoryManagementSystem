import categoryRows from "./master/category.json"
import groupRows from "./master/group.json"
import typeRows from "./master/type.json"
import brandRows from "./master/brand.json"
import modelRows from "./master/model.json"
import conditionRows from "./master/condition.json"
import statusRows from "./master/status.json"
import type { MasterItem } from "./demoData"

const clean = (value: string) => value.trim()
const internalId = (businessId: string) =>
  String(Number(businessId.match(/\d+$/)?.[0] ?? 0))

const categories: MasterItem[] = categoryRows.map((row) => ({
  id: internalId(row.category_id),
  name: clean(row.category_name),
  code: row.category_code,
  display_id: row.category_id,
  category_id: row.category_id,
  category_name: clean(row.category_name),
  category_code: row.category_code,
  active: true,
}))
const categoryByBusinessId = new Map(
  categories.map((item) => [item.category_id, item]),
)

const groups: MasterItem[] = groupRows.map((row) => ({
  id: internalId(row.group_id),
  name: clean(row.group_name),
  code: row.group_code,
  parent: clean(row.category_name),
  display_id: row.group_id,
  group_id: row.group_id,
  group_name: clean(row.group_name),
  group_code: row.group_code,
  category_id: categoryByBusinessId.get(row.category_id)?.id ?? "",
  category_display_id: row.category_id,
  category_name: clean(row.category_name),
  category_code: row.category_code,
  active: true,
}))
const groupByBusinessId = new Map(
  groups.map((item) => [item.group_id, item]),
)
const types: MasterItem[] = typeRows.map((row) => {
  const group = groupByBusinessId.get(row.group_id)
  return {
    id: internalId(row.type_id),
    name: clean(row.type_name),
    code: row.type_code,
    parent: clean(row.group_name),
    display_id: row.type_id,
    type_id: row.type_id,
    type_name: clean(row.type_name),
    type_code: row.type_code,
    group_id: group?.id ?? "",
    group_name: clean(row.group_name),
    group_code: row.group_code,
    category_id: group?.category_id ?? "",
    category_display_id: group?.category_display_id,
    category_name: clean(row.category_name),
    category_code: row.category_code,
    active: true,
  }
})

const typeByBusinessId = new Map(types.map((item) => [item.type_id, item]))
const brands: MasterItem[] = brandRows.map((row) => {
  const type = row.type_id ? typeByBusinessId.get(row.type_id) : undefined
  return {
    id: internalId(row.brand_id),
    name: clean(row.brand_name),
    code: row.brand_code,
    display_id: row.brand_id,
    brand_id: row.brand_id,
    brand_name: clean(row.brand_name),
    brand_code: row.brand_code,
    type_id: type?.id ?? "",
    type_name: type?.name ?? "",
    type_code: type?.code ?? "",
    type_display_id: type?.display_id ?? "",
    active: true,
  }
})

const brandByBusinessId = new Map(brands.map((item) => [item.brand_id, item]))
const models: MasterItem[] = modelRows.map((row) => {
  const type = typeByBusinessId.get(row.type_id)
  const brand = brandByBusinessId.get(row.brand_id)
  const group = type ? groups.find((item) => item.id === type.group_id) : undefined
  const category = group
    ? categories.find((item) => item.id === group.category_id)
    : undefined
  return {
    id: internalId(row.model_id),
    name: clean(row.model_name),
    code: row.model_code,
    parent: clean(row.brand_name),
    display_id: row.model_id,
    model_id: row.model_id,
    model_name: clean(row.model_name),
    model_code: row.model_code,
    asset_id: row.asset_id,
    brand_id: brand?.id ?? "",
    brand_name: brand?.name ?? clean(row.brand_name),
    brand_code: brand?.code ?? row.brand_code,
    type_id: type?.id ?? "",
    type_name: type?.name ?? clean(row.type_name),
    type_code: type?.code ?? row.type_code,
    group_id: group?.id ?? "",
    group_name: group?.name ?? clean(row.group_name),
    group_code: group?.code ?? row.group_code,
    category_id: category?.id ?? "",
    category_name: category?.name ?? clean(row.category_name),
    category_code: category?.code ?? row.category_code,
    active: true,
  }
})

const conditions: MasterItem[] = conditionRows.map((row) => ({
  id: row.id,
  name: clean(row.condition),
  code: "",
  tagColor: row.tagColor,
}))

const statuses: MasterItem[] = statusRows.map((row) => ({
  id: row.id,
  name: clean(row.status),
  code: row.code,
  usage: row.usage as "In" | "Out",
}))

export const canonicalMasterSeed: Record<string, MasterItem[]> = {
  categories,
  groups,
  types,
  brands,
  models,
  conditions,
  statuses,
}
