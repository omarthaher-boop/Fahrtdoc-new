# CarPlay & Android Auto — Native Setup Guide

The JS bridge (`utils/carplayBridge.ts`), the React hook (`hooks/useCarPlay.ts`),
and the `CarPlayBridge` component in `app/_layout.tsx` are already wired into the
app. This guide covers the **native side** that must be added before CarPlay /
Android Auto becomes functional on device.

Native source files live in `native/ios/` and `native/android/`.
A post-prebuild setup script automates copying and patching all of them into the
generated `ios/` and `android/` directories.

---

## Quick Start

```bash
# 1. Run expo prebuild (must be on a Mac for iOS)
cd artifacts/mobile
expo prebuild --clean

# 2. Wire the native CarPlay / Android Auto code
bash scripts/setup-carplay-native.sh

# 3. iOS: rebuild with CocoaPods
cd ios && pod install && cd ..

# 4. Build a custom dev client via EAS
cd artifacts/mobile
eas build --profile development --platform ios    # or android
```

---

## iOS — Apple CarPlay

### Step 1: Request the Entitlement (blocks everything else)

CarPlay Driving Task apps require an explicit entitlement from Apple.
Apply at: https://developer.apple.com/contact/carplay/

- Category: **Driving Task App**
- Approval typically takes 2–4 weeks.

> ✅  The entitlement key is now **active** in `app.json` under `ios.entitlements`.
> Apple has approved the CarPlay Driving Task entitlement for this App ID.

### Step 2: Add UIApplicationSceneManifest to app.json

The following is already added to `ios.infoPlist` in `app.json`:

```json
"UIApplicationSceneManifest": {
  "UIApplicationSupportsMultipleScenes": true,
  "UISceneConfigurations": {
    "CPTemplateApplicationSceneSessionRoleApplication": [
      {
        "UISceneConfigurationName": "CarPlay",
        "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate"
      }
    ]
  }
}
```

Note: `UIBackgroundModes: ["location"]` must remain in `infoPlist` alongside this.

### Step 3: Run the Setup Script

```bash
bash scripts/setup-carplay-native.sh
```

The script:
- Copies `CarPlaySceneDelegate.swift`, `FahrtDocCarPlayModule.swift`, and
  `FahrtDocCarPlayModule.m` into the Xcode target directory.
- Adds all three files to the Xcode project via the `xcodeproj` Ruby gem.

### Native files (pre-written in `native/ios/`)

| File | Purpose |
|------|---------|
| `CarPlaySceneDelegate.swift` | Renders CarPlay UI; shows Start / Stop / Pause buttons; receives state updates from JS via `FahrtDocCarPlayModule` |
| `FahrtDocCarPlayModule.swift` | `RCTEventEmitter` NativeModule — receives `updateTripState` from JS; emits `FahrtDocCarPlayAction` events to JS |
| `FahrtDocCarPlayModule.m` | ObjC bridge header — required for RN to discover the Swift NativeModule |

### How the data flows

```
AppContext (JS)
  → useCarPlay hook
  → updateCarPlayTripState()                         [carplayBridge.ts]
  → NativeModules.FahrtDocCarPlay.updateTripState()  [native call]
  → FahrtDocCarPlayModule.swift (updateTripState)
  → CarPlaySceneDelegate.applyTripState()
  → CPInformationTemplate re-rendered in car display

User taps CarPlay button
  → CarPlaySceneDelegate.send()
  → FahrtDocCarPlayModule.dispatchToJS()
  → RCTEventEmitter.sendEvent("FahrtDocCarPlayAction")
  → NativeEventEmitter listener in carplayBridge.ts
  → dispatchCarPlayAction(action)
  → useCarPlay handler → AppContext.startTrip / stopTrip / togglePause
```

### Testing (iOS) — Xcode CarPlay Simulator Checklist

> All native source files are ready in `native/ios/`. Follow these steps on a Mac with Xcode installed.

**Step 1 — Prebuild and wire native code**

```bash
cd artifacts/mobile
expo prebuild --clean
bash scripts/setup-carplay-native.sh
cd ios && pod install && cd ..
```

Expected output from the setup script:
```
✅ Copied Swift + ObjC bridge files to ios/<AppName>/
✅ Added CarPlaySceneDelegate.swift to Xcode project
✅ Added FahrtDocCarPlayModule.swift to Xcode project
✅ Added FahrtDocCarPlayModule.m to Xcode project
✅ Xcode project updated.
```

**Step 2 — Build a development client via EAS**

```bash
# Must run from artifacts/mobile/, not the repo root
eas build --profile development --platform ios
```

Install the resulting `.ipa` on a physical iPhone or on the iOS Simulator.

**Step 3 — Open the CarPlay Simulator in Xcode**

1. Open `ios/fahrtdoc.xcworkspace` in Xcode (after `pod install`).
2. Run the app on an iPhone Simulator (or a connected device).
3. In the Xcode menu bar: **I/O → CarPlay → CarPlay Simulator**.
4. A separate CarPlay window opens — this is the car display.

**Step 4 — Verify idle state**

- ✅ CarPlay window shows title **"FahrtDoc"**
- ✅ Two buttons are visible: **"Geschäftl. starten"** and **"Privat starten"**
- ✅ Status row reads **"Bereit zur Fahrt"**

**Step 5 — Test "Geschäftl. starten"**

1. Tap **"Geschäftl. starten"** in the CarPlay window.
2. ✅ The phone app transitions to the active trip screen (ActiveTripBanner visible).
3. ✅ CarPlay window re-renders with: Art = Geschäftlich, Status = ● Läuft, live Dauer + Distanz.
4. ✅ Save sheet does NOT appear yet.

**Step 6 — Test "Privat starten"** (end the business trip first, then repeat)

1. Stop the trip from the phone screen.
2. Tap **"Privat starten"** in the CarPlay window.
3. ✅ Phone app starts a new private trip.
4. ✅ CarPlay template shows Art = Privat.

**Step 7 — Test "Pausieren" / "Fortsetzen"**

1. While a trip is active, tap **"Pausieren"** in the CarPlay window.
2. ✅ CarPlay template updates: Status = ⏸ Pausiert, button title changes to **"Fortsetzen"**.
3. ✅ Phone app ActiveTripBanner shows paused state.
4. Tap **"Fortsetzen"** in the CarPlay window.
5. ✅ Status returns to ● Läuft on both screens.

**Step 8 — Test "Fahrt beenden"**

1. While a trip is active, tap **"Fahrt beenden"** in the CarPlay window.
2. ✅ Phone app shows the save-trip sheet (SaveTripSheet).
3. ✅ CarPlay window returns to the idle state (two start buttons).
4. ✅ Completing the save sheet on the phone dismisses it normally.

---

## Android — Android Auto

### Step 1: Run the Setup Script

```bash
bash scripts/setup-carplay-native.sh
```

The script automatically:
1. Copies all Kotlin files to `android/app/src/main/java/com/fahrtdoc/app/`
2. Copies `automotive_app_desc.xml` to `android/app/src/main/res/xml/`
3. Patches `AndroidManifest.xml` — adds the `CarAppService` declaration + `meta-data`
4. Patches `android/app/build.gradle` — adds `androidx.car.app:app:1.4.0`
5. Patches `MainApplication.kt` — registers `FahrtDocCarPlayPackage`

### Native files (pre-written in `native/android/`)

| File | Purpose |
|------|---------|
| `FahrtDocCarAppService.kt` | `CarAppService` entry point — registered in AndroidManifest.xml |
| `FahrtDocCarSession.kt` | Creates `FahrtDocCarScreen`; registers it with `FahrtDocCarPlayModule` |
| `FahrtDocCarScreen.kt` | Renders the Android Auto template; dispatches button taps to JS |
| `FahrtDocCarPlayModule.kt` | RN NativeModule — receives `updateTripState` from JS; emits `FahrtDocCarPlayAction` |
| `FahrtDocCarPlayPackage.kt` | `ReactPackage` that registers `FahrtDocCarPlayModule` with the RN bridge |
| `automotive_app_desc.xml` | Android Auto capability descriptor (must be in `res/xml/`) |

### How the data flows

```
AppContext (JS)
  → useCarPlay hook
  → updateCarPlayTripState()                         [carplayBridge.ts]
  → NativeModules.FahrtDocCarPlay.updateTripState()  [native call]
  → FahrtDocCarPlayModule.updateTripState()
  → FahrtDocCarScreen.applyTripState()
  → Screen.invalidate() → onGetTemplate() re-renders

User taps Android Auto button
  → FahrtDocCarScreen.dispatch()
  → FahrtDocCarPlayModule.dispatchToJS()
  → DeviceEventManagerModule.emit("FahrtDocCarPlayAction")
  → NativeEventEmitter listener in carplayBridge.ts
  → dispatchCarPlayAction(action)
  → useCarPlay handler → AppContext.startTrip / stopTrip / togglePause
```

### Testing (Android Auto)

1. Install Android Auto on your Android device.
2. Enable Developer Mode: open Android Auto → tap version 10× → enable Developer Mode.
3. Connect via USB and run:
   ```bash
   adb forward tcp:5277 tcp:5277
   desktop-head-unit   # Android Auto DHU
   ```
4. See: https://developer.android.com/training/cars/testing

---

## Why a Config Plugin is not used

The project's `pnpm` workspace uses the `catalog:` protocol which breaks `npm install`
inside Expo's native build pipeline when a Config Plugin calls `require('@expo/config-plugins')`.
The setup script approach is used instead — files are dropped in after `expo prebuild`.
See the "Kein Config-Plugin für CarPlay möglich" entry in `replit.md` for full context.

---

## File Map

```
artifacts/mobile/
├── native/
│   ├── ios/
│   │   ├── CarPlaySceneDelegate.swift      ← main CarPlay UI
│   │   ├── FahrtDocCarPlayModule.swift     ← RN NativeModule (Swift)
│   │   └── FahrtDocCarPlayModule.m         ← ObjC bridge header
│   └── android/
│       ├── FahrtDocCarAppService.kt        ← CarAppService entry point
│       ├── FahrtDocCarSession.kt           ← Android Auto session
│       ├── FahrtDocCarScreen.kt            ← Android Auto screen / template
│       ├── FahrtDocCarPlayModule.kt        ← RN NativeModule (Kotlin)
│       ├── FahrtDocCarPlayPackage.kt       ← ReactPackage registration
│       └── automotive_app_desc.xml        ← capability descriptor
├── scripts/
│   └── setup-carplay-native.sh            ← post-prebuild wiring script
├── utils/
│   └── carplayBridge.ts                   ← JS bridge (NativeEventEmitter + dispatch)
└── hooks/
    └── useCarPlay.ts                      ← React hook (AppContext ↔ bridge)
```
