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

type PasswordResetApiRequest = {
  id: number
  requestId: string
  accountId: number
  memberName: string
  nik: string
  email: string
  phone: string
  requestDate: string
  status: PasswordResetRequestView["status"] | string
  processedBy?: string | null
  processedAt?: string | null
  rejectionReason?: string | null
}

type PasswordResetApiResponse = {
  requests: PasswordResetApiRequest[]
}

const toPasswordResetRequest = (
  request: PasswordResetApiRequest,
): PasswordResetRequestView | null => {
  if (
    request.status !== "Pending" &&
    request.status !== "Processed" &&
    request.status !== "Rejected"
  )
    return null
  return {
    id: String(request.id),
    request_id: request.requestId,
    account_id: String(request.accountId),
    member_name: request.memberName,
    nik: request.nik,
    email: request.email,
    phone: request.phone,
    request_date: request.requestDate,
    status: request.status,
    processed_by: request.processedBy ?? undefined,
    processed_at: request.processedAt ?? undefined,
    rejection_reason: request.rejectionReason ?? undefined,
  }
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
          success: false as const,
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
        success: false as const,
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
  async getPasswordResetRequests() {
    const result = await httpRequest<PasswordResetApiResponse>(
      apiRoutes.app.passwordResetRequests,
      {},
      localRequest,
    )
    if (!result.success) return result
    if (!Array.isArray(result.data.requests)) {
      return {
        success: false as const,
        error: "Respons permintaan reset password tidak sesuai format.",
        code: "INVALID_RESPONSE",
        status: result.status,
      }
    }
    const mapped = result.data.requests.map(toPasswordResetRequest)
    if (mapped.some((request) => request === null)) {
      return {
        success: false as const,
        error: "Respons permintaan reset password tidak sesuai format.",
        code: "INVALID_RESPONSE",
        status: result.status,
      }
    }
    return {
      ...result,
      data: {
        requests: mapped.filter(
          (request): request is PasswordResetRequestView => request !== null,
        ),
      },
    }
  },
  async processPasswordReset(data: {
    id: string
    action: "process" | "reject"
    newPassword?: string
    rejectionReason?: string
  }) {
    const id = Number(data.id)
    if (!Number.isInteger(id) || id < 1) {
      return {
        success: false,
        error: "ID permintaan reset password tidak valid.",
        code: "INVALID_REQUEST_ID",
      } as const
    }
    const result = await httpRequest<PasswordResetApiRequest>(
      `${apiRoutes.app.passwordResetRequests}/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: data.action,
          newPassword: data.newPassword,
          rejectionReason: data.rejectionReason,
        }),
      },
      localRequest,
    )
    if (!result.success) return result
    return mapData(result, toPasswordResetRequest)
  },
}
