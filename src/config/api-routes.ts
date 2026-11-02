export const apiRoutes = {
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me",
  },
  app: {
    accounts: "/app-api/accounts",
    profile: "/app-api/profile",
    profilePhoto: "/app-api/profile/photo",
    passwordReset: "/app-api/password-reset",
  },
} as const
