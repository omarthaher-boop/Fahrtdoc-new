import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TripRouteMap from "@/components/TripRouteMap";
import { Trip, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { fetchRoutes, RouteOption } from "@/utils/routeService";
import { useCarPlayStopped, setCarPlayStopped } from "@/utils/carplayBridge";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function MapFallback() {
  return (
    <View style={{ height: 140, alignItems: "center", justifyContent: "center" }}>
      <Feather name="map" size={22} color="#9CA3AF" />
    </View>
  );
}

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

const forwardGeocode = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const encoded = encodeURIComponent(address);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (info@centofai.com)" } }
    );
    clearTimeout(tid);
    const data = await r.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
};

export default function SaveTripSheet() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingTrip, pendingTripCoords, pendingTripPath, finalizeTrip, discardPendingTrip } = useApp();
  const { t } = useLanguage();
  const stoppedViaCarPlay = useCarPlayStopped();

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [gpsChecked, setGpsChecked] = useState(true);
  const [routeCheckedId, setRouteCheckedId] = useState<string | null>(null);
  const [useRouteDuration, setUseRouteDuration] = useState(false);
  const [draftTrip, setDraftTrip] = useState<Trip | null>(null);
  const [editingField, setEditingField] = useState<"end" | number | null>(null);
  const [fieldDraftValue, setFieldDraftValue] = useState("");
  const [routeOverrideEnd, setRouteOverrideEnd] = useState<{ lat: number; lon: number } | null>(null);
  const isConfirmingRef = useRef(false);

  useEffect(() => {
    if (!pendingTrip) {
      setRoutes([]);
      setRouteError(null);
      setGpsChecked(true);
      setRouteCheckedId(null);
      setUseRouteDuration(false);
      setDraftTrip(null);
      setEditingField(null);
      setFieldDraftValue("");
      setRouteOverrideEnd(null);
      setCarPlayStopped(false);
      return;
    }
    setDraftTrip(pendingTrip);
    setGpsChecked(true);
    setRouteCheckedId(null);
    setUseRouteDuration(false);

    if (!pendingTripCoords) return;
    setLoadingRoutes(true);
    setRouteError(null);
    fetchRoutes(
      pendingTripCoords.startLat,
      pendingTripCoords.startLon,
      pendingTripCoords.endLat,
      pendingTripCoords.endLon
    )
      .then((r) => {
        setRoutes(r);
        const shortest = r.find((x) => x.isShortest) ?? r[0];
        if (shortest) setRouteCheckedId(shortest.id);
      })
      .catch(() => setRouteError(t("save.routeError")))
      .finally(() => setLoadingRoutes(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTrip?.id]);

  useEffect(() => {
    if (pendingTrip) setDraftTrip(pendingTrip);
  }, [pendingTrip]);

  const startFieldEdit = (field: "end" | number, currentValue: string) => {
    setEditingField(field);
    setFieldDraftValue(currentValue);
  };

  const confirmFieldEdit = useCallback(async () => {
    if (isConfirmingRef.current) return;
    const field = editingField;
    if (field === null || !draftTrip) {
      setEditingField(null);
      return;
    }
    isConfirmingRef.current = true;
    setEditingField(null);

    if (field === "end") {
      const newAddr = fieldDraftValue.trim() || draftTrip.endAddr;
      setDraftTrip((prev) => (prev ? { ...prev, endAddr: newAddr } : null));

      if (pendingTripCoords && newAddr && newAddr !== draftTrip.endAddr) {
        setLoadingRoutes(true);
        setRouteError(null);
        const coords = await forwardGeocode(newAddr);
        const endLat = coords?.lat ?? (routeOverrideEnd?.lat ?? pendingTripCoords.endLat);
        const endLon = coords?.lon ?? (routeOverrideEnd?.lon ?? pendingTripCoords.endLon);
        if (coords) setRouteOverrideEnd(coords);

        fetchRoutes(pendingTripCoords.startLat, pendingTripCoords.startLon, endLat, endLon)
          .then((r) => {
            setRoutes(r);
            const shortest = r.find((x) => x.isShortest) ?? r[0];
            if (shortest) setRouteCheckedId(shortest.id);
          })
          .catch(() => setRouteError(t("save.routeError")))
          .finally(() => setLoadingRoutes(false));
      }
    } else {
      const idx = field as number;
      const newAddr = fieldDraftValue.trim();
      setDraftTrip((prev) => {
        if (!prev) return null;
        const newWaypoints = [...(prev.waypoints ?? [])];
        if (newWaypoints[idx]) {
          newWaypoints[idx] = { ...newWaypoints[idx], addr: newAddr || newWaypoints[idx].addr };
        }
        return { ...prev, waypoints: newWaypoints };
      });
    }
    isConfirmingRef.current = false;
  }, [editingField, fieldDraftValue, draftTrip, pendingTripCoords, routeOverrideEnd]);

  const handleSave = useCallback(async () => {
    if (!draftTrip) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let km = draftTrip.km;
    if (!gpsChecked && routeCheckedId) {
      const route = routes.find((r) => r.id === routeCheckedId);
      if (route) km = route.km;
    }

    let kmRoute = draftTrip.kmRoute;
    if (routeCheckedId) {
      const route = routes.find((r) => r.id === routeCheckedId);
      if (route) kmRoute = route.km;
    } else {
      const shortest = routes.find((r) => r.isShortest);
      if (shortest) kmRoute = shortest.km;
    }

    let dur = draftTrip.dur;
    if (useRouteDuration && routeCheckedId) {
      const route = routes.find((r) => r.id === routeCheckedId);
      if (route) dur = route.durationMin * 60;
    }

    try {
      setIsSaving(true);
      await finalizeTrip({ ...draftTrip, km, kmRoute, dur });
    } catch {
      Alert.alert("Fehler", "Fahrt konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }, [draftTrip, gpsChecked, routeCheckedId, routes, useRouteDuration, finalizeTrip]);

  if (!pendingTrip) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (isSaving) return;
        Alert.alert(
          "Fahrt verwerfen?",
          "Die Fahrt wird nicht gespeichert.",
          [
            { text: "Abbrechen", style: "cancel" },
            { text: "Verwerfen", style: "destructive", onPress: discardPendingTrip },
          ]
        );
      }}
    >
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
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Header */}
              <View style={styles.titleRow}>
                <View style={[styles.titleIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="flag" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {t("save.title")}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    {t("save.subtitle")}
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
                {/* Start address (read-only) */}
                <View style={styles.addrRow}>
                  <View style={[styles.addrDot, { backgroundColor: colors.primary }]} />
                  <Text
                    style={[styles.addrText, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {draftTrip?.startAddr || "—"}
                  </Text>
                </View>

                {/* Waypoints (editable) */}
                {(draftTrip?.waypoints ?? []).map((wp, idx) => (
                  <React.Fragment key={wp.timestamp}>
                    <View style={[styles.addrConnector, { backgroundColor: colors.border }]} />
                    <View style={styles.addrRow}>
                      <Feather name="map-pin" size={10} color={colors.primary} style={styles.waypointIcon} />
                      <Text style={[styles.addrLabelText, { color: colors.mutedForeground }]}>
                        {`${t("waypoint.label")} ${idx + 1}: `}
                      </Text>
                      {editingField === idx ? (
                        <TextInput
                          style={[styles.addrInput, { color: colors.foreground, borderColor: colors.primary }]}
                          value={fieldDraftValue}
                          onChangeText={setFieldDraftValue}
                          onSubmitEditing={confirmFieldEdit}
                          onBlur={confirmFieldEdit}
                          autoFocus
                          returnKeyType="done"
                          blurOnSubmit
                        />
                      ) : (
                        <>
                          <Text
                            style={[styles.addrText, { color: colors.foreground, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {wp.addr}
                          </Text>
                          <TouchableOpacity
                            onPress={() => startFieldEdit(idx, wp.addr)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </React.Fragment>
                ))}

                <View style={[styles.addrConnector, { backgroundColor: colors.border }]} />

                {/* End address (editable) */}
                <View style={styles.addrRow}>
                  <View
                    style={[styles.addrDotHollow, { borderColor: colors.mutedForeground }]}
                  />
                  {editingField === "end" ? (
                    <TextInput
                      style={[styles.addrInput, { color: colors.foreground, borderColor: colors.primary }]}
                      value={fieldDraftValue}
                      onChangeText={setFieldDraftValue}
                      onSubmitEditing={confirmFieldEdit}
                      onBlur={confirmFieldEdit}
                      autoFocus
                      returnKeyType="done"
                      blurOnSubmit
                    />
                  ) : (
                    <>
                      <Text
                        style={[styles.addrText, { color: colors.foreground, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {draftTrip?.endAddr || t("save.addressLoading")}
                      </Text>
                      <TouchableOpacity
                        onPress={() => startFieldEdit("end", draftTrip?.endAddr ?? "")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </>
                  )}
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
                      {draftTrip?.type === "business" ? t("tripType.business") : t("tripType.private")}
                    </Text>
                  </View>
                  {stoppedViaCarPlay && (
                    <View style={[styles.infoChip, styles.carplayChip, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
                      <Feather name="monitor" size={12} color={colors.primary} />
                      <Text style={[styles.infoChipText, { color: colors.primary, fontWeight: "700" }]}>
                        {t("tracking.carplayStopSource")}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Route map */}
              {draftTrip && (
                <View style={styles.mapWrapper}>
                  <ErrorBoundary FallbackComponent={MapFallback}>
                    <TripRouteMap
                      trip={draftTrip}
                      coords={pendingTripCoords ?? undefined}
                      path={pendingTripPath ?? undefined}
                    />
                  </ErrorBoundary>
                </View>
              )}

              {/* Section label */}
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("save.kmSection")}
              </Text>

              {/* Actual GPS km */}
              <TouchableOpacity
                style={[
                  styles.routeCard,
                  {
                    backgroundColor: gpsChecked ? colors.accent : colors.secondary,
                    borderColor: gpsChecked ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setGpsChecked(!gpsChecked)}
                activeOpacity={0.75}
              >
                <View style={styles.routeLeft}>
                  <View
                    style={[
                      styles.checkOuter,
                      { borderColor: gpsChecked ? colors.primary : colors.border, backgroundColor: gpsChecked ? colors.primary : "transparent" },
                    ]}
                  >
                    {gpsChecked && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                  <View>
                    <Text style={[styles.routeName, { color: colors.foreground }]}>
                      {t("save.gpsKmLabel")}
                    </Text>
                    <Text style={[styles.routeSub, { color: colors.mutedForeground }]}>
                      {t("save.gpsKmSub")}
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
                    {t("save.loadingRoutes")}
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
                  <Text style={[styles.errorText, { color: colors.warning ?? "#FFB703" }]}>
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
                      backgroundColor: routeCheckedId === route.id ? colors.accent : colors.secondary,
                      borderColor: routeCheckedId === route.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setRouteCheckedId(routeCheckedId === route.id ? null : route.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.routeLeft}>
                    <View
                      style={[
                        styles.checkOuter,
                        {
                          borderColor: routeCheckedId === route.id ? colors.primary : colors.border,
                          backgroundColor: routeCheckedId === route.id ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      {routeCheckedId === route.id && <Feather name="check" size={12} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.routeNameRow}>
                        <Text style={[styles.routeName, { color: colors.foreground }]}>
                          {route.label}
                        </Text>
                        {route.isShortest && !route.isFastest && (
                          <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                            <Text style={[styles.badgeText, { color: colors.success }]}>{t("save.badgeShortest")}</Text>
                          </View>
                        )}
                        {route.isFastest && !route.isShortest && (
                          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>{t("save.badgeFastest")}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.routeStats}>
                    <Text style={[styles.routeKm, { color: colors.primary }]}>
                      {route.km.toFixed(1)} km
                    </Text>
                    <View style={styles.routeDurRow}>
                      <Feather name="clock" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.routeDurText, { color: colors.mutedForeground }]}>
                        {route.durationMin} {t("save.routeDurationSuffix")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Use route duration toggle — only shown when a route is selected */}
              {routeCheckedId && routes.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.routeCard,
                    {
                      backgroundColor: useRouteDuration ? colors.accent : colors.secondary,
                      borderColor: useRouteDuration ? colors.primary : colors.border,
                      marginTop: 4,
                    },
                  ]}
                  onPress={() => setUseRouteDuration((v) => !v)}
                  activeOpacity={0.75}
                >
                  <View style={styles.routeLeft}>
                    <View
                      style={[
                        styles.checkOuter,
                        {
                          borderColor: useRouteDuration ? colors.primary : colors.border,
                          backgroundColor: useRouteDuration ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      {useRouteDuration && <Feather name="check" size={12} color="#FFF" />}
                    </View>
                    <View>
                      <Text style={[styles.routeName, { color: colors.foreground }]}>
                        {t("save.useRouteDuration")}
                      </Text>
                      <Text style={[styles.routeSub, { color: colors.mutedForeground }]}>
                        {t("save.useRouteDurationSub")}
                      </Text>
                    </View>
                  </View>
                  {useRouteDuration && (() => {
                    const selected = routes.find((r) => r.id === routeCheckedId);
                    return selected ? (
                      <Text style={[styles.routeKm, { color: colors.primary }]}>
                        {fmtDur(selected.durationMin * 60)}
                      </Text>
                    ) : null;
                  })()}
                </TouchableOpacity>
              )}

              {/* Trip note */}
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("save.noteSection")}
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
                placeholder={t("save.notePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                value={draftTrip?.note ?? ""}
                onChangeText={(text) =>
                  setDraftTrip((prev) => (prev ? { ...prev, note: text || undefined } : null))
                }
                multiline
                numberOfLines={3}
                maxLength={300}
                returnKeyType="done"
                blurOnSubmit
              />

              {/* Action buttons */}
              <TouchableOpacity
                style={[styles.saveBtn, styles.saveBtnFull, { backgroundColor: colors.primary, opacity: (isSaving || loadingRoutes) ? 0.6 : 1 }]}
                disabled={isSaving || loadingRoutes}
                onPress={() => {
                  if (Platform.OS === "web") {
                    if (window.confirm(`${t("save.confirmTitle")}\n\n${t("save.confirmMessage")}`)) {
                      handleSave();
                    }
                  } else {
                    Alert.alert(
                      t("save.confirmTitle"),
                      t("save.confirmMessage"),
                      [
                        { text: t("common.cancel"), style: "cancel" },
                        { text: t("common.save"), onPress: handleSave },
                      ]
                    );
                  }
                }}
                testID="save-trip-confirm"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Feather name="check" size={15} color="#FFF" />
                )}
                <Text style={styles.saveBtnText}>{t("common.save")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.discardBtn, { borderColor: colors.destructive, backgroundColor: colors.secondary }]}
                onPress={() => {
                  if (Platform.OS === "web") {
                    if (window.confirm(`${t("save.discardTitle")}\n\n${t("save.discardMessage")}`)) {
                      discardPendingTrip();
                    }
                  } else {
                    Alert.alert(
                      t("save.discardTitle"),
                      t("save.discardMessage"),
                      [
                        { text: t("save.discardBack"), style: "cancel" },
                        {
                          text: t("save.discardBtn"),
                          style: "destructive",
                          onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            discardPendingTrip();
                          },
                        },
                      ]
                    );
                  }
                }}
                testID="save-trip-cancel"
              >
                <Feather name="x" size={14} color={colors.destructive} />
                <Text style={[styles.discardBtnText, { color: colors.destructive }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrapper: {
    flex: 1,
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
  addrText: { fontSize: 13, fontWeight: "600" },
  addrLabelText: { fontSize: 11, fontWeight: "600", flexShrink: 0 },
  addrInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    borderBottomWidth: 1.5,
    paddingVertical: 3,
    paddingHorizontal: 0,
  },
  waypointIcon: { flexShrink: 0 },
  infoChipRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
  },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  carplayChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  infoChipText: { fontSize: 12 },
  mapWrapper: {
    marginBottom: 20,
  },
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
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  routeNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  routeName: { fontSize: 14, fontWeight: "700" },
  routeSub: { fontSize: 12, marginTop: 2 },
  routeStats: { alignItems: "flex-end", flexShrink: 0, marginLeft: 8 },
  routeKm: { fontSize: 15, fontWeight: "800" },
  routeDurRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  routeDurText: { fontSize: 11 },
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
  saveBtnFull: {
    flex: 0,
    alignSelf: "stretch",
    marginTop: 16,
  },
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
  discardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  discardBtnText: { fontSize: 14, fontWeight: "700" },
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
});
