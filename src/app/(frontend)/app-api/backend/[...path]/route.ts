import { NextResponse } from "next/server"
import { apiBaseUrl } from "@/config/env"

const accessCookie = "iti-api-access"
const refreshCookie = "iti-api-refresh"

const allowedMethods: Record<string, string> = {
  "api/auth/login": "POST",
  "api/auth/logout": "POST",
  "api/auth/refresh": "POST",
  "api/auth/me": "GET",
}
const masterDataResources = new Set([
  "api/brands",
  "api/categories",
  "api/asset-types",
  "api/asset-models",
  "api/asset-groups",
])
const assetsReadResource = "api/assets"

const timeoutMs = 10_000
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

function requestCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie")?.split(";") ?? []
  const prefix = `${name}=`
  const match = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(accessCookie, "", { ...cookieOptions, maxAge: 0 })
  response.cookies.set(refreshCookie, "", { ...cookieOptions, maxAge: 0 })
  return response
}

function problemResponse(status: number, title: string) {
  return NextResponse.json({ status, title }, { status })
}

async function proxyAuthRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  const endpoint = path.join("/")
  const isAuthEndpoint = Object.hasOwn(allowedMethods, endpoint)
  const resource = path.length >= 2 ? path.slice(0, 2).join("/") : ""
  const isMasterDataEndpoint = masterDataResources.has(resource)
  const isAssetsReadEndpoint = endpoint === assetsReadResource
  const hasResourceId =
    path.length === 3 && /^\d+$/.test(path[2]) && Number(path[2]) > 0
  const allowedMasterDataMethod =
    !isMasterDataEndpoint || path.length === 2
      ? ["GET", "POST"].includes(request.method)
      : hasResourceId && ["GET", "PUT", "DELETE"].includes(request.method)
  const expectedMethod = allowedMethods[endpoint]

  if (!isAuthEndpoint && !isMasterDataEndpoint && !isAssetsReadEndpoint) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  if (
    (isAuthEndpoint && request.method !== expectedMethod) ||
    (isMasterDataEndpoint && !allowedMasterDataMethod) ||
    (isAssetsReadEndpoint && request.method !== "GET")
  ) {
    return NextResponse.json({ error: "Method not allowed." }, { status: 405 })
  }
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: "API backend is not configured.", code: "API_NOT_CONFIGURED" },
      { status: 503 },
    )
  }

  if (request.method !== "GET") {
    const origin = request.headers.get("origin")
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    const protocol =
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.replace(/:$/, "")
    const requestOrigin = host ? `${protocol}://${host}` : null
    if (!origin || !requestOrigin || origin !== requestOrigin) {
      return NextResponse.json({ error: "Request origin is not allowed." }, {
        status: 403,
      })
    }
  }

  const accessToken = requestCookie(request, accessCookie)
  const refreshToken = requestCookie(request, refreshCookie)
  if (
    (endpoint === "api/auth/me" ||
      isMasterDataEndpoint ||
      isAssetsReadEndpoint) &&
    !accessToken
  ) {
    return problemResponse(401, "Unauthorized")
  }
  if (endpoint === "api/auth/refresh" && !refreshToken) {
    return clearSessionCookies(problemResponse(401, "Unauthorized"))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = new Headers()
    const accept = request.headers.get("accept")
    if (accept) headers.set("accept", accept)
    headers.set("content-type", "application/json")
    const origin = request.headers.get("origin")
    if (origin) headers.set("origin", origin)
    if (
      (endpoint === "api/auth/me" ||
        isMasterDataEndpoint ||
        isAssetsReadEndpoint) &&
      accessToken
    ) {
      headers.set("authorization", `Bearer ${accessToken}`)
    }

    let requestBody: string | undefined
    if (endpoint === "api/auth/login") {
      requestBody = await request.text()
    } else if (endpoint === "api/auth/refresh") {
      requestBody = JSON.stringify({ refreshToken })
    } else if (endpoint === "api/auth/logout") {
      requestBody = JSON.stringify({ refreshToken: refreshToken ?? null })
      if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)
    } else if (isMasterDataEndpoint && request.method !== "GET") {
      requestBody = await request.text()
    }

    const requestUrl = new URL(`/${endpoint}`, `${apiBaseUrl}/`)
    if (isMasterDataEndpoint || isAssetsReadEndpoint) {
      requestUrl.search = new URL(request.url).search
    }

    const upstream = await fetch(requestUrl, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    })

    if (endpoint === "api/auth/login" && upstream.ok) {
      const payload: unknown = await upstream.json()
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("accessToken" in payload) ||
        typeof payload.accessToken !== "string" ||
        !payload.accessToken ||
        !("refreshToken" in payload) ||
        typeof payload.refreshToken !== "string" ||
        !payload.refreshToken ||
        !("user" in payload)
      ) {
        return problemResponse(502, "Invalid authentication response")
      }

      const response = NextResponse.json({ user: payload.user }, {
        status: upstream.status,
      })
      const expiry =
        "expiresAt" in payload && typeof payload.expiresAt === "string"
          ? Date.parse(payload.expiresAt)
          : NaN
      const accessMaxAge = Number.isFinite(expiry)
        ? Math.max(0, Math.floor((expiry - Date.now()) / 1000))
        : undefined
      response.cookies.set(accessCookie, payload.accessToken, {
        ...cookieOptions,
        ...(accessMaxAge === undefined ? {} : { maxAge: accessMaxAge }),
      })
      response.cookies.set(refreshCookie, payload.refreshToken, cookieOptions)
      return response
    }

    if (endpoint === "api/auth/refresh" && upstream.ok) {
      const payload: unknown = await upstream.json()
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("accessToken" in payload) ||
        typeof payload.accessToken !== "string" ||
        !payload.accessToken ||
        !("refreshToken" in payload) ||
        typeof payload.refreshToken !== "string" ||
        !payload.refreshToken
      ) {
        return clearSessionCookies(
          problemResponse(502, "Invalid refresh response"),
        )
      }

      const response = new NextResponse(null, { status: 204 })
      const expiry =
        "expiresAt" in payload && typeof payload.expiresAt === "string"
          ? Date.parse(payload.expiresAt)
          : NaN
      const accessMaxAge = Number.isFinite(expiry)
        ? Math.max(0, Math.floor((expiry - Date.now()) / 1000))
        : undefined
      response.cookies.set(accessCookie, payload.accessToken, {
        ...cookieOptions,
        ...(accessMaxAge === undefined ? {} : { maxAge: accessMaxAge }),
      })
      response.cookies.set(refreshCookie, payload.refreshToken, cookieOptions)
      return response
    }

    const responseBody =
      upstream.status === 204 || upstream.status === 304
        ? null
        : await upstream.arrayBuffer()
    if (isMasterDataEndpoint && request.method === "DELETE" && upstream.ok) {
      return new NextResponse(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      })
    }
    const response = new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    })
    if (
      endpoint === "api/auth/logout" ||
      (endpoint === "api/auth/refresh" &&
        [400, 401, 403].includes(upstream.status))
    ) {
      clearSessionCookies(response)
    }
    return response
  } catch (error) {
    console.error("Backend proxy request failed.", {
      endpoint,
      reason: error instanceof Error ? error.message : "Unknown error",
    })
    const response = NextResponse.json(
      {
        error: "Backend service is temporarily unavailable.",
        code: controller.signal.aborted ? "TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      },
      { status: controller.signal.aborted ? 504 : 502 },
    )
    if (endpoint === "api/auth/logout") clearSessionCookies(response)
    return response
  } finally {
    clearTimeout(timeout)
  }
}

export const GET = proxyAuthRequest
export const POST = proxyAuthRequest
export const PUT = proxyAuthRequest
export const DELETE = proxyAuthRequest
