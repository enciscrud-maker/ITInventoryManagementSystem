import { loginAction } from "@/auth/actions"

export async function POST(request: Request) {
  const body = await request.json()
  const result = await loginAction({
    identity: String(body.identity ?? ""),
    password: String(body.password ?? ""),
  })
  return Response.json(result, { status: result.success ? 200 : 401 })
}
