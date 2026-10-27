import config from "@payload-config"
import { getPayload } from "payload"
import type { PublicAccount } from "@/auth/types"
import { getCurrentAccountDocument, sanitizeAccount } from "@/lib/app-auth"

const exact = (value: string) => value.trim().toLocaleLowerCase()

export async function resolveAccountByNameOrNik(value: string) {
  const payload = await getPayload({ config })
  const input = value.trim()
  const byNik = await payload.find({
    collection: "accounts",
    where: { nik: { equals: input } },
    limit: 2,
    overrideAccess: true,
  })
  if (byNik.docs.length === 1)
    return { account: byNik.docs[0], ambiguous: false }

  const candidates = await payload.find({
    collection: "accounts",
    where: { name: { contains: input } },
    limit: 20,
    overrideAccess: true,
  })
  const matches = candidates.docs.filter(
    (account) => exact(account.name) === exact(input),
  )
  return {
    account: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
  }
}

export async function listAccounts(): Promise<PublicAccount[]> {
  const user = await getCurrentAccountDocument()
  if (!user || user.role !== "Admin") throw new Error("Forbidden")
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "accounts",
    depth: 1,
    sort: "name",
    limit: 200,
    user,
    overrideAccess: false,
  })
  return result.docs.map((account) => sanitizeAccount(account as never))
}
