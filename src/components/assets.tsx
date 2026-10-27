"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Download,
  Edit3,
  MapPin,
  Printer,
  Trash2,
  Upload,
  QrCode,
} from "lucide-react"
import { useInventory } from "../context/InventoryContext"
import type { Asset } from "../data/demoData"
import {
  generateAssetId,
  formatCurrency,
  formatDate,
  today,
} from "../utils/helpers"
import {
  Badge,
  Button,
  Drawer,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
  ConfirmDialog,
} from "./ui"

export function AssetForm({
  open,
  asset,
  onClose,
}: {
  open: boolean
  asset?: Asset | null
  onClose: () => void
}) {
  const { master, assets, saveAsset } = useInventory()
  const blank: Asset = {
    id: "",
    serial: "",
    tag: "",
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
    updatedAt: today(),
    demo: false,
  }
  const [form, setForm] = useState<Asset>(asset ?? blank)
  const [errors, setErrors] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    setForm(asset ?? blank)
    setErrors([])
    setDirty(false)
  }, [asset, open])
  const set = (key: keyof Asset, value: string | number) => {
    setForm((v) => ({ ...v, [key]: value }))
    setDirty(true)
  }
  const groups = master.groups.filter(
    (x) => !form.category || x.parent === form.category,
  )
  const types = master.types.filter(
    (x) => !form.group || x.parent === form.group,
  )
  const brands = master.brands.filter(
    (x) => !form.type || x.parent === form.type || x.parent === form.group,
  )
  const models = master.models.filter(
    (x) => !form.brand || x.parent === form.brand,
  )
  const preview = asset?.id || generateAssetId(form, master, assets)
  const close = () => {
    if (!dirty || window.confirm("Discard unsaved changes?")) onClose()
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const required = [
      "category",
      "group",
      "type",
      "brand",
      "model",
      "serial",
      "location",
      "businessUnit",
    ] as Array<keyof Asset>
    const next = required
      .filter((k) => !form[k])
      .map((k) => `${String(k)} is required`)
    if (
      assets.some(
        (a) =>
          a.serial.toLowerCase() === form.serial.toLowerCase() &&
          a.id !== asset?.id,
      )
    )
      next.push("Serial number already exists")
    if (next.length) {
      setErrors(next)
      return
    }
    saveAsset({ ...form, id: preview, updatedAt: today() })
    setDirty(false)
    onClose()
  }
  return (
    <Modal
      open={open}
      title={asset ? "Edit Asset" : "Add Asset"}
      description="Fields marked with * are required."
      onClose={close}
      wide
    >
      <form onSubmit={submit} className="asset-form">
        {errors.length > 0 && (
          <div className="error-summary">
            <strong>Please review the form</strong>
            {errors.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        )}
        <fieldset>
          <legend>Classification</legend>
          <div className="form-grid">
            <Select
              label="Category *"
              value={form.category}
              onChange={(e) => {
                set("category", e.target.value)
                set("group", "")
              }}
              options={[
                { value: "", label: "Select category" },
                ...master.categories.map((x) => ({
                  value: x.name,
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Group *"
              value={form.group}
              onChange={(e) => {
                set("group", e.target.value)
                set("type", "")
              }}
              options={[
                { value: "", label: "Select group" },
                ...groups.map((x) => ({ value: x.name, label: x.name })),
              ]}
            />
            <Select
              label="Type *"
              value={form.type}
              onChange={(e) => {
                set("type", e.target.value)
                set("brand", "")
              }}
              options={[
                { value: "", label: "Select type" },
                ...types.map((x) => ({ value: x.name, label: x.name })),
              ]}
            />
            <Select
              label="Brand *"
              value={form.brand}
              onChange={(e) => {
                set("brand", e.target.value)
                set("model", "")
              }}
              options={[
                { value: "", label: "Select brand" },
                ...brands.map((x) => ({ value: x.name, label: x.name })),
              ]}
            />
            <Select
              label="Model *"
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              options={[
                { value: "", label: "Select model" },
                ...models.map((x) => ({ value: x.name, label: x.name })),
              ]}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>Identification</legend>
          <div className="form-grid">
            <Input
              autoFocus
              label="Serial Number *"
              value={form.serial}
              onChange={(e) => set("serial", e.target.value)}
            />
            <Input
              label="Asset Tag"
              value={form.tag}
              onChange={(e) => set("tag", e.target.value)}
            />
            <div className="id-preview">
              <span>Asset ID preview</span>
              <strong>{preview}</strong>
              <small>
                Assumed composite rule, isolated for future production mapping.
              </small>
            </div>
            <div className="qr-preview">
              <QrCode size={42} />
              <span>{preview}</span>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Location & ownership</legend>
          <div className="form-grid">
            <Select
              label="Location *"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              options={[
                { value: "", label: "Select location" },
                ...master.locations.map((x) => ({
                  value: x.name,
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Business Unit *"
              value={form.businessUnit}
              onChange={(e) => set("businessUnit", e.target.value)}
              options={[
                { value: "", label: "Select business unit" },
                ...[
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
              ]}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>Procurement</legend>
          <div className="form-grid">
            <Input
              label="PO Number"
              value={form.po ?? ""}
              onChange={(e) => set("po", e.target.value)}
            />
            <Input
              label="SAP Material ID"
              value={form.sap ?? ""}
              onChange={(e) => set("sap", e.target.value)}
            />
            <Input
              label="Initial Value (IDR)"
              type="number"
              min="0"
              value={form.value ?? ""}
              onChange={(e) => set("value", Number(e.target.value))}
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => set("quantity", Number(e.target.value))}
            />
            <Select
              label="UOM"
              value={form.uom}
              onChange={(e) => set("uom", e.target.value)}
              options={["UNIT", "PCS", "LICENSE", "SET"]}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>Condition & notes</legend>
          <div className="form-grid">
            <Select
              label="Condition"
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
              options={master.conditions.map((x) => x.name)}
            />
            <Textarea
              label="Description"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>
        </fieldset>
        <div className="form-actions">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">Save Asset</Button>
        </div>
      </form>
    </Modal>
  )
}

export function AssetDrawer() {
  const { selectedAsset, setSelectedAsset, transactions, saveAsset } =
    useInventory()
  const [tab, setTab] = useState("Overview")
  const [editing, setEditing] = useState(false)
  const [dispose, setDispose] = useState(false)
  if (!selectedAsset) return null
  const related = transactions.filter((t) => t.assetId === selectedAsset.id)
  const groups = [
    [
      "Identification",
      [
        ["Asset ID", selectedAsset.id],
        ["Serial Number", selectedAsset.serial],
        ["Asset Tag", selectedAsset.tag],
      ],
    ],
    [
      "Classification",
      [
        ["Category", selectedAsset.category],
        ["Group", selectedAsset.group],
        ["Type", selectedAsset.type],
        ["Brand", selectedAsset.brand],
        ["Model", selectedAsset.model],
      ],
    ],
    [
      "Location & ownership",
      [
        ["Location", selectedAsset.location],
        ["Business Unit", selectedAsset.businessUnit],
        ["Condition", selectedAsset.condition],
        ["Quantity", `${selectedAsset.quantity} ${selectedAsset.uom}`],
      ],
    ],
    [
      "Procurement",
      [
        ["Initial Value", formatCurrency(selectedAsset.value)],
        ["PO Number", selectedAsset.po],
        ["SAP Material ID", selectedAsset.sap],
      ],
    ],
  ] as [string, Array<[string, string | undefined]>][]
  return (
    <>
      <Drawer
        open
        title={selectedAsset.id}
        onClose={() => setSelectedAsset(null)}
      >
        <div className="drawer-summary">
          <div>
            <code>{selectedAsset.serial}</code>
            <p>
              {selectedAsset.category} / {selectedAsset.group} /{" "}
              {selectedAsset.type}
            </p>
          </div>
          <Badge>{selectedAsset.condition}</Badge>
        </div>
        <div className="drawer-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            <Edit3 size={15} /> Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print QR
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDispose(true)}>
            <Trash2 size={15} /> Disposal
          </Button>
        </div>
        <Tabs
          items={["Overview", "Transaction History", "Documents / Attachments"]}
          active={tab}
          onChange={setTab}
        />
        <div className="drawer-content">
          {tab === "Overview" &&
            groups.map(([title, rows]) => (
              <section className="detail-section" key={title}>
                <h3>{title}</h3>
                <dl>
                  {rows.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          {tab === "Transaction History" && (
            <div className="timeline">
              {related.length ? (
                related.map((t) => (
                  <div key={t.id}>
                    <i />
                    <section>
                      <span>
                        {formatDate(t.date)} · <Badge>{t.direction}</Badge>
                      </span>
                      <strong>
                        {t.type} · {t.document}
                      </strong>
                      <p>
                        {t.quantity} unit · {t.user} · {t.location}
                      </p>
                    </section>
                  </div>
                ))
              ) : (
                <p>No related transactions.</p>
              )}
            </div>
          )}
          {tab === "Documents / Attachments" && (
            <div className="document-panel">
              <Upload size={28} />
              <strong>Attach supporting documents</strong>
              <p>
                Files selected here are local previews and are not permanently
                uploaded.
              </p>
              <Input type="file" multiple />
              <div className="document-row">
                <Download size={17} />
                <span>
                  {selectedAsset.po
                    ? `${selectedAsset.po}.pdf`
                    : "No procurement document"}
                </span>
                <Button size="sm" variant="ghost">
                  Preview
                </Button>
              </div>
            </div>
          )}
        </div>
      </Drawer>
      <AssetForm
        open={editing}
        asset={selectedAsset}
        onClose={() => setEditing(false)}
      />
      <ConfirmDialog
        open={dispose}
        title="Mark asset for disposal?"
        description="This preserves the asset and all historical transactions while updating its lifecycle condition."
        confirmLabel="Mark for Disposal"
        danger
        onClose={() => setDispose(false)}
        onConfirm={() => {
          const next = {
            ...selectedAsset,
            condition: "Disposal",
            updatedAt: today(),
          }
          saveAsset(next)
          setSelectedAsset(next)
          setDispose(false)
        }}
      />
    </>
  )
}
