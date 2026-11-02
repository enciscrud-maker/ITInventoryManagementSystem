import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import { mapData } from "@/lib/api/result"
import type { ApiResult } from "@/lib/api/types"
import type { PublicAccount } from "@/auth/types"
import { extractAccount } from "./mappers/account.mapper"

const authRequest = {
  baseUrl: "same-origin" as const,
}

export const authApi = {
  async login(
    identity: string,
    password: string,
  ): Promise<ApiResult<PublicAccount>> {
    const result = await httpRequest<unknown>(
      apiRoutes.auth.login,
      {
        method: "POST",
        body: JSON.stringify({ identifier: identity, password }),
      },
      authRequest,
    )
    if (!result.success) return result

    const account = extractAccount(result.data)
    if (account) return { ...result, data: account }

    return authApi.me()
  },

  async me(): Promise<ApiResult<PublicAccount>> {
    const result = await httpRequest<unknown>(
      apiRoutes.auth.me,
      {
        method: "GET",
      },
      authRequest,
    )
    return mapData(result, extractAccount)
  },

  logout: () =>
    httpRequest<undefined>(
      apiRoutes.auth.logout,
      { method: "POST" },
      authRequest,
    ),
}
