import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  addCarPlayActionListener,
  setCarPlayStarted,
  setCarPlayStopped,
  updateCarPlayTripState,
} from "@/utils/carplayBridge";
import { useApp } from "@/context/AppContext";
import { reverseGeocode } from "@/context/AppContext";

/**
 * Wires the CarPlay / Android Auto bridge to AppContext trip state.
 *
 * Push: whenever trip state changes (active, paused, elapsed, distance),
 *       the native CarPlay / Android Auto UI is updated via `updateCarPlayTripState`.
 *       `startAddress` carries the active trip's resolved start address so the
 *       native confirmation screen can display it while the user confirms.
 *
 * Pull: actions from the native UI are received and handled:
 *   - selectTripType — user picked a trip type on idle screen; JS resolves
 *     the current GPS position to an address and pushes it back so the native
 *     confirmation template can display "Startadresse".
 *     IMPORTANT: the async address push always uses the latest live trip state
 *     from refs to avoid overwriting isActive:true with isActive:false in the
 *     race where the user confirms before geocoding finishes.
 *   - startTrip — user confirmed on the confirmation screen; trip starts.
 *   - stopTrip / pauseTrip — forwarded to AppContext.
 *
 * This hook is a no-op when the native FahrtDocCarPlay module is absent
 * (managed build, Expo Go, web) — the phone app continues to work normally.
 *
 * Mount inside a component that lives within <AppProvider>.
 */
export function useCarPlay(): void {
  const { activeTrip, paused, elapsed, startTrip, stopTrip, togglePause } =
    useApp();

  // ── Refs that always hold the latest values (safe to read from async closures) ──
  const activeTripRef = useRef(activeTrip);
  const pausedRef = useRef(paused);
  const elapsedRef = useRef(elapsed);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  // ── Push: sync AppContext trip state to the native car display ──────────────
  useEffect(() => {
    updateCarPlayTripState({
      isActive: activeTrip !== null,
      isPaused: paused,
      tripType: activeTrip?.type,
      elapsedSeconds: elapsed,
      distanceKm: activeTrip ? activeTrip.distance / 1000 : 0,
      startAddress: activeTrip?.startAddr,
    });
  }, [activeTrip, paused, elapsed]);

  // ── Resolve current GPS position to an address for the confirmation screen ──
  //
  // Reads live trip state from refs when the async geocode completes so that a
  // fast confirm (trip starts before geocoding finishes) never overwrites
  // isActive:true with isActive:false.

  const resolveAndPushStartAddress = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const Location = await import("expo-location");
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const address = await reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude
      );
      if (!address) return;

      // Read the latest trip state from refs — the trip may have started while
      // geocoding was in progress, so we must reflect the real current state.
      const currentTrip = activeTripRef.current;
      updateCarPlayTripState({
        isActive: currentTrip !== null,
        isPaused: pausedRef.current,
        tripType: currentTrip?.type,
        elapsedSeconds: elapsedRef.current,
        distanceKm: currentTrip ? currentTrip.distance / 1000 : 0,
        // When the trip is already active, prefer its own startAddr; otherwise
        // use the pre-trip geocoded address for the confirmation screen.
        startAddress: currentTrip?.startAddr || address,
      });
    } catch {
      // GPS unavailable or permission denied — the confirmation screen will
      // show "Adresse wird ermittelt…" as a fallback.
    }
  }, []); // no deps — reads latest values via refs

  // ── Pull: handle actions from the native car display ───────────────────────
  useEffect(() => {
    return addCarPlayActionListener((action) => {
      switch (action.type) {
        case "selectTripType":
          // User selected a trip type on CarPlay — resolve address for the
          // confirmation screen (fire-and-forget, result pushed via bridge)
          void resolveAndPushStartAddress();
          break;

        case "startTrip":
          setCarPlayStarted(true);
          startTrip(action.tripType);
          break;

        case "stopTrip":
          setCarPlayStarted(false);
          setCarPlayStopped(true);
          stopTrip();
          break;

        case "pauseTrip":
          togglePause();
          break;
      }
    });
  }, [startTrip, stopTrip, togglePause, resolveAndPushStartAddress]);

  // ── Clear the CarPlay-started flag when the trip ends from any source ───────
  useEffect(() => {
    if (activeTrip === null) {
      setCarPlayStarted(false);
    }
  }, [activeTrip]);
}
