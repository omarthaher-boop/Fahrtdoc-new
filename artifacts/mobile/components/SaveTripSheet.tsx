import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EditTripModal from "@/components/EditTripModal";
import { Trip, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { fetchRoutes, RouteOption } from "@/utils/routeService";

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

export default function SaveTripSheet() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingTrip, pendingTripCoords, finalizeTrip } = useApp();

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("actual");
  const [showEditModal, setShowEditModal] = useState(false);
  const [draftTrip, setDraftTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!pendingTrip) {
      setRoutes([]);
      setRouteError(null);
      setSelectedId("actual");
      setDraftTrip(null);
      return;
    }
    setDraftTrip(pendingTrip);
    setSelectedId("actual");

    if (!pendingTripCoords) return;
    setLoadingRoutes(true);
    setRouteError(null);
    fetchRoutes(
      pendingTripCoords.startLat,
      pendingTripCoords.startLon,
      pendingTripCoords.endLat,
      pendingTripCoords.endLon
    )
      .then(setRoutes)
      .catch(() => setRouteError("Routen konnten nicht geladen werden"))
      .finally(() => setLoadingRoutes(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTrip?.id]);

  useEffect(() => {
    if (pendingTrip) setDraftTrip(pendingTrip);
  }, [pendingTrip]);

  const handleSave = useCallback(async () => {
    if (!draftTrip) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let km = draftTrip.km;
    if (selectedId !== "actual") {
      const route = routes.find((r) => r.id === selectedId);
      if (route) km = route.km;
    }
    await finalizeTrip({ ...draftTrip, km });
  }, [draftTrip, selectedId, routes, finalizeTrip]);

  const handleEditSave = useCallback(
    async (_id: string, changes: Partial<Trip>) => {
      if (!draftTrip) return;
      setShowEditModal(false);
      await finalizeTrip({ ...draftTrip, ...changes, edited: true });
    },
    [draftTrip, finalizeTrip]
  );

  if (!pendingTrip) return null;

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.sheetWrapper}
          >
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  paddingBottom: insets.bottom + 24,
                },
              ]}
            >
              <View style={[styles.handle, { backgroundColor: colors.border }]} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Header */}
                <View style={styles.titleRow}>
                  <View style={[styles.titleIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="flag" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.foreground }]}>
                      Fahrt beenden
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                      Kilometerstand auswählen & speichern
                    </Text>
                  </View>
                </View>

                {/* Trip summary card */}
                <View
                  style={[
                    styles.infoCard,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.addrRow}>
                    <View style={[styles.addrDot, { backgroundColor: colors.primary }]} />
                    <Text
                      style={[styles.addrText, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {draftTrip?.startAddr || "—"}
                    </Text>
                  </View>
                  <View style={[styles.addrConnector, { backgroundColor: colors.border }]} />
                  <View style={styles.addrRow}>
                    <View
                      style={[styles.addrDotHollow, { borderColor: colors.mutedForeground }]}
                    />
                    <Text
                      style={[styles.addrText, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {draftTrip?.endAddr || "Wird ermittelt …"}
                    </Text>
                  </View>
                  <View style={[styles.infoChipRow, { borderTopColor: colors.border }]}>
                    <View style={styles.infoChip}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>
                        {fmtDur(draftTrip?.dur ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.infoChip}>
                      <Feather
                        name={draftTrip?.type === "business" ? "briefcase" : "user"}
                        size={12}
                        color={colors.mutedForeground}
                      />
                      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>
                        {draftTrip?.type === "business" ? "Geschäftlich" : "Privat"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Section label */}
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  KILOMETERSTAND WÄHLEN
                </Text>

                {/* Actual GPS km */}
                <TouchableOpacity
                  style={[
                    styles.routeCard,
                    {
                      backgroundColor:
                        selectedId === "actual" ? colors.accent : colors.secondary,
                      borderColor:
                        selectedId === "actual" ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedId("actual")}
                  activeOpacity={0.75}
                >
                  <View style={styles.routeLeft}>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor:
                            selectedId === "actual" ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {selectedId === "actual" && (
                        <View
                          style={[styles.radioInner, { backgroundColor: colors.primary }]}
                        />
                      )}
                    </View>
                    <View>
                      <Text style={[styles.routeName, { color: colors.foreground }]}>
                        Gefahrene Kilometer
                      </Text>
                      <Text style={[styles.routeSub, { color: colors.mutedForeground }]}>
                        GPS-aufgezeichnete Strecke
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.routeKm, { color: colors.primary }]}>
                    {(draftTrip?.km ?? 0).toFixed(1)} km
                  </Text>
                </TouchableOpacity>

                {/* Loading indicator */}
                {loadingRoutes && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                      Routen werden berechnet …
                    </Text>
                  </View>
                )}

                {/* Route error */}
                {routeError && (
                  <View
                    style={[
                      styles.errorBanner,
                      {
                        backgroundColor: colors.warningLight ?? "#FFF8E7",
                        borderColor: colors.warning ?? "#FFB703",
                      },
                    ]}
                  >
                    <Feather name="alert-circle" size={14} color={colors.warning ?? "#FFB703"} />
                    <Text
                      style={[styles.errorText, { color: colors.warning ?? "#FFB703" }]}
                    >
                      {routeError}
                    </Text>
                  </View>
                )}

                {/* OSRM route options */}
                {routes.map((route) => (
                  <TouchableOpacity
                    key={route.id}
                    style={[
                      styles.routeCard,
                      {
                        backgroundColor:
                          selectedId === route.id ? colors.accent : colors.secondary,
                        borderColor:
                          selectedId === route.id ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedId(route.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.routeLeft}>
                      <View
                        style={[
                          styles.radioOuter,
                          {
                            borderColor:
                              selectedId === route.id ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {selectedId === route.id && (
                          <View
                            style={[styles.radioInner, { backgroundColor: colors.primary }]}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.routeNameRow}>
                          <Text style={[styles.routeName, { color: colors.foreground }]}>
                            {route.label}
                          </Text>
                          {route.isShortest && !route.isFastest && (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: colors.successLight },
                              ]}
                            >
                              <Text
                                style={[styles.badgeText, { color: colors.success }]}
                              >
                                Kürzeste
                              </Text>
                            </View>
                          )}
                          {route.isFastest && !route.isShortest && (
                            <View
                              style={[styles.badge, { backgroundColor: colors.accent }]}
                            >
                              <Text
                                style={[styles.badgeText, { color: colors.primary }]}
                              >
                                Schnellste
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.routeSub, { color: colors.mutedForeground }]}>
                          ca. {route.durationMin} min Fahrzeit
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.routeKm, { color: colors.primary }]}>
                      {route.km.toFixed(1)} km
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Action buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { borderColor: colors.border, backgroundColor: colors.secondary },
                    ]}
                    onPress={() => setShowEditModal(true)}
                    testID="save-trip-edit"
                  >
                    <Feather name="edit-2" size={15} color={colors.foreground} />
                    <Text style={[styles.editBtnText, { color: colors.foreground }]}>
                      Fahrt bearbeiten
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    testID="save-trip-confirm"
                  >
                    <Feather name="check" size={15} color="#FFF" />
                    <Text style={styles.saveBtnText}>Fahrt speichern</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <EditTripModal
        trip={draftTrip}
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrapper: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "92%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  addrDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  addrDotHollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    flexShrink: 0,
  },
  addrConnector: { width: 2, height: 12, marginLeft: 4 },
  addrText: { fontSize: 13, fontWeight: "600", flex: 1 },
  infoChipRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
  },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoChipText: { fontSize: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  routeLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  routeNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  routeName: { fontSize: 14, fontWeight: "700" },
  routeSub: { fontSize: 12, marginTop: 2 },
  routeKm: { fontSize: 15, fontWeight: "800", flexShrink: 0, marginLeft: 8 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  loadingText: { fontSize: 13 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, flex: 1 },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  editBtnText: { fontSize: 14, fontWeight: "700" },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
