export type ApiSuccess<T,> = {
  success: true
  data: T
  status?: number
}

export type ApiFailure = {
  success: false
  error: string
  code?: string
  details?: Record<string, string>
  status?: number
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure
