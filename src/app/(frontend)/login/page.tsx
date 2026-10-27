import { redirect } from "next/navigation"
import { getCurrentAccount } from "@/lib/app-auth"
import { LoginForm } from "@/components/LoginForm"

export default async function LoginPage() {
  const account = await getCurrentAccount()
  if (account) redirect("/")
  return <LoginForm />
}
