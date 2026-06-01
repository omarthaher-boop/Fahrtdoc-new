package com.fahrtdoc.app

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native NativeModule — bridges JS and the Android Auto car screen.
 *
 * JS → Native:
 *   NativeModules.FahrtDocCarPlay.updateTripState(state)
 *   Forwards state to FahrtDocCarScreen.applyTripState() which calls invalidate().
 *
 * Native → JS:
 *   FahrtDocCarPlayModule.dispatchToJS(action, tripType?)
 *   Emits "FahrtDocCarPlayAction" via DeviceEventManagerModule so the
 *   NativeEventEmitter in carplayBridge.ts picks it up.
 *
 * Module name must match NativeModules.FahrtDocCarPlay in carplayBridge.ts.
 */
class FahrtDocCarPlayModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var screen: FahrtDocCarScreen? = null
        private var instance: FahrtDocCarPlayModule? = null

        fun registerScreen(s: FahrtDocCarScreen) {
            screen = s
        }

        /**
         * Called from FahrtDocCarScreen button click listeners (on the Car App
         * dispatcher thread). Marshals the event to the React Native JS thread.
         */
        fun dispatchToJS(action: String, tripType: String?) {
            instance?.sendCarPlayAction(action, tripType)
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = "FahrtDocCarPlay"

    private fun sendCarPlayAction(action: String, tripType: String?) {
        try {
            val params = Arguments.createMap().apply {
                putString("type", action)
                if (tripType != null) putString("tripType", tripType)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FahrtDocCarPlayAction", params)
        } catch (_: Exception) {
        }
    }

    /**
     * Called from JS: updateTripState(state)
     * state = { isActive, isPaused, tripType?, elapsedSeconds?, distanceKm? }
     */
    @ReactMethod
    fun updateTripState(state: ReadableMap) {
        val active = if (state.hasKey("isActive")) state.getBoolean("isActive") else false
        val paused = if (state.hasKey("isPaused")) state.getBoolean("isPaused") else false
        val type = if (state.hasKey("tripType") && !state.isNull("tripType")) state.getString("tripType") else null
        val elapsed = if (state.hasKey("elapsedSeconds")) state.getInt("elapsedSeconds") else 0
        val distance = if (state.hasKey("distanceKm")) state.getDouble("distanceKm") else 0.0
        screen?.applyTripState(active, paused, type, elapsed, distance)
    }

    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }
}
