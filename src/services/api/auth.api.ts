import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import { mapData } from "@/lib/api/result"
import type { ApiResult } from "@/lib/api/types"
import type { PublicAccount } from "@/auth/types"
import { extractAuthenticatedAccount } from "./mappers/auth.mapper"

export const authApi = {
  async login(
    identity: string,
    password: string,
  ): Promise<ApiResult<PublicAccount>> {
    const result = await httpRequest<unknown>(apiRoutes.auth.login, {
      method: "POST",
      body: JSON.stringify({ identity, password }),
    })
    if (!result.success) return result

    const account = extractAuthenticatedAccount(result.data)
    if (account) return { ...result, data: account }

    return authApi.me()
  },

  async me(): Promise<ApiResult<PublicAccount>> {
    const result = await httpRequest<unknown>(apiRoutes.auth.me, {
      method: "GET",
    })
    return mapData(result, extractAuthenticatedAccount)
  },

  logout: () =>
    httpRequest<undefined>(apiRoutes.auth.logout, { method: "POST" }),
}
