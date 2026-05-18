import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditTripModal from "@/components/EditTripModal";
import TripCard from "@/components/TripCard";
import TripDetailModal from "@/components/TripDetailModal";
import { useApp, Trip } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { exportPDF, exportCSV } from "@/utils/exportPDF";

const FILTER_STORAGE_KEY = "@drivelog_history_filters";

type PeriodFilter = "all" | 1 | 3 | 6 | 12;
type TypeFilter = "all" | "business" | "private";

const fmtDur = (s: number) => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

function fmtDateLabel(
  iso: string,
  todayLabel: string,
  yesterdayLabel: string,
  locale: string
): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return todayLabel;
  if (sameDay(d, yesterday)) return yesterdayLabel;
  return d.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function groupByDate(
  trips: Trip[],
  todayLabel: string,
  yesterdayLabel: string,
  locale: string
): { label: string; trips: Trip[] }[] {
  const map = new Map<string, Trip[]>();
  for (const t of trips) {
    const label = fmtDateLabel(t.date, todayLabel, yesterdayLabel, locale);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  return Array.from(map.entries()).map(([label, trips]) => ({ label, trips }));
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trips, deleteTrip, editTrip, retryWaypointSync, user } = useApp();
  const { t, language } = useLanguage();

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showDateRange, setShowDateRange] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const skipNextPersistRef = React.useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(FILTER_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (saved.periodFilter !== undefined) setPeriodFilter(saved.periodFilter);
            if (saved.typeFilter !== undefined) setTypeFilter(saved.typeFilter);
            if (saved.dateFrom !== undefined) setDateFrom(saved.dateFrom);
            if (saved.dateTo !== undefined) setDateTo(saved.dateTo);
            if (saved.showDateRange !== undefined) setShowDateRange(saved.showDateRange);
          } catch {}
        }
        setFiltersLoaded(true);
      })
      .catch(() => setFiltersLoaded(true));
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    AsyncStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ periodFilter, typeFilter, dateFrom, dateTo, showDateRange })
    ).catch(() => {});
  }, [filtersLoaded, periodFilter, typeFilter, dateFrom, dateTo, showDateRange]);

  const resetFilters = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    skipNextPersistRef.current = true;
    setPeriodFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setShowDateRange(false);
    AsyncStorage.removeItem(FILTER_STORAGE_KEY).catch(() => {});
  };

  const isFiltersActive =
    periodFilter !== "all" || typeFilter !== "all" || !!dateFrom || !!dateTo;

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const PERIOD_OPTIONS: { label: string; value: PeriodFilter }[] = [
    { label: t("history.all"), value: "all" },
    { label: t("history.lastMonth"), value: 1 },
    { label: t("history.threeMonths"), value: 3 },
    { label: t("history.sixMonths"), value: 6 },
    { label: t("history.thisYear"), value: 12 },
  ];

  const cutoff = useMemo(() => {
    if (periodFilter === "all") return new Date(0);
    const d = new Date();
    if (periodFilter === 12) return new Date(d.getFullYear(), 0, 1);
    d.setMonth(d.getMonth() - periodFilter);
    return d;
  }, [periodFilter]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const d = new Date(t.date);
      if (d < cutoff) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (dateFrom) {
        const [dd, mm, yyyy] = dateFrom.split(".").map(Number);
        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
          const from = new Date(yyyy, mm - 1, dd);
          if (d < from) return false;
        }
      }
      if (dateTo) {
        const [dd, mm, yyyy] = dateTo.split(".").map(Number);
        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
          const to = new Date(yyyy, mm - 1, dd + 1);
          if (d >= to) return false;
        }
      }
      return true;
    });
  }, [trips, cutoff, typeFilter, dateFrom, dateTo]);

  // Which trips the stats card and export act on
  const selectedTrips = useMemo(
    () => filtered.filter((t) => selectedIds.has(t.id)),
    [filtered, selectedIds]
  );
  // In selection mode: use checked trips (even if empty). Outside selection mode: use all filtered trips.
  const displayTrips = selectionMode ? selectedTrips : filtered;

  const statsKm = useMemo(() => displayTrips.reduce((a, b) => a + b.km, 0), [displayTrips]);
  const statsDur = useMemo(() => displayTrips.reduce((a, b) => a + b.dur, 0), [displayTrips]);

  const locale = language === "en" ? "en-US" : "de-DE";
  const groups = useMemo(
    () => groupByDate(filtered, t("history.today"), t("history.yesterday"), locale),
    [filtered, t, locale]
  );

  const isDateRangeActive = !!dateFrom || !!dateTo;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  // --- Selection handlers ---
  const toggleSelectionMode = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setSelectionMode(true);
    }
  };

  const toggleTrip = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  };

  const clearSelection = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedIds(new Set());
  };

  // --- Export handlers ---
  const handleEmailExport = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (selectionMode && selectedIds.size === 0) {
      Alert.alert(t("history.noSelection"), t("history.noSelectionMsg"));
      return;
    }
    const toExport = displayTrips;
    const lines = toExport.map(
      (trip) =>
        `${new Date(trip.date).toLocaleDateString(locale)}  |  ${trip.type === "business" ? t("tripType.business") : t("tripType.private")}  |  ${trip.startAddr} → ${trip.endAddr}  |  ${trip.km.toFixed(1)} km  |  ${fmtDur(trip.dur)}`
    );
    const subject = `FahrtDoc – ${toExport.length} ${t("home.trips")} (${statsKm.toFixed(1)} km)`;
    const body = [
      "FahrtDoc",
      "=".repeat(40),
      `${toExport.length} ${t("home.trips")} · ${statsKm.toFixed(1)} km`,
      "",
      ...lines,
      "-".repeat(90),
      `${statsKm.toFixed(1)} km · ${fmtDur(statsDur)}`,
      "",
      `${new Date().toLocaleDateString(locale)}`,
    ].join("\n");
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(mailto);
  };

  const handleExportPDF = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (selectionMode && selectedIds.size === 0) {
      Alert.alert(t("history.noSelection"), t("history.noSelectionMsg"));
      return;
    }
    await exportPDF(displayTrips, user, dateFrom, dateTo);
  };

  const handleExportCSV = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (selectionMode && selectedIds.size === 0) {
      Alert.alert(t("history.noSelection"), t("history.noSelectionMsg"));
      return;
    }
    await exportCSV(displayTrips);
  };

  const handleView = (trip: Trip) => {
    setViewingTrip(trip);
  };

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip);
  };

  const handleSaveEdit = (id: string, changes: Partial<Trip>) => {
    editTrip(id, changes);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("nav.trips")}</Text>
        {isFiltersActive && (
          <TouchableOpacity onPress={resetFilters} style={[styles.resetBtn, { borderColor: colors.destructive }]}>
            <Feather name="x" size={12} color={colors.destructive} />
            <Text style={[styles.resetBtnText, { color: colors.destructive }]}>{t("history.resetFilter")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Row 1: period */}
      <View style={[styles.filterRow1Wrap, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PERIOD_OPTIONS.map((o) => {
            const active = periodFilter === o.value;
            return (
              <TouchableOpacity
                key={String(o.value)}
                onPress={() => { setPeriodFilter(o.value); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active ? "#1A2B6B" : colors.card,
                    borderColor: active ? "#1A2B6B" : colors.border,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: active ? "#FFFFFF" : colors.mutedForeground }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter Row 2: type + date range + selection toggle */}
      <View style={[styles.filterRow2Wrap, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {/* Date Range */}
          <TouchableOpacity
            onPress={() => { setShowDateRange((p) => !p); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
            style={[
              styles.pill,
              styles.pillWithIcon,
              {
                backgroundColor: (showDateRange || isDateRangeActive) ? colors.accent : colors.card,
                borderColor: (showDateRange || isDateRangeActive) ? colors.primary : colors.border,
              },
            ]}
          >
            <Feather name="calendar" size={13} color={(showDateRange || isDateRangeActive) ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.pillText, { color: (showDateRange || isDateRangeActive) ? colors.primary : colors.mutedForeground }]}>
              {t("history.dateRange")}
            </Text>
          </TouchableOpacity>

          {/* Business / Private */}
          {(["business", "private"] as const).map((tripType) => {
            const active = typeFilter === tripType;
            return (
              <TouchableOpacity
                key={tripType}
                onPress={() => { setTypeFilter(typeFilter === tripType ? "all" : tripType); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
                style={[
                  styles.pill,
                  styles.pillWithIcon,
                  {
                    backgroundColor: active ? colors.accent : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather
                  name={tripType === "business" ? "briefcase" : "user"}
                  size={13}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.pillText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {tripType === "business" ? t("tripType.business") : t("tripType.private")}
                </Text>
              </TouchableOpacity>
            );
          })}

        </ScrollView>
      </View>

      {/* Date range picker */}
      {showDateRange && (
        <View style={[styles.dateRangePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dateRangeRow}>
            <View style={styles.dateField}>
              <Text style={[styles.dateFieldLabel, { color: colors.mutedForeground }]}>{t("history.from")}</Text>
              <View style={[styles.dateInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.dateInputText, { color: colors.foreground }]}
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder={t("history.datePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={[styles.dateArrow, { backgroundColor: colors.border }]}>
              <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
            </View>
            <View style={styles.dateField}>
              <Text style={[styles.dateFieldLabel, { color: colors.mutedForeground }]}>{t("history.to")}</Text>
              <View style={[styles.dateInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.dateInputText, { color: colors.foreground }]}
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder={t("history.datePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
          {isDateRangeActive && (
            <TouchableOpacity
              onPress={() => { setDateFrom(""); setDateTo(""); }}
              style={[styles.clearDateBtn, { borderColor: colors.destructive }]}
            >
              <Feather name="x" size={12} color={colors.destructive} />
              <Text style={[styles.clearDateText, { color: colors.destructive }]}>{t("history.clearFilter")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Stats summary card */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: selectionMode && selectedIds.size > 0 ? colors.primary : colors.border, marginHorizontal: 16, marginBottom: 8 }]}>
        {/* Row 1: stat items */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="list" size={18} color={colors.primary} />
            <View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{displayTrips.length}</Text>
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>
                {selectionMode && selectedIds.size > 0 ? t("history.selected") : t("home.trips")}
              </Text>
            </View>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Feather name="navigation" size={18} color={colors.primary} />
            <View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{statsKm.toFixed(1)} km</Text>
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>{t("history.totalDistance")}</Text>
            </View>
          </View>
        </View>
        {/* Row 2: export buttons */}
        <View style={[styles.exportRow, { borderTopColor: colors.border }]}>
          <View style={styles.exportBtnWrap}>
            <TouchableOpacity
              onPress={handleExportPDF}
              style={[styles.exportBtn, { borderColor: colors.primary }]}
            >
              <Feather name="file-text" size={13} color={colors.primary} />
              <Text style={[styles.exportBtnText, { color: colors.primary }]}>PDF</Text>
            </TouchableOpacity>
            {selectionMode && selectedIds.size > 0 && (
              <View style={[styles.exportBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.exportBadgeText}>{selectedIds.size}</Text>
              </View>
            )}
          </View>
          <View style={styles.exportBtnWrap}>
            <TouchableOpacity
              onPress={handleExportCSV}
              style={[styles.exportBtn, { borderColor: colors.primary }]}
            >
              <Feather name="grid" size={13} color={colors.primary} />
              <Text style={[styles.exportBtnText, { color: colors.primary }]}>CSV</Text>
            </TouchableOpacity>
            {selectionMode && selectedIds.size > 0 && (
              <View style={[styles.exportBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.exportBadgeText}>{selectedIds.size}</Text>
              </View>
            )}
          </View>
          <View style={styles.exportBtnWrap}>
            <TouchableOpacity
              onPress={handleEmailExport}
              style={[styles.exportBtn, { borderColor: colors.primary }]}
            >
              <Feather name="mail" size={13} color={colors.primary} />
              <Text style={[styles.exportBtnText, { color: colors.primary }]}>E-Mail</Text>
            </TouchableOpacity>
            {selectionMode && selectedIds.size > 0 && (
              <View style={[styles.exportBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.exportBadgeText}>{selectedIds.size}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Selection bar — directly above trip list */}
      <View style={[styles.selectionHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={toggleSelectionMode} style={styles.selectionToggle}>
          <Feather
            name={selectionMode ? "check-square" : "square"}
            size={15}
            color={selectionMode ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.selectionToggleText, { color: selectionMode ? colors.primary : colors.mutedForeground }]}>
            {selectionMode && selectedIds.size > 0
              ? `${selectedIds.size} ${t("history.of")} ${filtered.length} ${t("history.selected")}`
              : t("history.selection")}
          </Text>
        </TouchableOpacity>
        {selectionMode && (
          <View style={styles.selectionQuick}>
            <TouchableOpacity onPress={selectAll} style={[styles.selQuickBtn, { borderColor: colors.primary }]}>
              <Text style={[styles.selQuickText, { color: colors.primary }]}>{t("history.selectAll")}</Text>
            </TouchableOpacity>
            {selectedIds.size > 0 && (
              <TouchableOpacity onPress={clearSelection} style={[styles.selQuickBtn, { borderColor: colors.mutedForeground }]}>
                <Text style={[styles.selQuickText, { color: colors.mutedForeground }]}>{t("history.selectNone")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Trip list grouped by date */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="map" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("history.noTripsTitle")}</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("history.noTripsMsg")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(({ label, trips: groupTrips }) => (
            <View key={label} style={styles.group}>
              {/* Section header */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{label}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.countText, { color: colors.mutedForeground }]}>{groupTrips.length}</Text>
                </View>
              </View>
              {/* Trip cards */}
              {groupTrips.map((tripItem) => (
                <TripCard
                  key={tripItem.id}
                  trip={tripItem}
                  onDelete={deleteTrip}
                  onEdit={handleEdit}
                  onView={handleView}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(tripItem.id)}
                  onToggleSelect={toggleTrip}
                  onRetrySync={retryWaypointSync}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit modal */}
      <EditTripModal
        trip={editingTrip}
        visible={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        onSave={handleSaveEdit}
      />

      {/* Trip detail / route map modal */}
      <TripDetailModal
        trip={viewingTrip}
        visible={viewingTrip !== null}
        onClose={() => setViewingTrip(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resetBtnText: { fontSize: 12, fontWeight: "600" },
  filterRow1Wrap: { paddingBottom: 8 },
  filterRow2Wrap: { paddingBottom: 10 },
  filterRow: {
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dateRangePanel: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  dateField: { flex: 1, gap: 5 },
  dateFieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 7,
  },
  dateInputText: { flex: 1, fontSize: 13 },
  dateArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  clearDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearDateText: { fontSize: 12, fontWeight: "600" },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  selectionToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectionQuick: {
    flexDirection: "row",
    gap: 6,
  },
  selQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  selQuickText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statUnit: { fontSize: 11, fontWeight: "500" },
  statDivider: { width: 1, height: 32, marginHorizontal: 2 },
  exportBtnWrap: {
    position: "relative",
    flex: 1,
    alignItems: "center",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    width: "100%",
  },
  exportBtnText: { fontSize: 13, fontWeight: "700" },
  exportBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  exportBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 12,
  },
  group: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  countBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontWeight: "700" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, textAlign: "center" },
});
