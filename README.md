# IT Inventory Management

Enterprise inventory prototype built with Next.js, React, Payload, Tailwind CSS,
Lucide React, and Recharts.

## Application authentication

Application employee accounts are stored in the Payload `accounts` collection.
They are separate from the Payload CMS `admins` collection. Passwords are hashed
and verified by Payload and are never stored in React state, localStorage, seed
JSON, account tables, or profile responses. The application session uses a
dedicated HTTP-only `app-session` cookie.

Two fictional preview accounts are installed for demonstration only:

- Admin: `DEMO-ADM-001` / `DemoAdmin!2026`
- Member: `DEMO-MBR-001` / `DemoMember!2026`

These credentials are not production credentials. Replace or deactivate demo
accounts before a production rollout.

## Authorization

`src/services/authorizationService.ts` is the shared application permission
policy. Admin and Member users may view, create, and update records. Only Admin
users may delete records. Mutation services validate authorization again at the
point where data changes; UI restrictions are informational and are not the only
check.

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

Payload provides server-side password hashing, authentication, account access
rules, and HTTP-only sessions. Inventory records that remain in localStorage are
still prototype data and should not be treated as server-protected enterprise
records. Moving those domain entities to Payload is required before production
use across users or devices.
