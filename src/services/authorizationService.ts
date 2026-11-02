import type {
  AccountRole,
  PagePermission,
  PublicAccount,
} from "@/auth/types"

export type PermissionAction = "view" | "create" | "update" | "delete" | "approve"

const permissions: Record<AccountRole, Record<PermissionAction, boolean>> = {
  Admin: {
    view: true,
    create: true,
    update: true,
    delete: true,
    approve: true,
  },
  Member: {
    view: true,
    create: false,
    update: false,
    delete: false,
    approve: false,
  },
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
export const canApprove = (
  user: Pick<PublicAccount, "role"> | null | undefined,
) => canPerformAction(user, "approve")

export function canCreateInModule(
  user: Pick<PublicAccount, "role" | "page_permissions"> | null | undefined,
  module: PagePermission,
) {
  if (!user) return false
  return user.role === "Admin" || user.page_permissions.includes(module)
}

export function canManageExisting(
  user: Pick<PublicAccount, "role"> | null | undefined,
) {
  return user?.role === "Admin"
}
