import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
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

const SVG_W = 300;
const SVG_H = 210;
const PAD = 40;

const LABEL_W = 100;
const LABEL_H = 30;
const LABEL_FONT_PRIMARY = 7.5;
const LABEL_FONT_SECONDARY = 6;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function computeBounds(points: Coord[]): Bounds {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

function projectWithBounds<T extends Coord>(
  points: T[],
  bounds: Bounds
): Array<T & { x: number; y: number }> {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const latRange = maxLat - minLat || 0.002;
  const lonRange = maxLon - minLon || 0.002;

  const innerW = SVG_W - PAD * 2;
  const innerH = SVG_H - PAD * 2;

  const latScale = innerH / latRange;
  const lonScale = innerW / lonRange;
  const scale = Math.min(latScale, lonScale);

  const projW = lonRange * scale;
  const projH = latRange * scale;
  const offsetX = PAD + (innerW - projW) / 2;
  const offsetY = PAD + (innerH - projH) / 2;

  return points.map((p) => ({
    ...p,
    x: offsetX + (p.lon - minLon) * scale,
    y: offsetY + (maxLat - p.lat) * scale,
  }));
}

function projectPoints(
  points: MapPoint[]
): Array<MapPoint & { x: number; y: number }> {
  if (points.length === 0) return [];
  const bounds = computeBounds(points);
  return projectWithBounds(points, bounds);
}

interface DirectCoords {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
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
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const waypoints = trip.waypoints ?? [];

      let startCoord: Coord | null;
      let endCoord: Coord | null;

      if (hasPath) {
        // Use first and last GPS breadcrumb points as anchors — no geocoding needed
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
        allPoints.push({
          ...startCoord,
          label: trip.startAddr,
          type: "start",
        });
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
        allPoints.push({
          ...endCoord,
          label: trip.endAddr,
          type: "end",
        });
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
  const START_COLOR = colors.primary;
  const END_COLOR = colors.mutedForeground;

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

  // When a GPS breadcrumb path is available, project everything using a
  // shared bounding box that covers both the path and the marker points.
  // This keeps the markers correctly positioned relative to the polyline.
  let projected: Array<MapPoint & { x: number; y: number }>;
  let pathPolylinePoints: string | null = null;

  if (hasPath) {
    const allCoords: Coord[] = [...path, ...points];
    const bounds = computeBounds(allCoords);
    projected = projectWithBounds(points, bounds);
    const projectedPath = projectWithBounds(path, bounds);
    pathPolylinePoints = projectedPath.map((p) => `${p.x},${p.y}`).join(" ");
  } else {
    projected = projectPoints(points);
  }

  const fallbackPolylinePoints = projected.map((p) => `${p.x},${p.y}`).join(" ");
  const waypointCount = (trip.waypoints ?? []).length;

  return (
    <View
      style={[
        styles.mapContainer,
        { borderColor: colors.border, backgroundColor: "#EFF4FA" },
      ]}
    >
      <Svg
        width="100%"
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Subtle grid */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <React.Fragment key={`grid-${frac}`}>
            <Line
              x1={SVG_W * frac}
              y1={0}
              x2={SVG_W * frac}
              y2={SVG_H}
              stroke="#C8D5E8"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            <Line
              x1={0}
              y1={SVG_H * frac}
              x2={SVG_W}
              y2={SVG_H * frac}
              stroke="#C8D5E8"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
          </React.Fragment>
        ))}

        {/* Route line — actual GPS path when available, straight-line fallback otherwise */}
        {pathPolylinePoints ? (
          <Polyline
            points={pathPolylinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ) : (
          projected.length > 1 && (
            <Polyline
              points={fallbackPolylinePoints}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.75}
            />
          )
        )}

        {/* Markers */}
        {projected.map((pt, idx) => {
          if (pt.type === "start") {
            return (
              <G key={`m-${idx}`}>
                <Circle cx={pt.x} cy={pt.y} r={9} fill={START_COLOR} />
                <Circle cx={pt.x} cy={pt.y} r={3.5} fill="white" />
              </G>
            );
          }

          if (pt.type === "end") {
            return (
              <G key={`m-${idx}`}>
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={9}
                  fill="white"
                  stroke={END_COLOR}
                  strokeWidth={2.5}
                />
                <Circle cx={pt.x} cy={pt.y} r={3.5} fill={END_COLOR} />
              </G>
            );
          }

          if (pt.type === "waypoint") {
            const wpNum = (pt.waypointIndex ?? 0) + 1;
            const s = 7;
            const pinPath = [
              `M ${pt.x} ${pt.y - s * 2}`,
              `L ${pt.x + s} ${pt.y}`,
              `L ${pt.x} ${pt.y + s * 0.5}`,
              `L ${pt.x - s} ${pt.y}`,
              "Z",
            ].join(" ");

            const labelOnRight = pt.x < SVG_W / 2;
            const GAP = 10;
            const labelX = labelOnRight ? pt.x + s + GAP : pt.x - s - GAP - LABEL_W;
            const labelY = pt.y - s * 2 - LABEL_H / 2;
            const clampedLabelY = Math.max(2, Math.min(SVG_H - LABEL_H - 2, labelY));

            const primaryLine = `Zwischenstopp ${wpNum}`;
            const secondaryLine = truncate(pt.label, 18);

            return (
              <G key={`m-${idx}`}>
                <Path d={pinPath} fill={WAYPOINT_COLOR} />
                <SvgText
                  x={pt.x}
                  y={pt.y - s * 0.85}
                  textAnchor="middle"
                  fontSize={7}
                  fontWeight="bold"
                  fill="white"
                >
                  {wpNum}
                </SvgText>

                <Rect
                  x={labelX}
                  y={clampedLabelY}
                  width={LABEL_W}
                  height={LABEL_H}
                  rx={5}
                  ry={5}
                  fill="white"
                  stroke={WAYPOINT_COLOR}
                  strokeWidth={1}
                  opacity={0.95}
                />
                <SvgText
                  x={labelX + 6}
                  y={clampedLabelY + LABEL_FONT_PRIMARY + 3}
                  fontSize={LABEL_FONT_PRIMARY}
                  fontWeight="bold"
                  fill="#92400E"
                >
                  {primaryLine}
                </SvgText>
                {secondaryLine.length > 0 && (
                  <SvgText
                    x={labelX + 6}
                    y={clampedLabelY + LABEL_FONT_PRIMARY + 3 + LABEL_FONT_SECONDARY + 3}
                    fontSize={LABEL_FONT_SECONDARY}
                    fill="#78716C"
                  >
                    {secondaryLine}
                  </SvgText>
                )}
              </G>
            );
          }

          return null;
        })}
      </Svg>

      {/* Legend */}
      <View
        style={[styles.legend, { borderTopColor: colors.border }]}
      >
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: START_COLOR }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            Start
          </Text>
        </View>
        {waypointCount > 0 && (
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: WAYPOINT_COLOR }]}
            />
            <Text
              style={[styles.legendText, { color: colors.mutedForeground }]}
            >
              {waypointCount === 1
                ? "1 Zwischenstopp"
                : `${waypointCount} Zwischenstopps`}
            </Text>
          </View>
        )}
        {hasPath && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              GPS-Spur
            </Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              styles.legendDotHollow,
              { borderColor: END_COLOR },
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
    height: 140,
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
  legendLine: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
