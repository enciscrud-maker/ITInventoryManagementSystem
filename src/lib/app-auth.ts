import config from "@payload-config"
import { getPayload } from "payload"
import { cookies } from "next/headers"
import type { PublicAccount } from "@/auth/types"
import type { Account } from "@/payload-types"

export const APP_SESSION_COOKIE = "app-session"

export function sanitizeAccount(account: Account): PublicAccount {
  const photo = account.profile_photo
  return {
    id: String(account.id),
    account_id: account.account_id,
    name: account.name,
    nik: account.nik,
    profile_photo: typeof photo === "object" && photo?.url ? photo.url : "",
    role: account.role,
    position: account.position,
    department: account.department,
    business_unit: account.business_unit,
    is_active: account.is_active,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  }
}

export async function getCurrentAccountDocument() {
  const token = (await cookies()).get(APP_SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await getPayload({ config })
  const authHeaders = new Headers({ Authorization: `JWT ${token}` })
  const { user } = await payload.auth({ headers: authHeaders })
  if (!user || user.collection !== "accounts" || user.is_active !== true)
    return null
  return user as Account
}

export async function getCurrentAccount() {
  const account = await getCurrentAccountDocument()
  if (!account) return null
  const payload = await getPayload({ config })
  const hydrated = await payload.findByID({
    collection: "accounts",
    id: account.id,
    depth: 1,
    user: account,
    overrideAccess: false,
  })
  return sanitizeAccount(hydrated)
}

export async function setAppSession(token: string) {
  const store = await cookies()
  store.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
}

export async function clearAppSession() {
  const store = await cookies()
  store.set(APP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
}
