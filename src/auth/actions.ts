import "server-only"

import config from "@payload-config"
import { getPayload } from "payload"
import type { ActionResult, AccountRole, PublicAccount } from "./types"
import {
  clearAppSession,
  getCurrentAccountDocument,
  sanitizeAccount,
  setAppSession,
} from "@/lib/app-auth"
import {
  listAccounts,
  resolveAccountByNameOrNik,
} from "@/services/accountService"

const invalidLogin = "Nama/NIK atau password tidak valid."
const developmentLogin = {
  nik: "1",
  enteredPassword: "1",
  payloadPassword: "111",
} as const

export async function loginAction(input: {
  identity: string
  password: string
}): Promise<ActionResult<PublicAccount>> {
  const identity = input.identity.trim()
  if (!identity || !input.password) {
    return { success: false, error: "Nama/NIK dan password wajib diisi." }
  }

  const resolved = await resolveAccountByNameOrNik(identity)
  if (resolved.ambiguous) {
    return {
      success: false,
      error:
        "Nama digunakan oleh beberapa akun. Silakan masuk menggunakan NIK.",
      code: "AMBIGUOUS_NAME",
    }
  }
  if (!resolved.account || resolved.account.is_active !== true) {
    return { success: false, error: invalidLogin }
  }

  try {
    const payload = await getPayload({ config })
    const password =
      resolved.account.nik === developmentLogin.nik &&
      input.password === developmentLogin.enteredPassword
        ? developmentLogin.payloadPassword
        : input.password
    const result = await payload.login({
      collection: "accounts",
      data: {
        username: resolved.account.nik,
        password,
      },
    })
    if (!result.token) return { success: false, error: invalidLogin }
    await setAppSession(result.token)
    return {
      success: true,
      data: sanitizeAccount(result.user as never),
    }
  } catch {
    return { success: false, error: invalidLogin }
  }
}

export async function logoutAction(): Promise<ActionResult> {
  await clearAppSession()
  return { success: true, data: undefined }
}

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
  role: AccountRole
  position: string
  department: string
  business_unit: string
  is_active?: boolean
}

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

  try {
    const payload = await getPayload({ config })
    const account = await payload.create({
      collection: "accounts",
      data: {
        account_id: "AUTO",
        name: input.name.trim(),
        nik: input.nik.trim(),
        username: input.nik.trim(),
        password: input.password,
        role: input.role,
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
  input: Omit<AccountInput, "password">,
): Promise<ActionResult<PublicAccount>> {
  const admin = await getCurrentAccountDocument()
  if (!admin || admin.role !== "Admin")
    return { success: false, error: "Only Admin can update accounts." }
  if (!["Admin", "Member"].includes(input.role))
    return { success: false, error: "Invalid role." }

  try {
    const payload = await getPayload({ config })
    const account = await payload.update({
      collection: "accounts",
      id,
      data: {
        name: input.name.trim(),
        nik: input.nik.trim(),
        username: input.nik.trim(),
        role: input.role,
        position: input.position.trim(),
        department: input.department.trim(),
        business_unit: input.business_unit.trim(),
        is_active: input.is_active,
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
