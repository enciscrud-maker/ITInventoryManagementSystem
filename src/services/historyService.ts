import type { PublicAccount } from "@/auth/types"

export type LoginActivityType = "Login" | "Logout" | "Login Failed"
export type DataActivityAction = "Create" | "Update" | "Delete"

export type LoginHistoryRecord = {
  id: string
  accountId: string | null
  accountName: string
  nik: string
  role: string
  activityType: LoginActivityType
  timestamp: string
  result: string
  attemptedIdentifier?: string
}

export type ActivityChange = {
  before: string
  after: string
}

export type DataActivityRecord = {
  id: string
  accountId: string
  accountName: string
  nik: string
  module: string
  action: DataActivityAction
  recordId: string
  recordLabel: string
  timestamp: string
  changes?: Record<string, ActivityChange>
}

const loginHistoryKey = "iti-login-history"
const dataActivityKey = "iti-data-activity"
const historyEvent = "iti-history-updated"
const maxRecords = 2000
const sensitiveFields = new Set([
  "password",
  "passwordhash",
  "hash",
  "salt",
  "token",
  "secret",
])

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const read = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

const write = <T,>(key: string, value: T[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value.slice(0, maxRecords)))
  window.dispatchEvent(new CustomEvent(historyEvent, { detail: key }))
}

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export const getLoginHistory = () =>
  read<Partial<LoginHistoryRecord>>(loginHistoryKey)
    .map(
      (record, index): LoginHistoryRecord => ({
        id: record.id ?? `AUTH-LEGACY-${index}`,
        accountId: record.accountId ?? null,
        accountName: record.accountName ?? "Unidentified account",
        nik: record.nik ?? "",
        role: record.role ?? "",
        activityType: record.activityType ?? "Login Failed",
        timestamp: record.timestamp ?? new Date(0).toISOString(),
        result: record.result ?? "Unknown",
        attemptedIdentifier: record.attemptedIdentifier,
      }),
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )

export const getDataActivityHistory = () =>
  read<Partial<DataActivityRecord>>(dataActivityKey)
    .map(
      (record, index): DataActivityRecord => ({
        id: record.id ?? `ACT-LEGACY-${index}`,
        accountId: record.accountId ?? "",
        accountName: record.accountName ?? "Unknown account",
        nik: record.nik ?? "",
        module: record.module ?? "Unknown",
        action: record.action ?? "Update",
        recordId: record.recordId ?? "",
        recordLabel: record.recordLabel ?? "Unknown record",
        timestamp: record.timestamp ?? new Date(0).toISOString(),
        changes: record.changes,
      }),
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )

export function recordLoginHistory(input: {
  activityType: LoginActivityType
  account?: PublicAccount | null
  attemptedIdentifier?: string
  result: string
}) {
  const account = input.account
  const record: LoginHistoryRecord = {
    id: makeId("AUTH"),
    accountId: account?.id ?? null,
    accountName: account?.name ?? "Unidentified account",
    nik: account?.nik ?? "",
    role: account?.role ?? "",
    activityType: input.activityType,
    timestamp: new Date().toISOString(),
    result: input.result,
    attemptedIdentifier: input.attemptedIdentifier?.trim() || undefined,
  }
  write(loginHistoryKey, [record, ...read<LoginHistoryRecord>(loginHistoryKey)])
  return record
}

export function summarizeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.keys({ ...before, ...after }).reduce<
    Record<string, ActivityChange>
  >((changes, field) => {
    if (sensitiveFields.has(field.toLowerCase())) return changes
    const previous = displayValue(before[field])
    const next = displayValue(after[field])
    if (previous !== next) changes[field] = { before: previous, after: next }
    return changes
  }, {})
}

export function recordDataActivity(input: {
  actor: PublicAccount
  module: string
  action: DataActivityAction
  recordId: string
  recordLabel: string
  changes?: Record<string, ActivityChange>
}) {
  const record: DataActivityRecord = {
    id: makeId("ACT"),
    accountId: input.actor.id,
    accountName: input.actor.name,
    nik: input.actor.nik,
    module: input.module,
    action: input.action,
    recordId: input.recordId,
    recordLabel: input.recordLabel,
    timestamp: new Date().toISOString(),
    changes:
      input.changes && Object.keys(input.changes).length
        ? input.changes
        : undefined,
  }
  write(dataActivityKey, [
    record,
    ...read<DataActivityRecord>(dataActivityKey),
  ])
  return record
}

export function subscribeHistory(listener: () => void) {
  if (typeof window === "undefined") return () => undefined
  const onCustomEvent = () => listener()
  const onStorage = (event: StorageEvent) => {
    if (event.key === loginHistoryKey || event.key === dataActivityKey)
      listener()
  }
  window.addEventListener(historyEvent, onCustomEvent)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(historyEvent, onCustomEvent)
    window.removeEventListener("storage", onStorage)
  }
}
