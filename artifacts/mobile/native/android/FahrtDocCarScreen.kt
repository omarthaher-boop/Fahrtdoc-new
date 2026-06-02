package com.fahrtdoc.app

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template

/**
 * Android Auto screen — three-state UI (idle → confirming → active).
 *
 * State is pushed from JS via FahrtDocCarPlayModule.updateTripState().
 * Button taps are forwarded to JS via FahrtDocCarPlayModule.dispatchToJS().
 *
 * Idle      — "Geschäftl. starten" / "Privat starten" buttons
 * Confirming — trip type + resolved start address; "Bestätigen" / "Abbrechen"
 * Active     — elapsed time, distance, pause state; "Pausieren" / "Fahrt beenden"
 */
class FahrtDocCarScreen(carContext: CarContext) : Screen(carContext) {

    private var isActive: Boolean = false
    private var isPaused: Boolean = false
    private var isConfirming: Boolean = false
    private var tripType: String? = null
    private var startAddress: String? = null
    private var elapsedSeconds: Int = 0
    private var distanceKm: Double = 0.0

    /**
     * Called by FahrtDocCarPlayModule when JS pushes a new CarPlayTripState.
     *
     * Transition rules:
     *   isActive == true                           → Active screen
     *   isActive == false && isConfirming == true  → Confirming screen (address may update)
     *   isActive == false && isConfirming == false → Idle screen
     */
    fun applyTripState(
        active: Boolean,
        paused: Boolean,
        type: String?,
        elapsed: Int,
        distance: Double,
        address: String?,
    ) {
        if (active) {
            // Trip started — leave confirming mode
            isConfirming = false
            startAddress = null
        } else if (address != null) {
            // JS resolved the start address while we are in confirming state
            startAddress = address
        }

        isActive = active
        isPaused = paused
        if (type != null) tripType = type
        elapsedSeconds = elapsed
        distanceKm = distance
        invalidate()
    }

    override fun onGetTemplate(): Template {
        return when {
            isActive -> buildActiveTemplate()
            isConfirming -> buildConfirmingTemplate()
            else -> buildIdleTemplate()
        }
    }

    // ─── Idle ────────────────────────────────────────────────────────────────

    private fun buildIdleTemplate(): Template {
        val startBusiness = Action.Builder()
            .setTitle("Geschäftl. starten")
            .setOnClickListener { handleSelectTripType("business") }
            .build()

        val startPrivate = Action.Builder()
            .setTitle("Privat starten")
            .setOnClickListener { handleSelectTripType("private") }
            .build()

        return MessageTemplate.Builder("Bereit zur Fahrt")
            .setTitle("FahrtDoc")
            .addAction(startBusiness)
            .addAction(startPrivate)
            .build()
    }

    // ─── Confirming ──────────────────────────────────────────────────────────

    private fun buildConfirmingTemplate(): Template {
        val typeLabel = if (tripType == "business") "Geschäftlich" else "Privat"
        val addressText = startAddress ?: "Adresse wird ermittelt…"

        val typeRow = Row.Builder()
            .setTitle("Art")
            .addText(typeLabel)
            .build()

        val addressRow = Row.Builder()
            .setTitle("Startadresse")
            .addText(addressText)
            .build()

        val confirm = Action.Builder()
            .setTitle("Bestätigen")
            .setOnClickListener { handleConfirm() }
            .build()

        val cancel = Action.Builder()
            .setTitle("Abbrechen")
            .setOnClickListener { handleCancel() }
            .build()

        val pane = Pane.Builder()
            .addRow(typeRow)
            .addRow(addressRow)
            .addAction(confirm)
            .addAction(cancel)
            .build()

        return PaneTemplate.Builder(pane)
            .setTitle("FahrtDoc")
            .build()
    }

    // ─── Active ──────────────────────────────────────────────────────────────

    private fun buildActiveTemplate(): Template {
        val minutes = elapsedSeconds / 60
        val seconds = elapsedSeconds % 60
        val elapsed = String.format("%02d:%02d", minutes, seconds)
        val dist = String.format("%.1f km", distanceKm)
        val typeLabel = if (tripType == "business") "Geschäftlich" else "Privat"
        val statusIcon = if (isPaused) "⏸" else "●"
        val statusText = if (isPaused) "Pausiert" else "Läuft"

        val infoRow = Row.Builder()
            .setTitle("$typeLabel · $elapsed")
            .addText("$dist  $statusIcon $statusText")
            .build()

        val pauseOrResume = Action.Builder()
            .setTitle(if (isPaused) "Fortsetzen" else "Pausieren")
            .setOnClickListener { FahrtDocCarPlayModule.dispatchToJS("pauseTrip", null) }
            .build()

        val stop = Action.Builder()
            .setTitle("Fahrt beenden")
            .setOnClickListener { FahrtDocCarPlayModule.dispatchToJS("stopTrip", null) }
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

    // ─── Button handlers ─────────────────────────────────────────────────────

    private fun handleSelectTripType(type: String) {
        // Transition to confirming locally before JS responds with the address
        isConfirming = true
        tripType = type
        startAddress = null
        invalidate()
        FahrtDocCarPlayModule.dispatchToJS("selectTripType", type)
    }

    private fun handleConfirm() {
        // JS will start the trip and push back isActive: true
        FahrtDocCarPlayModule.dispatchToJS("startTrip", tripType)
    }

    private fun handleCancel() {
        isConfirming = false
        startAddress = null
        tripType = null
        invalidate()
        FahrtDocCarPlayModule.dispatchToJS("cancelTripType", null)
    }
}
