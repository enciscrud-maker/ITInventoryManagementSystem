import type { PagePermission, PublicAccount } from "@/auth/types"

export type PermissionAction = "view" | "create" | "update" | "delete" | "approve"

type AuthorizationUser = Pick<
  PublicAccount,
  "role" | "page_permissions" | "is_main_admin"
>

export function canAccessPage(
  user: AuthorizationUser | null | undefined,
  page: PagePermission,
) {
  if (!user) return false
  if (user.is_main_admin || user.role === "Member") return true
  return user.page_permissions.includes(page)
}

export function canPerformAction(
  user: AuthorizationUser | null | undefined,
  action: PermissionAction,
  page?: PagePermission,
) {
  if (!user) return false
  if (user.is_main_admin) return true
  if (action === "view") return true
  if (!page) return false
  if (user.role === "Member")
    return action === "create" && user.page_permissions.includes(page)
  return canAccessPage(user, page)
}

export const canView = (user: Pick<PublicAccount, "role"> | null | undefined) =>
  Boolean(user)
export const canCreate = (
  user: AuthorizationUser | null | undefined,
  page?: PagePermission,
) => canPerformAction(user, "create", page)
export const canUpdate = (
  user: AuthorizationUser | null | undefined,
  page?: PagePermission,
) => canPerformAction(user, "update", page)
export const canDelete = (
  user: AuthorizationUser | null | undefined,
  page?: PagePermission,
) => canPerformAction(user, "delete", page)
export const canApprove = (
  user: AuthorizationUser | null | undefined,
  page?: PagePermission,
) => canPerformAction(user, "approve", page)

export function canCreateInModule(
  user: AuthorizationUser | null | undefined,
  module: PagePermission,
) {
  return canCreate(user, module)
}

export function canManageExisting(
  user: AuthorizationUser | null | undefined,
  page?: PagePermission,
) {
  return canUpdate(user, page)
}
