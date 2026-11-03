"use client"

import { useMemo, useState } from "react"
import { Edit3, Plus, Trash2 } from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import { useAuth } from "@/auth/AuthContext"
import {
  canCreateInModule,
  canDelete,
  canManageExisting,
} from "@/services/authorizationService"
import {
  assetGroupsApi,
  assetModelsApi,
  assetTypesApi,
  brandsApi,
  categoriesApi,
} from "@/services/api/masterData.api"
import {
  invalidateMasterDataCache,
  refreshMasterDataSnapshot,
} from "@/services/api/masterDataCache"
import { toMasterItems } from "@/services/api/mappers/master-data.mapper"
import type { ApiResult } from "@/lib/api/types"
import type { Asset, MasterItem } from "@/data/demoData"
import ConditionStatusManagement from "./ConditionStatusManagement"
import ConditionBadge from "@/components/ConditionBadge"
import {
  createCategoryRecord,
  createGroupRecord,
  generateAssetId,
  generateCategoryCode,
  generateClassificationCode,
  generateGroupCode,
  generateMasterInternalId,
  generateMasterId,
  getMasterInternalId,
  resolveBrandById,
  resolveCategoryById,
  resolveGroupById,
  resolveTypeById,
  reserveMasterInternalId,
  type MasterKey,
  validateCategory,
  validateGroup,
} from "@/utils/masterData"
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Tabs,
} from "@/components/ui"
import BusinessUnitManagement from "./BusinessUnitManagement"

const tabs: Record<string, MasterKey> = {
  Category: "categories",
  Group: "groups",
  Type: "types",
  Brand: "brands",
  Model: "models",
  "Business Unit": "businessUnits",
  "Condition & Status": "conditions",
}

const idField: Record<MasterKey, keyof MasterItem> = {
  categories: "category_id",
  groups: "group_id",
  types: "type_id",
  brands: "brand_id",
  models: "model_id",
  businessUnits: "id",
  locations: "location_id",
  conditions: "id",
  statuses: "id",
}

function withGeneratedBusinessId(
  key: MasterKey,
  item: MasterItem,
  businessId: string,
  internalId: string,
): MasterItem {
  return {
    ...item,
    id: internalId,
    display_id: businessId,
    [idField[key]]: businessId,
    ...(key === "models" ? { model_code: businessId } : {}),
  }
}

const entityName: Record<MasterKey, string> = {
  categories: "Category",
  groups: "Group",
  types: "Type",
  brands: "Brand",
  models: "Model",
  businessUnits: "Business Unit",
  locations: "Location",
  conditions: "Condition",
  statuses: "Status",
}

const backendMasterKeys = new Set<MasterKey>([
  "categories",
  "groups",
  "types",
  "brands",
  "models",
])

function relatedId(value: string | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647
    ? parsed
    : null
}

function invalidRelationship(): ApiResult<never> {
  return {
    success: false,
    error: "Pilih relasi master data yang valid sebelum menyimpan.",
    code: "INVALID_RELATIONSHIP",
  }
}

async function saveBackendMasterRecord(
  key: MasterKey,
  draft: MasterItem,
  existingId?: string,
): Promise<ApiResult<unknown>> {
  const active = draft.active !== false
  const name = draft.name.trim()
  const id = draft.id.trim()
  const save = <T,>(
    api: { create: (input: T) => Promise<ApiResult<unknown>>; update: (id: string, input: T) => Promise<ApiResult<unknown>> },
    input: T,
  ) => existingId ? api.update(existingId, input) : api.create(input)

  if (key === "categories") {
    return save(categoriesApi, {
      catName: name,
      catCode: (draft.category_id ?? id).trim(),
      catPrefix: (draft.category_code ?? draft.code).trim(),
      isActive: active,
    })
  }
  if (key === "groups") {
    const catId = relatedId(draft.category_id)
    if (!catId) return invalidRelationship()
    return save(assetGroupsApi, {
      catId,
      groupName: name,
      groupCode: (draft.group_id ?? id).trim(),
      groupPrefix: (draft.group_code ?? draft.code).trim(),
      isActive: active,
    })
  }
  if (key === "types") {
    const groupId = relatedId(draft.group_id)
    const catId = relatedId(draft.category_id)
    if (!groupId || !catId) return invalidRelationship()
    return save(assetTypesApi, {
      groupId,
      catId,
      typeName: name,
      typeCode: (draft.type_id ?? id).trim(),
      typePrefix: (draft.type_code ?? draft.code).trim(),
      isActive: active,
    })
  }
  if (key === "brands") {
    const typeId = draft.type_id ? relatedId(draft.type_id) : null
    if (draft.type_id && !typeId) return invalidRelationship()
    return save(brandsApi, {
      typeId,
      brandName: name,
      brandCode: (draft.brand_id ?? id).trim(),
      brandPrefix: (draft.brand_code ?? draft.code).trim(),
      isActive: active,
    })
  }
  if (key === "models") {
    const catId = relatedId(draft.category_id)
    const brandId = relatedId(draft.brand_id)
    const groupId = relatedId(draft.group_id)
    const typeId = relatedId(draft.type_id)
    if (!catId || !brandId || !groupId || !typeId) return invalidRelationship()
    return save(assetModelsApi, {
      catId,
      brandId,
      groupId,
      typeId,
      modelName: name,
      modelCode: (draft.model_id ?? draft.display_id ?? id).trim(),
      isActive: active,
    })
  }
  return invalidRelationship()
}

function deleteBackendMasterRecord(
  key: MasterKey,
  id: string,
): Promise<ApiResult<void>> {
  if (key === "categories") return categoriesApi.destroy(id)
  if (key === "groups") return assetGroupsApi.destroy(id)
  if (key === "types") return assetTypesApi.destroy(id)
  if (key === "brands") return brandsApi.destroy(id)
  if (key === "models") return assetModelsApi.destroy(id)
  return Promise.resolve({
    success: false,
    error: "Resource master data tidak didukung.",
    code: "UNSUPPORTED_RESOURCE",
  })
}

function getClassificationReferences(
  key: MasterKey,
  item: MasterItem,
  master: Record<string, MasterItem[]>,
  assets: Asset[],
) {
  const internalId = item.id
  const references = new Set<string>()
  if (
    key === "categories" &&
    (master.groups.some((group) => group.category_id === internalId) ||
      master.types.some((type) => type.category_id === internalId) ||
      master.models.some((model) => model.category_id === internalId) ||
      assets.some(
        (asset) =>
          asset.categoryId === internalId ||
          (!asset.categoryId && asset.category === item.name),
      ))
  )
    references.add("Groups, Types, Models, or Assets")
  if (
    key === "groups" &&
    (master.types.some((type) => type.group_id === internalId) ||
      master.models.some((model) => model.group_id === internalId) ||
      assets.some(
        (asset) =>
          asset.groupId === internalId ||
          (!asset.groupId && asset.group === item.name),
      ))
  )
    references.add("Types, Models, or Assets")
  if (
    key === "types" &&
    (master.brands.some((brand) => brand.type_id === internalId) ||
      master.models.some((model) => model.type_id === internalId) ||
      assets.some(
        (asset) =>
          asset.typeId === internalId ||
          (!asset.typeId && asset.type === item.name),
      ))
  )
    references.add("Brands, Models, or Assets")
  if (
    key === "brands" &&
    (master.models.some((model) => model.brand_id === internalId) ||
      assets.some(
        (asset) =>
          asset.brandId === internalId ||
          (!asset.brandId && asset.brand === item.name),
      ))
  )
    references.add("Models or Assets")
  if (
    key === "models" &&
    assets.some(
      (asset) =>
        asset.modelId === internalId ||
        (!asset.modelId && asset.model === item.name),
    )
  )
    references.add("Assets")
  return [...references]
}

function getRelationshipChangeErrors(
  key: MasterKey,
  draft: MasterItem,
  master: Record<string, MasterItem[]>,
  assets: Asset[],
  original?: MasterItem,
) {
  if (!original) return []
  const errors: string[] = []
  if (
    key === "groups" &&
    original.category_id !== draft.category_id &&
    (master.types.some((type) => type.group_id === original.id) ||
      master.models.some((model) => model.group_id === original.id) ||
      assets.some((asset) => asset.groupId === original.id))
  )
    errors.push(
      "Category cannot be changed while Types, Models, or Assets reference this Group.",
    )
  if (
    key === "types" &&
    original.group_id !== draft.group_id &&
    (master.models.some((model) => model.type_id === original.id) ||
      assets.some((asset) => asset.typeId === original.id))
  )
    errors.push(
      "Group cannot be changed while Models or Assets reference this Type.",
    )
  if (
    key === "brands" &&
    original.type_id !== draft.type_id &&
    (master.models.some(
      (model) =>
        model.brand_id === original.id &&
        draft.type_id &&
        model.type_id !== draft.type_id,
    ) ||
      assets.some(
        (asset) =>
          asset.brandId === original.id &&
          draft.type_id &&
          asset.typeId !== draft.type_id,
      ))
  )
    errors.push(
      "Brand Type cannot be changed because existing Models or Assets use it with a different Type.",
    )
  if (
    key === "models" &&
    (original.category_id !== draft.category_id ||
      original.group_id !== draft.group_id ||
      original.type_id !== draft.type_id ||
      original.brand_id !== draft.brand_id) &&
    assets.some((asset) => asset.modelId === original.id)
  )
    errors.push(
      "Model classification cannot be changed while Assets reference this Model.",
    )
  if (
    ["categories", "groups", "types", "brands"].includes(key) &&
    original.code !== draft.code
  ) {
    const before = new Map<string, number>()
    const after = new Map<string, number>()
    master.models.forEach((model) => {
      const currentCategory = resolveCategoryById(
        master.categories,
        String(model.category_id ?? ""),
      )
      const currentGroup = resolveGroupById(
        master.groups,
        String(model.group_id ?? ""),
      )
      const currentType = resolveTypeById(
        master.types,
        String(model.type_id ?? ""),
      )
      const currentBrand = resolveBrandById(
        master.brands,
        String(model.brand_id ?? ""),
      )
      const currentId =
        model.asset_id ??
        generateAssetId(currentCategory, currentGroup, currentType, currentBrand)
      const category =
        key === "categories" &&
        model.category_id === original.id &&
        currentCategory
          ? {
              ...currentCategory,
              code: draft.code,
              category_code: draft.code,
            }
          : currentCategory
      const group =
        key === "groups" && model.group_id === original.id && currentGroup
          ? { ...currentGroup, code: draft.code, group_code: draft.code }
          : currentGroup
      const type =
        key === "types" && model.type_id === original.id && currentType
          ? { ...currentType, code: draft.code, type_code: draft.code }
          : currentType
      const brand =
        key === "brands" && model.brand_id === original.id && currentBrand
          ? { ...currentBrand, code: draft.code, brand_code: draft.code }
          : currentBrand
      const nextId = generateAssetId(category, group, type, brand)
      if (currentId) before.set(currentId, (before.get(currentId) ?? 0) + 1)
      if (nextId) after.set(nextId, (after.get(nextId) ?? 0) + 1)
    })
    if ([...after].some(([assetId, count]) => count > (before.get(assetId) ?? 0)))
      errors.push(
        "Changing this code would create duplicate generated Asset IDs.",
      )
  }
  return errors
}

export default function MasterData() {
  const {
    assets,
    master,
    saveMaster,
    deleteMaster,
    notify,
    masterDataStatus,
    masterDataError,
    masterDataRefreshing,
    refreshMasterData,
  } = useInventory()
  const { currentUser } = useAuth()
  const createAllowed = canCreateInModule(currentUser, "master-data")
  const [tab, setTab] = useState("Category")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<MasterItem | null | undefined>()
  const [draft, setDraft] = useState<MasterItem | null>(null)
  const [deleting, setDeleting] = useState<MasterItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingRemote, setDeletingRemote] = useState(false)
  const key = tabs[tab]
  const isBackendMasterData = backendMasterKeys.has(key)
  const backendReady = masterDataStatus === "ready"
  const creatingBackendRecord = isBackendMasterData && editing === null

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return master[key].filter((item) => {
      const matchesSearch = [
        item.display_id ?? item[idField[key]],
        item.name,
        item.prefix,
        item.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
      return (
        matchesSearch &&
        (key !== "groups" ||
          !categoryFilter ||
          item.category_id === categoryFilter)
      )
    })
  }, [categoryFilter, key, master, search])

  const pageSize = 10
  const pages = Math.ceil(rows.length / pageSize)
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize)

  const openEdit = (item?: MasterItem) => {
    if (item) {
      setDraft({ ...item })
      setEditing(item)
      return
    }
    const businessId = generateMasterId(master[key], key)
    const id = generateMasterInternalId(master[key], key)
    const base: MasterItem = {
      id,
      name: "",
      code: "",
      display_id: businessId,
      [idField[key]]: businessId,
      active: true,
    }
    setDraft(
      key === "categories"
        ? createCategoryRecord(id, businessId, "")
        : key === "groups"
          ? {
              ...base,
              group_id: businessId,
              group_name: "",
              group_code: "",
              category_id: "",
            }
          : key === "types"
            ? { 
              ...base, 
              type_id: businessId,
              type_name: "", 
              type_code: "" 
            }
            : key === "brands"
              ? { 
                ...base, 
                brand_id: businessId,
                brand_name: "", 
                brand_code: "" 
              }
              : key === "models"
                ? {
                    ...base,
                    model_id: businessId,
                    model_name: "",
                    model_code: "",
                    asset_id: "",
                  }
                : key === "locations"
                  ? {
                      ...base,
                      location_id: id,
                      location_name: "",
                      location_code: "",
                    }
                  : {
                      ...base,
                      tagColor: "#64748b",
                    },
    )
    setEditing(null)
  }

  const closeForm = () => {
    setEditing(undefined)
    setDraft(null)
  }

  const validation = getValidation(key, draft, master, editing ?? undefined)
  const visibleValidationErrors = creatingBackendRecord
    ? validation.errors.filter(
        (error) => error !== `${entityName[key]} ID already exists.`,
      )
    : validation.errors

  const updateDraft = (updates: Partial<MasterItem>) => {
    setDraft((value) => (value ? { ...value, ...updates } : value))
  }

  const changeGroupCategory = (categoryId: string) => {
    if (!draft) return
    const category = resolveCategoryById(master.categories, categoryId)
    updateDraft({
      category_id: getMasterInternalId(category),
      category_display_id: category?.display_id ?? category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      parent: category?.name ?? "",
    })
  }

  const changeTypeCategory = (categoryId: string) => {
    const category = resolveCategoryById(master.categories, categoryId)
    updateDraft({
      category_id: getMasterInternalId(category),
      category_display_id: category?.display_id ?? category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      group_id: "",
      group_name: "",
      group_code: "",
      parent: "",
    })
  }

  const changeTypeGroup = (groupId: string) => {
    const group = resolveGroupById(master.groups, groupId)
    const category = resolveCategoryById(
      master.categories,
      String(group?.category_id ?? ""),
    )
    if (
      group &&
      draft?.category_id &&
      group.category_id !== draft.category_id
    )
      return
    updateDraft({
      group_id: getMasterInternalId(group),
      group_name: group?.name ?? "",
      group_code: group?.group_code ?? group?.code ?? "",
      category_id: getMasterInternalId(category),
      category_display_id:
        category?.display_id ?? category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      parent: group?.name ?? "",
    })
  }

  const changeBrandType = (typeId: string) => {
    const type = typeId ? resolveTypeById(master.types, typeId) : undefined
    updateDraft({
      type_id: type ? getMasterInternalId(type) : "",
      type_name: type?.name ?? "",
      type_display_id: type?.display_id ?? type?.type_id ?? "",
      parent: type?.name ?? "",
    })
  }

  const changeModelCategory = (categoryId: string) => {
    const category = resolveCategoryById(master.categories, categoryId)
    updateDraft({
      category_id: getMasterInternalId(category),
      category_display_id: category?.display_id ?? category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      group_id: "",
      group_name: "",
      group_code: "",
      type_id: "",
      type_name: "",
      type_code: "",
      brand_id: "",
      brand_name: "",
      brand_code: "",
      asset_id: "",
    })
  }

  const changeModelGroup = (groupId: string) => {
    const group = resolveGroupById(master.groups, groupId)
    const category = resolveCategoryById(
      master.categories,
      String(group?.category_id ?? ""),
    )
    if (!group || !category || (draft?.category_id && category.id !== draft.category_id))
      return
    updateDraft({
      category_id: getMasterInternalId(category),
      category_display_id: category.display_id ?? category.category_id ?? "",
      category_name: category.name,
      category_code: category.category_code ?? category.code,
      group_id: getMasterInternalId(group),
      group_name: group?.name ?? "",
      group_code: group?.group_code ?? group?.code ?? "",
      type_id: "",
      type_name: "",
      type_code: "",
      brand_id: "",
      brand_name: "",
      brand_code: "",
      asset_id: "",
    })
  }

  const changeModelType = (typeId: string) => {
    const type = resolveTypeById(master.types, typeId)
    const group = type
      ? resolveGroupById(master.groups, String(type.group_id ?? ""))
      : undefined
    const category = group
      ? resolveCategoryById(master.categories, String(group.category_id ?? ""))
      : undefined
    const currentBrand = resolveBrandById(
      master.brands,
      String(draft?.brand_id ?? ""),
    )
    const brand =
      currentBrand &&
      (!currentBrand.type_id || currentBrand.type_id === type?.id)
        ? currentBrand
        : undefined
    updateDraft({
      category_id: getMasterInternalId(category),
      category_display_id: category?.display_id ?? category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      group_id: getMasterInternalId(group),
      group_name: group?.name ?? "",
      group_code: group?.group_code ?? group?.code ?? "",
      type_id: getMasterInternalId(type),
      type_name: type?.name ?? "",
      type_code: type?.type_code ?? type?.code ?? "",
      brand_id: getMasterInternalId(brand),
      brand_name: brand?.name ?? "",
      brand_code: brand?.brand_code ?? brand?.code ?? "",
      asset_id: generateAssetId(category, group, type, brand),
    })
  }

  const changeModelBrand = (brandId: string) => {
    const brand = resolveBrandById(master.brands, brandId)
    const type = resolveTypeById(
      master.types,
      String(draft?.type_id ?? ""),
    )
    if (brand?.type_id && brand.type_id !== type?.id) {
      notify("This Brand is assigned to a different Type.")
      return
    }
    const group = type
      ? resolveGroupById(master.groups, String(type.group_id ?? ""))
      : undefined
    const category = group
      ? resolveCategoryById(master.categories, String(group.category_id ?? ""))
      : undefined
    updateDraft({
      brand_id: getMasterInternalId(brand),
      brand_name: brand?.name ?? "",
      brand_code: brand?.brand_code ?? brand?.code ?? "",
      asset_id: generateAssetId(category, group, type, brand),
    })
  }

  const changeRelatedModel = (modelId: string) => {
    const model = master.models.find(
      (item) => item.id === modelId || item.model_id === modelId,
    )
    updateDraft({
      model_id: model?.id ?? "",
      model_name: model?.name ?? "",
      brand_id: model?.brand_id ?? "",
      brand_name: model?.brand_name ?? "",
      asset_id: model?.asset_id ?? "",
    })
  }

  const changeTab = (value: string) => {
    setTab(value)
    setSearch("")
    setCategoryFilter("")
    setPage(1)
    closeForm()
  }

  const handleSave = async () => {
    if (!draft) return
    if (!creatingBackendRecord && !validation.valid) return
    const allowed = editing
      ? canManageExisting(currentUser)
      : canCreateInModule(currentUser, "master-data")
    if (!allowed) {
      notify(
        editing
          ? "You do not have permission to edit master data."
          : "You do not have permission to create master data.",
      )
      return
    }
    if (!isBackendMasterData) {
      const relationshipErrors = getRelationshipChangeErrors(
        key,
        draft,
        master,
        assets,
        editing ?? undefined,
      )
      if (relationshipErrors.length) {
        notify(relationshipErrors.join(" "))
        return
      }
      if (saveMaster(key, draft)) closeForm()
      return
    }

    setSaving(true)
    const maxAttempts = creatingBackendRecord ? 3 : 1
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let itemToSave = draft
      let masterToValidate = master

      if (creatingBackendRecord) {
        const latest = await refreshMasterDataSnapshot(currentUser.id)
        if (!latest.success) {
          notify(latest.error)
          setSaving(false)
          return
        }
        masterToValidate = { ...master, ...toMasterItems(latest.data) }
        itemToSave = withGeneratedBusinessId(
          key,
          draft,
          generateMasterId(masterToValidate[key], key),
          generateMasterInternalId(masterToValidate[key], key),
        )
        setDraft(itemToSave)

        const currentValidation = getValidation(
          key,
          itemToSave,
          masterToValidate,
        )
        if (!currentValidation.valid) {
          notify(currentValidation.errors.join(" "))
          setSaving(false)
          return
        }
      }

      const relationshipErrors = getRelationshipChangeErrors(
        key,
        itemToSave,
        masterToValidate,
        assets,
        editing ?? undefined,
      )
      if (relationshipErrors.length) {
        notify(relationshipErrors.join(" "))
        setSaving(false)
        return
      }

      const result = await saveBackendMasterRecord(
        key,
        itemToSave,
        editing?.id,
      )
      if (result.success) {
        invalidateMasterDataCache()
        const refreshed = await refreshMasterData()
        notify(
          refreshed
            ? `${entityName[key]} ${editing ? "updated" : "created"}.`
            : `${entityName[key]} ${editing ? "updated" : "created"}, but the list could not be refreshed.`,
        )
        closeForm()
        setSaving(false)
        return
      }
      if (creatingBackendRecord && result.status === 409) {
        if (attempt + 1 < maxAttempts) continue
        notify(
          "Could not allocate a unique ID after multiple conflicts. Please try again.",
        )
        setSaving(false)
        return
      }

      notify(result.error)
      setSaving(false)
      return
    }
  }

  const handleDelete = async () => {
    if (!deleting || deletingRemote) return
    if (!isBackendMasterData) {
      deleteMaster(key, deleting.id)
      setDeleting(null)
      return
    }
    if (!canDelete(currentUser)) {
      notify("Hanya Admin yang dapat melakukan penghapusan data.")
      setDeleting(null)
      return
    }
    const references = getClassificationReferences(
      key,
      deleting,
      master,
      assets,
    )
    if (references.length) {
      notify(
        `Cannot delete ${entityName[key]}: it is still referenced by ${references.join(", ")}.`,
      )
      setDeleting(null)
      return
    }

    setDeletingRemote(true)
    const result = await deleteBackendMasterRecord(key, deleting.id)
    if (!result.success) {
      notify(result.error)
      setDeletingRemote(false)
      return
    }

    reserveMasterInternalId(key, deleting.id)
    invalidateMasterDataCache()
    const refreshed = await refreshMasterData()
    notify(
      refreshed
        ? `${entityName[key]} berhasil dihapus.`
        : `${entityName[key]} berhasil dihapus, tetapi daftar belum dapat diperbarui.`,
    )
    setDeleting(null)
    setDeletingRemote(false)
  }

  if (key === "conditions")
    return (
      <ConditionStatusManagement
        tabs={Object.keys(tabs)}
        activeTab={tab}
        onTabChange={changeTab}
      />
    )

  if (key === "businessUnits")
    return (
      <BusinessUnitManagement
        tabs={Object.keys(tabs)}
        activeTab={tab}
        onTabChange={changeTab}
      />
    )

  return (
    <div className="page">
      <PageHeader
        title="Master Data"
        subtitle="Manage classification records, relationships, and generated identifiers."
        actions={
          <Button
            disabled={!createAllowed || (isBackendMasterData && !backendReady)}
            onClick={() => openEdit()}
          >
            <Plus size={16} /> Add New
          </Button>
        }
      />
      <Tabs items={Object.keys(tabs)} active={tab} onChange={changeTab} />
      {masterDataError && isBackendMasterData && (
        <div className="error-summary" role="alert">
          <span>{masterDataError}</span>
          <Button
            variant="secondary"
            disabled={masterDataRefreshing}
            onClick={() => void refreshMasterData()}
          >
            {masterDataRefreshing ? "Refreshing..." : "Retry"}
          </Button>
        </div>
      )}
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder={`Search ${tab.toLowerCase()} by ID, name, or code...`}
        />
        {key === "groups" && (
          <Select
            aria-label="Filter Groups by Category"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value)
              setPage(1)
            }}
            options={[
              { value: "", label: "All Categories" },
              ...master.categories.map((category) => ({
                value: getMasterInternalId(category),
                label: `${category.name} (${category.code})`,
              })),
            ]}
          />
        )}
        <span className="record-count">
          {isBackendMasterData && masterDataStatus === "loading"
            ? "Loading..."
            : masterDataRefreshing
              ? "Syncing..."
              : `${rows.length} records`}
        </span>
      </div>
      <section className="table-card">
        <div className="table-scroll">
          {isBackendMasterData && masterDataStatus !== "ready" ? (
            <EmptyState
              title={
                masterDataStatus === "error"
                  ? "Master data gagal dimuat"
                  : "Memuat master data..."
              }
              description={
                masterDataStatus === "error"
                  ? "Periksa koneksi atau sesi Anda, lalu coba muat ulang."
                  : "Mengambil seluruh data terbaru dari server."
              }
            />
          ) : (
            <>
              <MasterTable
                masterKey={key}
                rows={visibleRows}
                assets={assets}
                conditions={master.conditions}
                page={page}
                pageSize={pageSize}
                allowEdit
                onEdit={openEdit}
                onDelete={setDeleting}
              />
              {!visibleRows.length && <EmptyState />}
            </>
          )}
        </div>
        {(!isBackendMasterData || masterDataStatus === "ready") && (
          <Pagination
            page={page}
            pages={pages}
            onChange={setPage}
            total={rows.length}
            from={(page - 1) * pageSize + 1}
            to={Math.min(page * pageSize, rows.length)}
          />
        )}
      </section>
      <Modal
        open={editing !== undefined && !!draft}
        title={`${editing ? "Edit" : "Add"} ${entityName[key]}`}
        description="Generated identifiers are read-only; related records use internal IDs."
        onClose={closeForm}
        wide={key === "models" || key === "locations"}
      >
        {draft && (
          <>
            {visibleValidationErrors.length > 0 && (
              <div className="error-summary">
                <strong>Please review the form</strong>
                {visibleValidationErrors.map((error) => (
                  <span key={error}>{error}</span>
                ))}
              </div>
            )}
            <div className="form-grid master-form">
              <MasterFormFields
                masterKey={key}
                draft={draft}
                master={master}
                updateDraft={updateDraft}
                changeGroupCategory={changeGroupCategory}
                changeTypeCategory={changeTypeCategory}
                changeTypeGroup={changeTypeGroup}
                changeBrandType={changeBrandType}
                changeModelCategory={changeModelCategory}
                changeModelGroup={changeModelGroup}
                changeModelType={changeModelType}
                changeModelBrand={changeModelBrand}
                changeRelatedModel={changeRelatedModel}
              />
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                disabled={visibleValidationErrors.length > 0 || saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="Record yang masih direferensikan oleh master data atau aset lain tidak dapat dihapus."
        danger
        confirmLabel={deletingRemote ? "Deleting..." : "Delete"}
        onClose={() => {
          if (!deletingRemote) setDeleting(null)
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

function getValidation(
  key: MasterKey,
  draft: MasterItem | null,
  master: Record<string, MasterItem[]>,
  original?: MasterItem,
) {
  if (!draft) return { valid: false, errors: [] as string[] }
  if (key === "categories") return validateCategory(draft, master.categories)
  if (key === "groups")
    return validateGroup(draft, master.groups, master.categories)

  const errors: string[] = []
  if (!draft.name.trim()) errors.push(`${entityName[key]} name is required.`)
  if (key !== "models" && !draft.code.trim())
    errors.push(`${entityName[key]} code is required.`)
  const businessId = String(draft.display_id ?? draft[idField[key]] ?? "")
  const idPattern = {
    types: /^t\d{4}$/,
    brands: /^b\d{4}$/,
    models: /^m\d{4}$/,
  }[key as "types" | "brands" | "models"]
  if (idPattern && !idPattern.test(businessId))
    errors.push(`${entityName[key]} ID must use its generated format.`)
  if (
    master[key].some(
      (item) =>
        item.id !== draft.id &&
        item.name.trim().toLocaleLowerCase() ===
          draft.name.trim().toLocaleLowerCase() &&
        (key !== "models" || item.brand_id === draft.brand_id),
    )
  )
    errors.push(`${entityName[key]} name already exists.`)
  if (
    master[key].some(
      (item) =>
        item.id !== draft.id &&
        (item.display_id ?? item[idField[key]]) === businessId,
    )
  )
    errors.push(`${entityName[key]} ID already exists.`)
  if (
    key !== "models" &&
    master[key].some(
      (item) =>
        item.id !== draft.id &&
        item.code.trim().toLocaleLowerCase() ===
          draft.code.trim().toLocaleLowerCase(),
    )
  )
    errors.push(`${entityName[key]} code already exists.`)
  if (key === "types") {
    const group = resolveGroupById(master.groups, String(draft.group_id ?? ""))
    const category = resolveCategoryById(
      master.categories,
      String(draft.category_id ?? ""),
    )
    if (!category || !group) errors.push("Select a valid Category and Group.")
    else if (group.category_id !== category.id)
      errors.push("The selected Group does not belong to this Category.")
  }
  if (key === "brands" && draft.type_id) {
    if (!resolveTypeById(master.types, draft.type_id))
      errors.push("Select a valid Type or leave Type empty.")
  }
  if (key === "models") {
    const category = resolveCategoryById(
      master.categories,
      String(draft.category_id ?? ""),
    )
    const group = resolveGroupById(
      master.groups,
      String(draft.group_id ?? ""),
    )
    const type = resolveTypeById(master.types, String(draft.type_id ?? ""))
    const brand = resolveBrandById(master.brands, String(draft.brand_id ?? ""))
    if (!category || !group || !type || !brand)
      errors.push("Select a valid Category, Group, Type, and Brand.")
    else {
      if (group.category_id !== category.id)
        errors.push("The selected Group does not belong to this Category.")
      if (type.category_id !== category.id || type.group_id !== group.id)
        errors.push("The selected Type does not belong to this Group.")
      if (brand.type_id && brand.type_id !== type.id)
        errors.push("The selected Brand is assigned to a different Type.")
      const expectedAssetId = generateAssetId(category, group, type, brand)
      if (!expectedAssetId || draft.asset_id !== expectedAssetId)
        errors.push("Asset ID must match the selected classification codes.")
      if (
        expectedAssetId &&
        expectedAssetId !== original?.asset_id &&
        master.models.some(
          (item) => item.id !== draft.id && item.asset_id === expectedAssetId,
        )
      )
        errors.push("This generated Asset ID already exists.")
    }
  }
  return { valid: errors.length === 0, errors }
}

type FormProps = {
  masterKey: MasterKey
  draft: MasterItem
  master: Record<string, MasterItem[]>
  updateDraft: (updates: Partial<MasterItem>) => void
  changeGroupCategory: (id: string) => void
  changeTypeCategory: (id: string) => void
  changeTypeGroup: (id: string) => void
  changeBrandType: (id: string) => void
  changeModelCategory: (id: string) => void
  changeModelGroup: (id: string) => void
  changeModelType: (id: string) => void
  changeModelBrand: (id: string) => void
  changeRelatedModel: (id: string) => void
}

function MasterFormFields({
  masterKey,
  draft,
  master,
  updateDraft,
  changeGroupCategory,
  changeTypeCategory,
  changeTypeGroup,
  changeBrandType,
  changeModelCategory,
  changeModelGroup,
  changeModelType,
  changeModelBrand,
  changeRelatedModel,
}: FormProps) {
  const idLabel = `${entityName[masterKey]} ID`
  const nameLabel = `${entityName[masterKey]} Name *`
  const codeLabel =
    masterKey === "locations"
      ? "Kode Lokasi *"
      : `${entityName[masterKey]} Code${masterKey === "models" ? "" : " *"}`
  const changeName = (name: string) => {
    if (masterKey === "categories") {
      const code = generateCategoryCode(name)
      updateDraft({
        name,
        category_name: name,
        category_code: code,
        code,
        prefix: code,
        category_prefix: code,
      })
      return
    }
    const updates: Partial<MasterItem> = { name }
    if (masterKey === "groups") {
      updates.group_name = name
      updates.group_code = generateGroupCode(name)
      updates.code = updates.group_code
      updates.prefix = updates.group_code
    }
    if (masterKey === "types") {
      updates.type_name = name
      updates.type_code = generateClassificationCode(name)
      updates.code = updates.type_code
      updates.prefix = updates.type_code
    }
    if (masterKey === "brands") {
      updates.brand_name = name
      updates.brand_code = generateClassificationCode(name)
      updates.code = updates.brand_code
      updates.prefix = updates.brand_code
    }
    if (masterKey === "models") updates.model_name = name
    if (masterKey === "locations") updates.location_name = name
    updateDraft(updates)
  }
  const changeCode = (code: string) => {
    const next = code.toUpperCase()
    const updates: Partial<MasterItem> = { code: next }
    if (masterKey === "categories") {
      updates.category_code = next
      updates.category_prefix = next
      updates.prefix = next
    }
    if (masterKey === "groups") {
      updates.group_code = next
      updates.group_prefix = next
      updates.prefix = next
    }
    if (masterKey === "types") {
      updates.type_code = next
      updates.prefix = next
    }
    if (masterKey === "brands") {
      updates.brand_code = next
      updates.prefix = next
    }
    if (masterKey === "models") updates.model_code = next
    if (masterKey === "locations") updates.location_code = next
    updateDraft(updates)
  }

  return (
    <>
      <Input
        label={idLabel}
        value={draft.display_id ?? String(draft[idField[masterKey]] ?? draft.id)}
        readOnly
      />
      <Input
        autoFocus
        label={nameLabel}
        value={draft.name}
        onChange={(event) => changeName(event.target.value)}
      />
      {masterKey !== "models" && (
        <Input
          label={codeLabel}
          value={draft.code}
          maxLength={5}
          onChange={(event) => changeCode(event.target.value)}
        />
      )}

      {masterKey === "groups" && (
        <>
          <Select
            label="Category *"
            value={draft.category_id ?? ""}
            onChange={(event) => changeGroupCategory(event.target.value)}
            options={[
              { value: "", label: "Select category" },
              ...master.categories.map((item) => ({
                value: getMasterInternalId(item),
                label: `${item.name} (${item.code})`,
              })),
            ]}
          />
          <Input
            label="Category Name"
            value={draft.category_name ?? ""}
            readOnly
          />
          <Input
            label="Category Code"
            value={draft.category_code ?? ""}
            readOnly
          />
        </>
      )}

      {masterKey === "types" && (
        <>
          <Select
            label="Category *"
            value={draft.category_id ?? ""}
            onChange={(event) => changeTypeCategory(event.target.value)}
            options={[
              { value: "", label: "Select category" },
              ...master.categories.map((item) => ({
                value: getMasterInternalId(item),
                label: `${item.name} (${item.code})`,
              })),
            ]}
          />
          <Select
            label="Group *"
            value={draft.group_id ?? ""}
            disabled={!draft.category_id}
            onChange={(event) => changeTypeGroup(event.target.value)}
            options={[
              { value: "", label: "Select group" },
              ...master.groups
                .filter((item) => item.category_id === draft.category_id)
                .map((item) => ({
                value: getMasterInternalId(item),
                label: `${item.name} · ${item.category_name}`,
                })),
            ]}
          />
          <Input
            label="Category Name"
            value={draft.category_name ?? ""}
            readOnly
          />
          <Input
            label="Category Code"
            value={draft.category_code ?? ""}
            readOnly
          />
          <Input label="Group Name" value={draft.group_name ?? ""} readOnly />
          <Input label="Group Code" value={draft.group_code ?? ""} readOnly />
        </>
      )}

      {masterKey === "brands" && (
        <Select
          label="Type (optional)"
          value={draft.type_id ?? ""}
          onChange={(event) => changeBrandType(event.target.value)}
          options={[
            { value: "", label: "No type / Global brand" },
            ...master.types.map((item) => ({
              value: getMasterInternalId(item),
              label: `${item.name} (${item.code})`,
            })),
          ]}
        />
      )}

      {masterKey === "models" && (
        <>
          <Select
            label="Category *"
            value={draft.category_id ?? ""}
            onChange={(event) => changeModelCategory(event.target.value)}
            options={[
              { value: "", label: "Select category" },
              ...master.categories.map((item) => ({
                value: getMasterInternalId(item),
                label: `${item.name} (${item.code})`,
              })),
            ]}
          />
          <Select
            label="Group *"
            value={draft.group_id ?? ""}
            disabled={!draft.category_id}
            onChange={(event) => changeModelGroup(event.target.value)}
            options={[
              { value: "", label: "Select group" },
              ...master.groups
                .filter((item) => item.category_id === draft.category_id)
                .map((item) => ({
                  value: getMasterInternalId(item),
                  label: `${item.name} (${item.group_code ?? item.code})`,
                })),
            ]}
          />
          <Select
            label="Type *"
            value={draft.type_id ?? ""}
            disabled={!draft.group_id}
            onChange={(event) => changeModelType(event.target.value)}
            options={[
              { value: "", label: "Select type" },
              ...master.types
                .filter(
                  (item) =>
                    item.category_id === draft.category_id &&
                    item.group_id === draft.group_id,
                )
                .map((item) => ({
                  value: getMasterInternalId(item),
                  label: `${item.name} (${item.code})`,
                })),
            ]}
          />
          <Select
            label="Brand *"
            value={draft.brand_id ?? ""}
            disabled={!draft.type_id}
            onChange={(event) => changeModelBrand(event.target.value)}
            options={[
              { value: "", label: "Select brand" },
              ...master.brands
                .filter(
                  (item) =>
                    !item.type_id || item.type_id === draft.type_id,
                )
                .map((item) => ({
                  value: getMasterInternalId(item),
                  label: `${item.name} (${item.code})`,
                })),
            ]}
          />
          <Input
            label="Category Name"
            value={draft.category_name ?? ""}
            readOnly
          />
          <Input
            label="Group Name"
            value={draft.group_name ?? ""}
            readOnly
          />
          <Input label="Type Name" value={draft.type_name ?? ""} readOnly />
          <Input label="Brand Name" value={draft.brand_name ?? ""} readOnly />
          <Input
            label="Asset ID"
            value={draft.asset_id ?? ""}
            readOnly
          />
        </>
      )}

      {masterKey === "locations" && (
        <>
          <Input
            label="Business Unit / Nama"
            value={draft.business_unit ?? ""}
            onChange={(event) =>
              updateDraft({ business_unit: event.target.value })
            }
          />
          <Select
            label="Model"
            value={draft.model_id ?? ""}
            onChange={(event) => changeRelatedModel(event.target.value)}
            options={[
              { value: "", label: "No related model" },
              ...master.models.map((item) => ({
                value: getMasterInternalId(item),
                label: `${item.name} · ${item.brand_name}`,
              })),
            ]}
          />
          <Input label="Brand" value={draft.brand_name ?? ""} readOnly />
          <Input label="Asset ID" value={draft.asset_id ?? ""} readOnly />
        </>
      )}

      {masterKey === "locations" && (
        <Select
          label="Kondisi"
          value={draft.condition_id ?? ""}
          onChange={(event) => {
            const conditionId = event.target.value
            const condition = master.conditions.find(
              (item) => item.id === conditionId,
            )
            updateDraft({
              condition_id: condition?.id ?? "",
              condition_name: condition?.name ?? "",
            })
          }}
          options={[
            { value: "", label: "Select condition" },
            ...master.conditions.map((item) => ({
              value: item.id,
              label: `${item.name} (${item.code})`,
            })),
          ]}
        />
      )}

      {masterKey === "conditions" && (
        <Select
          label="Lokasi"
          value={draft.location_id ?? ""}
          onChange={(event) => {
            const locationId = event.target.value
            const location = master.locations.find(
              (item) => (item.location_id ?? item.id) === locationId,
            )
            updateDraft({
              location_id: location?.location_id ?? "",
              location_name: location?.name ?? "",
            })
          }}
          options={[
            { value: "", label: "Select location" },
            ...master.locations.map((item) => ({
              value: item.location_id ?? item.id,
              label: `${item.name} (${item.code})`,
            })),
          ]}
        />
      )}
    </>
  )
}

type TableProps = {
  masterKey: MasterKey
  rows: MasterItem[]
  assets: Asset[]
  conditions: MasterItem[]
  page: number
  pageSize: number
  allowEdit: boolean
  onEdit: (item: MasterItem) => void
  onDelete: (item: MasterItem) => void
}

function MasterTable(props: TableProps) {
  if (props.masterKey === "categories") return <CategoryTable {...props} />
  if (props.masterKey === "groups") return <GroupTable {...props} />
  if (props.masterKey === "types") return <TypeTable {...props} />
  if (props.masterKey === "brands") return <BrandTable {...props} />
  if (props.masterKey === "models") return <ModelTable {...props} />
  if (props.masterKey === "locations") return <LocationTable {...props} />
  return <EmptyState title="Use the combined Condition & Status view." />
}

function CategoryTable({
  rows,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Category ID</th>
          <th>Category Name</th>
          <th>Category Code</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={item.id}>
            <NumberCell page={page} pageSize={pageSize} index={index} />
            <CodeCell
              value={item.display_id ?? item.category_id ?? item.id}
            />
            <NameCell value={item.name} />
            <CodeCell
              value={item.prefix ?? item.category_code ?? item.code}
            />
            <ActionCell
              item={item}
              allowEdit={allowEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GroupTable({
  rows,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Group ID</th>
          <th>Group Name</th>
          <th>Group Code</th>
          <th>Category Name</th>
          <th>Category Code</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={item.id}>
            <NumberCell page={page} pageSize={pageSize} index={index} />
            <CodeCell value={item.display_id ?? item.group_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.prefix ?? item.group_code ?? item.code} />
            <TextCell value={item.category_name} />
            <CodeCell value={item.category_prefix ?? item.category_code} />
            <ActionCell
              item={item}
              allowEdit={allowEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TypeTable({
  rows,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Type ID</th>
          <th>Type Name</th>
          <th>Type Code</th>
          <th>Category Name</th>
          <th>Category Code</th>
          <th>Group Name</th>
          <th>Group Code</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={item.id}>
            <NumberCell page={page} pageSize={pageSize} index={index} />
            <CodeCell value={item.display_id ?? item.type_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.prefix ?? item.type_code ?? item.code} />
            <TextCell value={item.category_name} />
            <CodeCell value={item.category_code} />
            <TextCell value={item.group_name} />
            <CodeCell value={item.group_code} />
            <ActionCell
              item={item}
              allowEdit={allowEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BrandTable({
  rows,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Brand ID</th>
          <th>Brand Name</th>
          <th>Brand Code</th>
          <th>Type Code</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={item.id}>
            <NumberCell page={page} pageSize={pageSize} index={index} />
            <CodeCell value={item.display_id ?? item.brand_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.prefix ?? item.brand_code ?? item.code} />
            <CodeCell value={item.type_code || undefined} />
            <ActionCell
              item={item}
              allowEdit={allowEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ModelTable({
  rows,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Model ID</th>
          <th>Nama Model / Spesifikasi</th>
          <th>Brand</th>
          <th>Tipe</th>
          <th>Group</th>
          <th>Category</th>
          <th>Asset ID</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={item.id}>
            <NumberCell page={page} pageSize={pageSize} index={index} />
            <CodeCell
              value={item.display_id ?? item.model_id ?? item.id}
            />
            <NameCell value={item.name} />
            <TextCell value={item.brand_name} />
            <TextCell value={item.type_name} />
            <TextCell value={item.group_name} />
            <TextCell value={item.category_name} />
            <CodeCell value={item.asset_id} />
            <ActionCell
              item={item}
              allowEdit={allowEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LocationTable({
  rows,
  assets,
  conditions,
  page,
  pageSize,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Lokasi</th>
          <th>Kode Lokasi</th>
          <th>Nama</th>
          <th>Model</th>
          <th>Brand</th>
          <th>Kondisi</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => {
          const asset = assets.find(
            (candidate) => candidate.location === item.name,
          )
          const condition = item.condition_name ?? asset?.condition
          return (
            <tr key={item.id}>
              <NumberCell page={page} pageSize={pageSize} index={index} />
              <NameCell value={item.location_name ?? item.name} />
              <CodeCell value={item.location_code ?? item.code} />
              <TextCell value={item.business_unit ?? asset?.businessUnit} />
              <TextCell value={item.model_name ?? asset?.model} />
              <TextCell value={item.brand_name ?? asset?.brand} />
              <td>
                {condition ? (
                  <ConditionBadge
                    condition={condition}
                    color={
                      conditions.find(
                        (candidate) => candidate.name === condition,
                      )?.tagColor
                    }
                  />
                ) : (
                  "—"
                )}
              </td>
              <ActionCell
                item={item}
                allowEdit={allowEdit}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function NumberCell({
  page,
  pageSize,
  index,
}: {
  page: number
  pageSize: number
  index: number
}) {
  return <td className="numeric">{(page - 1) * pageSize + index + 1}</td>
}

function TextCell({ value }: { value?: string }) {
  return <td>{value || "—"}</td>
}

function NameCell({ value }: { value?: string }) {
  return (
    <td>
      <strong>{value || "—"}</strong>
    </td>
  )
}

function CodeCell({ value }: { value?: string }) {
  return (
    <td>
      <code>{value || "—"}</code>
    </td>
  )
}

function ActionCell({
  item,
  allowEdit,
  onEdit,
  onDelete,
}: {
  item: MasterItem
  allowEdit: boolean
  onEdit: (item: MasterItem) => void
  onDelete: (item: MasterItem) => void
}) {
  const { currentUser } = useAuth()
  const allowed = canDelete(currentUser)
  const canEdit = allowEdit && canManageExisting(currentUser)
  return (
    <td>
      <div className="row-actions">
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
            <Edit3 size={14} /> Edit
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${item.name}`}
          aria-disabled={!allowed}
          title={
            allowed ? `Delete ${item.name}` : "Only Admin can delete data."
          }
          className={!allowed ? "restricted-action" : ""}
          onClick={() => onDelete(item)}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </td>
  )
}
