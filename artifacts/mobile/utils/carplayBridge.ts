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

import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import { useEffect, useState } from "react";

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
// CarPlay session source tracking
//
// `carplayStarted` is true when the most recent startTrip was triggered by
// the CarPlay / Android Auto native UI, and false once the trip ends.
// ---------------------------------------------------------------------------

let carplayStarted = false;
const carplayStartedListeners = new Set<(v: boolean) => void>();

/** Set whether the current trip was started via CarPlay / Android Auto. */
export function setCarPlayStarted(value: boolean): void {
  if (carplayStarted === value) return;
  carplayStarted = value;
  carplayStartedListeners.forEach((l) => {
    try {
      l(value);
    } catch {
      // listener error must not block others
    }
  });
}

/**
 * React hook — returns `true` when the active trip was started from the
 * CarPlay / Android Auto screen, `false` otherwise.
 *
 * Automatically updates whenever the value changes anywhere in the app.
 */
export function useCarPlayStarted(): boolean {
  const [value, setValue] = useState(carplayStarted);
  useEffect(() => {
    // Sync in case the value changed between renders
    setValue(carplayStarted);
    carplayStartedListeners.add(setValue);
    return () => {
      carplayStartedListeners.delete(setValue);
    };
  }, []);
  return value;
}

// ---------------------------------------------------------------------------
// Native → JS: subscribe to NativeEventEmitter events from FahrtDocCarPlayModule
//
// When the native module is present (custom dev client / bare workflow build),
// button taps from the CarPlay / Android Auto UI arrive as
// "FahrtDocCarPlayAction" events. We forward them straight to the handler set
// so useCarPlay() receives them without any extra wiring.
// This is a no-op when the native module is absent (Expo Go, web, simulator).
// ---------------------------------------------------------------------------

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const carPlayModule = (NativeModules as any).FahrtDocCarPlay;
    if (carPlayModule) {
      const emitter = new NativeEventEmitter(carPlayModule);
      emitter.addListener("FahrtDocCarPlayAction", (action: CarPlayAction) => {
        dispatchCarPlayAction(action);
      });
    }
  } catch {
    // Native module not installed — ignore
  }
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
