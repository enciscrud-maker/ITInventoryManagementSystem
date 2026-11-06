"use client"

// Impact preview for the Complete dialog.

import { useMemo, useRef, useState, type FormEvent } from "react"

import {
  Plus,
  CheckCircle2,
  ScanLine,
  Trash2,
  Download,
  Camera,
  Upload,
  FileText,
  QrCode,
} from "lucide-react"

import type { Asset, Audit } from "@/data/demoData"

import { useInventory } from "@/context/InventoryContext"

import { useAuth } from "@/auth/AuthContext"

import {
  canApprove,
  canCreateInModule,
  canUpdate,
} from "@/services/authorizationService"

import { downloadCsv, today } from "@/utils/helpers"

import { getLocationsForBusinessUnit } from "@/utils/masterData"

import { MAX_EVIDENCE_PER_ASSET, buildHistoricalMap } from "@/utils/audit"

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

    auditDataStatus,

    auditDataError,

    assets,

    master,

    businessUnit,

    refreshAudits,

    loadAuditDetails,

    saveAudit,

    updateAuditItem,

    uploadAuditEvidence,

    removeAuditEvidence,

    scanAuditAsset,

    importAuditQuantities,

    resolveUnscannedAudit,

    completeAudit,

    setSelectedAsset,

    notify,
  } = useInventory()

  const { currentUser } = useAuth()

  const approver = canApprove(currentUser, "stock-opname")

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [create, setCreate] = useState(false)

  const [creationStep, setCreationStep] = useState<1 | 2 | 3>(1)

  const [createError, setCreateError] = useState("")

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])

  const [draftAssetSearch, setDraftAssetSearch] = useState("")

  const [creatingAudit, setCreatingAudit] = useState(false)

  const creatingAuditRef = useRef(false)

  const [complete, setComplete] = useState(false)

  const [resolveOpen, setResolveOpen] = useState(false)

  const [updateLocation, setUpdateLocation] = useState(false)

  const [scannerOpen, setScannerOpen] = useState(false)

  const [importOpen, setImportOpen] = useState(false)

  const [evidenceFor, setEvidenceFor] = useState<string | null>(null)

  const [exporting, setExporting] = useState(false)

  const [completing, setCompleting] = useState(false)

  const [search, setSearch] = useState("")

  const [draft, setDraft] = useState({
    name: "",

    date: today(),

    businessUnit: "",

    businessUnitId: "",
  })

  const selected = audits.find((a) => a.id === selectedId)

  const historical = useMemo(
    () => buildHistoricalMap(audits, selectedId ?? ""),

    [audits, selectedId],
  )

  const scopedAudits = audits.filter(
    (a) =>
      (businessUnit === "All Business Units" ||
        a.businessUnitId === businessUnit) &&
      (!search ||
        [a.name, a.id, a.auditor]

          .join(" ")

          .toLowerCase()

          .includes(search.toLowerCase())),
  )

  const availableDraftAssets = assets.filter((asset) => {
    if (asset.businessUnitId !== draft.businessUnitId) return false

    const query = draftAssetSearch.trim().toLowerCase()

    return (
      !query ||
      [
        asset.id,

        asset.assetCode,

        asset.brand,

        asset.model,

        asset.serial,

        asset.category,
      ]

        .join(" ")

        .toLowerCase()

        .includes(query)
    )
  })

  const closeCreate = () => {
    if (creatingAuditRef.current) return

    setCreate(false)

    setCreationStep(1)

    setCreateError("")

    setSelectedAssetIds([])

    setDraftAssetSearch("")
  }

  const continueToAssetSelection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const unit = master.businessUnits.find(
      (item) => item.id === draft.businessUnitId,
    )

    if (!draft.name.trim() || !draft.date || !unit) {
      setCreateError(
        "Complete all required session information before continuing.",
      )

      return
    }

    setCreateError("")

    setCreationStep(2)
  }

  const continueToReview = () => {
    const selectedIds = selectedAssetIds.filter(Boolean)

    if (
      !selectedIds.length ||
      selectedAssetIds.some((id) => !id) ||
      new Set(selectedIds).size !== selectedIds.length
    ) {
      setCreateError("Select at least one asset and remove any empty rows.")

      return
    }

    const selectedAssets = selectedIds.map((id) =>
      assets.find((asset) => asset.id === id),
    )

    if (
      selectedAssets.some(
        (asset) => !asset || asset.businessUnitId !== draft.businessUnitId,
      )
    ) {
      setCreateError(
        "Every selected asset must belong to the selected Business Unit.",
      )

      return
    }

    setCreateError("")

    setCreationStep(3)
  }

  const submitCreateAudit = async () => {
    if (creatingAuditRef.current) return

    const unit = master.businessUnits.find(
      (item) => item.id === draft.businessUnitId,
    )

    const selectedIds = selectedAssetIds.filter(Boolean)

    const selectedAssets = selectedIds.map((id) =>
      assets.find((asset) => asset.id === id),
    )

    if (
      !draft.name.trim() ||
      !draft.date ||
      !unit ||
      !selectedIds.length ||
      selectedAssetIds.some((id) => !id) ||
      new Set(selectedIds).size !== selectedIds.length ||
      selectedAssets.some(
        (asset) => !asset || asset.businessUnitId !== draft.businessUnitId,
      )
    ) {
      setCreateError(
        "Review the required session information and selected assets.",
      )

      return
    }

    const validAssets = selectedAssets.filter(
      (asset): asset is Asset => asset !== undefined,
    )

    const audit: Audit = {
      id: "",

      name: draft.name.trim(),

      date: draft.date,

      auditor: currentUser.name,

      auditorUserId: currentUser.id,

      businessUnit: unit.name,

      businessUnitId: unit.id,

      location: "All Locations",

      status: "InProgress",

      items: validAssets.map((asset) => ({
        assetId: asset.id,

        assetCode: asset.assetCode,

        systemQty: asset.quantity,

        systemLocation: asset.location,

        systemLocationId: asset.locationId,

        physicalQty: null,

        actualLocation: asset.location,

        actualLocationId: asset.locationId,

        finding: "Unverified",

        confirmed: false,

        notes: "",

        evidence: [],
      })),
    }

    creatingAuditRef.current = true

    setCreatingAudit(true)

    setCreateError("")

    try {
      const saved = await saveAudit(audit)

      if (!saved) return

      setSelectedId(saved.id)

      setCreate(false)

      setCreationStep(1)

      setSelectedAssetIds([])

      setDraftAssetSearch("")
    } catch (error) {
      notify(
        error instanceof Error
          ? `Stock Opname could not be created: ${error.message}`
          : "Stock Opname could not be created. Your draft is still available.",
      )
    } finally {
      creatingAuditRef.current = false

      setCreatingAudit(false)
    }
  }

  const openAudit = async (id: string) => {
    const detail = await loadAuditDetails(id)

    if (detail) setSelectedId(detail.id)
  }

  if (selected) {
    const locked = selected.status === "Completed"

    const editable = !locked && canUpdate(currentUser)

    const verified = selected.items.filter(
      (i) => i.finding !== "Unverified",
    ).length

    const confirmedCount = selected.items.filter((i) => i.confirmed).length

    const unscanned = selected.items.filter(
      (i) => i.physicalQty === null,
    ).length

    const counts = (name: string) =>
      selected.items.filter((i) => i.finding === name).length

    const query = search.toLowerCase()

    const filteredItems = selected.items.filter((i) => {
      if (!query) return true

      const asset = assets.find((a) => a.id === i.assetId)

      return [i.assetId, asset?.brand, asset?.model, asset?.serial]

        .join(" ")

        .toLowerCase()

        .includes(query)
    })

    const evidenceItem = selected.items.find((i) => i.assetId === evidenceFor)

    const evidenceAsset = assets.find((a) => a.id === evidenceFor)

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

      const uploads = await Promise.all(
        files

          .slice(0, slots)

          .map((file) => uploadAuditEvidence(selected.id, assetId, file)),
      )

      if (uploads.some((uploaded) => !uploaded))
        throw new Error("One or more evidence files could not be uploaded")

      if (files.length > slots)
        notify(`Only ${slots} photo(s) added (limit ${MAX_EVIDENCE_PER_ASSET})`)
    }

    return (
      <div className="page">
        <PageHeader
          title={selected.name}
          subtitle={`${selected.id} · ${selected.businessUnit} · ${selected.location}`}
          actions={
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Button
                variant="secondary"
                className="col-span-2 sm:col-auto"
                onClick={() => {
                  setSelectedId(null)

                  void refreshAudits()
                }}
              >
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
                  className="col-span-2 sm:col-auto"
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
            </div>
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

                  const past = historical.get(item.assetId)

                  const evidenceCount = item.evidence?.length ?? 0

                  const assetLabel = asset
                    ? `${asset.brand} ${asset.model}`.trim()
                    : item.assetName || item.assetCode || item.assetId

                  const canConfirm =
                    approver && editable && item.finding !== "Unverified"

                  return (
                    <tr key={item.assetId}>
                      <td>
                        {asset ? (
                          <button
                            className="link-code"
                            onClick={() => setSelectedAsset(asset)}
                          >
                            {item.assetId}
                          </button>
                        ) : (
                          item.assetId
                        )}
                      </td>
                      <td>
                        <strong>{assetLabel}</strong>
                        <small>{asset?.serial ?? item.assetCode ?? ""}</small>
                      </td>
                      <td>{item.systemLocation ?? asset?.location ?? "—"}</td>
                      <td className="numeric">
                        {item.systemQty ?? asset?.quantity ?? "—"}
                      </td>
                      <td className="numeric">{past ?? "-"}</td>
                      <td>
                        <input
                          className="cell-input numeric"
                          aria-label={`Physical quantity for ${item.assetId}`}
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
                          aria-label={`Actual location for ${item.assetId}`}
                          disabled={!editable}
                          value={item.actualLocationId ?? ""}
                          onChange={(e) =>
                            updateAuditItem(selected.id, item.assetId, {
                              actualLocationId: e.target.value,
                            })
                          }
                        >
                          {getLocationsForBusinessUnit(
                            master.locations,

                            selected.businessUnitId ?? "",
                          ).map((location) => (
                            <option key={location.id} value={location.id}>
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
                          aria-label={`Confirm ${item.assetId}`}
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
                          aria-label={`Notes for ${item.assetId}`}
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
          onRemove={(index) => {
            if (evidenceFor)
              void removeAuditEvidence(selected.id, evidenceFor, index)
          }}
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
                this session started (for example through Assets In/Out). Their
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
              disabled={completing}
              onClick={async () => {
                setCompleting(true)

                try {
                  if (await completeAudit(selected.id, { updateLocation }))
                    setComplete(false)
                } finally {
                  setCompleting(false)
                }
              }}
            >
              {completing ? "Completing..." : "Complete Audit"}
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
            disabled={!canCreateInModule(currentUser, "stock-opname")}
            onClick={() => {
              const unit =
                master.businessUnits.find((item) => item.id === businessUnit) ??
                master.businessUnits[0]

              setDraft({
                name: "",

                date: today(),

                businessUnit: unit?.name ?? "",

                businessUnitId: unit?.id ?? "",
              })

              setSelectedAssetIds([])

              setDraftAssetSearch("")

              setCreationStep(1)

              setCreateError("")

              setCreate(true)
            }}
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
        <Button
          variant="secondary"
          disabled={auditDataStatus === "loading"}
          onClick={() => void refreshAudits()}
        >
          {auditDataStatus === "loading" ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      {auditDataStatus === "error" && (
        <div className="error-summary" role="alert">
          <strong>Stock Opname could not be loaded</strong>
          <span>{auditDataError}</span>
        </div>
      )}
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
                const total = a.itemCount ?? a.items.length

                const hasVerifiedCount =
                  a.verifiedCount !== undefined || a.detailsLoaded

                const verified =
                  a.verifiedCount ??
                  a.items.filter((i) => i.finding !== "Unverified").length

                const pct = total ? Math.round((verified / total) * 100) : 0

                return (
                  <tr key={a.id} onClick={() => void openAudit(a.id)}>
                    <td>
                      <strong>{a.name}</strong>
                      <small>{a.id}</small>
                    </td>
                    <td>{a.date}</td>
                    <td>{a.auditor}</td>
                    <td>{a.businessUnit}</td>
                    <td>{a.location}</td>
                    <td>{total}</td>
                    <td>{hasVerifiedCount ? verified : "—"}</td>
                    <td>
                      {hasVerifiedCount ? (
                        <>
                          <progress
                            className="progress"
                            value={pct}
                            max="100"
                          />
                          <small>{pct}%</small>
                        </>
                      ) : (
                        <small>—</small>
                      )}
                    </td>
                    <td>
                      <Badge>{a.status}</Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void openAudit(a.id)}
                      >
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
        description={
          creationStep === 1
            ? "Enter the information for this Stock Opname session."
            : creationStep === 2
              ? "Select the assets to include in this session."
              : "Review the session information and selected assets."
        }
        onClose={closeCreate}
        wide
      >
        <div className="stepper audit-create-stepper">
          {["Session Information", "Asset Selection", "Review Session"].map(
            (label, index) => {
              const step = index + 1

              const completed = creationStep > step

              return (
                <div
                  className={
                    creationStep === step
                      ? "active"
                      : completed
                        ? "completed"
                        : ""
                  }
                  aria-current={creationStep === step ? "step" : undefined}
                  key={label}
                >
                  <i>{completed ? <CheckCircle2 size={15} /> : step}</i>
                  <span>{label}</span>
                </div>
              )
            },
          )}
        </div>
        {createError && (
          <div className="error-summary audit-create-error" role="alert">
            <strong>Please review this step</strong>
            <span>{createError}</span>
          </div>
        )}
        {creationStep === 1 ? (
          <form
            className="audit-session-form"
            noValidate
            onSubmit={continueToAssetSelection}
          >
            <div className="form-grid">
              <Input
                className="audit-session-name"
                label="Session name *"
                value={draft.name}
                required
                onChange={(e) => {
                  setDraft((v) => ({ ...v, name: e.target.value }))

                  setCreateError("")
                }}
              />
              <Input
                label="Audit date *"
                type="date"
                value={draft.date}
                required
                onChange={(e) => {
                  setDraft((v) => ({ ...v, date: e.target.value }))

                  setCreateError("")
                }}
              />
              <Select
                label="Business Unit *"
                value={draft.businessUnitId}
                required
                onChange={(e) => {
                  const unit = master.businessUnits.find(
                    (item) => item.id === e.target.value,
                  )

                  setDraft((v) => ({
                    ...v,

                    businessUnit: unit?.name ?? "",

                    businessUnitId: unit?.id ?? "",
                  }))

                  setSelectedAssetIds([])

                  setCreateError("")
                }}
                options={[
                  { value: "", label: "Select Business Unit" },

                  ...master.businessUnits.map((unit) => ({
                    value: unit.id,

                    label: unit.name,
                  })),
                ]}
              />
            </div>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit">Next</Button>
            </div>
          </form>
        ) : creationStep === 2 ? (
          <>
            <div className="audit-asset-picker">
              <div className="audit-asset-picker-toolbar">
                <SearchInput
                  value={draftAssetSearch}
                  onChange={(event) => setDraftAssetSearch(event.target.value)}
                  placeholder="Search assets by ID, code, brand, model, or serial..."
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    !availableDraftAssets.length ||
                    selectedAssetIds.some((id) => !id)
                  }
                  onClick={() => {
                    setSelectedAssetIds((ids) => [...ids, ""])

                    setCreateError("")
                  }}
                >
                  <Plus size={15} /> Add asset
                </Button>
              </div>
              {selectedAssetIds.length ? (
                <div className="table-scroll asset-entry-table audit-asset-table">
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Asset</th>
                        <th>Asset Details</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAssetIds.map((assetId, index) => {
                        const selectedAsset = assets.find(
                          (asset) => asset.id === assetId,
                        )

                        const options = [
                          ...(selectedAsset &&
                          !availableDraftAssets.some(
                            (asset) => asset.id === selectedAsset.id,
                          )
                            ? [selectedAsset]
                            : []),

                          ...availableDraftAssets.filter(
                            (asset) =>
                              asset.id === assetId ||
                              !selectedAssetIds.includes(asset.id),
                          ),
                        ]

                        return (
                          <tr key={`${index}-${assetId || "empty"}`}>
                            <td>{index + 1}</td>
                            <td>
                              <Select
                                aria-label={`Asset ${index + 1}`}
                                value={assetId}
                                onChange={(event) => {
                                  const nextId = event.target.value

                                  setSelectedAssetIds((ids) =>
                                    ids.map((id, row) =>
                                      row === index ? nextId : id,
                                    ),
                                  )

                                  setCreateError("")
                                }}
                                options={[
                                  { value: "", label: "Select asset" },

                                  ...options.map((asset) => ({
                                    value: asset.id,

                                    label: `${asset.assetCode ?? asset.id} · ${asset.brand} ${asset.model}`,
                                  })),
                                ]}
                              />
                            </td>
                            <td>
                              {selectedAsset ? (
                                <>
                                  <strong>
                                    {selectedAsset.brand} {selectedAsset.model}
                                  </strong>
                                  <small className="table-subline">
                                    {[
                                      selectedAsset.serial
                                        ? `SN ${selectedAsset.serial}`
                                        : "",

                                      selectedAsset.condition,

                                      selectedAsset.location,
                                    ]

                                      .filter(Boolean)

                                      .join(" · ")}
                                  </small>
                                </>
                              ) : (
                                <span className="muted">
                                  Select an asset to view its details.
                                </span>
                              )}
                            </td>
                            <td>
                              <Button
                                aria-label={`Remove asset ${index + 1}`}
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAssetIds((ids) =>
                                    ids.filter((_, row) => row !== index),
                                  )

                                  setCreateError("")
                                }}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No assets selected"
                  description="Add one or more assets belonging to this Business Unit."
                />
              )}
              {!availableDraftAssets.length && (
                <div className="audit-asset-empty" role="status">
                  {draftAssetSearch
                    ? "No assets match your search in this Business Unit."
                    : "No assets are available for this Business Unit."}
                </div>
              )}
              <div className="transaction-total">
                <span>Selected assets</span>
                <strong>
                  {selectedAssetIds.filter(Boolean).length} assets
                </strong>
              </div>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCreateError("")

                  setCreationStep(1)
                }}
              >
                Back
              </Button>
              <Button type="button" onClick={continueToReview}>
                Next
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="transaction-review">
              <section className="detail-section">
                <h3>Session Information</h3>
                <dl>
                  <div>
                    <dt>Session Name</dt>
                    <dd>{draft.name.trim()}</dd>
                  </div>
                  <div>
                    <dt>Audit Date</dt>
                    <dd>{draft.date}</dd>
                  </div>
                  <div>
                    <dt>Business Unit</dt>
                    <dd>{draft.businessUnit}</dd>
                  </div>
                  <div>
                    <dt>Auditor</dt>
                    <dd>
                      {currentUser.name}
                      <small className="table-subline">
                        User ID: {currentUser.id}
                      </small>
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="detail-section">
                <h3>Selected Assets</h3>
                <div className="table-scroll transaction-asset-summary">
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Asset</th>
                        <th>Quantity</th>
                        <th>Serial Number</th>
                        <th>Asset Information</th>
                        <th>Condition</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAssetIds

                        .filter(Boolean)

                        .map((assetId, index) => {
                          const asset = assets.find(
                            (item) => item.id === assetId,
                          )

                          if (!asset) return null

                          return (
                            <tr key={asset.id}>
                              <td>{index + 1}</td>
                              <td>
                                <strong>
                                  {asset.brand} {asset.model}
                                </strong>
                                <small className="table-subline">
                                  {asset.assetCode ?? asset.id}
                                </small>
                              </td>
                              <td className="numeric">{asset.quantity}</td>
                              <td>{asset.serial || "—"}</td>
                              <td>
                                {asset.description ||
                                  [asset.category, asset.group, asset.type]

                                    .filter(Boolean)

                                    .join(" · ") ||
                                  "—"}
                              </td>
                              <td>{asset.condition || "—"}</td>
                              <td>{asset.location || "—"}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="transaction-total">
                  <span>Total assets selected</span>
                  <strong>
                    {selectedAssetIds.filter(Boolean).length} assets
                  </strong>
                </div>
              </section>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={creatingAudit}
                onClick={() => {
                  setCreateError("")

                  setCreationStep(2)
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={creatingAudit}
                onClick={() => void submitCreateAudit()}
              >
                {creatingAudit ? "Submitting..." : "Submit Session"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
