export type AccountRole = "Admin" | "Member"

export type PublicAccount = {
  id: string
  account_id: string
  name: string
  nik: string
  profile_photo: string
  role: AccountRole
  position: string
  department: string
  business_unit: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export type ActionResult<T = undefined,> = { success: true } & { data: T } | {
  success: false
} & { error: string } & { code?: string }
