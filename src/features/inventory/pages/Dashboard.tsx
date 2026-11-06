"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  RotateCcw,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useInventory } from "@/context/InventoryContext"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
} from "@/components/ui"
import { appSettings } from "@/config/appSettings"
import { formatDate } from "@/utils/helpers"

const isAvailable = (condition: string, quantity: number) =>
  condition.toLocaleLowerCase() === "good" && quantity > 0

export default function Dashboard() {
  const { assets, transactions, audits, businessUnit, setSelectedAsset } =
    useInventory()
  const router = useRouter()
  const [categoryFilter, setCategoryFilter] = useState("")
  const [itemSearch, setItemSearch] = useState("")
  const scoped = useMemo(
    () =>
      assets.filter(
        (asset) =>
          businessUnit === "All Business Units" ||
          asset.businessUnitId === businessUnit,
      ),
    [assets, businessUnit],
  )
  const tx = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          businessUnit === "All Business Units" ||
          transaction.businessUnitId === businessUnit,
      ),
    [businessUnit, transactions],
  )
  const categories = [...new Set(scoped.map((asset) => asset.category))].sort()
  const filteredAssets = useMemo(() => {
    const query = itemSearch.trim().toLocaleLowerCase()
    return scoped.filter(
      (asset) =>
        (!categoryFilter || asset.category === categoryFilter) &&
        (!query ||
          [
            asset.id,
            asset.model,
            asset.brand,
            asset.serial,
            `${asset.brand} ${asset.model}`,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    )
  }, [categoryFilter, itemSearch, scoped])
  const units = useMemo(
    () =>
      Object.entries(
        scoped.reduce<Record<string, number>>((totals, asset) => {
          totals[asset.businessUnit] =
            (totals[asset.businessUnit] ?? 0) + asset.quantity
          return totals
        }, {}),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value),
    [scoped],
  )
  const availableAssets = scoped.filter((asset) =>
    isAvailable(asset.condition, asset.quantity),
  )
  const availableQuantity = availableAssets.reduce(
    (total, asset) => total + asset.quantity,
    0,
  )
  const lowStock = scoped
    .filter((asset) => asset.condition !== "Disposal")
    .map((asset) => ({
      ...asset,
      availableQuantity: isAvailable(asset.condition, asset.quantity)
        ? asset.quantity
        : 0,
    }))
    .filter(
      (asset) =>
        asset.availableQuantity <= appSettings.lowStockThreshold ||
        asset.quantity <= appSettings.lowStockThreshold,
    )
    .sort((left, right) => left.availableQuantity - right.availableQuantity)
  const recentTransactions = tx
    .flatMap((transaction) => {
      const rows = transaction.assets?.length
        ? transaction.assets
        : [
            {
              rowId: `${transaction.id}-dashboard`,
              assetId: transaction.assetId,
              itemName: "",
              quantity: transaction.quantity,
            },
          ]
      return rows.map((row) => ({
        transaction,
        row,
        asset: assets.find((asset) => asset.id === row.assetId),
      }))
    })
    .sort(
      (left, right) =>
        new Date(right.transaction.date).getTime() -
        new Date(left.transaction.date).getTime(),
    )
    .slice(0, 6)
  const findings = audits
    .flatMap((audit) => audit.items)
    .filter(
      (item) => item.finding !== "Match" && item.finding !== "Unverified",
    )
  const currentMonth = new Date().toISOString().slice(0, 7)
  const resetFilters = () => {
    setCategoryFilter("")
    setItemSearch("")
  }

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={`Overview of IT assets and inventory operations · ${businessUnit}`}
        actions={
          <span className="date-label">
            {new Intl.DateTimeFormat("en-ID", { dateStyle: "full" }).format(
              new Date(),
            )}
          </span>
        }
      />

      <div className="dashboard-summary-grid">
        <article className="table-card total-assets-card">
          <header className="card-header">
            <div>
              <h2>Total Assets Item</h2>
              <p>Live inventory totals with combined filters</p>
            </div>
            {(categoryFilter || itemSearch) && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw size={14} /> Reset
              </Button>
            )}
          </header>
          <div className="total-assets-body">
            <div className="asset-metric">
              <span>Total units</span>
              <strong>
                {filteredAssets.reduce(
                  (total, asset) => total + asset.quantity,
                  0,
                )}
              </strong>
            </div>
            <div className="asset-metric">
              <span>Distinct items</span>
              <strong>{filteredAssets.length}</strong>
            </div>
            <div className="asset-filter-row">
              <Select
                aria-label="Filter assets by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[
                  { value: "", label: "All categories" },
                  ...categories,
                ]}
              />
              <SearchInput
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Item name, ID, brand, serial..."
              />
            </div>
          </div>
        </article>
        <div className="stat-grid dashboard-compact-stats">
          <StatCard
            label="Available Assets"
            value={availableQuantity}
            icon={<PackageCheck size={20} />}
            note={`${availableAssets.length} distinct items`}
          />
          <StatCard
            label="Assets In — This Month"
            value={tx
              .filter(
                (transaction) =>
                  transaction.direction === "In" &&
                  transaction.date.slice(0, 7) === currentMonth,
              )
              .reduce((total, transaction) => total + transaction.quantity, 0)}
            icon={<PackagePlus size={20} />}
          />
          <StatCard
            label="Assets Out — This Month"
            value={tx
              .filter(
                (transaction) =>
                  transaction.direction === "Out" &&
                  transaction.date.slice(0, 7) === currentMonth,
              )
              .reduce((total, transaction) => total + transaction.quantity, 0)}
            icon={<PackageMinus size={20} />}
          />
          <StatCard
            label="Pending Audit Findings"
            value={findings.length}
            icon={<ClipboardCheck size={20} />}
            note="Confirmed discrepancies"
          />
        </div>
      </div>

      <article className="chart-card dashboard-business-unit-chart">
        <header>
          <div>
            <h2>Asset Count by Business Unit</h2>
            <p>Current asset quantity by organizational unit</p>
          </div>
        </header>
        {units.length ? (
          <ResponsiveContainer
            width="100%"
            height={Math.max(240, units.length * 38)}
          >
            <BarChart
              data={units}
              layout="vertical"
              margin={{ left: 8, right: 54 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                fontSize={11}
              />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="var(--primary)"
                radius={[0, 4, 4, 0]}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  className="chart-value-label"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No business unit data"
            description="Asset quantities will appear after inventory records are added."
          />
        )}
      </article>

      <div className="dashboard-data-grid">
        <article className="table-card">
          <header className="card-header">
            <div>
              <h2>Available Assets</h2>
              <p>{availableQuantity} units ready for use or assignment</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/assets")}
            >
              View all <ArrowRight size={14} />
            </Button>
          </header>
          <div className="table-scroll dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Asset ID</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Available</th>
                  <th>Business Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {availableAssets.slice(0, 6).map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <td>{asset.model}</td>
                    <td>
                      <code>{asset.assetCode || "—"}</code>
                    </td>
                    <td>{asset.category}</td>
                    <td>{asset.brand}</td>
                    <td className="numeric">{asset.quantity}</td>
                    <td>{asset.businessUnit}</td>
                    <td>
                      <Badge tone="success">Available</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!availableAssets.length && (
              <EmptyState
                title="No available assets"
                description="Good-condition inventory with positive quantity will appear here."
              />
            )}
          </div>
        </article>

        <article className="table-card">
          <header className="card-header">
            <div>
              <h2>Recent Asset Transactions</h2>
              <p>Latest Assets In and Assets Out activity</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(
                  recentTransactions[0]?.transaction.direction === "Out"
                    ? "/goods-out"
                    : "/goods-in",
                )
              }
            >
              View all <ArrowRight size={14} />
            </Button>
          </header>
          <div className="transaction-activity-list">
            {recentTransactions.map(({ transaction, row, asset }) => (
              <div key={`${transaction.id}-${row.rowId}`}>
                <i
                  className={
                    transaction.direction === "In"
                      ? "activity-in"
                      : "activity-out"
                  }
                >
                  {transaction.direction === "In" ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </i>
                <section>
                  <strong>
                    {(row.itemName !== row.assetId && row.itemName) ||
                      (asset
                        ? `${asset.brand} ${asset.model}`
                        : "Unknown asset")}
                  </strong>
                  <span>
                    {transaction.requestNumber || transaction.document} ·{" "}
                    {transaction.party?.name || transaction.user}
                  </span>
                  <small>
                    {transaction.businessUnit} · {formatDate(transaction.date)}
                  </small>
                </section>
                <div>
                  <Badge>
                    {transaction.direction === "In" ? "In" : "Out"}
                  </Badge>
                  <strong>{row.quantity}</strong>
                  <small>{transaction.status}</small>
                </div>
              </div>
            ))}
            {!recentTransactions.length && (
              <EmptyState
                title="No recent transactions"
                description="Assets In and Assets Out activity will appear here."
              />
            )}
          </div>
        </article>
      </div>

      <article className="table-card low-stock-panel">
        <header className="card-header">
          <div>
            <h2>Low Stock & Availability Alerts</h2>
            <p>
              Default attention threshold: {appSettings.lowStockThreshold} units
            </p>
          </div>
          <div className="low-stock-actions">
            <Badge tone={lowStock.length ? "warning" : "success"}>
              {lowStock.length} requiring attention
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/assets")}
            >
              View all <ArrowRight size={14} />
            </Button>
          </div>
        </header>
        <div className="table-scroll dashboard-table">
          <table>
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Asset ID</th>
                <th>Category</th>
                <th>Total Qty</th>
                <th>Available Qty</th>
                <th>Threshold</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 8).map((asset) => {
                const alert =
                  asset.availableQuantity === 0
                    ? "Out of Stock"
                    : asset.quantity <= appSettings.lowStockThreshold
                      ? "Low Stock"
                      : "Limited Availability"
                return (
                  <tr key={asset.id}>
                    <td>{asset.model}</td>
                    <td>
                      <code>{asset.assetCode || "—"}</code>
                    </td>
                    <td>{asset.category}</td>
                    <td className="numeric">{asset.quantity}</td>
                    <td className="numeric">{asset.availableQuantity}</td>
                    <td className="numeric">
                      {appSettings.lowStockThreshold}
                    </td>
                    <td>
                      <Badge
                        tone={
                          alert === "Out of Stock" ? "danger" : "warning"
                        }
                      >
                        <AlertTriangle size={12} /> {alert}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!lowStock.length && (
            <EmptyState
              title="Availability is healthy"
              description="No active inventory is below the configured threshold."
            />
          )}
        </div>
      </article>
    </div>
  )
}
