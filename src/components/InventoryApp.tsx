"use client"

import { usePathname } from "next/navigation"
import type { PublicAccount } from "@/auth/types"
import type { PagePermission } from "@/config/pageRegistry"
import { canAccessPage } from "@/services/authorizationService"
import { AuthProvider } from "@/auth/AuthContext"
import { InventoryProvider } from "@/context/InventoryContext"
import { AppLayout } from "@/components/Layout"
import Dashboard from "@/features/inventory/pages/Dashboard"
import AssetInventory from "@/features/inventory/pages/AssetInventory"
import Transactions from "@/features/inventory/pages/Transactions"
import Audits from "@/features/inventory/pages/Audits"
import MasterData from "@/features/inventory/pages/MasterData"
import Reports from "@/features/inventory/pages/Reports"
import SettingsPage from "@/features/inventory/pages/Settings"
import AccountsPage from "@/features/inventory/pages/Accounts"
import NotFound from "@/features/inventory/pages/NotFound"

function CurrentPage({ account }: { account: PublicAccount }) {
  const pathname = usePathname()
  const pageByPath: Record<string, PagePermission> = {
    "/": "dashboard",
    "/assets": "asset-inventory",
    "/goods-in": "goods-in",
    "/goods-out": "goods-out",
    "/audits": "stock-opname",
    "/master-data": "master-data",
    "/reports": "reports",
    "/settings": "settings",
  }
  if (pathname === "/accounts")
    return account.is_main_admin ? <AccountsPage /> : <NotFound />
  const page = pageByPath[pathname]
  if (!page || !canAccessPage(account, page)) return <NotFound />
  if (pathname === "/") return <Dashboard />
  if (pathname === "/assets") return <AssetInventory />
  if (pathname === "/goods-in") return <Transactions direction="In" />
  if (pathname === "/goods-out") return <Transactions direction="Out" />
  if (pathname === "/audits") return <Audits />
  if (pathname === "/master-data") return <MasterData />
  if (pathname === "/reports") return <Reports />
  if (pathname === "/settings") return <SettingsPage />
  return <NotFound />
}

export function InventoryApp({ account }: { account: PublicAccount }) {
  return (
    <AuthProvider initialUser={account}>
      <InventoryProvider>
        <AppLayout>
          <CurrentPage account={account} />
        </AppLayout>
      </InventoryProvider>
    </AuthProvider>
  )
}
