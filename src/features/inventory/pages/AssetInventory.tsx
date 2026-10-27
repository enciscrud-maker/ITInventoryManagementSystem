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
import type { Asset } from "@/data/demoData"
import { downloadCsv, parseCsv, today } from "@/utils/helpers"
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
  const [importRows, setImportRows] = useState<Record<string, string>[]>([])
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
  const options: Record<string, string[]> = {
    category: master.categories.map((x) => x.name),
    group: master.groups.map((x) => x.name),
    type: master.types.map((x) => x.name),
    brand: master.brands.map((x) => x.name),
    model: master.models.map((x) => x.name),
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
    setImportRows(parseCsv(await file.text()) as Record<string, string>[])
  }
  const importErrors = importRows
    .map((r, i) => ({
      row: i + 2,
      errors: [
        "id",
        "serial",
        "category",
        "group",
        "type",
        "brand",
        "model",
        "location",
        "businessUnit",
      ]
        .filter((k) => !r[k])
        .map((k) => `missing ${k}`)
        .concat(
          assets.some((a) => a.id === r.id) ? ["duplicate id"] : [],
          assets.some((a) => a.serial === r.serial) ? ["duplicate serial"] : [],
        ),
    }))
    .filter((x) => x.errors.length)
  const commitImport = () => {
    const bad = new Set(importErrors.map((x) => x.row - 2))
    const valid = importRows
      .filter((_, i) => !bad.has(i))
      .map(
        (r) =>
          ({
            ...r,
            quantity: Number(r.quantity || 1),
            uom: r.uom || "UNIT",
            condition: r.condition || "Good",
            updatedAt: today(),
            demo: false,
          }) as unknown as Asset,
      )
    importAssets(valid)
    setImportOpen(false)
    setImportRows([])
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
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
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
                onChange={(e) => {
                  setFilters((f) => ({ ...f, [key]: e.target.value }))
                  setPage(1)
                }}
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
        title="Import Assets from CSV"
        description="CSV import is supported; XLSB parsing is not enabled in this prototype."
        onClose={() => setImportOpen(false)}
        wide
      >
        <div className="import-panel">
          <div className="import-actions">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv("asset-import-template.csv", [
                  {
                    id: "",
                    serial: "",
                    category: "",
                    group: "",
                    type: "",
                    brand: "",
                    model: "",
                    location: "",
                    businessUnit: "",
                    condition: "Good",
                    quantity: 1,
                    uom: "UNIT",
                  },
                ])
              }
            >
              Download template
            </Button>
          </div>
          {importRows.length > 0 && (
            <>
              <div className="import-summary">
                <strong>{importRows.length} rows found</strong>
                <Badge tone={importErrors.length ? "danger" : "success"}>
                  {importErrors.length
                    ? `${importErrors.length} invalid`
                    : "Ready to import"}
                </Badge>
              </div>
              <div className="import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Asset ID</th>
                      <th>Serial</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 10).map((r, i) => {
                      const err = importErrors.find((x) => x.row === i + 2)
                      return (
                        <tr key={i}>
                          <td>{i + 2}</td>
                          <td>
                            <code>{r.id}</code>
                          </td>
                          <td>{r.serial}</td>
                          <td>
                            {err ? (
                              <span className="error">
                                {err.errors.join(", ")}
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
              disabled={
                !importRows.length || importRows.length === importErrors.length
              }
              onClick={commitImport}
            >
              Import valid rows
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
