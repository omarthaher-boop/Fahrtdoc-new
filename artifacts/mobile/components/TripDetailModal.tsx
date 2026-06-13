import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
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
import FullScreenMapModal from "@/components/FullScreenMapModal";
import { Trip, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
}

const fmtDurMin = (s: number) => {
  const m = Math.round(s / 60);
  if (m <= 0) return null;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}min` : `${m} Min`;
};

const fmtDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const fmtTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function TripDetailModal({ trip, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { editTrip } = useApp();

  const [noteText, setNoteText] = useState(trip?.note ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setNoteText(trip?.note ?? "");
    setNoteSaved(false);
  }, [trip?.id]);

  const handleBannerPress = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => noteInputRef.current?.focus(), 350);
  };

  if (!trip) return null;

  const locale = language === "en" ? "en-US" : "de-DE";
  const isBusiness = trip.type === "business";
  const accentColor = isBusiness ? colors.primary : colors.success;
  const accentBg = isBusiness ? "#EEF3FF" : "#ECFDF5";
  const dur = fmtDurMin(trip.dur);
  const waypoints = trip.waypoints ?? [];

  const handleSaveNote = () => {
    Keyboard.dismiss();
    editTrip(trip.id, { note: noteText.trim() });
    setNoteSaved(true);
    setTimeout(() => {
      setNoteSaved(false);
      onClose();
    }, 800);
  };

  const noteChanged = noteText.trim() !== (trip.note ?? "").trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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

          {/* Note banner — shown above the scroll area for immediate visibility */}
          {!!trip.note && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBannerPress}
              style={[
                styles.noteBanner,
                { backgroundColor: colors.accent, borderColor: colors.primary + "40" },
              ]}
            >
              <Feather name="file-text" size={13} color={colors.primary} style={{ flexShrink: 0 }} />
              <Text
                style={[styles.noteBannerText, { color: colors.foreground }]}
                numberOfLines={3}
              >
                {trip.note}
              </Text>
              <Feather name="edit-2" size={12} color={colors.primary} style={{ flexShrink: 0, opacity: 0.6 }} />
            </TouchableOpacity>
          )}

          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.typeBadge, { backgroundColor: accentBg }]}>
                <Feather
                  name={isBusiness ? "briefcase" : "user"}
                  size={13}
                  color={accentColor}
                />
                <Text style={[styles.typeText, { color: accentColor }]}>
                  {isBusiness ? t("tripType.business") : t("tripType.private")}
                </Text>
              </View>
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                {fmtDate(trip.date, locale)} · {fmtTime(trip.date, locale)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: colors.border }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={17} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Map */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("detail.routeLabel")}
            </Text>
            <View style={styles.mapWrapper}>
              <TripRouteMap trip={trip} path={trip.path} />
              {/* Full-coverage transparent overlay — tapping anywhere on the map expands it */}
              <TouchableOpacity
                style={styles.mapTapOverlay}
                onPress={() => setMapFullScreen(true)}
                activeOpacity={1}
              />
              {/* Visible expand icon in the corner as an affordance */}
              <TouchableOpacity
                style={[styles.expandBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setMapFullScreen(true)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="maximize-2" size={13} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FullScreenMapModal
              trip={trip}
              path={trip.path}
              visible={mapFullScreen}
              onClose={() => setMapFullScreen(false)}
            />

            {/* Route summary */}
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.mutedForeground, marginTop: 20 },
              ]}
            >
              {t("detail.stationsLabel")}
            </Text>
            <View
              style={[
                styles.stationsCard,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Start */}
              <View style={styles.stationRow}>
                <View style={styles.stationPin}>
                  <View
                    style={[styles.pinDot, { backgroundColor: colors.primary }]}
                  />
                </View>
                <View style={styles.stationText}>
                  <Text
                    style={[styles.stationLabel, { color: colors.mutedForeground }]}
                  >
                    {t("detail.start")}
                  </Text>
                  <Text
                    style={[styles.stationAddr, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {trip.startAddr || t("detail.startUnknown")}
                  </Text>
                </View>
              </View>

              {/* Waypoints */}
              {waypoints.map((wp, idx) => (
                <React.Fragment key={wp.timestamp}>
                  <View
                    style={[
                      styles.stationConnector,
                      { borderLeftColor: colors.border },
                    ]}
                  />
                  <View style={styles.stationRow}>
                    <View style={styles.stationPin}>
                      <Feather
                        name="map-pin"
                        size={12}
                        color="#F59E0B"
                        style={styles.waypointIcon}
                      />
                    </View>
                    <View style={styles.stationText}>
                      <Text
                        style={[
                          styles.stationLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {`${t("waypoint.label")} ${idx + 1}`}
                      </Text>
                      <Text
                        style={[styles.stationAddr, { color: colors.foreground }]}
                        numberOfLines={2}
                      >
                        {wp.addr || t("waypoint.addressUnavailable")}
                      </Text>
                      {!!wp.note && (
                        <Text style={[styles.wpNoteText, { color: colors.mutedForeground }]}>
                          {wp.note}
                        </Text>
                      )}
                    </View>
                  </View>
                </React.Fragment>
              ))}

              {/* Connector before end */}
              <View
                style={[
                  styles.stationConnector,
                  { borderLeftColor: colors.border },
                ]}
              />

              {/* End */}
              <View style={styles.stationRow}>
                <View style={styles.stationPin}>
                  <View
                    style={[
                      styles.pinDotHollow,
                      { borderColor: colors.mutedForeground },
                    ]}
                  />
                </View>
                <View style={styles.stationText}>
                  <Text
                    style={[styles.stationLabel, { color: colors.mutedForeground }]}
                  >
                    {t("detail.end")}
                  </Text>
                  <Text
                    style={[styles.stationAddr, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {trip.endAddr || t("detail.endUnknown")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Stats row */}
            <View
              style={[
                styles.statsRow,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <View style={styles.statItem}>
                <Feather name="navigation" size={16} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {trip.km.toFixed(1)} km
                </Text>
                <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>
                  {t("detail.distance")}
                </Text>
              </View>
              {dur && (
                <>
                  <View
                    style={[styles.statDivider, { backgroundColor: colors.border }]}
                  />
                  <View style={styles.statItem}>
                    <Feather name="clock" size={16} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.foreground }]}>
                      {dur}
                    </Text>
                    <Text
                      style={[styles.statUnit, { color: colors.mutedForeground }]}
                    >
                      {t("detail.driveTime")}
                    </Text>
                  </View>
                </>
              )}
              {waypoints.length > 0 && (
                <>
                  <View
                    style={[styles.statDivider, { backgroundColor: colors.border }]}
                  />
                  <View style={styles.statItem}>
                    <Feather name="map-pin" size={16} color="#F59E0B" />
                    <Text style={[styles.statValue, { color: colors.foreground }]}>
                      {waypoints.length}
                    </Text>
                    <Text
                      style={[styles.statUnit, { color: colors.mutedForeground }]}
                    >
                      {waypoints.length === 1 ? t("detail.stop") : t("detail.stops")}
                    </Text>
                  </View>
                </>
              )}
              {trip.edited && (
                <>
                  <View
                    style={[styles.statDivider, { backgroundColor: colors.border }]}
                  />
                  <View style={styles.statItem}>
                    <Feather name="edit" size={14} color="#C98A00" />
                    <Text style={[styles.statValue, { color: "#C98A00", fontSize: 12 }]}>
                      {t("detail.edited")}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Note section */}
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}
            >
              {t("detail.noteLabel")}
            </Text>
            <View style={[styles.noteCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <TextInput
                ref={noteInputRef}
                style={[styles.noteInput, { color: colors.foreground }]}
                value={noteText}
                onChangeText={(v) => { setNoteText(v); setNoteSaved(false); }}
                placeholder={t("detail.notePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
                scrollEnabled={false}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                }}
              />
              {noteChanged && (
                <TouchableOpacity
                  style={[styles.noteSaveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveNote}
                >
                  <Feather name="check" size={13} color="#FFF" />
                  <Text style={styles.noteSaveBtnText}>{t("common.save")}</Text>
                </TouchableOpacity>
              )}
              {noteSaved && !noteChanged && (
                <View style={[styles.noteSavedRow]}>
                  <Feather name="check-circle" size={13} color={colors.success} />
                  <Text style={[styles.noteSavedText, { color: colors.success }]}>{t("detail.noteSaved")}</Text>
                </View>
              )}
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeFullBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.closeFullBtnText, { color: colors.foreground }]}>
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  typeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 13,
    fontWeight: "500",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  mapWrapper: {
    position: "relative",
  },
  mapTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  expandBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  stationsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  stationRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stationPin: {
    width: 20,
    alignItems: "center",
    paddingTop: 2,
    flexShrink: 0,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pinDotHollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  waypointIcon: {
    marginTop: 0,
  },
  stationConnector: {
    height: 14,
    marginLeft: 9,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
  },
  stationText: {
    flex: 1,
    gap: 2,
  },
  stationLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  stationAddr: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  wpNoteText: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "space-around",
    gap: 4,
  },
  statItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 36,
    flexShrink: 0,
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  noteInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    padding: 0,
  },
  noteSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-end",
  },
  noteSaveBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  noteSavedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  noteSavedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  closeFullBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  closeFullBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  noteBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  noteBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
});
