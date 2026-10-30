"use client"

/** Gallery + upload for the evidence photos of one asset in a session. */ /* eslint-disable-next-line @next/next/no-img-element */

import { useState } from "react"
import { Camera, Trash2 } from "lucide-react"
import { Button, Modal } from "./ui"
import { MAX_EVIDENCE_PER_ASSET } from "../utils/audit"
export function AuditEvidenceModal({
  open,
  title,
  images,
  readOnly,
  onClose,
  onAdd,
  onRemove,
}: {
  open: boolean
  title: string
  images: string[]
  readOnly: boolean
  onClose: () => void
  onAdd: (files: File[]) => Promise<void>
  onRemove: (index: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const full = images.length >= MAX_EVIDENCE_PER_ASSET

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setError("")
    try {
      await onAdd(Array.from(list))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      wide
      title="Evidence"
      description={title}
      onClose={onClose}
    >
      <div className="evidence-gallery">
        {images.length === 0 && (
          <p className="confirm-copy">No evidence has been added yet.</p>
        )}
        <div className="evidence-grid">
          {images.map((src, index) => (
            <figure key={index}>
              {}
              <img src={src} alt={`Evidence ${index + 1}`} />
              {!readOnly && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove evidence ${index + 1}`}
                >
                  <Trash2 size={14} /> Remove
                </Button>
              )}
            </figure>
          ))}
        </div>
        {error && <small className="error">{error}</small>}
        <div className="form-actions">
          <small className="evidence-count">
            {images.length} / {MAX_EVIDENCE_PER_ASSET} photos
          </small>
          {!readOnly && (
            <label
              className={`btn btn-primary${busy || full ? " is-disabled" : ""}`}
              aria-disabled={busy || full}
            >
              <Camera size={15} />
              {busy ? "Processing…" : full ? "Limit reached" : "Add photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={busy || full}
                onChange={(e) => {
                  handleFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
