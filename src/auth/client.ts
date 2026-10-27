import type { ActionResult, PublicAccount } from "./types"

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<ActionResult<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers:
        options?.body instanceof FormData
          ? options.headers
          : { "Content-Type": "application/json", ...options?.headers },
    })
    const body = await response.text()

    if (body) {
      try {
        const result = JSON.parse(body) as ActionResult<T>
        if (typeof result?.success === "boolean") return result
      } catch {
        // Fall through to the consistent client-facing error below.
      }
    }

    return {
      success: false,
      error: response.ok
        ? "Respons server tidak valid. Silakan coba lagi."
        : "Server tidak dapat memproses permintaan. Silakan coba lagi.",
    }
  } catch {
    return {
      success: false,
      error: "Tidak dapat terhubung ke server. Silakan coba lagi.",
    }
  }
}

export const loginAccount = (identity: string, password: string) =>
  request<PublicAccount>("/app-api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identity, password }),
  })

export const logoutAccount = () =>
  request<undefined>("/app-api/auth/logout", { method: "POST" })

export const updateProfile = (data: {
  name: string
  nik: string
  position: string
  department: string
  business_unit: string
  remove_photo?: boolean
}) =>
  request<PublicAccount>("/app-api/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const uploadProfilePhoto = (data: FormData) =>
  request<PublicAccount>("/app-api/profile/photo", {
    method: "POST",
    body: data,
  })

export const getAccounts = () => request<PublicAccount[]>("/app-api/accounts")

export const createAccount = (data: Record<string, unknown>) =>
  request<PublicAccount>("/app-api/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  })

export const updateAccount = (id: string, data: Record<string, unknown>) =>
  request<PublicAccount>("/app-api/accounts", {
    method: "PATCH",
    body: JSON.stringify({ id, data }),
  })
