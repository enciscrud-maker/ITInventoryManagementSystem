import {
  createAccountAction,
  getAccountsAction,
  updateAccountAction,
} from "@/auth/actions"
import type { AccountRole, PagePermission } from "@/auth/types"

export async function GET() {
  const result = await getAccountsAction()
  return Response.json(result, { status: result.success ? 200 : 403 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const result = await createAccountAction({
    name: String(body.name ?? ""),
    nik: String(body.nik ?? ""),
    password: String(body.password ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    role: String(body.role ?? "Member") as AccountRole,
    page_permissions: Array.isArray(body.page_permissions)
      ? (body.page_permissions as PagePermission[])
      : [],
    position: String(body.position ?? ""),
    department: String(body.department ?? ""),
    business_unit: String(body.business_unit ?? ""),
    is_active: true,
  })
  return Response.json(result, { status: result.success ? 201 : 400 })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const data = body.data ?? {}
  const result = await updateAccountAction(String(body.id ?? ""), {
    name: String(data.name ?? ""),
    nik: String(data.nik ?? ""),
    password: String(data.password ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    role: String(data.role ?? "Member") as AccountRole,
    page_permissions: Array.isArray(data.page_permissions)
      ? (data.page_permissions as PagePermission[])
      : [],
    position: String(data.position ?? ""),
    department: String(data.department ?? ""),
    business_unit: String(data.business_unit ?? ""),
    is_active: data.is_active === true,
  })
  return Response.json(result, { status: result.success ? 200 : 400 })
}
