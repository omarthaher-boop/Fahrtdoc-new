import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActiveTripMap from "@/components/ActiveTripMap";
import { useApp, type Waypoint } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { DRIVE_DETECT_TASK } from "@/utils/driveDetect";
import { startTripNotifications, stopTripNotifications } from "@/services/tripNotificationService";

const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const reverseGeocodeLocal = async (lat: number, lon: number): Promise<string> => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (info@centof.ai)" } }
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

export default function TrackingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { t } = useLanguage();
  const { activeTrip, paused, elapsed, stopTrip, setActiveTripNote, setActiveTripType, togglePause, livePos, gpsTracking } = useApp();

  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number; ts: number } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapFadeAnim = useRef(new Animated.Value(0)).current;
  const mapDimAnim = useRef(new Animated.Value(1)).current;
  const mapShownRef = useRef(false);
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [pauseLocation, setPauseLocation] = useState("");
  const [pauseLocationLoading, setPauseLocationLoading] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [driveTaskRunning, setDriveTaskRunning] = useState(true);
  const [tripNote, setTripNote] = useState(activeTrip?.note ?? "");
  const [noteExpanded, setNoteExpanded] = useState(!!(activeTrip?.note));
  const noteInputRef = useRef<TextInput>(null);
  const tripNoteInputRef = useRef<TextInput>(null);
  const panelScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!livePos) return;
    const now = Date.now();
    const prev = prevPosRef.current;
    if (prev) {
      const dtS = (now - prev.ts) / 1000;
      if (dtS > 0.5 && dtS < 60) {
        if (livePos.speed != null && livePos.speed >= 0) {
          setSpeedKmh(Math.round(livePos.speed * 3.6));
        } else {
          const distM = haversineMeters(prev.lat, prev.lon, livePos.lat, livePos.lon);
          setSpeedKmh(Math.round((distM / dtS) * 3.6));
        }
        if (livePos.heading != null) {
          setHeading(livePos.heading);
        } else {
          setHeading(computeBearing(prev.lat, prev.lon, livePos.lat, livePos.lon));
        }
      }
    }
    prevPosRef.current = { lat: livePos.lat, lon: livePos.lon, ts: now };
  }, [livePos]);

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

  useEffect(() => {
    if (Platform.OS === "web") return;
    refreshDriveTaskStatus();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshDriveTaskStatus();
    });
    return () => subscription.remove();
  }, [refreshDriveTaskStatus]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (activeTrip && !paused) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => {
      deactivateKeepAwake();
    };
  }, [activeTrip, paused]);

  useEffect(() => {
    if (!activeTrip || paused) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeTrip, paused, pulseAnim]);

  const hasHadActiveTrip = useRef(!!activeTrip);
  useEffect(() => {
    if (activeTrip) {
      hasHadActiveTrip.current = true;
    } else if (hasHadActiveTrip.current) {
      router.replace("/home");
    }
  }, [activeTrip]);

  // Refs so the notification interval always reads current values
  const notifActiveTripRef = useRef(activeTrip);
  useEffect(() => { notifActiveTripRef.current = activeTrip; }, [activeTrip]);
  const notifElapsedRef = useRef(elapsed);
  useEffect(() => { notifElapsedRef.current = elapsed; }, [elapsed]);

  // Start trip notifications on mount, stop on unmount
  const notifStartedRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === "web" || !activeTrip) return;
    if (notifStartedRef.current) return;
    notifStartedRef.current = true;
    void startTripNotifications(activeTrip.type, () => ({
      km: notifActiveTripRef.current?.distance ?? 0,
      elapsed: notifElapsedRef.current,
    }));
    return () => {
      void stopTripNotifications();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPositions = activeTrip ? (activeTrip.positions.length > 0 || livePos !== null) : false;
  const showMap = gpsTracking && hasPositions;

  useEffect(() => {
    if (showMap && !mapShownRef.current) {
      mapShownRef.current = true;
      Animated.timing(mapFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else if (!showMap) {
      mapFadeAnim.setValue(0);
      mapShownRef.current = false;
    }
  }, [showMap, mapFadeAnim]);

  useEffect(() => {
    Animated.timing(mapDimAnim, {
      toValue: paused ? 0.45 : 1,
      duration: 350,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [paused, mapDimAnim]);

  if (!activeTrip) return null;

  const warningColor = colors.warning ?? "#D97706";
  const warningLight = colors.warningLight ?? "#FFFBEB";
  const successDark = colors.successDark ?? "#15803D";

  const handleStop = () => {
    if (geocoding) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Stop interval + dismiss running notifications, then show completion toast
    void stopTripNotifications(activeTrip?.distance, activeTrip?.type);
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
    setShowPauseSheet(true);

    (async () => {
      let pos = livePos;
      if (!pos && activeTrip.positions.length > 0) {
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
    setShowPauseSheet(false);
    setGeocoding(true);
    const capturedTripId = activeTrip?.id;
    let pos = livePos;
    if (!pos && activeTrip.positions.length > 0) {
      pos = activeTrip.positions[activeTrip.positions.length - 1];
    }
    if (!pos) {
      togglePause();
      setGeocoding(false);
      return;
    }
    try {
      let addr = pauseLocation || (await reverseGeocodeLocal(pos.lat, pos.lon));
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
    setShowPauseSheet(false);
    togglePause();
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const tripTypeColor =
    activeTrip.type === "business" ? colors.primary :
    activeTrip.type === "arbeitsweg" ? "#e65100" :
    colors.success;
  const tripTypeLabel =
    activeTrip.type === "business" ? t("tripType.business") :
    activeTrip.type === "arbeitsweg" ? t("tripType.arbeitsweg") :
    t("tripType.private");

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.replace("/(main)/home")}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.statusRow}>
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: paused ? warningColor : colors.success,
                  opacity: pulseAnim,
                },
              ]}
            />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {paused ? t("tracking.paused") : t("tracking.screen.title")}
            </Text>
          </View>
          {/* Type switcher pills */}
          <View style={styles.typeSwitchRow}>
            {(["business", "private", "arbeitsweg"] as const).map((type) => {
              const isActive = activeTrip.type === type;
              const c = type === "business" ? colors.primary : type === "arbeitsweg" ? "#e65100" : colors.success;
              const label = t(`tripType.${type}` as "tripType.business");
              const icon = type === "business" ? "briefcase" : type === "arbeitsweg" ? "home" : "user";
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setActiveTripType(type)}
                  style={[
                    styles.typeSwitchPill,
                    {
                      backgroundColor: isActive ? c + "20" : "transparent",
                      borderColor: isActive ? c + "60" : colors.border,
                    },
                  ]}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Feather name={icon} size={10} color={isActive ? c : colors.mutedForeground} />
                  <Text style={[styles.typeSwitchText, { color: isActive ? c : colors.mutedForeground, fontWeight: isActive ? "700" : "400" }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Map area */}
      <View style={[styles.mapArea, { height: screenHeight * 0.42 }]}>
        {!showMap && (
          <View style={[styles.mapPlaceholder, { backgroundColor: colors.secondary }]}>
            <View style={[styles.mapPlaceholderIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather
                name={gpsTracking ? "map" : "wifi-off"}
                size={32}
                color={gpsTracking ? colors.mutedForeground : warningColor}
              />
            </View>
            <Text style={[styles.mapPlaceholderTitle, { color: colors.foreground }]}>
              {gpsTracking ? t("tracking.screen.waitingGps") : t("tracking.screen.gpsOff")}
            </Text>
            <Text style={[styles.mapPlaceholderSub, { color: colors.mutedForeground }]}>
              {gpsTracking
                ? t("tracking.screen.waitingGpsSub")
                : t("tracking.screen.gpsOffSub")}
            </Text>
          </View>
        )}
        {showMap && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: Animated.multiply(mapFadeAnim, mapDimAnim) },
            ]}
          >
            <ActiveTripMap
              positions={activeTrip.positions}
              livePos={livePos}
              heading={heading}
              paused={paused}
            />
          </Animated.View>
        )}
      </View>

      {/* Stats + Controls panel */}
      <ScrollView
        ref={panelScrollRef}
        style={[styles.panelScroll, { backgroundColor: colors.card, borderTopColor: colors.border }]}
        contentContainerStyle={[
          styles.panel,
          { paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Status warnings */}
        {paused && (
          <View style={[styles.warningBanner, { backgroundColor: warningLight, borderColor: warningColor }]}>
            <Feather name="pause-circle" size={14} color={warningColor} />
            <Text style={[styles.warningText, { color: warningColor }]}>
              {t("tracking.screen.pausedNote")}
            </Text>
          </View>
        )}
        {!gpsTracking && !paused && (
          <View style={[styles.warningBanner, { backgroundColor: warningLight, borderColor: warningColor }]}>
            <Feather name="wifi-off" size={14} color={warningColor} />
            <Text style={[styles.warningText, { color: warningColor }]}>
              {t("tracking.gpsOff")}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {fmtTime(elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("tracking.screen.elapsed")}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {activeTrip.distance.toFixed(1)}
              <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> km</Text>
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("tracking.screen.distance")}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {speedKmh !== null ? (
                <>
                  {speedKmh}
                  <Text style={[styles.statUnit, { color: colors.mutedForeground }]}> km/h</Text>
                </>
              ) : (
                <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>—</Text>
              )}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {t("tracking.screen.speed")}
            </Text>
            {livePos?.accuracy != null && livePos.accuracy > 15 && (
              <Text style={[styles.accuracyBadge, { color: colors.mutedForeground }]}>
                ±{Math.round(livePos.accuracy)} m
              </Text>
            )}
          </View>

          {(activeTrip.waypoints?.length ?? 0) > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBlock}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {activeTrip.waypoints!.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {t("tracking.screen.waypoints")}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Start address */}
        {activeTrip.startAddr ? (
          <View style={styles.startAddrRow}>
            <Feather name="navigation" size={12} color={colors.mutedForeground} />
            <Text style={[styles.startAddrText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {t("tracking.screen.from")} {activeTrip.startAddr}
            </Text>
          </View>
        ) : null}

        {/* Trip note */}
        {noteExpanded ? (
          <View style={[styles.tripNoteRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="edit-3" size={13} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <TextInput
              ref={tripNoteInputRef}
              style={[styles.tripNoteInput, { color: colors.foreground }]}
              placeholder={t("tracking.screen.notePlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={tripNote}
              onChangeText={(text) => {
                setTripNote(text);
                setActiveTripNote(text);
              }}
              onFocus={() => setTimeout(() => panelScrollRef.current?.scrollToEnd({ animated: true }), 100)}
              multiline
              maxLength={300}
              returnKeyType="done"
              blurOnSubmit
            />
            {tripNote.length === 0 && (
              <TouchableOpacity
                onPress={() => setNoteExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addNoteBtn}
            onPress={() => {
              setNoteExpanded(true);
              setTimeout(() => tripNoteInputRef.current?.focus(), 50);
            }}
          >
            <Feather name="edit-3" size={12} color={colors.mutedForeground} />
            <Text style={[styles.addNoteBtnText, { color: colors.mutedForeground }]}>
              {t("tracking.screen.addNote")}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.pauseBtn,
              paused
                ? { backgroundColor: warningColor, borderColor: warningColor }
                : { backgroundColor: colors.successLight, borderColor: colors.success, borderWidth: 1.5 },
            ]}
            onPress={handlePausePress}
            disabled={geocoding}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={successDark} />
            ) : (
              <Feather
                name={paused ? "play" : "pause"}
                size={20}
                color={paused ? "#FFFFFF" : successDark}
              />
            )}
            <Text
              style={[
                styles.pauseBtnText,
                { color: paused ? "#FFFFFF" : successDark },
              ]}
            >
              {paused ? t("tracking.screen.resume") : t("tracking.screen.pause")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.stopBtn,
              { backgroundColor: geocoding ? colors.mutedForeground : colors.destructive },
            ]}
            onPress={handleStop}
            disabled={geocoding}
          >
            <Feather name="square" size={20} color="#FFFFFF" />
            <Text style={styles.stopBtnText}>{t("tracking.screen.stop")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pause / Waypoint sheet */}
      <Modal
        visible={showPauseSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPauseSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetOverlay}
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.sheetIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="map-pin" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {t("pause.dialog.title")}
            </Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              {t("pause.dialog.message")}
            </Text>

            <View
              style={[
                styles.locationRow,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="navigation" size={13} color={colors.primary} />
              {pauseLocationLoading ? (
                <View style={styles.locationLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.locationLoadingText, { color: colors.mutedForeground }]}>
                    {t("waypoint.locating")}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.locationText, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {pauseLocation || t("waypoint.addressUnavailable")}
                </Text>
              )}
            </View>

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

            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleSaveWaypoint}
            >
              <Feather name="map-pin" size={15} color="#FFF" />
              <Text style={styles.sheetBtnPrimaryText}>{t("pause.withWaypoint")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetBtnSecondary,
                { borderColor: colors.border, backgroundColor: colors.secondary },
              ]}
              onPress={handlePauseOnly}
            >
              <Feather name="pause" size={15} color={colors.foreground} />
              <Text style={[styles.sheetBtnSecondaryText, { color: colors.foreground }]}>
                {t("pause.withoutWaypoint")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  typeSwitchRow: {
    flexDirection: "row",
    gap: 4,
  },
  typeSwitchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeSwitchText: { fontSize: 10 },
  headerRight: { width: 36 },
  mapArea: { overflow: "hidden" },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  mapPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  mapPlaceholderTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  mapPlaceholderSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  panelScroll: {
    borderTopWidth: 1,
    flexShrink: 1,
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningText: { fontSize: 12, fontWeight: "600", flex: 1 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statBlock: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums" as const] },
  statUnit: { fontSize: 14, fontWeight: "500" },
  statLabel: { fontSize: 11, fontWeight: "500" },
  accuracyBadge: { fontSize: 10, fontWeight: "400", marginTop: 1 },
  statDivider: { width: 1, height: 40 },
  startAddrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  startAddrText: { fontSize: 12, flex: 1 },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  pauseBtnText: { fontSize: 15, fontWeight: "700" },
  stopBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  stopBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
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
  sheetSub: { fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 4 },
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
  tripNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tripNoteInput: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 36,
    textAlignVertical: "top",
    paddingTop: 0,
    paddingBottom: 0,
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  addNoteBtnText: { fontSize: 12, fontWeight: "500" },
});
