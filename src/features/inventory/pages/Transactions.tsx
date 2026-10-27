"use client"

import { useMemo, useState } from "react"
import { Plus, PackagePlus, PackageMinus, Clock, Boxes } from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import type { Transaction } from "@/data/demoData"
import { today, formatDate } from "@/utils/helpers"
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui"

export default function Transactions({
  direction,
}: {
  direction: "In" | "Out"
}) {
  const { assets, transactions, businessUnit, saveTransaction } = useInventory()
  const incoming = direction === "In"
  const types = incoming
    ? ["New unit", "Return", "After service"]
    : ["Handover", "Service", "Off-lease", "Disposal"]
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const initial = {
    date: today(),
    type: types[0],
    document: "",
    po: "",
    notes: "",
    assetId: "",
    quantity: 1,
    location: "",
    businessUnit: businessUnit === "All Business Units" ? "MBP" : businessUnit,
    user: "",
    status: "Completed",
  }
  const [form, setForm] = useState(initial)
  const set = (key: string, value: string | number) =>
    setForm((v) => ({ ...v, [key]: value }))
  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.direction === direction &&
          (businessUnit === "All Business Units" ||
            t.businessUnit === businessUnit) &&
          (!search ||
            [t.document, t.assetId, t.user]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!typeFilter || t.type === typeFilter) &&
          (!status || t.status === status),
      ),
    [transactions, direction, businessUnit, search, typeFilter, status],
  )
  const rows = filtered.slice((page - 1) * 10, page * 10)
  const month = filtered.filter(
    (t) => t.date.slice(0, 7) === today().slice(0, 7),
  )
  const selectedAsset = assets.find((a) => a.id === form.assetId)
  const submit = () => {
    if (!form.document || !form.assetId || !form.location || !form.user) return
    saveTransaction({
      ...form,
      id: `TRX-${Date.now()}`,
      direction,
    } as Transaction)
    setOpen(false)
    setStep(1)
    setForm(initial)
  }
  return (
    <div className="page">
      <PageHeader
        title={incoming ? "Goods In" : "Goods Out"}
        subtitle={
          incoming
            ? "Record incoming assets and inventory receipts."
            : "Record asset handovers, services, and disposals."
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> New Goods-{incoming ? "In" : "Out"}
          </Button>
        }
      />
      <div className="stat-grid compact-stats">
        <StatCard
          label="Total transactions"
          value={filtered.length}
          icon={
            incoming ? <PackagePlus size={19} /> : <PackageMinus size={19} />
          }
        />
        <StatCard
          label="This month"
          value={month.length}
          icon={<Clock size={19} />}
        />
        <StatCard
          label="Pending"
          value={filtered.filter((t) => t.status === "Pending").length}
          icon={<Clock size={19} />}
        />
        <StatCard
          label="Total quantity"
          value={filtered.reduce((s, t) => s + t.quantity, 0)}
          icon={<Boxes size={19} />}
        />
      </div>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Document, asset, recipient..."
        />
        <Select
          aria-label="Transaction type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[{ value: "", label: "All transaction types" }, ...types]}
        />
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            "Pending",
            "In Progress",
            "Completed",
          ]}
        />
      </div>
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Document Number</th>
                <th>Asset</th>
                <th>Transaction Type</th>
                {incoming && <th>PO Number</th>}
                <th>{incoming ? "Source / User" : "Recipient / User"}</th>
                <th>Quantity</th>
                <th>{incoming ? "Destination" : "Business Unit"}</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>
                    <strong>{t.document}</strong>
                  </td>
                  <td>
                    <code>{t.assetId}</code>
                  </td>
                  <td>{t.type}</td>
                  {incoming && <td>{t.po || "—"}</td>}
                  <td>{t.user}</td>
                  <td className="numeric">{t.quantity}</td>
                  <td>{incoming ? t.location : t.businessUnit}</td>
                  <td>
                    <Badge>{t.status}</Badge>
                  </td>
                  <td>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <EmptyState title={`No Goods-${direction} transactions`} />
          )}
        </div>
        <Pagination
          page={page}
          pages={Math.ceil(filtered.length / 10)}
          onChange={setPage}
          total={filtered.length}
          from={(page - 1) * 10 + 1}
          to={Math.min(page * 10, filtered.length)}
        />
      </section>
      <Modal
        open={open}
        title={`New Goods-${direction}`}
        description={`Step ${step} of 4`}
        onClose={() => {
          setOpen(false)
          setStep(1)
        }}
        wide
      >
        <div className="stepper">
          {[
            "Transaction",
            "Select Assets",
            incoming ? "Destination" : "Recipient",
            "Review",
          ].map((x, i) => (
            <div className={step >= i + 1 ? "active" : ""} key={x}>
              <i>{i + 1}</i>
              <span>{x}</span>
            </div>
          ))}
        </div>
        {step === 1 && (
          <div className="form-grid">
            <Input
              label="Transaction date *"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
            <Select
              label="Transaction type *"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              options={types}
            />
            <Input
              label="Document number *"
              value={form.document}
              onChange={(e) => set("document", e.target.value)}
            />
            {incoming && (
              <Input
                label="PO Number"
                value={form.po}
                onChange={(e) => set("po", e.target.value)}
              />
            )}
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            <Select
              label="Asset *"
              value={form.assetId}
              onChange={(e) => set("assetId", e.target.value)}
              options={[
                { value: "", label: "Search or select asset" },
                ...assets
                  .filter((a) => incoming || a.condition !== "Disposal")
                  .map((a) => ({
                    value: a.id,
                    label: `${a.id} · ${a.brand} ${a.model}`,
                  })),
              ]}
            />
            <Input
              label="Quantity *"
              type="number"
              min="1"
              max={incoming ? 999 : selectedAsset?.quantity}
              value={form.quantity}
              onChange={(e) => set("quantity", Number(e.target.value))}
            />
            {selectedAsset && (
              <div className="selection-summary">
                <Badge>{selectedAsset.condition}</Badge>
                <strong>
                  {selectedAsset.brand} {selectedAsset.model}
                </strong>
                <span>
                  {selectedAsset.location} · Available {selectedAsset.quantity}{" "}
                  {selectedAsset.uom}
                </span>
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="form-grid">
            <Input
              label={incoming ? "Source / sender *" : "Recipient / employee *"}
              value={form.user}
              onChange={(e) => set("user", e.target.value)}
            />
            <Select
              label={
                incoming ? "Destination location *" : "Destination / provider *"
              }
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              options={[
                { value: "", label: "Select location" },
                "Jakarta HQ",
                "Surabaya Office",
                "Cikarang Warehouse",
                "Balikpapan Site",
                "Medan Branch",
                "External Service Provider",
              ]}
            />
            <Select
              label="Business Unit *"
              value={form.businessUnit}
              onChange={(e) => set("businessUnit", e.target.value)}
              options={[
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
            <Input
              label="Supporting documents (local preview)"
              type="file"
              multiple
            />
          </div>
        )}
        {step === 4 && (
          <div className="review-panel">
            <h3>Review transaction</h3>
            <dl>
              <div>
                <dt>Direction</dt>
                <dd>
                  <Badge>{direction}</Badge>
                </dd>
              </div>
              <div>
                <dt>Document</dt>
                <dd>{form.document || "—"}</dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>
                  <code>{form.assetId || "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{form.type}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{form.quantity}</dd>
              </div>
              <div>
                <dt>{incoming ? "Source" : "Recipient"}</dt>
                <dd>{form.user || "—"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{form.location || "—"}</dd>
              </div>
            </dl>
          </div>
        )}
        <div className="form-actions">
          <Button
            variant="secondary"
            onClick={() => (step === 1 ? setOpen(false) : setStep(step - 1))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 4 ? (
            <Button
              disabled={
                (step === 1 && !form.document) ||
                (step === 2 && !form.assetId) ||
                (step === 3 && (!form.user || !form.location))
              }
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={submit}>Confirm transaction</Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
