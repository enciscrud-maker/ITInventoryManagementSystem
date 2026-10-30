import type { Asset, Audit, AuditItem } from "../data/demoData"
import { calculateFinding } from "./helpers"

export const MAX_EVIDENCE_PER_ASSET = 5

export type AuditScanResult = {
  ok: boolean
  assetId?: string
  physicalQty?: number
  message: string
}

export type AuditItemChanges = {
  physicalQty?: number | null
  actualLocation?: string
  notes?: string
  confirmed?: boolean
  addEvidence?: string[]
  removeEvidenceAt?: number
}

/** Recompute the finding of an item from its snapshot + counted values. */
export const recalcItem = (item: AuditItem): AuditItem => ({
  ...item,
  finding: calculateFinding(
    item.systemQty ?? 0,
    item.physicalQty,
    item.systemLocation ?? item.actualLocation,
    item.actualLocation,
  ),
})

/** Any change to the counted values invalidates a previous approval. */
export const resetConfirmation = (item: AuditItem): AuditItem => ({
  ...item,
  confirmed: false,
  confirmedBy: undefined,
  confirmedAt: undefined,
})

/**
 * Brings stored audits (including data saved before this feature existed)
 * to the current shape: snapshots, evidence array, scan log, new finding rule.
 */
export function normalizeAudit(audit: Audit, assets: Asset[]): Audit {
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const completed = audit.status === "Completed"
  return {
    ...audit,
    scanLog: audit.scanLog ?? [],
    items: audit.items.map((item) => {
      const asset = byId.get(item.assetId)
      const legacy = item.evidence as unknown
      // Legacy evidence was a temporary blob: URL, which does not survive a reload.
      const evidence = Array.isArray(legacy)
        ? legacy.filter(
            (v): v is string => typeof v === "string" && v.startsWith("data:"),
          )
        : typeof legacy === "string" && legacy.startsWith("data:")
          ? [legacy]
          : []
      const next: AuditItem = {
        ...item,
        systemQty: item.systemQty ?? asset?.quantity ?? 0,
        systemLocation:
          item.systemLocation ?? asset?.location ?? item.actualLocation,
        evidence,
      }
      return completed ? next : recalcItem(next)
    }),
  }
}

/** assetId -> physical qty of its most recent completed session (excluding `currentId`). */
export function buildHistoricalMap(audits: Audit[], currentId: string) {
  const map = new Map<string, number>()
  audits
    .filter((a) => a.status === "Completed" && a.id !== currentId)
    .sort((a, b) =>
      (a.completedAt ?? a.date).localeCompare(b.completedAt ?? b.date),
    )
    .forEach((a) =>
      a.items.forEach((item) => {
        if (item.physicalQty !== null) map.set(item.assetId, item.physicalQty)
      }),
    )
  return map
}

/**
 * Maps a scanned/imported code to an asset id of the session.
 * `loose` also accepts QR payloads that merely contain the asset id
 * (for example a URL ending with the id).
 */
export function matchAssetId(code: string, assetIds: string[], loose = false) {
  const raw = code.trim().toUpperCase()
  if (!raw) return null
  const exact = assetIds.find((id) => id.toUpperCase() === raw)
  if (exact) return exact
  if (!loose) return null
  const contained = assetIds
    .filter((id) => raw.includes(id.toUpperCase()))
    .sort((a, b) => b.length - a.length)
  return contained[0] ?? null
}

/** Resize + re-encode an image so it fits in browser storage. */
export function compressImage(
  file: File,
  maxSide = 1024,
  quality = 0.65,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`${file.name} is not an image`))
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error("Image processing is not supported"))
        return
      }
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL("image/jpeg", quality)
      URL.revokeObjectURL(url)
      resolve(data)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${file.name} could not be read`))
    }
    image.src = url
  })
}
