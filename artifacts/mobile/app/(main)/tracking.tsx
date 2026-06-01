import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActiveTripMap from "@/components/ActiveTripMap";
import { useApp, type Waypoint } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { DRIVE_DETECT_TASK } from "@/utils/driveDetect";

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
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (info@centofai.com)" } }
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

export default function TrackingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { activeTrip, paused, elapsed, stopTrip, setActiveTripNote, togglePause, livePos, gpsTracking } = useApp();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [pauseLocation, setPauseLocation] = useState("");
  const [pauseLocationLoading, setPauseLocationLoading] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [driveTaskRunning, setDriveTaskRunning] = useState(true);
  const [tripNote, setTripNote] = useState(activeTrip?.note ?? "");
  const [noteExpanded, setNoteExpanded] = useState(!!(activeTrip?.note));
  const noteInputRef = useRef<TextInput>(null);
  const tripNoteInputRef = useRef<TextInput>(null);

  const refreshDriveTaskStatus = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const Location = await import("expo-location");
      const running = await Location.hasStartedLocationUpdatesAsync(DRIVE_DETECT_TASK);
      setDriveTaskRunning(running);
    } catch {
      setDriveTaskRunning(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    refreshDriveTaskStatus();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshDriveTaskStatus();
    });
    return () => subscription.remove();
  }, [refreshDriveTaskStatus]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (activeTrip && !paused) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => {
      deactivateKeepAwake();
    };
  }, [activeTrip, paused]);

  useEffect(() => {
    if (!activeTrip || paused) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeTrip, paused, pulseAnim]);

  useEffect(() => {
    if (!activeTrip) {
      router.replace("/home");
    }
  }, [activeTrip]);

  if (!activeTrip) return null;

  const warningColor = colors.warning ?? "#D97706";
  const warningLight = colors.warningLight ?? "#FFFBEB";
  const successDark = colors.successDark ?? "#15803D";

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
    setShowPauseSheet(true);

    (async () => {
      let pos = livePos;
      if (!pos && activeTrip.positions.length > 0) {
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
    setShowPauseSheet(false);
    setGeocoding(true);
    const capturedTripId = activeTrip?.id;
    let pos = livePos;
    if (!pos && activeTrip.positions.length > 0) {
      pos = activeTrip.positions[activeTrip.positions.length - 1];
    }
    if (!pos) {
      togglePause();
      setGeocoding(false);
      return;
    }
    try {
      let addr = pauseLocation || (await reverseGeocodeLocal(pos.lat, pos.lon));
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
    setShowPauseSheet(false);
    togglePause();
  };

  const hasPositions = activeTrip.positions.length > 0 || livePos !== null;
  const showMap = gpsTracking && hasPositions;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const tripTypeColor = activeTrip.type === "business" ? colors.primary : colors.success;
  const tripTypeLabel =
    activeTrip.type === "business" ? t("tripType.business") : t("tripType.private");

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.replace("/(main)/home")}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.statusRow}>
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: paused ? warningColor : colors.success,
                  opacity: pulseAnim,
                },
              ]}
            />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {paused ? t("tracking.paused") : t("tracking.screen.title")}
            </Text>
          </View>
          <View style={[styles.typePill, { backgroundColor: tripTypeColor + "18", borderColor: tripTypeColor + "40" }]}>
            <Feather
              name={activeTrip.type === "business" ? "briefcase" : "user"}
              size={11}
              color={tripTypeColor}
            />
            <Text style={[styles.typePillText, { color: tripTypeColor }]}>{tripTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Map area */}
      <View style={styles.mapArea}>
        {showMap ? (
          <ActiveTripMap positions={activeTrip.positions} livePos={livePos} />
        ) : (
          <View style={[styles.mapPlaceholder, { backgroundColor: colors.secondary }]}>
            <View style={[styles.mapPlaceholderIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather
                name={gpsTracking ? "map" : "wifi-off"}
                size={32}
                color={gpsTracking ? colors.mutedForeground : warningColor}
              />
            </View>
            <Text style={[styles.mapPlaceholderTitle, { color: colors.foreground }]}>
              {gpsTracking ? t("tracking.screen.waitingGps") : t("tracking.screen.gpsOff")}
            </Text>
            <Text style={[styles.mapPlaceholderSub, { color: colors.mutedForeground }]}>
              {gpsTracking
                ? t("tracking.screen.waitingGpsSub")
                : t("tracking.screen.gpsOffSub")}
            </Text>
          </View>
        )}
      </View>

      {/* Stats + Controls panel */}
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 24,
          },
        ]}
      >
        {/* Status warnings */}
        {paused && (
          <View style={[styles.warningBanner, { backgroundColor: warningLight, borderColor: warningColor }]}>
            <Feather name="pause-circle" size={14} color={warningColor} />
            <Text style={[styles.warningText, { color: warningColor }]}>
              {t("tracking.screen.pausedNote")}
            </Text>
          </View>
        )}
        {!gpsTracking && !paused && (
          <View style={[styles.warningBanner, { backgroundColor: warningLight, borderColor: warningColor }]}>
            <Feather name="wifi-off" size={14} color={warningColor} />
            <Text style={[styles.warningText, { color: warningColor }]}>
              {t("tracking.gpsOff")}
            </Text>
          </View>
        )}
        {!driveTaskRunning && Platform.OS !== "web" && (
          <View style={[styles.warningBanner, { backgroundColor: warningLight, borderColor: warningColor }]}>
            <Feather name="alert-triangle" size={14} color={warningColor} />
            <Text style={[styles.warningText, { color: warningColor }]}>
              {t("tracking.driveDetectStopped")}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {fmtTime(elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("tracking.screen.elapsed")}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {activeTrip.distance.toFixed(1)}
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> km</Text>
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("tracking.screen.distance")}
            </Text>
          </View>

          {(activeTrip.waypoints?.length ?? 0) > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBlock}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {activeTrip.waypoints!.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {t("tracking.screen.waypoints")}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Start address */}
        {activeTrip.startAddr ? (
          <View style={styles.startAddrRow}>
            <Feather name="navigation" size={12} color={colors.mutedForeground} />
            <Text style={[styles.startAddrText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {t("tracking.screen.from")} {activeTrip.startAddr}
            </Text>
          </View>
        ) : null}

        {/* Trip note */}
        {noteExpanded ? (
          <View style={[styles.tripNoteRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="edit-3" size={13} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <TextInput
              ref={tripNoteInputRef}
              style={[styles.tripNoteInput, { color: colors.foreground }]}
              placeholder={t("tracking.screen.notePlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={tripNote}
              onChangeText={(text) => {
                setTripNote(text);
                setActiveTripNote(text);
              }}
              multiline
              maxLength={300}
              returnKeyType="done"
              blurOnSubmit
            />
            {tripNote.length === 0 && (
              <TouchableOpacity
                onPress={() => setNoteExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addNoteBtn}
            onPress={() => {
              setNoteExpanded(true);
              setTimeout(() => tripNoteInputRef.current?.focus(), 50);
            }}
          >
            <Feather name="edit-3" size={12} color={colors.mutedForeground} />
            <Text style={[styles.addNoteBtnText, { color: colors.mutedForeground }]}>
              {t("tracking.screen.addNote")}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.pauseBtn,
              paused
                ? { backgroundColor: warningColor, borderColor: warningColor }
                : { backgroundColor: colors.successLight, borderColor: colors.success, borderWidth: 1.5 },
            ]}
            onPress={handlePausePress}
            disabled={geocoding}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={successDark} />
            ) : (
              <Feather
                name={paused ? "play" : "pause"}
                size={20}
                color={paused ? "#FFFFFF" : successDark}
              />
            )}
            <Text
              style={[
                styles.pauseBtnText,
                { color: paused ? "#FFFFFF" : successDark },
              ]}
            >
              {paused ? t("tracking.screen.resume") : t("tracking.screen.pause")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.stopBtn,
              { backgroundColor: geocoding ? colors.mutedForeground : colors.destructive },
            ]}
            onPress={handleStop}
            disabled={geocoding}
          >
            <Feather name="square" size={20} color="#FFFFFF" />
            <Text style={styles.stopBtnText}>{t("tracking.screen.stop")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pause / Waypoint sheet */}
      <Modal
        visible={showPauseSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPauseSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetOverlay}
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.sheetIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {t("pause.dialog.title")}
            </Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              {t("pause.dialog.message")}
            </Text>

            <View
              style={[
                styles.locationRow,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="navigation" size={13} color={colors.primary} />
              {pauseLocationLoading ? (
                <View style={styles.locationLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.locationLoadingText, { color: colors.mutedForeground }]}>
                    {t("waypoint.locating")}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.locationText, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {pauseLocation || t("waypoint.addressUnavailable")}
                </Text>
              )}
            </View>

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

            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleSaveWaypoint}
            >
              <Feather name="map-pin" size={15} color="#FFF" />
              <Text style={styles.sheetBtnPrimaryText}>{t("pause.withWaypoint")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetBtnSecondary,
                { borderColor: colors.border, backgroundColor: colors.secondary },
              ]}
              onPress={handlePauseOnly}
            >
              <Feather name="pause" size={15} color={colors.foreground} />
              <Text style={[styles.sheetBtnSecondaryText, { color: colors.foreground }]}>
                {t("pause.withoutWaypoint")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typePillText: { fontSize: 11, fontWeight: "600" },
  headerRight: { width: 36 },
  mapArea: { flex: 1 },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  mapPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  mapPlaceholderTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  mapPlaceholderSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningText: { fontSize: 12, fontWeight: "600", flex: 1 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statBlock: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums" as const] },
  statUnit: { fontSize: 14, fontWeight: "500" },
  statLabel: { fontSize: 11, fontWeight: "500" },
  statDivider: { width: 1, height: 40 },
  startAddrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  startAddrText: { fontSize: 12, flex: 1 },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  pauseBtnText: { fontSize: 15, fontWeight: "700" },
  stopBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  stopBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
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
  sheetSub: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 4 },
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
  tripNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tripNoteInput: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 36,
    textAlignVertical: "top",
    paddingTop: 0,
    paddingBottom: 0,
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  addNoteBtnText: { fontSize: 12, fontWeight: "500" },
});
