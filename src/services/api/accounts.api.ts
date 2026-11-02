import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import type { PublicAccount, PasswordResetRequestView } from "@/auth/types"

const localRequest = {
  baseUrl: "same-origin" as const,
  retryAfterRefresh: false,
}

export const accountsApi = {
  list: () =>
    httpRequest<PublicAccount[]>(apiRoutes.app.accounts, {}, localRequest),
  create: (data: Record<string, unknown>) =>
    httpRequest<PublicAccount>(
      apiRoutes.app.accounts,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      localRequest,
    ),
  update: (id: string, data: Record<string, unknown>) =>
    httpRequest<PublicAccount>(
      apiRoutes.app.accounts,
      {
        method: "PATCH",
        body: JSON.stringify({ id, data }),
      },
      localRequest,
    ),
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
