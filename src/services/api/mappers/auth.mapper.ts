import { toPublicAccount } from "./account.mapper"

export function extractAuthenticatedAccount(
  input: unknown,
): ReturnType<typeof toPublicAccount> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return null

  const body = input as Record<string, unknown>
  return toPublicAccount(body.user ?? body.account ?? body.data ?? input)
}
