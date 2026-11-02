import type { Transaction } from "@/data/demoData"

const counterKey = "iti-transaction-request-sequence"
const romanMonths = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const

const historicalSequence = (transactions: Transaction[]) =>
  transactions.reduce((highest, transaction) => {
    const match = transaction.requestNumber?.match(/^(\d{4,})\//)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

const storedSequence = () => {
  if (typeof localStorage === "undefined") return 0
  return Number(localStorage.getItem(counterKey)) || 0
}

const formatRequestNumber = (
  sequence: number,
  businessUnit: string,
  date: string,
) => {
  const parsed = new Date(`${date}T00:00:00`)
  if (
    !businessUnit.trim() ||
    Number.isNaN(parsed.getTime()) ||
    !/^[A-Z0-9-]+$/.test(businessUnit.trim())
  )
    return ""
  return `${String(sequence).padStart(4, "0")}/${businessUnit.trim()}/${romanMonths[parsed.getMonth()]}/${parsed.getFullYear()}`
}

export const previewRequestNumber = (
  businessUnit: string,
  date: string,
  transactions: Transaction[],
) =>
  formatRequestNumber(
    Math.max(storedSequence(), historicalSequence(transactions)) + 1,
    businessUnit,
    date,
  )

export const reserveRequestNumber = (
  businessUnit: string,
  date: string,
  transactions: Transaction[],
) => {
  const sequence =
    Math.max(storedSequence(), historicalSequence(transactions)) + 1
  const requestNumber = formatRequestNumber(sequence, businessUnit, date)
  if (!requestNumber) return ""
  localStorage.setItem(counterKey, String(sequence))
  return requestNumber
}
