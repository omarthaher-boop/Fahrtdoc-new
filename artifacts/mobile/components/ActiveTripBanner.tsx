import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import type { Waypoint } from "@/context/AppContext";
import {
  DRIVE_DETECT_TASK,
  recordDriveDetectStopped,
  clearDriveDetectStopped,
  checkAndSendDriveDetectStoppedNotif,
} from "@/utils/driveDetect";
import { useCarPlayStarted } from "@/utils/carplayBridge";

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

export default function ActiveTripBanner() {
  const colors = useColors();
  const { t, language } = useLanguage();
  const { activeTrip, paused, elapsed, stopTrip, togglePause, livePos, gpsTracking } = useApp();
  const carplayStarted = useCarPlayStarted();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [showCombinedPauseSheet, setShowCombinedPauseSheet] = useState(false);
  const [pauseLocation, setPauseLocation] = useState("");
  const [pauseLocationLoading, setPauseLocationLoading] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [driveTaskRunning, setDriveTaskRunning] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const noteInputRef = useRef<TextInput>(null);

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

  const handleRestartDetect = useCallback(async () => {
    if (Platform.OS === "web" || restarting) return;
    setRestarting(true);
    try {
      const Location = await import("expo-location");
      const isRunning = await Location.hasStartedLocationUpdatesAsync(DRIVE_DETECT_TASK);
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(DRIVE_DETECT_TASK, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 200,
          timeInterval: 60000,
          activityType: Location.ActivityType.OtherNavigation,
          showsBackgroundLocationIndicator: false,
          ...(Platform.OS === "android" && {
            foregroundService: {
              notificationTitle: "FahrtDoc",
              notificationBody: language === "de" ? "Fahrt-Erkennung aktiv" : "Drive detection active",
              notificationColor: "#2563EB",
            },
          }),
        });
      }
      setDriveTaskRunning(true);
    } catch {
      // Non-fatal — status remains false, banner stays visible
    } finally {
      setRestarting(false);
    }
  }, [restarting, language]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    refreshDriveTaskStatus();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshDriveTaskStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshDriveTaskStatus]);

  useEffect(() => {
    if (Platform.OS === "web" || !activeTrip) return;
    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        refreshDriveTaskStatus();
      }
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [activeTrip, refreshDriveTaskStatus]);

  // Track how long drive detection has been stopped and fire a notification
  // after 2 minutes so the user cannot silently miss missed trips.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!driveTaskRunning) {
      recordDriveDetectStopped();
      checkAndSendDriveDetectStoppedNotif(language);
    } else {
      clearDriveDetectStopped();
    }
  }, [driveTaskRunning, language]);

  // Auto-expand waypoint list when a new waypoint is added; collapse when trip resets
  useEffect(() => {
    const count = activeTrip?.waypoints?.length ?? 0;
    setShowWaypoints(count > 0);
  }, [activeTrip?.waypoints?.length]);

  useEffect(() => {
    if (!activeTrip || paused) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: Platform.OS !== "web" }),
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

  const warningColor = colors.warning ?? "#FFB703";
  const warningLight = colors.warningLight ?? "#FFF8E7";
  const successDark = colors.successDark ?? "#059669";

  return (
    <>
      <View style={[styles.banner, { backgroundColor: paused ? warningLight : colors.successLight, borderColor: paused ? warningColor : colors.success }]}>
        <View style={styles.left}>
          <View style={styles.dotRow}>
            <Animated.View style={[styles.dot, { backgroundColor: paused ? warningColor : colors.success, opacity: pulseAnim }]} />
            <Text style={[styles.label, { color: paused ? warningColor : successDark }]}>
              {paused ? t("tracking.paused") : geocoding ? t("waypoint.locating") : t("tracking.active")}
            </Text>
            {paused && (
              <View style={[styles.pausedBadge, { backgroundColor: warningColor }]}>
                <Feather name="pause" size={10} color="#FFFFFF" />
                <Text style={styles.pausedBadgeText}>{t("tracking.paused")}</Text>
              </View>
            )}
            {carplayStarted && (
              <View style={styles.carplayBadge}>
                <Feather
                  name={Platform.OS === "android" ? "smartphone" : "monitor"}
                  size={10}
                  color="#FFFFFF"
                />
                <Text style={styles.carplayBadgeText}>
                  {Platform.OS === "android"
                    ? t("tracking.androidAutoSource")
                    : t("tracking.carplaySource")}
                </Text>
              </View>
            )}
          </View>

          {!gpsTracking && (
            <View style={[styles.gpsOffRow, { backgroundColor: warningLight, borderColor: warningColor }]}>
              <Feather name="wifi-off" size={12} color={warningColor} />
              <Text style={[styles.gpsOffText, { color: warningColor }]}>{t("tracking.gpsOff")}</Text>
            </View>
          )}

          {!driveTaskRunning && Platform.OS !== "web" && (
            <View style={[styles.gpsOffRow, { backgroundColor: warningLight, borderColor: warningColor }]}>
              <Feather name="alert-triangle" size={12} color={warningColor} />
              <Text style={[styles.gpsOffText, { color: warningColor, flex: 1 }]}>{t("tracking.driveDetectStopped")}</Text>
              <TouchableOpacity
                onPress={handleRestartDetect}
                disabled={restarting}
                style={[styles.restartBtn, { backgroundColor: warningColor }]}
              >
                {restarting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.restartBtnText}>{t("tracking.restartDetect")}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}


          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Feather name="navigation" size={12} color={colors.success} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {activeTrip.distance.toFixed(1)}
              </Text>
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Feather name="clock" size={12} color={colors.success} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {fmtTime(elapsed)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Feather name="briefcase" size={12} color={colors.primary} />
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>
                {activeTrip.type === "business" ? t("tripType.business") : t("tripType.private")}
              </Text>
            </View>
            {(activeTrip.waypoints?.length ?? 0) > 0 && (
              <>
                <View style={styles.statDivider} />
                <TouchableOpacity
                  style={styles.stat}
                  onPress={() => setShowWaypoints((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="map-pin" size={12} color={colors.primary} />
                  <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>
                    {activeTrip.waypoints!.length}
                  </Text>
                  {activeTrip.waypoints!.some((wp) => wp.note) && (
                    <Feather name="edit-2" size={10} color={colors.primary} />
                  )}
                  <Feather
                    name={showWaypoints ? "chevron-up" : "chevron-down"}
                    size={10}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>

          {showWaypoints && (activeTrip.waypoints?.length ?? 0) > 0 && (
            <View style={[styles.waypointList, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {activeTrip.waypoints!.map((wp, i) => (
                <View
                  key={wp.timestamp}
                  style={[
                    styles.waypointItem,
                    i < activeTrip.waypoints!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.waypointBullet, { backgroundColor: colors.primary }]}>
                    <Text style={styles.waypointBulletText}>{i + 1}</Text>
                  </View>
                  <View style={styles.waypointContent}>
                    <Text style={[styles.waypointAddr, { color: colors.foreground }]} numberOfLines={1}>
                      {wp.addr}
                    </Text>
                    {wp.note ? (
                      <View style={styles.waypointNoteRow}>
                        <Feather name="edit-2" size={10} color={colors.primary} />
                        <Text style={[styles.waypointNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {wp.note}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handlePausePress}
            disabled={geocoding}
            style={[
              styles.actionBtn,
              paused
                ? { backgroundColor: warningColor, borderColor: warningColor }
                : { backgroundColor: colors.successLight, borderColor: colors.success },
            ]}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={successDark} />
            ) : (
              <Feather name={paused ? "play" : "pause"} size={16} color={paused ? "#FFFFFF" : successDark} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleStop}
            disabled={geocoding}
            style={[styles.stopBtn, { backgroundColor: geocoding ? colors.mutedForeground : colors.destructive }]}
          >
            <Feather name="square" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

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
  banner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  left: { flex: 1, gap: 8 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  pausedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pausedBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  carplayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#6366F1",
  },
  carplayBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  gpsOffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 2,
  },
  gpsOffText: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  restartBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
    minHeight: 26,
  },
  restartBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statNum: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums" as const] },
  statUnit: { fontSize: 11 },
  statDivider: { width: 1, height: 14, backgroundColor: "#E5E9F0" },
  actions: { flexDirection: "row", gap: 8, marginLeft: 12 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
  waypointList: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
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
  },
  waypointBulletText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  waypointContent: { flex: 1, gap: 2 },
  waypointAddr: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  waypointNoteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  waypointNote: { fontSize: 11, flex: 1, lineHeight: 15 },
});
