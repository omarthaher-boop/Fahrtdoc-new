# FahrtDoc

Fahrtenbuch-App für iOS/Android: Fahrten automatisch aufzeichnen, Kilometernachweis exportieren, DSGVO-konform.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **`expo-print` und `expo-sharing` beide entfernt** — beide rufen `getPathPermissions` auf `EXFileSystemInterface` auf, das in `expo-file-system ~19.x` entfernt wurde → Xcode Build-Fehler. Ersatz: `jspdf` + `FileSystem.writeAsStringAsync` für Datei-Erzeugung, React Native `Share.share({ url })` für das Teilen.
- **`expo-file-system` muss auf SDK-Version passen** — `expo-file-system ^55.x` ist für SDK 55; bei `expo ~54.x` muss `expo-file-system ~17.0.1` verwendet werden. Neuere Versionen entfernen `getPathPermissions`, das `expo-print` und `expo-sharing` noch benötigen → Xcode Build-Fehler.
- **Keine custom Config-Plugins für EAS-Builds** — `artifacts/mobile/plugins/` darf keine Dateien enthalten, die `require('@expo/config-plugins')` verwenden. Im pnpm-Workspace läuft `npm install` nicht (wegen `catalog:`-Protokoll), und EAS findet die Abhängigkeit nicht. Stattdessen immer native Expo-Felder in `app.json` nutzen (z.B. `ios.privacyManifests`, `ios.infoPlist`) oder Plugins ohne externe Imports schreiben.
- **Wenn `git pull` wegen lokaler Änderungen blockiert**: `git checkout -- . && git pull` ausführen, um lokale Änderungen zu verwerfen und dann zu aktualisieren.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
