"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Boxes, LockKeyhole } from "lucide-react"
import { loginAccount } from "@/auth/client"
import { recordLoginHistory } from "@/services/historyService"
import { Button, Input, PasswordInput } from "./ui"

export function LoginForm() {
  const [identity, setIdentity] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError("")
    startTransition(async () => {
      const result = await loginAccount(identity.trim(), password)
      if (!result.success) {
        recordLoginHistory({
          activityType: "Login Failed",
          attemptedIdentifier: identity.trim(),
          result: result.error,
        })
        setError(result.error)
        return
      }
      recordLoginHistory({
        activityType: "Login",
        account: result.data,
        attemptedIdentifier: identity.trim(),
        result: "Success",
      })
      router.replace("/")
      router.refresh()
    })
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-identity">
          <span className="brand-mark">
            <Boxes size={22} />
          </span>
          <div>
            <strong>IT Inventory Management</strong>
            <span>Internal Asset Management System</span>
          </div>
        </div>
        <div className="login-heading">
          <span className="login-icon">
            <LockKeyhole size={20} />
          </span>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to manage your IT inventory.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          {error && (
            <div className="error-summary" role="alert">
              {error}
            </div>
          )}
          <Input
            autoFocus
            autoComplete="username"
            label="Nama / NIK"
            placeholder="Enter your registered name or NIK"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
          />
          <PasswordInput
            autoComplete="current-password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            visible={visible}
            onToggle={() => setVisible(!visible)}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        <div className="demo-credentials">
          <strong>Demo environment</strong>
          <span>Development: 1 / 1</span>
          <span>Admin: DEMO-ADM-001 / DemoAdmin!2026</span>
          <span>Member: DEMO-MBR-001 / DemoMember!2026</span>
        </div>
        <p className="login-footnote">
          Authorized employees only. Authentication is handled separately from
          Payload CMS administration.
        </p>
      </section>
    </main>
  )
}
