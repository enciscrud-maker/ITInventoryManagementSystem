"use client"

import { useMemo, useState } from "react"
import { Download, Printer, BarChart3, FileText } from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import { downloadCsv, formatDate } from "@/utils/helpers"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui"

const reports = [
  "Assets by Location",
  "Assets by Condition",
  "Assets by Business Unit",
  "Assets by Category and Group",
  "Monthly Goods In / Goods Out Summary",
  "Stock Opname Discrepancy Report",
  "Asset Movement History",
]
export default function Reports() {
  const { assets, transactions, audits, master, businessUnit } = useInventory()
  const [report, setReport] = useState(reports[0])
  const [generated, setGenerated] = useState(false)
  const [filters, setFilters] = useState({
    businessUnit,
    category: "",
    group: "",
    type: "",
    brand: "",
    location: "",
    condition: "",
    transactionType: "",
  })
  const set = (key: string, value: string) =>
    setFilters((v) => ({ ...v, [key]: value }))
  const selectedCategory = master.categories.find(
    (item) => item.name === filters.category,
  )
  const selectedGroup = master.groups.find(
    (item) => item.name === filters.group,
  )
  const selectedType = master.types.find(
    (item) => item.name === filters.type,
  )
  const reportGroups = master.groups.filter(
    (item) =>
      !selectedCategory ||
      item.category_id === (selectedCategory.category_id ?? selectedCategory.id),
  )
  const reportTypes = master.types.filter(
    (item) =>
      !selectedGroup ||
      item.group_id === (selectedGroup.group_id ?? selectedGroup.id),
  )
  const reportBrands = master.brands.filter(
    (item) =>
      !selectedType ||
      !item.type_id ||
      item.type_id === (selectedType.type_id ?? selectedType.id),
  )
  const setClassificationFilter = (
    key: "category" | "group" | "type" | "brand",
    value: string,
  ) =>
    setFilters((current) => {
      if (key === "category")
        return {
          ...current,
          category: value,
          group: "",
          type: "",
          brand: "",
        }
      if (key === "group")
        return { ...current, group: value, type: "", brand: "" }
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
        }
      }
      return { ...current, brand: value }
    })
  const filteredAssets = useMemo(
    () =>
      assets.filter((a) =>
        Object.entries(filters).every(
          ([k, v]) =>
            !v ||
            v === "All Business Units" ||
            k === "transactionType" ||
            String(a[(k as keyof typeof a)]) === v,
        ),
      ),
    [assets, filters],
  )
  const filteredTx = transactions.filter(
    (t) =>
      (!filters.businessUnit ||
        filters.businessUnit === "All Business Units" ||
        t.businessUnit === filters.businessUnit) &&
      (!filters.transactionType || t.type === filters.transactionType),
  )
  const groups = Object.entries(
    filteredAssets.reduce<Record<string, number>>((m, a) => {
      const key =
        report === "Assets by Location"
          ? a.location
          : report === "Assets by Condition"
            ? a.condition
            : report === "Assets by Business Unit"
              ? a.businessUnit
              : `${a.category} / ${a.group}`
      return { ...m, [key]: (m[key] ?? 0) + a.quantity }
    }, {}),
  ).map(([label, quantity]) => ({ label, quantity }))
  const discrepancies = audits
    .flatMap((a) =>
      a.items.map((i) => ({
        session: a.name,
        assetId: i.assetId,
        finding: i.finding,
        businessUnit: a.businessUnit,
        notes: i.notes,
      })),
    )
    .filter((i) => i.finding !== "Match" && i.finding !== "Unverified")
  const tableRows: Record<string, unknown>[] =
    report.includes("Monthly Goods") || report === "Asset Movement History"
      ? filteredTx
      : report === "Stock Opname Discrepancy Report"
        ? discrepancies
        : groups
  return (
    <div className="page print-area">
      <PageHeader
        title="Reports & Export"
        subtitle="Analyze asset distribution, inventory movement, and audit discrepancies."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `${report.toLowerCase().replace(/ /g, "-")}.csv`,
                  tableRows,
                )
              }
              disabled={!generated}
            >
              <Download size={16} /> CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={!generated}
            >
              <Printer size={16} /> Print
            </Button>
          </>
        }
      />
      <section className="report-builder">
        <div className="report-types">
          {reports.map((r) => (
            <button
              className={report === r ? "active" : ""}
              key={r}
              onClick={() => {
                setReport(r)
                setGenerated(false)
              }}
            >
              <FileText size={16} />
              <span>{r}</span>
            </button>
          ))}
        </div>
        <div className="report-filters">
          <h2>Report filters</h2>
          <div className="form-grid">
            <Select
              label="Business Unit"
              value={filters.businessUnit}
              onChange={(e) => set("businessUnit", e.target.value)}
              options={[
                "All Business Units",
                "MBP",
                "HBI",
                "AL",
                "SMT",
                "BGN",
                "PBMM",
                "IMPT",
                "SDM",
                "IBT",
              ]}
            />
            <Select
              label="Category"
              value={filters.category}
              onChange={(e) =>
                setClassificationFilter("category", e.target.value)
              }
              options={[
                { value: "", label: "All categories" },
                ...master.categories.map((x) => x.name),
              ]}
            />
            <Select
              label="Group"
              value={filters.group}
              onChange={(e) =>
                setClassificationFilter("group", e.target.value)
              }
              options={[
                { value: "", label: "All groups" },
                ...reportGroups.map((x) => x.name),
              ]}
            />
            <Select
              label="Type"
              value={filters.type}
              onChange={(e) =>
                setClassificationFilter("type", e.target.value)
              }
              options={[
                { value: "", label: "All types" },
                ...reportTypes.map((x) => x.name),
              ]}
            />
            <Select
              label="Brand"
              value={filters.brand}
              onChange={(e) =>
                setClassificationFilter("brand", e.target.value)
              }
              options={[
                { value: "", label: "All brands" },
                ...reportBrands.map((x) => x.name),
              ]}
            />
            <Select
              label="Location"
              value={filters.location}
              onChange={(e) => set("location", e.target.value)}
              options={[
                { value: "", label: "All locations" },
                ...master.locations.map((x) => x.name),
              ]}
            />
            <Select
              label="Condition"
              value={filters.condition}
              onChange={(e) => set("condition", e.target.value)}
              options={[
                { value: "", label: "All conditions" },
                ...master.conditions.map((x) => x.name),
              ]}
            />
            <Select
              label="Transaction Type"
              value={filters.transactionType}
              onChange={(e) => set("transactionType", e.target.value)}
              options={[
                { value: "", label: "All transaction types" },
                "New unit",
                "Return",
                "After service",
                "Handover",
                "Service",
                "Off-lease",
                "Disposal",
              ]}
            />
          </div>
          <Button onClick={() => setGenerated(true)}>
            <BarChart3 size={16} /> Generate Report
          </Button>
        </div>
      </section>
      {generated && (
        <section className="report-result">
          <header>
            <div>
              <h2>{report}</h2>
              <p>
                Generated {formatDate(new Date().toISOString())} ·{" "}
                {filters.businessUnit}
              </p>
            </div>
            <Badge tone="info">{tableRows.length} results</Badge>
          </header>
          <div className="stat-grid compact-stats">
            <StatCard
              label="Asset Records"
              value={filteredAssets.length}
              icon={<BarChart3 size={18} />}
            />
            <StatCard
              label="Total Quantity"
              value={filteredAssets.reduce((s, a) => s + a.quantity, 0)}
              icon={<BarChart3 size={18} />}
            />
            <StatCard
              label="Transactions"
              value={filteredTx.length}
              icon={<BarChart3 size={18} />}
            />
            <StatCard
              label="Discrepancies"
              value={discrepancies.length}
              icon={<BarChart3 size={18} />}
            />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {tableRows[0] &&
                    Object.keys(tableRows[0]).map((k) => (
                      <th key={k}>{k.replace(/([A-Z])/g, " $1")}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j}>{String(v ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!tableRows.length && (
              <EmptyState
                title="No report data"
                description="The selected filters returned no records."
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}
