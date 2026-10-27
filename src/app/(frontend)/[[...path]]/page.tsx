import { redirect } from "next/navigation"
import { getCurrentAccount } from "@/lib/app-auth"
import { InventoryAppLoader } from "@/components/InventoryAppLoader"

export default async function ProtectedApplicationPage() {
  const account = await getCurrentAccount()
  if (!account) redirect("/login")
  return <InventoryAppLoader account={account} />
}
