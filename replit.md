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
- Mobile: Expo SDK ~54, React Native 0.81.5, Expo Router ~6

## Where things live

- `artifacts/mobile/` — Expo React Native App (Bundle ID: `com.fahrtdoc.app`)
- `artifacts/api-server/` — Express 5 API
- `artifacts/mobile/utils/exportPDF.ts` — PDF/CSV-Export-Logik
- `artifacts/mobile/context/AppContext.tsx` — globaler App-State
- `artifacts/mobile/context/LanguageContext.tsx` — DE/EN-Übersetzungen
- `lib/db/src/schema/` — Datenbankschema (Drizzle)

## Architecture decisions

- PDF/CSV-Export läuft vollständig in JavaScript (jspdf + FileSystem.writeAsStringAsync + RN Share) — keine nativen Expo-Module, die Xcode-Build-Konflikte verursachen.
- Privacy Manifest ist direkt in `app.json` unter `ios.privacyManifests` definiert — kein custom Config-Plugin.
- Passwort-Reset und E-Mail-Änderung über 2-Schritt-OTP-Flow (Backend: `/api/auth/request-*` + `/api/auth/confirm-*`).

## Product

- Automatische Fahrterfassung per GPS im Hintergrund
- Manuelle Fahrtbearbeitung mit Zwischenstopps
- PDF und CSV Export des Fahrtenbuchs
- Sync mit Backend (Trips, Profil)
- DSGVO-konform, DE/EN Sprache wählbar
- iOS App Store Build via EAS

## User preferences

- Alle Änderungen sofort auf GitHub pushen (`omarthaher-boop/Fahrtdoc-new`, main)
- Probleme und Learnings immer in replit.md unter Gotchas festhalten
- Keine unnötigen Rückfragen — Probleme direkt lösen

## Gotchas — EAS iOS Build

- **`expo-print` und `expo-sharing` NICHT verwenden** — beide rufen `getPathPermissions` auf `EXFileSystemInterface` auf, das in `expo-file-system ~19.x` entfernt wurde → Xcode-Fehler `has no member 'getPathPermissions'`. Ersatz: `jspdf` + `FileSystem.writeAsStringAsync` + React Native `Share.share({ url })`.

- **Keine nativen Expo-Module mit `EXFileSystemInterface`** — bei SDK 54 + `expo-file-system ~19.x` wurden mehrere Swift-Interface-Methoden entfernt. Vor jedem neuen nativen Paket prüfen ob es `getPathPermissions`, `read`, oder andere alte `EXFileSystemInterface`-Methoden nutzt.

- **`expo-dev-client` Versionsschema** — ab SDK 52 nutzt Expo das alte Versionsschema: `expo-dev-client ~6.x` entspricht SDK 54, NICHT `^56.x`. Falsche Version → `cannot find 'ExpoAppDelegate' in scope`.

- **Alle Paketversionen müssen zum SDK passen** — `expo start` zeigt beim Start Warnungen mit den erwarteten Versionen. Diese immer sofort korrigieren. Für SDK 54: `expo-file-system ~19.0.x`, `expo-dev-client ~6.0.x`.

- **Keine custom Config-Plugins mit externen `require()`** — `artifacts/mobile/plugins/` darf keine Dateien enthalten, die `require('@expo/config-plugins')` verwenden. Im pnpm-Workspace schlägt `npm install` fehl (wegen `catalog:`-Protokoll). Stattdessen native `app.json`-Felder nutzen (`ios.privacyManifests`, `ios.infoPlist`).

- **Lockfile nach jeder `package.json`-Änderung aktualisieren** — nach Versionsänderungen immer `pnpm install --filter @workspace/mobile` lokal ausführen und den aktualisierten `pnpm-lock.yaml` committen. EAS Build verwendet den Lockfile, nicht `package.json` direkt.

- **`expo-local-authentication` braucht KEIN Plugin** — nur `NSFaceIDUsageDescription` in `infoPlist` eintragen. Kein Eintrag unter `plugins` nötig. Ein Plugineintrag ohne node_modules auf dem Build-Mac → `Failed to resolve plugin for module "expo-local-authentication"`.

- **EAS immer aus `artifacts/mobile` ausführen, NICHT aus dem Repo-Root** — `cd artifacts/mobile && eas build ...`. Aus dem Root-Verzeichnis → `expo-modules-autolinking` nicht gefunden, EAS erstellt falsches Projekt.

- **EAS-Projektverknüpfung schützen** — `app.json` muss immer `extra.eas.projectId: "bacc0475-15a8-407c-acea-a8bc71ffbda2"` enthalten. Ohne diese ID erstellt EAS CLI bei jedem Build ein neues Projekt.

## Gotchas — Git / GitHub Workflow

- **Wenn `git pull` wegen lokaler Änderungen blockiert**: `git checkout -- . && git pull` ausführen.
- **EAS braucht aktuellen GitHub-Stand**: Immer erst pushen, dann `git checkout -- . && git pull` auf dem Mac, dann `eas build` starten.

## Gotchas — Lokale Entwicklung

- **Metro-Cache nach Paketentfernungen leeren**: Workflow neu starten nach `expo-print`/`expo-sharing`-Entfernung, sonst `Requiring unknown module "1650"`.
- **`expo-notifications ~0.32.17` existiert nicht** — bei `expo ~54.x` bleibt es bei `~0.29.14` (funktioniert, auch wenn Expo CLI warnt).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
