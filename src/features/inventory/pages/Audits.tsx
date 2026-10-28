"use client"

import { useMemo, useState } from "react"
import { Plus, CheckCircle2, ScanLine, Download, Camera } from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import type { Audit, AuditItem } from "@/data/demoData"
import { calculateFinding, downloadCsv, today } from "@/utils/helpers"
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui"

export default function Audits() {
  const { audits, assets, master, businessUnit, saveAudit, setSelectedAsset } =
    useInventory()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const [complete, setComplete] = useState(false)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState({
    name: "",
    date: today(),
    businessUnit: businessUnit === "All Business Units" ? "MBP" : businessUnit,
    location: "All Locations",
    auditor: "",
  })
  const selected = audits.find((a) => a.id === selectedId)
  const scopedAudits = audits.filter(
    (a) =>
      (businessUnit === "All Business Units" ||
        a.businessUnit === businessUnit) &&
      (!search ||
        [a.name, a.id, a.auditor]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  )
  const createAudit = () => {
    const scoped = assets.filter(
      (a) =>
        a.businessUnit === draft.businessUnit &&
        (draft.location === "All Locations" || a.location === draft.location),
    )
    const audit: Audit = {
      id: `AUD-${Date.now()}`,
      ...draft,
      status: "In Progress",
      items: scoped.map((a) => ({
        assetId: a.id,
        physicalQty: null,
        actualLocation: a.location,
        finding: "Unverified",
        confirmed: false,
        notes: "",
      })),
    }
    saveAudit(audit)
    setSelectedId(audit.id)
    setCreate(false)
  }
  const updateItem = (item: AuditItem, changes: Partial<AuditItem>) => {
    if (!selected) return
    const asset = assets.find((a) => a.id === item.assetId)
    if (!asset) return
    const next = { ...item, ...changes }
    next.finding = calculateFinding(
      asset.quantity,
      next.physicalQty,
      asset.location,
      next.actualLocation,
    )
    saveAudit({
      ...selected,
      items: selected.items.map((x) => (x.assetId === item.assetId ? next : x)),
    })
  }
  if (selected) {
    const verified = selected.items.filter(
      (i) => i.finding !== "Unverified",
    ).length
    const counts = (name: string) =>
      selected.items.filter((i) => i.finding === name).length
    const filteredItems = selected.items.filter(
      (i) => !search || i.assetId.toLowerCase().includes(search.toLowerCase()),
    )
    return (
      <div className="page">
        <PageHeader
          title={selected.name}
          subtitle={`${selected.id} · ${selected.businessUnit} · ${selected.location}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => setSelectedId(null)}>
                Back to sessions
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(`${selected.id}-findings.csv`, selected.items)
                }
              >
                <Download size={16} /> Export Findings
              </Button>
              <Button onClick={() => setComplete(true)}>
                <CheckCircle2 size={16} /> Complete Audit
              </Button>
            </>
          }
        />
        <div className="audit-summary">
          <StatCard
            label="Total Assets"
            value={selected.items.length}
            icon={<ScanLine size={18} />}
          />
          <StatCard
            label="Verified"
            value={verified}
            icon={<CheckCircle2 size={18} />}
          />
          <StatCard
            label="Unverified"
            value={counts("Unverified")}
            icon={<ScanLine size={18} />}
          />
          <StatCard
            label="Match"
            value={counts("Match")}
            icon={<CheckCircle2 size={18} />}
          />
          <StatCard
            label="Data differs"
            value={counts("Fisik ada data berbeda")}
            icon={<ScanLine size={18} />}
          />
          <StatCard
            label="Not found"
            value={counts("Fisik tidak ada")}
            icon={<ScanLine size={18} />}
          />
          <StatCard
            label="Reconciliation"
            value={`${
              verified ? Math.round((counts("Match") / verified) * 100) : 0
            }%`}
            icon={<CheckCircle2 size={18} />}
          />
        </div>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan or search Asset ID..."
          />
          <Badge>{selected.status}</Badge>
          <span className="progress-label">
            {verified} / {selected.items.length} verified
          </span>
        </div>
        <section className="table-card audit-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset / Model</th>
                  <th>System Location</th>
                  <th>System Qty</th>
                  <th>Physical Qty</th>
                  <th>Actual Location</th>
                  <th>Finding</th>
                  <th>Evidence</th>
                  <th>Confirmed</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const asset = assets.find((a) => a.id === item.assetId)
                  if (!asset) return null
                  return (
                    <tr key={item.assetId}>
                      <td>
                        <button
                          className="link-code"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          {item.assetId}
                        </button>
                      </td>
                      <td>
                        <strong>
                          {asset.brand} {asset.model}
                        </strong>
                        <small>{asset.serial}</small>
                      </td>
                      <td>{asset.location}</td>
                      <td className="numeric">{asset.quantity}</td>
                      <td>
                        <input
                          className="cell-input numeric"
                          aria-label={`Physical quantity for ${asset.id}`}
                          type="number"
                          min="0"
                          value={item.physicalQty ?? ""}
                          onChange={(e) =>
                            updateItem(item, {
                              physicalQty:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="cell-input"
                          aria-label={`Actual location for ${asset.id}`}
                          value={item.actualLocation}
                          onChange={(e) =>
                            updateItem(item, { actualLocation: e.target.value })
                          }
                        >
                          {master.locations.map((location) => (
                            <option key={location.id} value={location.name}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Badge>{item.finding}</Badge>
                      </td>
                      <td>
                        <label className="evidence-btn">
                          <Camera size={15} />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file)
                                updateItem(item, {
                                  evidence: URL.createObjectURL(file),
                                })
                            }}
                          />
                          {item.evidence ? "Preview" : "Add"}
                        </label>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Confirm ${asset.id}`}
                          checked={item.confirmed}
                          onChange={(e) =>
                            updateItem(item, { confirmed: e.target.checked })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          aria-label={`Notes for ${asset.id}`}
                          value={item.notes}
                          onChange={(e) =>
                            updateItem(item, { notes: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!filteredItems.length && <EmptyState />}
          </div>
        </section>
        <ConfirmDialog
          open={complete}
          title="Complete audit session?"
          description={
            verified < selected.items.length
              ? `${selected.items.length - verified} assets remain unverified. Completion requires all records to be checked.`
              : "This locks the session as completed. You can still export its findings."
          }
          confirmLabel="Complete Audit"
          onClose={() => setComplete(false)}
          onConfirm={() => {
            if (verified < selected.items.length) return
            saveAudit({ ...selected, status: "Completed" })
            setComplete(false)
          }}
        />
      </div>
    )
  }
  return (
    <div className="page">
      <PageHeader
        title="Stock Opname"
        subtitle="Compare system inventory with physical verification results."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} /> Create Audit Session
          </Button>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search session, ID, auditor..."
        />
      </div>
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Date</th>
                <th>Auditor</th>
                <th>Business Unit</th>
                <th>Location</th>
                <th>Total</th>
                <th>Verified</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scopedAudits.map((a) => {
                const verified = a.items.filter(
                  (i) => i.finding !== "Unverified",
                ).length
                const pct = a.items.length
                  ? Math.round((verified / a.items.length) * 100)
                  : 0
                return (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)}>
                    <td>
                      <strong>{a.name}</strong>
                      <small>{a.id}</small>
                    </td>
                    <td>{a.date}</td>
                    <td>{a.auditor}</td>
                    <td>{a.businessUnit}</td>
                    <td>{a.location}</td>
                    <td>{a.items.length}</td>
                    <td>{verified}</td>
                    <td>
                      <progress className="progress" value={pct} max="100" />
                      <small>{pct}%</small>
                    </td>
                    <td>
                      <Badge>{a.status}</Badge>
                    </td>
                    <td>
                      <Button size="sm" variant="ghost">
                        Open
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={create}
        title="Create Audit Session"
        description="Build a physical verification scope from current system inventory."
        onClose={() => setCreate(false)}
      >
        <div className="form-grid">
          <Input
            label="Session name *"
            value={draft.name}
            onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
          />
          <Input
            label="Audit date *"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((v) => ({ ...v, date: e.target.value }))}
          />
          <Select
            label="Business Unit *"
            value={draft.businessUnit}
            onChange={(e) =>
              setDraft((v) => ({ ...v, businessUnit: e.target.value }))
            }
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
          <Select
            label="Location scope"
            value={draft.location}
            onChange={(e) =>
              setDraft((v) => ({ ...v, location: e.target.value }))
            }
            options={[
              "All Locations",
              ...master.locations.map((location) => location.name),
            ]}
          />
          <Input
            label="Assigned auditor *"
            value={draft.auditor}
            onChange={(e) =>
              setDraft((v) => ({ ...v, auditor: e.target.value }))
            }
          />
        </div>
        <div className="scope-preview">
          {
            assets.filter(
              (a) =>
                a.businessUnit === draft.businessUnit &&
                (draft.location === "All Locations" ||
                  a.location === draft.location),
            ).length
          }{" "}
          assets will be included.
        </div>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setCreate(false)}>
            Cancel
          </Button>
          <Button
            disabled={!draft.name || !draft.auditor}
            onClick={createAudit}
          >
            Create Session
          </Button>
        </div>
      </Modal>
    </div>
  )
}
