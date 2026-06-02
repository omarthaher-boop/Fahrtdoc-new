import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trip, Waypoint } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import TripRouteMap from "@/components/TripRouteMap";
import LocationPickerModal from "@/components/LocationPickerModal";

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

interface Coord {
  lat: number;
  lon: number;
}

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, changes: Partial<Trip>) => void;
}

export default function EditTripModal({ trip, visible, onClose, onSave }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const [type, setType] = useState<"business" | "private">("business");
  const [startAddr, setStartAddr] = useState("");
  const [endAddr, setEndAddr] = useState("");
  const [km, setKm] = useState("");
  const [durMin, setDurMin] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [mapTrip, setMapTrip] = useState<Trip | null>(trip);

  const [pinnedStart, setPinnedStart] = useState<Coord | null>(null);
  const [pinnedEnd, setPinnedEnd] = useState<Coord | null>(null);
  const [pickerFor, setPickerFor] = useState<"start" | "end" | null>(null);

  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    if (trip) {
      setType(trip.type);
      setStartAddr(trip.startAddr);
      setEndAddr(trip.endAddr);
      setKm(trip.km.toFixed(1));
      setDurMin(String(Math.round(trip.dur / 60)));
      setWaypoints(trip.waypoints ? [...trip.waypoints] : []);
      setMapTrip(trip);
      setPinnedStart(
        trip.startLat != null && trip.startLon != null
          ? { lat: trip.startLat, lon: trip.startLon }
          : null
      );
      setPinnedEnd(
        trip.endLat != null && trip.endLon != null
          ? { lat: trip.endLat, lon: trip.endLon }
          : null
      );
    }
  }, [trip]);

  // When the modal opens for a trip that has addresses but no stored coords,
  // geocode them silently so the map shows pins and future opens are instant.
  useEffect(() => {
    if (!trip || !visible) return;
    const needsStart = trip.startLat == null && !!trip.startAddr;
    const needsEnd = trip.endLat == null && !!trip.endAddr;
    if (!needsStart && !needsEnd) return;

    let cancelled = false;

    (async () => {
      const [startCoord, endCoord] = await Promise.all([
        needsStart ? geocodeAddress(trip.startAddr) : Promise.resolve(null),
        needsEnd ? geocodeAddress(trip.endAddr) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const coordChanges: Partial<Trip> = {};

      if (startCoord) {
        setPinnedStart(startCoord);
        setMapTrip((prev) => (prev ? { ...prev, startLat: startCoord.lat, startLon: startCoord.lon } : prev));
        coordChanges.startLat = startCoord.lat;
        coordChanges.startLon = startCoord.lon;
      }
      if (endCoord) {
        setPinnedEnd(endCoord);
        setMapTrip((prev) => (prev ? { ...prev, endLat: endCoord.lat, endLon: endCoord.lon } : prev));
        coordChanges.endLat = endCoord.lat;
        coordChanges.endLon = endCoord.lon;
      }

      if (Object.keys(coordChanges).length > 0) {
        onSaveRef.current(trip.id, coordChanges);
      }
    })();

    return () => { cancelled = true; };
  }, [trip?.id, visible]);

  const syncMapTrip = (overrides: Partial<Trip>) => {
    setMapTrip((prev) => (prev ? { ...prev, ...overrides } : prev));
  };

  const handleWaypointChange = (idx: number, addr: string) => {
    setWaypoints((prev) => prev.map((wp, i) => (i === idx ? { ...wp, addr } : wp)));
  };

  const handleWaypointNoteChange = (idx: number, note: string) => {
    setWaypoints((prev) => prev.map((wp, i) => (i === idx ? { ...wp, note } : wp)));
  };

  const handlePinStart = (coord: Coord) => {
    setPinnedStart(coord);
    syncMapTrip({ startLat: coord.lat, startLon: coord.lon });
  };

  const handlePinEnd = (coord: Coord) => {
    setPinnedEnd(coord);
    syncMapTrip({ endLat: coord.lat, endLon: coord.lon });
  };

  const handleSave = () => {
    if (!trip) return;
    const kmNum = parseFloat(km.replace(",", "."));
    const durNum = parseInt(durMin, 10);
    const resolvedStartAddr = startAddr.trim() || trip.startAddr;
    const resolvedEndAddr = endAddr.trim() || trip.endAddr;

    syncMapTrip({
      startAddr: resolvedStartAddr,
      endAddr: resolvedEndAddr,
      startLat: pinnedStart?.lat,
      startLon: pinnedStart?.lon,
      endLat: pinnedEnd?.lat,
      endLon: pinnedEnd?.lon,
    });

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    onSave(trip.id, {
      type,
      startAddr: resolvedStartAddr,
      endAddr: resolvedEndAddr,
      km: isNaN(kmNum) ? trip.km : kmNum,
      dur: isNaN(durNum) ? trip.dur : durNum * 60,
      edited: true,
      waypoints: waypoints,
      startLat: pinnedStart?.lat,
      startLon: pinnedStart?.lon,
      endLat: pinnedEnd?.lat,
      endLon: pinnedEnd?.lon,
    });
    onClose();
  };

  if (!trip) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheet}
        >
          <View style={[styles.container, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>{t("edit.title")}</Text>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Route map — built from current form state, refreshes on address blur */}
              {mapTrip && (
                <View style={styles.mapWrapper}>
                  <TripRouteMap trip={mapTrip} path={mapTrip.path} hideOnEmpty />
                </View>
              )}

              {/* Type toggle */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("edit.tripPurpose")}</Text>
                <View style={[styles.typeRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.typeBtn, type === "business" && { backgroundColor: colors.primary }]}
                    onPress={() => setType("business")}
                  >
                    <Feather name="briefcase" size={14} color={type === "business" ? "#FFF" : colors.mutedForeground} />
                    <Text style={[styles.typeBtnText, { color: type === "business" ? "#FFF" : colors.mutedForeground }]}>
                      {t("tripType.business")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, type === "private" && { backgroundColor: colors.success }]}
                    onPress={() => setType("private")}
                  >
                    <Feather name="user" size={14} color={type === "private" ? "#FFF" : colors.mutedForeground} />
                    <Text style={[styles.typeBtnText, { color: type === "private" ? "#FFF" : colors.mutedForeground }]}>
                      {t("tripType.private")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start address */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("edit.startAddr")}</Text>
                  {pinnedStart && (
                    <View style={[styles.pinnedBadge, { backgroundColor: colors.primary + "22" }]}>
                      <Feather name="map-pin" size={10} color={colors.primary} />
                      <Text style={[styles.pinnedBadgeText, { color: colors.primary }]}>{t("edit.pinned")}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.addrDot, { backgroundColor: colors.primary }]} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={startAddr}
                    onChangeText={(v) => {
                      setStartAddr(v);
                      setPinnedStart(null);
                      syncMapTrip({ startAddr: v.trim() || trip.startAddr, startLat: undefined, startLon: undefined });
                    }}
                    onBlur={() =>
                      syncMapTrip({
                        startAddr: startAddr.trim() || trip.startAddr,
                        startLat: pinnedStart?.lat,
                        startLon: pinnedStart?.lon,
                      })
                    }
                    placeholder={t("edit.startAddr")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity
                    style={[
                      styles.pinBtn,
                      {
                        backgroundColor: pinnedStart ? colors.primary + "22" : colors.secondary,
                        borderColor: pinnedStart ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPickerFor("start")}
                  >
                    <Feather
                      name="map-pin"
                      size={15}
                      color={pinnedStart ? colors.primary : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Waypoints */}
              {waypoints.map((wp, idx) => (
                <View style={styles.fieldGroup} key={wp.timestamp}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    {`${t("waypoint.label")} ${idx + 1}`}
                  </Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name="map-pin" size={14} color={colors.primary} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={wp.addr}
                      onChangeText={(text) => handleWaypointChange(idx, text)}
                      placeholder={t("edit.addrPlaceholder")}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={[styles.noteRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name="file-text" size={13} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={wp.note ?? ""}
                      onChangeText={(text) => handleWaypointNoteChange(idx, text)}
                      placeholder={t("edit.notePlaceholder")}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>
              ))}

              {/* End address */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("edit.endAddr")}</Text>
                  {pinnedEnd && (
                    <View style={[styles.pinnedBadge, { backgroundColor: colors.primary + "22" }]}>
                      <Feather name="map-pin" size={10} color={colors.primary} />
                      <Text style={[styles.pinnedBadgeText, { color: colors.primary }]}>{t("edit.pinned")}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.addrDotHollow, { borderColor: colors.mutedForeground }]} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={endAddr}
                    onChangeText={(v) => {
                      setEndAddr(v);
                      setPinnedEnd(null);
                      syncMapTrip({ endAddr: v.trim() || trip.endAddr, endLat: undefined, endLon: undefined });
                    }}
                    onBlur={() =>
                      syncMapTrip({
                        endAddr: endAddr.trim() || trip.endAddr,
                        endLat: pinnedEnd?.lat,
                        endLon: pinnedEnd?.lon,
                      })
                    }
                    placeholder={t("edit.endAddr")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity
                    style={[
                      styles.pinBtn,
                      {
                        backgroundColor: pinnedEnd ? colors.primary + "22" : colors.secondary,
                        borderColor: pinnedEnd ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPickerFor("end")}
                  >
                    <Feather
                      name="map-pin"
                      size={15}
                      color={pinnedEnd ? colors.primary : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* km + Duration */}
              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("edit.distanceKm")}</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name="navigation" size={14} color={colors.primary} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={km}
                      onChangeText={setKm}
                      placeholder="0.0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("edit.durationMin")}</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name="clock" size={14} color={colors.primary} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={durMin}
                      onChangeText={setDurMin}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                testID="edit-trip-save"
              >
                <Feather name="check" size={16} color="#FFF" />
                <Text style={styles.saveBtnText}>{t("edit.saveChanges")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location pickers — rendered outside the main modal to avoid z-index issues */}
      <LocationPickerModal
        visible={pickerFor === "start"}
        label={t("edit.pinStart")}
        initialAddress={startAddr || trip.startAddr}
        initialCoord={pinnedStart ?? undefined}
        onConfirm={handlePinStart}
        onClose={() => setPickerFor(null)}
      />
      <LocationPickerModal
        visible={pickerFor === "end"}
        label={t("edit.pinEnd")}
        initialAddress={endAddr || trip.endAddr}
        initialCoord={pinnedEnd ?? undefined}
        onConfirm={handlePinEnd}
        onClose={() => setPickerFor(null)}
      />
    </>
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
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: "90%",
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
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: { marginBottom: 14 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  typeRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14 },
  pinBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addrDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  addrDotHollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    flexShrink: 0,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    marginTop: 6,
  },
  mapWrapper: { marginBottom: 16 },
  twoColRow: { flexDirection: "row", gap: 12 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
