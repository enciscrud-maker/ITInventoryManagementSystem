"use client"

import dynamic from "next/dynamic"
import type { PublicAccount } from "@/auth/types"

const InventoryApp = dynamic(
  () =>
    import("@/components/InventoryApp").then((module) => module.InventoryApp),
  {
    ssr: false,
    loading: () => (
      <main className="app-loading">
        <span className="brand-mark">IT</span>
        <strong>Loading inventory workspace...</strong>
      </main>
    ),
  },
)

export function InventoryAppLoader({ account }: { account: PublicAccount }) {
  return <InventoryApp account={account} />
}
