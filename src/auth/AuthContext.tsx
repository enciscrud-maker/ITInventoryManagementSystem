"use client"

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { PublicAccount } from "./types"
import { logoutAccount } from "./client"
import { recordLoginHistory } from "../services/historyService"

type AuthState = {
  currentUser: PublicAccount
  isAuthenticated: true
  isPending: boolean
  logoutError: string
  refreshCurrentUser: (account: PublicAccount) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: PublicAccount
  children: ReactNode
}) {
  const [currentUser, setCurrentUser] = useState(initialUser)
  const [logoutError, setLogoutError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const logout = async () => {
    setLogoutError("")
    const result = await logoutAccount()
    if (!result.success && result.status !== 401) {
      setLogoutError(result.error)
      return
    }
    recordLoginHistory({
      activityType: "Logout",
      account: currentUser,
      result: result.success ? "Success" : "Session expired",
    })
    startTransition(() => {
      router.replace("/login")
      router.refresh()
    })
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: true,
        isPending,
        logoutError,
        refreshCurrentUser: setCurrentUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("AuthProvider is missing")
  return value
}
