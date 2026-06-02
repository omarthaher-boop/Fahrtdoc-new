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

- `artifacts/mobile/` — Expo React Native App (Bundle ID: `com.omarthaher.fahrtdoc`)
- `artifacts/api-server/` — Express 5 API
- `artifacts/mobile/utils/exportPDF.ts` — PDF/CSV-Export-Logik
- `artifacts/mobile/context/AppContext.tsx` — globaler App-State
- `artifacts/mobile/context/LanguageContext.tsx` — DE/EN-Übersetzungen
- `lib/db/src/schema/` — Datenbankschema (Drizzle)
- `artifacts/mobile/lib/revenuecat.tsx` — RevenueCat SubscriptionProvider + useSubscription Hook
- `artifacts/mobile/components/PaywallModal.tsx` — Paywall UI (Monatlich / Jährlich, Restore)
- `scripts/src/seedRevenueCat.ts` — Seed-Script: Produkte, Entitlement, Offering in RevenueCat anlegen
- `scripts/src/revenueCatClient.ts` — RevenueCat API-Client via Replit Connectors SDK

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

- **Keine pnpm-Overrides für Expo-interne Build-Dependencies** — Task #122 hat drei Overrides gesetzt die EAS Builds brechen: (1) `@xmldom/xmldom: ^0.9.10` → bricht `expo prebuild` ("mimeType undefined"); (2) `minimatch>brace-expansion: ^2.0.3` → bricht EAS Fingerprint ("expand is not a function"); (3) `esbuild>@esbuild/darwin-*: "-"` → bricht EAS Prebuild auf macOS. Alle drei sind in `pnpm-workspace.yaml` dokumentiert und entfernt.

- **darwin-Binaries von esbuild, lightningcss, rollup und @tailwindcss/oxide NICHT aus pnpm-Overrides ausschließen** — `pnpm-workspace.yaml` enthält Overrides die unnötige Plattform-Pakete mit `"-"` ausschließen. `@esbuild/darwin-arm64` und `@esbuild/darwin-x64` dürfen NICHT ausgeschlossen werden — EAS baut auf macOS und braucht diese Binaries. Ohne sie: `[esbuild] Failed to find package` → Prebuild schlägt fehl.

- **`react-native-maps` auf Android braucht einen Google Maps API Key** — `PROVIDER_DEFAULT` nutzt auf Android Google Maps SDK. Ohne API-Key werden keine Kartenkacheln angezeigt (grauer Hintergrund). Key-Wiring: `app.config.js` liest `process.env.GOOGLE_MAPS_ANDROID_API_KEY` → `android.config.googleMaps.apiKey`. In EAS (`eas.json`) ist `GOOGLE_MAPS_ANDROID_API_KEY: "$GOOGLE_MAPS_ANDROID_API_KEY"` für preview + production eingetragen. Key einrichten: (1) Google Cloud Console → Maps SDK for Android aktivieren → API-Key erstellen → auf `com.fahrtdoc.app` einschränken; (2) Key als Replit Secret `GOOGLE_MAPS_ANDROID_API_KEY` speichern; (3) Key in EAS Secrets unter `https://expo.dev/accounts/[account]/projects/fahrtdoc/secrets` hinterlegen.

## Gotchas — react-native-maps & native Crashes

- **Native `MapView` crasht ggf. den ganzen Screen** — `react-native-maps` wird über `TripRouteMap.native.tsx` (Liste, Save-Sheet, Detail) und `ActiveTripMap.native.tsx` (aktive Fahrt) gerendert. Ein Render-/Native-Fehler der Karte riss früher den gesamten Screen mit (z. B. Save-Sheet rendert `TripRouteMap` bedingungslos → Speichern unmöglich, App-Neustart nötig). Beide native Map-Komponenten kapseln die `MapView` jetzt intern in eine `ErrorBoundary` mit Fallback "Karte nicht verfügbar". JS-Level-Fehler (z. B. `requireNativeComponent`-Fehler) werden so abgefangen; reine native Crashes (Obj-C/Swift) bleiben unkatchbar.
- **`btoa` ist in Hermes nicht garantiert** — PDF-Export (`utils/exportPDF.ts`) nutzt jetzt einen eigenen `bytesToBase64`-Encoder statt globalem `btoa` + char-für-char `binary`-String. Vermeidet sowohl die `btoa`-Abhängigkeit als auch einen mehrere MB großen Zwischen-String (OOM-Risiko bei großen Fahrtenlisten).

- **jsPDF crasht Hermes mit SIGSEGV (EXC_BAD_ACCESS / stringPrototypeSplit) bei großen Listen** — `doc.text()` ruft intern `splitTextToSize()` → `String.prototype.split()` auf. Bei 200+ Fahrten × 8 Zellen überläuft Hermes. Fixes: (1) `MAX_TRIPS_PER_NATIVE_PDF = 100` — bei > 100 Fahrten Alert + slice, (2) alle Adress-/Notiz-Strings per `safeText(s, maxLen)` mit `substring()` kappen bevor sie zu jsPDF gehen. `slice()` und `.split()` im eigenen Code durch `substring()` ersetzen.

- **`expo-file-system/legacy` ist in SDK 54 Pflicht für `cacheDirectory` und `EncodingType`** — In `expo-file-system ~19.x` wurden diese APIs aus dem Haupt-Export entfernt und leben nur noch in `/legacy`. Das Standard-`expo-file-system`-Import gibt TypeScript-Fehler `Property 'cacheDirectory' does not exist`. `exportPDF.ts` MUSS `import * as FileSystem from "expo-file-system/legacy"` verwenden.

- **`ActiveTripMap.tsx` muss auf `.native` zeigen, nicht `.web`** — Metro lädt bei Native/iOS zuerst `.native.tsx`, dann `.tsx`. Zeigt `.tsx` auf `.web`, überschreibt das auf Plattformen ohne `.native.tsx`-Auflösung den falschen Export. Korrekt: `export { default } from "./ActiveTripMap.native"`.

## Gotchas — Lokale Entwicklung (Allgemein)

- **AsyncStorage-Werte immer mit `typeof === "string"` validieren** — `JSON.parse()` kann beliebige Typen liefern. Besonders dateFrom/dateTo in history.tsx: `.split()` auf Non-String crasht Hermes mit EXC_BAD_ACCESS. Immer: `typeof val === "string" && val.includes(".")` vor `.split(".")`.
- **Parallele GitHub API PUT-Aufrufe scheitern mit 409** — GitHub's Contents API erlaubt nur einen Commit pro SHA. Bei parallelem Push aller Dateien haben alle denselben SHA → zweiter Commit schlägt fehl. Immer sequenziell pushen (for-loop, nicht Promise.all).
- **Tab verstecken: `href: null` statt `tabBarButton: () => null`** — `tabBarButton: () => null` lässt den Tab im Flex-Layout bestehen → sichtbare Tabs kleben links statt zentriert. `href: null` entfernt den Tab komplett aus der Leiste (Expo Router v3+).
- **`useDriveTaskRunning` hat false-negative bei Trip-Start** — `hasStartedLocationUpdatesAsync` kann beim ersten Check nach Trip-Start noch `false` zurückgeben (Race Condition). Fix: (1) Heartbeat-Key sofort beim Mount lesen; (2) `tracking = driveTaskRunning || !!activeTrip` in `_layout.tsx`.
- **fetch ohne Timeout hängt App ewig** — serverCreateTrip/Update/Delete/BatchUpsert in `lib/api.ts` haben jetzt 10s AbortController-Timeout. Ohne Timeout: App-UI bleibt frozen wenn Server nicht antwortet (z.B. Replit-Sleep).

## Gotchas — Git / GitHub Workflow

- **Wenn `git pull` wegen lokaler Änderungen blockiert**: `git checkout -- . && git pull` ausführen.
- **EAS braucht aktuellen GitHub-Stand**: Immer erst pushen, dann `git checkout -- . && git pull` auf dem Mac, dann `eas build` starten.

## Gotchas — Lokale Entwicklung

- **Metro-Cache nach Paketentfernungen leeren**: Workflow neu starten nach `expo-print`/`expo-sharing`-Entfernung, sonst `Requiring unknown module "1650"`.
- **`expo-notifications ~0.32.17` existiert nicht** — bei `expo ~54.x` bleibt es bei `~0.29.14` (funktioniert, auch wenn Expo CLI warnt).
- **`Image.resolveAssetSource` + `FileSystem.readAsStringAsync` crasht in TestFlight** — Gebündelte Assets (z.B. Logo) können in Hermes-Production-Builds nicht per `expo-file-system` gelesen werden. `readAsStringAsync` auf einem Asset-URI wirft eine Exception → App-Crash. Lösung: nativen Branch in `getAppLogoBase64` entfernt (gibt `null` zurück). PDF-Inhalt bleibt identisch, nur das kleine App-Logo im PDF-Header fehlt auf Native.
- **`FileSystem.cacheDirectory` kann `null` sein** — immer prüfen und explizit werfen statt `?? ""` als Fallback nutzen, sonst wird die Datei unter einem ungültigen Pfad geschrieben.

## Gotchas — CarPlay & Android Auto

- **Apple CarPlay Entitlement ist Pflicht** — ohne `com.apple.developer.carplay-driving-task` aus dem Apple Developer Portal kann CarPlay weder getestet noch eingereicht werden. Antrag unter https://developer.apple.com/contact/carplay/ stellen (Kategorie: Driving Task App). Dauert 2–4 Wochen.
- **Kein Config-Plugin für CarPlay möglich** — der pnpm-Workspace-Katalog bricht `npm install` beim EAS-Build, wenn ein Plugin `require('@expo/config-plugins')` nutzt. Nativer Code (Swift `CarPlaySceneDelegate.swift`, Kotlin `FahrtDocCarAppService.kt`) muss nach `expo prebuild` direkt in `ios/` und `android/` eingefügt werden. Vollständige Templates in `artifacts/mobile/docs/carplay-native-setup.md`.
- **Das Entitlement in `app.json` ist aktiv** — `com.apple.developer.carplay-driving-task` ist unter `ios.entitlements` eingetragen (nach Apple-Genehmigung re-aktiviert). Auch `UIApplicationSceneManifest` mit der `CarPlay` Scene-Konfiguration ist in `ios.infoPlist` eingetragen. Nach dem nächsten `expo prebuild --clean && bash scripts/setup-carplay-native.sh` ist CarPlay produktionsbereit.
- **JS-Bridge ist aktiv, aber silent** — `utils/carplayBridge.ts` und `hooks/useCarPlay.ts` sind eingebaut und laufen im managed-Build ohne Fehler, da alle NativeModule-Aufrufe optional-chained sind. Ohne das native Modul ist es ein no-op.
- **Android Auto DHU zum Testen** — auf dem Entwickler-Mac die Android Auto Desktop Head Unit installieren und per USB + ADB testen. Keine physische Autoanbindung nötig.

## Gotchas — SMTP / E-Mail

- **Infomaniak SMTP**: Host `mail.infomaniak.com`, Port `587`. `SMTP_USER` = vollständige E-Mail-Adresse (`info@centofai.com`). `SMTP_PASS` = Passwort **des Postfachs** (nicht das Infomaniak-Konto-Passwort) — zu finden unter manager.infomaniak.com → E-Mail & Zusammenarbeit → Postfach → Passwort.
- **`SMTP_FROM`** ist als Env-Var (nicht Secret) gesetzt: `FahrtDoc <info@centofai.com>`.
- **Secrets niemals in Git** — SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT leben nur in Replit Secrets und müssen bei neuem Deployment manuell gesetzt werden.

## Offene Aufgaben (Erinnerungen)

- **Skalierung / Hosting-Upgrade**: Wenn die Nutzerzahl wächst (>100 gleichzeitige Nutzer), API-Server auf Replit Reserved VM oder externes Hosting (Railway, Fly.io) migrieren. Aktuell reicht Replit für den App Store Launch.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
