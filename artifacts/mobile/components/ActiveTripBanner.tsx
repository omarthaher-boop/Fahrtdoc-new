import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (support@fahrtdoc.de)" } }
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
  const { t } = useLanguage();
  const { activeTrip, paused, elapsed, stopTrip, togglePause, livePos } = useApp();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!activeTrip || paused) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeTrip, paused, pulseAnim]);

  if (!activeTrip) return null;

  const handleStop = () => {
    if (geocoding) return; // Block stop while geocoding to avoid race; user can stop after dialog resolves
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopTrip();
  };

  const handlePausePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (paused) {
      togglePause();
    } else {
      setShowPauseDialog(true);
    }
  };

  const handlePauseWithWaypoint = () => {
    setShowPauseDialog(false);
    setNoteText("");
    setShowNoteInput(true);
  };

  const handleNoteConfirm = async (note: string) => {
    setShowNoteInput(false);
    setGeocoding(true);
    // Capture trip ID before the async gap to detect if trip was stopped while geocoding
    const capturedTripId = activeTrip?.id;
    // Try live position first, then fall back to last recorded position in the trip
    let pos = livePos;
    if (!pos && activeTrip && activeTrip.positions.length > 0) {
      pos = activeTrip.positions[activeTrip.positions.length - 1];
    }
    if (!pos) {
      // No coordinate at all — pause without recording waypoint
      togglePause();
      setGeocoding(false);
      return;
    }
    try {
      let addr = await reverseGeocodeLocal(pos.lat, pos.lon);
      // Stale check: if the trip was stopped while geocoding was in flight, abort
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
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      togglePause(waypoint);
    } catch {
      // Still record waypoint with coords even if geocoding failed
      if (activeTrip?.id === capturedTripId) {
        const waypoint: Waypoint = {
          addr: t("waypoint.addressUnavailable"),
          lat: pos.lat,
          lon: pos.lon,
          timestamp: Date.now(),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
        togglePause(waypoint);
      }
    } finally {
      setGeocoding(false);
    }
  };

  const handlePauseWithoutWaypoint = () => {
    setShowPauseDialog(false);
    togglePause();
  };

  return (
    <>
      <View style={[styles.banner, { backgroundColor: paused ? colors.warningLight ?? "#FFF8E7" : colors.successLight, borderColor: paused ? colors.warning ?? "#FFB703" : colors.success }]}>
        <View style={styles.left}>
          <View style={styles.dotRow}>
            <Animated.View style={[styles.dot, { backgroundColor: paused ? colors.warning ?? "#FFB703" : colors.success, opacity: pulseAnim }]} />
            <Text style={[styles.label, { color: paused ? colors.warning ?? "#FFB703" : colors.successDark ?? "#059669" }]}>
              {paused ? "PAUSIERT" : geocoding ? t("waypoint.locating") : "FAHRT LÄUFT"}
            </Text>
          </View>
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
                {activeTrip.type === "business" ? "Geschäftl." : "Privat"}
              </Text>
            </View>
            {(activeTrip.waypoints?.length ?? 0) > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Feather name="map-pin" size={12} color={colors.primary} />
                  <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>
                    {activeTrip.waypoints!.length}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handlePausePress}
            disabled={geocoding}
            style={[styles.actionBtn, { backgroundColor: paused ? colors.warning ?? "#FFB703" : colors.successLight, borderColor: paused ? colors.warning ?? "#FFB703" : colors.success }]}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={colors.successDark ?? "#059669"} />
            ) : (
              <Feather name={paused ? "play" : "pause"} size={16} color={paused ? "#FFFFFF" : colors.successDark ?? "#059669"} />
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

      <Modal visible={showPauseDialog} transparent animationType="fade" onRequestClose={() => setShowPauseDialog(false)}>
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: colors.card }]}>
            <View style={[styles.dialogIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
              {t("pause.dialog.title")}
            </Text>
            <Text style={[styles.dialogMessage, { color: colors.mutedForeground }]}>
              {t("pause.dialog.message")}
            </Text>
            <TouchableOpacity
              style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={handlePauseWithWaypoint}
            >
              <Feather name="map-pin" size={15} color="#FFF" />
              <Text style={styles.dialogBtnPrimaryText}>{t("pause.withWaypoint")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogBtnSecondary, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={handlePauseWithoutWaypoint}
            >
              <Feather name="pause" size={15} color={colors.foreground} />
              <Text style={[styles.dialogBtnSecondaryText, { color: colors.foreground }]}>{t("pause.withoutWaypoint")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNoteInput} transparent animationType="fade" onRequestClose={() => setShowNoteInput(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.dialogOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: colors.card }]}>
            <View style={[styles.dialogIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="edit-3" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
              {t("waypoint.note.title")}
            </Text>
            <TextInput
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
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={3}
              maxLength={200}
              autoFocus
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={() => handleNoteConfirm(noteText)}
            >
              <Feather name="check" size={15} color="#FFF" />
              <Text style={styles.dialogBtnPrimaryText}>{t("waypoint.note.confirm")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogBtnSecondary, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => handleNoteConfirm("")}
            >
              <Text style={[styles.dialogBtnSecondaryText, { color: colors.mutedForeground }]}>{t("waypoint.note.skip")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowNoteInput(false)}
            >
              <Text style={[styles.dialogCancelText, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
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
  dotRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
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
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialogBox: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  dialogIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dialogTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  dialogMessage: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 4 },
  dialogBtnPrimary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  dialogBtnPrimaryText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  dialogBtnSecondary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  dialogBtnSecondaryText: { fontSize: 14, fontWeight: "600" },
  noteInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: "top",
  },
  dialogCancelText: { fontSize: 13, fontWeight: "500", paddingVertical: 4 },
});
