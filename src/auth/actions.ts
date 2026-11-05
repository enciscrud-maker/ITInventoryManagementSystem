import "server-only"

import config from "@payload-config"
import { getPayload } from "payload"
import type {
  ActionResult,
  AccountRole,
  PagePermission,
  PublicAccount,
} from "./types"
import {
  clearAppSession,
  getCurrentAccountDocument,
  sanitizeAccount,
} from "@/lib/app-auth"
import { listAccounts } from "@/services/accountService"

type ProfileInput = {
  name: string
  nik: string
  position: string
  department: string
  business_unit: string
  remove_photo?: boolean
}

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ActionResult<PublicAccount>> {
  const user = await getCurrentAccountDocument()
  if (!user) return { success: false, error: "Session expired." }
  const name = input.name.trim()
  const nik = input.nik.trim()
  if (!name || !nik || !input.position.trim() || !input.department.trim()) {
    return { success: false, error: "Lengkapi seluruh field wajib." }
  }

  try {
    const payload = await getPayload({ config })
    const updated = await payload.update({
      collection: "accounts",
      id: user.id,
      depth: 1,
      data: {
        name,
        nik,
        username: nik,
        position: input.position.trim(),
        department: input.department.trim(),
        business_unit: input.business_unit.trim(),
        ...(input.remove_photo ? { profile_photo: null } : {}),
      },
      user,
      overrideAccess: false,
    })
    return { success: true, data: sanitizeAccount(updated as never) }
  } catch (error) {
    const message =
      error instanceof Error && error.message.toLowerCase().includes("unique")
        ? "NIK sudah digunakan oleh akun lain."
        : "Profil tidak dapat disimpan. Periksa data dan coba lagi."
    return { success: false, error: message }
  }
}

export async function uploadProfilePhotoAction(
  formData: FormData,
): Promise<ActionResult<PublicAccount>> {
  const user = await getCurrentAccountDocument()
  if (!user) return { success: false, error: "Session expired." }
  const photo = formData.get("photo")
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
    return { success: false, error: "Pilih file gambar yang valid." }
  }
  if (photo.size > 2 * 1024 * 1024) {
    return { success: false, error: "Ukuran foto maksimal 2 MB." }
  }

  try {
    const payload = await getPayload({ config })
    const media = await payload.create({
      collection: "media",
      data: { alt: `Profile photo for ${user.name}` },
      file: {
        data: Buffer.from(await photo.arrayBuffer()),
        mimetype: photo.type,
        name: photo.name,
        size: photo.size,
      },
      user,
      overrideAccess: false,
    })
    const updated = await payload.update({
      collection: "accounts",
      id: user.id,
      depth: 1,
      data: { profile_photo: media.id },
      user,
      overrideAccess: false,
    })
    return { success: true, data: sanitizeAccount(updated as never) }
  } catch {
    return { success: false, error: "Foto profil tidak dapat diunggah." }
  }
}

type AccountInput = {
  name: string
  nik: string
  password?: string
  email?: string
  phone?: string
  role: AccountRole
  page_permissions?: PagePermission[]
  position: string
  department: string
  business_unit: string
  is_active?: boolean
}

const allowedPagePermissions = [
  "asset-inventory",
  "goods-in",
  "goods-out",
  "stock-opname",
  "master-data",
  "reports",
] as const
type PayloadPagePermission = (typeof allowedPagePermissions)[number]
const allowedPagePermissionSet = new Set<string>(allowedPagePermissions)

const validPagePermissions = (input: PagePermission[] | undefined) =>
  (input ?? []).filter(
    (permission): permission is PayloadPagePermission =>
      allowedPagePermissionSet.has(permission),
  )

export async function getAccountsAction(): Promise<ActionResult<PublicAccount[]>> {
  try {
    return { success: true, data: await listAccounts() }
  } catch {
    return {
      success: false,
      error: "Only Admin can access account management.",
    }
  }
}

export async function createAccountAction(
  input: AccountInput,
): Promise<ActionResult<PublicAccount>> {
  const admin = await getCurrentAccountDocument()
  if (!admin || admin.role !== "Admin")
    return { success: false, error: "Only Admin can create accounts." }
  if (
    !input.name.trim() ||
    !input.nik.trim() ||
    !input.password ||
    input.password.length < 8
  ) {
    return {
      success: false,
      error: "Name, NIK, and a password of at least 8 characters are required.",
    }
  }
  if (!["Admin", "Member"].includes(input.role))
    return { success: false, error: "Invalid role." }
  if (input.password && input.password.length < 8)
    return {
      success: false,
      error: "The new password must contain at least 8 characters.",
    }

  try {
    const payload = await getPayload({ config })
    const account = await payload.create({
      collection: "accounts",
      data: {
        account_id: "AUTO",
        name: input.name.trim(),
        nik: input.nik.trim(),
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        username: input.nik.trim(),
        password: input.password,
        role: input.role,
        page_permissions:
          input.role === "Member"
            ? validPagePermissions(input.page_permissions)
            : [],
        position: input.position.trim(),
        department: input.department.trim(),
        business_unit: input.business_unit.trim(),
        is_active: true,
      },
      user: admin,
      overrideAccess: false,
    })
    return { success: true, data: sanitizeAccount(account as never) }
  } catch {
    return {
      success: false,
      error: "Account could not be created. NIK must be unique.",
    }
  }
}

export async function updateAccountAction(
  id: string,
  input: AccountInput,
): Promise<ActionResult<PublicAccount>> {
  const admin = await getCurrentAccountDocument()
  if (!admin || admin.role !== "Admin")
    return { success: false, error: "Only Admin can update accounts." }
  if (!["Admin", "Member"].includes(input.role))
    return { success: false, error: "Invalid role." }
  if (input.password && input.password.length < 8)
    return {
      success: false,
      error: "The new password must contain at least 8 characters.",
    }

  try {
    const payload = await getPayload({ config })
    const account = await payload.update({
      collection: "accounts",
      id,
      data: {
        name: input.name.trim(),
        nik: input.nik.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        username: input.nik.trim(),
        role: input.role,
        page_permissions:
          input.role === "Member"
            ? validPagePermissions(input.page_permissions)
            : [],
        position: input.position.trim(),
        department: input.department.trim(),
        business_unit: input.business_unit.trim(),
        is_active: input.is_active,
        ...(input.password ? { password: input.password } : {}),
      },
      user: admin,
      overrideAccess: false,
    })
    if (id === String(admin.id) && account.is_active === false) {
      await clearAppSession()
    }
    return { success: true, data: sanitizeAccount(account as never) }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Account could not be updated.",
    }
  }
}
