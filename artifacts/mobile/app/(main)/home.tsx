import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActiveTripBanner from "@/components/ActiveTripBanner";
import EditTripModal from "@/components/EditTripModal";
import SaveTripSheet from "@/components/SaveTripSheet";
import StatCard from "@/components/StatCard";
import TripCard from "@/components/TripCard";
import TripDetailModal from "@/components/TripDetailModal";
import PaywallModal from "@/components/PaywallModal";
import { useApp, Trip, reverseGeocode } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import { DRIVE_DETECT_TASK } from "@/utils/driveDetect";

const fmtDur = (s: number) => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

type Period = 1 | 3 | 6 | 12;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, trips, activeTrip, startTrip, gpsStatus, retryWaypointSync, deleteTrip, editTrip } = useApp();
  const { isSubscribed } = useSubscription();
  const [period, setPeriod] = useState<Period>(3);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [pendingType, setPendingType] = useState<"business" | "private" | null>(null);
  const [starting, setStarting] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
  const [driveTaskRunning, setDriveTaskRunning] = useState(false);
  const [modalStartAddr, setModalStartAddr] = useState("");
  const [modalStartAddrLoading, setModalStartAddrLoading] = useState(false);
  const startAddrInputRef = useRef<TextInput>(null);

  const checkDriveTask = useCallback(async () => {
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
    checkDriveTask();
  }, [checkDriveTask]);

  useFocusEffect(
    useCallback(() => {
      checkDriveTask();
    }, [checkDriveTask])
  );

  const PERIOD_LABELS: Record<Period, string> = {
    1: t("home.period.1"),
    3: t("home.period.3"),
    6: t("home.period.6"),
    12: t("home.period.12"),
  };

  const cutoff = useMemo(() => {
    const d = new Date();
    if (period === 12) return new Date(d.getFullYear(), 0, 1);
    d.setMonth(d.getMonth() - period);
    return d;
  }, [period]);

  const periodTrips = useMemo(
    () => trips.filter((t) => new Date(t.date) >= cutoff),
    [trips, cutoff]
  );

  const totalKm = useMemo(() => periodTrips.reduce((a, b) => a + b.km, 0), [periodTrips]);
  const totalDur = useMemo(() => periodTrips.reduce((a, b) => a + b.dur, 0), [periodTrips]);
  const businessCount = useMemo(() => periodTrips.filter((t) => t.type === "business").length, [periodTrips]);
  const privateCount = useMemo(() => periodTrips.filter((t) => t.type === "private").length, [periodTrips]);
  const businessKm = useMemo(() => periodTrips.filter((t) => t.type === "business").reduce((a, b) => a + b.km, 0), [periodTrips]);

  const openStartModal = (type: "business" | "private") => {
    if (activeTrip) {
      if (Platform.OS === "web") {
        window.alert("Es läuft bereits eine Fahrt!\n\nBitte beende die aktuelle Fahrt, bevor du eine neue startest.");
      } else {
        Alert.alert(
          "Fahrt läuft bereits",
          "Bitte beende die aktuelle Fahrt, bevor du eine neue startest.",
          [{ text: "OK", style: "cancel" }]
        );
      }
      return;
    }
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setPendingType(type);
    setModalStartAddr("");
    setModalStartAddrLoading(true);
    setShowStartModal(true);

    if (Platform.OS === "web") {
      navigator.geolocation?.getCurrentPosition(
        async (pos) => {
          const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setModalStartAddr(addr);
          setModalStartAddrLoading(false);
        },
        () => setModalStartAddrLoading(false),
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
      );
    } else {
      (async () => {
        try {
          const Location = await import("expo-location");
          // Request permission (may already be granted from background tracking)
          await Location.requestForegroundPermissionsAsync();
          // Try last known position first (instant), fall back to fresh fix
          let pos = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 });
          if (!pos) {
            pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          }
          if (pos) {
            const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            setModalStartAddr(addr);
          }
        } catch {
          // user can type manually
        } finally {
          setModalStartAddrLoading(false);
        }
      })();
    }
  };

  const confirmStart = async () => {
    if (!pendingType) return;
    setStarting(true);
    setShowStartModal(false);
    await startTrip(pendingType, modalStartAddr || undefined);
    setStarting(false);
    setPendingType(null);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  const pendingLabel = pendingType === "business" ? t("home.businessTrip") : t("home.privateTrip");

  const handleEdit = (trip: Trip) => setEditingTrip(trip);
  const handleView = (trip: Trip) => setViewingTrip(trip);
  const handleSaveEdit = (id: string, changes: Partial<Trip>) => editTrip(id, changes);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{t("home.greeting")}</Text>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]}>
              {user?.name?.split(" ")[0] ?? t("home.defaultDriver")}
            </Text>
            {driveTaskRunning && (
              <View style={styles.driveActivePill}>
                <View style={styles.driveActiveDot} />
                <Text style={styles.driveActiveText}>Aktiv</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.plateBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="car" size={14} color={colors.primary} />
          <Text style={[styles.plateText, { color: colors.sub }]}>{user?.plate ?? "—"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Active trip */}
        {activeTrip && <ActiveTripBanner />}

        {/* Quick Start */}
        {!activeTrip && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.quickStart")}</Text>
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}
                onPress={() => openStartModal("business")}
                disabled={starting}
                testID="start-business"
              >
                <View style={[styles.quickIcon, { backgroundColor: "#6366F1" }]}>
                  <Feather name="briefcase" size={22} color="#FFFFFF" />
                </View>
                <Text style={[styles.quickLabel, { color: "#312E81" }]}>{t("home.businessTrip")}</Text>
                <Text style={[styles.quickSub, { color: "#6366F1" }]}>{t("home.businessSub")}</Text>
                <Feather name="arrow-right" size={16} color="#6366F1" style={styles.quickArrow} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}
                onPress={() => openStartModal("private")}
                disabled={starting}
                testID="start-private"
              >
                <View style={[styles.quickIcon, { backgroundColor: "#22C55E" }]}>
                  <Feather name="user" size={22} color="#FFFFFF" />
                </View>
                <Text style={[styles.quickLabel, { color: "#14532D" }]}>{t("home.privateTrip")}</Text>
                <Text style={[styles.quickSub, { color: "#16A34A" }]}>{t("home.privateSub")}</Text>
                <Feather name="arrow-right" size={16} color="#16A34A" style={styles.quickArrow} />
              </TouchableOpacity>
            </View>
            {gpsStatus === "denied" && (
              <View style={[styles.gpsBanner, { backgroundColor: colors.warningLight ?? "#FFF8E7", borderColor: colors.warning ?? "#FFB703" }]}>
                <Feather name="alert-circle" size={14} color={colors.warning ?? "#FFB703"} />
                <Text style={[styles.gpsBannerText, { color: colors.warning ?? "#FFB703" }]}>
                  {t("home.gpsBlocked")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Period filter */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.stats")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {([1, 3, 6, 12] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.pill,
                  {
                    backgroundColor: period === p ? colors.primary : colors.secondary,
                    borderColor: period === p ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.pillText, { color: period === p ? "#FFFFFF" : colors.mutedForeground }]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard label={t("home.totalKm")} value={totalKm.toFixed(0)} unit="km" accent={colors.primary} />
            <StatCard label={t("home.trips")} value={String(periodTrips.length)} accent={colors.success} />
          </View>
          <View style={[styles.statsGrid, { marginTop: 10 }]}>
            <StatCard label={t("home.driveDuration")} value={fmtDur(totalDur)} mini accent={colors.primary} />
            <StatCard label={t("home.businessShort")} value={businessCount + " " + t("home.trips")} mini accent={colors.primary} />
            <StatCard label={t("home.privateShort")} value={privateCount + " " + t("home.trips")} mini accent={colors.success} />
          </View>

          {/* Distribution bar */}
          {periodTrips.length > 0 && (
            <View style={[styles.distCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.distLabel, { color: colors.mutedForeground }]}>{t("home.distribution")}</Text>
              <View style={[styles.distBar, { backgroundColor: colors.border }]}>
                {businessCount > 0 && (
                  <View style={[styles.distSegment, { flex: businessCount, backgroundColor: colors.primary }]}>
                    {businessCount / periodTrips.length > 0.15 && (
                      <Text style={styles.distPct}>{Math.round((businessCount / periodTrips.length) * 100)}%</Text>
                    )}
                  </View>
                )}
                {privateCount > 0 && (
                  <View style={[styles.distSegment, { flex: privateCount, backgroundColor: colors.success }]}>
                    {privateCount / periodTrips.length > 0.15 && (
                      <Text style={styles.distPct}>{Math.round((privateCount / periodTrips.length) * 100)}%</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.sub }]}>{t("home.businessShort")} {businessKm.toFixed(0)} km</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.legendText, { color: colors.sub }]}>
                    {t("home.privateShort")} {periodTrips.filter((t) => t.type === "private").reduce((a, b) => a + b.km, 0).toFixed(0)} km
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Recent trips */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.recentTrips")}</Text>
          {periodTrips.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="map" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("home.noTrips")}
              </Text>
            </View>
          ) : (
            periodTrips.slice(0, 3).map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDelete={deleteTrip}
                onEdit={handleEdit}
                onView={handleView}
                onRetrySync={retryWaypointSync}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Save Trip Sheet — shown after stopping a trip */}
      <SaveTripSheet />

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

      {/* Paywall — shown when free user exceeds 5 trip limit */}
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />

      {/* Start Trip Confirm Modal */}
      <Modal visible={showStartModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowStartModal(false)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: pendingType === "business" ? colors.accent : colors.successLight }]}>
              <Feather
                name={pendingType === "business" ? "briefcase" : "user"}
                size={28}
                color={pendingType === "business" ? colors.primary : colors.success}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {pendingLabel} {t("home.startTripSuffix")}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {t("home.modalSub")}
            </Text>
            <View style={[styles.modalAddrBlock]}>
              <View style={[styles.modalAddrRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="navigation" size={13} color={pendingType === "business" ? colors.primary : colors.success} />
                <TextInput
                  ref={startAddrInputRef}
                  style={[styles.modalAddrInput, { color: colors.foreground }]}
                  value={modalStartAddr}
                  onChangeText={setModalStartAddr}
                  placeholder={modalStartAddrLoading ? "Standort wird ermittelt…" : "Startadresse eingeben…"}
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                  editable={!modalStartAddrLoading}
                  selectTextOnFocus
                />
                {modalStartAddr.length > 0 && (
                  <TouchableOpacity onPress={() => setModalStartAddr("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.modalZielRow}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[styles.modalZielText, { color: colors.mutedForeground }]}>
                  Zielort wird beim Ankommen automatisch erfasst.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: pendingType === "business" ? colors.primary : colors.success }]}
              onPress={confirmStart}
              testID="confirm-start"
            >
              <Feather name="play" size={16} color="#FFFFFF" />
              <Text style={styles.modalBtnText}>{t("home.startBtn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStartModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { fontSize: 13, fontWeight: "500" },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  driveActivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  driveActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  driveActiveText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
    letterSpacing: 0.2,
  },
  plateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  plateText: { fontSize: 13, fontWeight: "700" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12, letterSpacing: -0.2 },
  quickRow: { flexDirection: "row", gap: 12 },
  quickBtn: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 14, fontWeight: "700" },
  quickSub: { fontSize: 12 },
  quickArrow: { alignSelf: "flex-end" },
  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  gpsBannerText: { fontSize: 12, fontWeight: "600" },
  pillScroll: { marginBottom: 14 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  statsGrid: { flexDirection: "row", gap: 12 },
  distCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
    gap: 12,
  },
  distLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  distBar: { height: 28, borderRadius: 8, flexDirection: "row", overflow: "hidden" },
  distSegment: { alignItems: "center", justifyContent: "center" },
  distPct: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  legendRow: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  modalIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  modalSub: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  modalAddrBlock: { alignSelf: "stretch", gap: 6, marginBottom: 4 },
  modalAddrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalAddrInput: { flex: 1, fontSize: 13, lineHeight: 18, padding: 0 },
  modalZielRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  modalZielText: { fontSize: 11, flex: 1, lineHeight: 16, opacity: 0.75 },
  modalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
    width: "100%",
    justifyContent: "center",
  },
  modalBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  modalCancel: { fontSize: 14, fontWeight: "500", padding: 8 },
});
