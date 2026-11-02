# IT Inventory Management

Enterprise inventory prototype built with Next.js, React, Payload, Tailwind CSS,
Lucide React, and Recharts.

## Application authentication

Application login is configured to use the external API endpoints
`/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, and
`/api/auth/logout` through a same-origin Next.js proxy. Configure
`NEXT_PUBLIC_API_BASE_URL` for the backend origin. The backend returns
`accessToken` and `refreshToken` in its auth response; the proxy stores them in
`httpOnly`, `SameSite=Lax` cookies and uses them for server-to-server
authentication and refresh. The frontend does not store or inspect tokens, and
browser-to-backend CORS is not required for these auth calls. Cookies use
`Secure` in production.

The login request sends `{ identifier, password }`. Account profiles are mapped
from the backend `UserProfileDto`.

Payload remains in use for CMS administration and the currently existing
profile, account-management, and password-reset-request endpoints. Those legacy
app endpoints still depend on the Payload `app-session` cookie and have not yet
been migrated to the external API; those workflows will need migration before
they work with external-auth sessions.

## Authorization

`src/services/authorizationService.ts` is the client-side application
permission policy used by the prototype UI. It is not a security boundary for
inventory records stored in localStorage. The external backend must enforce
authorization on every protected API request.

Payload collection access rules protect account reads and updates server-side.
App accounts cannot access Payload Admin.

## Persistence model

- Legacy account-management records and profile media remain Payload records.
- Existing inventory, transaction, audit, master-data, and preference records
  retain their previous browser localStorage keys so migration does not reset
  users' current prototype data.
- JSON under `src/data/master/` is build-time seed data. Browser changes do not
  write back to those physical files.

The inventory repository boundary remains centralized in
`InventoryContext`. A future database migration can replace that repository
without changing individual page components.

## Security posture

The external backend is responsible for password verification and
authorization. The Next.js proxy keeps API tokens in HTTP-only cookies.
Inventory records that remain in localStorage are still prototype data and
should not be treated as server-protected enterprise records. The remaining
Payload app-account endpoints must be migrated or explicitly retired before
production use.
