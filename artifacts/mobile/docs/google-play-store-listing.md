# Google Play Store Listing — FahrtDoc

## App-Infos

- **Package:** `com.fahrtdoc.app`
- **Kategorie:** Navigation / Unternehmen
- **Inhalts-Rating:** Alle (keine anstößigen Inhalte)
- **Datenschutzerklärung-URL:** _(muss vom Nutzer hinterlegt werden, z.B. auf der eigenen Website)_

---

## Deutsch (Primärsprache)

### Titel (max. 30 Zeichen)
```
FahrtDoc – Fahrtenbuch
```

### Kurzbeschreibung (max. 80 Zeichen)
```
Fahrten automatisch aufzeichnen, Kilometernachweis als PDF exportieren.
```

### Vollbeschreibung (max. 4000 Zeichen)
```
FahrtDoc ist dein digitales Fahrtenbuch für iOS und Android.

🚗 AUTOMATISCHE FAHRTERFASSUNG
FahrtDoc erkennt Fahrten automatisch per GPS – du musst nichts manuell starten. Sobald du losfährst, zeichnet die App im Hintergrund deine Route auf.

📋 MANUELL BEARBEITEN
Jede Fahrt lässt sich nachträglich bearbeiten: Startadresse, Zieladresse, Zwischenstopps, Fahrtzweck (Geschäftlich / Privat) und Notizen.

📄 PDF & CSV EXPORT
Exportiere dein Fahrtenbuch als übersichtliche PDF-Datei oder als CSV für Excel – direkt aus der App heraus. Ideal für das Finanzamt oder deinen Steuerberater.

🔒 DSGVO-KONFORM
Deine Daten gehören dir. FahrtDoc speichert Fahrtdaten lokal auf deinem Gerät und synchronisiert sie optional mit einem sicheren Backend.

🗺️ KARTENANSICHT
Sieh dir die aufgezeichnete Route auf einer interaktiven Karte an. Start- und Endpunkt werden automatisch per Reverse Geocoding beschriftet.

✅ STEUERLICH ANERKANNT
Das Fahrtenbuch entspricht den Anforderungen des deutschen Finanzamts für ein ordnungsgemäßes Fahrtenbuch (§ 6 Abs. 1 Nr. 4 EStG).

🌍 DEUTSCH & ENGLISCH
Die App ist vollständig auf Deutsch und Englisch verfügbar.

---
Ideal für Selbstständige, Freiberufler, Außendienstmitarbeiter und alle, die ein lückenloses Fahrtenbuch führen müssen.
```

---

## English (Secondary Language)

### Title (max. 30 chars)
```
FahrtDoc – Mileage Log
```

### Short Description (max. 80 chars)
```
Auto-track trips, export mileage log as PDF for tax purposes.
```

### Full Description (max. 4000 chars)
```
FahrtDoc is your digital mileage logbook for iOS and Android.

🚗 AUTOMATIC TRIP DETECTION
FahrtDoc automatically detects trips via GPS – no manual start required. As soon as you drive off, the app records your route in the background.

📋 MANUAL EDITING
Every trip can be edited afterwards: start address, destination, waypoints, trip purpose (Business / Private) and notes.

📄 PDF & CSV EXPORT
Export your mileage log as a clear PDF or as a CSV for Excel – directly from the app. Perfect for tax purposes or your accountant.

🔒 GDPR COMPLIANT
Your data belongs to you. FahrtDoc stores trip data locally on your device and optionally syncs it to a secure backend.

🗺️ MAP VIEW
View the recorded route on an interactive map. Start and end points are automatically labeled via reverse geocoding.

✅ TAX COMPLIANT
The logbook meets the requirements of German tax authorities for a proper mileage record (§ 6 para. 1 no. 4 EStG).

🌍 GERMAN & ENGLISH
The app is fully available in German and English.

---
Ideal for freelancers, self-employed professionals, field sales reps, and anyone who needs a complete mileage log.
```

---

## Build & Submit (Android) — Automatisch via EAS Submit

Die empfohlene Methode ist EAS Submit. Ein einziger Befehl baut die App und lädt sie direkt in den Internal Testing Track von Google Play hoch.

### Schritt 1: Google Play Service Account anlegen (einmalig)

Der Service Account erlaubt EAS, automatisch Builds an Play Console zu übermitteln.

1. **Google Play Console öffnen** → [play.google.com/console](https://play.google.com/console)
2. **App anlegen** (falls noch nicht geschehen):
   - Paketname: `com.fahrtdoc.app`
   - Standard-Sprache: Deutsch (Deutschland)
   - App oder Spiel: App
   - Kostenlos oder kostenpflichtig: Je nach Geschäftsmodell
3. **Service Account erstellen:**
   - Einstellungen → API-Zugriff → Mit einem Google Cloud-Projekt verknüpfen
   - „Neues Dienstkonto erstellen" klicken
   - Zur Google Cloud Console weitergeleitet → Dienstkonto-Name: `eas-submit` (beliebig)
   - Rolle: **Service Account User** (reicht für EAS)
   - Schlüssel erstellen: JSON → herunterladen
4. **Berechtigungen in Play Console vergeben:**
   - Zurück zu Play Console → API-Zugriff → Dienstkonto-Liste → „Zugriff verwalten"
   - Berechtigung: **Releases verwalten** (für Internal Testing Upload)
   - Speichern
5. **JSON-Datei ablegen:**
   ```bash
   # Die heruntergeladene JSON-Datei hierher kopieren:
   artifacts/mobile/google-service-account.json
   ```
   > ⚠️ Diese Datei enthält einen privaten Schlüssel. Sie ist in `.gitignore` eingetragen und darf nie ins Repository committed werden.

---

### Schritt 2: Store-Eintrag in Play Console ausfüllen (einmalig)

Vor dem ersten Upload muss Play Console einen vollständigen Store-Eintrag haben:

- **App-Name:** FahrtDoc – Fahrtenbuch
- **Kurzbeschreibung:** Fahrten automatisch aufzeichnen, Kilometernachweis als PDF exportieren.
- **Vollbeschreibung:** Texte oben verwenden
- **Datenschutzerklärung-URL:** Pflichtfeld — z.B. `https://deine-domain.de/datenschutz` (DSGVO)
- **Kategorie:** Navigation
- **Content-Rating-Fragebogen:** ausfüllen (wird von Play Console geführt)
- **Grafik-Assets:** siehe Tabelle unten

---

### Schritt 3: Produktion-Build erstellen und automatisch einreichen

```bash
cd artifacts/mobile

# Build erstellen UND automatisch zu Play Console hochladen:
eas build --platform android --profile production --auto-submit

# Oder: neuesten fertigen Build einreichen (ohne neu zu bauen):
eas submit --platform android --latest
```

Der Upload geht in den **Internal Testing** Track (konfiguriert in `eas.json`).
Von dort kann manuell in Closed Testing oder Production befördert werden.

---

### Schritt 4: Build in Play Console prüfen

1. [play.google.com/console](https://play.google.com/console) öffnen
2. App → Testen → Internes Testen
3. Build sollte nach wenigen Minuten erscheinen
4. Tester-E-Mail-Adressen hinzufügen → Link zum Opt-in senden

---

## Benötigte Assets für Play Console

| Asset | Größe | Hinweis |
|-------|-------|---------|
| App-Icon | 512×512 px PNG | Kein Alpha-Kanal |
| Feature Graphic | 1024×500 px PNG/JPG | Pflicht für Store-Eintrag |
| Screenshots (Phone) | min. 2 Stück | 16:9 oder 9:16 |
| Screenshots (Tablet) | optional | 7" und/oder 10" |

Screenshots aus dem Android Emulator oder einem physischen Gerät exportieren.

---

## eas.json — Android Submit Konfiguration

Die Submit-Konfiguration ist bereits in `artifacts/mobile/eas.json` hinterlegt:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-service-account.json",
      "track": "internal"
    }
  }
}
```

- `serviceAccountKeyPath`: Pfad zur Service Account JSON (relativ zu `artifacts/mobile/`)
- `track`: `"internal"` — Upload in den Internal Testing Track

Um einen anderen Track zu verwenden (z.B. `"alpha"` oder `"production"`), `track` in `eas.json` anpassen.
