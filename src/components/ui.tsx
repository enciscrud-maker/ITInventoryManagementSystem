"use client"

import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Eye,
  EyeOff,
} from "lucide-react"
import { useEffect, useId, useState } from "react"
import { cn } from "../utils/helpers"

type SelectOption = {
  value: string
  label: string
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}) {
  return (
    <button
      type={type}
      className={cn(
        "btn",
        `btn-${variant}`,
        size === "sm" && "btn-sm",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="icon-btn"
      {...props}
    >
      {children}
    </button>
  )
}
export function Input({
  label,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}) {
  return (
    <label className={cn("field", className)}>
      {label && <span>{label}</span>}
      <input {...props} />
      {error && <small className="error">{error}</small>}
    </label>
  )
}
export function PasswordInput({
  label,
  visible,
  onToggle,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  visible: boolean
  onToggle: () => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="password-field">
        <input type={visible ? "text" : "password"} {...props} />
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          onClick={onToggle}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </IconButton>
      </span>
    </label>
  )
}
export function Select({
  label,
  options,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  options: Array<string | SelectOption>
}) {
  return (
    <label className={cn("field", className)}>
      {label && <span>{label}</span>}
      <select {...props}>
        {options.map((x) =>
          typeof x === "string" ? (
            <option key={x} value={x}>
              {x}
            </option>
          ) : (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ),
        )}
      </select>
    </label>
  )
}
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  error?: string
}) {
  const listId = useId()
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? ""
  const [query, setQuery] = useState(selectedLabel)
  useEffect(() => setQuery(selectedLabel), [selectedLabel])
  return (
    <label className="field">
      <span>{label}</span>
      <input
        list={listId}
        value={query}
        placeholder="Search or select..."
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          const match = options.find(
            (option) => option.label.toLowerCase() === next.toLowerCase(),
          )
          if (match) onChange(match.value)
          else if (!next) onChange("")
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
      {error && <small className="error">{error}</small>}
    </label>
  )
}
export function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <textarea {...props} />
    </label>
  )
}
export function SearchInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <label className="search-input">
      <Search size={16} />
      <input aria-label="Search" placeholder="Search..." {...props} />
    </label>
  )
}
const badgeMap: Record<string, string> = {
  Good: "success",
  OK: "success",
  Completed: "success",
  Match: "success",
  Damaged: "danger",
  Rusak: "danger",
  Disposal: "danger",
  "Fisik tidak ada": "danger",
  Pending: "warning",
  "Fisik ada data berbeda": "warning",
  "In Progress": "info",
  Double: "purple",
  Unverified: "neutral",
  In: "info",
  Out: "warning",
  Active: "success",
  Inactive: "neutral",
}
export function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: string
}) {
  const key = String(children)
  return (
    <span
      className={cn("badge", `badge-${tone ?? badgeMap[key] ?? "neutral"}`)}
    >
      <i />
      {children}
    </span>
  )
}
export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  open: boolean
  title: string
  description?: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={cn("modal", wide && "modal-wide")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="overlay drawer-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <IconButton label="Close drawer" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </aside>
    </div>
  )
}
export function Tabs({
  items,
  active,
  onChange,
}: {
  items: string[]
  active: string
  onChange: (v: string) => void
}) {
  return (
    <div className="tabs">
      {items.map((x) => (
        <Button
          key={x}
          variant="ghost"
          className={active === x ? "active" : ""}
          onClick={() => onChange(x)}
        >
          {x}
        </Button>
      ))}
    </div>
  )
}
export function EmptyState({
  title = "No records found",
  description = "Try adjusting your filters or add a new record.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}
export function Pagination({
  page,
  pages,
  onChange,
  total,
  from,
  to,
}: {
  page: number
  pages: number
  onChange: (v: number) => void
  total: number
  from: number
  to: number
}) {
  return (
    <div className="pagination">
      <span>
        Showing {total ? from : 0}–{to} of {total}
      </span>
      <div>
        <IconButton
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <span>
          Page {page} of {Math.max(1, pages)}
        </span>
        <IconButton
          label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  )
}
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="confirm-copy">{description}</p>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
export function StatCard({
  label,
  value,
  icon,
  note,
  action,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  note?: string
  action?: React.ReactNode
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
        {action}
      </div>
      <i className="stat-icon">{icon}</i>
    </article>
  )
}
