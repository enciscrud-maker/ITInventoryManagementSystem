import { apiRoutes } from "@/config/api-routes"
import { apiBaseUrl, requestTimeoutMs } from "@/config/env"
import { refreshSession } from "@/lib/auth/sessionService"
import { adaptResponse } from "@/lib/api/responseAdapter"
import type { ApiFailure, ApiResult } from "@/lib/api/types"

type RequestOptions = {
  baseUrl?: "backend" | "same-origin"
  retryAfterRefresh?: boolean
  signal?: AbortSignal
}

const failure = (error: string, code: string): ApiFailure => ({
  success: false,
  error,
  code,
})

async function performRequest<T>(
  url: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<ApiResult<T>> {
  const baseUrl =
    options.baseUrl === "same-origin" ? window.location.origin : apiBaseUrl
  if (!baseUrl) {
    return failure(
      "API backend belum dikonfigurasi. Atur NEXT_PUBLIC_API_BASE_URL.",
      "API_NOT_CONFIGURED",
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort("timeout"),
    requestTimeoutMs,
  )
  const onAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener("abort", onAbort, { once: true })

  try {
    const headers = new Headers(init.headers)
    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json")
    }

    const response = await fetch(new URL(url, `${baseUrl}/`), {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
    return await adaptResponse<T>(response)
  } catch {
    if (options.signal?.aborted) {
      return failure("Permintaan dibatalkan.", "ABORTED")
    }
    if (controller.signal.aborted) {
      return failure("Permintaan ke server melewati batas waktu.", "TIMEOUT")
    }
    return failure(
      "Tidak dapat terhubung ke server. Silakan periksa koneksi Anda.",
      "NETWORK_ERROR",
    )
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", onAbort)
  }
}

export async function httpRequest<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const result = await performRequest<T>(path, init, options)
  if (
    result.success ||
    result.status !== 401 ||
    options.retryAfterRefresh === false ||
    path === apiRoutes.auth.login ||
    path === apiRoutes.auth.refresh ||
    path === apiRoutes.auth.logout
  ) {
    return result
  }

  const refreshed = await refreshSession(async () => {
    const refreshResult = await performRequest<unknown>(
      apiRoutes.auth.refresh,
      { method: "POST" },
      { baseUrl: "same-origin", retryAfterRefresh: false },
    )
    return refreshResult.success
  })

  if (!refreshed) return result
  return performRequest<T>(path, init, options)
}
