import { updateProfileAction } from "@/auth/actions"

export async function PATCH(request: Request) {
  const body = await request.json()
  const result = await updateProfileAction({
    name: String(body.name ?? ""),
    nik: String(body.nik ?? ""),
    position: String(body.position ?? ""),
    department: String(body.department ?? ""),
    business_unit: String(body.business_unit ?? ""),
    remove_photo: body.remove_photo === true,
  })
  return Response.json(result, { status: result.success ? 200 : 400 })
}
