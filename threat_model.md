# Threat Model

## Project Overview

DriveLog/Fahrtdoc is a pnpm monorepo containing a small Express API, a production Expo mobile/web client, and shared API/DB libraries. In the current codebase, the production backend exposes only `/api/healthz`; the primary production risk is in the mobile/web client, which stores user profile data and trip history locally and accesses device location for trip tracking. The mockup sandbox under `artifacts/mockup-sandbox` is treated as dev-only and should be ignored unless future scans show production reachability.

## Assets

- **Trip history and location-derived data** — trip dates, start/end addresses, trip distance, duration, business/private classification, and live position history. This can reveal home/work locations, routines, and business activity.
- **User profile data** — name, email address, and vehicle plate stored in the client. Exposure leaks personally identifiable information and ties trip records to a person.
- **Application integrity of client-side session state** — the app presents login/registration flows and should protect locally stored trip data from other users of the same device/browser profile.
- **Deployment and application secrets** — `DATABASE_URL` and future service tokens remain sensitive, though the current production app does not yet expose privileged backend logic.

## Trust Boundaries

- **Device/browser to mobile app runtime** — all input from the user, local browser storage, deep links, and device APIs is untrusted. The app must not treat client state as proof of identity.
- **Mobile app to local persistent storage** — `AsyncStorage` (and web storage backing on web) persists profile and trip data across sessions. This boundary matters because persisted data survives restarts, logout flows, and user changes.
- **Mobile app to third-party geocoding service** — reverse geocoding requests send precise latitude/longitude to OpenStreetMap Nominatim.
- **Client to API server** — the Express API currently exposes only a health check. This is a low-risk public boundary today, but future API routes will become high priority.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox`, build scripts, and codegen/build helpers are out of production scope unless future evidence shows deployment reachability.

## Scan Anchors

- **Production entry points:** `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/app/index.tsx`, `artifacts/mobile/app/(main)/*`, `artifacts/mobile/server/serve.js`, `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`.
- **Highest-risk code areas:** `artifacts/mobile/context/AppContext.tsx` for storage and location handling; `artifacts/mobile/app/index.tsx` and `(main)` routes for session gating; any future API routes under `artifacts/api-server/src/routes`.
- **Public vs authenticated surfaces:** `/api/healthz` is public; the mobile app currently has no real authenticated server surface. Sensitive trip/profile screens are client-side only and must not rely on UI-only gating.
- **Usually ignore as dev-only:** `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, generated `dist/**`, and codegen/config scaffolding unless a production path consumes them.

## Threat Categories

### Spoofing

The mobile app presents login and registration flows, so users will reasonably assume those screens establish identity. Any screen that reveals trip history, profile data, or export functionality must require a real, verified session rather than trusting arbitrary client input or locally mutated state.

### Information Disclosure

Trip history, addresses, vehicle plate, and email are sensitive because they reveal where a user lives, works, and travels. This project must ensure those records are not exposed to the next user of the same device/browser profile, leaked through insecure client storage, or disclosed more broadly than required for the feature.

### Tampering

Trip records and user identity are stored entirely on the client today. The system must treat locally stored values as attacker-controlled and avoid using them as authoritative proof of identity or entitlement.

### Elevation of Privilege

Any future privileged areas must enforce authorization server-side. In the current codebase, the relevant guarantee is narrower: client-side navigation and non-empty form fields must not be enough to gain access to another locally stored user session or their trip history.
