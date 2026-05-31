import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { Trip, useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import TripRouteMap from "@/components/TripRouteMap";

interface Props {
  trip: Trip;
  onDelete?: (id: string) => void;
  onEdit?: (trip: Trip) => void;
  onView?: (trip: Trip) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRetrySync?: (id: string) => Promise<boolean>;
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
  onView,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onRetrySync,
}: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const { syncRetryingIds, editTrip } = useApp();
  const isBusiness = trip.type === "business";
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const syncErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBackgroundSyncing = syncRetryingIds.has(trip.id);
  const [expanded, setExpanded] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const mountedRef = useRef(true);

  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteText, setNoteText] = useState(trip.note ?? "");

  const mapHeight = useSharedValue(0);
  const mapOpacity = useSharedValue(0);

  const mapAnimStyle = useAnimatedStyle(() => ({
    maxHeight: mapHeight.value,
    opacity: mapOpacity.value,
    overflow: "hidden",
  }));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showNoteSheet) setNoteText(trip.note ?? "");
  }, [trip.note, showNoteSheet]);

  const accentColor = isBusiness ? colors.primary : colors.success;
  const accentBg = isBusiness ? "#EEF3FF" : "#ECFDF5";
  const dur = fmtDurMin(trip.dur);

  const handleDelete = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("trip.delete.title"),
      t("trip.delete.message"),
      [
        { text: t("trip.delete.cancel"), style: "cancel" },
        {
          text: t("trip.delete.confirm"),
          style: "destructive",
          onPress: () => onDelete?.(trip.id),
        },
      ]
    );
  };

  const handleEdit = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onEdit?.(trip);
  };

  const handleView = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onView?.(trip);
  };

  const handleCardPress = () => {
    if (!selectionMode) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onToggleSelect?.(trip.id);
  };

  const handleToggleExpand = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (!expanded) {
      setExpanded(true);
      setMapMounted(true);
      mapHeight.value = withTiming(300, { duration: 320 });
      mapOpacity.value = withTiming(1, { duration: 320 });
    } else {
      setExpanded(false);
      mapHeight.value = withTiming(0, { duration: 280 });
      mapOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setMapMounted)(false);
      });
    }
  };

  const handleNoteOpen = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setNoteText(trip.note ?? "");
    setShowNoteSheet(true);
  };

  const handleNoteSave = () => {
    editTrip(trip.id, { note: noteText.trim() });
    setShowNoteSheet(false);
  };

  return (
    <>
      <Pressable
        onPress={selectionMode ? undefined : handleToggleExpand}
        style={[
          styles.card,
          {
            backgroundColor: selected ? "#EEF3FF" : colors.card,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 1.5 : 1,
          },
        ]}
      >
        {selectionMode && (
          <Pressable
            onPress={handleCardPress}
            style={[StyleSheet.absoluteFillObject, styles.selectionOverlay]}
          />
        )}

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

        <View style={[styles.leftBar, { backgroundColor: colors.primary }]} />

        <View style={styles.inner}>
          {/* Top row: type badge + time + actions */}
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
                  {onView && (
                    <TouchableOpacity
                      onPress={handleView}
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      testID={`view-${trip.id}`}
                    >
                      <Feather name="map" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleEdit}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    testID={`edit-${trip.id}`}
                  >
                    <Feather name="edit-2" size={13} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNoteOpen}
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: trip.note ? colors.primary : colors.border,
                        backgroundColor: trip.note ? colors.accent : "transparent",
                      },
                    ]}
                    testID={`note-${trip.id}`}
                  >
                    <Feather
                      name="file-text"
                      size={13}
                      color={trip.note ? colors.primary : colors.mutedForeground}
                    />
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addrWaypointText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {`${t("waypoint.label")} ${idx + 1}: ${wp.addr}`}
                    </Text>
                    {!!wp.note && (
                      <Text style={[styles.waypointNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {wp.note}
                      </Text>
                    )}
                  </View>
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

          {/* Note preview */}
          {!!trip.note && (
            <TouchableOpacity
              style={[styles.notePreviewRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={handleNoteOpen}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={11} color={colors.mutedForeground} />
              <Text style={[styles.notePreviewText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {trip.note}
              </Text>
            </TouchableOpacity>
          )}

          {/* Bottom row: km + duration + badges + expand toggle */}
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
            <View style={styles.badgeRow}>
              {trip.waypointSyncPending && (
                onRetrySync ? (
                  <TouchableOpacity
                    onPress={async () => {
                      if (isSyncing || isBackgroundSyncing) return;
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setIsSyncing(true);
                      setSyncError(false);
                      if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
                      try {
                        const succeeded = await onRetrySync(trip.id);
                        if (!succeeded && mountedRef.current) {
                          setSyncError(true);
                          syncErrorTimerRef.current = setTimeout(() => {
                            if (mountedRef.current) setSyncError(false);
                          }, 4000);
                        }
                      } finally {
                        if (mountedRef.current) setIsSyncing(false);
                      }
                    }}
                    style={[
                      styles.syncBadge,
                      (isSyncing || isBackgroundSyncing)
                        ? { backgroundColor: "#FFF8F0", borderColor: "#FFA040" }
                        : { backgroundColor: "#FFF3E0", borderColor: "#FB8C00" },
                    ]}
                    activeOpacity={(isSyncing || isBackgroundSyncing) ? 1 : 0.7}
                    disabled={isSyncing || isBackgroundSyncing}
                  >
                    {(isSyncing || isBackgroundSyncing) ? (
                      <ActivityIndicator size={11} color="#E65100" />
                    ) : (
                      <Feather name="upload-cloud" size={11} color="#E65100" />
                    )}
                    <Text style={[styles.syncBadgeText, { color: "#E65100" }]}>
                      {(isSyncing || isBackgroundSyncing) ? t("trip.syncRetrying") : t("trip.syncPending")}
                    </Text>
                  </TouchableOpacity>
                ) : isBackgroundSyncing ? (
                  <View style={[styles.syncBadge, { backgroundColor: "#FFF8F0", borderColor: "#FFA040" }]}>
                    <ActivityIndicator size={11} color="#E65100" />
                    <Text style={[styles.syncBadgeText, { color: "#E65100" }]}>{t("trip.syncRetrying")}</Text>
                  </View>
                ) : (
                  <View style={[styles.syncBadge, { backgroundColor: "#FFF3E0", borderColor: "#FB8C00" }]}>
                    <Feather name="upload-cloud" size={11} color="#E65100" />
                    <Text style={[styles.syncBadgeText, { color: "#E65100" }]}>{t("trip.syncPending")}</Text>
                  </View>
                )
              )}
              {trip.edited && (
                <View style={[styles.editedBadge, { backgroundColor: "#FFF8E7", borderColor: "#FFB703" }]}>
                  <Feather name="edit" size={11} color="#C98A00" />
                  <Text style={[styles.editedText, { color: "#C98A00" }]}>Bearbeitet</Text>
                </View>
              )}
            </View>
          </View>

          {syncError && (
            <View style={styles.syncErrorRow}>
              <Feather name="alert-circle" size={12} color="#C62828" />
              <Text style={styles.syncErrorText}>{t("trip.syncFailed")}</Text>
            </View>
          )}

          {!selectionMode && (
            <Animated.View style={[styles.mapSection, mapAnimStyle]}>
              {mapMounted && <TripRouteMap trip={trip} />}
            </Animated.View>
          )}
        </View>
      </Pressable>

      {/* Note editing sheet */}
      <Modal
        visible={showNoteSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.noteSheetOverlay}
        >
          <View style={[styles.noteSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.noteSheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.noteSheetHeader}>
              <View style={[styles.noteSheetIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="file-text" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noteSheetTitle, { color: colors.foreground }]}>Notiz</Text>
                <Text style={[styles.noteSheetSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {trip.startAddr ? `${trip.startAddr.substring(0, 28)}…` : trip.date}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowNoteSheet(false)} style={[styles.noteSheetClose, { borderColor: colors.border }]}>
                <Feather name="x" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.noteSheetInput,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Notiz zur Fahrt hinzufügen …"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.noteSheetSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleNoteSave}
            >
              <Feather name="check" size={15} color="#FFF" />
              <Text style={styles.noteSheetSaveBtnText}>Speichern</Text>
            </TouchableOpacity>

            {!!trip.note && (
              <TouchableOpacity
                style={[styles.noteSheetDeleteBtn]}
                onPress={() => {
                  editTrip(trip.id, { note: "" });
                  setShowNoteSheet(false);
                }}
              >
                <Text style={[styles.noteSheetDeleteText, { color: colors.destructive }]}>
                  Notiz löschen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  selectionOverlay: {
    zIndex: 1,
    borderRadius: 14,
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
    gap: 5,
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
  },
  waypointNote: {
    fontSize: 11,
    fontStyle: "italic",
    opacity: 0.75,
    marginTop: 1,
  },
  notePreviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: -2,
  },
  notePreviewText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontStyle: "italic",
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncBadgeText: {
    fontSize: 11,
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
  mapSection: {
    marginTop: 2,
  },
  syncErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -4,
  },
  syncErrorText: {
    fontSize: 11,
    color: "#C62828",
    fontWeight: "500",
    flexShrink: 1,
  },
  noteSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  noteSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },
  noteSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  noteSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noteSheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  noteSheetTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  noteSheetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  noteSheetClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  noteSheetInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: "top",
  },
  noteSheetSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  noteSheetSaveBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  noteSheetDeleteBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  noteSheetDeleteText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
