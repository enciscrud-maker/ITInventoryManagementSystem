import { demoMaster, type Asset, type MasterItem } from "../data/demoData"

export type MasterKey = "categories" | "groups" | "types" | "brands" | "models" | "locations" | "conditions"

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

const idConfig: Record<MasterKey, {
  prefix: string
  field: keyof MasterItem
  pattern: RegExp
}> = {
  categories: { prefix: "c", field: "category_id", pattern: /^c\d{4}$/ },
  groups: { prefix: "gr", field: "group_id", pattern: /^gr\d{4}$/ },
  types: { prefix: "t", field: "type_id", pattern: /^t\d{4}$/ },
  brands: { prefix: "b", field: "brand_id", pattern: /^b\d{4}$/ },
  models: { prefix: "m", field: "model_id", pattern: /^m\d{4}$/ },
  locations: { prefix: "l", field: "location_id", pattern: /^l\d{4}$/ },
  conditions: { prefix: "s", field: "condition_id", pattern: /^s\d{4}$/ },
}

const normalize = (value: string) => value.trim().toLocaleLowerCase()
const historyKey = "iti-master-id-history"

function idHistory() {
  if (typeof localStorage === "undefined") return [] as string[]
  try {
    return JSON.parse(localStorage.getItem(historyKey) ?? "[]") as string[]
  } catch {
    return []
  }
}

export function reserveMasterId(id: string) {
  if (typeof localStorage === "undefined") return
  const history = new Set(idHistory())
  history.add(id)
  localStorage.setItem(historyKey, JSON.stringify([...history]))
}

export function generateMasterId(items: MasterItem[], key: MasterKey) {
  const { field, pattern, prefix } = idConfig[key]
  const ids = [
    ...items.map((item) => String(item[field] ?? item.id)),
    ...idHistory(),
  ]
  const max = ids.reduce((current, id) => {
    return pattern.test(id)
      ? Math.max(current, Number(id.slice(prefix.length)))
      : current
  }, 0)
  return `${prefix}${String(max + 1).padStart(4, "0")}`
}

export const generateCategoryId = (items: MasterItem[]) =>
  generateMasterId(items, "categories")
export const generateGroupId = (items: MasterItem[]) =>
  generateMasterId(items, "groups")
export const generateCategoryCode = (name: string) =>
  name.trim().charAt(0).toUpperCase()
export const generateGroupCode = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ""
  return (
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2)
  ).toUpperCase()
}

export function resolveCategoryById(
  categories: MasterItem[],
  categoryId: string,
) {
  return categories.find((item) => (item.category_id ?? item.id) === categoryId)
}

export function resolveGroupById(groups: MasterItem[], groupId: string) {
  return groups.find((item) => (item.group_id ?? item.id) === groupId)
}

export function resolveTypeById(types: MasterItem[], typeId: string) {
  return types.find((item) => (item.type_id ?? item.id) === typeId)
}

export function resolveBrandById(brands: MasterItem[], brandId: string) {
  return brands.find((item) => (item.brand_id ?? item.id) === brandId)
}

export function getMasterItemId(
  item: MasterItem | undefined,
  field: keyof MasterItem,
) {
  return String(item?.[field] ?? item?.id ?? "")
}

function resolveMasterReference(
  items: MasterItem[],
  id: string | undefined,
  name: string | undefined,
  idField: keyof MasterItem,
) {
  const targetId = normalize(id ?? "")
  const targetName = normalize(name ?? "")
  const nameField = `${String(idField).replace(/_id$/, "")}_name` as keyof MasterItem
  return items.find(
    (item) =>
      (targetId &&
        [item[idField], item.id].some(
          (value) => normalize(String(value ?? "")) === targetId,
        )) ||
      (targetName &&
        [item[nameField], item.name].some(
          (value) => normalize(String(value ?? "")) === targetName,
        )),
  )
}

export function normalizeAssetClassification<T extends Partial<Asset>>(
  asset: T,
  master: Record<string, MasterItem[]>,
) {
  const models = master.models ?? []
  const modelById = resolveMasterReference(
    models,
    asset.modelId,
    undefined,
    "model_id",
  )
  const modelCandidates = models.filter(
    (item) => normalize(item.name) === normalize(asset.model ?? ""),
  )
  const model =
    modelById ??
    modelCandidates.find(
      (item) =>
        (!asset.brandId || item.brand_id === asset.brandId) &&
        (!asset.brand ||
          normalize(item.brand_name ?? "") === normalize(asset.brand)) &&
        (!asset.typeId || item.type_id === asset.typeId) &&
        (!asset.type ||
          normalize(item.type_name ?? "") === normalize(asset.type)),
    ) ??
    modelCandidates[0]
  const type = resolveMasterReference(
    master.types ?? [],
    asset.typeId || model?.type_id,
    asset.type || model?.type_name,
    "type_id",
  )
  const group = resolveMasterReference(
    master.groups ?? [],
    asset.groupId || type?.group_id || model?.group_id,
    asset.group || type?.group_name || model?.group_name,
    "group_id",
  )
  const category = resolveMasterReference(
    master.categories ?? [],
    asset.categoryId || group?.category_id || type?.category_id,
    asset.category || group?.category_name || type?.category_name,
    "category_id",
  )
  const brand = resolveMasterReference(
    master.brands ?? [],
    asset.brandId || model?.brand_id,
    asset.brand || model?.brand_name,
    "brand_id",
  )

  return {
    ...asset,
    categoryId: getMasterItemId(category, "category_id"),
    groupId: getMasterItemId(group, "group_id"),
    typeId: getMasterItemId(type, "type_id"),
    brandId: getMasterItemId(brand, "brand_id"),
    modelId: getMasterItemId(model, "model_id"),
    category: category?.name ?? asset.category ?? "",
    group: group?.name ?? asset.group ?? "",
    type: type?.name ?? asset.type ?? "",
    brand: brand?.name ?? asset.brand ?? "",
    model: model?.name ?? asset.model ?? "",
  }
}

export function isAssetClassificationValid(
  asset: Partial<Asset>,
  master: Record<string, MasterItem[]>,
) {
  const normalizedAsset = normalizeAssetClassification(asset, master)
  const category = resolveMasterReference(
    master.categories ?? [],
    normalizedAsset.categoryId,
    normalizedAsset.category,
    "category_id",
  )
  const group = resolveMasterReference(
    master.groups ?? [],
    normalizedAsset.groupId,
    normalizedAsset.group,
    "group_id",
  )
  const type = resolveMasterReference(
    master.types ?? [],
    normalizedAsset.typeId,
    normalizedAsset.type,
    "type_id",
  )
  const brand = resolveMasterReference(
    master.brands ?? [],
    normalizedAsset.brandId,
    normalizedAsset.brand,
    "brand_id",
  )
  const model = resolveMasterReference(
    master.models ?? [],
    normalizedAsset.modelId,
    normalizedAsset.model,
    "model_id",
  )
  if (!category || !group || !type || !brand || !model) return false

  const categoryId = getMasterItemId(category, "category_id")
  const groupId = getMasterItemId(group, "group_id")
  const typeId = getMasterItemId(type, "type_id")
  const brandId = getMasterItemId(brand, "brand_id")
  const modelSupportsBrandType =
    (!model.brand_id || model.brand_id === brandId) &&
    (!model.type_id || model.type_id === typeId)
  return (
    (!group.category_id || group.category_id === categoryId) &&
    (!type.group_id || type.group_id === groupId) &&
    (!type.category_id || type.category_id === categoryId) &&
    (!brand.type_id || brand.type_id === typeId || modelSupportsBrandType) &&
    modelSupportsBrandType
  )
}

export function getGroupsByCategory(groups: MasterItem[], categoryId: string) {
  return groups.filter((item) => item.category_id === categoryId)
}

export function createCategoryRecord(
  id: string,
  name: string,
  active = true,
): MasterItem {
  const cleanName = name.trim()
  const code = generateCategoryCode(cleanName)
  return {
    id,
    name: cleanName,
    code,
    active,
    category_id: id,
    category_name: cleanName,
    category_code: code,
  }
}

export function createGroupRecord(
  id: string,
  name: string,
  category: MasterItem,
  active = true,
  fixedCode?: string,
): MasterItem {
  const cleanName = name.trim()
  const code = fixedCode ?? generateGroupCode(cleanName)
  const categoryId = category.category_id ?? category.id
  const categoryName = category.category_name ?? category.name
  const categoryCode = category.category_code ?? category.code
  return {
    id,
    name: cleanName,
    code,
    active,
    parent: categoryName,
    group_id: id,
    group_name: cleanName,
    group_code: code,
    category_id: categoryId,
    category_name: categoryName,
    category_code: categoryCode,
  }
}

export function generateAssetId(
  category?: MasterItem,
  group?: MasterItem,
  type?: MasterItem,
  brand?: MasterItem,
) {
  return [
    category?.category_code ?? category?.code,
    group?.group_code ?? group?.code,
    type?.type_code ?? type?.code,
    brand?.brand_code ?? brand?.code,
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase()
}

export function validateCategory(
  item: MasterItem,
  categories: MasterItem[],
): ValidationResult {
  const id = item.category_id ?? item.id
  const name = (item.category_name ?? item.name).trim()
  const code = item.category_code ?? item.code
  const others = categories.filter(
    (candidate) => (candidate.category_id ?? candidate.id) !== id,
  )
  const errors: string[] = []
  if (!idConfig.categories.pattern.test(id))
    errors.push("Category ID must use the format c0001.")
  if (!name) errors.push("Category name is required.")
  if (code !== generateCategoryCode(name))
    errors.push(
      "Category code must match the first letter of the category name.",
    )
  if (
    others.some(
      (candidate) =>
        normalize(candidate.category_name ?? candidate.name) ===
        normalize(name),
    )
  )
    errors.push("Category name already exists.")
  if (
    others.some(
      (candidate) => (candidate.category_code ?? candidate.code) === code,
    )
  )
    errors.push("Category code already exists.")
  return { valid: errors.length === 0, errors }
}

export function validateGroup(
  item: MasterItem,
  groups: MasterItem[],
  categories: MasterItem[],
): ValidationResult {
  const id = item.group_id ?? item.id
  const name = (item.group_name ?? item.name).trim()
  const code = item.group_code ?? item.code
  const others = groups.filter(
    (candidate) => (candidate.group_id ?? candidate.id) !== id,
  )
  const errors: string[] = []
  if (!idConfig.groups.pattern.test(id))
    errors.push("Group ID must use the format gr0001.")
  if (!name) errors.push("Group name is required.")
  if (!item.category_id || !resolveCategoryById(categories, item.category_id))
    errors.push("Select a valid Category.")
  if (
    code !== generateGroupCode(name) &&
    !demoMaster.groups.some((seed) => seed.name === name && seed.code === code)
  )
    errors.push("Group code does not match the generated code.")
  if (
    others.some(
      (candidate) =>
        normalize(candidate.group_name ?? candidate.name) === normalize(name),
    )
  )
    errors.push("Group name already exists.")
  if (
    others.some(
      (candidate) => (candidate.group_code ?? candidate.code) === code,
    )
  )
    errors.push(
      "Group code already exists. Enter a more distinctive group name.",
    )
  return { valid: errors.length === 0, errors }
}

function canonicalId(
  item: MasterItem,
  seed: MasterItem | undefined,
  items: MasterItem[],
  key: MasterKey,
) {
  const { field, pattern } = idConfig[key]
  const current = String(item[field] ?? item.id)
  if (pattern.test(current)) return current
  const seeded = String(seed?.[field] ?? seed?.id ?? "")
  return pattern.test(seeded)
    ? seeded
    : generateMasterId([...demoMaster[key], ...items], key)
}

function mergeByName(
  source: MasterItem[],
  seeds: MasterItem[],
  makeRecord: (
    item: MasterItem,
    seed: MasterItem | undefined,
    result: MasterItem[],
  ) => MasterItem,
  identity = (item: MasterItem) => normalize(item.name),
) {
  const result: MasterItem[] = []
  const add = (item: MasterItem) => {
    const sameNameSeeds = seeds.filter(
      (candidate) => normalize(candidate.name) === normalize(item.name),
    )
    const seed =
      sameNameSeeds.find(
        (candidate) => identity(candidate) === identity(item),
      ) ?? (sameNameSeeds.length === 1 ? sameNameSeeds[0] : undefined)
    const record = makeRecord(item, seed, result)
    if (
      result.some(
        (candidate) =>
          candidate.id === record.id ||
          identity(candidate) === identity(record),
      )
    )
      return
    result.push(record)
  }
  source.forEach(add)
  seeds.forEach(add)
  return result
}

export function migrateMasterData(
  source: Record<string, MasterItem[]>,
): Record<string, MasterItem[]> {
  const categories = mergeByName(
    Array.isArray(source.categories) ? source.categories : [],
    demoMaster.categories,
    (item, seed, result) =>
      createCategoryRecord(
        canonicalId(item, seed, result, "categories"),
        item.category_name ?? item.name,
        item.active !== false,
      ),
  )

  const groups = mergeByName(
    Array.isArray(source.groups) ? source.groups : [],
    demoMaster.groups,
    (item, seed, result) => {
      const category =
        resolveCategoryById(categories, item.category_id ?? "") ??
        categories.find(
          (candidate) =>
            normalize(candidate.name) ===
            normalize(item.category_name ?? item.parent ?? ""),
        ) ??
        categories.find(
          (candidate) =>
            normalize(candidate.name) === normalize(seed?.category_name ?? ""),
        ) ??
        categories[0]
      return createGroupRecord(
        canonicalId(item, seed, result, "groups"),
        item.group_name ?? item.name,
        category,
        item.active !== false,
        seed?.group_code ?? item.group_code ?? item.code,
      )
    },
  )

  const types = mergeByName(
    Array.isArray(source.types) ? source.types : [],
    demoMaster.types,
    (item, seed, result) => {
      const group =
        resolveGroupById(groups, item.group_id ?? "") ??
        groups.find(
          (candidate) =>
            normalize(candidate.name) ===
            normalize(item.group_name ?? item.parent ?? seed?.group_name ?? ""),
        )
      const id = canonicalId(item, seed, result, "types")
      const name = (item.type_name ?? item.name).trim()
      const code = seed?.type_code ?? item.type_code ?? item.code
      return {
        ...item,
        id,
        name,
        code,
        parent: group?.name ?? "",
        type_id: id,
        type_name: name,
        type_code: code,
        group_id: group?.group_id,
        group_name: group?.name,
        group_code: group?.group_code ?? group?.code,
        category_id: group?.category_id,
        category_name: group?.category_name,
        category_code: group?.category_code,
        active: item.active !== false,
      }
    },
  )

  const brands = mergeByName(
    Array.isArray(source.brands) ? source.brands : [],
    demoMaster.brands,
    (item, seed, result) => {
      const id = canonicalId(item, seed, result, "brands")
      const type =
        resolveTypeById(types, item.type_id ?? "") ??
        types.find(
          (candidate) =>
            normalize(candidate.name) === normalize(item.parent ?? ""),
        )
      const name = (item.brand_name ?? item.name).trim()
      const code = seed?.brand_code ?? item.brand_code ?? item.code
      return {
        ...item,
        id,
        name,
        code,
        parent: type?.name ?? "",
        brand_id: id,
        brand_name: name,
        brand_code: code,
        type_id: type?.type_id,
        active: item.active !== false,
      }
    },
  )

  const models = mergeByName(
    Array.isArray(source.models) ? source.models : [],
    demoMaster.models,
    (item, seed, result) => {
      const id = canonicalId(item, seed, result, "models")
      const brand =
        resolveBrandById(brands, item.brand_id ?? seed?.brand_id ?? "") ??
        brands.find(
          (candidate) =>
            normalize(candidate.name) ===
            normalize(item.brand_name ?? item.parent ?? ""),
        )
      const type = resolveTypeById(
        types,
        item.type_id ?? seed?.type_id ?? brand?.type_id ?? "",
      )
      const group = resolveGroupById(groups, type?.group_id ?? "")
      const category = resolveCategoryById(categories, group?.category_id ?? "")
      const name = (item.model_name ?? item.name).trim()
      return {
        ...item,
        id,
        name,
        code: item.model_code ?? item.code,
        parent: brand?.name ?? "",
        model_id: id,
        model_name: name,
        model_code: item.model_code ?? item.code,
        asset_id:
          generateAssetId(category, group, type, brand) ||
          item.asset_id ||
          seed?.asset_id,
        brand_id: brand?.brand_id,
        brand_name: brand?.name,
        brand_code: brand?.brand_code ?? brand?.code,
        type_id: type?.type_id,
        type_name: type?.name,
        type_code: type?.type_code ?? type?.code,
        group_id: group?.group_id,
        group_name: group?.name,
        group_code: group?.group_code ?? group?.code,
        category_id: category?.category_id,
        category_name: category?.name,
        category_code: category?.category_code ?? category?.code,
        active: item.active !== false,
      }
    },
    (item) =>
      `${normalize(item.model_name ?? item.name)}|${item.brand_id ?? normalize(item.brand_name ?? item.parent ?? "")}`,
  )

  const locations = mergeByName(
    Array.isArray(source.locations) ? source.locations : [],
    demoMaster.locations,
    (item, seed, result) => {
      const id = canonicalId(item, seed, result, "locations")
      return {
        ...item,
        id,
        name: (item.location_name ?? item.name).trim(),
        code: item.location_code ?? item.code,
        location_id: id,
        location_name: (item.location_name ?? item.name).trim(),
        location_code: item.location_code ?? item.code,
      }
    },
  )

  const conditions = mergeByName(
    Array.isArray(source.conditions) ? source.conditions : [],
    demoMaster.conditions,
    (item, seed, result) => {
      const id = canonicalId(item, seed, result, "conditions")
      return {
        ...item,
        id,
        name: (item.condition_name ?? item.name).trim(),
        code: item.status_code ?? item.code,
        condition_id: id,
        condition_name: (item.condition_name ?? item.name).trim(),
        status_code: item.status_code ?? item.code,
      }
    },
  )

  return { categories, groups, types, brands, models, locations, conditions }
}
