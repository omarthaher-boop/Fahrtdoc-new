package com.fahrtdoc.app

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template

/**
 * Android Auto screen — renders trip state and dispatches button taps to JS.
 *
 * State is pushed from JS via FahrtDocCarPlayModule.updateTripState().
 * Button taps are forwarded to JS via FahrtDocCarPlayModule.dispatchToJS().
 *
 * When no trip is active: shows Start buttons (Geschäftlich / Privat).
 * When a trip is active: shows elapsed time, distance, Pause and Stop buttons.
 */
class FahrtDocCarScreen(carContext: CarContext) : Screen(carContext) {

    private var isActive: Boolean = false
    private var isPaused: Boolean = false
    private var tripType: String? = null
    private var elapsedSeconds: Int = 0
    private var distanceKm: Double = 0.0

    fun applyTripState(
        active: Boolean,
        paused: Boolean,
        type: String?,
        elapsed: Int,
        distance: Double,
    ) {
        isActive = active
        isPaused = paused
        tripType = type
        elapsedSeconds = elapsed
        distanceKm = distance
        invalidate()
    }

    override fun onGetTemplate(): Template {
        return if (isActive) buildActiveTemplate() else buildIdleTemplate()
    }

    private fun buildIdleTemplate(): Template {
        val startBusiness = Action.Builder()
            .setTitle("Geschäftlich")
            .setOnClickListener {
                FahrtDocCarPlayModule.dispatchToJS("startTrip", "business")
            }
            .build()

        val startPrivate = Action.Builder()
            .setTitle("Privat")
            .setOnClickListener {
                FahrtDocCarPlayModule.dispatchToJS("startTrip", "private")
            }
            .build()

        return MessageTemplate.Builder("Keine aktive Fahrt")
            .setTitle("FahrtDoc")
            .addAction(startBusiness)
            .addAction(startPrivate)
            .build()
    }

    private fun buildActiveTemplate(): Template {
        val minutes = elapsedSeconds / 60
        val seconds = elapsedSeconds % 60
        val elapsed = String.format("%02d:%02d", minutes, seconds)
        val dist = String.format("%.1f km", distanceKm)
        val typeLabel = if (tripType == "business") "Geschäftlich" else "Privat"

        val infoRow = Row.Builder()
            .setTitle("$typeLabel · $elapsed")
            .addText(dist)
            .build()

        val pauseOrResume = if (isPaused) {
            Action.Builder()
                .setTitle("Fortsetzen")
                .setOnClickListener {
                    FahrtDocCarPlayModule.dispatchToJS("pauseTrip", null)
                }
                .build()
        } else {
            Action.Builder()
                .setTitle("Pause")
                .setOnClickListener {
                    FahrtDocCarPlayModule.dispatchToJS("pauseTrip", null)
                }
                .build()
        }

        val stop = Action.Builder()
            .setTitle("Stoppen")
            .setOnClickListener {
                FahrtDocCarPlayModule.dispatchToJS("stopTrip", null)
            }
            .build()

        val pane = Pane.Builder()
            .addRow(infoRow)
            .addAction(pauseOrResume)
            .addAction(stop)
            .build()

        return PaneTemplate.Builder(pane)
            .setTitle("FahrtDoc")
            .build()
    }
}
