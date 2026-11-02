# IT Inventory Management

Enterprise inventory prototype built with Next.js, React, Payload, Tailwind CSS,
Lucide React, and Recharts.

## Application authentication

Application login is configured to use the external API endpoints
`/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, and
`/api/auth/logout`. Configure `NEXT_PUBLIC_API_BASE_URL` for the backend origin.
Requests use browser-managed cookies with `credentials: include`; the frontend
does not store or inspect access tokens. The backend must issue an HTTP-only
cookie and allow the frontend origin with credentialed CORS. Cross-site cookies
also require HTTPS and compatible `SameSite` settings. The backend must protect
cookie-authenticated state-changing requests against CSRF.

The login request currently sends `{ identity, password }`, and the account
mapper accepts camelCase or snake_case account fields. Confirm these shapes
against the backend OpenAPI contract before deployment.

Payload remains in use for CMS administration and the currently existing
profile, account-management, and password-reset-request endpoints. Those legacy
app endpoints still depend on the Payload `app-session` cookie and have not yet
been migrated to the external API. Do not treat this transitional arrangement
as a completed account/profile migration.

## Authorization

`src/services/authorizationService.ts` is the client-side application
permission policy used by the prototype UI. It is not a security boundary for
inventory records stored in localStorage. The external backend must enforce
authorization on every protected API request.

Payload collection access rules protect account reads and updates server-side.
App accounts cannot access Payload Admin.

## Persistence model

- Accounts and profile media are durable Payload records.
- Existing inventory, transaction, audit, master-data, and preference records
  retain their previous browser localStorage keys so migration does not reset
  users' current prototype data.
- JSON under `src/data/master/` is build-time seed data. Browser changes do not
  write back to those physical files.

The inventory repository boundary remains centralized in
`InventoryContext`. A future database migration can replace that repository
without changing individual page components.

## Security posture

The external backend is responsible for password verification, session cookies,
and authorization. Inventory records that remain in localStorage are still
prototype data and should not be treated as server-protected enterprise
records. The remaining Payload app-account endpoints must be migrated or
explicitly retired before production use.
