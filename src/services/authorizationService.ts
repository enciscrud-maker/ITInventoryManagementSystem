import type { AccountRole, PublicAccount } from "@/auth/types"

export type PermissionAction = "view" | "create" | "update" | "delete"

const permissions: Record<AccountRole, Record<PermissionAction, boolean>> = {
  Admin: { view: true, create: true, update: true, delete: true },
  Member: { view: true, create: true, update: true, delete: false },
}

export function canPerformAction(
  user: Pick<PublicAccount, "role"> | null | undefined,
  action: PermissionAction,
) {
  return user ? permissions[user.role][action] : false
}

export const canView = (user: Pick<PublicAccount, "role"> | null | undefined) =>
  canPerformAction(user, "view")
export const canCreate = (
  user: Pick<PublicAccount, "role"> | null | undefined,
) => canPerformAction(user, "create")
export const canUpdate = (
  user: Pick<PublicAccount, "role"> | null | undefined,
) => canPerformAction(user, "update")
export const canDelete = (
  user: Pick<PublicAccount, "role"> | null | undefined,
) => canPerformAction(user, "delete")
