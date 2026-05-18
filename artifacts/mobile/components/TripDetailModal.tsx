import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TripRouteMap from "@/components/TripRouteMap";
import { Trip } from "@/context/AppContext";
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

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function TripDetailModal({ trip, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();

  if (!trip) return null;

  const locale = language === "en" ? "en-US" : "de-DE";
  const isBusiness = trip.type === "business";
  const accentColor = isBusiness ? colors.primary : colors.success;
  const accentBg = isBusiness ? "#EEF3FF" : "#ECFDF5";
  const dur = fmtDurMin(trip.dur);
  const waypoints = trip.waypoints ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
                {fmtDate(trip.date, locale)} · {fmtTime(trip.date)}
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
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Map */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              FAHRTROUTE
            </Text>
            <TripRouteMap trip={trip} />

            {/* Route summary */}
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.mutedForeground, marginTop: 20 },
              ]}
            >
              STATIONEN
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
                    Start
                  </Text>
                  <Text
                    style={[styles.stationAddr, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {trip.startAddr || "Startpunkt unbekannt"}
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
                    Ziel
                  </Text>
                  <Text
                    style={[styles.stationAddr, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {trip.endAddr || "Zielpunkt unbekannt"}
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
                  Strecke
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
                      Fahrzeit
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
                      {waypoints.length === 1 ? "Stopp" : "Stopps"}
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
                      Bearbeitet
                    </Text>
                  </View>
                </>
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
});
