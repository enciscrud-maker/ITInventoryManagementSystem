import type { ApiResult } from "./types"

export function mapData<T, U>(
  result: ApiResult<T>,
  mapper: (data: T) => U | null,
): ApiResult<U> {
  if (!result.success) return result
  const data = mapper(result.data)
  if (data === null) {
    return {
      success: false,
      error: "Respons server tidak sesuai format yang diharapkan.",
      code: "INVALID_RESPONSE",
      status: result.status,
    }
  }
  return { ...result, data }
}
