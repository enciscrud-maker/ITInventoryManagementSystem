import type { PublicAccount, AccountRole, PagePermission } from "@/auth/types"
import { pageRegistry } from "@/config/pageRegistry"

type AccountDto = Record<string, unknown>

const value = (
  dto: AccountDto,
  camelName: string,
  snakeName: string,
): unknown => dto[camelName] ?? dto[snakeName]

const text = (input: unknown, fallback = "") =>
  typeof input === "string" || typeof input === "number"
    ? String(input)
    : fallback

const permissionPages: Record<PagePermission, string[]> = {
  dashboard: ["dashboard.read"],
  "asset-inventory": [
    "asset.read",
    "asset.create",
    "asset.update",
    "asset.import",
    "asset.export",
  ],
  "goods-in": ["good.in.read", "good.in.create", "good.in.status"],
  "goods-out": ["good.out.read", "good.out.create", "good.out.status"],
  "stock-opname": [
    "audit.read",
    "audit.create",
    "audit.update",
    "audit.approve",
  ],
  "master-data": [
    "master.read",
    "master.create",
    "master.update",
    "master.delete",
  ],
  reports: ["report.read"],
  settings: ["settings.read"],
}

const mapPagePermissions = (
  pagePermissions: unknown,
  permissions: unknown,
): PagePermission[] => {
  const explicitPages = Array.isArray(pagePermissions)
    ? pagePermissions.filter(
        (page): page is PagePermission =>
          typeof page === "string" &&
          pageRegistry.some((registered) => registered.id === page),
      )
    : null
  if (explicitPages) return explicitPages
  if (!Array.isArray(permissions)) return []
  const values = permissions.filter(
    (permission): permission is string => typeof permission === "string",
  )
  return pageRegistry
    .filter(({ id }) =>
      values.includes(id) ||
      permissionPages[id].some((permission) => values.includes(permission)),
    )
    .map(({ id }) => id)
}

export function toPublicAccount(input: unknown): PublicAccount | null {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return null

  const dto = input as AccountDto
  const id = text(dto.userId ?? value(dto, "id", "id"))
  const name = text(dto.employeeName ?? value(dto, "name", "name"))
  const nik = text(dto.employeeNik ?? value(dto, "nik", "nik"))
  const roles = Array.isArray(dto.roles)
    ? dto.roles.filter((role): role is string => typeof role === "string")
    : []
  const roleInput =
    value(dto, "role", "role") ??
    (roles.some((role) => role.toLowerCase().includes("admin"))
      ? "Admin"
      : roles.length
        ? "Member"
        : undefined)
  const role: AccountRole | null =
    roleInput === "Admin" || roleInput === "Member" ? roleInput : null
  if (!id || !name || !nik || !role) return null

  const permissions = dto.permissions
  const pagePermissions = value(dto, "pagePermissions", "page_permissions")
  return {
    id,
    account_id: text(
      dto.employeeId ?? value(dto, "accountId", "account_id"),
      id,
    ),
    name,
    nik,
    email: text(dto.employeeEmail ?? value(dto, "email", "email")),
    phone: text(dto.employeePhone ?? value(dto, "phone", "phone")),
    profile_photo: text(
      dto.profilePhotoUrl ?? value(dto, "profilePhoto", "profile_photo"),
    ),
    role,
    page_permissions: mapPagePermissions(pagePermissions, permissions),
    is_main_admin: dto.isMainAdmin === true || dto.is_main_admin === true,
    position: text(value(dto, "position", "position")),
    department: text(value(dto, "department", "department")),
    business_unit: text(value(dto, "businessUnit", "business_unit")),
    created_at: text(value(dto, "createdAt", "created_at")),
    updated_at: text(value(dto, "updatedAt", "updated_at")),
    is_active:
      dto.isActive !== false && value(dto, "isActive", "is_active") !== false,
  }
}

export function extractAccount(input: unknown): PublicAccount | null {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return null

  const body = input as Record<string, unknown>
  const nested = body.user ?? body.account ?? body.data
  return toPublicAccount(nested ?? input)
}
