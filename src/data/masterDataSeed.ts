import categoryRows from "./master/category.json"
import groupRows from "./master/group.json"
import typeRows from "./master/type.json"
import brandRows from "./master/brand.json"
import modelRows from "./master/model.json"
import type { MasterItem } from "./demoData"

const clean = (value: string) => value.trim()

const categories: MasterItem[] = categoryRows.map((row) => ({
  id: row.category_id,
  name: clean(row.category_name),
  code: row.category_code,
  category_id: row.category_id,
  category_name: clean(row.category_name),
  category_code: row.category_code,
  active: true,
}))

const groups: MasterItem[] = groupRows.map((row) => ({
  id: row.group_id,
  name: clean(row.group_name),
  code: row.group_code,
  parent: clean(row.category_name),
  group_id: row.group_id,
  group_name: clean(row.group_name),
  group_code: row.group_code,
  category_id: row.category_id,
  category_name: clean(row.category_name),
  category_code: row.category_code,
  active: true,
}))

const types: MasterItem[] = typeRows.map((row) => {
  const group = groups.find((item) => item.group_id === row.group_id)
  return {
    id: row.type_id,
    name: clean(row.type_name),
    code: row.type_code,
    parent: clean(row.group_name),
    type_id: row.type_id,
    type_name: clean(row.type_name),
    type_code: row.type_code,
    group_id: row.group_id,
    group_name: clean(row.group_name),
    group_code: row.group_code,
    category_id: group?.category_id,
    category_name: clean(row.category_name),
    category_code: row.category_code,
    active: true,
  }
})

const brands: MasterItem[] = brandRows.map((row) => ({
  id: row.brand_id,
  name: clean(row.brand_name),
  code: row.brand_code,
  brand_id: row.brand_id,
  brand_name: clean(row.brand_name),
  brand_code: row.brand_code,
  type_id: row.type_id || undefined,
  active: true,
}))

const models: MasterItem[] = modelRows.map((row) => ({
  id: row.model_id,
  name: clean(row.model_name),
  code: row.model_code,
  parent: clean(row.brand_name),
  model_id: row.model_id,
  model_name: clean(row.model_name),
  model_code: row.model_code,
  asset_id: row.asset_id,
  brand_id: row.brand_id,
  brand_name: clean(row.brand_name),
  brand_code: row.brand_code,
  type_id: row.type_id,
  type_name: clean(row.type_name),
  type_code: row.type_code,
  group_name: clean(row.group_name),
  group_code: row.group_code,
  category_name: clean(row.category_name),
  category_code: row.category_code,
  active: true,
}))

export const canonicalMasterSeed: Record<string, MasterItem[]> = {
  categories,
  groups,
  types,
  brands,
  models,
}
