"use client"

import { useMemo, useState } from "react"
import {
  Columns3,
  Download,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Upload,
  MapPin,
  Printer,
  Edit3,
} from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import { useAuth } from "@/auth/AuthContext"
import {
  canCreateInModule,
  canManageExisting,
} from "@/services/authorizationService"
import type { Asset, MasterItem } from "@/data/demoData"
import ConditionBadge from "@/components/ConditionBadge"
import { downloadCsv, today } from "@/utils/helpers"
import {
  getLocationsForBusinessUnit,
  getMasterInternalId,
} from "@/utils/masterData"
import { AssetForm } from "@/components/assets"
import {
  assetsApi,
  type AssetImportResult as ApiAssetImportResult,
} from "@/services/api/assets.api"
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui"

const allColumns = [
  "Asset ID",
  "Serial / Tag",
  "Category",
  "Group",
  "Type",
  "Brand",
  "Model",
  "Location",
  "Business Unit",
  "Asset Status",
  "Condition",
  "Quantity",
  "UOM",
  "Last Updated",
]
const columnKeys: Array<keyof Asset> = [
  "assetCode",
  "serial",
  "category",
  "group",
  "type",
  "brand",
  "model",
  "location",
  "businessUnit",
  "assetStatus",
  "condition",
  "quantity",
  "uom",
  "createdDt",
]
const typedFilterFields = [
  "assetCode",
  "assetPrefix",
  "serial",
  "tag",
  "id",
  "assetStatus",
  "po",
  "sap",
  "value",
  "quantity",
  "uom",
  "condition",
]
const numericFilterFields = ["value", "quantity"]
const filterLabels: Record<string, string> = {
  category: "Category",
  group: "Group",
  type: "Type",
  brand: "Brand",
  model: "Model",
  serial: "Serial Number (SN)",
  tag: "Asset Tag",
  assetCode: "Asset ID",
  location: "Location",
  businessUnit: "Business Unit",
  assetStatus: "Asset Status",
  po: "PO Number",
  sap: "SAP Material ID",
  value: "Initial Value",
  quantity: "Quantity",
  uom: "UOM",
  condition: "Condition",
}
type SortState = {
  key: keyof Asset
  direction: 1 | -1
}

type AssetImportRow = Record<string, string>

type AssetImportResult = {
  row: number
  source: AssetImportRow
  asset?: Asset
  errors: string[]
}

const importHeaders = [
  "category_id",
  "brand_id",
  "group_id",
  "type_id",
  "asset_name",
  "asset_type",
  "asset_status",
  "asset_prefix",
] as const

const cleanImportRow = (row: Record<string, unknown>): AssetImportRow =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase(),
      String(value ?? "").trim(),
    ]),
  )

const findMasterReference = (
  items: MasterItem[],
  value: string,
  fields: Array<keyof MasterItem>,
) => {
  const target = value.trim().toLowerCase()
  return items.find((item) =>
    fields.some(
      (field) =>
        String(item[field] ?? "")
          .trim()
          .toLowerCase() === target,
    ),
  )
}

const resolveImportedAssetStatus = (value: string, statuses: MasterItem[]) => {
  const status = findMasterReference(statuses, value, ["id", "code", "name"])
  return status?.active === false ? "" : (status?.name ?? "")
}

const mapImportRow = ({
  row,
  index,
  master,
  businessUnit,
}: {
  row: AssetImportRow
  index: number
  master: Record<string, MasterItem[]>
  businessUnit: string
}): AssetImportResult => {
  const errors = importHeaders
    .filter((header) => !row[header])
    .map((header) => `missing ${header}`)
  const categoryCode = row.category_id ?? ""
  const groupCode = row.group_id ?? ""
  const typeCode = row.type_id ?? ""
  const brandCode = row.brand_id ?? ""
  const assetStatus = row.asset_status ?? ""
  const assetPrefix = row.asset_prefix ?? ""
  const assetName = row.asset_name ?? ""
  const assetType = row.asset_type ?? ""
  const category = findMasterReference(master.categories, categoryCode, [
    "id",
    "category_id",
    "code",
    "category_code",
  ])
  const group = findMasterReference(master.groups, groupCode, [
    "id",
    "group_id",
    "code",
    "group_code",
  ])
  const type = findMasterReference(master.types, typeCode, [
    "id",
    "type_id",
    "code",
    "type_code",
  ])
  const brand = findMasterReference(master.brands, brandCode, [
    "id",
    "brand_id",
    "code",
    "brand_code",
  ])
  const status = resolveImportedAssetStatus(
    assetStatus,
    master.assetStatuses ?? [],
  )
  const condition =
    master.conditions.find(
      (item) => item.name.trim().toLocaleLowerCase() === "good",
    )?.name ?? master.conditions[0]?.name
  const prefix = assetPrefix.trim().toUpperCase()

  if (categoryCode && !category)
    errors.push(`unknown category code "${categoryCode}"`)
  if (groupCode && !group) errors.push(`unknown group code "${groupCode}"`)
  if (typeCode && !type) errors.push(`unknown type code "${typeCode}"`)
  if (brandCode && !brand) errors.push(`unknown brand code "${brandCode}"`)
  if (
    category &&
    group &&
    group.category_id &&
    group.category_id !== getMasterInternalId(category)
  )
    errors.push("group does not belong to the selected category")
  if (
    group &&
    type &&
    type.group_id &&
    type.group_id !== getMasterInternalId(group)
  )
    errors.push("type does not belong to the selected group")
  if (type && brand?.type_id && brand.type_id !== getMasterInternalId(type))
    errors.push("brand does not belong to the selected type")
  if (assetStatus && !status)
    errors.push(`unknown asset_status "${assetStatus}"`)
  if (!condition) errors.push("no asset condition is configured")
  if (errors.length || !category || !group || !type || !brand || !condition)
    return { row: index + 2, source: row, errors }

  const targetUnit =
    master.businessUnits.find((unit) => unit.id === businessUnit) ??
    master.businessUnits[0]
  const defaultLocation = targetUnit
    ? getLocationsForBusinessUnit(master.locations, targetUnit.id)[0]
    : undefined
  if (!targetUnit || !defaultLocation)
    return {
      row: index + 2,
      source: row,
      errors: ["A Business Unit with at least one Location is required"],
    }
  return {
    row: index + 2,
    source: row,
    errors: [],
    asset: {
      id: "",
      assetPrefix: prefix,
      serial: `IMP-${prefix}`,
      tag: prefix,
      categoryId: getMasterInternalId(category),
      groupId: getMasterInternalId(group),
      typeId: getMasterInternalId(type),
      brandId: getMasterInternalId(brand),
      category: category.name,
      group: group.name,
      type: type.name,
      brand: brand.name,
      model: assetName,
      location: defaultLocation.name,
      locationId: defaultLocation.id,
      businessUnit: targetUnit.name,
      businessUnitId: targetUnit.id,
      condition,
      conditionId: master.conditions.find((item) => item.name === condition)
        ?.id,
      assetStatus: status,
      statusId: master.assetStatuses?.find((item) => item.name === status)?.id,
      quantity: 1,
      uom: "UNIT",
      updatedAt: today(),
      description: [assetName, assetType, `Imported status: ${assetStatus}`]
        .filter(Boolean)
        .join(" · "),
      demo: false,
    },
  }
}

export default function AssetInventory() {
  const {
    assets,
    master,
    businessUnit,
    refreshAssets,
    setSelectedAsset,
    notify,
    saveAsset,
  } = useInventory()
  const { currentUser } = useAuth()
  const createAllowed = canCreateInModule(currentUser, "asset-inventory")
  const manageAllowed = canManageExisting(currentUser, "asset-inventory")
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<SortState>({
    key: "createdDt",
    direction: -1,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState(allColumns)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [formAsset, setFormAsset] = useState<Asset | null | undefined>()
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveLocation, setMoveLocation] = useState("")
  const [moveBusinessUnitId, setMoveBusinessUnitId] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<AssetImportRow[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFileName, setImportFileName] = useState("")
  const [importFileError, setImportFileError] = useState("")
  const [importResult, setImportResult] = useState<ApiAssetImportResult | null>(
    null,
  )
  const [isImporting, setIsImporting] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const filterFields = [
    "category",
    "group",
    "type",
    "brand",
    "model",
    "assetCode",
    "serial",
    "tag",
    "assetStatus",
    "location",
    "businessUnit",
    "po",
    "sap",
    "value",
    "quantity",
    "uom",
    "condition",
  ]
  const selectedCategory = master.categories.find(
    (item) => item.name === filters.category,
  )
  const selectedGroup = master.groups.find(
    (item) => item.name === filters.group,
  )
  const selectedType = master.types.find((item) => item.name === filters.type)
  const selectedBrand = master.brands.find(
    (item) => item.name === filters.brand,
  )
  const availableGroups = master.groups.filter(
    (item) =>
      !selectedCategory ||
      item.category_id === getMasterInternalId(selectedCategory),
  )
  const availableTypes = master.types.filter(
    (item) =>
      !selectedGroup || item.group_id === getMasterInternalId(selectedGroup),
  )
  const availableBrands = master.brands.filter(
    (item) =>
      !selectedType ||
      !item.type_id ||
      item.type_id === getMasterInternalId(selectedType),
  )
  const availableModels = master.models.filter(
    (item) =>
      (!selectedType || item.type_id === getMasterInternalId(selectedType)) &&
      (!selectedBrand || item.brand_id === getMasterInternalId(selectedBrand)),
  )
  const uniqueValues = (key: keyof Asset) =>
    Array.from(new Set(assets.map((a) => String(a[key] ?? "")).filter(Boolean)))
  const options: Record<string, string[]> = {
    category: uniqueValues("category"),
    group: uniqueValues("group"),
    type: uniqueValues("type"),
    brand: uniqueValues("brand"),
    model: uniqueValues("model"),
    businessUnit: uniqueValues("businessUnit"),
    assetCode: uniqueValues("assetCode"),
    assetPrefix: uniqueValues("assetPrefix"),
    assetStatus: uniqueValues("assetStatus"),
    location: Array.from(
      new Set(
        assets
          .filter(
            (asset) =>
              businessUnit === "All Business Units" ||
              asset.businessUnitId === businessUnit,
          )
          .map((asset) => asset.location)
          .filter(Boolean),
      ),
    ),
    serial: uniqueValues("serial"),
    tag: uniqueValues("tag"),
    id: uniqueValues("id"),
    po: uniqueValues("po"),
    sap: uniqueValues("sap"),
    value: uniqueValues("value"),
    quantity: uniqueValues("quantity"),
    uom: uniqueValues("uom"),
    condition: uniqueValues("condition"),
  }
  const changeFilter = (key: string, value: string) => {
    setFilters((current) => {
      if (key === "category")
        return {
          ...current,
          category: value,
          group: "",
          type: "",
          brand: "",
          model: "",
        }
      if (key === "group")
        return {
          ...current,
          group: value,
          type: "",
          brand: "",
          model: "",
        }
      if (key === "type") {
        const brand = master.brands.find((item) => item.name === current.brand)
        const type = master.types.find((item) => item.name === value)
        const keepBrand =
          !brand?.type_id ||
          brand.type_id === (type ? getMasterInternalId(type) : "")
        return {
          ...current,
          type: value,
          brand: keepBrand ? current.brand : "",
          model: "",
        }
      }
      if (key === "brand") return { ...current, brand: value, model: "" }
      if (key === "businessUnit")
        return { ...current, businessUnit: value, location: "" }
      return { ...current, [key]: value }
    })
    setPage(1)
  }
  const filtered = useMemo(
    () =>
      assets
        .filter((a) => {
          const q = search.toLowerCase().split(/\s+/).filter(Boolean)
          const searchable = [
            a.category,
            a.group,
            a.type,
            a.brand,
            a.model,
            a.assetCode,
            a.assetPrefix,
            a.serial,
            a.tag,
            a.id,
            a.location,
            a.businessUnit,
            a.assetStatus,
            a.po,
            a.sap,
            a.value,
            a.quantity,
            a.uom,
            a.condition,
            a.assetId,
          ]
            .join(" ")
            .toLowerCase()
          return (
            (!q.length || q.every((word) => searchable.includes(word))) &&
            (businessUnit === "All Business Units" ||
              a.businessUnitId === businessUnit) &&
            Object.entries(filters).every(([k, v]) => {
              if (!v) return true
              const field = String(a[(k as keyof Asset)] ?? "")
              if (numericFilterFields.includes(k)) return field === v.trim()
              if (typedFilterFields.includes(k))
                return field.toLowerCase().includes(v.trim().toLowerCase())
              return field === v
            })
          )
        })
        .sort(
          (a, b) =>
            String(a[sort.key]).localeCompare(String(b[sort.key])) *
            sort.direction,
        ),
    [assets, search, businessUnit, filters, sort],
  )
  const pages = Math.ceil(filtered.length / pageSize)
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const toggleSort = (key: keyof Asset) =>
    setSort((s) => ({
      key,
      direction: s.key === key ? (s.direction * -1) as 1 | -1 : 1,
    }))
  const isVisible = (name: string) => visible.includes(name)
  const readFile = async (file?: File) => {
    if (!file) return
    setImportFileError("")
    setImportResult(null)
    setImportFile(file)
    setImportRows([])
    setImportFileName(file.name)
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) throw new Error("The workbook does not contain a sheet.")
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[firstSheet],
        { defval: "", raw: false },
      )
      if (!rows.length) throw new Error("No data rows were found in the file.")
      setImportRows(rows.map(cleanImportRow))
    } catch (error) {
      setImportFileError(
        error instanceof Error
          ? error.message
          : "The selected file could not be parsed.",
      )
    }
  }
  const importResults = useMemo(() => {
    return importRows.map((row, index) =>
      mapImportRow({
        row,
        index,
        master,
        businessUnit,
      }),
    )
  }, [importRows, master, businessUnit])
  const importErrors = importResults.filter((result) => result.errors.length)
  const validImports = importResults.flatMap((result) =>
    result.asset ? [result.asset] : [],
  )
  const exportAssets = (rows: Asset[]) =>
    rows.map((asset) => {
      const fields: Record<string, unknown> = { ...asset }
      delete fields.id
      delete fields.assetId
      delete fields.assetCode
      delete fields.assetPrefix
      return { "Asset ID": asset.assetCode ?? "", ...fields }
    })
  const commitImport = async () => {
    if (!importFile || !importRows.length) return
    setIsImporting(true)
    try {
      const result = await assetsApi.importFile(importFile)
      if (!result.success) {
        setImportFileError(result.error)
        return
      }
      setImportResult(result.data)
      const refreshed = await refreshAssets()
      notify(
        `${result.data.successCount} assets imported; ${result.data.failedCount} rows rejected${
          refreshed ? "" : ". Refresh inventory to load the imported records"
        }`,
      )
      setImportRows([])
      setImportFile(null)
    } finally {
      setIsImporting(false)
    }
  }
  return (
    <div className="page">
      <PageHeader
        title="Asset Inventory"
        subtitle={`Manage, search, and maintain IT asset records · ${filtered.length} matching records`}
        actions={
          <Button disabled={!createAllowed} onClick={() => setFormAsset(null)}>
            <Plus size={16} /> Add Asset
          </Button>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search all asset fields..."
        />
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter size={16} /> Filters{" "}
          {Object.values(filters).filter(Boolean).length > 0 && (
            <b>{Object.values(filters).filter(Boolean).length}</b>
          )}
        </Button>
        <div className="dropdown-wrap">
          <Button
            variant="secondary"
            onClick={() => setColumnsOpen(!columnsOpen)}
          >
            <Columns3 size={16} /> Columns
          </Button>
          {columnsOpen && (
            <div className="popover column-menu">
              {allColumns.map((c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={visible.includes(c)}
                    onChange={() =>
                      setVisible((v) =>
                        v.includes(c) ? v.filter((x) => x !== c) : [...v, c],
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={!createAllowed}
          onClick={() => {
            setImportOpen(true)
            setImportRows([])
            setImportFile(null)
            setImportFileName("")
            setImportFileError("")
            setImportResult(null)
          }}
        >
          <Upload size={16} /> Import
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv("asset-inventory.csv", exportAssets(filtered))
          }
        >
          <Download size={16} /> Export
        </Button>
        <IconButton
          label="Refresh"
          onClick={() =>
            void refreshAssets().then((refreshed) => {
              if (refreshed) notify("Inventory is up to date")
            })
          }
        >
          <RefreshCw size={17} />
        </IconButton>
      </div>
      {Object.values(filters).some(Boolean) && (
        <div className="filter-chips">
          {Object.entries(filters)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <button
                key={k}
                onClick={() => setFilters((f) => ({ ...f, [k]: "" }))}
              >
                {filterLabels[k] ?? k}: {v} ×
              </button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            Clear all
          </Button>
        </div>
      )}
      <div className="inventory-layout">
        {filtersOpen && (
          <aside className="filter-panel max-h-[calc(100vh-180px)] overflow-y-auto">
            <div>
              <strong>Filters</strong>
              <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
                Clear all
              </Button>
            </div>
            {filterFields.map((key) =>
              typedFilterFields.includes(key) ? (
                <Input
                  key={key}
                  label={filterLabels[key]}
                  list={`filter-list-${key}`}
                  value={filters[key] ?? ""}
                  placeholder={`All ${filterLabels[key]}`}
                  onChange={(e) => changeFilter(key, e.target.value)}
                />
              ) : (
                <Select
                  key={key}
                  label={filterLabels[key]}
                  value={filters[key] ?? ""}
                  onChange={(e) => changeFilter(key, e.target.value)}
                  options={[
                    { value: "", label: `All ${filterLabels[key]}` },
                    ...options[key],
                  ]}
                />
              ),
            )}
            {typedFilterFields.map((key) => (
              <datalist key={key} id={`filter-list-${key}`}>
                {options[key].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            ))}
          </aside>
        )}
        <section className="table-card">
          {selected.length > 0 && (
            <div className="bulk-bar">
              <strong>{selected.length} selected</strong>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    "selected-assets.csv",
                    exportAssets(
                      assets.filter((a) => selected.includes(a.id)),
                    ),
                  )
                }
              >
                <Download size={15} /> Export
              </Button>
              {manageAllowed && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const firstSelected = assets.find((asset) =>
                      selected.includes(asset.id),
                    )
                    setMoveBusinessUnitId(
                      firstSelected?.businessUnitId ??
                        master.businessUnits[0]?.id ??
                        "",
                    )
                    setMoveLocation("")
                    setMoveOpen(true)
                  }}
                >
                  <MapPin size={15} /> Move Location
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Select current page"
                      type="checkbox"
                      checked={
                        rows.length > 0 &&
                        rows.every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  ...rows.map((r) => r.id),
                                ]),
                              ]
                            : selected.filter(
                                (id) => !rows.some((r) => r.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  {allColumns.map(
                    (c, i) =>
                      isVisible(c) && (
                        <th key={c} onClick={() => toggleSort(columnKeys[i])}>
                          {c}
                          {sort.key === columnKeys[i]
                            ? sort.direction === 1
                              ? " ↑"
                              : " ↓"
                            : ""}
                        </th>
                      ),
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => setSelectedAsset(a)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`Select ${a.assetCode || "asset"}`}
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() =>
                          setSelected((v) =>
                            v.includes(a.id)
                              ? v.filter((x) => x !== a.id)
                              : [...v, a.id],
                          )
                        }
                      />
                    </td>
                    {isVisible("Asset ID") && (
                      <td>
                        <code>{a.assetCode || "—"}</code>
                      </td>
                    )}
                    {isVisible("Serial / Tag") && (
                      <td>
                        <strong>{a.serial}</strong>
                        <small>{a.tag}</small>
                      </td>
                    )}
                    {isVisible("Category") && <td>{a.category}</td>}
                    {isVisible("Group") && <td>{a.group}</td>}
                    {isVisible("Type") && <td>{a.type}</td>}
                    {isVisible("Brand") && <td>{a.brand}</td>}
                    {isVisible("Model") && (
                      <td className="truncate-cell" title={a.model}>
                        {a.model}
                      </td>
                    )}
                    {isVisible("Location") && <td>{a.location}</td>}
                    {isVisible("Business Unit") && <td>{a.businessUnit}</td>}
                    {isVisible("Asset Status") && (
                      <td>{a.assetStatus || "—"}</td>
                    )}
                    {isVisible("Condition") && (
                      <td>
                        <ConditionBadge
                          condition={a.condition}
                          color={
                            master.conditions.find(
                              (item) => item.name === a.condition,
                            )?.tagColor
                          }
                        />
                      </td>
                    )}
                    {isVisible("Quantity") && (
                      <td className="numeric">{a.quantity}</td>
                    )}
                    {isVisible("UOM") && <td>{a.uom}</td>}
                    {isVisible("Last Updated") && (
                      <td>
                        {a.createdDt
                          ? new Date(a.createdDt).toLocaleDateString()
                          : "—"}
                      </td>
                    )}
                    <td onClick={(e) => e.stopPropagation()}>
                      {manageAllowed && (
                        <IconButton
                          label="Edit asset"
                          onClick={() => setFormAsset(a)}
                        >
                          <Edit3 size={16} />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <EmptyState />}
          </div>
          <div className="table-footer">
            <Select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              options={["10", "25", "50", "100"]}
            />
            <Pagination
              page={page}
              pages={pages}
              onChange={setPage}
              total={filtered.length}
              from={(page - 1) * pageSize + 1}
              to={Math.min(page * pageSize, filtered.length)}
            />
          </div>
        </section>
      </div>
      <AssetForm
        open={formAsset !== undefined}
        asset={formAsset}
        onClose={() => setFormAsset(undefined)}
      />
      <Modal
        open={importOpen}
        title="Import Assets from Excel"
        description="Upload an XLSX, XLS, or CSV file. Reference codes are validated against current Master Data."
        onClose={() => setImportOpen(false)}
        wide
      >
        <div className="import-panel">
          <div className="import-actions">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              onClick={() =>
                window.location.assign(
                  "/app-api/backend/api/assets/import-template",
                )
              }
            >
              Download template
            </Button>
          </div>
          {importFileError && (
            <div className="error-summary" role="alert">
              <strong>Import failed</strong>
              <span>{importFileError}</span>
            </div>
          )}
          {importResult && (
            <div className="import-summary" role="status">
              <strong>
                Server processed {importResult.totalRows} rows:{" "}
                {importResult.successCount} imported, {importResult.failedCount}{" "}
                rejected.
              </strong>
            </div>
          )}
          {!!importResult?.errors?.length && (
            <div className="error-summary" role="alert">
              <strong>Rows rejected by the server</strong>
              {importResult.errors.map((error) => (
                <span key={error.rowNumber}>
                  Row {error.rowNumber}:{" "}
                  {error.messages?.join(", ") || "Invalid row"}
                </span>
              ))}
            </div>
          )}
          {importRows.length > 0 && (
            <>
              <div className="import-summary">
                <strong>
                  {importRows.length} rows found
                  {importFileName ? ` in ${importFileName}` : ""}
                </strong>
                <Badge tone={importErrors.length ? "danger" : "success"}>
                  {importErrors.length
                    ? `${validImports.length} valid · ${importErrors.length} invalid`
                    : `${validImports.length} ready to import`}
                </Badge>
              </div>
              <div className="import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Asset Name</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.slice(0, 10).map((result) => {
                      return (
                        <tr key={result.row}>
                          <td>{result.row}</td>
                          <td>{result.source.asset_name}</td>
                          <td>
                            {result.errors.length ? (
                              <span className="error">
                                {result.errors.join(", ")}
                              </span>
                            ) : (
                              <Badge>Good</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!importFile || !importRows.length || isImporting}
              onClick={commitImport}
            >
              {isImporting
                ? "Importing..."
                : `Import ${importRows.length} rows`}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={manageAllowed && moveOpen}
        title={`Move ${selected.length} assets`}
        description="This bulk action updates the Business Unit and Location of selected records."
        onClose={() => setMoveOpen(false)}
      >
        <Select
          label="Business Unit"
          value={moveBusinessUnitId}
          onChange={(e) => {
            setMoveBusinessUnitId(e.target.value)
            setMoveLocation("")
          }}
          options={[
            { value: "", label: "Select Business Unit" },
            ...master.businessUnits.map((unit) => ({
              value: unit.id,
              label: unit.name,
            })),
          ]}
        />
        <Select
          label="Location"
          value={moveLocation}
          onChange={(e) => setMoveLocation(e.target.value)}
          disabled={!moveBusinessUnitId}
          options={[
            { value: "", label: "Select Location" },
            ...getLocationsForBusinessUnit(
              master.locations,
              moveBusinessUnitId,
            ).map((location) => ({
              value: location.id,
              label: location.name,
            })),
          ]}
        />
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setMoveOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!moveBusinessUnitId || !moveLocation || isMoving}
            onClick={async () => {
              const unit = master.businessUnits.find(
                (item) => item.id === moveBusinessUnitId,
              )
              const location = master.locations.find(
                (item) =>
                  item.id === moveLocation &&
                  item.businessUnitId === moveBusinessUnitId,
              )
              if (!unit || !location) {
                notify(
                  "Choose a Location that belongs to the selected Business Unit",
                )
                return
              }
              setIsMoving(true)
              try {
                const results = await Promise.all(
                  selected.map(async (id) => {
                    const asset = assets.find((item) => item.id === id)
                    return asset
                      ? saveAsset({
                          ...asset,
                          businessUnit: unit.name,
                          businessUnitId: unit.id,
                          location: location.name,
                          locationId: location.id,
                          updatedAt: today(),
                        })
                      : false
                  }),
                )
                const updatedCount = results.filter(Boolean).length
                const failedCount = results.length - updatedCount
                if (!failedCount) {
                  setSelected([])
                  setMoveOpen(false)
                }
                notify(
                  `${updatedCount} assets moved${
                    failedCount ? `; ${failedCount} failed` : ""
                  }`,
                )
              } finally {
                setIsMoving(false)
              }
            }}
          >
            {isMoving ? "Moving..." : "Confirm Move"}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
