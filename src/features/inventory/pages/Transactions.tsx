"use client"

import { useMemo, useRef, useState } from "react"
import {
  Boxes,
  Clock,
  PackageMinus,
  PackagePlus,
  Plus,
  Trash2,
} from "lucide-react"
import { useInventory } from "@/context/InventoryContext"
import type {
  Asset,
  Transaction,
  TransactionAssetItem,
  TransactionAttachment,
  TransactionParty,
  TransactionStatus,
} from "@/data/demoData"
import { businessUnits, locations } from "@/data/demoData"
import { formatDate, today } from "@/utils/helpers"
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
  StatCard,
  Textarea,
} from "@/components/ui"

const statuses: TransactionStatus[] = ["In Progress", "Completed"]
const goodsInTypes = ["Return", "New Unit", "After Service"]
const goodsOutTypes = [
  "Borrowing",
  "Service",
  "Disposal",
  "Off Lease",
  "Handover",
]
const destinationOptions = [
  ...locations,
  "External Service Provider",
  "Employee / Borrower",
  "Other",
]

type TransactionForm = {
  id: string
  document: string
  businessUnit: string
  requestDate: string
  formIssueDate: string
  party: TransactionParty
  type: string
  assets: TransactionAssetItem[]
  location: string
  supportingDocuments: TransactionAttachment[]
  requestNumber: string
  approverName: string
  inventoryNotes: string
}

const newRowId = () =>
  `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const emptyAssetRow = (): TransactionAssetItem => ({
  rowId: newRowId(),
  assetId: "",
  itemName: "",
  quantity: 1,
  serialNumber: "",
  referenceNumber: "",
  assetInformation: "",
  condition: "",
  remarks: "",
  specifications: "",
  justification: "",
  duration: "",
  purpose: "",
})

const generateDocumentNumber = (
  direction: "In" | "Out",
  existing: Transaction[],
) => {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("")
  const prefix = direction === "In" ? "GI" : "GO"
  let suffix = 0
  let document = `${prefix}-${stamp}`
  while (existing.some((item) => item.document === document)) {
    suffix += 1
    document = `${prefix}-${stamp}-${suffix}`
  }
  return document
}

const totalAssets = (transaction: Transaction) =>
  transaction.assets?.length
    ? transaction.assets.reduce((sum, item) => sum + item.quantity, 0)
    : transaction.quantity

const transactionAssets = (transaction: Transaction): TransactionAssetItem[] =>
  transaction.assets?.length
    ? transaction.assets
    : [
        {
          rowId: `${transaction.id}-asset-1`,
          assetId: transaction.assetId,
          itemName: transaction.assetId,
          quantity: transaction.quantity,
          serialNumber: "",
          referenceNumber: transaction.po ?? "",
          remarks: transaction.notes ?? "",
        },
      ]

const transactionParty = (transaction: Transaction): TransactionParty =>
  transaction.party ?? {
    name: transaction.user,
    nik: "",
    department: "",
  }

function SummaryField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  )
}

function TransactionSummary({
  transaction,
  assets,
}: {
  transaction: Transaction
  assets: Asset[]
}) {
  const party = transactionParty(transaction)
  const rows = transactionAssets(transaction)
  const incoming = transaction.direction === "In"
  const attachments = transaction.supportingDocuments ?? []

  return (
    <div className="transaction-review">
      <section className="detail-section">
        <h3>Detail Input</h3>
        <dl>
          <SummaryField label="Document Number">
            <code>{transaction.document}</code>
          </SummaryField>
          <SummaryField label="Business Unit">
            {transaction.businessUnit}
          </SummaryField>
          <SummaryField label="Request Date">
            {formatDate(transaction.requestDate ?? transaction.date)}
          </SummaryField>
          <SummaryField label="Form Issue Date">
            {formatDate(transaction.formIssueDate ?? transaction.date)}
          </SummaryField>
          <SummaryField
            label={incoming ? "Returner / Contributor" : "Requester"}
          >
            {party.name}
          </SummaryField>
          <SummaryField label="NIK">{party.nik}</SummaryField>
          <SummaryField label="Department">{party.department}</SummaryField>
          <SummaryField label={incoming ? "Goods In Type" : "Goods Out Type"}>
            {transaction.type}
          </SummaryField>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Asset Details</h3>
        <div className="table-scroll transaction-asset-summary">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Item</th>
                <th>Quantity</th>
                {incoming ? (
                  <>
                    <th>SN</th>
                    <th>Reference Number</th>
                    <th>Asset Information</th>
                    <th>Condition</th>
                    <th>Remarks</th>
                  </>
                ) : (
                  <>
                    <th>Specifications & Details</th>
                    <th>Request Justification</th>
                    <th>Time / Duration</th>
                    <th>Intended Use</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const asset = assets.find((item) => item.id === row.assetId)
                return (
                  <tr key={row.rowId}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>
                        {row.itemName ||
                          (asset ? `${asset.brand} ${asset.model}` : row.assetId)}
                      </strong>
                      <small className="table-subline">{row.assetId}</small>
                    </td>
                    <td className="numeric">{row.quantity}</td>
                    {incoming ? (
                      <>
                        <td>{row.serialNumber || "—"}</td>
                        <td>{row.referenceNumber || "—"}</td>
                        <td>{row.assetInformation || "—"}</td>
                        <td>{row.condition || "—"}</td>
                        <td>{row.remarks || "—"}</td>
                      </>
                    ) : (
                      <>
                        <td>{row.specifications || "—"}</td>
                        <td>{row.justification || "—"}</td>
                        <td>{row.duration || "—"}</td>
                        <td>{row.purpose || "—"}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="transaction-total">
          <span>Total Assets</span>
          <strong>{totalAssets(transaction)} units</strong>
        </div>
      </section>

      <section className="detail-section">
        <h3>Destination</h3>
        <dl>
          <SummaryField
            label={
              incoming
                ? "Source / Sender"
                : "Recipient / Receiver / Borrower"
            }
          >
            {party.name}
          </SummaryField>
          <SummaryField label="Business Unit">
            {transaction.businessUnit}
          </SummaryField>
          <SummaryField
            label={
              incoming ? "Destination Location" : "Destination / Provider"
            }
          >
            {transaction.location}
          </SummaryField>
          <SummaryField label="Request Number">
            {transaction.requestNumber}
          </SummaryField>
          <SummaryField
            label={incoming ? "Approver / Receiver Name" : "Approver Name"}
          >
            {transaction.approverName}
          </SummaryField>
          <SummaryField label="IT Helpdesk & Inventory Notes">
            {transaction.inventoryNotes}
          </SummaryField>
          <SummaryField label="Supporting Documents">
            {attachments.length
              ? attachments.map((file) => file.name).join(", ")
              : "—"}
          </SummaryField>
          <SummaryField label="Current Status">
            <Badge>{transaction.status}</Badge>
          </SummaryField>
        </dl>
      </section>
    </div>
  )
}

export default function Transactions({
  direction,
}: {
  direction: "In" | "Out"
}) {
  const {
    assets,
    transactions,
    businessUnit,
    saveTransaction,
    updateTransactionStatus,
  } = useInventory()
  const incoming = direction === "In"
  const types = incoming ? goodsInTypes : goodsOutTypes
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<TransactionForm | null>(null)
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [selectedId, setSelectedId] = useState("")
  const [nextStatus, setNextStatus] =
    useState<TransactionStatus>("In Progress")
  const [statusNotes, setStatusNotes] = useState("")

  const filtered = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.direction === direction &&
          (businessUnit === "All Business Units" ||
            transaction.businessUnit === businessUnit) &&
          (!search ||
            [
              transaction.document,
              transaction.assetId,
              transaction.user,
              transaction.location,
              ...transactionAssets(transaction).map((item) => item.itemName),
            ]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!typeFilter || transaction.type === typeFilter) &&
          (!statusFilter || transaction.status === statusFilter),
      ),
    [
      transactions,
      direction,
      businessUnit,
      search,
      typeFilter,
      statusFilter,
    ],
  )
  const rows = filtered.slice((page - 1) * 10, page * 10)
  const month = filtered.filter(
    (transaction) =>
      transaction.date.slice(0, 7) === today().slice(0, 7),
  )
  const selectedTransaction = transactions.find(
    (transaction) => transaction.id === selectedId,
  )

  const openCreate = () => {
    const document = generateDocumentNumber(direction, transactions)
    setForm({
      id: `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      document,
      businessUnit:
        businessUnit === "All Business Units" ? businessUnits[0] : businessUnit,
      requestDate: today(),
      formIssueDate: today(),
      party: { name: "", nik: "", department: "" },
      type: types[0],
      assets: [emptyAssetRow()],
      location: "",
      supportingDocuments: [],
      requestNumber: "",
      approverName: "",
      inventoryNotes: "",
    })
    setStep(1)
    setFormError("")
    setSubmitting(false)
    submittingRef.current = false
    setOpen(true)
  }

  const setFormValue = <K extends keyof TransactionForm>(
    key: K,
    value: TransactionForm[K],
  ) => setForm((current) => (current ? { ...current, [key]: value } : current))

  const setPartyValue = (key: keyof TransactionParty, value: string) =>
    setForm((current) =>
      current
        ? { ...current, party: { ...current.party, [key]: value } }
        : current,
    )

  const setAssetValue = (
    rowId: string,
    key: keyof TransactionAssetItem,
    value: string | number,
  ) =>
    setForm((current) =>
      current
        ? {
            ...current,
            assets: current.assets.map((row) => {
              if (row.rowId !== rowId) return row
              if (key === "assetId") {
                const asset = assets.find((item) => item.id === value)
                return {
                  ...row,
                  assetId: String(value),
                  itemName: asset ? `${asset.brand} ${asset.model}` : "",
                  serialNumber: asset?.serial ?? row.serialNumber,
                  referenceNumber: asset?.po ?? row.referenceNumber,
                  assetInformation:
                    asset?.description ??
                    (asset
                      ? `${asset.category} · ${asset.group} · ${asset.type}`
                      : ""),
                  condition: asset?.condition ?? row.condition,
                  specifications: asset
                    ? `${asset.brand} ${asset.model}; SN ${asset.serial}; ${asset.condition}`
                    : "",
                }
              }
              return { ...row, [key]: value }
            }),
          }
        : current,
    )

  const validateStep = (targetStep: number) => {
    if (!form) return "Form is not available."
    if (targetStep === 1) {
      if (
        !form.document ||
        !form.businessUnit ||
        !form.requestDate ||
        !form.formIssueDate ||
        !form.party.name.trim() ||
        !form.party.nik.trim() ||
        !form.party.department.trim() ||
        !form.type
      )
        return "Complete all required Detail Input fields."
    }
    if (targetStep === 2) {
      if (!form.assets.length) return "Add at least one asset."
      const ids = form.assets.map((row) => row.assetId).filter(Boolean)
      if (new Set(ids).size !== ids.length)
        return "The same asset cannot be selected more than once."
      for (const row of form.assets) {
        const asset = assets.find((item) => item.id === row.assetId)
        if (!asset || !Number.isInteger(row.quantity) || row.quantity < 1)
          return "Select a valid asset and quantity for every row."
        if (!incoming && row.quantity > asset.quantity)
          return `${row.itemName} only has ${asset.quantity} units available.`
        if (
          incoming &&
          (!row.serialNumber?.trim() ||
            !row.referenceNumber?.trim() ||
            !row.assetInformation?.trim() ||
            !row.condition?.trim())
        )
          return "Complete SN, reference, information, and condition for every asset."
        if (
          !incoming &&
          (!row.specifications?.trim() ||
            !row.justification?.trim() ||
            !row.duration?.trim() ||
            !row.purpose?.trim())
        )
          return "Complete specifications, justification, duration, and purpose for every asset."
      }
    }
    if (
      targetStep === 3 &&
      (!form.location || !form.approverName.trim())
    )
      return "Complete the destination and approver fields."
    return ""
  }

  const next = () => {
    const error = validateStep(step)
    setFormError(error)
    if (!error) setStep((current) => Math.min(4, current + 1))
  }

  const submit = () => {
    if (!form || submittingRef.current) return
    const error =
      validateStep(1) || validateStep(2) || validateStep(3)
    setFormError(error)
    if (error) return
    submittingRef.current = true
    setSubmitting(true)
    const quantity = form.assets.reduce((sum, row) => sum + row.quantity, 0)
    const firstAsset = form.assets[0]
    const created = saveTransaction({
      id: form.id,
      direction,
      date: form.formIssueDate,
      document: form.document,
      assetId: firstAsset.assetId,
      type: form.type,
      quantity,
      location: form.location,
      businessUnit: form.businessUnit,
      status: "In Progress",
      user: form.party.name,
      po: firstAsset.referenceNumber,
      notes: form.inventoryNotes,
      requestDate: form.requestDate,
      formIssueDate: form.formIssueDate,
      party: form.party,
      assets: form.assets,
      supportingDocuments: form.supportingDocuments,
      requestNumber: form.requestNumber,
      approverName: form.approverName,
      inventoryNotes: form.inventoryNotes,
      statusHistory: [],
      inventoryAdjustmentApplied: true,
      inventoryAdjustedAt: new Date().toISOString(),
    })
    if (created) {
      setOpen(false)
      setForm(null)
      setStep(1)
    } else {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const openDetails = (transaction: Transaction) => {
    setSelectedId(transaction.id)
    setNextStatus(transaction.status)
    setStatusNotes("")
  }

  const saveStatus = () => {
    if (!selectedTransaction) return
    if (
      updateTransactionStatus(
        selectedTransaction.id,
        nextStatus,
        statusNotes,
      )
    ) {
      setStatusNotes("")
    }
  }

  const formPreview: Transaction | null = form
    ? {
        id: form.id,
        direction,
        date: form.formIssueDate,
        document: form.document,
        assetId: form.assets[0]?.assetId ?? "",
        type: form.type,
        quantity: form.assets.reduce((sum, row) => sum + row.quantity, 0),
        location: form.location,
        businessUnit: form.businessUnit,
        status: "In Progress",
        user: form.party.name,
        party: form.party,
        requestDate: form.requestDate,
        formIssueDate: form.formIssueDate,
        assets: form.assets,
        supportingDocuments: form.supportingDocuments,
        requestNumber: form.requestNumber,
        approverName: form.approverName,
        inventoryNotes: form.inventoryNotes,
        statusHistory: [],
      }
    : null

  return (
    <div className="page">
      <PageHeader
        title={incoming ? "Goods In" : "Goods Out"}
        subtitle={
          incoming
            ? "Record incoming assets and inventory receipts."
            : "Record asset handovers, services, borrowing, and disposals."
        }
        actions={
          <Button onClick={openCreate}>
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
          label="In Progress"
          value={
            filtered.filter((transaction) => transaction.status === "In Progress")
              .length
          }
          icon={<Clock size={19} />}
        />
        <StatCard
          label="Total assets"
          value={filtered.reduce(
            (sum, transaction) => sum + totalAssets(transaction),
            0,
          )}
          icon={<Boxes size={19} />}
        />
      </div>

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Document, asset, or user..."
        />
        <Select
          aria-label="Transaction type"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value)
            setPage(1)
          }}
          options={[{ value: "", label: "All transaction types" }, ...types]}
        />
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          options={[{ value: "", label: "All statuses" }, ...statuses]}
        />
      </div>

      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Document Number</th>
                <th>Total Assets</th>
                <th>{incoming ? "Goods In Type" : "Goods Out Type"}</th>
                <th>{incoming ? "Source / User" : "Recipient / User"}</th>
                <th>
                  {incoming ? "Destination" : "Destination / Provider"}
                </th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    {formatDate(
                      transaction.formIssueDate ?? transaction.date,
                    )}
                  </td>
                  <td>
                    <strong>{transaction.document}</strong>
                  </td>
                  <td className="numeric">{totalAssets(transaction)}</td>
                  <td>{transaction.type}</td>
                  <td>{transactionParty(transaction).name}</td>
                  <td>{transaction.location || "—"}</td>
                  <td>
                    <Badge>{transaction.status}</Badge>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDetails(transaction)}
                    >
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
        open={open && Boolean(form)}
        title={`New Goods-${direction}`}
        description={`Step ${step} of 4`}
        onClose={() => {
          setOpen(false)
          setFormError("")
        }}
        wide
      >
        {form && (
          <>
            <div className="stepper">
              {[
                "Detail Input",
                "Asset Details",
                "Destination",
                "Review",
              ].map((label, index) => (
                <div
                  className={step >= index + 1 ? "active" : ""}
                  key={label}
                >
                  <i>{index + 1}</i>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {formError && (
              <div className="error-summary" role="alert">
                <strong>Please review this step</strong>
                <span>{formError}</span>
              </div>
            )}

            {step === 1 && (
              <div className="form-grid transaction-form-grid">
                <Input
                  label="Document Number"
                  value={form.document}
                  readOnly
                />
                <Select
                  label="Business Unit *"
                  value={form.businessUnit}
                  onChange={(event) =>
                    setFormValue("businessUnit", event.target.value)
                  }
                  options={businessUnits}
                />
                <Input
                  label="Request Date *"
                  type="date"
                  value={form.requestDate}
                  onChange={(event) =>
                    setFormValue("requestDate", event.target.value)
                  }
                />
                <Input
                  label="Form Issue Date *"
                  type="date"
                  value={form.formIssueDate}
                  onChange={(event) =>
                    setFormValue("formIssueDate", event.target.value)
                  }
                />
                <Input
                  label={`${incoming ? "Returner / Contributor" : "Requester"} Name *`}
                  value={form.party.name}
                  onChange={(event) =>
                    setPartyValue("name", event.target.value)
                  }
                />
                <Input
                  label="NIK *"
                  value={form.party.nik}
                  onChange={(event) =>
                    setPartyValue("nik", event.target.value)
                  }
                />
                <Input
                  label="Department *"
                  value={form.party.department}
                  onChange={(event) =>
                    setPartyValue("department", event.target.value)
                  }
                />
                <Select
                  label={`${incoming ? "Goods In" : "Goods Out"} Type *`}
                  value={form.type}
                  onChange={(event) => setFormValue("type", event.target.value)}
                  options={types}
                />
              </div>
            )}

            {step === 2 && (
              <div className="transaction-assets-editor">
                <div className="section-heading">
                  <div>
                    <strong>Selected assets</strong>
                    <span>
                      Row numbers are local to this form and are not Asset IDs.
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setFormValue("assets", [
                        ...form.assets,
                        emptyAssetRow(),
                      ])
                    }
                  >
                    <Plus size={15} /> Add asset
                  </Button>
                </div>
                <div className="table-scroll asset-entry-table">
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        {incoming ? (
                          <>
                            <th>SN</th>
                            <th>Reference Number</th>
                            <th>Asset Information</th>
                            <th>Condition</th>
                            <th>Remarks</th>
                          </>
                        ) : (
                          <>
                            <th>Specifications & Details</th>
                            <th>Request Justification</th>
                            <th>Time / Duration</th>
                            <th>Intended Use</th>
                          </>
                        )}
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.assets.map((row, index) => {
                        const asset = assets.find(
                          (item) => item.id === row.assetId,
                        )
                        return (
                          <tr key={row.rowId}>
                            <td>{index + 1}</td>
                            <td>
                              <Select
                                aria-label={`Asset ${index + 1}`}
                                value={row.assetId}
                                onChange={(event) =>
                                  setAssetValue(
                                    row.rowId,
                                    "assetId",
                                    event.target.value,
                                  )
                                }
                                options={[
                                  { value: "", label: "Select asset" },
                                  ...assets
                                    .filter(
                                      (item) =>
                                        incoming ||
                                        (item.quantity > 0 &&
                                          item.condition !== "Disposal"),
                                    )
                                    .map((item) => ({
                                      value: item.id,
                                      label: `${item.id} · ${item.brand} ${item.model}`,
                                    })),
                                ]}
                              />
                              {asset && (
                                <small className="table-subline">
                                  Available: {asset.quantity} {asset.uom}
                                </small>
                              )}
                            </td>
                            <td>
                              <Input
                                aria-label={`Quantity ${index + 1}`}
                                type="number"
                                min="1"
                                max={incoming ? undefined : asset?.quantity}
                                value={row.quantity}
                                onChange={(event) =>
                                  setAssetValue(
                                    row.rowId,
                                    "quantity",
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </td>
                            {incoming ? (
                              <>
                                <td>
                                  <Input
                                    aria-label={`Serial Number ${index + 1}`}
                                    value={row.serialNumber}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "serialNumber",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Input
                                    aria-label={`Reference Number ${index + 1}`}
                                    value={row.referenceNumber}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "referenceNumber",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Textarea
                                    aria-label={`Asset Information ${index + 1}`}
                                    value={row.assetInformation}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "assetInformation",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Input
                                    aria-label={`Condition ${index + 1}`}
                                    value={row.condition}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "condition",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Textarea
                                    aria-label={`Remarks ${index + 1}`}
                                    value={row.remarks}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "remarks",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <Textarea
                                    aria-label={`Specifications ${index + 1}`}
                                    value={row.specifications}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "specifications",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Textarea
                                    aria-label={`Justification ${index + 1}`}
                                    value={row.justification}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "justification",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Input
                                    aria-label={`Duration ${index + 1}`}
                                    placeholder="e.g. 14 days"
                                    value={row.duration}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "duration",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <Textarea
                                    aria-label={`Purpose ${index + 1}`}
                                    value={row.purpose}
                                    onChange={(event) =>
                                      setAssetValue(
                                        row.rowId,
                                        "purpose",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </td>
                              </>
                            )}
                            <td>
                              <IconButton
                                label={`Remove asset row ${index + 1}`}
                                disabled={form.assets.length === 1}
                                onClick={() =>
                                  setFormValue(
                                    "assets",
                                    form.assets.filter(
                                      (item) => item.rowId !== row.rowId,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="form-grid transaction-form-grid">
                <Input
                  label={
                    incoming
                      ? "Source / Sender"
                      : "Recipient / Receiver / Borrower"
                  }
                  value={form.party.name}
                  readOnly
                />
                <Input
                  label="Business Unit"
                  value={form.businessUnit}
                  readOnly
                />
                <Select
                  label={
                    incoming
                      ? "Destination Location *"
                      : "Destination / Provider Location *"
                  }
                  value={form.location}
                  onChange={(event) =>
                    setFormValue("location", event.target.value)
                  }
                  options={[
                    { value: "", label: "Select destination" },
                    ...destinationOptions,
                  ]}
                />
                <Input
                  label="Request Number"
                  value={form.requestNumber}
                  onChange={(event) =>
                    setFormValue("requestNumber", event.target.value)
                  }
                />
                <Input
                  label={
                    incoming
                      ? "Approver / Receiver Name *"
                      : "Approver Name *"
                  }
                  value={form.approverName}
                  onChange={(event) =>
                    setFormValue("approverName", event.target.value)
                  }
                />
                <Input
                  label="Supporting Documents"
                  type="file"
                  multiple
                  onChange={(event) =>
                    setFormValue(
                      "supportingDocuments",
                      Array.from(event.target.files ?? []).map((file) => ({
                        id: `FILE-${Date.now()}-${file.name}`,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                      })),
                    )
                  }
                />
                <Textarea
                  label="IT Helpdesk & Inventory Notes"
                  className="full-span"
                  value={form.inventoryNotes}
                  onChange={(event) =>
                    setFormValue("inventoryNotes", event.target.value)
                  }
                />
                {form.supportingDocuments.length > 0 && (
                  <div className="document-list full-span">
                    {form.supportingDocuments.map((file) => (
                      <span key={file.id}>{file.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 4 && formPreview && (
              <TransactionSummary transaction={formPreview} assets={assets} />
            )}

            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setFormError("")
                  if (step === 1) setOpen(false)
                  else setStep((current) => current - 1)
                }}
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step < 4 ? (
                <Button onClick={next}>Next</Button>
              ) : (
                <Button disabled={submitting} onClick={submit}>
                  {submitting ? "Submitting..." : "Submit transaction"}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(selectedTransaction)}
        title={`Goods-${direction} Details`}
        description={selectedTransaction?.document}
        onClose={() => setSelectedId("")}
        wide
      >
        {selectedTransaction && (
          <>
            <TransactionSummary
              transaction={selectedTransaction}
              assets={assets}
            />

            <section className="detail-section status-management">
              <h3>Status Management</h3>
              <div className="status-control">
                <div>
                  <span>Current Status</span>
                  <Badge>{selectedTransaction.status}</Badge>
                </div>
                <Select
                  label="Change Status"
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(event.target.value as TransactionStatus)
                  }
                  options={statuses}
                />
                <Input
                  label="Notes (optional)"
                  value={statusNotes}
                  onChange={(event) => setStatusNotes(event.target.value)}
                />
                <Button
                  disabled={nextStatus === selectedTransaction.status}
                  onClick={saveStatus}
                >
                  Save status
                </Button>
              </div>
            </section>

            <section className="detail-section">
              <h3>Status History</h3>
              {(selectedTransaction.statusHistory ?? []).length ? (
                <div className="status-history">
                  {[...(selectedTransaction.statusHistory ?? [])]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime(),
                    )
                    .map((entry) => (
                      <article key={entry.id}>
                        <div>
                          <Badge>{entry.previousStatus}</Badge>
                          <span>→</span>
                          <Badge>{entry.newStatus}</Badge>
                        </div>
                        <strong>
                          {entry.actorName}, NIK {entry.actorNik}
                        </strong>
                        <time dateTime={entry.timestamp}>
                          {new Intl.DateTimeFormat("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(entry.timestamp))}
                        </time>
                        {entry.notes && <p>{entry.notes}</p>}
                      </article>
                    ))}
                </div>
              ) : (
                <EmptyState
                  title="No status changes"
                  description="Existing records start with an empty history. New changes will appear here."
                />
              )}
            </section>
          </>
        )}
      </Modal>
    </div>
  )
}
