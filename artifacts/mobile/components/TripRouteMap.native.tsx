import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { Trip } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface Coord {
  lat: number;
  lon: number;
}

interface MapPoint extends Coord {
  label: string;
  type: "start" | "waypoint" | "end";
  waypointIndex?: number;
}

interface DirectCoords {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

async function geocodeAddress(addr: string): Promise<Coord | null> {
  if (!addr) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(addr)}&format=json&limit=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "de", "User-Agent": "DriveLog/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function StartPin({ color }: { color: string }) {
  return (
    <View style={[nativeStyles.pinOuter, { backgroundColor: color, borderColor: "white" }]}>
      <View style={nativeStyles.pinInner} />
    </View>
  );
}

function EndPin({ color }: { color: string }) {
  return (
    <View style={[nativeStyles.pinOuter, { backgroundColor: "white", borderColor: color }]}>
      <View style={[nativeStyles.pinInner, { backgroundColor: color }]} />
    </View>
  );
}

function WaypointPin({ index }: { index: number }) {
  return (
    <View style={nativeStyles.waypointPin}>
      <Text style={nativeStyles.waypointText}>{index}</Text>
    </View>
  );
}

function MapUnavailable() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.map,
        {
          backgroundColor: colors.secondary,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
      ]}
    >
      <Feather name="map" size={22} color={colors.mutedForeground} />
      <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
        Karte nicht verfügbar
      </Text>
    </View>
  );
}

export default function TripRouteMap({
  trip,
  coords,
  path,
  hideOnEmpty = false,
}: {
  trip: Trip;
  coords?: DirectCoords;
  path?: { lat: number; lon: number }[];
  hideOnEmpty?: boolean;
}) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPath = path && path.length >= 2;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const waypoints = trip.waypoints ?? [];

      let startCoord: Coord | null;
      let endCoord: Coord | null;

      if (hasPath) {
        startCoord = path[0];
        endCoord = path[path.length - 1];
      } else if (coords) {
        startCoord = { lat: coords.startLat, lon: coords.startLon };
        endCoord = { lat: coords.endLat, lon: coords.endLon };
      } else {
        const storedStart =
          trip.startLat != null && trip.startLon != null
            ? { lat: trip.startLat, lon: trip.startLon }
            : null;
        const storedEnd =
          trip.endLat != null && trip.endLon != null
            ? { lat: trip.endLat, lon: trip.endLon }
            : null;

        [startCoord, endCoord] = await Promise.all([
          storedStart ? Promise.resolve(storedStart) : geocodeAddress(trip.startAddr),
          storedEnd ? Promise.resolve(storedEnd) : geocodeAddress(trip.endAddr),
        ]);
      }

      if (cancelled) return;

      const allPoints: MapPoint[] = [];

      if (startCoord) {
        allPoints.push({ ...startCoord, label: trip.startAddr, type: "start" });
      }
      waypoints.forEach((wp, i) => {
        allPoints.push({
          lat: wp.lat,
          lon: wp.lon,
          label: wp.addr,
          type: "waypoint",
          waypointIndex: i,
        });
      });
      if (endCoord) {
        allPoints.push({ ...endCoord, label: trip.endAddr, type: "end" });
      }

      if (allPoints.length === 0) {
        setError("Keine Koordinaten verfügbar");
        setLoading(false);
        return;
      }

      setPoints(allPoints);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, trip.startAddr, trip.endAddr, trip.startLat, trip.startLon, trip.endLat, trip.endLon, JSON.stringify(trip.waypoints), coords?.startLat, coords?.startLon, coords?.endLat, coords?.endLon, hasPath]);

  const WAYPOINT_COLOR = "#F59E0B";
  const waypointCount = (trip.waypoints ?? []).length;

  // GPS breadcrumb path when available, else straight line through markers
  const polylineCoords = hasPath
    ? path.map((p) => ({ latitude: p.lat, longitude: p.lon }))
    : points.map((p) => ({ latitude: p.lat, longitude: p.lon }));

  // All coordinates used for fitToCoordinates (markers + path extremes)
  const allFitCoords = [
    ...points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
    ...(hasPath ? [{ latitude: path[0].lat, longitude: path[0].lon }, { latitude: path[path.length - 1].lat, longitude: path[path.length - 1].lon }] : []),
  ];

  if (loading) {
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
          Karte wird geladen …
        </Text>
      </View>
    );
  }

  if (error || points.length === 0) {
    if (hideOnEmpty) return null;
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name="alert-circle" size={22} color={colors.mutedForeground} />
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
          {error ?? "Keine Kartendaten verfügbar"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapContainer, { borderColor: colors.border }]}>
      <ErrorBoundary FallbackComponent={MapUnavailable}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        scrollEnabled
        zoomEnabled
        onLayout={() => {
          if (allFitCoords.length > 0 && mapRef.current) {
            mapRef.current.fitToCoordinates(allFitCoords, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: false,
            });
          }
        }}
      >
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
        {points.map((pt, idx) => (
          <Marker
            key={idx}
            coordinate={{ latitude: pt.lat, longitude: pt.lon }}
            title={
              pt.type === "start"
                ? "Start"
                : pt.type === "end"
                  ? "Ziel"
                  : `Zwischenstopp ${(pt.waypointIndex ?? 0) + 1}`
            }
            description={pt.label}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {pt.type === "start" ? (
              <StartPin color={colors.primary} />
            ) : pt.type === "end" ? (
              <EndPin color={colors.mutedForeground} />
            ) : (
              <WaypointPin index={(pt.waypointIndex ?? 0) + 1} />
            )}
          </Marker>
        ))}
      </MapView>
      </ErrorBoundary>

      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            Start
          </Text>
        </View>
        {waypointCount > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: WAYPOINT_COLOR }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              {waypointCount === 1
                ? "1 Zwischenstopp"
                : `${waypointCount} Zwischenstopps`}
            </Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              styles.legendDotHollow,
              { borderColor: colors.mutedForeground },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            Ziel
          </Text>
        </View>
      </View>
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  pinOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  pinInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "white",
  },
  waypointPin: {
    width: 26,
    height: 26,
    backgroundColor: "#F59E0B",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  waypointText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
    transform: [{ rotate: "-45deg" }],
  },
});

const styles = StyleSheet.create({
  placeholder: {
    height: 200,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  mapContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  map: {
    height: 220,
    width: "100%",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotHollow: {
    backgroundColor: "white",
    borderWidth: 2,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
