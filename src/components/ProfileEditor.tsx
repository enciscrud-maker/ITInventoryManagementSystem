"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { Camera, Trash2 } from "lucide-react"
import { useAuth } from "../auth/AuthContext"
import { updateProfile, uploadProfilePhoto } from "../auth/client"
import { businessUnits } from "../data/demoData"
import { Button, Input, Modal, Select } from "./ui"

export function ProfileEditor({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { currentUser, refreshCurrentUser } = useAuth()
  const [form, setForm] = useState(currentUser)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [removePhoto, setRemovePhoto] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setForm(currentUser)
    setPhoto(null)
    setPreview("")
    setRemovePhoto(false)
    setError("")
  }, [currentUser, open])

  const choosePhoto = (file?: File) => {
    if (!file) return
    setPhoto(file)
    setRemovePhoto(false)
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  }

  const save = () => {
    setError("")
    startTransition(async () => {
      const result = await updateProfile({
        name: form.name,
        nik: form.nik,
        position: form.position,
        department: form.department,
        business_unit: form.business_unit,
        remove_photo: removePhoto,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      let account = result.data
      if (photo) {
        const photoData = new FormData()
        photoData.set("photo", photo)
        const photoResult = await uploadProfilePhoto(photoData)
        if (!photoResult.success) {
          setError(photoResult.error)
          refreshCurrentUser(account)
          return
        }
        account = photoResult.data
      }
      refreshCurrentUser(account)
      onClose()
    })
  }

  const photoSource = preview || (!removePhoto ? currentUser.profile_photo : "")

  return (
    <Modal
      open={open}
      title="Edit Profile"
      description="Update your employee profile. Role changes require an Admin workflow."
      onClose={onClose}
    >
      <div className="profile-photo-editor">
        <span className="avatar avatar-profile">
          {photoSource ? (
            <Image
              src={photoSource}
              alt="Profile preview"
              width={72}
              height={72}
              unoptimized={photoSource.startsWith("data:")}
            />
          ) : (
            form.name.charAt(0).toUpperCase()
          )}
        </span>
        <div>
          <label className="btn btn-secondary">
            <Camera size={15} /> Change photo
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => choosePhoto(event.target.files?.[0])}
            />
          </label>
          {(photoSource || photo) && (
            <Button
              variant="ghost"
              onClick={() => {
                setPhoto(null)
                setPreview("")
                setRemovePhoto(true)
              }}
            >
              <Trash2 size={15} /> Remove
            </Button>
          )}
          <small>JPG, PNG, or WebP. Maximum 2 MB.</small>
        </div>
      </div>
      {error && <div className="error-summary">{error}</div>}
      <div className="form-grid master-form">
        <Input
          label="Full Name *"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          label="NIK *"
          value={form.nik}
          onChange={(event) => setForm({ ...form, nik: event.target.value })}
        />
        <Input label="Role" value={form.role} readOnly />
        <Input
          label="Position *"
          value={form.position}
          onChange={(event) =>
            setForm({ ...form, position: event.target.value })
          }
        />
        <Input
          label="Department *"
          value={form.department}
          onChange={(event) =>
            setForm({ ...form, department: event.target.value })
          }
        />
        <Select
          label="Business Unit *"
          value={form.business_unit}
          onChange={(event) =>
            setForm({ ...form, business_unit: event.target.value })
          }
          options={businessUnits}
        />
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </Modal>
  )
}
