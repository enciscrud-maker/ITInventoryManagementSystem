import { apiErrorMessages } from "./error-codes"
import type { ApiResult } from "./types"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeDetails = (
  value: unknown,
): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined

  const details = Object.entries(value).reduce<Record<string, string>>(
    (result, [field, messages]) => {
      if (typeof messages === "string") result[field] = messages
      else if (Array.isArray(messages)) {
        const text = messages.filter((item) => typeof item === "string")
        if (text.length) result[field] = text.join(" ")
      }
      return result
    },
    {},
  )

  return Object.keys(details).length ? details : undefined
}

export async function adaptResponse<T>(
  response: Response,
): Promise<ApiResult<T>> {
  const text = await response.text()
  let parsed: unknown

  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        success: false,
        error: response.ok
          ? "Respons server tidak valid. Silakan coba lagi."
          : (apiErrorMessages[response.status] ??
            "Server tidak dapat memproses permintaan."),
        code: response.ok ? "INVALID_RESPONSE" : `HTTP_${response.status}`,
        status: response.status,
      }
    }
  }

  if (!response.ok) {
    const body = isRecord(parsed) ? parsed : {}
    const serverError = response.status >= 500
    const details = serverError
      ? undefined
      : normalizeDetails(body.errors ?? body.details)
    const message =
      (!serverError && typeof body.detail === "string" && body.detail) ||
      (!serverError && typeof body.message === "string" && body.message) ||
      (!serverError && typeof body.error === "string" && body.error) ||
      (!serverError && typeof body.title === "string" && body.title) ||
      apiErrorMessages[response.status] ||
      "Server tidak dapat memproses permintaan."

    return {
      success: false,
      error: message,
      code:
        typeof body.code === "string" ? body.code : `HTTP_${response.status}`,
      details,
      status: response.status,
    }
  }

  if (response.status === 204 || parsed === undefined) {
    return { success: true, data: undefined as T, status: response.status }
  }

  if (isRecord(parsed) && parsed.success === false) {
    const error =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.detail === "string" && parsed.detail) ||
      (typeof parsed.message === "string" && parsed.message) ||
      "Server tidak dapat memproses permintaan."

    return {
      success: false,
      error,
      code: typeof parsed.code === "string" ? parsed.code : "API_ERROR",
      details: normalizeDetails(parsed.errors ?? parsed.details),
      status: response.status,
    }
  }

  const data =
    isRecord(parsed) && parsed.success === true && "data" in parsed
      ? parsed.data
      : parsed
  return { success: true, data: data as T, status: response.status }
}
