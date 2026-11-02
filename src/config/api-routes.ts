export const apiRoutes = {
  auth: {
    login: "/app-api/backend/api/auth/login",
    logout: "/app-api/backend/api/auth/logout",
    refresh: "/app-api/backend/api/auth/refresh",
    me: "/app-api/backend/api/auth/me",
  },
  app: {
    accounts: "/app-api/accounts",
    profile: "/app-api/profile",
    profilePhoto: "/app-api/profile/photo",
    passwordReset: "/app-api/password-reset",
  },
} as const
