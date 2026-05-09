import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const fmtDur = (s: number) => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, trips } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [plate, setPlate] = useState(user?.plate ?? "");

  const totalKm = trips.reduce((a, b) => a + b.km, 0);
  const totalDur = trips.reduce((a, b) => a + b.dur, 0);
  const businessTrips = trips.filter((t) => t.type === "business");
  const businessKm = businessTrips.reduce((a, b) => a + b.km, 0);

  const handleSave = async () => {
    if (!name.trim() || !plate.trim()) return;
    await updateProfile(name.trim(), plate.trim().toUpperCase());
    setEditing(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExportEmail = () => {
    const total = trips.reduce((a, b) => a + b.km, 0);
    const dur = trips.reduce((a, b) => a + b.dur, 0);
    const body = trips
      .slice(0, 50)
      .map((t) => `${fmtDate(t.date)} | ${t.startAddr} → ${t.endAddr} | ${t.km.toFixed(1)}km | ${fmtDur(t.dur)} | ${t.type === "business" ? "Geschäftlich" : "Privat"}`)
      .join("\n");
    const text = `DriveLog Fahrtenbuch\nFahrer: ${user?.name}\nKennzeichen: ${user?.plate}\n\n${body}\n\nGesamt: ${total.toFixed(1)} km · ${fmtDur(dur)}`;

    if (Platform.OS === "web") {
      const mailto = `mailto:?subject=${encodeURIComponent("DriveLog Fahrtenbuch")}&body=${encodeURIComponent(text)}`;
      window.open(mailto);
    } else {
      Share.share({ message: text, title: "DriveLog Fahrtenbuch" });
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

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 90);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Profil</Text>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: editing ? colors.primary : colors.secondary, borderColor: editing ? colors.primary : colors.border }]}
            onPress={() => editing ? handleSave() : setEditing(true)}
          >
            <Feather name={editing ? "check" : "edit-2"} size={15} color={editing ? "#FFFFFF" : colors.foreground} />
            <Text style={[styles.editBtnText, { color: editing ? "#FFFFFF" : colors.foreground }]}>
              {editing ? "Speichern" : "Bearbeiten"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {/* Avatar + info */}
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(user?.name ?? "F").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            {!editing ? (
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
                <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
                <View style={[styles.plateBadge, { backgroundColor: colors.accent }]}>
                  <Feather name="truck" size={12} color={colors.primary} />
                  <Text style={[styles.plateText, { color: colors.primary }]}>{user?.plate}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.profileInfo, { gap: 10 }]}>
                <EditField label="Name" value={name} onChangeText={setName} icon="user" colors={colors} />
                <EditField label="Kennzeichen" value={plate} onChangeText={(t) => setPlate(t.toUpperCase())} icon="truck" autoCapitalize="characters" colors={colors} />
                <Text style={[styles.emailNote, { color: colors.mutedForeground }]}>
                  E-Mail: {user?.email}
                </Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Meine Statistiken</Text>
            <View style={styles.statsGrid}>
              <StatItem label="Gesamt km" value={totalKm.toFixed(0)} unit="km" color={colors.primary} colors={colors} />
              <StatItem label="Fahrten" value={String(trips.length)} color={colors.success} colors={colors} />
              <StatItem label="Geschäftl. km" value={businessKm.toFixed(0)} unit="km" color={colors.primary} colors={colors} />
              <StatItem label="Fahrzeit" value={fmtDur(totalDur)} color={colors.success} colors={colors} />
            </View>
          </View>

          {/* Export */}
          <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Export</Text>
            <TouchableOpacity
              style={[styles.actionRow, { borderBottomColor: colors.border }]}
              onPress={handleExportEmail}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <Feather name="mail" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>Per E-Mail teilen</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Alle {trips.length} Fahrten exportieren</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Logout */}
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
    </KeyboardAvoidingView>
  );
}

function StatItem({ label, value, unit, color, colors }: { label: string; value: string; unit?: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color }]}>
        {value}{unit ? ` ${unit}` : ""}
      </Text>
    </View>
  );
}

function EditField({ label, value, onChangeText, icon, keyboardType, autoCapitalize, colors }: {
  label: string; value: string; onChangeText: (t: string) => void; icon: string;
  keyboardType?: "email-address" | "default"; autoCapitalize?: "none" | "characters" | "sentences";
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name={icon as never} size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
          placeholderTextColor={colors.mutedForeground}
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
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileEmail: { fontSize: 14, marginTop: 2 },
  plateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  plateText: { fontSize: 13, fontWeight: "700" },
  emailNote: { fontSize: 12, marginTop: 2 },
  statsCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minWidth: "45%",
    flex: 1,
  },
  statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800" },
  actionsCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 14, fontWeight: "600" },
  actionSub: { fontSize: 12, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
  fieldLabel: { fontSize: 11, fontWeight: "600", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14 },
});
