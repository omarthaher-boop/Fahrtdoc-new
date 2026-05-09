import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
};

export default function ActiveTripBanner() {
  const colors = useColors();
  const { activeTrip, paused, elapsed, stopTrip, togglePause } = useApp();
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopTrip();
  };

  const handlePause = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePause();
  };

  return (
    <View style={[styles.banner, { backgroundColor: paused ? colors.warningLight ?? "#FFF8E7" : colors.successLight, borderColor: paused ? colors.warning ?? "#FFB703" : colors.success }]}>
      <View style={styles.left}>
        <View style={styles.dotRow}>
          <Animated.View style={[styles.dot, { backgroundColor: paused ? colors.warning ?? "#FFB703" : colors.success, opacity: pulseAnim }]} />
          <Text style={[styles.label, { color: paused ? colors.warning ?? "#FFB703" : colors.successDark ?? "#059669" }]}>
            {paused ? "PAUSIERT" : "FAHRT LÄUFT"}
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
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handlePause} style={[styles.actionBtn, { backgroundColor: paused ? colors.warning ?? "#FFB703" : colors.successLight, borderColor: paused ? colors.warning ?? "#FFB703" : colors.success }]}>
          <Feather name={paused ? "play" : "pause"} size={16} color={paused ? "#FFFFFF" : colors.successDark ?? "#059669"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleStop} style={[styles.stopBtn, { backgroundColor: colors.destructive }]}>
          <Feather name="square" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
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
});
