import type { Asset, Audit } from "../data/demoData"

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error("Evidence image could not be loaded"))
    image.src = src
  })

/**
 * Builds a PDF of all evidence images in a session and downloads it.
 * Returns the number of assets that had evidence (0 = nothing exported).
 */
export async function exportEvidencePdf(
  audit: Audit,
  assets: Asset[],
): Promise<number> {
  const rows = audit.items.filter((item) => (item.evidence?.length ?? 0) > 0)
  if (!rows.length) return 0
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const pageH = 297
  const margin = 14
  const contentW = pageW - margin * 2
  const gap = 6
  const cellW = (contentW - gap) / 2
  const maxImgH = 68
  let y = margin

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("Stock Opname Evidence", margin, y + 5)
  y += 10
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(90)
  const meta = [
    `${audit.name} (${audit.id})`,
    `Business Unit: ${audit.businessUnit} | Location: ${audit.location} | Date: ${audit.date} | Auditor: ${audit.auditor}`,
    `Assets with evidence: ${rows.length}`,
  ]
  meta.forEach((line) => {
    doc.text(doc.splitTextToSize(line, contentW) as string[], margin, y)
    y += 4.5
  })
  y += 4
  doc.setTextColor(0)

  for (const item of rows) {
    const asset = assets.find((a) => a.id === item.assetId)
    const title = `${item.assetId} - ${
      asset ? `${asset.brand} ${asset.model}` : "Unknown asset"
    }`
    const detail = `Finding: ${item.finding} | System qty: ${item.systemQty ?? "-"} | Physical qty: ${item.physicalQty ?? "-"} | Location: ${item.actualLocation}`
    const titleLines = doc.splitTextToSize(title, contentW) as string[]
    const detailLines = doc.splitTextToSize(detail, contentW) as string[]
    const headerH = titleLines.length * 5 + detailLines.length * 4.2 + 3

    if (y + headerH + 40 > pageH - margin) {
      doc.addPage()
      y = margin
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.text(titleLines, margin, y + 4)
    y += titleLines.length * 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text(detailLines, margin, y + 3.5)
    y += detailLines.length * 4.2 + 3
    doc.setTextColor(0)

    const images = item.evidence ?? []
    for (let i = 0; i < images.length; i += 2) {
      const pair = images.slice(i, i + 2)
      const loaded = await Promise.all(
        pair.map((src) => loadImage(src).catch(() => null)),
      )
      const sized = loaded.map((img) => {
        if (!img) return null
        const ratio = Math.min(cellW / img.width, maxImgH / img.height)
        return { w: img.width * ratio, h: img.height * ratio }
      })
      const rowH = Math.max(0, ...sized.map((s) => s?.h ?? 0))
      if (!rowH) continue
      if (y + rowH > pageH - margin) {
        doc.addPage()
        y = margin
      }
      sized.forEach((size, index) => {
        if (!size) return
        doc.addImage(
          pair[index],
          "JPEG",
          margin + index * (cellW + gap),
          y,
          size.w,
          size.h,
        )
      })
      y += rowH + 4
    }
    y += 5
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${page} / ${pages}`, pageW - margin, pageH - 6, {
      align: "right",
    })
  }
  doc.save(`${audit.id}-evidence.pdf`)
  return rows.length
}
