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
  Trash2,
} from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import type { Asset, MasterItem } from "@/data/demoData"
import { downloadCsv, today } from "@/utils/helpers"
import { AssetForm } from "@/components/assets"
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
  "Condition",
  "Quantity",
  "UOM",
  "Last Updated",
]
const columnKeys: Array<keyof Asset> = [
  "id",
  "serial",
  "category",
  "group",
  "type",
  "brand",
  "model",
  "location",
  "businessUnit",
  "condition",
  "quantity",
  "uom",
  "updatedAt",
]
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
      (field) => String(item[field] ?? "").trim().toLowerCase() === target,
    ),
  )
}

const resolveImportedCondition = (
  value: string,
  conditions: MasterItem[],
) => {
  const direct = findMasterReference(
    conditions,
    value,
    ["id", "condition_id", "code", "status_code", "name", "condition_name"],
  )
  if (direct) return direct.name

  const normalized = value.trim().toLowerCase()
  if (
    ["active", "aktif", "available", "tersedia", "borrowed", "dipinjam"].includes(
      normalized,
    )
  )
    return "Good"
  if (
    [
      "repair",
      "service",
      "in repair",
      "dalam perbaikan",
      "damaged",
      "rusak",
    ].includes(normalized)
  )
    return "Damaged"
  if (
    ["disposal", "disposed", "inactive", "nonactive", "nonaktif"].includes(
      normalized,
    )
  )
    return "Disposal"
  return ""
}

const mapImportRow = ({
  row,
  index,
  assets,
  master,
  businessUnit,
  prefixes,
}: {
  row: AssetImportRow
  index: number
  assets: Asset[]
  master: Record<string, MasterItem[]>
  businessUnit: string
  prefixes: Map<string, number>
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
  const condition = resolveImportedCondition(assetStatus, master.conditions)
  const prefix = assetPrefix.trim().toUpperCase()

  if (categoryCode && !category)
    errors.push(`unknown category code "${categoryCode}"`)
  if (groupCode && !group)
    errors.push(`unknown group code "${groupCode}"`)
  if (typeCode && !type) errors.push(`unknown type code "${typeCode}"`)
  if (brandCode && !brand) errors.push(`unknown brand code "${brandCode}"`)
  if (
    category &&
    group &&
    group.category_id &&
    group.category_id !== (category.category_id ?? category.id)
  )
    errors.push("group does not belong to the selected category")
  if (
    group &&
    type &&
    type.group_id &&
    type.group_id !== (group.group_id ?? group.id)
  )
    errors.push("type does not belong to the selected group")
  if (
    type &&
    brand?.type_id &&
    brand.type_id !== (type.type_id ?? type.id)
  )
    errors.push("brand does not belong to the selected type")
  if (assetStatus && !condition)
    errors.push(`unsupported asset_status "${assetStatus}"`)
  if (
    prefix &&
    assets.some((asset) => asset.id.trim().toUpperCase() === prefix)
  )
    errors.push(`duplicate asset_prefix "${assetPrefix}"`)
  if (prefix && (prefixes.get(prefix) ?? 0) > 1)
    errors.push(`duplicate asset_prefix "${assetPrefix}" in file`)

  if (
    errors.length ||
    !category ||
    !group ||
    !type ||
    !brand ||
    !condition
  )
    return { row: index + 2, source: row, errors }

  const defaultLocation = master.locations[0]?.name ?? "Unassigned"
  const targetBusinessUnit =
    businessUnit === "All Business Units" ? "MBP" : businessUnit
  return {
    row: index + 2,
    source: row,
    errors: [],
    asset: {
      id: prefix,
      serial: `IMP-${prefix}`,
      tag: prefix,
      categoryId: category.category_id ?? category.id,
      groupId: group.group_id ?? group.id,
      typeId: type.type_id ?? type.id,
      brandId: brand.brand_id ?? brand.id,
      category: category.name,
      group: group.name,
      type: type.name,
      brand: brand.name,
      model: assetName,
      location: defaultLocation,
      businessUnit: targetBusinessUnit,
      condition,
      quantity: 1,
      uom: "UNIT",
      updatedAt: today(),
      description: [
        assetName,
        assetType,
        `Imported status: ${assetStatus}`,
      ]
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
    setSelectedAsset,
    importAssets,
    notify,
    saveAsset,
  } = useInventory()
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<SortState>({
    key: "updatedAt",
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
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<AssetImportRow[]>([])
  const [importFileName, setImportFileName] = useState("")
  const [importFileError, setImportFileError] = useState("")
  const filterFields = [
    "category",
    "group",
    "type",
    "brand",
    "model",
    "businessUnit",
    "location",
    "condition",
  ]
  const selectedCategory = master.categories.find(
    (item) => item.name === filters.category,
  )
  const selectedGroup = master.groups.find(
    (item) => item.name === filters.group,
  )
  const selectedType = master.types.find(
    (item) => item.name === filters.type,
  )
  const selectedBrand = master.brands.find(
    (item) => item.name === filters.brand,
  )
  const availableGroups = master.groups.filter(
    (item) =>
      !selectedCategory ||
      item.category_id === (selectedCategory.category_id ?? selectedCategory.id),
  )
  const availableTypes = master.types.filter(
    (item) =>
      !selectedGroup ||
      item.group_id === (selectedGroup.group_id ?? selectedGroup.id),
  )
  const availableBrands = master.brands.filter(
    (item) =>
      !selectedType ||
      !item.type_id ||
      item.type_id === (selectedType.type_id ?? selectedType.id),
  )
  const availableModels = master.models.filter(
    (item) =>
      (!selectedType ||
        item.type_id === (selectedType.type_id ?? selectedType.id)) &&
      (!selectedBrand ||
        item.brand_id === (selectedBrand.brand_id ?? selectedBrand.id)),
  )
  const options: Record<string, string[]> = {
    category: master.categories.map((x) => x.name),
    group: availableGroups.map((x) => x.name),
    type: availableTypes.map((x) => x.name),
    brand: availableBrands.map((x) => x.name),
    model: availableModels.map((x) => x.name),
    businessUnit: [
      "MBP",
      "HBI",
      "AL",
      "SMT",
      "BGN",
      "PBMM",
      "IMPT",
      "SDM",
      "IBT",
    ],
    location: master.locations.map((x) => x.name),
    condition: master.conditions.map((x) => x.name),
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
        const brand = master.brands.find(
          (item) => item.name === current.brand,
        )
        const type = master.types.find((item) => item.name === value)
        const keepBrand =
          !brand?.type_id ||
          brand.type_id === (type?.type_id ?? type?.id)
        return {
          ...current,
          type: value,
          brand: keepBrand ? current.brand : "",
          model: "",
        }
      }
      if (key === "brand") return { ...current, brand: value, model: "" }
      return { ...current, [key]: value }
    })
    setPage(1)
  }
  const filtered = useMemo(
    () =>
      assets
        .filter((a) => {
          const q = search.toLowerCase()
          const searchable = [a.id, a.serial, a.tag, a.model, a.brand, a.sap]
            .join(" ")
            .toLowerCase()
          return (
            (!q || searchable.includes(q)) &&
            (businessUnit === "All Business Units" ||
              a.businessUnit === businessUnit) &&
            Object.entries(filters).every(
              ([k, v]) => !v || String(a[(k as keyof Asset)]) === v,
            )
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
    const prefixes = importRows.reduce((counts, row) => {
      const prefix = (row.asset_prefix ?? "").trim().toUpperCase()
      if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
    return importRows.map((row, index) =>
      mapImportRow({
        row,
        index,
        assets,
        master,
        businessUnit,
        prefixes,
      }),
    )
  }, [importRows, assets, master, businessUnit])
  const importErrors = importResults.filter((result) => result.errors.length)
  const validImports = importResults.flatMap((result) =>
    result.asset ? [result.asset] : [],
  )
  const commitImport = () => {
    if (!validImports.length) return
    importAssets(validImports)
    notify(
      `${validImports.length} assets imported${importErrors.length ? `; ${importErrors.length} rows skipped` : ""}`,
    )
    setImportOpen(false)
    setImportRows([])
    setImportFileName("")
    setImportFileError("")
  }
  return (
    <div className="page">
      <PageHeader
        title="Asset Inventory"
        subtitle={`Manage, search, and maintain IT asset records · ${filtered.length} matching records`}
        actions={
          <Button onClick={() => setFormAsset(null)}>
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
          placeholder="Asset ID, serial, model, brand, SAP ID..."
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
          onClick={() => {
            setImportOpen(true)
            setImportRows([])
            setImportFileName("")
            setImportFileError("")
          }}
        >
          <Upload size={16} /> Import
        </Button>
        <Button
          variant="secondary"
          onClick={() => downloadCsv("asset-inventory.csv", filtered)}
        >
          <Download size={16} /> Export
        </Button>
        <IconButton
          label="Refresh"
          onClick={() => notify("Inventory is up to date")}
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
                {k}: {v} ×
              </button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            Clear all
          </Button>
        </div>
      )}
      <div className="inventory-layout">
        {filtersOpen && (
          <aside className="filter-panel">
            <div>
              <strong>Filters</strong>
              <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
                Clear all
              </Button>
            </div>
            {filterFields.map((key) => (
              <Select
                key={key}
                label={key.replace(/([A-Z])/g, " $1")}
                value={filters[key] ?? ""}
                onChange={(e) => changeFilter(key, e.target.value)}
                options={[{ value: "", label: `All ${key}` }, ...options[key]]}
              />
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
                    assets.filter((a) => selected.includes(a.id)),
                  )
                }
              >
                <Download size={15} /> Export
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMoveOpen(true)}
              >
                <MapPin size={15} /> Move Location
              </Button>
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
                        aria-label={`Select ${a.id}`}
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
                        <code>{a.id}</code>
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
                    {isVisible("Condition") && (
                      <td>
                        <Badge>{a.condition}</Badge>
                      </td>
                    )}
                    {isVisible("Quantity") && (
                      <td className="numeric">{a.quantity}</td>
                    )}
                    {isVisible("UOM") && <td>{a.uom}</td>}
                    {isVisible("Last Updated") && <td>{a.updatedAt}</td>}
                    <td onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        label="Edit asset"
                        onClick={() => setFormAsset(a)}
                      >
                        <Edit3 size={16} />
                      </IconButton>
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
                downloadCsv("asset-import-template.csv", [
                  {
                    category_id: "",
                    brand_id: "",
                    group_id: "",
                    type_id: "",
                    asset_name: "",
                    asset_type: "",
                    asset_status: "active",
                    asset_prefix: "",
                  },
                ])
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
                      <th>Asset Prefix</th>
                      <th>Asset Name</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.slice(0, 10).map((result) => {
                      return (
                        <tr key={result.row}>
                          <td>{result.row}</td>
                          <td>
                            <code>{result.source.asset_prefix}</code>
                          </td>
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
              disabled={!validImports.length}
              onClick={commitImport}
            >
              Import {validImports.length} valid rows
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={moveOpen}
        title={`Move ${selected.length} assets`}
        description="This bulk action updates the current location of selected records."
        onClose={() => setMoveOpen(false)}
      >
        <Select
          label="New location"
          value={moveLocation}
          onChange={(e) => setMoveLocation(e.target.value)}
          options={[
            { value: "", label: "Select location" },
            ...master.locations.map((x) => x.name),
          ]}
        />
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setMoveOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!moveLocation}
            onClick={() => {
              selected.forEach((id) => {
                const a = assets.find((x) => x.id === id)
                if (a)
                  saveAsset({
                    ...a,
                    location: moveLocation,
                    updatedAt: today(),
                  })
              })
              setSelected([])
              setMoveOpen(false)
            }}
          >
            Confirm Move
          </Button>
        </div>
      </Modal>
    </div>
  )
}
