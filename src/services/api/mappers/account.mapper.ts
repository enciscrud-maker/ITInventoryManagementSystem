import type { PublicAccount, AccountRole, PagePermission } from "@/auth/types"

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

const validPermissions: PagePermission[] = [
  "asset-inventory",
  "goods-in",
  "goods-out",
  "stock-opname",
  "master-data",
  "reports",
]

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

  const permissions =
    dto.permissions ?? value(dto, "pagePermissions", "page_permissions")
  return {
    id,
    account_id: text(
      dto.employeeId ?? value(dto, "accountId", "account_id"),
      id,
    ),
    name,
    nik,
    email: text(dto.employeeEmail ?? value(dto, "email", "email")),
    phone: text(value(dto, "phone", "phone")),
    profile_photo: text(
      dto.profilePhotoUrl ?? value(dto, "profilePhoto", "profile_photo"),
    ),
    role,
    page_permissions: Array.isArray(permissions)
      ? permissions.filter(
          (permission): permission is PagePermission =>
            typeof permission === "string" &&
            validPermissions.includes(permission as PagePermission),
        )
      : [],
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
