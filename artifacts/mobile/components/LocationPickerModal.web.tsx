import { Feather } from "@expo/vector-icons";
import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

interface Coord {
  lat: number;
  lon: number;
}

async function geocodeAddress(addr: string): Promise<Coord | null> {
  if (!addr.trim()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(addr)}&format=json&limit=5`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "de", "User-Agent": "DriveLog/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "de", "User-Agent": "DriveLog/1.0" },
    });
    if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

function makePinIcon(color: string): L.DivIcon {
  const s = 32;
  const html = `<div style="
    width:${s}px;height:${s}px;
    display:flex;align-items:center;justify-content:center;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  ">
    <svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="13" r="9" fill="${color}" />
      <circle cx="16" cy="13" r="5" fill="white" />
      <path d="M16 22 L16 30" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    </svg>
  </div>`;
  return L.divIcon({ html, iconSize: [s, s], iconAnchor: [s / 2, s - 2], className: "" });
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ coord }: { coord: Coord | null }) {
  const map = useMap();
  const prevCoord = useRef<Coord | null>(null);

  useEffect(() => {
    if (!coord) return;
    if (
      prevCoord.current?.lat === coord.lat &&
      prevCoord.current?.lon === coord.lon
    )
      return;
    prevCoord.current = coord;
    map.setView([coord.lat, coord.lon], Math.max(map.getZoom(), 14));
  }, [coord, map]);

  return null;
}

interface Props {
  visible: boolean;
  initialAddress?: string;
  initialCoord?: Coord;
  label: string;
  onConfirm: (coord: Coord) => void;
  onClose: () => void;
}

export default function LocationPickerModal({
  visible,
  initialAddress,
  initialCoord,
  label,
  onConfirm,
  onClose,
}: Props) {
  const colors = useColors();
  const { t } = useLanguage();

  const [coord, setCoord] = useState<Coord | null>(initialCoord ?? null);
  const [searchText, setSearchText] = useState(initialAddress ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCoord(initialCoord ?? null);
    setSearchText(initialAddress ?? "");
    setSearchError(false);
    setAddressLabel(null);

    if (typeof document !== "undefined") {
      const id = "leaflet-css";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      setLeafletReady(true);
    }

    if (!initialCoord && initialAddress) {
      setSearching(true);
      geocodeAddress(initialAddress).then((c) => {
        if (c) {
          setCoord(c);
          setAddressLabel(initialAddress);
        }
        setSearching(false);
      });
    } else if (initialCoord) {
      reverseGeocode(initialCoord.lat, initialCoord.lon).then((addr) => {
        setAddressLabel(addr);
      });
    }
  }, [visible]);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchError(false);
    const result = await geocodeAddress(searchText);
    setSearching(false);
    if (!result) {
      setSearchError(true);
      return;
    }
    setCoord(result);
    setAddressLabel(searchText.trim());
  };

  const handleMapClick = async (lat: number, lon: number) => {
    const newCoord = { lat, lon };
    setCoord(newCoord);
    setAddressLabel(null);
    const addr = await reverseGeocode(lat, lon);
    setAddressLabel(addr);
  };

  const handleDragEnd = async (e: L.DragEndEvent) => {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    const newCoord = { lat, lon: lng };
    setCoord(newCoord);
    setAddressLabel(null);
    const addr = await reverseGeocode(lat, lng);
    setAddressLabel(addr);
  };

  const defaultCenter: [number, number] = coord
    ? [coord.lat, coord.lon]
    : [51.1657, 10.4515];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>{label}</Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
            onPress={onClose}
          >
            <Feather name="x" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("pin.hint")}
        </Text>

        <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={searchText}
            onChangeText={(v) => {
              setSearchText(v);
              setSearchError(false);
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholder={t("pin.searchPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <TouchableOpacity onPress={handleSearch}>
              <Feather name="arrow-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {searchError && (
          <Text style={[styles.searchError, { color: colors.destructive ?? "#EF4444" }]}>
            {t("pin.searchError")}
          </Text>
        )}

        <View style={[styles.mapBox, { borderColor: colors.border }]}>
          {leafletReady && (
            <MapContainer
              center={defaultCenter}
              zoom={coord ? 14 : 6}
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
              zoomControl
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} />
              <RecenterMap coord={coord} />
              {coord && (
                <Marker
                  position={[coord.lat, coord.lon]}
                  icon={makePinIcon(colors.primary)}
                  draggable
                  eventHandlers={{ dragend: handleDragEnd }}
                />
              )}
            </MapContainer>
          )}
        </View>

        {coord && (
          <View style={[styles.coordRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text
              style={[styles.coordText, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {addressLabel ?? `${coord.lat.toFixed(5)}, ${coord.lon.toFixed(5)}`}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: coord ? colors.primary : colors.secondary },
            ]}
            onPress={() => {
              if (coord) {
                onConfirm(coord);
                onClose();
              }
            }}
            disabled={!coord}
          >
            <Feather name="check" size={16} color={coord ? "#FFF" : colors.mutedForeground} />
            <Text
              style={[
                styles.confirmBtnText,
                { color: coord ? "#FFF" : colors.mutedForeground },
              ]}
            >
              {t("pin.confirm")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchError: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
    marginLeft: 4,
  },
  mapBox: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 10,
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  coordText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700" },
});
