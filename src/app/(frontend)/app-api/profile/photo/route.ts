import { uploadProfilePhotoAction } from "@/auth/actions"

export async function POST(request: Request) {
  const result = await uploadProfilePhotoAction(await request.formData())
  return Response.json(result, { status: result.success ? 200 : 400 })
}
