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
import { useAuth } from "../auth/AuthContext"
import { canManageExisting } from "../services/authorizationService"
import ConditionBadge from "./ConditionBadge"
import type { Asset } from "../data/demoData"
import {
  formatCurrency,
  formatDate,
  generateAssetCode,
  generateAssetPrefix,
  today,
} from "../utils/helpers"
import {
  getLocationsForBusinessUnit,
  getMasterInternalId,
  isAssetClassificationValid,
  normalizeAssetClassification,
} from "../utils/masterData"
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
  const assetStatuses = master.assetStatuses ?? []
  const blank: Asset = {
    assetStatus:
      assetStatuses.find((item) => item.active !== false)?.name ?? "",
    statusId: assetStatuses.find((item) => item.active !== false)?.id ?? "",
    assetPrefix: "",
    id: "",
    serial: "",
    tag: "",
    categoryId: "",
    groupId: "",
    typeId: "",
    brandId: "",
    modelId: "",
    category: "",
    group: "",
    type: "",
    brand: "",
    model: "",
    location: "",
    locationId: "",
    businessUnit: "",
    businessUnitId: "",
    condition: "Good",
    quantity: 1,
    uom: "UNIT",
    updatedAt: today(),
    demo: false,
  }
  const [form, setForm] = useState<Asset>(() =>
    normalizeAssetClassification(asset ?? blank, master),
  )
  const [errors, setErrors] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (dirty) return
    setForm(normalizeAssetClassification(asset ?? blank, master))
    setErrors([])
  }, [asset, open, master, dirty])
  const set = (key: keyof Asset, value: string | number) => {
    setForm((v) => ({ ...v, [key]: value }))
    setDirty(true)
  }
  const groups = master.groups.filter(
    (x) => !form.categoryId || x.category_id === form.categoryId,
  )
  const types = master.types.filter(
    (x) =>
      (!form.groupId || x.group_id === form.groupId) &&
      (!form.categoryId || !x.category_id || x.category_id === form.categoryId),
  )
  const brands = master.brands.filter(
    (brand) => !form.typeId || !brand.type_id || brand.type_id === form.typeId,
  )
  const models = master.models.filter(
    (x) =>
      (!form.brandId || x.brand_id === form.brandId) &&
      (!form.typeId || x.type_id === form.typeId),
  )
  const findItem = (
    key: "categories" | "groups" | "types" | "brands" | "models",
    id: string,
  ) => master[key].find((item) => getMasterInternalId(item) === id)
  const assetPrefix = generateAssetPrefix(form, master)
  const assetCode =
    asset?.assetPrefix === assetPrefix && asset.assetCode
      ? asset.assetCode
      : generateAssetCode(assetPrefix, assets, asset?.id)
  const close = () => {
    if (!dirty || window.confirm("Discard unsaved changes?")) onClose()
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required = [
      "category",
      "group",
      "type",
      "brand",
      "model",
      "serial",
      "statusId",
      "locationId",
      "businessUnitId",
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
    if (
      form.category &&
      form.group &&
      form.type &&
      form.brand &&
      form.model &&
      !isAssetClassificationValid(form, master)
    )
      next.push("The selected classification is no longer valid")
    if (!assetPrefix) next.push("Asset prefix is required")
    if (next.length) {
      setErrors(next)
      return
    }
    setSaving(true)
    try {
      if (
        await saveAsset({
          ...form,
          assetCode,
          assetPrefix,
          updatedAt: today(),
        })
      ) {
        setDirty(false)
        onClose()
      }
    } finally {
      setSaving(false)
    }
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
              value={form.categoryId}
              onChange={(e) => {
                const category = findItem("categories", e.target.value)
                setForm({
                  ...form,
                  categoryId: e.target.value,
                  category: category?.name ?? "",
                  groupId: "",
                  group: "",
                  typeId: "",
                  type: "",
                  brandId: "",
                  brand: "",
                  modelId: "",
                  model: "",
                })
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select category" },
                ...master.categories.map((x) => ({
                  value: getMasterInternalId(x),
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Group *"
              value={form.groupId}
              onChange={(e) => {
                const group = findItem("groups", e.target.value)
                setForm({
                  ...form,
                  groupId: e.target.value,
                  group: group?.name ?? "",
                  typeId: "",
                  type: "",
                  brandId: "",
                  brand: "",
                  modelId: "",
                  model: "",
                })
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select group" },
                ...groups.map((x) => ({
                  value: getMasterInternalId(x),
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Type *"
              value={form.typeId}
              onChange={(e) => {
                const type = findItem("types", e.target.value)
                const brand = findItem("brands", form.brandId ?? "")
                const keepBrand =
                  !brand?.type_id || brand.type_id === e.target.value
                setForm({
                  ...form,
                  typeId: e.target.value,
                  type: type?.name ?? "",
                  brandId: keepBrand ? form.brandId : "",
                  brand: keepBrand ? form.brand : "",
                  modelId: "",
                  model: "",
                })
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select type" },
                ...types.map((x) => ({
                  value: getMasterInternalId(x),
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Brand *"
              value={form.brandId ?? ""}
              onChange={(event) => {
                const brandId = event.target.value
                const brand = findItem("brands", brandId)
                setForm({
                  ...form,
                  brandId,
                  brand: brand?.name ?? "",
                  modelId: "",
                  model: "",
                })
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select brand" },
                ...brands.map((x) => ({
                  value: getMasterInternalId(x),
                  label: x.name,
                })),
              ]}
            />
            <Select
              label="Model *"
              value={form.modelId ?? ""}
              onChange={(event) => {
                const modelId = event.target.value
                const model = findItem("models", modelId)
                setForm(
                  normalizeAssetClassification(
                    {
                      ...form,
                      modelId,
                      model: model?.name ?? "",
                      brandId: String(model?.brand_id ?? form.brandId ?? ""),
                      brand: "",
                      typeId: String(model?.type_id ?? form.typeId ?? ""),
                      type: "",
                      groupId: String(model?.group_id ?? ""),
                      group: String(model?.group_name ?? ""),
                      categoryId: String(model?.category_id ?? ""),
                      category: String(model?.category_name ?? ""),
                    },
                    master,
                  ) as Asset,
                )
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select model" },
                ...models.map((x) => ({
                  value: getMasterInternalId(x),
                  label: x.name,
                })),
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
              <span>Asset ID</span>
              <strong>{assetCode || "Select prefixed master data"}</strong>
              <small>Asset ID is generated when the asset is saved.</small>
            </div>
            <div className="qr-preview">
              <QrCode size={42} />
              <span>{assetCode}</span>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Location & ownership</legend>
          <div className="form-grid">
            <Select
              label="Business Unit *"
              value={form.businessUnitId ?? ""}
              onChange={(e) => {
                const unit = master.businessUnits.find(
                  (item) => item.id === e.target.value,
                )
                setForm((value) => ({
                  ...value,
                  businessUnitId: unit?.id ?? "",
                  businessUnit: unit?.name ?? "",
                  locationId: "",
                  location: "",
                }))
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select business unit" },
                ...master.businessUnits.map((unit) => ({
                  value: unit.id,
                  label: unit.name,
                })),
              ]}
            />
            <Select
              label="Location *"
              value={form.locationId ?? ""}
              disabled={!form.businessUnitId}
              onChange={(e) => {
                const location = getLocationsForBusinessUnit(
                  master.locations,
                  form.businessUnitId ?? "",
                ).find((item) => item.id === e.target.value)
                setForm((value) => ({
                  ...value,
                  locationId: location?.id ?? "",
                  location: location?.name ?? "",
                }))
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select location" },
                ...getLocationsForBusinessUnit(
                  master.locations,
                  form.businessUnitId ?? "",
                ).map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
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
          <legend>Asset Status, Condition & notes</legend>
          <div className="form-grid">
            <Select
              label="Asset Status *"
              value={form.statusId ?? ""}
              onChange={(event) => {
                const status = assetStatuses.find(
                  (item) => item.id === event.target.value,
                )
                setForm((value) => ({
                  ...value,
                  statusId: status?.id ?? "",
                  assetStatus: status?.name ?? "",
                }))
                setDirty(true)
              }}
              options={[
                { value: "", label: "Select asset status" },
                ...assetStatuses
                  .filter((item) => item.active !== false)
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <Select
              label="Condition"
              value={form.condition}
              onChange={(e) => {
                const condition = master.conditions.find(
                  (item) => item.name === e.target.value,
                )
                setForm((value) => ({
                  ...value,
                  condition: condition?.name ?? "",
                  conditionId: condition?.id,
                }))
                setDirty(true)
              }}
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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Asset"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function AssetDrawer() {
  const { selectedAsset, setSelectedAsset, transactions, saveAsset, master } =
    useInventory()
  const { currentUser } = useAuth()
  const manageAllowed = canManageExisting(currentUser, "asset-inventory")
  const [tab, setTab] = useState("Overview")
  const [editing, setEditing] = useState(false)
  const [dispose, setDispose] = useState(false)
  if (!selectedAsset) return null
  const related = transactions.filter((t) => t.assetId === selectedAsset.id)
  const groups = [
    [
      "Identification",
      [
        ["Asset ID", selectedAsset.assetCode],
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
        title={selectedAsset.assetCode || "Asset"}
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
          <ConditionBadge
            condition={selectedAsset.condition}
            color={
              master.conditions.find(
                (item) => item.name === selectedAsset.condition,
              )?.tagColor
            }
          />
        </div>
        <div className="drawer-actions">
          {manageAllowed && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              <Edit3 size={15} /> Edit
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print QR
          </Button>
          {manageAllowed && (
            <Button size="sm" variant="danger" onClick={() => setDispose(true)}>
              <Trash2 size={15} /> Disposal
            </Button>
          )}
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
                      <dd>
                        {label === "Condition" ? (
                          <ConditionBadge
                            condition={selectedAsset.condition}
                            color={
                              master.conditions.find(
                                (item) => item.name === selectedAsset.condition,
                              )?.tagColor
                            }
                          />
                        ) : (
                          value || "—"
                        )}
                      </dd>
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
        onConfirm={async () => {
          const next = {
            ...selectedAsset,
            condition: "Disposal",
            updatedAt: today(),
          }
          if (await saveAsset(next)) {
            setDispose(false)
          }
        }}
      />
    </>
  )
}
