import {
  listPasswordResetRequests,
  processPasswordResetRequest,
  submitPasswordResetRequest,
} from "@/auth/passwordReset"

export async function GET() {
  const result = await listPasswordResetRequests()
  return Response.json(result, { status: result.success ? 200 : 403 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const result = await submitPasswordResetRequest({
    name: String(body.name ?? ""),
    nik: String(body.nik ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
  })
  return Response.json(result, { status: result.success ? 201 : 400 })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const result = await processPasswordResetRequest({
    id: String(body.id ?? ""),
    action: body.action === "reject" ? "reject" : "process",
    newPassword:
      typeof body.newPassword === "string" ? body.newPassword : undefined,
    rejectionReason:
      typeof body.rejectionReason === "string"
        ? body.rejectionReason
        : undefined,
  })
  return Response.json(result, { status: result.success ? 200 : 400 })
}
