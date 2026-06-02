import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

const C = colors.light;

const TRIPS = [
  {
    id: "1",
    type: "business" as const,
    startAddr: "Maximilianstraße 22, München",
    endAddr: "Sachsenhäuser Ufer 4, Frankfurt",
    date: "02.06.2026",
    time: "09:15",
    endTime: "14:32",
    km: "347,0",
    dur: "5h 17min",
    note: "",
  },
  {
    id: "2",
    type: "private" as const,
    startAddr: "Zuhause, Grünwalder Str. 5",
    endAddr: "EDEKA Markt, Rosenheimer Str.",
    date: "01.06.2026",
    time: "17:42",
    endTime: "17:58",
    km: "8,3",
    dur: "16 min",
    note: "",
  },
  {
    id: "3",
    type: "business" as const,
    startAddr: "Hotel Kempinski, Essen",
    endAddr: "Flughafen Frankfurt (FRA)",
    date: "01.06.2026",
    time: "07:10",
    endTime: "08:45",
    km: "42,1",
    dur: "1h 35min",
    note: "Früher Flug nach München",
  },
  {
    id: "4",
    type: "business" as const,
    startAddr: "Flughafen Frankfurt (FRA)",
    endAddr: "Büro München, Leopoldstr. 10",
    date: "01.06.2026",
    time: "17:20",
    endTime: "19:05",
    km: "345,0",
    dur: "1h 45min",
    note: "",
  },
  {
    id: "5",
    type: "business" as const,
    startAddr: "Büro München, Leopoldstr. 10",
    endAddr: "Audi AG, Ingolstadt",
    date: "31.05.2026",
    time: "08:30",
    endTime: "09:45",
    km: "84,7",
    dur: "1h 15min",
    note: "",
  },
];

function TripRow({
  trip,
}: {
  trip: (typeof TRIPS)[number];
}) {
  const isBusiness = trip.type === "business";
  const accentColor = isBusiness ? C.primary : C.success;
  const accentBg = isBusiness ? "#EEF3FF" : "#ECFDF5";
  return (
    <View style={[styles.tripCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[styles.leftBar, { backgroundColor: accentColor }]} />
      <View style={styles.tripInner}>
        <View style={styles.tripTopRow}>
          <View style={[styles.typeBadge, { backgroundColor: accentBg }]}>
            <Feather name={isBusiness ? "briefcase" : "user"} size={12} color={accentColor} />
            <Text style={[styles.typeText, { color: accentColor }]}>
              {isBusiness ? "Geschäftlich" : "Privat"}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: C.mutedForeground }]}>
            {trip.time} – {trip.endTime}
          </Text>
        </View>
        <View style={styles.addrSection}>
          <View style={styles.addrRow}>
            <View style={[styles.dot, { backgroundColor: C.primary }]} />
            <Text style={[styles.addrText, { color: C.foreground }]} numberOfLines={1}>
              {trip.startAddr}
            </Text>
          </View>
          <View style={[styles.connector, { borderLeftColor: C.border }]} />
          <View style={styles.addrRow}>
            <View style={[styles.dotHollow, { borderColor: C.mutedForeground }]} />
            <Text style={[styles.addrText, { color: C.foreground }]} numberOfLines={1}>
              {trip.endAddr}
            </Text>
          </View>
        </View>
        {!!trip.note && (
          <View style={[styles.noteRow, { backgroundColor: C.secondary, borderColor: C.border }]}>
            <Feather name="file-text" size={11} color={C.mutedForeground} />
            <Text style={[styles.noteText, { color: C.mutedForeground }]} numberOfLines={1}>
              {trip.note}
            </Text>
          </View>
        )}
        <View style={styles.tripBottomRow}>
          <View style={styles.metaRow}>
            <Feather name="navigation" size={12} color={C.primary} />
            <Text style={[styles.metaText, { color: C.foreground }]}>{trip.km} km</Text>
            <Feather name="clock" size={12} color={C.mutedForeground} style={{ marginLeft: 8 }} />
            <Text style={[styles.metaText, { color: C.mutedForeground }]}>{trip.dur}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function StatBox({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <View style={[styles.statBox, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.statLabel, { color: C.mutedForeground }]}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={[styles.statValue, { color: C.foreground }]}>{value}</Text>
        {unit && <Text style={[styles.statUnit, { color: C.mutedForeground }]}>{unit}</Text>}
      </View>
      <View style={[styles.statAccent, { backgroundColor: accent ?? C.primary }]} />
    </View>
  );
}

function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View>
          <Text style={[styles.greeting, { color: C.mutedForeground }]}>Willkommen zurück</Text>
          <Text style={[styles.userName, { color: C.foreground }]}>Max Mustermann</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.plateBadge, { backgroundColor: C.secondary, borderColor: C.border }]}>
            <MaterialCommunityIcons name="car" size={14} color={C.primary} />
            <Text style={[styles.plateText, { color: C.sub }]}>M-FD 2026</Text>
          </View>
        </View>
      </View>

      <View style={[styles.activePill, { backgroundColor: C.successLight }]}>
        <View style={[styles.activeDot, { backgroundColor: C.success }]} />
        <Text style={[styles.activePillText, { color: C.success }]}>Fahrterkennung aktiv</Text>
      </View>

      <View style={[styles.quickStartCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.foreground }]}>Neue Fahrt</Text>
        <View style={styles.quickStartButtons}>
          <View style={[styles.qsBtn, { backgroundColor: C.primary }]}>
            <Feather name="briefcase" size={16} color="#fff" />
            <Text style={styles.qsBtnText}>Geschäftlich</Text>
          </View>
          <View style={[styles.qsBtn, { backgroundColor: C.secondary, borderWidth: 1, borderColor: C.border }]}>
            <Feather name="user" size={16} color={C.foreground} />
            <Text style={[styles.qsBtnText, { color: C.foreground }]}>Privat</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatBox label="DIESE WOCHE" value="347" unit="km" accent={C.primary} />
        <StatBox label="FAHRTEN" value="12" unit="Monat" accent={C.success} />
        <StatBox label="GESCH." value="83%" accent={C.primary} />
      </View>

      <Text style={[styles.sectionTitle, { color: C.foreground, marginHorizontal: 16, marginTop: 20, marginBottom: 8 }]}>
        Letzte Fahrten
      </Text>
      {TRIPS.slice(0, 3).map((t) => <TripRow key={t.id} trip={t} />)}
    </ScrollView>
  );
}

function ActiveTripScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.userName, { color: C.foreground }]}>Fahrt läuft…</Text>
      </View>
      <View style={styles.timerSection}>
        <View style={[styles.timerRing, { borderColor: C.success + "33" }]}>
          <View style={[styles.timerRingInner, { borderColor: C.success + "66" }]}>
            <View style={[styles.timerDot, { backgroundColor: C.success }]}>
              <MaterialCommunityIcons name="car" size={36} color="#fff" />
            </View>
          </View>
        </View>
        <Text style={[styles.timerText, { color: C.foreground }]}>00:23:47</Text>
        <Text style={[styles.timerLabel, { color: C.mutedForeground }]}>Fahrzeit</Text>
      </View>
      <View style={[styles.addrCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.addrCardRow}>
          <View style={[styles.addrDotLarge, { backgroundColor: C.primary }]} />
          <View style={styles.addrCardText}>
            <Text style={[styles.addrCardLabel, { color: C.mutedForeground }]}>Startpunkt</Text>
            <Text style={[styles.addrCardValue, { color: C.foreground }]}>Maximilianstraße 22, München</Text>
          </View>
        </View>
      </View>
      <View style={styles.statsRow}>
        <StatBox label="STRECKE" value="47,3" unit="km" accent={C.primary} />
        <StatBox label="TEMPO" value="147" unit="km/h" accent={C.success} />
        <StatBox label="GPS-PUNKTE" value="284" accent={C.primary} />
      </View>
      <View style={[styles.typeToggle, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.foreground }]}>Fahrtzweck</Text>
        <View style={styles.typeToggleButtons}>
          <View style={[styles.typeToggleBtn, { backgroundColor: C.primary }]}>
            <Text style={styles.typeToggleBtnText}>Geschäftlich</Text>
          </View>
          <View style={[styles.typeToggleBtn, { backgroundColor: C.secondary, borderWidth: 1, borderColor: C.border }]}>
            <Text style={[styles.typeToggleBtnText, { color: C.mutedForeground }]}>Privat</Text>
          </View>
        </View>
      </View>
      <View style={[styles.stopBtn, { backgroundColor: C.destructive }]}>
        <Feather name="square" size={18} color="#fff" />
        <Text style={styles.stopBtnText}>Fahrt beenden</Text>
      </View>
      <View style={[styles.mapPreview, { backgroundColor: C.secondary, borderColor: C.border }]}>
        <Feather name="map" size={20} color={C.mutedForeground} />
        <Text style={[styles.mapPreviewText, { color: C.mutedForeground }]}>Routenvorschau</Text>
      </View>
    </ScrollView>
  );
}

function HistoryScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.userName, { color: C.foreground }]}>Fahrten</Text>
        <View style={[styles.filterPill, { backgroundColor: C.secondary, borderColor: C.border }]}>
          <Feather name="filter" size={13} color={C.mutedForeground} />
          <Text style={[styles.filterText, { color: C.mutedForeground }]}>Alle Fahrten</Text>
          <Feather name="chevron-down" size={13} color={C.mutedForeground} />
        </View>
      </View>
      <View style={[styles.monthBanner, { backgroundColor: C.accent, borderColor: C.primary + "33" }]}>
        <View>
          <Text style={[styles.monthTitle, { color: C.primary }]}>Juni 2026</Text>
          <Text style={[styles.monthSub, { color: C.mutedForeground }]}>23 Fahrten · 1.847 km · 1.530 km geschäftlich</Text>
        </View>
        <View style={[styles.exportBtn, { backgroundColor: C.primary }]}>
          <Feather name="download" size={13} color="#fff" />
          <Text style={styles.exportBtnText}>Export</Text>
        </View>
      </View>
      <Text style={[styles.dateHeader, { color: C.mutedForeground }]}>HEUTE, 2. JUNI</Text>
      <TripRow trip={TRIPS[0]} />
      <TripRow trip={TRIPS[1]} />
      <Text style={[styles.dateHeader, { color: C.mutedForeground }]}>GESTERN, 1. JUNI</Text>
      <TripRow trip={TRIPS[2]} />
      <TripRow trip={TRIPS[3]} />
      <Text style={[styles.dateHeader, { color: C.mutedForeground }]}>31. MAI</Text>
      <TripRow trip={TRIPS[4]} />
    </ScrollView>
  );
}

function ExportScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.userName, { color: C.foreground }]}>Export</Text>
      </View>
      <View style={[styles.pdfPreviewCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[styles.pdfHeader, { backgroundColor: C.primary }]}>
          <Text style={styles.pdfHeaderText}>FahrtDoc – Fahrtenbuch</Text>
          <Text style={styles.pdfHeaderSub}>Juni 2026</Text>
        </View>
        <View style={[styles.pdfRow, { backgroundColor: "#F7F9FC" }]}>
          <Text style={[styles.pdfDate, { color: C.foreground }]}>02.06.</Text>
          <Text style={[styles.pdfRoute, { color: C.sub }]}>Büro München → Frankfurt</Text>
          <Text style={[styles.pdfKm, { color: C.foreground }]}>347,0 km</Text>
        </View>
        <View style={[styles.pdfRow, { backgroundColor: C.card }]}>
          <Text style={[styles.pdfDate, { color: C.foreground }]}>01.06.</Text>
          <Text style={[styles.pdfRoute, { color: C.sub }]}>Hotel Essen → FRA</Text>
          <Text style={[styles.pdfKm, { color: C.foreground }]}>42,1 km</Text>
        </View>
        <View style={[styles.pdfRow, { backgroundColor: "#F7F9FC" }]}>
          <Text style={[styles.pdfDate, { color: C.foreground }]}>31.05.</Text>
          <Text style={[styles.pdfRoute, { color: C.sub }]}>Büro → Audi, Ingolstadt</Text>
          <Text style={[styles.pdfKm, { color: C.foreground }]}>84,7 km</Text>
        </View>
        <View style={[styles.pdfRow, { backgroundColor: C.card }]}>
          <Text style={[styles.pdfDate, { color: C.foreground }]}>30.05.</Text>
          <Text style={[styles.pdfRoute, { color: C.sub }]}>Büro → Kunde Stuttgart</Text>
          <Text style={[styles.pdfKm, { color: C.foreground }]}>225,0 km</Text>
        </View>
        <View style={[styles.pdfSummary, { backgroundColor: C.secondary, borderColor: C.border }]}>
          <Text style={[styles.pdfSummaryText, { color: C.foreground }]}>
            Gesamt: 1.847 km · Geschäftlich: 1.530 km · Privat: 317 km
          </Text>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: C.foreground, marginHorizontal: 16, marginTop: 20, marginBottom: 8 }]}>
        Exportformat
      </Text>
      <View style={styles.exportFormatRow}>
        <View style={[styles.formatCard, { backgroundColor: C.primary }]}>
          <Text style={styles.formatIcon}>📄</Text>
          <Text style={styles.formatTitle}>PDF</Text>
          <Text style={styles.formatSub}>Steuerlich anerkannt</Text>
        </View>
        <View style={[styles.formatCard, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={styles.formatIcon}>📊</Text>
          <Text style={[styles.formatTitle, { color: C.foreground }]}>CSV</Text>
          <Text style={[styles.formatSub, { color: C.mutedForeground }]}>Für Excel / Numbers</Text>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: C.foreground, marginHorizontal: 16, marginTop: 20, marginBottom: 8 }]}>
        Zeitraum
      </Text>
      <View style={[styles.dateRangeCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.dateRangeText, { color: C.foreground }]}>01.06.2026</Text>
        <Text style={[styles.dateRangeSep, { color: C.mutedForeground }]}>–</Text>
        <Text style={[styles.dateRangeText, { color: C.foreground }]}>30.06.2026</Text>
      </View>
      <View style={styles.filterPillsRow}>
        <View style={[styles.filterPillBtn, { backgroundColor: C.primary }]}>
          <Text style={styles.filterPillBtnText}>Alle</Text>
        </View>
        <View style={[styles.filterPillBtn, { backgroundColor: C.secondary, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={[styles.filterPillBtnText, { color: C.foreground }]}>Geschäftlich</Text>
        </View>
        <View style={[styles.filterPillBtn, { backgroundColor: C.secondary, borderColor: C.border, borderWidth: 1 }]}>
          <Text style={[styles.filterPillBtnText, { color: C.foreground }]}>Privat</Text>
        </View>
      </View>
      <View style={[styles.shareBtn, { backgroundColor: C.primary }]}>
        <Feather name="share-2" size={18} color="#fff" />
        <Text style={styles.shareBtnText}>Teilen &amp; Speichern</Text>
      </View>
    </ScrollView>
  );
}

function BottomNav({ active }: { active: "home" | "trips" | "profile" }) {
  const tabs = [
    { key: "home", icon: "home", label: "Übersicht" },
    { key: "trips", icon: "list", label: "Fahrten" },
    { key: "profile", icon: "user", label: "Profil" },
  ] as const;
  return (
    <View style={[styles.bottomNav, { backgroundColor: C.card, borderTopColor: C.border }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <View key={tab.key} style={styles.tabItem}>
            <Feather name={tab.icon} size={22} color={isActive ? C.primary : C.mutedForeground} />
            <Text style={[styles.tabLabel, { color: isActive ? C.primary : C.mutedForeground, fontWeight: isActive ? "700" : "400" }]}>
              {tab.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StorePreview() {
  const params = useLocalSearchParams<{ screen?: string }>();
  const screen = params.screen ?? "home";
  const insets = useSafeAreaInsets();

  const activeTab = screen === "history" ? "trips" : screen === "export" ? "profile" : "home";

  return (
    <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {Platform.OS !== "web" && <StatusBar barStyle="dark-content" backgroundColor={C.card} />}
      {screen === "home" && <HomeScreen />}
      {screen === "active" && <ActiveTripScreen />}
      {screen === "history" && <HistoryScreen />}
      {screen === "export" && <ExportScreen />}
      <BottomNav active={activeTab as "home" | "trips" | "profile"} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  greeting: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3, marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  headerRight: { alignItems: "flex-end", gap: 4 },
  plateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  plateText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activePillText: { fontSize: 13, fontWeight: "700" },
  quickStartCard: {
    margin: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  quickStartButtons: { flexDirection: "row", gap: 10 },
  qsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  qsBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 4 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    gap: 4,
  },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statUnit: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  statAccent: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, opacity: 0.5 },
  tripCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  leftBar: { width: 4 },
  tripInner: { flex: 1, padding: 12, gap: 8 },
  tripTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: { fontSize: 12, fontWeight: "700" },
  timeText: { fontSize: 12 },
  addrSection: { gap: 0 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotHollow: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, flexShrink: 0 },
  connector: { height: 12, borderLeftWidth: 1, marginLeft: 3.5, marginVertical: 1 },
  addrText: { fontSize: 13, fontWeight: "500", flex: 1 },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  noteText: { fontSize: 12, flex: 1, fontStyle: "italic" },
  tripBottomRow: { flexDirection: "row", alignItems: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "600" },
  timerSection: { alignItems: "center", paddingVertical: 28 },
  timerRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  timerRingInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timerDot: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: { fontSize: 44, fontWeight: "800", letterSpacing: 2, marginTop: 16 },
  timerLabel: { fontSize: 14, marginTop: 4 },
  addrCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  addrCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  addrDotLarge: { width: 16, height: 16, borderRadius: 8, flexShrink: 0 },
  addrCardText: { flex: 1 },
  addrCardLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  addrCardValue: { fontSize: 14, fontWeight: "600" },
  typeToggle: { margin: 16, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  typeToggleButtons: { flexDirection: "row", gap: 10 },
  typeToggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  typeToggleBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  stopBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  mapPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  mapPreviewText: { fontSize: 15, fontWeight: "600" },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },
  monthBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  monthTitle: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  monthSub: { fontSize: 12 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exportBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dateHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  pdfPreviewCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  pdfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pdfHeaderText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pdfHeaderSub: { color: "#93C5FD", fontSize: 12 },
  pdfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  pdfDate: { fontSize: 12, fontWeight: "700", width: 44 },
  pdfRoute: { fontSize: 12, flex: 1 },
  pdfKm: { fontSize: 12, fontWeight: "700" },
  pdfSummary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pdfSummaryText: { fontSize: 11, fontWeight: "600" },
  exportFormatRow: { flexDirection: "row", gap: 10, marginHorizontal: 16 },
  formatCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 6,
  },
  formatIcon: { fontSize: 28 },
  formatTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  formatSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, textAlign: "center" },
  dateRangeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  dateRangeText: { fontSize: 15, fontWeight: "700" },
  dateRangeSep: { fontSize: 18, fontWeight: "300" },
  filterPillsRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 16 },
  filterPillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterPillBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
  },
  shareBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11 },
});
