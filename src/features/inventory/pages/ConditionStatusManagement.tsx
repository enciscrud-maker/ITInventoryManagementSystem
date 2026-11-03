"use client"

import { useMemo, useState } from "react"

import { Edit3, Plus, Trash2 } from "lucide-react"

import { useAuth } from "@/auth/AuthContext"

import ConditionBadge from "@/components/ConditionBadge"

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
} from "@/components/ui"

import { useInventory } from "@/context/InventoryContext"

import type { MasterItem } from "@/data/demoData"

import {
  canCreateInModule,
  canDelete,
  canManageExisting,
} from "@/services/authorizationService"

import {
  defaultConditionTagColor,
  generateMasterId,
  generateStatusCode,
  isValidTagColor,
} from "@/utils/masterData"

type DataType = "" | "condition" | "status"

type RecordRef = {
  type: Exclude<DataType, "">
  item: MasterItem
}

export default function ConditionStatusManagement({
  tabs,

  activeTab,

  onTabChange,
}: {
  tabs: string[]

  activeTab: string

  onTabChange: (tab: string) => void
}) {
  const { master, saveMaster, deleteMaster, notify } = useInventory()

  const { currentUser } = useAuth()

  const createAllowed = canCreateInModule(currentUser, "master-data")

  const editAllowed = canManageExisting(currentUser)

  const deleteAllowed = canDelete(currentUser)

  const [search, setSearch] = useState("")

  const [formOpen, setFormOpen] = useState(false)

  const [dataType, setDataType] = useState<DataType>("")

  const [editingId, setEditingId] = useState<string | null>(null)

  const [conditionName, setConditionName] = useState("")

  const [tagColor, setTagColor] = useState("#64748b")

  const [statusName, setStatusName] = useState("")

  const [statusUsage, setStatusUsage] = useState<"In" | "Out">("In")

  const [deleting, setDeleting] = useState<RecordRef | null>(null)

  const statusCode =
    dataType === "status" ? generateStatusCode(statusName, statusUsage) : ""

  const query = search.trim().toLocaleLowerCase()

  const conditions = useMemo(
    () =>
      master.conditions.filter((item) =>
        item.name.toLocaleLowerCase().includes(query),
      ),

    [master.conditions, query],
  )

  const statuses = useMemo(
    () =>
      master.statuses.filter((item) =>
        `${item.name} ${item.usage ?? ""} ${item.code}`

          .toLocaleLowerCase()

          .includes(query),
      ),

    [master.statuses, query],
  )

  const isEditing = editingId !== null

  const errors = useMemo(() => {
    if (!formOpen || !dataType) return []

    const list: string[] = []

    if (dataType === "condition") {
      const name = conditionName.trim()

      if (!name) list.push("Condition is required.")

      if (
        !isEditing &&
        master.conditions.some(
          (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        list.push("Condition name already exists.")

      if (!isValidTagColor(tagColor)) list.push("Choose a valid tag color.")
    } else {
      const name = statusName.trim()

      if (!name) list.push("Status is required.")

      if (!statusCode)
        list.push("Enter a Status name with supported characters.")

      if (
        statusCode &&
        master.statuses.some(
          (item) => item.id !== editingId && item.code === statusCode,
        )
      )
        list.push("Status code already exists.")
    }

    return list
  }, [
    conditionName,

    dataType,

    editingId,

    formOpen,

    master.conditions,

    master.statuses,

    isEditing,

    statusCode,

    statusName,

    tagColor,
  ])

  const resetForm = () => {
    setFormOpen(false)

    setDataType("")

    setEditingId(null)

    setConditionName("")

    setTagColor(defaultConditionTagColor("Condition"))

    setStatusName("")

    setStatusUsage("In")
  }

  const openAdd = () => {
    resetForm()

    setFormOpen(true)
  }

  const openEdit = (type: Exclude<DataType, "">, item: MasterItem) => {
    setDataType(type)

    setEditingId(item.id)

    if (type === "condition") {
      setConditionName(item.name)

      setTagColor(item.tagColor ?? defaultConditionTagColor(item.name))
    } else {
      setStatusName(item.name)

      setStatusUsage(item.usage ?? "In")
    }

    setFormOpen(true)
  }

  const save = () => {
    if (!dataType || errors.length) return

    const id =
      editingId ??
      generateMasterId(
        dataType === "condition" ? master.conditions : master.statuses,

        dataType === "condition" ? "conditions" : "statuses",
      )

    const item: MasterItem =
      dataType === "condition"
        ? {
            id,

            name: isEditing
              ? (master.conditions.find((record) => record.id === id)?.name ??
                conditionName.trim())
              : conditionName.trim(),

            code: "",

            tagColor,
          }
        : {
            id,

            name: statusName.trim(),

            code: statusCode,

            usage: statusUsage,
          }

    if (saveMaster(dataType === "condition" ? "conditions" : "statuses", item))
      resetForm()
  }

  const confirmDelete = () => {
    if (!deleting) return

    const key = deleting.type === "condition" ? "conditions" : "statuses"

    if (deleteMaster(key, deleting.item.id)) setDeleting(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Master Data"
        subtitle="Manage asset Conditions and direction-specific Statuses."
        actions={
          <Button disabled={!createAllowed} onClick={openAdd}>
            <Plus size={16} /> Add New
          </Button>
        }
      />
      <Tabs items={tabs} active={activeTab} onChange={onTabChange} />
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Condition or Status..."
        />
        <span className="record-count">
          {conditions.length} conditions · {statuses.length} statuses
        </span>
      </div>

      <div className="condition-status-grid">
        <section className="table-card condition-status-card">
          <header className="card-header">
            <h2>Condition</h2>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Condition</th>
                  <th>Tag</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((item, index) => (
                  <tr key={item.id}>
                    <td className="numeric">{index + 1}</td>
                    <td>{item.name}</td>
                    <td>
                      <ConditionBadge
                        condition={item.name}
                        color={item.tagColor}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        {editAllowed && (
                          <IconButton
                            label={`Edit Condition ${item.name}`}
                            onClick={() => openEdit("condition", item)}
                          >
                            <Edit3 size={15} />
                          </IconButton>
                        )}
                        {deleteAllowed && (
                          <IconButton
                            label={`Delete Condition ${item.name}`}
                            onClick={() =>
                              setDeleting({ type: "condition", item })
                            }
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!conditions.length && <EmptyState title="No conditions found" />}
          </div>
        </section>

        <section className="table-card condition-status-card">
          <header className="card-header">
            <h2>Status</h2>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Status</th>
                  <th>Usage</th>
                  <th>Code</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((item, index) => (
                  <tr key={item.id}>
                    <td className="numeric">{index + 1}</td>
                    <td>{item.name}</td>
                    <td>
                      <Badge tone={item.usage === "In" ? "info" : "warning"}>
                        {item.usage ?? "—"}
                      </Badge>
                    </td>
                    <td>
                      <code>{item.code}</code>
                    </td>
                    <td>
                      <div className="row-actions">
                        {editAllowed && (
                          <IconButton
                            label={`Edit Status ${item.name}`}
                            onClick={() => openEdit("status", item)}
                          >
                            <Edit3 size={15} />
                          </IconButton>
                        )}
                        {deleteAllowed && (
                          <IconButton
                            label={`Delete Status ${item.name}`}
                            onClick={() =>
                              setDeleting({ type: "status", item })
                            }
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!statuses.length && <EmptyState title="No statuses found" />}
          </div>
        </section>
      </div>

      <Modal
        open={formOpen}
        title={`${isEditing ? "Edit" : "Add"} ${dataType || "Master Data"}`}
        description={
          isEditing
            ? "Update the selected master record."
            : "Choose a data type to display its fields."
        }
        onClose={resetForm}
      >
        <div className="form-grid">
          <Select
            label="Data Type *"
            value={dataType}
            disabled={isEditing}
            onChange={(event) => {
              const nextType = event.target.value as DataType

              setDataType(nextType)

              setConditionName("")

              setTagColor(defaultConditionTagColor("Condition"))

              setStatusName("")

              setStatusUsage("In")
            }}
            options={[
              { value: "", label: "Select data type" },

              { value: "condition", label: "Condition" },

              { value: "status", label: "Status" },
            ]}
          />
          {dataType === "condition" && (
            <>
              <Input
                autoFocus={!isEditing}
                label="Condition *"
                value={conditionName}
                readOnly={isEditing}
                onChange={(event) => setConditionName(event.target.value)}
              />
              <Input
                label="Tag Color *"
                type="color"
                value={tagColor}
                onChange={(event) => setTagColor(event.target.value)}
              />
              <div className="condition-preview">
                <span>Preview</span>
                <ConditionBadge
                  condition={conditionName.trim() || "Condition"}
                  color={tagColor}
                />
              </div>
            </>
          )}
          {dataType === "status" && (
            <>
              <Input
                autoFocus
                label="Status *"
                value={statusName}
                onChange={(event) => setStatusName(event.target.value)}
              />
              <Select
                label="Usage *"
                value={statusUsage}
                onChange={(event) =>
                  setStatusUsage(event.target.value as "In" | "Out")
                }
                options={[
                  { value: "In", label: "In" },

                  { value: "Out", label: "Out" },
                ]}
              />
              <Input label="Code" value={statusCode} readOnly />
              <div className="condition-preview">
                <span>Preview</span>
                <Badge tone={statusUsage === "In" ? "info" : "warning"}>
                  {statusUsage}
                </Badge>
                <code>{statusCode || "—"}</code>
              </div>
            </>
          )}
        </div>
        {errors.length > 0 && (
          <div className="error-summary" role="alert">
            <strong>Please review the form</strong>
            {errors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {dataType && (
          <div className="form-actions">
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
            <Button disabled={errors.length > 0} onClick={save}>
              Save Record
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${
          deleting?.type === "condition" ? "Condition" : "Status"
        } ${deleting?.item.name ?? ""}?`}
        description={
          deleting?.type === "condition"
            ? "A Condition that is still referenced by assets or transactions cannot be deleted."
            : "A Status that is still referenced by transactions cannot be deleted."
        }
        danger
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
