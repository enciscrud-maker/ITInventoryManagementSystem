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
import { invalidateMasterDataCache } from "@/services/api/masterDataCache"
import type { ApiResult } from "@/lib/api/types"
import type { Asset, MasterItem } from "@/data/demoData"
import {
  createCategoryRecord,
  createGroupRecord,
  generateAssetId,
  generateGroupCode,
  generateMasterId,
  resolveBrandById,
  resolveCategoryById,
  resolveGroupById,
  resolveTypeById,
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
  "Condition / Status": "conditions",
}

const idField: Record<MasterKey, keyof MasterItem> = {
  categories: "category_id",
  groups: "group_id",
  types: "type_id",
  brands: "brand_id",
  models: "model_id",
  businessUnits: "id",
  locations: "location_id",
  conditions: "condition_id",
}

const entityName: Record<MasterKey, string> = {
  categories: "Category",
  groups: "Group",
  types: "Type",
  brands: "Brand",
  models: "Model",
  businessUnits: "Business Unit",
  locations: "Location",
  conditions: "Condition / Status",
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

async function createBackendMasterRecord(
  key: MasterKey,
  draft: MasterItem,
): Promise<ApiResult<unknown>> {
  const active = draft.active !== false
  const name = draft.name.trim()
  const code = draft.code.trim()

  if (key === "categories") {
    return categoriesApi.create({
      catName: name,
      catCode: code,
      catPrefix: code,
      isActive: active,
    })
  }
  if (key === "groups") {
    const catId = relatedId(draft.category_id)
    if (!catId) return invalidRelationship()
    return assetGroupsApi.create({
      catId,
      groupName: name,
      groupCode: draft.group_code ?? code,
      groupPrefix: draft.group_code ?? code,
      isActive: active,
    })
  }
  if (key === "types") {
    const groupId = relatedId(draft.group_id)
    const catId = relatedId(draft.category_id)
    if (!groupId || !catId) return invalidRelationship()
    return assetTypesApi.create({
      groupId,
      catId,
      typeName: name,
      typeCode: draft.type_code ?? code,
      typePrefix: draft.type_code ?? code,
      isActive: active,
    })
  }
  if (key === "brands") {
    const typeId = draft.type_id ? relatedId(draft.type_id) : null
    if (draft.type_id && !typeId) return invalidRelationship()
    return brandsApi.create({
      typeId,
      brandName: name,
      brandCode: draft.brand_code ?? code,
      brandPrefix: draft.brand_code ?? code,
      isActive: active,
    })
  }
  if (key === "models") {
    const catId = relatedId(draft.category_id)
    const brandId = relatedId(draft.brand_id)
    const groupId = relatedId(draft.group_id)
    const typeId = relatedId(draft.type_id)
    if (!catId || !brandId || !groupId || !typeId) return invalidRelationship()
    return assetModelsApi.create({
      catId,
      brandId,
      groupId,
      typeId,
      modelName: name,
      modelCode: draft.model_code ?? code,
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

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return master[key].filter((item) => {
      const matchesSearch = Object.values(item)
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
    const id = generateMasterId(master[key], key)
    const base: MasterItem = {
      id,
      name: "",
      code: "",
      [idField[key]]: id,
      active: true,
    }
    setDraft(
      key === "categories"
        ? createCategoryRecord(id, "")
        : key === "groups"
          ? {
              ...base,
              group_id: id,
              group_name: "",
              group_code: "",
              category_id: "",
            }
          : key === "types"
            ? { 
              ...base, 
              type_id: id, 
              type_name: "", 
              type_code: "" 
            }
            : key === "brands"
              ? { 
                ...base, 
                brand_id: id, 
                brand_name: "", 
                brand_code: "" 
              }
              : key === "models"
                ? {
                    ...base,
                    model_id: id,
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
                      condition_id: id,
                      condition_name: "",
                      status_code: "",
                    },
    )
    setEditing(null)
  }

  const closeForm = () => {
    setEditing(undefined)
    setDraft(null)
  }

  const validation = getValidation(key, draft, master)

  const updateDraft = (updates: Partial<MasterItem>) => {
    setDraft((value) => (value ? { ...value, ...updates } : value))
  }

  const changeGroupCategory = (categoryId: string) => {
    if (!draft) return
    const category = resolveCategoryById(master.categories, categoryId)
    updateDraft({
      category_id: category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      parent: category?.name ?? "",
    })
  }

  const changeTypeGroup = (groupId: string) => {
    const group = resolveGroupById(master.groups, groupId)
    updateDraft({
      group_id: group?.group_id ?? "",
      group_name: group?.name ?? "",
      group_code: group?.group_code ?? group?.code ?? "",
      category_id: group?.category_id ?? "",
      category_name: group?.category_name ?? "",
      category_code: group?.category_code ?? "",
      parent: group?.name ?? "",
    })
  }

  const changeBrandType = (typeId: string) => {
    const type = resolveTypeById(master.types, typeId)
    updateDraft({
      type_id: type?.type_id ?? "",
      type_name: type?.name ?? "",
      parent: type?.name ?? "",
    })
  }

  const updateModelHierarchy = (brandId: string, typeId: string) => {
    const brand = resolveBrandById(master.brands, brandId)
    const type = resolveTypeById(master.types, typeId)
    const group = resolveGroupById(master.groups, type?.group_id ?? "")
    const category = resolveCategoryById(
      master.categories,
      group?.category_id ?? "",
    )
    updateDraft({
      brand_id: brand?.brand_id ?? "",
      brand_name: brand?.name ?? "",
      brand_code: brand?.brand_code ?? brand?.code ?? "",
      type_id: type?.type_id ?? "",
      type_name: type?.name ?? "",
      type_code: type?.type_code ?? type?.code ?? "",
      group_id: group?.group_id ?? "",
      group_name: group?.name ?? "",
      group_code: group?.group_code ?? group?.code ?? "",
      category_id: category?.category_id ?? "",
      category_name: category?.name ?? "",
      category_code: category?.category_code ?? category?.code ?? "",
      parent: brand?.name ?? "",
      asset_id: generateAssetId(category, group, type, brand),
    })
  }

  const changeRelatedModel = (modelId: string) => {
    const model = master.models.find(
      (item) => (item.model_id ?? item.id) === modelId,
    )
    updateDraft({
      model_id: model?.model_id ?? "",
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
    if (!draft || !validation.valid) return
    if (!isBackendMasterData) {
      saveMaster(key, draft)
      closeForm()
      return
    }

    setSaving(true)
    const result = await createBackendMasterRecord(key, draft)
    if (!result.success) {
      notify(result.error)
      setSaving(false)
      return
    }

    invalidateMasterDataCache()
    const refreshed = await refreshMasterData()
    notify(
      refreshed
        ? `${entityName[key]} berhasil dibuat.`
        : `${entityName[key]} berhasil dibuat, tetapi daftar belum dapat diperbarui.`,
    )
    closeForm()
    setSaving(false)
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

    setDeletingRemote(true)
    const result = await deleteBackendMasterRecord(key, deleting.id)
    if (!result.success) {
      notify(result.error)
      setDeletingRemote(false)
      return
    }

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
        subtitle="Kelola hierarki klasifikasi, referensi aset, dan ID otomatis dari satu tempat."
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
          placeholder={`Search ${tab.toLowerCase()}...`}
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
                value: category.category_id ?? category.id,
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
                page={page}
                pageSize={pageSize}
                allowEdit={!isBackendMasterData}
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
        description={
          editing
            ? "Perubahan relasi akan diterapkan pada record ini."
            : `ID ${draft?.id ?? ""} dibuat otomatis dari nomor terakhir.`
        }
        onClose={closeForm}
        wide={key === "models" || key === "locations" || key === "conditions"}
      >
        {draft && (
          <>
            {validation.errors.length > 0 && (
              <div className="error-summary">
                <strong>Please review the form</strong>
                {validation.errors.map((error) => (
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
                changeTypeGroup={changeTypeGroup}
                changeBrandType={changeBrandType}
                updateModelHierarchy={updateModelHierarchy}
                changeRelatedModel={changeRelatedModel}
              />
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                disabled={!validation.valid || saving}
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
) {
  if (!draft) return { valid: false, errors: [] as string[] }
  if (key === "categories") return validateCategory(draft, master.categories)
  if (key === "groups")
    return validateGroup(draft, master.groups, master.categories)

  const errors: string[] = []
  if (!draft.name.trim()) errors.push(`${entityName[key]} name is required.`)
  if (key !== "models" && !draft.code.trim())
    errors.push(`${entityName[key]} code is required.`)
  if (key === "types" && !draft.group_id) errors.push("Select a valid Group.")
  if (key === "models" && (!draft.brand_id || !draft.type_id))
    errors.push("Select a valid Brand and Type.")
  if (
    master[key].some(
      (item) =>
        item.id !== draft.id &&
        item.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
    )
  )
    errors.push(`${entityName[key]} name already exists.`)
  return { valid: errors.length === 0, errors }
}

type FormProps = {
  masterKey: MasterKey
  draft: MasterItem
  master: Record<string, MasterItem[]>
  updateDraft: (updates: Partial<MasterItem>) => void
  changeGroupCategory: (id: string) => void
  changeTypeGroup: (id: string) => void
  changeBrandType: (id: string) => void
  updateModelHierarchy: (brandId: string, typeId: string) => void
  changeRelatedModel: (id: string) => void
}

function MasterFormFields({
  masterKey,
  draft,
  master,
  updateDraft,
  changeGroupCategory,
  changeTypeGroup,
  changeBrandType,
  updateModelHierarchy,
  changeRelatedModel,
}: FormProps) {
  const idLabel = `${entityName[masterKey]} ID`
  const nameLabel = `${entityName[masterKey]} Name *`
  const codeLabel =
    masterKey === "conditions"
      ? "Status Code *"
      : masterKey === "locations"
        ? "Kode Lokasi *"
        : `${entityName[masterKey]} Code${masterKey === "models" ? "" : " *"}`
  const changeName = (name: string) => {
    if (masterKey === "categories") {
      const next = createCategoryRecord(draft.category_id ?? draft.id, name)
      updateDraft(next)
      return
    }
    const updates: Partial<MasterItem> = { name }
    if (masterKey === "groups") {
      updates.group_name = name
      updates.group_code = generateGroupCode(name)
      updates.code = updates.group_code
    }
    if (masterKey === "types") updates.type_name = name
    if (masterKey === "brands") updates.brand_name = name
    if (masterKey === "models") updates.model_name = name
    if (masterKey === "locations") updates.location_name = name
    if (masterKey === "conditions") updates.condition_name = name
    updateDraft(updates)
  }
  const changeCode = (code: string) => {
    const next = code.toUpperCase()
    const updates: Partial<MasterItem> = { code: next }
    if (masterKey === "groups") updates.group_code = next
    if (masterKey === "types") updates.type_code = next
    if (masterKey === "brands") updates.brand_code = next
    if (masterKey === "models") updates.model_code = next
    if (masterKey === "locations") updates.location_code = next
    if (masterKey === "conditions") updates.status_code = next
    updateDraft(updates)
  }

  return (
    <>
      <Input label={idLabel} value={draft.id} readOnly />
      <Input
        autoFocus
        label={nameLabel}
        value={draft.name}
        onChange={(event) => changeName(event.target.value)}
      />
      <Input
        label={codeLabel}
        value={draft.code}
        maxLength={5}
        readOnly={masterKey === "categories" || masterKey === "groups"}
        onChange={(event) => changeCode(event.target.value)}
      />

      {masterKey === "groups" && (
        <>
          <Select
            label="Category *"
            value={draft.category_id ?? ""}
            onChange={(event) => changeGroupCategory(event.target.value)}
            options={[
              { value: "", label: "Select category" },
              ...master.categories.map((item) => ({
                value: item.category_id ?? item.id,
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
            label="Group *"
            value={draft.group_id ?? ""}
            onChange={(event) => changeTypeGroup(event.target.value)}
            options={[
              { value: "", label: "Select group" },
              ...master.groups.map((item) => ({
                value: item.group_id ?? item.id,
                label: `${item.name} · ${item.category_name}`,
              })),
            ]}
          />
          <Input label="Category" value={draft.category_name ?? ""} readOnly />
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
              value: item.type_id ?? item.id,
              label: `${item.name} (${item.code})`,
            })),
          ]}
        />
      )}

      {masterKey === "models" && (
        <>
          <Select
            label="Brand *"
            value={draft.brand_id ?? ""}
            onChange={(event) =>
              updateModelHierarchy(event.target.value, draft.type_id ?? "")
            }
            options={[
              { value: "", label: "Select brand" },
              ...master.brands.map((item) => ({
                value: item.brand_id ?? item.id,
                label: `${item.name} (${item.code})`,
              })),
            ]}
          />
          <Select
            label="Type *"
            value={draft.type_id ?? ""}
            onChange={(event) =>
              updateModelHierarchy(draft.brand_id ?? "", event.target.value)
            }
            options={[
              { value: "", label: "Select type" },
              ...master.types.map((item) => ({
                value: item.type_id ?? item.id,
                label: `${item.name} · ${item.group_name}`,
              })),
            ]}
          />
          <Input label="Group" value={draft.group_name ?? ""} readOnly />
          <Input label="Category" value={draft.category_name ?? ""} readOnly />
          <Input
            label="Asset ID Prefix"
            value={draft.asset_id ?? ""}
            readOnly
          />
        </>
      )}

      {(masterKey === "locations" || masterKey === "conditions") && (
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
                value: item.model_id ?? item.id,
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
              (item) => (item.condition_id ?? item.id) === conditionId,
            )
            updateDraft({
              condition_id: condition?.condition_id ?? "",
              condition_name: condition?.name ?? "",
            })
          }}
          options={[
            { value: "", label: "Select condition" },
            ...master.conditions.map((item) => ({
              value: item.condition_id ?? item.id,
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
  return <ConditionTable {...props} />
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
            <td className="numeric">{(page - 1) * pageSize + index + 1}</td>
            <CodeCell value={item.category_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.category_code ?? item.code} />
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

function GroupTable({ rows, allowEdit, onEdit, onDelete }: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Group ID</th>
          <th>Group Name</th>
          <th>Group Code</th>
          <th>Category ID</th>
          <th>Category Name</th>
          <th>Category Code</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id}>
            <CodeCell value={item.group_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.group_code ?? item.code} />
            <CodeCell value={item.category_id} />
            <TextCell value={item.category_name} />
            <CodeCell value={item.category_code} />
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

function TypeTable({ rows, allowEdit, onEdit, onDelete }: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>ID Type</th>
          <th>Nama Type</th>
          <th>Code Type</th>
          <th>Group</th>
          <th>Category</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id}>
            <CodeCell value={item.type_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.type_code ?? item.code} />
            <TextCell value={item.group_name} />
            <TextCell value={item.category_name} />
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

function BrandTable({ rows, allowEdit, onEdit, onDelete }: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Brand ID</th>
          <th>Brand Name</th>
          <th>Brand Code</th>
          <th>Type ID</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id}>
            <CodeCell value={item.brand_id ?? item.id} />
            <NameCell value={item.name} />
            <CodeCell value={item.brand_code ?? item.code} />
            <CodeCell value={item.type_id} />
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

function ModelTable({ rows, allowEdit, onEdit, onDelete }: TableProps) {
  return (
    <table>
      <thead>
        <tr>
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
        {rows.map((item) => (
          <tr key={item.id}>
            <CodeCell value={item.model_id ?? item.id} />
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
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
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
        {rows.map((item) => {
          const asset = assets.find(
            (candidate) => candidate.location === item.name,
          )
          return (
            <tr key={item.id}>
              <NameCell value={item.location_name ?? item.name} />
              <CodeCell value={item.location_code ?? item.code} />
              <TextCell value={item.business_unit ?? asset?.businessUnit} />
              <TextCell value={item.model_name ?? asset?.model} />
              <TextCell value={item.brand_name ?? asset?.brand} />
              <TextCell value={item.condition_name ?? asset?.condition} />
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

function ConditionTable({
  rows,
  assets,
  allowEdit,
  onEdit,
  onDelete,
}: TableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Kondisi</th>
          <th>Status Code</th>
          <th>Nama Model</th>
          <th>Lokasi</th>
          <th>Brand</th>
          <th>Asset ID</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => {
          const asset = assets.find(
            (candidate) => candidate.condition === item.name,
          )
          return (
            <tr key={item.id}>
              <NameCell value={item.condition_name ?? item.name} />
              <CodeCell value={item.status_code ?? item.code} />
              <TextCell value={item.model_name ?? asset?.model} />
              <TextCell value={item.location_name ?? asset?.location} />
              <TextCell value={item.brand_name ?? asset?.brand} />
              <CodeCell value={item.asset_id ?? asset?.id} />
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
