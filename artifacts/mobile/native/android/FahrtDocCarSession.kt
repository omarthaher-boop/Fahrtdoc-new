package com.fahrtdoc.app

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

/**
 * Android Auto session — created by FahrtDocCarAppService.
 *
 * Instantiates FahrtDocCarScreen and registers it with the NativeModule
 * so JS-driven state updates reach the car display.
 */
class FahrtDocCarSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        val screen = FahrtDocCarScreen(carContext)
        FahrtDocCarPlayModule.registerScreen(screen)
        return screen
    }
}
