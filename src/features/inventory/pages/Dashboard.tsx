"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Boxes,
  PackagePlus,
  PackageMinus,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { useInventory } from "@/context/InventoryContext"
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui"
import { formatDate } from "@/utils/helpers"

const colors = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#64748b"]
export default function Dashboard() {
  const { assets, transactions, audits, businessUnit, setSelectedAsset } =
    useInventory()
  const router = useRouter()
  const scoped = assets.filter(
    (a) =>
      businessUnit === "All Business Units" || a.businessUnit === businessUnit,
  )
  const tx = transactions.filter(
    (t) =>
      businessUnit === "All Business Units" || t.businessUnit === businessUnit,
  )
  const category = useMemo(
    () =>
      Object.entries(
        scoped.reduce<Record<string, number>>(
          (m, a) => ({ ...m, [a.category]: (m[a.category] ?? 0) + a.quantity }),
          {},
        ),
      ).map(([name, value]) => ({ name, value })),
    [scoped],
  )
  const groups = useMemo(
    () =>
      Object.entries(
        scoped.reduce<Record<string, number>>(
          (m, a) => ({ ...m, [a.group]: (m[a.group] ?? 0) + a.quantity }),
          {},
        ),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [scoped],
  )
  const units = [
    "MBP",
    "HBI",
    "AL",
    "SMT",
    "BGN",
    "PBMM",
    "IMPT",
    "SDM",
    "IBT",
  ].map((name) => ({
    name,
    value: scoped
      .filter((a) => a.businessUnit === name)
      .reduce((s, a) => s + a.quantity, 0),
  }))
  const findings = audits
    .flatMap((a) => a.items)
    .filter((i) => i.finding !== "Match" && i.finding !== "Unverified")
  const findingGroups = Object.entries(
    findings.reduce<Record<string, number>>(
      (m, i) => ({ ...m, [i.finding]: (m[i.finding] ?? 0) + 1 }),
      {},
    ),
  )
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
      <div className="stat-grid">
        <StatCard
          label="Total Assets"
          value={scoped.reduce((s, a) => s + a.quantity, 0)}
          icon={<Boxes size={20} />}
          note={`${scoped.length} asset records`}
        />
        <StatCard
          label="Assets In — This Month"
          value={tx
            .filter(
              (t) => t.direction === "In" && t.date.slice(0, 7) === "2026-09",
            )
            .reduce((s, t) => s + t.quantity, 0)}
          icon={<PackagePlus size={20} />}
        />
        <StatCard
          label="Assets Out — This Month"
          value={tx
            .filter(
              (t) => t.direction === "Out" && t.date.slice(0, 7) === "2026-09",
            )
            .reduce((s, t) => s + t.quantity, 0)}
          icon={<PackageMinus size={20} />}
        />
        <StatCard
          label="Pending Audit Findings"
          value={findings.length}
          icon={<ClipboardCheck size={20} />}
          note="Confirmed discrepancies"
        />
      </div>
      <div className="dashboard-grid">
        <article className="chart-card">
          <header>
            <div>
              <h2>Asset Distribution by Category</h2>
              <p>Quantity across active inventory</p>
            </div>
          </header>
          <div className="donut-wrap">
            <ResponsiveContainer width="60%" height={250}>
              <PieChart>
                <Pie
                  data={category}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {category.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {category.map((d) => (
                <div key={d.name}>
                  <i />
                  <span>{d.name}</span>
                  <strong>{d.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="chart-card">
          <header>
            <div>
              <h2>Asset Count by Group</h2>
              <p>Inventory composition</p>
            </div>
          </header>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={groups} margin={{ left: 2, right: 10, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-22}
                textAnchor="end"
                fontSize={11}
              />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="chart-card chart-wide">
          <header>
            <div>
              <h2>Asset Count by Business Unit</h2>
              <p>Quantity by organizational unit</p>
            </div>
          </header>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={units}
              layout="vertical"
              margin={{ left: 5, right: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" width={48} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>
      <div className="dashboard-grid lower-grid">
        <article className="table-card">
          <header className="card-header">
            <div>
              <h2>Recent Transactions</h2>
              <p>Latest inventory movements</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/goods-in")}
            >
              View all <ArrowRight size={14} />
            </Button>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Document</th>
                  <th>User</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tx.slice(0, 5).map((t) => (
                  <tr
                    key={t.id}
                    onClick={() =>
                      setSelectedAsset(
                        assets.find((a) => a.id === t.assetId) ?? null,
                      )
                    }
                  >
                    <td>
                      <code>{t.assetId}</code>
                    </td>
                    <td>
                      <Badge>{t.direction}</Badge>
                    </td>
                    <td>{t.document}</td>
                    <td>{t.user}</td>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      <Badge>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="alerts-card">
          <header>
            <div>
              <h2>Audit Alerts</h2>
              <p>Unresolved physical findings</p>
            </div>
          </header>
          {findingGroups.length ? (
            findingGroups.map(([name, count]) => (
              <button key={name} onClick={() => router.push("/audits")}>
                <Badge>{name}</Badge>
                <strong>{count}</strong>
                <ArrowRight size={15} />
              </button>
            ))
          ) : (
            <EmptyState
              title="No discrepancies"
              description="All verified records match."
            />
          )}
        </article>
      </div>
    </div>
  )
}
