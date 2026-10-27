import type { Asset, MasterItem } from "../data/demoData"

export const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ")
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(date),
  )
export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
export const today = () => new Date().toISOString().slice(0, 10)

export function generateAssetId(
  values: Partial<Asset>,
  master: Record<string, MasterItem[]>,
  assets: Asset[],
) {
  const code = (key: string, name?: string) =>
    master[key]?.find((x) => x.name === name)?.code ?? "XX"
  const prefix =
    `${code("categories", values.category)}${code("groups", values.group)}${code("types", values.type)}${code("brands", values.brand)}${values.businessUnit ?? "XXX"}`
      .replace(/\W/g, "")
      .toUpperCase()
  const max = assets
    .filter((a) => a.id.startsWith(prefix))
    .reduce((m, a) => Math.max(m, Number(a.id.slice(-5)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(5, "0")}`
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const csv = [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\n")
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/)
  const parse = (line: string) =>
    line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
  const headers = parse(lines.shift() ?? "")
  return lines
    .filter(Boolean)
    .map((line) =>
      Object.fromEntries(parse(line).map((v, i) => [headers[i], v])),
    )
}

export function calculateFinding(
  systemQty: number,
  physicalQty: number | null,
  systemLocation: string,
  actualLocation: string,
  duplicate = false,
) {
  if (duplicate) return "Double"
  if (physicalQty === null) return "Unverified"
  if (physicalQty === 0) return "Fisik tidak ada"
  if (
    physicalQty !== systemQty ||
    (actualLocation && actualLocation !== systemLocation)
  )
    return "Fisik ada data berbeda"
  return "Match"
}
