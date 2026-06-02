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

## Build & Submit (Android)

### 1. Produktion-Build erstellen
```bash
cd artifacts/mobile
git pull origin main
eas build --platform android --profile production
```
Ergebnis: signiertes `.aab`-Bundle (Android App Bundle)

### 2. Manuell in Play Console hochladen
1. [play.google.com/console](https://play.google.com/console) öffnen
2. App anlegen → Paketname: `com.fahrtdoc.app`
3. Interner Test-Track → `.aab` hochladen
4. Store-Eintrag ausfüllen (Texte oben verwenden)
5. Datenschutzerklärung-URL hinterlegen (Pflicht)
6. Content-Rating-Fragebogen ausfüllen
7. App zur Prüfung einreichen

### 3. Via EAS Submit (optional, benötigt Service Account)
```bash
# Service Account JSON aus Play Console herunterladen
# → In artifacts/mobile/google-service-account.json ablegen
eas submit --platform android --latest
```

---

## Benötigte Assets für Play Console

| Asset | Größe | Hinweis |
|-------|-------|---------|
| App-Icon | 512×512 px PNG | Kein Alpha-Kanal |
| Feature Graphic | 1024×500 px PNG/JPG | Pflicht für Store-Eintrag |
| Screenshots (Phone) | min. 2 Stück | 16:9 oder 9:16 |
| Screenshots (Tablet) | optional | 7" und/oder 10" |

Screenshots aus dem iPhone-Simulator oder TestFlight-Device exportieren.
