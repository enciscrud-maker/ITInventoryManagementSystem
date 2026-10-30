"use client"

/**
 * Adds quantities from an Excel/CSV file (columns: asset_id, qty) to the
 * Physical Qty of assets that belong to the current session.
 */

import { useMemo, useState } from "react"
import { Badge, Button, Input, Modal } from "./ui"
import { downloadCsv } from "../utils/helpers"
import { matchAssetId } from "../utils/audit"
import type { AuditItem } from "../data/demoData"

type RawRow = Record<string, unknown>
type ParsedRow = {
  row: number
  assetId: string
  qty: number
  error: string
}

const keyOf = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
const pick = (row: RawRow, names: string[]) => {
  for (const [key, value] of Object.entries(row))
    if (names.includes(keyOf(key))) return String(value ?? "").trim()
  return ""
}
export function AuditImportModal({
  open,
  items,
  onClose,
  onCommit,
}: {
  open: boolean
  items: AuditItem[]
  onClose: () => void
  onCommit: (rows: { assetId: string, qty: number }[]) => number
}) {
  const [rows, setRows] = useState<RawRow[]>([])
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")

  const parsed = useMemo<ParsedRow[]>(() => {
    const ids = items.map((item) => item.assetId)
    return rows.map((raw, index) => {
      const idText = pick(raw, ["asset_id", "id_asset", "assetid", "asset"])
      const qtyText = pick(raw, ["qty", "quantity", "physical_qty", "jumlah"])
      const qty = Number(qtyText)
      const assetId = matchAssetId(idText, ids) ?? ""
      let problem = ""
      if (!idText) problem = "Asset ID is empty"
      else if (!assetId) problem = "Not part of this session"
      else if (!qtyText || !Number.isInteger(qty) || qty < 1)
        problem = "Qty must be a whole number of 1 or more"
      return {
        row: index + 2,
        assetId: assetId || idText,
        qty: Number.isFinite(qty) ? qty : 0,
        error: problem,
      }
    })
  }, [rows, items])
  const valid = parsed.filter((row) => !row.error)

  const reset = () => {
    setRows([])
    setFileName("")
    setError("")
  }
  const close = () => {
    reset()
    onClose()
  }
  const readFile = async (file?: File) => {
    if (!file) return
    reset()
    setFileName(file.name)
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) throw new Error("The workbook does not contain a sheet.")
      const data = XLSX.utils.sheet_to_json<RawRow>(
        workbook.Sheets[firstSheet],
        { defval: "", raw: false },
      )
      if (!data.length) throw new Error("No data rows were found in the file.")
      setRows(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The selected file could not be parsed.",
      )
    }
  }

  return (
    <Modal
      open={open}
      wide
      title="Import Quantity"
      description="Quantities are added to Physical Qty. Columns: asset_id, qty."
      onClose={close}
    >
      <div className="import-panel">
        <div className="import-actions">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={(e) => readFile(e.target.files?.[0])}
          />
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                "stock-opname-import-template.csv",
                items.map((item) => ({ asset_id: item.assetId, qty: "" })),
              )
            }
          >
            Download template
          </Button>
        </div>
        {error && (
          <div className="error-summary" role="alert">
            <strong>Import failed</strong>
            <span>{error}</span>
          </div>
        )}
        {parsed.length > 0 && (
          <>
            <div className="import-summary">
              <strong>
                {parsed.length} rows found{fileName ? ` in ${fileName}` : ""}
              </strong>
              <Badge
                tone={parsed.length - valid.length ? "warning" : "success"}
              >
                {valid.length} valid · {parsed.length - valid.length} skipped
              </Badge>
            </div>
            <div className="import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Asset ID</th>
                    <th>Qty</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>
                        <code>{row.assetId}</code>
                      </td>
                      <td className="numeric">{row.qty || "-"}</td>
                      <td>
                        {row.error ? (
                          <span className="error">{row.error}</span>
                        ) : (
                          <Badge>Good</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <small>Showing the first 50 of {parsed.length} rows.</small>
              )}
            </div>
          </>
        )}
        <div className="form-actions">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!valid.length}
            onClick={() => {
              onCommit(
                valid.map((row) => ({ assetId: row.assetId, qty: row.qty })),
              )
              close()
            }}
          >
            Add {valid.length} valid rows
          </Button>
        </div>
      </div>
    </Modal>
  )
}
