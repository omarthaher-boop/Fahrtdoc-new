# CarPlay & Android Auto — Native Setup Guide

The JS bridge (`utils/carplayBridge.ts`) and the React hook (`hooks/useCarPlay.ts`) are
already wired into the app. This guide covers the **native side** that must be added
before CarPlay / Android Auto becomes functional on device.

---

## iOS — Apple CarPlay

### Step 1: Request the Entitlement (blocks everything else)

CarPlay Driving Task apps require an explicit entitlement from Apple.
Apply at: https://developer.apple.com/contact/carplay/

- Category: **Driving Task App**
- Approval typically takes 2–4 weeks.

The entitlement key is already declared in `app.json`:
```json
"ios": {
  "entitlements": {
    "com.apple.developer.carplay-driving-task": true
  }
}
```

### Step 2: Add Scene Configuration to Info.plist

Add the following to `ios.infoPlist` in `app.json` (after Step 1 is approved):

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

### Step 3: Add CarPlaySceneDelegate.swift

This file must be added to the Xcode project (bare workflow or custom native module).
In the managed Expo workflow the only supported path is a custom EAS build with
a native module — see the "Config Plugin" note below.

```swift
// CarPlaySceneDelegate.swift
import CarPlay
import Foundation

@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

  var interfaceController: CPInterfaceController?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    showDashboard(interfaceController)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
  }

  // MARK: - UI

  private func showDashboard(_ controller: CPInterfaceController) {
    let template = buildTemplate(isActive: false, isPaused: false)
    controller.setRootTemplate(template, animated: false, completion: nil)
  }

  private func buildTemplate(isActive: Bool, isPaused: Bool) -> CPInformationTemplate {
    var actions: [CPTextButton] = []

    if isActive {
      if isPaused {
        actions.append(CPTextButton(title: "Weiterfahren", textStyle: .confirm) { [weak self] _ in
          self?.dispatch(["type": "pauseTrip"])
        })
      } else {
        actions.append(CPTextButton(title: "Pause", textStyle: .normal) { [weak self] _ in
          self?.dispatch(["type": "pauseTrip"])
        })
      }
      actions.append(CPTextButton(title: "Fahrt stoppen", textStyle: .cancel) { [weak self] _ in
        self?.dispatch(["type": "stopTrip"])
      })
    } else {
      actions.append(CPTextButton(title: "Geschäftlich starten", textStyle: .confirm) { [weak self] _ in
        self?.dispatch(["type": "startTrip", "tripType": "business"])
      })
      actions.append(CPTextButton(title: "Privat starten", textStyle: .normal) { [weak self] _ in
        self?.dispatch(["type": "startTrip", "tripType": "private"])
      })
    }

    let items = [
      CPInformationItem(title: "FahrtDoc", detail: isActive ? "Fahrt aktiv" : "Bereit"),
    ]

    let template = CPInformationTemplate(
      title: "FahrtDoc",
      layout: .leading,
      items: items,
      actions: actions
    )
    return template
  }

  // MARK: - Bridge

  /// Sends a CarPlay action to the React Native JS thread.
  private func dispatch(_ action: [String: Any]) {
    // This calls global.FahrtDocCarPlayDispatch(action) defined in carplayBridge.ts
    RCTRootView.bridge?.enqueueJSCall(
      "RCTEventEmitter",
      method: "receiveEvent",
      args: [],
      completion: nil
    )
    // Preferred path: call the global function directly via JSContext
    DispatchQueue.main.async {
      // Via react-native NativeModule (implement FahrtDocCarPlayModule below)
      FahrtDocCarPlayModule.shared?.dispatchAction(action)
    }
  }

  // MARK: - State Updates (called from FahrtDocCarPlayModule)

  func updateTripState(isActive: Bool, isPaused: Bool, tripType: String?, elapsedSeconds: Int, distanceKm: Double) {
    guard let controller = interfaceController else { return }
    let template = buildTemplate(isActive: isActive, isPaused: isPaused)
    controller.setRootTemplate(template, animated: true, completion: nil)
  }
}
```

### Step 4: Add the RN NativeModule (FahrtDocCarPlayModule)

```swift
// FahrtDocCarPlayModule.swift
import Foundation
import React

@objc(FahrtDocCarPlayModule)
class FahrtDocCarPlayModule: RCTEventEmitter {

  static var shared: FahrtDocCarPlayModule?

  override init() {
    super.init()
    FahrtDocCarPlayModule.shared = self
  }

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["FahrtDocCarPlayAction"]
  }

  /// Called from CarPlaySceneDelegate to send an action to JS
  func dispatchAction(_ action: [String: Any]) {
    sendEvent(withName: "FahrtDocCarPlayAction", body: action)
  }

  /// Called from JS (via NativeModules.FahrtDocCarPlay.updateTripState)
  @objc func updateTripState(_ state: NSDictionary) {
    guard
      let delegate = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? CPTemplateApplicationScene })
        .first?.delegate as? CarPlaySceneDelegate
    else { return }

    let isActive = state["isActive"] as? Bool ?? false
    let isPaused = state["isPaused"] as? Bool ?? false
    let tripType = state["tripType"] as? String
    let elapsed  = state["elapsedSeconds"] as? Int ?? 0
    let dist     = state["distanceKm"] as? Double ?? 0

    DispatchQueue.main.async {
      delegate.updateTripState(
        isActive: isActive,
        isPaused: isPaused,
        tripType: tripType,
        elapsedSeconds: elapsed,
        distanceKm: dist
      )
    }
  }
}
```

---

## Android — Android Auto

### Step 1: Add automotive_app_desc.xml

Create `android/app/src/main/res/xml/automotive_app_desc.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="template"/>
</automotiveApp>
```

### Step 2: Declare the CarAppService in AndroidManifest.xml

Inside `<application>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<service
    android:name=".FahrtDocCarAppService"
    android:exported="true"
    android:label="FahrtDoc">
    <intent-filter>
        <action android:name="androidx.car.app.CarAppService" />
        <category android:name="androidx.car.app.category.DRIVINGAPP" />
    </intent-filter>
    <meta-data
        android:name="distractionOptimized"
        android:value="true"/>
</service>

<meta-data
    android:name="com.google.android.gms.car.application"
    android:resource="@xml/automotive_app_desc" />
```

### Step 3: Add the Gradle dependency

In `android/app/build.gradle`:
```groovy
dependencies {
    implementation "androidx.car.app:app:1.4.0"
}
```

### Step 4: Add FahrtDocCarAppService.kt

```kotlin
// android/app/src/main/java/com/fahrtdoc/app/FahrtDocCarAppService.kt
package com.fahrtdoc.app

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

class FahrtDocCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator =
        HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    override fun onCreateSession(): Session = FahrtDocCarSession()
}
```

```kotlin
// FahrtDocCarSession.kt
package com.fahrtdoc.app

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.Session

class FahrtDocCarSession : Session() {
    override fun onCreateScreen(intent: android.content.Intent): Screen =
        FahrtDocCarScreen(carContext)
}
```

```kotlin
// FahrtDocCarScreen.kt
package com.fahrtdoc.app

import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.*

class FahrtDocCarScreen(carContext: CarContext) : Screen(carContext) {

    private var isActive = false
    private var isPaused = false

    override fun onGetTemplate(): Template {
        val actions = mutableListOf<Action>()

        if (isActive) {
            actions += Action.Builder()
                .setTitle("Fahrt stoppen")
                .setOnClickListener { dispatch("stopTrip", null) }
                .build()
            actions += Action.Builder()
                .setTitle(if (isPaused) "Weiterfahren" else "Pause")
                .setOnClickListener { dispatch("pauseTrip", null) }
                .build()
        } else {
            actions += Action.Builder()
                .setTitle("Geschäftlich")
                .setOnClickListener { dispatch("startTrip", "business") }
                .build()
            actions += Action.Builder()
                .setTitle("Privat")
                .setOnClickListener { dispatch("startTrip", "private") }
                .build()
        }

        return MessageTemplate.Builder(if (isActive) "Fahrt aktiv" else "Bereit")
            .setTitle("FahrtDoc")
            .addAction(actions.getOrNull(0) ?: return MessageTemplate.Builder("Fehler").setTitle("FahrtDoc").build())
            .apply { actions.drop(1).forEach { addAction(it) } }
            .build()
    }

    /** Sends a CarPlay action to the React Native JS bridge */
    private fun dispatch(type: String, tripType: String?) {
        // Calls global.FahrtDocCarPlayDispatch declared in carplayBridge.ts
        // Implement via a ReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit()
        FahrtDocCarPlayModule.instance?.dispatchAction(type, tripType)
    }

    /** Called from FahrtDocCarPlayModule when JS pushes a state update */
    fun onTripStateUpdate(active: Boolean, paused: Boolean) {
        isActive = active
        isPaused = paused
        invalidate()
    }
}
```

```kotlin
// FahrtDocCarPlayModule.kt — React Native NativeModule
package com.fahrtdoc.app

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class FahrtDocCarPlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FahrtDocCarPlay"

    companion object {
        var instance: FahrtDocCarPlayModule? = null
        var activeScreen: FahrtDocCarScreen? = null
    }

    init { instance = this }

    /** Called from CarScreen when user taps a button → sends event to JS */
    fun dispatchAction(type: String, tripType: String?) {
        val params = Arguments.createMap().apply {
            putString("type", type)
            tripType?.let { putString("tripType", it) }
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("FahrtDocCarPlayAction", params)
    }

    /** Called from JS (NativeModules.FahrtDocCarPlay.updateTripState) */
    @ReactMethod
    fun updateTripState(state: ReadableMap) {
        val isActive = state.getBoolean("isActive")
        val isPaused = state.getBoolean("isPaused")
        activeScreen?.onTripStateUpdate(isActive, isPaused)
    }
}
```

---

## Testing

### iOS CarPlay Simulator
- Requires Xcode + a physical iOS device OR the Xcode CarPlay Simulator window.
- Enable in Xcode: **I/O → CarPlay → CarPlay Simulator**.
- The app must be signed with the approved CarPlay entitlement.

### Android Auto Desktop Head Unit (DHU)
- Install Android Auto on your Android device.
- Enable Developer Mode in Android Auto settings.
- Connect via USB and run: `adb forward tcp:5277 tcp:5277 && desktop-head-unit`
- See: https://developer.android.com/training/cars/testing

---

## Why a Config Plugin is not used here

The project's `pnpm` workspace uses the `catalog:` protocol which breaks `npm install`
inside Expo's native build pipeline when a Config Plugin calls `require('@expo/config-plugins')`.
The native code above must therefore be added to the project via:
1. **EAS Custom Dev Client** with the files placed directly in the generated `ios/` and `android/` directories after `expo prebuild`, or
2. **Bare workflow** (`expo eject`) — gives full native access at the cost of managing Xcode/Gradle directly.
