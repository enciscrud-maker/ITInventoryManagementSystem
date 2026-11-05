import { apiRoutes } from "@/config/api-routes"
import { httpRequest } from "@/lib/http/httpClient"
import { accountsApi, authApi, profileApi } from "@/services/api"

type PasswordResetSubmission = {
  message: string
}

export const loginAccount = authApi.login
export const logoutAccount = authApi.logout
export const getCurrentAccount = authApi.me
export const updateProfile = profileApi.update
export const uploadProfilePhoto = profileApi.uploadPhoto
export const getAccounts = accountsApi.list
export const createAccount = accountsApi.create
export const updateAccount = accountsApi.update
export const getPasswordResetRequests = accountsApi.getPasswordResetRequests
export const processPasswordReset = accountsApi.processPasswordReset

export const submitPasswordReset = (data: {
  name: string
  nik: string
  email: string
  phone: string
}) => {
  return httpRequest<PasswordResetSubmission>(
    apiRoutes.auth.passwordReset,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    { baseUrl: "same-origin", retryAfterRefresh: false },
  )
}
