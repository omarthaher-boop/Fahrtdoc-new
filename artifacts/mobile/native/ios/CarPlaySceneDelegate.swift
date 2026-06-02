import CarPlay
import UIKit

/**
 * CarPlay scene delegate — renders the CarPlay UI and forwards button taps
 * back to JS via FahrtDocCarPlayModule (RCTEventEmitter).
 *
 * Three-state UI:
 *   Idle       — two start buttons ("Geschäftl. starten" / "Privat starten")
 *   Confirming — CPInformationTemplate with resolved start address;
 *                buttons "Bestätigen" / "Abbrechen"
 *   Active     — live elapsed time + distance; buttons "Pausieren" / "Fahrt beenden"
 *
 * Registered in app.json under ios.infoPlist.UIApplicationSceneManifest with
 * UISceneDelegateClassName "$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate".
 *
 * Added to the Xcode project by setup-carplay-native.sh after `expo prebuild`.
 */
@objc class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    var interfaceController: CPInterfaceController?

    // MARK: - Scene lifecycle

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        FahrtDocCarPlayModule.shared.registerDelegate(self)
        pushCurrentTemplate()
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnect interfaceController: CPInterfaceController
    ) {
        FahrtDocCarPlayModule.shared.registerDelegate(nil)
        self.interfaceController = nil
    }

    // MARK: - Trip state

    private var isActive: Bool = false
    private var isPaused: Bool = false
    private var isConfirming: Bool = false
    private var tripType: String? = nil
    private var startAddress: String? = nil
    private var elapsedSeconds: Int = 0
    private var distanceKm: Double = 0.0

    /**
     * Called by FahrtDocCarPlayModule when JS pushes a new CarPlayTripState.
     *
     * Transition rules:
     *   • isActive == true                         → Active screen
     *   • isActive == false && isConfirming == true → Confirming screen (address may update)
     *   • isActive == false && isConfirming == false → Idle screen
     *
     * When JS sets isActive = true the confirming flag is implicitly cleared.
     */
    func applyTripState(
        isActive: Bool,
        isPaused: Bool,
        tripType: String?,
        elapsedSeconds: Int,
        distanceKm: Double,
        startAddress: String?
    ) {
        if isActive {
            // Trip has started — leave confirming mode
            isConfirming = false
            self.startAddress = nil
        } else if let addr = startAddress {
            // JS resolved the address while we are in confirming state
            self.startAddress = addr
        }

        self.isActive = isActive
        self.isPaused = isPaused
        if let t = tripType { self.tripType = t }
        self.elapsedSeconds = elapsedSeconds
        self.distanceKm = distanceKm

        DispatchQueue.main.async { self.pushCurrentTemplate() }
    }

    // MARK: - Template routing

    private func pushCurrentTemplate() {
        guard let controller = interfaceController else { return }

        let template: CPTemplate
        if isActive {
            template = buildActiveTemplate()
        } else if isConfirming {
            template = buildConfirmingTemplate()
        } else {
            template = buildIdleTemplate()
        }

        if controller.templates.isEmpty {
            controller.setRootTemplate(template, animated: false, completion: nil)
        } else {
            controller.setRootTemplate(template, animated: true, completion: nil)
        }
    }

    // MARK: - Idle template

    private func buildIdleTemplate() -> CPInformationTemplate {
        let businessBtn = CPTextButton(title: "Geschäftl. starten", textStyle: .normal) { [weak self] _ in
            self?.handleSelectTripType("business")
        }
        let privateBtn = CPTextButton(title: "Privat starten", textStyle: .normal) { [weak self] _ in
            self?.handleSelectTripType("private")
        }
        return CPInformationTemplate(
            title: "FahrtDoc",
            layout: .leading,
            items: [CPInformationItem(title: "Bereit zur Fahrt", detail: nil)],
            actions: [businessBtn, privateBtn]
        )
    }

    // MARK: - Confirming template

    private func buildConfirmingTemplate() -> CPInformationTemplate {
        let typeLabel = tripType == "business" ? "Geschäftlich" : "Privat"
        let addressDetail = startAddress ?? "Adresse wird ermittelt…"

        let items: [CPInformationItem] = [
            CPInformationItem(title: "Art", detail: typeLabel),
            CPInformationItem(title: "Startadresse", detail: addressDetail),
        ]

        let confirmBtn = CPTextButton(title: "Bestätigen", textStyle: .confirm) { [weak self] _ in
            self?.handleConfirm()
        }
        let cancelBtn = CPTextButton(title: "Abbrechen", textStyle: .cancel) { [weak self] _ in
            self?.handleCancel()
        }

        return CPInformationTemplate(
            title: "FahrtDoc",
            layout: .leading,
            items: items,
            actions: [confirmBtn, cancelBtn]
        )
    }

    // MARK: - Active template

    private func buildActiveTemplate() -> CPInformationTemplate {
        let minutes = elapsedSeconds / 60
        let seconds = elapsedSeconds % 60
        let elapsed = String(format: "%02d:%02d", minutes, seconds)
        let dist = String(format: "%.1f km", distanceKm)
        let typeLabel = tripType == "business" ? "Geschäftlich" : "Privat"
        let statusIcon = isPaused ? "⏸" : "●"

        let items: [CPInformationItem] = [
            CPInformationItem(title: "Art", detail: typeLabel),
            CPInformationItem(title: "Dauer", detail: elapsed),
            CPInformationItem(title: "Distanz", detail: dist),
            CPInformationItem(title: "Status", detail: "\(statusIcon) \(isPaused ? "Pausiert" : "Läuft")"),
        ]

        let pauseTitle = isPaused ? "Fortsetzen" : "Pausieren"
        let pauseBtn = CPTextButton(title: pauseTitle, textStyle: .normal) { [weak self] _ in
            self?.dispatch(action: "pauseTrip", tripType: nil)
        }
        let stopBtn = CPTextButton(title: "Fahrt beenden", textStyle: .confirm) { [weak self] _ in
            self?.dispatch(action: "stopTrip", tripType: nil)
        }

        return CPInformationTemplate(
            title: "FahrtDoc",
            layout: .leading,
            items: items,
            actions: [pauseBtn, stopBtn]
        )
    }

    // MARK: - Button handlers

    private func handleSelectTripType(_ type: String) {
        // Transition to confirming state locally before JS responds
        isConfirming = true
        tripType = type
        startAddress = nil
        pushCurrentTemplate()
        // Tell JS to resolve the start address and prepare the trip
        dispatch(action: "selectTripType", tripType: type)
    }

    private func handleConfirm() {
        // Dispatch startTrip — JS will call AppContext.startTrip() which
        // sends back isActive: true, transitioning us to the active screen.
        dispatch(action: "startTrip", tripType: tripType)
    }

    private func handleCancel() {
        // Return to idle and notify JS so it can clean up geocode state
        isConfirming = false
        startAddress = nil
        tripType = nil
        pushCurrentTemplate()
        dispatch(action: "cancelTripType", tripType: nil)
    }

    // MARK: - Dispatch to JS

    private func dispatch(action: String, tripType: String?) {
        FahrtDocCarPlayModule.shared.dispatchToJS(action: action, tripType: tripType)
    }
}
