"use client"

import { Button } from "@/components/ui"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const signOut = async () => {
    await fetch("/app-api/auth/logout", { method: "POST" })
    window.location.assign("/login")
  }

  return (
    <html lang="en">
      <body>
        <main className="login-page">
          <section className="login-card">
            <div className="login-heading">
              <h1>Something went wrong</h1>
              <p>
                The application could not complete this request. You can retry
                or sign out safely.
              </p>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
              <Button onClick={reset}>Try again</Button>
            </div>
            {error.digest && <code>Error reference: {error.digest}</code>}
          </section>
        </main>
      </body>
    </html>
  )
}
