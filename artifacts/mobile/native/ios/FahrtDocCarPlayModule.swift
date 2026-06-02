import Foundation
import React

/**
 * React Native NativeModule (iOS) — bridges JS and CarPlaySceneDelegate.
 *
 * JS → Native:
 *   NativeModules.FahrtDocCarPlay.updateTripState(state)
 *   Forwards trip state to CarPlaySceneDelegate.applyTripState().
 *
 * Native → JS:
 *   FahrtDocCarPlayModule.shared.dispatchToJS(action:tripType:)
 *   Emits "FahrtDocCarPlayAction" via RCTEventEmitter so the
 *   NativeEventEmitter in carplayBridge.ts picks it up.
 *
 * Module name must match NativeModules.FahrtDocCarPlay in carplayBridge.ts.
 */
@objc(FahrtDocCarPlay)
class FahrtDocCarPlayModule: RCTEventEmitter {

    @objc static let shared = FahrtDocCarPlayModule()

    private weak var delegate: CarPlaySceneDelegate?

    func registerDelegate(_ d: CarPlaySceneDelegate?) {
        delegate = d
    }

    // MARK: - RCTEventEmitter overrides

    override func supportedEvents() -> [String]! {
        return ["FahrtDocCarPlayAction"]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - JS → Native

    /**
     * Called from JS: NativeModules.FahrtDocCarPlay.updateTripState(state)
     *
     * state shape (all fields optional except isActive/isPaused):
     *   isActive: Bool
     *   isPaused: Bool
     *   tripType?: "business" | "private"
     *   elapsedSeconds?: Int
     *   distanceKm?: Double
     *   startAddress?: String   ← resolved address for the confirming screen
     */
    @objc func updateTripState(_ state: NSDictionary) {
        let isActive = state["isActive"] as? Bool ?? false
        let isPaused = state["isPaused"] as? Bool ?? false
        let tripType = state["tripType"] as? String
        let elapsedSeconds = state["elapsedSeconds"] as? Int ?? 0
        let distanceKm = state["distanceKm"] as? Double ?? 0.0
        let startAddress = state["startAddress"] as? String

        DispatchQueue.main.async { [weak self] in
            self?.delegate?.applyTripState(
                isActive: isActive,
                isPaused: isPaused,
                tripType: tripType,
                elapsedSeconds: elapsedSeconds,
                distanceKm: distanceKm,
                startAddress: startAddress
            )
        }
    }

    // MARK: - Native → JS

    func dispatchToJS(action: String, tripType: String?) {
        var body: [String: Any] = ["type": action]
        if let t = tripType { body["tripType"] = t }
        sendEvent(withName: "FahrtDocCarPlayAction", body: body)
    }
}
