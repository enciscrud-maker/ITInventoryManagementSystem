"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Boxes, LockKeyhole } from "lucide-react"
import { loginAccount } from "@/auth/client"
import { submitPasswordReset } from "@/auth/client"
import { recordLoginHistory } from "@/services/historyService"
import { Button, Input, Modal, PasswordInput } from "./ui"

export function LoginForm() {
  const [identity, setIdentity] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState("")
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotError, setForgotError] = useState("")
  const [forgotMessage, setForgotMessage] = useState("")
  const [forgotPending, setForgotPending] = useState(false)
  const [forgot, setForgot] = useState({
    name: "",
    nik: "",
    email: "",
    phone: "",
  })
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

  const submitForgot = async () => {
    setForgotError("")
    setForgotMessage("")
    if (
      !forgot.name.trim() ||
      !forgot.nik.trim() ||
      !forgot.email.trim() ||
      !forgot.phone.trim()
    ) {
      setForgotError("Complete all required fields.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgot.email.trim())) {
      setForgotError("Enter a valid email address.")
      return
    }
    setForgotPending(true)
    const result = await submitPasswordReset(forgot)
    setForgotPending(false)
    if (!result.success) {
      setForgotError(result.error)
      return
    }
    setForgotMessage(
      result.data.message,
    )
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-identity">
          <span className="brand-mark">
            <Boxes size={22} />
          </span>
          <div>
            <strong>I-Track</strong>
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
          <Button
            variant="ghost"
            onClick={() => {
              setForgotOpen(true)
              setForgotError("")
              setForgotMessage("")
            }}
          >
            Forgot Password?
          </Button>
        </form>
        <p className="login-footnote">
          Authorized employees only. Authentication is handled separately from
          Payload CMS administration.
        </p>
      </section>
      <Modal
        open={forgotOpen}
        title="Forgot Password"
        description="Submit your registered Member details for Admin verification."
        onClose={() => setForgotOpen(false)}
      >
        {forgotMessage ? (
          <>
            <div className="scope-preview">{forgotMessage}</div>
            <div className="form-actions">
              <Button
                onClick={() => {
                  setForgotOpen(false)
                  setForgotMessage("")
                  setForgot({ name: "", nik: "", email: "", phone: "" })
                }}
              >
                Back to Login
              </Button>
            </div>
          </>
        ) : (
          <>
            {forgotError && (
              <div className="error-summary" role="alert">
                {forgotError}
              </div>
            )}
            <div className="form-grid">
              <Input
                label="Full Name *"
                value={forgot.name}
                onChange={(event) =>
                  setForgot({ ...forgot, name: event.target.value })
                }
              />
              <Input
                label="NIK *"
                value={forgot.nik}
                onChange={(event) =>
                  setForgot({ ...forgot, nik: event.target.value })
                }
              />
              <Input
                label="Email *"
                type="email"
                value={forgot.email}
                onChange={(event) =>
                  setForgot({ ...forgot, email: event.target.value })
                }
              />
              <Input
                label="Phone Number *"
                value={forgot.phone}
                onChange={(event) =>
                  setForgot({ ...forgot, phone: event.target.value })
                }
              />
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setForgotOpen(false)}>
                Back to Login
              </Button>
              <Button disabled={forgotPending} onClick={submitForgot}>
                {forgotPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </main>
  )
}
