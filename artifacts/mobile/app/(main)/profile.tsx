import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "v1.0.0";
const PREF_DEFAULT_TRIP = "pref_default_trip_type";
const PREF_APP_LOCK = "pref_app_lock";

type TripType = "business" | "private";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, updatePassword, isSynced } = useApp();

  const [defaultTripType, setDefaultTripType] = useState<TripType>("business");
  const [appLock, setAppLock] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPlate, setEditPlate] = useState(user?.plate ?? "");

  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREF_DEFAULT_TRIP).then((v) => {
      if (v === "business" || v === "private") setDefaultTripType(v);
    });
    AsyncStorage.getItem(PREF_APP_LOCK).then((v) => {
      if (v === "true") setAppLock(true);
    });
  }, []);

  const handleDefaultTripType = async (t: TripType) => {
    setDefaultTripType(t);
    await AsyncStorage.setItem(PREF_DEFAULT_TRIP, t);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const handleAppLock = async (val: boolean) => {
    setAppLock(val);
    await AsyncStorage.setItem(PREF_APP_LOCK, val ? "true" : "false");
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
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSavePassword = async () => {
    if (!pwNew.trim() || pwNew !== pwConfirm) {
      Alert.alert("Fehler", "Passwörter stimmen nicht überein.");
      return;
    }
    if (pwNew.length < 6) {
      Alert.alert("Fehler", "Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    setPwLoading(true);
    try {
      await updatePassword(user!.email, pwNew);
      setPwModalVisible(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Passwort geändert", "Dein Passwort wurde erfolgreich aktualisiert.");
    } catch {
      Alert.alert("Fehler", "Passwort konnte nicht geändert werden.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Abmelden", "Wirklich abmelden?", [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => { await logout(); router.replace("/"); },
        },
      ]);
    } else {
      logout().then(() => router.replace("/"));
    }
  };

  const showComingSoon = () =>
    Alert.alert("Demnächst", "Diese Funktion wird in einer zukünftigen Version verfügbar sein.");

  const initials = (user?.name ?? "?")
    .split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profil</Text>
        <TouchableOpacity onPress={showComingSoon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="settings" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>

          {/* Profile card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
                <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: colors.primary }]}
              onPress={handleOpenEdit}
            >
              <Feather name="edit-2" size={15} color={colors.primary} />
              <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>Profil bearbeiten</Text>
            </TouchableOpacity>
          </View>

          {/* Info bar */}
          <View style={[styles.infoBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoCell, { borderRightColor: colors.border }]}>
              <Feather name="credit-card" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoCellLabel, { color: colors.mutedForeground }]}>Kennzeichen</Text>
              <Text style={[styles.infoCellValue, { color: colors.foreground }]}>{user?.plate || "–"}</Text>
            </View>
            <View style={[styles.infoCell, { borderRightColor: colors.border }]}>
              <Feather name="award" size={16} color={colors.warning} />
              <Text style={[styles.infoCellLabel, { color: colors.mutedForeground }]}>Konto</Text>
              <Text style={[styles.infoCellValue, { color: colors.foreground, fontWeight: "700" }]}>Standard</Text>
            </View>
            <View style={styles.infoCell}>
              <Feather name="check-circle" size={16} color={isSynced ? colors.success : colors.mutedForeground} />
              <Text style={[styles.infoCellLabel, { color: colors.mutedForeground }]}>Sync-Status</Text>
              <Text style={[styles.infoCellValue, { color: isSynced ? colors.success : colors.mutedForeground }]}>
                {isSynced ? "Synchronisiert" : "Offline"}
              </Text>
            </View>
          </View>

          {/* Konto */}
          <SectionHeader label="Konto" colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow
              icon="user" label="Persönliche Daten"
              onPress={handleOpenEdit} colors={colors} showDivider
            />
            <ListRow
              icon="navigation" label="Fahrprofil & Fahrzeugdaten"
              onPress={showComingSoon} colors={colors}
            />
          </View>

          {/* Einstellungen */}
          <SectionHeader label="Einstellungen" colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow
              icon="bell" label="Benachrichtigungen"
              onPress={showComingSoon} colors={colors} showDivider
            />
            {/* Standard-Fahrtart segmented */}
            <View style={[styles.listRow, styles.divider, { borderBottomColor: colors.border }]}>
              <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="navigation" size={17} color={colors.primary} />
              </View>
              <Text style={[styles.listLabel, { color: colors.foreground }]}>Standard-Fahrtart</Text>
              <View style={[styles.segmented, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.segBtn,
                    defaultTripType === "business" && { backgroundColor: colors.primary, borderRadius: 8 },
                  ]}
                  onPress={() => handleDefaultTripType("business")}
                >
                  <Text style={[styles.segBtnText, { color: defaultTripType === "business" ? "#fff" : colors.mutedForeground }]}>
                    Geschäftlich
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segBtn,
                    defaultTripType === "private" && { backgroundColor: colors.primary, borderRadius: 8 },
                  ]}
                  onPress={() => handleDefaultTripType("private")}
                >
                  <Text style={[styles.segBtnText, { color: defaultTripType === "private" ? "#fff" : colors.mutedForeground }]}>
                    Privat
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ListRow
              icon="globe" label="Sprache" value="Deutsch"
              onPress={showComingSoon} colors={colors} showDivider
            />
            <ListRow
              icon="sun" label="Design" value="Hell"
              onPress={showComingSoon} colors={colors} showDivider
            />
            <ListRow
              icon="file-text" label="PDF / Export"
              onPress={showComingSoon} colors={colors}
            />
          </View>

          {/* Sicherheit & Datenschutz */}
          <SectionHeader label="Sicherheit & Datenschutz" colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow
              icon="lock" label="Passwort ändern"
              onPress={() => setPwModalVisible(true)} colors={colors} showDivider
            />
            <ListRow
              icon="shield" label="Datenschutz"
              onPress={showComingSoon} colors={colors} showDivider
            />
            {/* App-Sperre / Face ID */}
            <View style={styles.listRow}>
              <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="aperture" size={17} color={colors.primary} />
              </View>
              <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>Face ID / App-Sperre</Text>
              <Switch
                value={appLock}
                onValueChange={handleAppLock}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Support */}
          <SectionHeader label="Support" colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow
              icon="help-circle" label="Hilfe & FAQ"
              onPress={showComingSoon} colors={colors} showDivider
            />
            <ListRow
              icon="mail" label="Kontakt"
              onPress={showComingSoon} colors={colors} showDivider
            />
            <ListRow
              icon="info" label="App-Version" value={APP_VERSION}
              colors={colors}
            />
          </View>

          {/* Abmelden */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.destructive }]}
            onPress={handleLogout}
            testID="logout-btn"
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>Abmelden</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Abbrechen</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Profil bearbeiten</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Speichern</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModalField
              label="Name" value={editName} onChangeText={setEditName}
              icon="user" placeholder="Max Mustermann" colors={colors}
            />
            <ModalField
              label="Kennzeichen" value={editPlate}
              onChangeText={(t) => setEditPlate(t.toUpperCase())}
              icon="credit-card" placeholder="B-MM1234"
              autoCapitalize="characters" colors={colors}
            />
            <View style={[styles.infoNote, { backgroundColor: colors.accent, borderColor: colors.border }]}>
              <Feather name="mail" size={14} color={colors.primary} />
              <Text style={[styles.infoNoteText, { color: colors.primary }]}>E-Mail: {user?.email}</Text>
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
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setPwModalVisible(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Abbrechen</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Passwort ändern</Text>
            <TouchableOpacity onPress={handleSavePassword} disabled={pwLoading}>
              <Text style={[styles.modalSave, { color: pwLoading ? colors.mutedForeground : colors.primary }]}>
                {pwLoading ? "…" : "Speichern"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModalField
              label="Neues Passwort" value={pwNew} onChangeText={setPwNew}
              icon="lock" placeholder="Mindestens 6 Zeichen"
              secureTextEntry colors={colors}
            />
            <ModalField
              label="Passwort bestätigen" value={pwConfirm} onChangeText={setPwConfirm}
              icon="lock" placeholder="Passwort wiederholen"
              secureTextEntry colors={colors}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function ListRow({
  icon, label, value, onPress, colors, showDivider,
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
      style={[styles.listRow, showDivider && styles.divider, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
        <Feather name={icon as never} size={17} color={colors.primary} />
      </View>
      <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      {value !== undefined && (
        <Text style={[styles.listValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && <Feather name="chevron-right" size={17} color={colors.mutedForeground} style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );
}

function ModalField({
  label, value, onChangeText, icon, placeholder, autoCapitalize, secureTextEntry, colors,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  icon: string; placeholder?: string; autoCapitalize?: "none" | "characters" | "sentences";
  secureTextEntry?: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.modalField}>
      <Text style={[styles.modalFieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.modalInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  content: { padding: 16, gap: 8 },

  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 21, fontWeight: "800" },
  profileMeta: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  editProfileBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 10, borderWidth: 1.2,
    paddingVertical: 10,
  },
  editProfileBtnText: { fontSize: 14, fontWeight: "600" },

  infoBar: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", overflow: "hidden",
  },
  infoCell: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, gap: 3,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  infoCellLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  infoCellValue: { fontSize: 13, fontWeight: "600" },

  sectionHeader: {
    fontSize: 13, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 8, marginBottom: 2, marginLeft: 4,
  },
  listCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  listRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13, gap: 12,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  listIconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  listLabel: { fontSize: 15 },
  listValue: { fontSize: 14 },

  segmented: {
    flexDirection: "row", borderRadius: 10, borderWidth: 1,
    padding: 3, gap: 2,
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  segBtnText: { fontSize: 13, fontWeight: "600" },

  logoutBtn: {
    marginTop: 8, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
    borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },

  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalCancel: { fontSize: 15 },
  modalSave: { fontSize: 15, fontWeight: "600" },
  modalContent: { padding: 20, gap: 16 },
  modalField: { gap: 6 },
  modalFieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  modalInputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalInput: { flex: 1, fontSize: 15 },
  infoNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  infoNoteText: { fontSize: 13 },
});
