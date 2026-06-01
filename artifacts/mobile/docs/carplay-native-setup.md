# CarPlay & Android Auto — Native Setup Guide

The JS bridge (`utils/carplayBridge.ts`), the React hook (`hooks/useCarPlay.ts`),
and the `CarPlayBridge` component in `app/_layout.tsx` are already wired into the
app. This guide covers the **native side** that must be added before CarPlay /
Android Auto becomes functional on device.

Pre-written native source files live in `native/ios/` and `native/android/`.
A post-prebuild setup script automates copying and patching.

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

> ⚠️  The entitlement key was **temporarily removed** from `app.json` for the
> App Store v1.x submission while awaiting Apple approval.
> After approval, re-add it under `ios.entitlements`:
> ```json
> "entitlements": {
>   "com.apple.developer.carplay-driving-task": true
> }
> ```

### Step 2: Add UIApplicationSceneManifest to app.json

Add the following to `ios.infoPlist` in `app.json` **after Step 1 is approved**,
then re-run `expo prebuild`:

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

### Testing (iOS)

- Requires Xcode + the Xcode CarPlay Simulator window.
- Enable in Xcode: **I/O → CarPlay → CarPlay Simulator**.
- The app must be signed with the approved CarPlay entitlement certificate.
- Build a **development client** first: `eas build --profile development --platform ios`

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
