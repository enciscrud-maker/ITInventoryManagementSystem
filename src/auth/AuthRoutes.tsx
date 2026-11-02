"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { InventoryApp } from "@/components/InventoryApp"
import { LoginForm } from "@/components/LoginForm"
import type { PublicAccount } from "./types"
import { getCurrentAccount } from "./client"

function Loading({ message }: { message: string }) {
  return (
    <main className="app-loading" role="status">
      <span className="brand-mark">IT</span>
      <strong>{message}</strong>
    </main>
  )
}

export function ProtectedApplicationRoute() {
  const [account, setAccount] = useState<PublicAccount | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let active = true
    void getCurrentAccount().then((result) => {
      if (!active) return
      if (result.success) {
        setAccount(result.data)
      } else if (result.status === 401 || result.status === 403) {
        router.replace("/login")
      } else {
        setError(result.error)
      }
    })
    return () => {
      active = false
    }
  }, [router])

  if (account) return <InventoryApp account={account} />
  if (error) {
    return (
      <main className="app-loading" role="alert">
        <strong>Unable to verify your session.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    )
  }
  return <Loading message="Verifying your session..." />
}

export function LoginRoute() {
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true
    void getCurrentAccount().then((result) => {
      if (!active) return
      if (result.success) router.replace("/")
      else setChecking(false)
    })
    return () => {
      active = false
    }
  }, [router])

  if (checking) return <Loading message="Checking your session..." />
  return <LoginForm />
}
