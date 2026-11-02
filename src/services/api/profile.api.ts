import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import type { PublicAccount } from "@/auth/types"

const localRequest = {
  baseUrl: "same-origin" as const,
  retryAfterRefresh: false,
}

export const profileApi = {
  update: (data: {
    name: string
    nik: string
    position: string
    department: string
    business_unit: string
    remove_photo?: boolean
  }) =>
    httpRequest<PublicAccount>(
      apiRoutes.app.profile,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      localRequest,
    ),
  uploadPhoto: (data: FormData) =>
    httpRequest<PublicAccount>(
      apiRoutes.app.profilePhoto,
      {
        method: "POST",
        body: data,
      },
      localRequest,
    ),
}
