import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "v2.4.1";
const PREF_DEFAULT_TRIP = "pref_default_trip_type";
const PREF_APP_LOCK = "pref_app_lock";
const PREF_TRACKING_AUTO = "pref_tracking_auto";
const PREF_TRACKING_GPS = "pref_tracking_gps";
const PREF_TRACKING_BG = "pref_tracking_bg";
const PREF_TRACKING_OFFLINE = "pref_tracking_offline";
const PREF_TRACKING_PAUSED = "pref_tracking_paused";

type TripType = "business" | "private";
type PwStep = "request" | "verify";

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "Systemeinstellung",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themePreference, setThemePreference } = useTheme();
  const { user, logout, updateProfile, requestPasswordChangeCode, confirmPasswordChange, isSynced } = useApp();

  const [defaultTripType, setDefaultTripType] = useState<TripType>("business");
  const [appLock, setAppLock] = useState(true);
  const [autoTracking, setAutoTracking] = useState(true);
  const [gpsTracking, setGpsTracking] = useState(true);
  const [bgTracking, setBgTracking] = useState(true);
  const [offlineStorage, setOfflineStorage] = useState(true);
  const [trackingPaused, setTrackingPaused] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPlate, setEditPlate] = useState(user?.plate ?? "");

  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [pwStep, setPwStep] = useState<PwStep>("request");
  const [pwCode, setPwCode] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwCodeSent, setPwCodeSent] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [trip, lock, auto, gps, bg, offline, paused] = await Promise.all([
        AsyncStorage.getItem(PREF_DEFAULT_TRIP),
        AsyncStorage.getItem(PREF_APP_LOCK),
        AsyncStorage.getItem(PREF_TRACKING_AUTO),
        AsyncStorage.getItem(PREF_TRACKING_GPS),
        AsyncStorage.getItem(PREF_TRACKING_BG),
        AsyncStorage.getItem(PREF_TRACKING_OFFLINE),
        AsyncStorage.getItem(PREF_TRACKING_PAUSED),
      ]);
      if (trip === "business" || trip === "private") setDefaultTripType(trip);
      setAppLock(lock !== "false");
      if (auto !== null) setAutoTracking(auto !== "false");
      if (gps !== null) setGpsTracking(gps !== "false");
      if (bg !== null) setBgTracking(bg !== "false");
      if (offline !== null) setOfflineStorage(offline !== "false");
      if (paused !== null) setTrackingPaused(paused === "true");
    };
    load();
  }, []);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const hapticSuccess = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDefaultTripType = async (t: TripType) => {
    setDefaultTripType(t);
    await AsyncStorage.setItem(PREF_DEFAULT_TRIP, t);
    haptic();
  };

  const handleAppLock = async (val: boolean) => {
    setAppLock(val);
    await AsyncStorage.setItem(PREF_APP_LOCK, val ? "true" : "false");
  };

  const handleAutoTracking = async (val: boolean) => {
    setAutoTracking(val);
    await AsyncStorage.setItem(PREF_TRACKING_AUTO, val ? "true" : "false");
    haptic();
  };

  const handleGpsTracking = async (val: boolean) => {
    setGpsTracking(val);
    await AsyncStorage.setItem(PREF_TRACKING_GPS, val ? "true" : "false");
    haptic();
  };

  const handleBgTracking = async (val: boolean) => {
    setBgTracking(val);
    await AsyncStorage.setItem(PREF_TRACKING_BG, val ? "true" : "false");
    haptic();
  };

  const handleOfflineStorage = async (val: boolean) => {
    setOfflineStorage(val);
    await AsyncStorage.setItem(PREF_TRACKING_OFFLINE, val ? "true" : "false");
    haptic();
  };

  const handleTrackingPaused = async (val: boolean) => {
    setTrackingPaused(val);
    await AsyncStorage.setItem(PREF_TRACKING_PAUSED, val ? "true" : "false");
    haptic();
  };

  const handleOpenEdit = () => {
    setEditName(user?.name ?? "");
    setEditPlate(user?.plate ?? "");
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editPlate.trim()) return;
    await updateProfile(editName.trim(), editPlate.trim().toUpperCase());
    setEditModalVisible(false);
    hapticSuccess();
  };

  const openPwModal = () => {
    setPwStep("request");
    setPwCode("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setPwCodeSent(false);
    setPwLoading(false);
    setPwModalVisible(true);
  };

  const closePwModal = () => {
    setPwModalVisible(false);
    setPwCode("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setPwCodeSent(false);
  };

  const handleRequestCode = async () => {
    setPwLoading(true);
    setPwError("");
    const result = await requestPasswordChangeCode();
    setPwLoading(false);
    if (!result.success) {
      setPwError(result.error ?? "Fehler beim Senden des Codes.");
      return;
    }
    setPwCodeSent(true);
    setPwStep("verify");
    setTimeout(() => codeInputRef.current?.focus(), 300);
  };

  const handleConfirmChange = async () => {
    if (pwCode.trim().length !== 6) {
      setPwError("Bitte gib den 6-stelligen Code ein.");
      return;
    }
    if (!pwNew.trim() || pwNew.length < 6) {
      setPwError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setPwLoading(true);
    setPwError("");
    const result = await confirmPasswordChange(pwCode.trim(), pwNew);
    setPwLoading(false);
    if (!result.success) {
      setPwError(result.error ?? "Code ungültig. Bitte erneut versuchen.");
      return;
    }
    closePwModal();
    hapticSuccess();
    Alert.alert("Passwort geändert", "Dein Passwort wurde erfolgreich aktualisiert.");
  };

  const handleLogout = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Abmelden", "Wirklich abmelden?", [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]);
    } else {
      logout().then(() => router.replace("/"));
    }
  };

  const showComingSoon = () =>
    Alert.alert("Demnächst", "Diese Funktion wird in einer zukünftigen Version verfügbar sein.");

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ─── Header ─── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 14,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            shadowColor: "#000",
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profil</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.accent }]}
            onPress={() => setThemeModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={
                themePreference === "dark"
                  ? "moon"
                  : themePreference === "light"
                  ? "sun"
                  : "monitor"
              }
              size={17}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.accent }]}
            onPress={showComingSoon}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="settings" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* ─── Profilkarte ─── */}
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {user?.email}
            </Text>
            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: colors.primary }]}
              onPress={handleOpenEdit}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>
                Profil bearbeiten
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Status-Karte ─── */}
          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.statusCell, { borderRightColor: colors.border }]}>
              <Feather name="credit-card" size={15} color={colors.mutedForeground} />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
                Kennzeichen
              </Text>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>
                {user?.plate || "–"}
              </Text>
            </View>
            <View style={[styles.statusCell, { borderRightColor: colors.border }]}>
              <Feather name="award" size={15} color={colors.primary} />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Konto</Text>
              <Text style={[styles.statusValue, { color: colors.primary, fontWeight: "700" }]}>
                Premium
              </Text>
            </View>
            <View style={styles.statusCell}>
              <Feather
                name="check-circle"
                size={15}
                color={isSynced ? colors.success : colors.mutedForeground}
              />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Sync</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: isSynced ? colors.success : colors.mutedForeground },
                ]}
              >
                {isSynced ? "Synchronisiert" : "Offline"}
              </Text>
            </View>
          </View>

          {/* ─── Konto ─── */}
          <SectionHeader label="Konto" colors={colors} />
          <View
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ListRow
              icon="user"
              label="Persönliche Daten"
              onPress={handleOpenEdit}
              colors={colors}
              showDivider
            />
            <ListRow
              icon="navigation"
              label="Fahrprofil & Fahrzeugdaten"
              onPress={showComingSoon}
              colors={colors}
            />
          </View>

          {/* ─── Tracking & Fahrterkennung ─── */}
          <SectionHeader label="Tracking & Fahrterkennung" colors={colors} />
          <View
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ToggleRow
              icon="radio"
              label="Automatisches Tracking"
              description="Fahrten automatisch erkennen und aufzeichnen"
              value={autoTracking}
              onValueChange={handleAutoTracking}
              colors={colors}
              showDivider
            />
            <ToggleRow
              icon="map-pin"
              label="GPS-Tracking"
              description="Standort während einer Fahrt erfassen"
              value={gpsTracking}
              onValueChange={handleGpsTracking}
              colors={colors}
              showDivider
            />
            <ToggleRow
              icon="layers"
              label="Hintergrund-Tracking"
              description="Fahrten auch bei geschlossener App erkennen"
              value={bgTracking}
              onValueChange={handleBgTracking}
              colors={colors}
              showDivider
            />
            <ToggleRow
              icon="database"
              label="Offline-Speicherung"
              description="Fahrten ohne Internet zwischenspeichern"
              value={offlineStorage}
              onValueChange={handleOfflineStorage}
              colors={colors}
              showDivider
            />
            <ToggleRow
              icon="pause-circle"
              label="Tracking pausieren"
              description="Aufzeichnung vorübergehend deaktivieren"
              value={trackingPaused}
              onValueChange={handleTrackingPaused}
              colors={colors}
              warningWhenOn
            />
          </View>

          {/* ─── Einstellungen ─── */}
          <SectionHeader label="Einstellungen" colors={colors} />
          <View
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ListRow
              icon="bell"
              label="Benachrichtigungen"
              onPress={showComingSoon}
              colors={colors}
              showDivider
            />
            <View
              style={[
                styles.listRow,
                styles.divider,
                { borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="navigation" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>
                Standard-Fahrtart
              </Text>
              <View
                style={[
                  styles.segmented,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segBtn,
                    defaultTripType === "business" && {
                      backgroundColor: colors.primary,
                      borderRadius: 8,
                    },
                  ]}
                  onPress={() => handleDefaultTripType("business")}
                >
                  <Text
                    style={[
                      styles.segBtnText,
                      {
                        color:
                          defaultTripType === "business" ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    Geschäftlich
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segBtn,
                    defaultTripType === "private" && {
                      backgroundColor: colors.primary,
                      borderRadius: 8,
                    },
                  ]}
                  onPress={() => handleDefaultTripType("private")}
                >
                  <Text
                    style={[
                      styles.segBtnText,
                      {
                        color:
                          defaultTripType === "private" ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    Privat
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ListRow
              icon="globe"
              label="Sprache"
              value="Deutsch"
              onPress={showComingSoon}
              colors={colors}
              showDivider
            />
            <ListRow
              icon={
                themePreference === "dark"
                  ? "moon"
                  : themePreference === "light"
                  ? "sun"
                  : "monitor"
              }
              label="Design"
              value={THEME_LABELS[themePreference]}
              onPress={() => setThemeModalVisible(true)}
              colors={colors}
            />
          </View>

          {/* ─── Sicherheit & Datenschutz ─── */}
          <SectionHeader label="Sicherheit & Datenschutz" colors={colors} />
          <View
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ListRow
              icon="lock"
              label="Passwort ändern"
              onPress={openPwModal}
              colors={colors}
              showDivider
            />
            <ListRow
              icon="shield"
              label="Datenschutz"
              onPress={showComingSoon}
              colors={colors}
              showDivider
            />
            <View style={styles.listRow}>
              <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="aperture" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listLabel, { color: colors.foreground }]}>
                  Face ID / App-Sperre
                </Text>
              </View>
              <Switch
                value={appLock}
                onValueChange={handleAppLock}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ─── Support ─── */}
          <SectionHeader label="Support" colors={colors} />
          <View
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ListRow
              icon="help-circle"
              label="Hilfe & FAQ"
              onPress={showComingSoon}
              colors={colors}
              showDivider
            />
            <ListRow
              icon="mail"
              label="Kontakt"
              onPress={showComingSoon}
              colors={colors}
              showDivider
            />
            <ListRow icon="info" label="App-Version" value={APP_VERSION} colors={colors} />
          </View>

          {/* ─── Abmelden ─── */}
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              { backgroundColor: colors.card, borderColor: colors.destructive },
            ]}
            onPress={handleLogout}
            testID="logout-btn"
          >
            <Feather name="log-out" size={17} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>Abmelden</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* Theme Picker Modal */}
      <Modal
        visible={themeModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View
            style={[
              styles.themePickerCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.themePickerTitle, { color: colors.foreground }]}>Design</Text>
            {(["light", "dark", "system"] as ThemePreference[]).map((opt) => {
              const icon = opt === "dark" ? "moon" : opt === "light" ? "sun" : "monitor";
              const active = themePreference === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.themeOption,
                    active && { backgroundColor: colors.accent },
                    { borderColor: active ? colors.primary : colors.border },
                  ]}
                  onPress={async () => {
                    await setThemePreference(opt);
                    haptic();
                    setThemeModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.themeOptionIcon,
                      { backgroundColor: active ? colors.primary : colors.secondary },
                    ]}
                  >
                    <Feather name={icon} size={17} color={active ? "#fff" : colors.mutedForeground} />
                  </View>
                  <Text
                    style={[
                      styles.themeOptionLabel,
                      { color: active ? colors.primary : colors.foreground, fontWeight: active ? "700" : "400" },
                    ]}
                  >
                    {THEME_LABELS[opt]}
                  </Text>
                  {active && (
                    <Feather name="check" size={17} color={colors.primary} style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Profil bearbeiten
            </Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Speichern</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModalField
              label="Name"
              value={editName}
              onChangeText={setEditName}
              icon="user"
              placeholder="Max Mustermann"
              colors={colors}
            />
            <ModalField
              label="Kennzeichen"
              value={editPlate}
              onChangeText={(t) => setEditPlate(t.toUpperCase())}
              icon="credit-card"
              placeholder="B-MM1234"
              autoCapitalize="characters"
              colors={colors}
            />
            <View
              style={[
                styles.infoNote,
                { backgroundColor: colors.accent, borderColor: colors.border },
              ]}
            >
              <Feather name="mail" size={14} color={colors.primary} />
              <Text style={[styles.infoNoteText, { color: colors.primary }]}>
                E-Mail: {user?.email}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={pwModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity onPress={closePwModal} disabled={pwLoading}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Passwort ändern
            </Text>
            <View style={{ width: 70 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stepRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepDotText}>{pwStep === "request" ? "1" : "✓"}</Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color:
                        pwStep === "request" ? colors.foreground : colors.mutedForeground,
                    },
                  ]}
                >
                  Code anfordern
                </Text>
              </View>
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: pwStep === "verify" ? colors.primary : colors.border },
                ]}
              />
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        pwStep === "verify" ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepDotText,
                      {
                        color:
                          pwStep === "verify" ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    2
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color:
                        pwStep === "verify" ? colors.foreground : colors.mutedForeground,
                    },
                  ]}
                >
                  Code & Passwort
                </Text>
              </View>
            </View>

            {pwStep === "request" ? (
              <>
                <View
                  style={[
                    styles.infoNote,
                    { backgroundColor: colors.accent, borderColor: colors.border },
                  ]}
                >
                  <Feather name="mail" size={15} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoNoteText, { color: colors.primary }]}>
                      Ein 6-stelliger Code wird an deine E-Mail-Adresse gesendet:
                    </Text>
                    <Text style={[styles.infoNoteEmail, { color: colors.primary }]}>
                      {user?.email}
                    </Text>
                  </View>
                </View>
                {pwError !== "" && (
                  <View
                    style={[
                      styles.errorBox,
                      { backgroundColor: "#FFF0F3", borderColor: colors.destructive },
                    ]}
                  >
                    <Feather name="alert-circle" size={14} color={colors.destructive} />
                    <Text style={[styles.errorText, { color: colors.destructive }]}>
                      {pwError}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: pwLoading
                        ? colors.mutedForeground
                        : colors.primary,
                    },
                  ]}
                  onPress={handleRequestCode}
                  disabled={pwLoading}
                >
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {pwLoading ? "Senden…" : "Code per E-Mail senden"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.infoNote,
                    { backgroundColor: colors.successLight, borderColor: colors.success },
                  ]}
                >
                  <Feather name="check-circle" size={15} color={colors.success} />
                  <Text style={[styles.infoNoteText, { color: colors.success }]}>
                    Code gesendet an {user?.email}. Bitte prüfe deinen Posteingang.
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text
                    style={[
                      styles.modalFieldLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Bestätigungscode
                  </Text>
                  <TextInput
                    ref={codeInputRef}
                    style={[
                      styles.codeInput,
                      {
                        backgroundColor: colors.card,
                        borderColor:
                          pwCode.length === 6 ? colors.success : colors.border,
                        color: colors.foreground,
                      },
                    ]}
                    value={pwCode}
                    onChangeText={(t) => {
                      setPwCode(t.replace(/\D/g, "").slice(0, 6));
                      setPwError("");
                    }}
                    placeholder="000000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setPwStep("request");
                      setPwCode("");
                      setPwError("");
                    }}
                  >
                    <Text style={[styles.resendLink, { color: colors.primary }]}>
                      Neuen Code anfordern
                    </Text>
                  </TouchableOpacity>
                </View>

                <ModalField
                  label="Neues Passwort"
                  value={pwNew}
                  onChangeText={(t) => {
                    setPwNew(t);
                    setPwError("");
                  }}
                  icon="lock"
                  placeholder="Mindestens 6 Zeichen"
                  secureTextEntry
                  colors={colors}
                />
                <ModalField
                  label="Passwort bestätigen"
                  value={pwConfirm}
                  onChangeText={(t) => {
                    setPwConfirm(t);
                    setPwError("");
                  }}
                  icon="lock"
                  placeholder="Passwort wiederholen"
                  secureTextEntry
                  colors={colors}
                />

                {pwError !== "" && (
                  <View
                    style={[
                      styles.errorBox,
                      { backgroundColor: "#FFF0F3", borderColor: colors.destructive },
                    ]}
                  >
                    <Feather name="alert-circle" size={14} color={colors.destructive} />
                    <Text style={[styles.errorText, { color: colors.destructive }]}>
                      {pwError}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: pwLoading
                        ? colors.mutedForeground
                        : colors.primary,
                    },
                  ]}
                  onPress={handleConfirmChange}
                  disabled={pwLoading}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {pwLoading ? "Wird geändert…" : "Passwort ändern"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function ListRow({
  icon,
  label,
  value,
  onPress,
  colors,
  showDivider,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
  showDivider?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.listRow,
        showDivider && styles.divider,
        { borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
        <Feather name={icon as never} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      {value !== undefined && (
        <Text style={[styles.listValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && (
        <Feather
          name="chevron-right"
          size={16}
          color={colors.mutedForeground}
          style={{ marginLeft: 4 }}
        />
      )}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  colors,
  showDivider,
  warningWhenOn,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
  showDivider?: boolean;
  warningWhenOn?: boolean;
}) {
  const trackOn = warningWhenOn && value ? colors.warning : colors.primary;
  return (
    <View
      style={[
        styles.listRow,
        showDivider && styles.divider,
        { borderBottomColor: colors.border, alignItems: "center" },
      ]}
    >
      <View
        style={[
          styles.listIconWrap,
          { backgroundColor: value ? colors.accent : colors.secondary },
        ]}
      >
        <Feather
          name={icon as never}
          size={16}
          color={value ? (warningWhenOn ? colors.warning : colors.primary) : colors.mutedForeground}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.listLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.listDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: trackOn }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ModalField({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  autoCapitalize,
  secureTextEntry,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: string;
  placeholder?: string;
  autoCapitalize?: "none" | "characters" | "sentences";
  secureTextEntry?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.modalField}>
      <Text style={[styles.modalFieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.modalInputRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name={icon as never} size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.modalInput, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", gap: 8 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { padding: 16, gap: 8 },

  profileCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrap: { marginBottom: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  profileName: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  profileEmail: { fontSize: 14, marginBottom: 4 },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.2,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  editProfileBtnText: { fontSize: 14, fontWeight: "600" },

  statusCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statusCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 3,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusValue: { fontSize: 12, fontWeight: "600" },

  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 6,
  },

  listCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  listIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  listLabel: { fontSize: 15, fontWeight: "500" },
  listDesc: { fontSize: 12, lineHeight: 16 },
  listValue: { fontSize: 14 },

  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  segBtnText: { fontSize: 12, fontWeight: "600" },

  logoutBtn: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  themePickerCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  themePickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  themeOptionLabel: { fontSize: 15 },

  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalCancel: { fontSize: 15 },
  modalSave: { fontSize: 15, fontWeight: "600" },
  modalContent: { padding: 20, gap: 16 },
  modalField: { gap: 6 },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalInput: { flex: 1, fontSize: 15 },

  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoNoteText: { fontSize: 13, lineHeight: 18, flex: 1 },
  infoNoteEmail: { fontSize: 14, fontWeight: "700", marginTop: 3 },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepItem: { alignItems: "center", gap: 6, width: 120 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stepLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  stepLine: { flex: 1, height: 2, marginBottom: 24 },

  codeInput: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 12,
    textAlign: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  resendLink: { fontSize: 13, fontWeight: "600", textAlign: "right", marginTop: 6 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, flex: 1 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
