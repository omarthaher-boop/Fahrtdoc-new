# Threat Model

## Project Overview

DriveLog/Fahrtdoc is a pnpm monorepo containing an Express 5 API, a PostgreSQL/Drizzle data layer, and a production Expo mobile/web client. Users can register, log in, recover passwords, sync trip history to the backend, export mileage logs, and store profile and vehicle details locally. The production backend now exposes public authentication endpoints and authenticated trip CRUD/sync routes; the mockup sandbox under `artifacts/mockup-sandbox` remains dev-only unless future scans show production reachability.

## Assets

- **User credentials and password-reset capability** — account passwords, password hashes, reset codes, and the ability to change account credentials. Compromise allows account takeover and persistence.
- **Bearer session tokens** — `user_sessions.token` values authorize access to synced trip data for up to 30 days. Theft of a token is equivalent to account access until revocation or expiry.
- **Trip history and location-derived data** — trip dates, addresses, duration, business/private classification, route waypoints, and background GPS remnants. This can reveal home/work locations, routines, and business activity.
- **User profile and vehicle data** — name, email, plate, company info, and vehicle attributes stored locally and returned by auth flows.
- **Application secrets and delivery channels** — `DATABASE_URL`, SMTP credentials, and future service tokens remain sensitive because they enable access to backend infrastructure or outbound password-reset mail.

## Trust Boundaries

- **Device/browser to mobile app runtime** — all user input, browser storage, deep links, and device APIs are untrusted. The app must not treat local state as proof of identity or entitlement.
- **Mobile/web client to local persistent storage** — `AsyncStorage` and browser-backed storage retain accounts, sessions, trip data, and sync tokens across restarts and logout events.
- **Client to API server** — the client sends passwords, reset requests, bearer tokens, and trip data to `/api/auth/*` and `/api/trips*`. The server must authenticate, authorize, validate, and revoke correctly.
- **API server to PostgreSQL** — the API has direct access to users, bearer sessions, and trip records. Database exposure leaks credentials, tokens, and sensitive travel history.
- **API server to outbound email** — SMTP-backed password-reset delivery is a public abuse surface because unauthenticated users can trigger email sends.
- **Mobile app to third-party geocoding/routing services** — reverse geocoding and routing requests disclose precise coordinates to OpenStreetMap/Nominatim and OSRM.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox`, generated `dist/**`, and build/codegen helpers are out of production scope unless a production path consumes them.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/{users,auth,trips}.ts`, `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/app/index.tsx`, `artifacts/mobile/app/(main)/*`, `artifacts/mobile/server/serve.js`.
- **Highest-risk code areas:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/middleware/auth.ts`, `lib/db/src/schema/users.ts`, `artifacts/mobile/context/AppContext.tsx`, `artifacts/mobile/utils/secureStorage.ts`, `artifacts/mobile/utils/exportPDF.ts`.
- **Public vs authenticated surfaces:** public auth endpoints under `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/healthz`; authenticated password-change and trip routes under `/api/auth/request-change-code`, `/api/auth/confirm-change-password`, `/api/trips*`.
- **Usually ignore as dev-only:** `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, generated `dist/**`, and codegen scaffolding unless production code imports them.

## Threat Categories

### Spoofing

The app exposes classic account flows, so users expect passwords and reset actions to meaningfully restore control of an account. Bearer tokens must be unguessable, scoped to the authenticated user, and revoked when credential changes are meant to evict an attacker. Client-only session restoration or cosmetic “app lock” settings must not be treated as real identity checks.

### Tampering

Trip records originate on an untrusted client and are edited locally before sync and export. The backend must continue validating trip payloads, binding every write to the authenticated `userId`, and treating local storage as attacker-controlled rather than authoritative.

### Information Disclosure

Trip history, waypoint notes, route fragments, profile data, and saved sync tokens are sensitive. The system must prevent those records from being disclosed through insecure client storage, account-enumeration oracles, unsafe exports, or overly persistent local data that survives logout on shared browser/device profiles.

### Denial of Service

Public password-recovery functionality can be abused to flood inboxes or disrupt legitimate recovery if requests are not throttled. External geocoding/routing calls should remain bounded so unauthenticated or low-cost actions cannot create outsized resource consumption.

### Elevation of Privilege

All access to synced trips and future privileged features must be enforced server-side through bearer-token validation tied to the correct user. Stolen tokens, cracked passwords, or client-side-only gates must not let an attacker retain or gain access beyond the victim’s intended session.
