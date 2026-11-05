"use client"

import { useMemo, useState } from "react"
import { Edit3, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { useInventory } from "@/context/InventoryContext"
import {
  canCreateInModule,
  canDelete,
  canManageExisting,
} from "@/services/authorizationService"
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Tabs,
} from "@/components/ui"
import { generateBusinessUnitCode } from "@/utils/masterData"

export default function BusinessUnitManagement({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  const {
    master,
    assets,
    transactions,
    audits,
    saveBusinessUnit,
    saveLocation,
    deleteBusinessUnit,
    deleteLocation,
    notify,
  } = useInventory()
  const { currentUser } = useAuth()
  const createAllowed = canCreateInModule(currentUser, "master-data")
  const editAllowed = canManageExisting(currentUser, "master-data")
  const deleteAllowed = canDelete(currentUser, "master-data")
  const [query, setQuery] = useState("")
  const [unitEditor, setUnitEditor] = useState<{
    id?: string
    name: string
  } | null>(null)
  const [locationEditor, setLocationEditor] = useState<{
    id?: string
    name: string
  } | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<string | null>(null)
  const [deletingLocation, setDeletingLocation] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return master.businessUnits.filter((unit) =>
      `${unit.name} ${unit.code}`.toLocaleLowerCase().includes(search),
    )
  }, [master.businessUnits, query])
  const selectedUnit = master.businessUnits.find(
    (unit) => unit.id === unitEditor?.id,
  )
  const locations = selectedUnit
    ? master.locations.filter(
        (location) => location.businessUnitId === selectedUnit.id,
      )
    : []
  const unitName = unitEditor?.name.trim() ?? ""
  const unitNameIsDuplicate = master.businessUnits.some(
    (unit) =>
      unit.id !== unitEditor?.id &&
      unit.name.trim().toLocaleLowerCase() === unitName.toLocaleLowerCase(),
  )

  const requestDeleteUnit = (id: string) => {
    const unit = master.businessUnits.find((item) => item.id === id)
    if (!unit) return
    if (master.locations.some((location) => location.businessUnitId === id)) {
      notify(
        "Cannot delete this Business Unit while it has Locations. Remove or reassign the Locations first.",
      )
      return
    }
    if (
      assets.some(
        (asset) =>
          asset.businessUnitId === id || asset.businessUnit === unit.name,
      ) ||
      transactions.some(
        (transaction) =>
          transaction.businessUnitId === id ||
          transaction.businessUnit === unit.name,
      ) ||
      audits.some(
        (audit) =>
          audit.businessUnitId === id || audit.businessUnit === unit.name,
      )
    ) {
      notify(
        "Cannot delete this Business Unit because assets, transactions, or stock opname records still reference it.",
      )
      return
    }
    setDeletingUnit(id)
  }

  return (
    <div className="page">
      <PageHeader
        title="Business Units"
        subtitle="Manage Business Units and their child Locations."
        actions={
          <Button
            disabled={!createAllowed}
            onClick={() => setUnitEditor({ name: "" })}
          >
            <Plus size={16} /> Add Business Unit
          </Button>
        }
      />
      <Tabs items={tabs} active={activeTab} onChange={onTabChange} />
      <div className="toolbar">
        <label className="field">
          <span>Search Business Units</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or code..."
          />
        </label>
        <span className="record-count">{rows.length} records</span>
      </div>
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>NO</th>
                <th>NAME</th>
                <th>CODE</th>
                <th>LOCATION</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((unit, index) => (
                <tr key={unit.id}>
                  <td className="numeric">{index + 1}</td>
                  <td>{unit.name}</td>
                  <td>{unit.code}</td>
                  <td>
                    {
                      master.locations.filter(
                        (location) => location.businessUnitId === unit.id,
                      ).length
                    }{" "}
                    Locations
                  </td>
                  <td>
                    <div className="row-actions">
                      {editAllowed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setUnitEditor({ id: unit.id, name: unit.name })
                          }
                        >
                          <Edit3 size={14} /> Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!deleteAllowed}
                        aria-label={`Delete ${unit.name}`}
                        title={
                          deleteAllowed
                            ? `Delete ${unit.name}`
                            : "Only Admin can delete data."
                        }
                        onClick={() => requestDeleteUnit(unit.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="No Business Units found" />}
        </div>
      </section>

      <Modal
        open={!!unitEditor}
        title={
          unitEditor?.id
            ? `Edit ${selectedUnit?.name ?? "Business Unit"}`
            : "Add Business Unit"
        }
        description="The code is generated from the first letter of each word."
        onClose={() => {
          setUnitEditor(null)
          setLocationEditor(null)
        }}
        wide={!!unitEditor?.id}
      >
        {unitEditor && (
          <>
            <div className="form-grid">
              <Input
                autoFocus
                label="Business Unit Name *"
                value={unitEditor.name}
                onChange={(event) =>
                  setUnitEditor({ ...unitEditor, name: event.target.value })
                }
              />
              <Input
                label="Business Unit Code"
                value={generateBusinessUnitCode(unitEditor.name)}
                readOnly
              />
            </div>
            {unitNameIsDuplicate && (
              <div className="error-summary" role="alert">
                Business Unit name already exists.
              </div>
            )}
            {unitEditor.id && selectedUnit && (
              <section className="table-card">
                <header className="section-heading">
                  <div>
                    <h2>Location Management</h2>
                    <p>Locations belong to {selectedUnit.name}.</p>
                  </div>
                  <Button
                    disabled={!createAllowed || isSaving}
                    onClick={() => setLocationEditor({ name: "" })}
                  >
                    <Plus size={16} /> Add Location
                  </Button>
                </header>
                {locationEditor && (
                  <div className="form-grid master-form">
                    <Input
                      autoFocus
                      label="Location Name *"
                      value={locationEditor.name}
                      onChange={(event) =>
                        setLocationEditor({
                          ...locationEditor,
                          name: event.target.value,
                        })
                      }
                    />
                    <div className="form-actions">
                      <Button
                        variant="secondary"
                        onClick={() => setLocationEditor(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={
                          isSaving ||
                          !locationEditor.name.trim() ||
                          (editAllowed &&
                            locations.some(
                              (location) =>
                                location.id !== locationEditor.id &&
                                location.name.toLocaleLowerCase() ===
                                  locationEditor.name
                                    .trim()
                                    .toLocaleLowerCase(),
                            ))
                        }
                        onClick={async () => {
                          setIsSaving(true)
                          try {
                            const saved = await saveLocation(
                              locationEditor.name,
                              selectedUnit.id,
                              locationEditor.id,
                            )
                            if (saved) setLocationEditor(null)
                          } finally {
                            setIsSaving(false)
                          }
                        }}
                      >
                        Save Location
                      </Button>
                    </div>
                  </div>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>NO</th>
                        <th>LOCATION NAME</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((location, index) => (
                        <tr key={location.id}>
                          <td className="numeric">{index + 1}</td>
                          <td>{location.name}</td>
                          <td>
                            <div className="row-actions">
                              {editAllowed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setLocationEditor({
                                      id: location.id,
                                      name: location.name,
                                    })
                                  }
                                >
                                  <Edit3 size={14} /> Edit
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!deleteAllowed}
                                aria-label={`Delete ${location.name}`}
                                onClick={() => setDeletingLocation(location.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!locations.length && (
                    <EmptyState
                      title="No Locations yet"
                      description="Add a Location to this Business Unit to get started."
                    />
                  )}
                </div>
              </section>
            )}
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setUnitEditor(null)
                  setLocationEditor(null)
                }}
              >
                Close
              </Button>
              <Button
                disabled={
                  isSaving ||
                  !unitName ||
                  unitNameIsDuplicate ||
                  (!unitEditor.id && !createAllowed)
                }
                onClick={async () => {
                  setIsSaving(true)
                  try {
                    if (
                      await saveBusinessUnit(unitEditor.name, unitEditor.id)
                    ) {
                      if (!unitEditor.id) setUnitEditor(null)
                    }
                  } finally {
                    setIsSaving(false)
                  }
                }}
              >
                Save Business Unit
              </Button>
            </div>
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={!!deletingUnit}
        title={`Delete ${master.businessUnits.find((unit) => unit.id === deletingUnit)?.name ?? "Business Unit"}?`}
        description="This Business Unit can only be deleted when no Locations or inventory records reference it."
        danger
        onClose={() => setDeletingUnit(null)}
        onConfirm={async () => {
          if (!deletingUnit) return
          setIsSaving(true)
          try {
            if (await deleteBusinessUnit(deletingUnit)) setDeletingUnit(null)
          } finally {
            setIsSaving(false)
          }
        }}
      />
      <ConfirmDialog
        open={!!deletingLocation}
        title={`Delete ${master.locations.find((location) => location.id === deletingLocation)?.name ?? "Location"}?`}
        description="This Location cannot be deleted while assets, transactions, or stock opname records reference it."
        danger
        onClose={() => setDeletingLocation(null)}
        onConfirm={async () => {
          if (!deletingLocation) return
          setIsSaving(true)
          try {
            if (await deleteLocation(deletingLocation))
              setDeletingLocation(null)
          } finally {
            setIsSaving(false)
          }
        }}
      />
    </div>
  )
}
