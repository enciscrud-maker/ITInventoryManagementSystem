import "server-only"

import config from "@payload-config"
import { getPayload } from "payload"
import { appSettings } from "@/config/appSettings"
import { getCurrentAccountDocument } from "@/lib/app-auth"
import type {
  ActionResult,
  PasswordResetRequestView,
} from "@/auth/types"

const genericResponse =
  "If the submitted details match an active Member account, the request has been recorded for Admin review."

const normalize = (value: string) => value.trim().toLocaleLowerCase()

const toView = (request: Record<string, unknown>): PasswordResetRequestView => {
  const account = request.account
  const processedBy = request.processed_by
  return {
    id: String(request.id),
    request_id: String(request.request_id),
    account_id:
      typeof account === "object" && account
        ? String((account as { id?: unknown }).id ?? "")
        : String(account ?? ""),
    member_name: String(request.member_name),
    nik: String(request.nik),
    email: String(request.email),
    phone: String(request.phone),
    request_date: String(request.request_date),
    status: request.status as PasswordResetRequestView["status"],
    processed_by:
      typeof processedBy === "object" && processedBy
        ? String((processedBy as { name?: unknown }).name ?? "")
        : undefined,
    processed_at: request.processed_at
      ? String(request.processed_at)
      : undefined,
    rejection_reason: request.rejection_reason
      ? String(request.rejection_reason)
      : undefined,
  }
}

export async function submitPasswordResetRequest(input: {
  name: string
  nik: string
  email: string
  phone: string
}): Promise<
  ActionResult<{ message: string; emailDelivery: "not-configured" }>
> {
  const name = input.name.trim()
  const nik = input.nik.trim()
  const email = input.email.trim().toLocaleLowerCase()
  const phone = input.phone.trim()
  if (!name || !nik || !email || !phone)
    return { success: false, error: "Complete all required fields." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { success: false, error: "Enter a valid email address." }

  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: "accounts",
    where: { nik: { equals: nik } },
    limit: 2,
    context: { passwordResetLookup: true },
    overrideAccess: false,
  })
  const account = matches.docs.find(
    (candidate) =>
      candidate.role === "Member" &&
      candidate.is_active === true &&
      normalize(candidate.name) === normalize(name) &&
      normalize(candidate.email ?? "") === normalize(email) &&
      normalize(candidate.phone ?? "") === normalize(phone),
  )
  if (account) {
    const pending = await payload.find({
      collection: "password-reset-requests",
      where: {
        and: [
          { account: { equals: account.id } },
          { status: { equals: "Pending" } },
        ],
      },
      limit: 1,
      context: { passwordResetVerified: true },
      overrideAccess: false,
    })
    if (!pending.docs.length) {
      await payload.create({
        collection: "password-reset-requests",
        data: {
          request_id: `PRR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          account: account.id,
          member_name: account.name,
          nik: account.nik,
          email,
          phone,
          request_date: new Date().toISOString(),
          status: "Pending",
        },
        context: { passwordResetVerified: true },
        overrideAccess: false,
      })
    }
  }
  return {
    success: true,
    data: {
      message: genericResponse,
      emailDelivery: "not-configured",
    },
  }
}

export async function listPasswordResetRequests(): Promise<
  ActionResult<{
    requests: PasswordResetRequestView[]
    adminEmail: string
    emailConfigured: false
  }>
> {
  const admin = await getCurrentAccountDocument()
  if (!admin || admin.role !== "Admin")
    return { success: false, error: "Only Admin can view reset requests." }
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "password-reset-requests",
    depth: 1,
    sort: "-request_date",
    limit: 100,
    user: admin,
    overrideAccess: false,
  })
  return {
    success: true,
    data: {
      requests: result.docs.map((item) =>
        toView(item as unknown as Record<string, unknown>),
      ),
      adminEmail: appSettings.passwordResetAdminEmail,
      emailConfigured: false,
    },
  }
}

export async function processPasswordResetRequest(input: {
  id: string
  action: "process" | "reject"
  newPassword?: string
  rejectionReason?: string
}): Promise<ActionResult<PasswordResetRequestView>> {
  const admin = await getCurrentAccountDocument()
  if (!admin || admin.role !== "Admin")
    return { success: false, error: "Only Admin can process reset requests." }
  const payload = await getPayload({ config })
  const request = await payload.findByID({
    collection: "password-reset-requests",
    id: input.id,
    depth: 0,
    user: admin,
    overrideAccess: false,
  })
  if (request.status !== "Pending")
    return { success: false, error: "This request has already been resolved." }

  const now = new Date().toISOString()
  if (input.action === "process") {
    if (!input.newPassword || input.newPassword.length < 8)
      return {
        success: false,
        error: "The new password must contain at least 8 characters.",
      }
    const accountId =
      typeof request.account === "object"
        ? request.account.id
        : request.account
    await payload.update({
      collection: "accounts",
      id: accountId,
      data: { password: input.newPassword },
      user: admin,
      overrideAccess: false,
    })
  }
  const updated = await payload.update({
    collection: "password-reset-requests",
    id: request.id,
    depth: 1,
    data: {
      status: input.action === "process" ? "Processed" : "Rejected",
      processed_by: admin.id,
      processed_at: now,
      rejection_reason:
        input.action === "reject"
          ? input.rejectionReason?.trim() || "Information could not be verified."
          : null,
    },
    user: admin,
    overrideAccess: false,
  })
  return {
    success: true,
    data: toView(updated as unknown as Record<string, unknown>),
  }
}
