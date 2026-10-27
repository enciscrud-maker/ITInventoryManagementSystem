import { logoutAction } from "@/auth/actions"

export async function POST() {
  return Response.json(await logoutAction())
}
