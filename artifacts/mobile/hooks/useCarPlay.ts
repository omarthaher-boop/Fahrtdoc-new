import { useEffect } from "react";
import {
  addCarPlayActionListener,
  setCarPlayStarted,
  updateCarPlayTripState,
} from "@/utils/carplayBridge";
import { useApp } from "@/context/AppContext";

/**
 * Wires the CarPlay / Android Auto bridge to AppContext trip state.
 *
 * Push: whenever trip state changes (active, paused, elapsed, distance),
 *       the native CarPlay / Android Auto UI is updated via `updateCarPlayTripState`.
 *
 * Pull: actions from the native UI (startTrip / stopTrip / pauseTrip) are
 *       received and forwarded to the matching AppContext method.
 *
 * This hook is a no-op when the native FahrtDocCarPlay module is absent
 * (managed build, Expo Go, web) — the phone app continues to work normally.
 *
 * Mount inside a component that lives within <AppProvider>.
 */
export function useCarPlay(): void {
  const { activeTrip, paused, elapsed, startTrip, stopTrip, togglePause } =
    useApp();

  useEffect(() => {
    updateCarPlayTripState({
      isActive: activeTrip !== null,
      isPaused: paused,
      tripType: activeTrip?.type,
      elapsedSeconds: elapsed,
      distanceKm: activeTrip ? activeTrip.distance / 1000 : 0,
    });
  }, [activeTrip, paused, elapsed]);

  useEffect(() => {
    return addCarPlayActionListener((action) => {
      switch (action.type) {
        case "startTrip":
          setCarPlayStarted(true);
          startTrip(action.tripType);
          break;
        case "stopTrip":
          setCarPlayStarted(false);
          stopTrip();
          break;
        case "pauseTrip":
          togglePause();
          break;
      }
    });
  }, [startTrip, stopTrip, togglePause]);

  // Clear the CarPlay-started flag when the trip ends from any source
  // (e.g. user stops the trip from the phone screen)
  useEffect(() => {
    if (activeTrip === null) {
      setCarPlayStarted(false);
    }
  }, [activeTrip]);
}
