"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Edit3, Plus } from "lucide-react"
import type { AccountRole, PublicAccount } from "@/auth/types"
import { createAccount, getAccounts, updateAccount } from "@/auth/client"
import { businessUnits } from "@/data/demoData"
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<PublicAccount[]>([])
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [unit, setUnit] = useState("")
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const load = () =>
    startTransition(async () => {
      const result = await getAccounts()
      if (result.success) setAccounts(result.data)
      else setError(result.error)
    })

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter(
      (account) =>
        [account.name, account.nik].join(" ").toLowerCase().includes(query) &&
        (!role || account.role === role) &&
        (!unit || account.business_unit === unit),
    )
  }, [accounts, role, search, unit])

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
      const result = draft.id
        ? await updateAccount(draft.id, draft)
        : await createAccount(draft)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDraft(null)
      load()
    })
  }

  return (
    <div className="page">
      <PageHeader
        title="Account Management"
        subtitle="Manage employee access, roles, business units, and account status."
        actions={
          <Button onClick={() => setDraft({ ...emptyDraft })}>
            <Plus size={16} /> Add Account
          </Button>
        }
      />
      {error && <div className="error-summary account-error">{error}</div>}
      <div className="toolbar">
        <SearchInput
          value={search}
          placeholder="Search name or NIK..."
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          options={[{ value: "", label: "All Roles" }, "Admin", "Member"]}
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
        <span className="record-count">{filtered.length} accounts</span>
      </div>
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Profile</th>
                <th>Name</th>
                <th>NIK</th>
                <th>Role</th>
                <th>Position</th>
                <th>Department</th>
                <th>Business Unit</th>
                <th>Account Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => (
                <tr key={account.id}>
                  <td>
                    <code>{account.account_id}</code>
                  </td>
                  <td>
                    <ProfileAvatar
                      name={account.name}
                      photo={account.profile_photo}
                    />
                  </td>
                  <td>
                    <strong>{account.name}</strong>
                  </td>
                  <td>
                    <code>{account.nik}</code>
                  </td>
                  <td>
                    <Badge tone={account.role === "Admin" ? "info" : "neutral"}>
                      {account.role}
                    </Badge>
                  </td>
                  <td>{account.position}</td>
                  <td>{account.department}</td>
                  <td>{account.business_unit}</td>
                  <td>
                    <Badge tone={account.is_active ? "success" : "neutral"}>
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td>{new Date(account.updated_at).toLocaleDateString()}</td>
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
          {!pending && !filtered.length && (
            <EmptyState
              title="No accounts found"
              description="Adjust the filters or create an employee account."
            />
          )}
        </div>
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
