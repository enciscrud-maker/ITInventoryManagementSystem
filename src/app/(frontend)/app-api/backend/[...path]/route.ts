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
  "api/business-units",
  "api/locations",
  "api/asset-conditions",
  "api/asset-statuses",
])
const assetsReadResource = "api/assets"
const assetIdPath = /^api\/assets\/[1-9]\d*$/
const assetActionPath =
  /^api\/assets\/(?:bulk-business-unit|import|export|import-template)$/
const stockAuditDetailPath = /^api\/stock-audits\/[1-9]\d*$/
const stockAuditItemsPath = /^api\/stock-audits\/[1-9]\d*\/items$/
const stockAuditEvidenceUploadPath =
  /^api\/stock-audits\/[1-9]\d*\/items\/[1-9]\d*\/evidence$/
const stockAuditEvidenceDownloadPath =
  /^api\/stock-audits\/[1-9]\d*\/items\/[1-9]\d*\/evidence\/[1-9]\d*$/
const stockAuditCompletePath = /^api\/stock-audits\/[1-9]\d*\/complete$/
const goodsEndpoint =
  /^api\/goods-(?:in|out)(?:\/([1-9]\d*)(?:\/(status|attachments))?)?$/

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
  const isAssetDetailEndpoint = assetIdPath.test(endpoint)
  const isAssetActionEndpoint = assetActionPath.test(endpoint)
  const isAssetsEndpoint =
    isAssetsReadEndpoint || isAssetDetailEndpoint || isAssetActionEndpoint
  const isStockAuditsEndpoint =
    endpoint === "api/stock-audits" ||
    stockAuditDetailPath.test(endpoint) ||
    stockAuditItemsPath.test(endpoint) ||
    stockAuditEvidenceUploadPath.test(endpoint) ||
    stockAuditEvidenceDownloadPath.test(endpoint) ||
    stockAuditCompletePath.test(endpoint)
  const allowedStockAuditMethod =
    (endpoint === "api/stock-audits" &&
      ["GET", "POST"].includes(request.method)) ||
    (stockAuditDetailPath.test(endpoint) &&
      ["GET", "PUT"].includes(request.method)) ||
    (stockAuditItemsPath.test(endpoint) && request.method === "PUT") ||
    (stockAuditEvidenceUploadPath.test(endpoint) &&
      request.method === "POST") ||
    (stockAuditEvidenceDownloadPath.test(endpoint) &&
      ["GET", "DELETE"].includes(request.method)) ||
    (stockAuditCompletePath.test(endpoint) && request.method === "POST")
  const allowedAssetsMethod =
    (isAssetsReadEndpoint && ["GET", "POST"].includes(request.method)) ||
    (isAssetDetailEndpoint && ["GET", "PUT"].includes(request.method)) ||
    (endpoint === "api/assets/bulk-business-unit" &&
      request.method === "POST") ||
    (endpoint === "api/assets/import" && request.method === "POST") ||
    ((endpoint === "api/assets/export" ||
      endpoint === "api/assets/import-template") &&
      request.method === "GET")
  const goodsMatch = endpoint.match(goodsEndpoint)
  const isGoodsEndpoint = goodsMatch !== null
  const isGoodsListEndpoint = isGoodsEndpoint && path.length === 2
  const isGoodsDetailEndpoint =
    isGoodsEndpoint && path.length === 3 && goodsMatch?.[1] !== undefined
  const isGoodsStatusEndpoint =
    isGoodsEndpoint && path.length === 4 && goodsMatch?.[2] === "status"
  const isGoodsAttachmentEndpoint =
    isGoodsEndpoint && path.length === 4 && goodsMatch?.[2] === "attachments"
  const hasResourceId =
    path.length === 3 && /^\d+$/.test(path[2]) && Number(path[2]) > 0
  const allowedMasterDataMethod =
    !isMasterDataEndpoint || path.length === 2
      ? ["GET", "POST"].includes(request.method)
      : hasResourceId && ["GET", "PUT", "DELETE"].includes(request.method)
  const expectedMethod = allowedMethods[endpoint]

  const allowedGoodsMethod =
    (isGoodsListEndpoint && ["GET", "POST"].includes(request.method)) ||
    (isGoodsDetailEndpoint && request.method === "GET") ||
    (isGoodsStatusEndpoint && request.method === "PATCH") ||
    (isGoodsAttachmentEndpoint && request.method === "POST")
  if (
    !isAuthEndpoint &&
    !isMasterDataEndpoint &&
    !isAssetsEndpoint &&
    !isStockAuditsEndpoint &&
    !isGoodsEndpoint
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  if (
    (isAuthEndpoint && request.method !== expectedMethod) ||
    (isMasterDataEndpoint && !allowedMasterDataMethod) ||
    (isAssetsEndpoint && !allowedAssetsMethod) ||
    (isStockAuditsEndpoint && !allowedStockAuditMethod) ||
    (isGoodsEndpoint && !allowedGoodsMethod)
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
      isAssetsEndpoint ||
      isStockAuditsEndpoint ||
      isGoodsEndpoint) &&
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
    headers.set(
      "content-type",
      request.headers.get("content-type") ?? "application/json",
    )
    const origin = request.headers.get("origin")
    if (origin) headers.set("origin", origin)
    if (
      (endpoint === "api/auth/me" ||
        isMasterDataEndpoint ||
        isAssetsEndpoint ||
        isStockAuditsEndpoint ||
        isGoodsEndpoint) &&
      accessToken
    ) {
      headers.set("authorization", `Bearer ${accessToken}`)
    }

    let requestBody: BodyInit | undefined
    if (endpoint === "api/auth/login") {
      requestBody = await request.text()
    } else if (endpoint === "api/auth/refresh") {
      requestBody = JSON.stringify({ refreshToken })
    } else if (endpoint === "api/auth/logout") {
      requestBody = JSON.stringify({ refreshToken: refreshToken ?? null })
      if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)
    } else if (isMasterDataEndpoint && request.method !== "GET") {
      requestBody = await request.text()
    } else if (isStockAuditsEndpoint && request.method !== "GET") {
      requestBody = stockAuditEvidenceUploadPath.test(endpoint)
        ? await request.arrayBuffer()
        : await request.text()
    } else if (isAssetsEndpoint && request.method !== "GET") {
      requestBody =
        endpoint === "api/assets/import"
          ? await request.arrayBuffer()
          : await request.text()
    } else if (isGoodsEndpoint && request.method !== "GET") {
      requestBody = await request.arrayBuffer()
    }

    const requestUrl = new URL(`/${endpoint}`, `${apiBaseUrl}/`)
    if (
      isMasterDataEndpoint ||
      isAssetsEndpoint ||
      isStockAuditsEndpoint ||
      isAssetsReadEndpoint ||
      (isGoodsListEndpoint && request.method === "GET")
    ) {
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
        ...(upstream.headers.get("content-disposition")
          ? {
              "content-disposition": upstream.headers.get(
                "content-disposition",
              )!,
            }
          : {}),
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
export const PATCH = proxyAuthRequest
export const DELETE = proxyAuthRequest
