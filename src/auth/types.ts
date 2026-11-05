import type { ApiResult } from "@/lib/api/types"
import type { PagePermission } from "@/config/pageRegistry"

export type AccountRole = "Admin" | "Member"
export type { PagePermission } from "@/config/pageRegistry"

export type PublicAccount = {
  id: string
  account_id: string
  name: string
  nik: string
  email: string
  phone: string
  profile_photo: string
  role: AccountRole
  page_permissions: PagePermission[]
  is_main_admin: boolean
  position: string
  department: string
  business_unit: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export type ActionResult<T = undefined> = ApiResult<T>

export type PasswordResetStatus = "Pending" | "Processed" | "Rejected"

export type PasswordResetRequestView = {
  id: string
  request_id: string
  account_id: string
  member_name: string
  nik: string
  email: string
  phone: string
  request_date: string
  status: PasswordResetStatus
  processed_by?: string
  processed_at?: string
  rejection_reason?: string
}
