"use client"

// Impact preview for the Complete dialog.

import { useMemo, useState } from "react"
import {
  Plus,
  CheckCircle2,
  ScanLine,
  Download,
  Camera,
  Upload,
  FileText,
  QrCode,
} from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import { useAuth } from "@/auth/AuthContext"
import {
  canApprove,
  canCreate,
  canUpdate,
} from "@/services/authorizationService"
import type { Audit } from "@/data/demoData"
import { downloadCsv, today } from "@/utils/helpers"
import {
  MAX_EVIDENCE_PER_ASSET,
  buildHistoricalMap,
  compressImage,
} from "@/utils/audit"
import { exportEvidencePdf } from "@/utils/auditPdf"
import { AuditScanner } from "@/components/AuditScanner"
import { AuditImportModal } from "@/components/AuditImportModal"
import { AuditEvidenceModal } from "@/components/AuditEvidenceModal"
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
} from "@/components/ui"

export default function Audits() {
  const {
    audits,
    assets,
    master,
    businessUnit,
    saveAudit,
    updateAuditItem,
    scanAuditAsset,
    importAuditQuantities,
    resolveUnscannedAudit,
    completeAudit,
    setSelectedAsset,
    notify,
  } = useInventory()
  const { currentUser } = useAuth()
  const approver = canApprove(currentUser)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const [complete, setComplete] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [updateLocation, setUpdateLocation] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState({
    name: "",
    date: today(),
    businessUnit:
      businessUnit ===
      "All Business Units"
        ? "MBP"
        : businessUnit,
    location: "All Locations",
    auditor: "",
  })
  const selected = audits.find(
    (a) =>
      a.id ===
      selectedId,
  )
  const historical = useMemo(
    () =>
      buildHistoricalMap(
        audits,
        selectedId ??
          "",
      ),
    [audits, selectedId],
  )
  const scopedAudits = audits.filter(
    (a) =>
      (businessUnit ===
        "All Business Units" ||
        a.businessUnit ===
          businessUnit) &&
      (!search ||
        [a.name, a.id, a.auditor]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  )
  const createAudit = () => {
    const scoped = assets.filter(
      (a) =>
        a.businessUnit ===
          draft.businessUnit &&
        (draft.location ===
          "All Locations" ||
          a.location ===
            draft.location),
    )
    const audit: Audit = {
      id: `AUD-${Date.now()}`,
      ...draft,
      status: "In Progress",
      scanLog: [],
      items: scoped.map((a) => ({
        assetId: a.id,
        systemQty: a.quantity,
        systemLocation: a.location,
        physicalQty: null,
        actualLocation: a.location,
        finding: "Unverified",
        confirmed: false,
        notes: "",
        evidence: [],
      })),
    }
    saveAudit(audit)
    setSelectedId(audit.id)
    setCreate(false)
  }

  if (selected) {
    const locked =
      selected.status ===
      "Completed"
    const editable =
      !locked &&
      canUpdate(currentUser)
    const verified = selected.items.filter(
      (i) =>
        i.finding !==
        "Unverified",
    ).length
    const confirmedCount = selected.items.filter((i) => i.confirmed).length
    const unscanned = selected.items.filter(
      (i) =>
        i.physicalQty ===
        null,
    ).length
    const counts = (name: string) =>
      selected.items.filter(
        (i) =>
          i.finding ===
          name,
      ).length
    const query = search.toLowerCase()
    const filteredItems = selected.items.filter((i) => {
      if (!query) return true
      const asset = assets.find(
        (a) =>
          a.id ===
          i.assetId,
      )
      return [i.assetId, asset?.brand, asset?.model, asset?.serial]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
    const evidenceItem = selected.items.find(
      (i) =>
        i.assetId ===
        evidenceFor,
    )
    const evidenceAsset = assets.find(
      (a) =>
        a.id ===
        evidenceFor,
    )
    const confirmedItems = selected.items.filter((i) => i.confirmed)
    const impact = {
      confirmed: confirmedItems.length,
      unconfirmed: selected.items.length - confirmedItems.length,
      qtyChanges: confirmedItems.filter(
        (i) =>
          i.physicalQty !== null &&
          assets.find((a) => a.id === i.assetId)?.quantity !== i.physicalQty,
      ).length,
      drifted: confirmedItems.filter((i) => {
        const asset = assets.find((a) => a.id === i.assetId)
        return asset && asset.quantity !== (i.systemQty ?? asset.quantity)
      }).length,
      locationDiffs: confirmedItems.filter((i) => {
        const asset = assets.find((a) => a.id === i.assetId)
        return asset && i.actualLocation && i.actualLocation !== asset.location
      }).length,
    }

    const exportFindings = () =>
      downloadCsv(
        `${selected.id}-findings.csv`,
        selected.items.map((item) => {
          const asset = assets.find((a) => a.id === item.assetId)
          return {
            "Asset ID": item.assetId,
            "Asset / Model": asset ? `${asset.brand} ${asset.model}` : "",
            "System Location": item.systemLocation ?? "",
            "System Qty": item.systemQty ?? "",
            "Historical Qty": historical.get(item.assetId) ?? "",
            "Physical Qty": item.physicalQty ?? "",
            "Actual Location": item.actualLocation,
            Finding: item.finding,
            "Evidence Count": item.evidence?.length ?? 0,
            Confirmed: item.confirmed ? "Yes" : "No",
            "Confirmed By": item.confirmedBy ?? "",
            "Confirmed At": item.confirmedAt ?? "",
            Notes: item.notes,
          }
        }),
      )
    const exportEvidence = async () => {
      setExporting(true)
      try {
        const total = await exportEvidencePdf(selected, assets)
        notify(
          total
            ? `Evidence PDF created for ${total} assets`
            : "No evidence has been added in this session",
        )
      } catch (error) {
        notify(error instanceof Error ? error.message : "Evidence PDF failed")
      } finally {
        setExporting(false)
      }
    }
    const addEvidence = async (assetId: string, files: File[]) => {
      const current =
        selected.items.find((i) => i.assetId === assetId)?.evidence?.length ?? 0
      const slots = MAX_EVIDENCE_PER_ASSET - current
      if (slots <= 0)
        throw new Error(`Maximum ${MAX_EVIDENCE_PER_ASSET} photos per asset`)
      const images = await Promise.all(
        files.slice(0, slots).map((file) => compressImage(file)),
      )
      updateAuditItem(selected.id, assetId, { addEvidence: images })
      if (files.length > slots)
        notify(`Only ${slots} photo(s) added (limit ${MAX_EVIDENCE_PER_ASSET})`)
    }

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
              {!locked && (
                <>
                  <Button
                    variant={scannerOpen ? "primary" : "secondary"}
                    disabled={!editable}
                    onClick={() => setScannerOpen((v) => !v)}
                  >
                    <QrCode size={16} /> Scan QR
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!editable}
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload size={16} /> Import Qty
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                disabled={exporting}
                onClick={exportEvidence}
              >
                <FileText size={16} />{" "}
                {exporting ? "Building PDF…" : "Export Evidence"}
              </Button>
              <Button variant="secondary" onClick={exportFindings}>
                <Download size={16} /> Export Findings
              </Button>
              {!locked && (
                <Button
                  disabled={!approver}
                  title={
                    approver
                      ? undefined
                      : "Only approvers can complete a stock opname"
                  }
                  onClick={() => setComplete(true)}
                >
                  <CheckCircle2 size={16} /> Complete Audit
                </Button>
              )}
            </>
          }
        />
        {scannerOpen && editable && (
          <AuditScanner
            onScan={(code) => scanAuditAsset(selected.id, code)}
            onClose={() => setScannerOpen(false)}
          />
        )}
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
            placeholder="Search Asset ID or model..."
          />
          <Badge>{selected.status}</Badge>
          {!locked && unscanned > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!editable}
              onClick={() => setResolveOpen(true)}
            >
              Mark {unscanned} uncounted as not found
            </Button>
          )}
          <span className="progress-label">
            {verified} / {selected.items.length} verified · {confirmedCount}{" "}
            confirmed
          </span>
        </div>
        <section className="table-card audit-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID Asset</th>
                  <th>Asset / Model</th>
                  <th>System Location</th>
                  <th>System Qty</th>
                  <th>Historical Qty</th>
                  <th>Physical Qty</th>
                  <th>Actual Location</th>
                  <th>Finding</th>
                  <th>Evidence</th>
                  <th>Confirm</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const asset = assets.find((a) => a.id === item.assetId)
                  if (!asset) return null
                  const past = historical.get(item.assetId)
                  const evidenceCount = item.evidence?.length ?? 0
                  const canConfirm =
                    approver && editable && item.finding !== "Unverified"
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
                      <td>{item.systemLocation ?? asset.location}</td>
                      <td className="numeric">
                        {item.systemQty ?? asset.quantity}
                      </td>
                      <td className="numeric">{past ?? "-"}</td>
                      <td>
                        <input
                          className="cell-input numeric"
                          aria-label={`Physical quantity for ${asset.id}`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          disabled={!editable}
                          value={item.physicalQty ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value
                            const qty = Number(raw)
                            if (raw !== "" && !Number.isFinite(qty)) return
                            updateAuditItem(selected.id, item.assetId, {
                              physicalQty:
                                raw === ""
                                  ? null
                                  : Math.max(0, Math.floor(qty)),
                            })
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className="cell-input"
                          aria-label={`Actual location for ${asset.id}`}
                          disabled={!editable}
                          value={item.actualLocation}
                          onChange={(e) =>
                            updateAuditItem(selected.id, item.assetId, {
                              actualLocation: e.target.value,
                            })
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
                        <button
                          type="button"
                          className="evidence-btn"
                          onClick={() => setEvidenceFor(item.assetId)}
                        >
                          <Camera size={15} />
                          {evidenceCount ? `View (${evidenceCount})` : "Add"}
                        </button>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Confirm ${asset.id}`}
                          disabled={!canConfirm}
                          title={
                            item.confirmed
                              ? `Confirmed by ${item.confirmedBy ?? "-"}`
                              : !approver
                                ? "Only approvers can confirm"
                                : item.finding === "Unverified"
                                  ? "Count this asset first"
                                  : undefined
                          }
                          checked={item.confirmed}
                          onChange={(e) =>
                            updateAuditItem(selected.id, item.assetId, {
                              confirmed: e.target.checked,
                            })
                          }
                        />
                        {item.confirmed && item.confirmedBy && (
                          <small>{item.confirmedBy}</small>
                        )}
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          aria-label={`Notes for ${asset.id}`}
                          disabled={!editable}
                          value={item.notes}
                          onChange={(e) =>
                            updateAuditItem(selected.id, item.assetId, {
                              notes: e.target.value,
                            })
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

        <AuditEvidenceModal
          open={Boolean(evidenceItem)}
          title={
            evidenceAsset
              ? `${evidenceAsset.id} · ${evidenceAsset.brand} ${evidenceAsset.model}`
              : ""
          }
          images={evidenceItem?.evidence ?? []}
          readOnly={!editable}
          onClose={() => setEvidenceFor(null)}
          onAdd={(files) => addEvidence(evidenceFor ?? "", files)}
          onRemove={(index) =>
            evidenceFor &&
            updateAuditItem(selected.id, evidenceFor, {
              removeEvidenceAt: index,
            })
          }
        />
        <AuditImportModal
          open={importOpen}
          items={selected.items}
          onClose={() => setImportOpen(false)}
          onCommit={(rows) => importAuditQuantities(selected.id, rows)}
        />
        <ConfirmDialog
          open={resolveOpen}
          title="Mark uncounted assets as not found?"
          description={`${unscanned} assets have no count yet. Their physical qty will be set to 0 (finding "Fisik tidak ada" when the system qty is above 0). An approver can then confirm them so inventory is adjusted when the session is completed.`}
          confirmLabel="Mark as not found"
          onClose={() => setResolveOpen(false)}
          onConfirm={() => {
            resolveUnscannedAudit(selected.id)
            setResolveOpen(false)
          }}
        />
        <Modal
          open={complete}
          title="Complete audit session?"
          description="Completing locks this session and updates Asset Inventory."
          onClose={() => setComplete(false)}
        >
          <div className="complete-summary">
            <p>
              <strong>{impact.confirmed}</strong> confirmed assets will be
              applied to Asset Inventory (<strong>{impact.qtyChanges}</strong>{" "}
              with a quantity change).
            </p>
            <p>
              <strong>{impact.unconfirmed}</strong> unconfirmed assets will not
              change inventory.
              {unscanned > 0 &&
                ` ${unscanned} of them were never counted and will be closed as physical qty 0 (not found).`}
            </p>
            {impact.drifted > 0 && (
              <p className="error">
                {impact.drifted} confirmed assets changed in inventory after
                this session started (for example through Goods In/Out). Their
                quantity will be replaced by the counted physical qty.
              </p>
            )}
            {impact.locationDiffs > 0 && (
              <label className="complete-option">
                <input
                  type="checkbox"
                  checked={updateLocation}
                  onChange={(e) => setUpdateLocation(e.target.checked)}
                />
                Also update the location of {impact.locationDiffs} confirmed
                assets to their Actual Location
              </label>
            )}
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setComplete(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (completeAudit(selected.id, { updateLocation }))
                  setComplete(false)
              }}
            >
              Complete Audit
            </Button>
          </div>
        </Modal>
      </div>
    )
  }
  return (
    <div className="page">
      <PageHeader
        title="Stock Opname"
        subtitle="Compare system inventory with physical verification results."
        actions={
          <Button
            disabled={!canCreate(currentUser)}
            onClick={() => setCreate(true)}
          >
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
