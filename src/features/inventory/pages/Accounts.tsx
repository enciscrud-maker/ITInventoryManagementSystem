"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Edit3, Plus } from "lucide-react"
import type { AccountRole, PublicAccount } from "@/auth/types"
import { useAuth } from "@/auth/AuthContext"
import { createAccount, getAccounts, updateAccount } from "@/auth/client"
import { businessUnits } from "@/data/demoData"
import {
  getDataActivityHistory,
  getLoginHistory,
  recordDataActivity,
  subscribeHistory,
  summarizeChanges,
  type DataActivityRecord,
  type LoginHistoryRecord,
} from "@/services/historyService"
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
} from "@/components/ui"
import { ProfileAvatar } from "@/components/Layout"

type AccountDraft = {
  id?: string
  name: string
  nik: string
  password: string
  role: AccountRole
  position: string
  department: string
  business_unit: string
  is_active: boolean
}

const tabs = [
  "Account Management — Add Account",
  "Login/Logout History",
  "Data Activity History",
]

const emptyDraft: AccountDraft = {
  name: "",
  nik: "",
  password: "",
  role: "Member",
  position: "",
  department: "",
  business_unit: businessUnits[0],
  is_active: true,
}

const inDateRange = (timestamp: string, start: string, end: string) => {
  const time = new Date(timestamp).getTime()
  if (Number.isNaN(time)) return false
  if (start) {
    const startTime = new Date(`${start}T00:00:00`).getTime()
    if (time < startTime) return false
  }
  if (end) {
    const endTime = new Date(`${end}T23:59:59.999`).getTime()
    if (time > endTime) return false
  }
  return true
}

const formatTimestamp = (timestamp: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp))

const formatChanges = (record: DataActivityRecord) => {
  if (!record.changes) return "—"
  return Object.entries(record.changes)
    .map(
      ([field, change]) =>
        `${field.replace(/([A-Z])/g, " $1")}: ${change.before} → ${change.after}`,
    )
    .join("; ")
}

export default function AccountsPage() {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [accounts, setAccounts] = useState<PublicAccount[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([])
  const [activityHistory, setActivityHistory] = useState<DataActivityRecord[]>(
    [],
  )
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [unit, setUnit] = useState("")
  const [loginSearch, setLoginSearch] = useState("")
  const [loginStart, setLoginStart] = useState("")
  const [loginEnd, setLoginEnd] = useState("")
  const [loginType, setLoginType] = useState("")
  const [activitySearch, setActivitySearch] = useState("")
  const [activityStart, setActivityStart] = useState("")
  const [activityEnd, setActivityEnd] = useState("")
  const [activityAction, setActivityAction] = useState("")
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const refreshHistory = () => {
    setLoginHistory(getLoginHistory())
    setActivityHistory(getDataActivityHistory())
  }

  const load = () =>
    startTransition(async () => {
      const result = await getAccounts()
      if (result.success) setAccounts(result.data)
      else setError(result.error)
    })

  useEffect(() => {
    load()
    refreshHistory()
    return subscribeHistory(refreshHistory)
  }, [])

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter(
      (account) =>
        [account.name, account.nik].join(" ").toLowerCase().includes(query) &&
        (!role || account.role === role) &&
        (!unit || account.business_unit === unit),
    )
  }, [accounts, role, search, unit])

  const filteredLoginHistory = useMemo(() => {
    const query = loginSearch.trim().toLowerCase()
    return loginHistory.filter(
      (record) =>
        (!query ||
          [
            record.accountName,
            record.nik,
            record.attemptedIdentifier,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)) &&
        (!loginType || record.activityType === loginType) &&
        inDateRange(record.timestamp, loginStart, loginEnd),
    )
  }, [loginEnd, loginHistory, loginSearch, loginStart, loginType])

  const filteredActivityHistory = useMemo(() => {
    const query = activitySearch.trim().toLowerCase()
    return activityHistory.filter(
      (record) =>
        (!query ||
          [record.accountName, record.nik]
            .join(" ")
            .toLowerCase()
            .includes(query)) &&
        (!activityAction || record.action === activityAction) &&
        inDateRange(record.timestamp, activityStart, activityEnd),
    )
  }, [
    activityAction,
    activityEnd,
    activityHistory,
    activitySearch,
    activityStart,
  ])

  const edit = (account: PublicAccount) =>
    setDraft({
      id: account.id,
      name: account.name,
      nik: account.nik,
      password: "",
      role: account.role,
      position: account.position,
      department: account.department,
      business_unit: account.business_unit,
      is_active: account.is_active,
    })

  const save = () => {
    if (!draft) return
    setError("")
    startTransition(async () => {
      const existing = draft.id
        ? accounts.find((account) => account.id === draft.id)
        : undefined
      const result = draft.id
        ? await updateAccount(draft.id, draft)
        : await createAccount(draft)
      if (!result.success) {
        setError(result.error)
        return
      }
      const changes = existing
        ? summarizeChanges(
            existing as unknown as Record<string, unknown>,
            result.data as unknown as Record<string, unknown>,
          )
        : undefined
      if (!existing || Object.keys(changes ?? {}).length) {
        recordDataActivity({
          actor: currentUser,
          module: "Account Management",
          action: existing ? "Update" : "Create",
          recordId: result.data.id,
          recordLabel: result.data.name,
          changes,
        })
      }
      setDraft(null)
      load()
    })
  }

  return (
    <div className="page">
      <PageHeader
        title="Account Management"
        subtitle="Manage employee accounts and review authentication and data activity."
        actions={
          activeTab === tabs[0] ? (
            <Button onClick={() => setDraft({ ...emptyDraft })}>
              <Plus size={16} /> Add Account
            </Button>
          ) : undefined
        }
      />

      <section className="table-card account-tabs-card">
        <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === tabs[0] && (
          <>
            {error && (
              <div className="error-summary account-error">{error}</div>
            )}
            <div className="toolbar account-tab-toolbar">
              <SearchInput
                value={search}
                placeholder="Search name or NIK..."
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                aria-label="Filter by role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                options={[
                  { value: "", label: "All Roles" },
                  "Admin",
                  "Member",
                ]}
              />
              <Select
                aria-label="Filter by business unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                options={[
                  { value: "", label: "All Business Units" },
                  ...businessUnits,
                ]}
              />
              <span className="record-count">
                {filteredAccounts.length} accounts
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Name</th>
                    <th>NIK</th>
                    <th>Role</th>
                    <th>Position</th>
                    <th>Department / Business Unit</th>
                    <th>Account Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <ProfileAvatar
                          name={account.name}
                          photo={account.profile_photo}
                        />
                      </td>
                      <td>
                        <strong>{account.name}</strong>
                        <small>{account.account_id}</small>
                      </td>
                      <td>
                        <code>{account.nik}</code>
                      </td>
                      <td>
                        <Badge
                          tone={account.role === "Admin" ? "info" : "neutral"}
                        >
                          {account.role}
                        </Badge>
                      </td>
                      <td>{account.position}</td>
                      <td>
                        <strong>{account.department}</strong>
                        <small>{account.business_unit}</small>
                      </td>
                      <td>
                        <Badge
                          tone={account.is_active ? "success" : "neutral"}
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => edit(account)}
                        >
                          <Edit3 size={14} /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pending && !filteredAccounts.length && (
                <EmptyState
                  title="No accounts found"
                  description="Adjust the filters or create an employee account."
                />
              )}
            </div>
          </>
        )}

        {activeTab === tabs[1] && (
          <>
            <div className="toolbar account-tab-toolbar history-toolbar">
              <SearchInput
                value={loginSearch}
                placeholder="Account name, NIK, or attempted identifier..."
                onChange={(event) => setLoginSearch(event.target.value)}
              />
              <Input
                aria-label="Login history start date"
                type="date"
                value={loginStart}
                onChange={(event) => setLoginStart(event.target.value)}
              />
              <Input
                aria-label="Login history end date"
                type="date"
                value={loginEnd}
                onChange={(event) => setLoginEnd(event.target.value)}
              />
              <Select
                aria-label="Login activity type"
                value={loginType}
                onChange={(event) => setLoginType(event.target.value)}
                options={[
                  { value: "", label: "All Activities" },
                  "Login",
                  "Logout",
                  "Login Failed",
                ]}
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setLoginSearch("")
                  setLoginStart("")
                  setLoginEnd("")
                  setLoginType("")
                }}
              >
                Clear Filters
              </Button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Account Name</th>
                    <th>NIK</th>
                    <th>Role</th>
                    <th>Activity</th>
                    <th>Status / Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoginHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{formatTimestamp(record.timestamp)}</td>
                      <td>
                        <strong>{record.accountName}</strong>
                        {record.attemptedIdentifier &&
                          !record.accountId && (
                            <small>
                              Attempted: {record.attemptedIdentifier}
                            </small>
                          )}
                      </td>
                      <td>{record.nik || "—"}</td>
                      <td>{record.role || "—"}</td>
                      <td>
                        <Badge
                          tone={
                            record.activityType === "Login Failed"
                              ? "danger"
                              : record.activityType === "Login"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {record.activityType}
                        </Badge>
                      </td>
                      <td>{record.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredLoginHistory.length && (
                <EmptyState
                  title="No authentication history"
                  description="No login or logout events match the selected filters."
                />
              )}
            </div>
          </>
        )}

        {activeTab === tabs[2] && (
          <>
            <div className="toolbar account-tab-toolbar history-toolbar">
              <SearchInput
                value={activitySearch}
                placeholder="Account name or NIK..."
                onChange={(event) => setActivitySearch(event.target.value)}
              />
              <Input
                aria-label="Data activity start date"
                type="date"
                value={activityStart}
                onChange={(event) => setActivityStart(event.target.value)}
              />
              <Input
                aria-label="Data activity end date"
                type="date"
                value={activityEnd}
                onChange={(event) => setActivityEnd(event.target.value)}
              />
              <Select
                aria-label="Data activity action"
                value={activityAction}
                onChange={(event) => setActivityAction(event.target.value)}
                options={[
                  { value: "", label: "All Actions" },
                  { value: "Create", label: "Create / Add" },
                  { value: "Update", label: "Edit / Update" },
                  "Delete",
                ]}
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setActivitySearch("")
                  setActivityStart("")
                  setActivityEnd("")
                  setActivityAction("")
                }}
              >
                Clear Filters
              </Button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Account Name</th>
                    <th>NIK</th>
                    <th>Module / Menu</th>
                    <th>Action</th>
                    <th>Record / Item</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivityHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{formatTimestamp(record.timestamp)}</td>
                      <td>{record.accountName}</td>
                      <td>{record.nik}</td>
                      <td>{record.module}</td>
                      <td>
                        <Badge
                          tone={
                            record.action === "Delete"
                              ? "danger"
                              : record.action === "Create"
                                ? "success"
                                : "info"
                          }
                        >
                          {record.action}
                        </Badge>
                      </td>
                      <td>
                        <strong>{record.recordLabel}</strong>
                        <small>{record.recordId}</small>
                      </td>
                      <td className="activity-details">
                        {formatChanges(record)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredActivityHistory.length && (
                <EmptyState
                  title="No data activity history"
                  description="No successful data changes match the selected filters."
                />
              )}
            </div>
          </>
        )}
      </section>

      <Modal
        open={!!draft}
        title={draft?.id ? "Edit Account" : "Create Account"}
        description="Passwords are securely hashed by Payload and are never shown in this interface."
        onClose={() => setDraft(null)}
        wide
      >
        {draft && (
          <>
            <div className="form-grid master-form">
              <Input
                label="Name *"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
              <Input
                label="NIK *"
                value={draft.nik}
                onChange={(event) =>
                  setDraft({ ...draft, nik: event.target.value })
                }
              />
              {!draft.id && (
                <Input
                  label="Initial Password *"
                  type="password"
                  minLength={8}
                  value={draft.password}
                  onChange={(event) =>
                    setDraft({ ...draft, password: event.target.value })
                  }
                />
              )}
              <Select
                label="Role *"
                value={draft.role}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    role: event.target.value as AccountRole,
                  })
                }
                options={["Admin", "Member"]}
              />
              <Input
                label="Position *"
                value={draft.position}
                onChange={(event) =>
                  setDraft({ ...draft, position: event.target.value })
                }
              />
              <Input
                label="Department *"
                value={draft.department}
                onChange={(event) =>
                  setDraft({ ...draft, department: event.target.value })
                }
              />
              <Select
                label="Business Unit *"
                value={draft.business_unit}
                onChange={(event) =>
                  setDraft({ ...draft, business_unit: event.target.value })
                }
                options={businessUnits}
              />
              {draft.id && (
                <Select
                  label="Account Status"
                  value={draft.is_active ? "Active" : "Inactive"}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      is_active: event.target.value === "Active",
                    })
                  }
                  options={["Active", "Inactive"]}
                />
              )}
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button disabled={pending} onClick={save}>
                {pending ? "Saving..." : "Save Account"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
