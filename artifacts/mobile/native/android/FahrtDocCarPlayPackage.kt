package com.fahrtdoc.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage — registers FahrtDocCarPlayModule with the React Native bridge.
 *
 * Added to MainApplication.kt by setup-carplay-native.sh after `expo prebuild`.
 */
class FahrtDocCarPlayPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = listOf(FahrtDocCarPlayModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
