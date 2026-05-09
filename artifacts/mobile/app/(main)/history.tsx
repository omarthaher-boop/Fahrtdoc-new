import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TripCard from "@/components/TripCard";
import { useApp, Trip } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type TypeFilter = "all" | "business" | "private";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trips, deleteTrip } = useApp();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [months, setMonths] = useState<number>(999);

  const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
    { label: "Alle", value: "all" },
    { label: "Geschäftlich", value: "business" },
    { label: "Privat", value: "private" },
  ];
  const MONTH_OPTIONS = [
    { label: "Alle", value: 999 },
    { label: "1 Mon.", value: 1 },
    { label: "3 Mon.", value: 3 },
    { label: "6 Mon.", value: 6 },
    { label: "Dieses Jahr", value: 12 },
  ];

  const cutoff = useMemo(() => {
    if (months === 999) return new Date(0);
    const d = new Date();
    if (months === 12) return new Date(d.getFullYear(), 0, 1);
    d.setMonth(d.getMonth() - months);
    return d;
  }, [months]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      if (new Date(t.date) < cutoff) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      return true;
    });
  }, [trips, cutoff, typeFilter]);

  const totalKm = useMemo(() => filtered.reduce((a, b) => a + b.km, 0), [filtered]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  const renderItem = ({ item }: { item: Trip }) => (
    <TripCard trip={item} onDelete={deleteTrip} />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Fahrtenbuch</Text>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {filtered.length} Fahrten · {totalKm.toFixed(0)} km
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={[styles.filtersWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {TYPE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[
                  styles.pill,
                  {
                    backgroundColor: typeFilter === o.value ? colors.primary : colors.secondary,
                    borderColor: typeFilter === o.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setTypeFilter(o.value)}
              >
                <Text style={[styles.pillText, { color: typeFilter === o.value ? "#FFFFFF" : colors.mutedForeground }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {MONTH_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[
                  styles.pill,
                  {
                    backgroundColor: months === o.value ? colors.success : colors.secondary,
                    borderColor: months === o.value ? colors.success : colors.border,
                  },
                ]}
                onPress={() => setMonths(o.value)}
              >
                <Text style={[styles.pillText, { color: months === o.value ? "#FFFFFF" : colors.mutedForeground }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="map" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Keine Fahrten</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Es gibt keine Fahrten für den gewählten Filter.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: { fontSize: 13, fontWeight: "600" },
  filtersWrap: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  filterScroll: { paddingHorizontal: 16 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  divider: { width: 1, height: 24, marginHorizontal: 4 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
