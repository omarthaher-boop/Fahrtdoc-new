import L from "leaflet";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useColors } from "@/hooks/useColors";

interface Props {
  positions: { lat: number; lon: number }[];
  livePos: { lat: number; lon: number } | null;
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
  const s = 18;
  return makeDivIcon(
    `<div style="
      width:${s}px;height:${s}px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 5px rgba(0,0,0,0.35);
    "></div>`,
    s
  );
}

function liveIcon(color: string): L.DivIcon {
  const s = 44;
  return makeDivIcon(
    `<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;">
      <div style="
        position:absolute;
        width:28px;height:28px;border-radius:50%;
        border:2.5px solid ${color};
        animation:fahrtdoc-live-ping 1.8s ease-out infinite;
      "></div>
      <div style="
        width:16px;height:16px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        position:relative;z-index:1;
      "></div>
    </div>`,
    s
  );
}

function FollowPosition({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  const prevRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!pos) return;
    const prev = prevRef.current;
    if (!prev || Math.abs(pos[0] - prev[0]) > 0.0001 || Math.abs(pos[1] - prev[1]) > 0.0001) {
      map.panTo(pos, { animate: true, duration: 0.6 });
      prevRef.current = pos;
    }
  }, [pos, map]);
  return null;
}

export default function ActiveTripMap({ positions, livePos }: Props) {
  const colors = useColors();

  useEffect(() => {
    if (typeof document !== "undefined") {
      const leafletId = "leaflet-css";
      if (!document.getElementById(leafletId)) {
        const link = document.createElement("link");
        link.id = leafletId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const pingId = "fahrtdoc-live-ping-css";
      if (!document.getElementById(pingId)) {
        const style = document.createElement("style");
        style.id = pingId;
        style.textContent = `
          @keyframes fahrtdoc-live-ping {
            0%   { transform: scale(0.2); opacity: 0.8; }
            70%  { transform: scale(2.2); opacity: 0.15; }
            100% { transform: scale(2.6); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  const allPositions = livePos ? [...positions, livePos] : positions;
  const polylinePath: [number, number][] = allPositions.map((p) => [p.lat, p.lon]);

  const currentPos = livePos ?? (positions.length > 0 ? positions[positions.length - 1] : null);
  const currentLatLng: [number, number] | null = currentPos
    ? [currentPos.lat, currentPos.lon]
    : null;

  const center: [number, number] = currentLatLng ?? [51.1657, 10.4515];

  return (
    <View style={styles.container}>
      <MapContainer
        center={center}
        zoom={currentLatLng ? 15 : 6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FollowPosition pos={currentLatLng} />
        {polylinePath.length >= 2 && (
          <Polyline
            positions={polylinePath}
            pathOptions={{ color: colors.primary, weight: 4, opacity: 0.9 }}
          />
        )}
        {positions.length > 0 && (
          <Marker
            position={[positions[0].lat, positions[0].lon]}
            icon={startIcon(colors.primary)}
          />
        )}
        {currentLatLng && (
          <Marker
            position={currentLatLng}
            icon={liveIcon(colors.primary)}
          />
        )}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
});
