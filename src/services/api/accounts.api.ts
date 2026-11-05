import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import { mapData } from "@/lib/api/result"
import type { ApiResult } from "@/lib/api/types"
import type { PublicAccount, PasswordResetRequestView } from "@/auth/types"
import { toPublicAccount } from "./mappers/account.mapper"

const localRequest = {
  baseUrl: "same-origin" as const,
}

type UserPage = {
  items: unknown[]
  hasNext: boolean
}

const toManagedAccountRequest = (data: Record<string, unknown>) => ({
  employeeName: String(data.name ?? ""),
  employeeNik: String(data.nik ?? ""),
  employeePhone: String(data.phone ?? ""),
  position: String(data.position ?? ""),
  department: String(data.department ?? ""),
  businessUnit: String(data.business_unit ?? ""),
  employeeEmail: String(data.email ?? ""),
  password: String(data.password ?? ""),
  role: String(data.role ?? "Member"),
  pagePermissions: Array.isArray(data.page_permissions)
    ? data.page_permissions.filter(
        (permission): permission is string =>
          typeof permission === "string",
      )
    : [],
  isActive: data.is_active !== false,
})

export const accountsApi = {
  async list(): Promise<ApiResult<PublicAccount[]>> {
    const accounts: PublicAccount[] = []
    for (let page = 1; ; page += 1) {
      const result = await httpRequest<UserPage>(
        `${apiRoutes.users}?Page=${page}&PageSize=200`,
        {},
        localRequest,
      )
      if (!result.success) return result
      const mapped = result.data.items.map(toPublicAccount)
      const valid = mapped.filter(
        (account): account is PublicAccount => account !== null,
      )
      if (valid.length !== mapped.length) {
        return {
          success: false,
          error: "Respons daftar akun server tidak sesuai format.",
          code: "INVALID_RESPONSE",
          status: result.status,
        }
      }
      accounts.push(...valid)
      if (!result.data.hasNext) break
    }
    return { success: true, data: accounts }
  },
  async create(data: Record<string, unknown>): Promise<ApiResult<PublicAccount>> {
    const result = await httpRequest<unknown>(
      apiRoutes.accounts,
      {
        method: "POST",
        body: JSON.stringify(toManagedAccountRequest(data)),
      },
      localRequest,
    )
    if (!result.success) return result
    return mapData(result, toPublicAccount)
  },
  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResult<PublicAccount>> {
    const userId = Number(id)
    if (!Number.isInteger(userId) || userId < 1)
      return {
        success: false,
        error: "ID akun tidak valid.",
        code: "INVALID_ACCOUNT_ID",
      }
    const result = await httpRequest<unknown>(
      `${apiRoutes.accounts}/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify(toManagedAccountRequest(data)),
      },
      localRequest,
    )
    if (!result.success) return result
    return mapData(result, toPublicAccount)
  },
  getPasswordResetRequests: () =>
    httpRequest<{
      requests: PasswordResetRequestView[]
      adminEmail: string
      emailConfigured: false
    }>(apiRoutes.app.passwordReset, {}, localRequest),
  processPasswordReset: (data: {
    id: string
    action: "process" | "reject"
    newPassword?: string
    rejectionReason?: string
  }) =>
    httpRequest<PasswordResetRequestView>(
      apiRoutes.app.passwordReset,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      localRequest,
    ),
}
