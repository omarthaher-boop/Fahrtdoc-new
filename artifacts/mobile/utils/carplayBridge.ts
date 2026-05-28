/**
 * CarPlay / Android Auto bridge — JavaScript side.
 *
 * This module is the single integration point between React Native's AppContext
 * and the native CarPlay (iOS) / Android Auto (Android) layers.
 *
 * Native prerequisites (required before this has any visible effect on device):
 *
 *   iOS — Apple CarPlay:
 *     1. Apple must approve the CarPlay entitlement for your App ID.
 *        Category: Driving Task App
 *        Apply at: https://developer.apple.com/contact/carplay/
 *     2. Add CarPlaySceneDelegate.swift to the Xcode project.
 *        See artifacts/mobile/docs/carplay-native-setup.md for the full template.
 *     3. The entitlement is already declared in app.json (ios.entitlements).
 *
 *   Android — Android Auto:
 *     1. Add FahrtDocCarAppService.kt to the Android project.
 *     2. Declare the service + intent filter in AndroidManifest.xml.
 *     3. Create res/xml/automotive_app_desc.xml.
 *        See artifacts/mobile/docs/carplay-native-setup.md for all templates.
 *
 * When native modules are absent (managed Expo build, Expo Go, web), all
 * calls in this module are silent no-ops — the app works normally.
 */

import { NativeModules, Platform } from "react-native";

// ---------------------------------------------------------------------------
// Action types — native side → JS
// ---------------------------------------------------------------------------

export type CarPlayAction =
  | { type: "startTrip"; tripType: "business" | "private" }
  | { type: "stopTrip" }
  | { type: "pauseTrip" };

// ---------------------------------------------------------------------------
// Trip state — JS → native CarPlay / Android Auto UI
// ---------------------------------------------------------------------------

export interface CarPlayTripState {
  isActive: boolean;
  isPaused: boolean;
  tripType?: "business" | "private";
  elapsedSeconds?: number;
  distanceKm?: number;
}

// ---------------------------------------------------------------------------
// Module-level action listener registry (singleton, safe across re-renders)
// ---------------------------------------------------------------------------

type ActionHandler = (action: CarPlayAction) => void;
const actionHandlers = new Set<ActionHandler>();

/**
 * Subscribe to actions dispatched from the native CarPlay / Android Auto UI.
 * Returns an unsubscribe function — use it as the useEffect cleanup return.
 *
 * @example
 *   useEffect(() => addCarPlayActionListener(handleAction), [handleAction]);
 */
export function addCarPlayActionListener(handler: ActionHandler): () => void {
  actionHandlers.add(handler);
  return () => actionHandlers.delete(handler);
}

/**
 * Called by native code when the user taps a button on the CarPlay /
 * Android Auto screen. Also exposed as `global.FahrtDocCarPlayDispatch`
 * so a RN NativeModule can call it without importing this file.
 */
export function dispatchCarPlayAction(action: CarPlayAction): void {
  actionHandlers.forEach((h) => {
    try {
      h(action);
    } catch {
      // one handler's error must not block the others
    }
  });
}

// Expose on global so native bridge code can call it without a module ref:
//   global.FahrtDocCarPlayDispatch({ type: 'startTrip', tripType: 'business' })
if (typeof global !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).FahrtDocCarPlayDispatch = dispatchCarPlayAction;
}

// ---------------------------------------------------------------------------
// JS → Native: push trip state to the CarPlay / Android Auto display
// ---------------------------------------------------------------------------

/**
 * Updates the CarPlay / Android Auto UI with the current trip state.
 * The native module (`FahrtDocCarPlay`) must expose `updateTripState(state)`.
 * No-ops silently when the module is not installed.
 */
export function updateCarPlayTripState(state: CarPlayTripState): void {
  if (Platform.OS === "web") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (NativeModules as any).FahrtDocCarPlay?.updateTripState?.(state);
  } catch {
    // Native module not installed — ignore
  }
}
