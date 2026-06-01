import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Svg, { Circle, Polyline, Rect } from "react-native-svg";
import { Trip } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface RawPoint {
  lat: number;
  lon: number;
  type: "start" | "waypoint" | "end";
}

interface NormalizedPoint extends RawPoint {
  x: number;
  y: number;
}

const SVG_W = 320;
const SVG_H = 48;
const PAD = 10;

async function geocodeAddress(addr: string): Promise<{ lat: number; lon: number } | null> {
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

function normalizePoints(points: RawPoint[]): NormalizedPoint[] {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latRange = maxLat - minLat || 0.002;
  const lonRange = maxLon - minLon || 0.002;

  const w = SVG_W - PAD * 2;
  const h = SVG_H - PAD * 2;

  return points.map((p) => ({
    ...p,
    x: PAD + ((p.lon - minLon) / lonRange) * w,
    y: PAD + ((maxLat - p.lat) / latRange) * h,
  }));
}

export default function TripRouteThumbnail({
  trip,
  expanded,
}: {
  trip: Trip;
  expanded: boolean;
}) {
  const colors = useColors();
  const cancelledRef = useRef(false);

  const waypointsSerialized = JSON.stringify(
    (trip.waypoints ?? []).map((wp) => ({ lat: wp.lat, lon: wp.lon }))
  );

  const storedPoints = useMemo<RawPoint[]>(() => {
    const pts: RawPoint[] = [];
    if (trip.startLat != null && trip.startLon != null) {
      pts.push({ lat: trip.startLat, lon: trip.startLon, type: "start" });
    }
    for (const wp of trip.waypoints ?? []) {
      if (wp.lat != null && wp.lon != null) {
        pts.push({ lat: wp.lat, lon: wp.lon, type: "waypoint" });
      }
    }
    if (trip.endLat != null && trip.endLon != null) {
      pts.push({ lat: trip.endLat, lon: trip.endLon, type: "end" });
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.startLat, trip.startLon, trip.endLat, trip.endLon, waypointsSerialized]);

  const needsGeocoding =
    storedPoints.length < 2 &&
    (!!trip.startAddr || !!trip.endAddr);

  const [resolvedPoints, setResolvedPoints] = useState<RawPoint[] | null>(
    storedPoints.length >= 2 ? storedPoints : null
  );
  const [geocoding, setGeocoding] = useState(needsGeocoding);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (storedPoints.length >= 2) {
      setResolvedPoints(storedPoints);
      setGeocoding(false);
      setFailed(false);
      return;
    }

    if (!trip.startAddr && !trip.endAddr) {
      setResolvedPoints(null);
      setGeocoding(false);
      setFailed(true);
      return;
    }

    let active = true;
    setGeocoding(true);
    setFailed(false);

    (async () => {
      const storedStart =
        trip.startLat != null && trip.startLon != null
          ? { lat: trip.startLat, lon: trip.startLon }
          : null;
      const storedEnd =
        trip.endLat != null && trip.endLon != null
          ? { lat: trip.endLat, lon: trip.endLon }
          : null;

      const [startCoord, endCoord] = await Promise.all([
        storedStart ? Promise.resolve(storedStart) : geocodeAddress(trip.startAddr),
        storedEnd ? Promise.resolve(storedEnd) : geocodeAddress(trip.endAddr),
      ]);

      if (!active || cancelledRef.current) return;

      const pts: RawPoint[] = [];
      if (startCoord) pts.push({ ...startCoord, type: "start" });

      for (const wp of trip.waypoints ?? []) {
        if (wp.lat != null && wp.lon != null) {
          pts.push({ lat: wp.lat, lon: wp.lon, type: "waypoint" });
        }
      }

      if (endCoord) pts.push({ ...endCoord, type: "end" });

      if (pts.length < 2) {
        setResolvedPoints(null);
        setFailed(true);
      } else {
        setResolvedPoints(pts);
        setFailed(false);
      }
      setGeocoding(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trip.id,
    trip.startAddr,
    trip.endAddr,
    trip.startLat,
    trip.startLon,
    trip.endLat,
    trip.endLon,
    waypointsSerialized,
  ]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  if (geocoding) {
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.65 }] }} />
      </View>
    );
  }

  if (failed || !resolvedPoints || resolvedPoints.length < 2) {
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <Feather name="map" size={12} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
      </View>
    );
  }

  const normalized = normalizePoints(resolvedPoints);
  const polylinePoints = normalized.map((p) => `${p.x},${p.y}`).join(" ");
  const startPt = normalized[0];
  const endPt = normalized[normalized.length - 1];
  const waypts = normalized.slice(1, -1).filter((p) => p.type === "waypoint");

  return (
    <View
      style={[
        styles.strip,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
      ]}
    >
      <Svg
        width="100%"
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeOpacity={0.65}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {waypts.map((wp, i) => (
          <Rect
            key={i}
            x={wp.x - 3.5}
            y={wp.y - 3.5}
            width={7}
            height={7}
            fill="#F59E0B"
            rx={1}
            rotation={45}
            origin={`${wp.x}, ${wp.y}`}
          />
        ))}
        <Circle cx={startPt.x} cy={startPt.y} r={5} fill={colors.primary} />
        <Circle
          cx={endPt.x}
          cy={endPt.y}
          r={4}
          fill={colors.secondary}
          stroke={colors.mutedForeground}
          strokeWidth={2}
        />
      </Svg>

      <View
        style={[
          styles.chevronBadge,
          { backgroundColor: colors.card + "D0" },
        ]}
      >
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={10}
          color={colors.mutedForeground}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: SVG_H,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronBadge: {
    position: "absolute",
    right: 6,
    bottom: 5,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
