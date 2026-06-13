import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import type { Waypoint } from "@/context/AppContext";
import { useTripSourcePlatform } from "@/utils/carplayBridge";

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
};

const reverseGeocodeLocal = async (lat: number, lon: number): Promise<string> => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (info@centof.ai)" } }
    );
    clearTimeout(tid);
    const d = await r.json();
    const road = d.address?.road || d.address?.pedestrian || d.address?.path || "";
    const houseNumber = d.address?.house_number || "";
    const postcode = d.address?.postcode || "";
    const city =
      d.address?.city ||
      d.address?.town ||
      d.address?.village ||
      d.address?.suburb ||
      "";
    const street = houseNumber ? `${road} ${houseNumber}`.trim() : road;
    const locality = [postcode, city].filter(Boolean).join(" ");
    return [street, locality].filter(Boolean).join(", ") || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  } catch {
    return "";
  }
};

export default function ActiveTripBanner() {
  const colors = useColors();
  const { t, language } = useLanguage();
  const { activeTrip, paused, elapsed, stopTrip, togglePause, livePos, gpsTracking } = useApp();
  const tripSource = useTripSourcePlatform();
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [showCombinedPauseSheet, setShowCombinedPauseSheet] = useState(false);
  const [pauseLocation, setPauseLocation] = useState("");
  const [pauseLocationLoading, setPauseLocationLoading] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [waypointContentHeight, setWaypointContentHeight] = useState(0);
  const waypointExpandAnim = useRef(new Animated.Value(0)).current;
  const noteInputRef = useRef<TextInput>(null);

  // Auto-expand waypoint list when a new waypoint is added; collapse when trip resets
  useEffect(() => {
    const count = activeTrip?.waypoints?.length ?? 0;
    setShowWaypoints(count > 0);
  }, [activeTrip?.waypoints?.length]);

  // Animate waypoint list open/closed; re-runs if measured height changes while open
  useEffect(() => {
    Animated.timing(waypointExpandAnim, {
      toValue: showWaypoints ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [showWaypoints, waypointExpandAnim]);

  useEffect(() => {
    if (!activeTrip || paused) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeTrip, paused, pulseAnim]);

  if (!activeTrip) return null;

  const handleStop = () => {
    if (geocoding) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopTrip();
  };

  const handlePausePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (paused) {
      togglePause();
      return;
    }
    setPauseNote("");
    setPauseLocation("");
    setPauseLocationLoading(true);
    setShowCombinedPauseSheet(true);

    (async () => {
      let pos = livePos;
      if (!pos && activeTrip && activeTrip.positions.length > 0) {
        pos = activeTrip.positions[activeTrip.positions.length - 1];
      }
      if (pos) {
        try {
          const addr = await reverseGeocodeLocal(pos.lat, pos.lon);
          setPauseLocation(addr || "");
        } catch {
          setPauseLocation("");
        }
      }
      setPauseLocationLoading(false);
    })();
  };

  const handleSaveWaypoint = async () => {
    setShowCombinedPauseSheet(false);
    setGeocoding(true);
    const capturedTripId = activeTrip?.id;
    let pos = livePos;
    if (!pos && activeTrip && activeTrip.positions.length > 0) {
      pos = activeTrip.positions[activeTrip.positions.length - 1];
    }
    if (!pos) {
      togglePause();
      setGeocoding(false);
      return;
    }
    try {
      let addr = pauseLocation || await reverseGeocodeLocal(pos.lat, pos.lon);
      if (activeTrip?.id !== capturedTripId) {
        setGeocoding(false);
        return;
      }
      if (!addr) addr = t("waypoint.addressUnavailable");
      const waypoint: Waypoint = {
        addr,
        lat: pos.lat,
        lon: pos.lon,
        timestamp: Date.now(),
        ...(pauseNote.trim() ? { note: pauseNote.trim() } : {}),
      };
      togglePause(waypoint);
    } catch {
      if (activeTrip?.id === capturedTripId) {
        const waypoint: Waypoint = {
          addr: pauseLocation || t("waypoint.addressUnavailable"),
          lat: pos.lat,
          lon: pos.lon,
          timestamp: Date.now(),
          ...(pauseNote.trim() ? { note: pauseNote.trim() } : {}),
        };
        togglePause(waypoint);
      }
    } finally {
      setGeocoding(false);
    }
  };

  const handlePauseOnly = () => {
    setShowCombinedPauseSheet(false);
    togglePause();
  };

  const categoryLabel =
    activeTrip.type === "business"
      ? t("tripType.business")
      : activeTrip.type === "arbeitsweg"
      ? (language === "de" ? "Arbeitsweg" : "Commute")
      : t("tripType.private");

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push("/(main)/tracking")}
        style={styles.banner}
      >
        {/* LEFT — pulsing navigate icon */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={paused ? "pause-circle" : "navigate"}
              size={20}
              color="#4ade80"
            />
          </View>
        </Animated.View>

        {/* MIDDLE — title + subtitle */}
        <View style={styles.middle}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText} numberOfLines={1}>
              {paused ? t("tracking.paused") : `Fahrt läuft · ${categoryLabel}`}
            </Text>
            {tripSource !== null && (
              <View style={styles.carplayBadge}>
                <Feather
                  name={tripSource === "androidAuto" ? "smartphone" : "monitor"}
                  size={9}
                  color="#FFFFFF"
                />
              </View>
            )}
          </View>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {geocoding ? t("waypoint.locating") : `${fmtTime(elapsed)} · unterwegs`}
          </Text>
          {!gpsTracking && (
            <View style={styles.gpsOffRow}>
              <Feather name="wifi-off" size={10} color="#fbbf24" />
              <Text style={styles.gpsOffText}>{t("tracking.gpsOff")}</Text>
            </View>
          )}
        </View>

        {/* RIGHT — km + action buttons */}
        <View style={styles.rightCol}>
          <Text style={styles.kmText}>{activeTrip.distance.toFixed(1)} km</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handlePausePress}
              disabled={geocoding}
              style={styles.pauseBtn}
            >
              {geocoding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={paused ? "play" : "pause"} size={14} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStop}
              disabled={geocoding}
              style={[styles.stopBtn, { backgroundColor: geocoding ? "rgba(255,255,255,0.2)" : "#e74c3c" }]}
            >
              <Ionicons name="stop" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Waypoints expandable list — rendered outside main banner row */}
      {(activeTrip.waypoints?.length ?? 0) > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setShowWaypoints((v) => !v)}
            style={styles.waypointToggle}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.waypointToggleText}>
              {activeTrip.waypoints!.length} {activeTrip.waypoints!.length === 1 ? "Stopp" : "Stopps"}
            </Text>
            <Feather
              name={showWaypoints ? "chevron-up" : "chevron-down"}
              size={11}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.waypointList,
              {
                height: waypointExpandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, waypointContentHeight > 0 ? waypointContentHeight : 1],
                }),
                opacity: waypointExpandAnim,
                overflow: "hidden",
              },
            ]}
          >
            <View onLayout={(e) => setWaypointContentHeight(e.nativeEvent.layout.height)}>
              {activeTrip.waypoints!.map((wp, i) => (
                <View
                  key={wp.timestamp}
                  style={[
                    styles.waypointItem,
                    i < activeTrip.waypoints!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
                  ]}
                >
                  <View style={styles.waypointBullet}>
                    <Text style={styles.waypointBulletText}>{i + 1}</Text>
                  </View>
                  <View style={styles.waypointContent}>
                    <Text style={styles.waypointAddr} numberOfLines={1}>{wp.addr}</Text>
                    {wp.note ? (
                      <View style={styles.waypointNoteRow}>
                        <Feather name="edit-2" size={10} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.waypointNote} numberOfLines={1}>{wp.note}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        </>
      )}

      {/* Combined Pause Bottom Sheet */}
      <Modal
        visible={showCombinedPauseSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCombinedPauseSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetOverlay}
        >
          <View style={[styles.combinedSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.sheetIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {t("pause.dialog.title")}
            </Text>
            <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
              {t("pause.dialog.message")}
            </Text>

            {/* Location chip */}
            <View style={[styles.locationRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="navigation" size={13} color={colors.primary} />
              {pauseLocationLoading ? (
                <View style={styles.locationLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.locationLoadingText, { color: colors.mutedForeground }]}>
                    {t("waypoint.locating")}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={2}>
                  {pauseLocation || t("waypoint.addressUnavailable")}
                </Text>
              )}
            </View>

            {/* Note input */}
            <TextInput
              ref={noteInputRef}
              style={[
                styles.noteInput,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder={t("waypoint.note.placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={pauseNote}
              onChangeText={setPauseNote}
              multiline
              numberOfLines={3}
              maxLength={200}
              returnKeyType="done"
              blurOnSubmit
            />

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleSaveWaypoint}
            >
              <Feather name="map-pin" size={15} color="#FFF" />
              <Text style={styles.sheetBtnPrimaryText}>{t("pause.withWaypoint")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtnSecondary, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={handlePauseOnly}
            >
              <Feather name="pause" size={15} color={colors.foreground} />
              <Text style={[styles.sheetBtnSecondaryText, { color: colors.foreground }]}>{t("pause.withoutWaypoint")}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Navy banner ────────────────────────────────────────────────────────────
  banner: {
    backgroundColor: "#1a2b6b",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  titleText: { fontSize: 14, fontWeight: "500", color: "#fff", flexShrink: 1 },
  subtitleText: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontVariant: ["tabular-nums" as const] },
  rightCol: { alignItems: "flex-end", gap: 6 },
  kmText: { fontSize: 13, fontWeight: "500", color: "#4ade80", textAlign: "right" },
  actionRow: { flexDirection: "row", gap: 8 },
  pauseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  combinedSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: "center",
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  sheetSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 4 },
  locationRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  locationLoading: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  locationLoadingText: { fontSize: 13, flex: 1 },
  locationText: { fontSize: 13, flex: 1, lineHeight: 18 },
  noteInput: {
    alignSelf: "stretch",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: "top",
  },
  sheetBtnPrimary: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  sheetBtnPrimaryText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  sheetBtnSecondary: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  sheetBtnSecondaryText: { fontSize: 14, fontWeight: "600" },
  // ── GPS warning (inside dark banner) ──────────────────────────────────────
  gpsOffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  gpsOffText: { fontSize: 11, fontWeight: "600", color: "#fbbf24", flexShrink: 1 },
  // ── CarPlay badge ──────────────────────────────────────────────────────────
  carplayBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
  },
  // ── Waypoint toggle row ────────────────────────────────────────────────────
  waypointToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 2,
  },
  waypointToggleText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  // ── Waypoint list ──────────────────────────────────────────────────────────
  waypointList: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 8,
  },
  waypointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  waypointBullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  waypointBulletText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  waypointContent: { flex: 1, gap: 2 },
  waypointAddr: { fontSize: 12, fontWeight: "600", lineHeight: 16, color: "rgba(255,255,255,0.85)" },
  waypointNoteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  waypointNote: { fontSize: 11, flex: 1, lineHeight: 15, color: "rgba(255,255,255,0.5)" },
});
