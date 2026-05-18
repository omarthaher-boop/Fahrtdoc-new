import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trip } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  trip: Trip;
  onDelete?: (id: string) => void;
  onEdit?: (trip: Trip) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

const fmtDurMin = (s: number) => {
  const m = Math.round(s / 60);
  if (m <= 0) return null;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}min` : `${m} Min`;
};

export default function TripCard({
  trip,
  onDelete,
  onEdit,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const isBusiness = trip.type === "business";
  const accentColor = isBusiness ? colors.primary : colors.success;
  const accentBg = isBusiness ? "#EEF3FF" : "#ECFDF5";
  const dur = fmtDurMin(trip.dur);

  const handleDelete = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.(trip.id);
  };

  const handleEdit = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onEdit?.(trip);
  };

  const handleCardPress = () => {
    if (!selectionMode) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onToggleSelect?.(trip.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={selectionMode ? 0.75 : 1}
      onPress={handleCardPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? "#EEF3FF" : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <View style={styles.checkboxWrap}>
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: selected ? colors.primary : "transparent",
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            {selected && <Feather name="check" size={11} color="#fff" />}
          </View>
        </View>
      )}

      {/* Left blue accent bar */}
      <View style={[styles.leftBar, { backgroundColor: selected ? colors.primary : colors.primary }]} />

      <View style={styles.inner}>
        {/* Top row: type badge + time + edit + delete */}
        <View style={styles.topRow}>
          <View style={[styles.typeBadge, { backgroundColor: accentBg }]}>
            <Feather
              name={isBusiness ? "briefcase" : "user"}
              size={13}
              color={accentColor}
            />
            <Text style={[styles.typeText, { color: accentColor }]}>
              {isBusiness ? "Geschäftlich" : "Privat"}
            </Text>
          </View>

          <View style={styles.topActions}>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {fmtTime(trip.date)}
            </Text>
            {!selectionMode && (
              <>
                <TouchableOpacity
                  onPress={handleEdit}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  testID={`edit-${trip.id}`}
                >
                  <Feather name="edit-2" size={13} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  testID={`delete-${trip.id}`}
                >
                  <Feather name="trash-2" size={13} color={colors.destructive} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.addrSection}>
          <View style={styles.addrRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.addrText, { color: colors.foreground }]} numberOfLines={1}>
              {trip.startAddr || "Startpunkt unbekannt"}
            </Text>
          </View>
          {(trip.waypoints ?? []).map((wp, idx) => (
            <React.Fragment key={wp.timestamp}>
              <View style={[styles.addrConnector, { borderLeftColor: colors.border }]} />
              <View style={styles.addrRow}>
                <Feather name="map-pin" size={9} color={colors.primary} style={{ flexShrink: 0, opacity: 0.7 }} />
                <Text style={[styles.addrWaypointText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {`${t("waypoint.label")} ${idx + 1}: ${wp.addr}`}
                </Text>
              </View>
            </React.Fragment>
          ))}
          <View style={[styles.addrConnector, { borderLeftColor: colors.border }]} />
          <View style={styles.addrRow}>
            <View style={[styles.dotHollow, { borderColor: colors.mutedForeground }]} />
            <Text style={[styles.addrText, { color: colors.foreground }]} numberOfLines={1}>
              {trip.endAddr || "Zielpunkt unbekannt"}
            </Text>
          </View>
        </View>

        {/* Bottom row: km + duration + edited badge */}
        <View style={styles.bottomRow}>
          <View style={styles.metaLeft}>
            <View style={styles.metaItem}>
              <Feather name="navigation" size={12} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {trip.km.toFixed(1)} km
              </Text>
            </View>
            {dur && (
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {dur}
                </Text>
              </View>
            )}
          </View>
          {trip.edited && (
            <View style={[styles.editedBadge, { backgroundColor: "#FFF8E7", borderColor: "#FFB703" }]}>
              <Feather name="edit" size={11} color="#C98A00" />
              <Text style={[styles.editedText, { color: "#C98A00" }]}>Bearbeitet</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  checkboxWrap: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  leftBar: {
    width: 4,
    flexShrink: 0,
  },
  inner: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums" as const],
    marginRight: 2,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addrSection: {
    gap: 0,
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 3,
  },
  addrConnector: {
    height: 8,
    marginLeft: 5,
    borderLeftWidth: 1.5,
    borderLeftColor: "#E5E9F0",
    borderStyle: "dashed",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  dotHollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    flexShrink: 0,
  },
  addrText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  addrWaypointText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  editedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  editedText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
