"use client"

import { useRouter } from "next/navigation"
import { Button, EmptyState } from "@/components/ui"
export default function NotFound() {
  const router = useRouter()
  return (
    <div className="not-found">
      <EmptyState
        title="Page not found"
        description="The requested page does not exist."
      />
      <Button onClick={() => router.push("/")}>Return to Dashboard</Button>
    </div>
  )
}
