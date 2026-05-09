import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trip } from "@/context/AppContext";

interface Props {
  trip: Trip;
  onDelete?: (id: string) => void;
}

const fmtDur = (s: number) => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function TripCard({ trip, onDelete }: Props) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isBusiness = trip.type === "business";
  const accentColor = isBusiness ? colors.primary : colors.success;
  const accentBg = isBusiness ? colors.accent : colors.successLight;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleDelete = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.(trip.id);
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accentBg }]}>
          <Feather name={isBusiness ? "briefcase" : "user"} size={18} color={accentColor} />
        </View>

        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={[styles.type, { color: accentColor }]}>
              {isBusiness ? "Geschäftlich" : "Privat"}
            </Text>
            <View style={[styles.badge, { backgroundColor: accentBg }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>
                {trip.km.toFixed(1)} km
              </Text>
            </View>
          </View>

          <View style={styles.addrRow}>
            <Feather name="circle" size={8} color={colors.mutedForeground} />
            <Text style={[styles.addr, { color: colors.sub }]} numberOfLines={1}>
              {trip.startAddr}
            </Text>
          </View>
          <View style={[styles.addrRow, { marginTop: 2 }]}>
            <Feather name="map-pin" size={8} color={colors.primary} />
            <Text style={[styles.addr, { color: colors.sub }]} numberOfLines={1}>
              {trip.endAddr}
            </Text>
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {fmtDate(trip.date)} · {fmtTime(trip.date)}
            </Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {fmtDur(trip.dur)}
            </Text>
          </View>
        </View>

        {onDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} testID={`delete-${trip.id}`}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  type: {
    fontSize: 13,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  addr: {
    fontSize: 12,
    flex: 1,
  },
  meta: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 6,
    marginTop: -2,
  },
});
