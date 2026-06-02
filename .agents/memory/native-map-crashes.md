---
name: Native map crashes (react-native-maps)
description: Why native MapView can crash whole screens in the FahrtDoc Expo app and how it's contained.
---

# react-native-maps crash containment

`react-native-maps` is rendered via platform `.native.tsx` files: `TripRouteMap.native.tsx`
(trip list cards on expand, Save sheet, trip detail) and `ActiveTripMap.native.tsx`
(active trip). On real devices/TestFlight a map render error propagated up and crashed the
entire screen — the Save sheet rendered a map unconditionally, so a map failure made saving
impossible (app had to be restarted).

**Rule:** every native `MapView` is wrapped in an `ErrorBoundary` (FallbackComponent shows
"Karte nicht verfügbar") *inside* the native map component, so all consumers are protected.

**Why:** the root-level `ErrorBoundary` in `app/_layout.tsx` is too coarse — one map error
took down the whole app. JS-level errors (e.g. `requireNativeComponent` "AIRMap not found"
when the native module isn't linked) ARE caught by an ErrorBoundary; true Obj-C/Swift native
crashes are not.

**How to apply:** never render a full interactive `MapView` per row in a long scrolling list
(memory pressure → native crash). The list cards use the lightweight SVG `TripRouteThumbnail`
when collapsed and only mount the full map on expand. Keep new map usages wrapped.
