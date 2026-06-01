import CarPlay
import UIKit

/**
 * CarPlay scene delegate — renders the CarPlay UI and forwards button taps
 * back to JS via FahrtDocCarPlayModule (RCTEventEmitter).
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

    // MARK: - Template rendering

    private var isActive: Bool = false
    private var isPaused: Bool = false
    private var tripType: String? = nil
    private var elapsedSeconds: Int = 0
    private var distanceKm: Double = 0.0

    func applyTripState(
        isActive: Bool,
        isPaused: Bool,
        tripType: String?,
        elapsedSeconds: Int,
        distanceKm: Double
    ) {
        self.isActive = isActive
        self.isPaused = isPaused
        self.tripType = tripType
        self.elapsedSeconds = elapsedSeconds
        self.distanceKm = distanceKm
        DispatchQueue.main.async { self.pushCurrentTemplate() }
    }

    private func pushCurrentTemplate() {
        guard let controller = interfaceController else { return }
        let template = isActive ? buildActiveTemplate() : buildIdleTemplate()
        if controller.templates.isEmpty {
            controller.setRootTemplate(template, animated: false, completion: nil)
        } else {
            controller.setRootTemplate(template, animated: true, completion: nil)
        }
    }

    private func buildIdleTemplate() -> CPInformationTemplate {
        let businessBtn = CPTextButton(title: "Geschäftlich", textStyle: .normal) { [weak self] _ in
            self?.dispatch(action: "startTrip", tripType: "business")
        }
        let privateBtn = CPTextButton(title: "Privat", textStyle: .normal) { [weak self] _ in
            self?.dispatch(action: "startTrip", tripType: "private")
        }
        let template = CPInformationTemplate(
            title: "FahrtDoc",
            layout: .leading,
            items: [CPInformationItem(title: "Keine aktive Fahrt", detail: nil)],
            actions: [businessBtn, privateBtn]
        )
        return template
    }

    private func buildActiveTemplate() -> CPInformationTemplate {
        let minutes = elapsedSeconds / 60
        let seconds = elapsedSeconds % 60
        let elapsed = String(format: "%02d:%02d", minutes, seconds)
        let dist = String(format: "%.1f km", distanceKm)
        let typeLabel = tripType == "business" ? "Geschäftlich" : "Privat"

        let items: [CPInformationItem] = [
            CPInformationItem(title: "\(typeLabel) · \(elapsed)", detail: dist),
        ]

        let pauseTitle = isPaused ? "Fortsetzen" : "Pause"
        let pauseBtn = CPTextButton(title: pauseTitle, textStyle: .normal) { [weak self] _ in
            self?.dispatch(action: "pauseTrip", tripType: nil)
        }
        let stopBtn = CPTextButton(title: "Stoppen", textStyle: .confirm) { [weak self] _ in
            self?.dispatch(action: "stopTrip", tripType: nil)
        }

        return CPInformationTemplate(
            title: "FahrtDoc",
            layout: .leading,
            items: items,
            actions: [pauseBtn, stopBtn]
        )
    }

    // MARK: - Dispatch to JS

    private func dispatch(action: String, tripType: String?) {
        FahrtDocCarPlayModule.shared.dispatchToJS(action: action, tripType: tripType)
    }
}
