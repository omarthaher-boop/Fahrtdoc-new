import { Feather } from "@expo/vector-icons";
import L from "leaflet";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Trip } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

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

function makeDivIcon(html: string, size: number): L.DivIcon {
  return L.divIcon({
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: "",
  });
}

function startIcon(color: string): L.DivIcon {
  const s = 22;
  const html = `<div style="
    width:${s}px;height:${s}px;border-radius:50%;
    background:${color};
    border:3px solid white;
    box-shadow:0 1px 5px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  "><div style="width:7px;height:7px;border-radius:50%;background:white"></div></div>`;
  return makeDivIcon(html, s);
}

function endIcon(color: string): L.DivIcon {
  const s = 22;
  const html = `<div style="
    width:${s}px;height:${s}px;border-radius:50%;
    background:white;
    border:3px solid ${color};
    box-shadow:0 1px 5px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  "><div style="width:7px;height:7px;border-radius:50%;background:${color}"></div></div>`;
  return makeDivIcon(html, s);
}

function waypointIcon(index: number): L.DivIcon {
  const s = 26;
  const color = "#F59E0B";
  const html = `<div style="
    width:${s}px;height:${s}px;
    background:${color};
    border:2px solid white;
    box-shadow:0 1px 5px rgba(0,0,0,0.35);
    border-radius:4px;
    transform:rotate(45deg);
    display:flex;align-items:center;justify-content:center;
  "><span style="
    transform:rotate(-45deg);
    font-size:10px;font-weight:700;
    color:white;line-height:1;
  ">${index}</span></div>`;
  return makeDivIcon(html, s);
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [positions, map]);
  return null;
}

function LeafletMap({
  points,
  polylinePath,
  primaryColor,
  mutedColor,
}: {
  points: MapPoint[];
  polylinePath: [number, number][];
  primaryColor: string;
  mutedColor: string;
}) {
  const markerPositions = points.map((p) => [p.lat, p.lon] as [number, number]);
  const center: [number, number] =
    polylinePath.length > 0 ? polylinePath[0] : markerPositions[0] ?? [51.1657, 10.4515];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={polylinePath.length >= 2 ? polylinePath : markerPositions} />
      {polylinePath.length > 1 && (
        <Polyline
          positions={polylinePath}
          pathOptions={{ color: primaryColor, weight: 4, opacity: 0.85 }}
        />
      )}
      {points.map((pt, idx) => {
        let icon: L.DivIcon;
        if (pt.type === "start") {
          icon = startIcon(primaryColor);
        } else if (pt.type === "end") {
          icon = endIcon(mutedColor);
        } else {
          icon = waypointIcon((pt.waypointIndex ?? 0) + 1);
        }
        return <Marker key={idx} position={[pt.lat, pt.lon]} icon={icon} />;
      })}
    </MapContainer>
  );
}

export default function TripRouteMap({
  trip,
  coords,
  path,
}: {
  trip: Trip;
  coords?: DirectCoords;
  path?: { lat: number; lon: number }[];
}) {
  const colors = useColors();
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPath = path && path.length >= 2;

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "leaflet-css";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
    }
  }, []);

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

  // Build the polyline: GPS breadcrumb path when available, else straight line through markers
  const polylinePath: [number, number][] = hasPath
    ? path.map((p) => [p.lat, p.lon])
    : points.map((p) => [p.lat, p.lon]);

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
      <View style={styles.mapWrapper}>
        <LeafletMap
          points={points}
          polylinePath={polylinePath}
          primaryColor={colors.primary}
          mutedColor={colors.mutedForeground}
        />
      </View>

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
  mapWrapper: {
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
