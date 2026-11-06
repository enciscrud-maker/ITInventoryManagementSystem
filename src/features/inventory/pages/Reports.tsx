"use client"

import { useMemo, useState } from "react"
import { Download, Printer, BarChart3, FileText } from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import { useAuth } from "@/auth/AuthContext"
import { canAccessPage } from "@/services/authorizationService"
import { downloadCsv, formatDate } from "@/utils/helpers"
import {
  getLocationsForBusinessUnit,
  getMasterInternalId,
} from "@/utils/masterData"
import ConditionBadge from "@/components/ConditionBadge"
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
  "Monthly Assets In / Assets Out Summary",
  "Stock Opname Discrepancy Report",
  "Asset Movement History",
]
export default function Reports() {
  const { assets, transactions, audits, master, businessUnit, notify } =
    useInventory()
  const { currentUser } = useAuth()
  const reportAllowed = canAccessPage(currentUser, "reports")
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
    setFilters((v) => ({
      ...v,
      [key]: value,
      ...(key === "businessUnit" ? { location: "" } : {}),
    }))
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
      item.category_id === getMasterInternalId(selectedCategory),
  )
  const reportTypes = master.types.filter(
    (item) =>
      !selectedGroup ||
      item.group_id === getMasterInternalId(selectedGroup),
  )
  const reportBrands = master.brands.filter(
    (item) =>
      !selectedType ||
      !item.type_id ||
      item.type_id === getMasterInternalId(selectedType),
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
          brand.type_id === (type ? getMasterInternalId(type) : "")
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
        (filters.businessUnit === "All Business Units" ||
          !filters.businessUnit ||
          a.businessUnitId === filters.businessUnit) &&
        Object.entries(filters).every(
          ([k, v]) =>
            !v ||
            v === "All Business Units" ||
            k === "businessUnit" ||
            k === "transactionType" ||
            (k === "location"
              ? a.locationId === v
              : String(a[(k as keyof typeof a)]) === v),
        ),
      ),
    [assets, filters],
  )
  const filteredTx = transactions.filter(
    (t) =>
      (!filters.businessUnit ||
        filters.businessUnit === "All Business Units" ||
        t.businessUnitId === filters.businessUnit) &&
      (!filters.location || t.locationId === filters.location) &&
      (!filters.transactionType || t.statusCode === filters.transactionType),
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
    .filter(
      (audit) =>
        (!filters.businessUnit ||
          filters.businessUnit === "All Business Units" ||
          audit.businessUnitId === filters.businessUnit) &&
        (!filters.location ||
          audit.locationId === filters.location ||
          audit.items.some(
            (item) =>
              item.systemLocationId === filters.location ||
              item.actualLocationId === filters.location,
          )),
    )
    .flatMap((a) =>
      a.items.map((i) => ({
        session: a.name,
        assetId:
          assets.find((asset) => asset.id === i.assetId)?.assetCode ??
          i.assetCode ??
          "",
        finding: i.finding,
        businessUnit: a.businessUnit,
        businessUnitId: a.businessUnitId,
        location: i.actualLocation,
        locationId: i.actualLocationId,
        systemLocation: i.systemLocation,
        systemLocationId: i.systemLocationId,
        notes: i.notes,
      })),
    )
    .filter(
      (i) =>
        i.finding !== "Match" &&
        i.finding !== "Unverified" &&
        (!filters.location ||
          i.locationId === filters.location ||
          i.systemLocationId === filters.location),
    )
  const transactionRows = filteredTx.map((transaction) => ({
    ...transaction,
    assetId:
      assets.find((asset) => asset.id === transaction.assetId)?.assetCode ??
      "",
    assets: transaction.assets?.map((row) => ({
      ...row,
      assetId:
        assets.find((asset) => asset.id === row.assetId)?.assetCode ?? "",
    })),
  }))
  const tableRows: Record<string, unknown>[] =
    report.includes("Monthly Goods") || report === "Asset Movement History"
      ? transactionRows
      : report === "Stock Opname Discrepancy Report"
        ? discrepancies
        : groups
  const requireReportPermission = (action: () => void) => {
    if (!reportAllowed) {
      notify("You do not have permission to generate or export reports")
      return
    }
    action()
  }
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
                requireReportPermission(() =>
                  downloadCsv(
                    `${report.toLowerCase().replace(/ /g, "-")}.csv`,
                    tableRows,
                  ),
                )
              }
              disabled={!generated || !reportAllowed}
            >
              <Download size={16} /> CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                requireReportPermission(() => window.print())
              }
              disabled={!generated || !reportAllowed}
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
                { value: "All Business Units", label: "All Business Units" },
                ...master.businessUnits.map((unit) => ({
                  value: unit.id,
                  label: unit.name,
                })),
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
                ...(filters.businessUnit === "All Business Units"
                  ? master.locations
                  : getLocationsForBusinessUnit(
                      master.locations,
                      filters.businessUnit,
                    )
                ).map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
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
                ...master.statuses.map((item) => ({
                  value: item.code,
                  label: `${item.name} (${item.usage})`,
                })),
              ]}
            />
          </div>
          <Button
            disabled={!reportAllowed}
            onClick={() =>
              requireReportPermission(() => setGenerated(true))
            }
          >
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
                    {Object.entries(r).map(([key, value], j) => (
                      <td key={j}>
                        {report === "Assets by Condition" &&
                        key === "label" &&
                        typeof value === "string" ? (
                          <ConditionBadge
                            condition={value}
                            color={
                              master.conditions.find(
                                (item) => item.name === value,
                              )?.tagColor
                            }
                          />
                        ) : (
                          String(value ?? "—")
                        )}
                      </td>
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
