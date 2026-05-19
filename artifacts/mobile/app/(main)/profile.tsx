import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useLanguage, type Language } from "@/context/LanguageContext";

const APP_VERSION = "2.4.1";

const PREF = {
  autoTracking: "pref_auto_tracking",
  gpsTracking: "pref_gps_tracking",
  bgTracking: "pref_bg_tracking",
  offlineStorage: "pref_offline_storage",
  trackingPaused: "pref_tracking_paused",
  defaultTripType: "pref_default_trip_type",
  notifGeneral: "pref_notif_general",
  notifTrips: "pref_notif_trips",
  notifTracking: "pref_notif_tracking",
  notifGps: "pref_notif_gps",
  notifOffline: "pref_notif_offline",
  notifSync: "pref_notif_sync",
  notifLogin: "pref_notif_login",
  notifPrivacy: "pref_notif_datenschutz",
} as const;


const FAQ_DATA: { q: string; a: string }[] = [
    { q: "Wie starte ich eine neue Fahrt manuell?", a: "Oeffne den Tab Uebersicht und tippe auf die Schaltflaeche Fahrt starten. Du kannst Startort und Fahrtart auswaehlen, bevor die Aufzeichnung beginnt." },
    { q: "Wie aktiviere ich das automatische Tracking?", a: "Gehe zu Profil -> Tracking & Fahrterkennung und aktiviere Automatisches Tracking. Die App erkennt dann Fahrten selbststaendig anhand von Bewegungsmustern und GPS-Daten." },
    { q: "Kann ich eine abgeschlossene Fahrt bearbeiten?", a: "Ja. Oeffne die Fahrtenliste im Tab Fahrten, tippe auf die gewuenschte Fahrt und waehle Bearbeiten. Du kannst Start- und Zielort, Datum, Uhrzeit, Zweck sowie die Fahrtklassifikation aendern." },
    { q: "Wie loesche ich eine Fahrt?", a: "In der Fahrtenliste tippst du auf die Fahrt und waehlst Loeschen. Du wirst zur Bestaetigung aufgefordert. Geloeschte Fahrten koennen nicht wiederhergestellt werden." },
    { q: "Warum werden manche Fahrten nicht automatisch erkannt?", a: "Das automatische Tracking benoetigt ausreichende GPS-Signalstaerke. Pruefe, ob GPS- und Hintergrund-Tracking aktiviert sind und ob die App Standortberechtigungen hat." },
    { q: "Wie funktioniert die GPS-Aufzeichnung?", a: "Die App zeichnet in regelmaessigen Abstaenden GPS-Koordinaten auf und berechnet daraus Strecke, Dauer und Verlauf der Fahrt." },
    { q: "Was bedeutet der Status GPS schwach?", a: "Dieser Status erscheint, wenn das GPS-Signal zu schwach ist. Das kann in Gebaeuden, Tunneln oder dicht bebautem Stadtgebiet vorkommen." },
    { q: "Wie exportiere ich mein Fahrtenbuch?", a: "Im Tab Fahrten findest du oben rechts eine Export-Schaltflaeche. Du kannst einen Zeitraum waehlen und die Daten als PDF oder CSV-Datei exportieren." },
    { q: "In welchen Formaten kann ich exportieren?", a: "Aktuell unterstuetzt FahrtDoc den Export als PDF (druckfertig, fuer das Finanzamt geeignet) sowie als CSV (fuer Tabellenkalkulationen wie Excel oder Google Sheets)." },
    { q: "Wofuer braucht die App meinen Standort?", a: "Die Standortdaten werden ausschliesslich fuer die Fahrtaufzeichnung genutzt: zur Bestimmung von Start- und Zielort, zur Berechnung der Streckenlange und zur automatischen Fahrterkennung." },
    { q: "Wie aendere ich mein Passwort?", a: "Gehe zu Profil -> Sicherheit & Datenschutz -> Passwort aendern. Du erhaeltst einen Bestaestigungscode per E-Mail. Gib den Code zusammen mit deinem neuen Passwort ein." },
    { q: "Was passiert, wenn ich mein Passwort vergesse?", a: "Auf dem Anmeldebildschirm gibt es die Option Passwort vergessen. Du erhaeltst einen Wiederherstellungslink per E-Mail. Folge den Anweisungen, um ein neues Passwort festzulegen." },
    { q: "Wie funktioniert die Datensynchronisation?", a: "Wenn du online bist, synchronisiert FahrtDoc deine Fahrten automatisch mit unserem Server. Neu aufgezeichnete Fahrten werden sofort hochgeladen." },
    { q: "Was passiert im Offline-Modus?", a: "Ohne Internetverbindung werden Fahrten lokal gespeichert. Sobald wieder eine Verbindung besteht, werden alle ausstehenden Fahrten automatisch synchronisiert." },
    { q: "Wie aendere ich meine Fahrzeugdaten?", a: "Gehe zu Profil -> Konto -> Fahrprofil & Fahrzeugdaten. Dort kannst du Marke, Modell, Baujahr, Farbe und Kennzeichen deines Fahrzeugs hinterlegen." },
    { q: "Kann ich mehrere Fahrzeuge hinzufuegen?", a: "Aktuell unterstuetzt FahrtDoc ein primaeres Fahrzeug pro Konto. Die Unterstuetzung fuer mehrere Fahrzeuge ist fuer eine zukuenftige Version geplant." },
    { q: "Wie aendere ich die App-Sprache?", a: "Gehe zu Profil -> Einstellungen -> Sprache und waehle zwischen Deutsch und Englisch. Die Aenderung wird sofort auf die gesamte App angewendet." },
    { q: "Kann ich das Design der App anpassen?", a: "Ja. Unter Profil -> Einstellungen -> Design kannst du zwischen Hell, Dunkel und Systemeinstellung waehlen. Im Systemeinstellung-Modus passt sich die App an das Systemdesign an." },
    { q: "Welche Daten speichert die App?", a: "FahrtDoc speichert Fahrten (Start/Ziel, Datum, Uhrzeit, Strecke, Fahrtart, Notizen), GPS-Koordinaten sowie Profildaten (Name, E-Mail, Kennzeichen). Alle Daten werden verschluesselt gespeichert." },
    { q: "Werden meine Daten an Dritte weitergegeben?", a: "Nein. Deine Fahrt- und Profildaten werden nicht an Dritte verkauft. Fuer die Adressaufloesung wird OpenStreetMap Nominatim genutzt, dabei werden nur GPS-Koordinaten uebertragen." },
    { q: "Wie loesche ich mein Konto?", a: "Gehe zu Profil -> unten auf 'Konto loeschen'. Alle deine Daten (Fahrten, Profil, Kontodaten) werden sofort und dauerhaft geloescht. Diese Aktion kann nicht rueckgaengig gemacht werden." },
    { q: "Wie lange werden meine Daten gespeichert?", a: "Fahrtdaten werden bis zu 10 Jahre aufbewahrt, da das Finanzamt die Aufbewahrung steuerrelevanter Unterlagen ueber diesen Zeitraum verlangen kann." },
    { q: "Warum braucht die App Hintergrund-Zugriff?", a: "Fuer das automatische Tracking muss die App auch im Hintergrund auf den Standort zugreifen koennen. Ohne diese Berechtigung koennen Fahrten nur erkannt werden, wenn die App im Vordergrund ist." },
    { q: "Welche Version der App habe ich?", a: `Du nutzt FahrtDoc Version ${APP_VERSION}. Die aktuelle Versionsnummer findest du auch unter Profil -> Support -> App-Version.` },
    { q: "Wie kontaktiere ich den Support?", a: "Du erreichst unseren Support unter support@fahrtdoc.de oder ueber das Kontaktformular in der App. Wir antworten in der Regel innerhalb von 1-2 Werktagen." },
    { q: "Wie klassifiziere ich Fahrten als geschaeftlich oder privat?", a: "Beim manuellen Start einer Fahrt kannst du die Fahrtart direkt auswaehlen. Bei automatisch erkannten Fahrten wird der Standardwert aus deinen Einstellungen uebernommen." },
    { q: "Kann ich Fahrten rueckwirkend aendern?", a: "Ja, du kannst bereits abgeschlossene Fahrten in der Fahrtenliste oeffnen und bearbeiten. Aenderungen werden sofort gespeichert und bei bestehender Verbindung synchronisiert." },
    { q: "Was ist der Unterschied zwischen automatischem und manuellem Tracking?", a: "Beim manuellen Tracking startest und beendest du Fahrten selbst. Das automatische Tracking erkennt Fahrten selbststaendig anhand von Bewegungsmustern, GPS und Fahrzeugsensoren." },
  ];

const PRIVACY_TEXT = `DATENSCHUTZERKLÄRUNG

Stand: Mai 2026

1. VERANTWORTLICHE STELLE

Verantwortlich für die Verarbeitung deiner personenbezogenen Daten im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

FahrtDoc GmbH
Musterstraße 1
10115 Berlin
E-Mail: datenschutz@fahrtdoc.de

2. WELCHE DATEN WIR ERHEBEN

FahrtDoc verarbeitet folgende Kategorien personenbezogener Daten:

• Profildaten: Name, E-Mail-Adresse, Fahrzeugkennzeichen, Fahrzeugmarke und -modell
• Fahrtdaten: Startort, Zielort, Datum, Uhrzeit, Dauer, Streckenlänge, Fahrtart (geschäftlich/privat), Notizen
• Standortdaten: GPS-Koordinaten während einer Fahrt
• Technische Daten: App-Version, Geräteart, Betriebssystem (nur zur Fehlerdiagnose)

3. ZWECK DER DATENVERARBEITUNG

Wir verarbeiten deine Daten ausschließlich zu folgenden Zwecken:

• Führung und Verwaltung deines elektronischen Fahrtenbuchs
• Automatische Erkennung und Aufzeichnung von Fahrten (mit deiner Zustimmung)
• Synchronisation deiner Daten zwischen Geräten
• Erstellung von Export-Dokumenten für steuerliche Zwecke (PDF, CSV)
• Bereitstellung des Kunden-Supports

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) für die Standortverarbeitung.

4. STANDORTDATEN

Für die Fahrtaufzeichnung greift die App auf deinen Gerätestandort zu. Standortdaten werden:

• Ausschließlich lokal auf deinem Gerät und auf unseren gesicherten Servern gespeichert
• Nicht an Dritte verkauft oder zu Werbezwecken genutzt
• Für die Adressauflösung (Start-/Zieladresse) temporär an OpenStreetMap Nominatim übertragen - ohne Benutzerkennzeichnung

Du kannst die Standortberechtigung jederzeit in den Geräteinstellungen widerrufen. Das automatische Tracking ist dann nicht verfügbar.

5. DATENSPEICHERUNG UND LÖSCHUNG

Fahrtdaten werden bis zu 10 Jahre aufbewahrt, da das Steuerrecht (§ 147 AO) eine entsprechende Aufbewahrungspflicht für steuerrelevante Unterlagen vorsieht. Profildaten werden nach Kontolöschung innerhalb von 30 Tagen gelöscht.

Du kannst einzelne Fahrten jederzeit selbst löschen. Dein komplettes Konto kannst du unter Profil → „Konto löschen" sofort und dauerhaft löschen. Dabei werden alle deine Fahrten, Profildaten und Kontoinformationen unwiderruflich gelöscht.

6. DATENSICHERHEIT

Alle gespeicherten Daten werden nach dem Stand der Technik verschlüsselt. Die Übertragung zwischen App und Server erfolgt ausschließlich über verschlüsselte HTTPS-Verbindungen. Wir ergreifen technische und organisatorische Maßnahmen, um deine Daten vor unbefugtem Zugriff zu schützen.

7. DEINE RECHTE

Als betroffene Person hast du folgende Rechte:

• Auskunftsrecht (Art. 15 DSGVO): Du kannst jederzeit Auskunft über deine gespeicherten Daten verlangen.
• Recht auf Berichtigung (Art. 16 DSGVO): Unrichtige Daten können korrigiert werden.
• Recht auf Löschung (Art. 17 DSGVO): Du kannst die Löschung deiner Daten verlangen, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht.
• Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)
• Recht auf Datenübertragbarkeit (Art. 20 DSGVO)
• Widerspruchsrecht (Art. 21 DSGVO)
• Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO)

Zur Ausübung deiner Rechte wende dich an: datenschutz@fahrtdoc.de

8. BESCHWERDERECHT

Du hast das Recht, eine Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde einzureichen. Zuständig ist der Berliner Beauftragte für Datenschutz und Informationsfreiheit.

9. ÄNDERUNGEN DIESER ERKLÄRUNG

Wir behalten uns vor, diese Datenschutzerklärung bei wesentlichen Änderungen der App oder der Rechtslage anzupassen. Die jeweils aktuelle Version ist in der App unter Profil -> Datenschutz abrufbar.`;

type Colors = ReturnType<typeof useColors>;

function SectionHeader({ label, colors }: { label: string; colors: Colors }) {
  return (
    <Text style={[sectionHeaderStyle.text, { color: colors.mutedForeground }]}>{label}</Text>
  );
}
const sectionHeaderStyle = StyleSheet.create({
  text: { fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 22, marginBottom: 6, marginHorizontal: 4 },
});

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function ListRow({
  icon, label, value, onPress, showDivider, colors,
}: {
  icon: FeatherName; label: string; value?: string; onPress?: () => void; showDivider?: boolean; colors: Colors;
}) {
  return (
    <TouchableOpacity
      style={[styles.listRow, showDivider && styles.divider, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.listLabel, { color: colors.foreground }]}>{label}</Text>
      {value !== undefined && (
        <Text style={[styles.listValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon, label, description, value, onValueChange, showDivider, warningWhenOn, colors,
}: {
  icon: FeatherName; label: string; description: string; value: boolean; onValueChange: (v: boolean) => void; showDivider?: boolean; warningWhenOn?: boolean; colors: Colors;
}) {
  return (
    <View style={[styles.listRow, showDivider && styles.divider, { borderBottomColor: colors.border, alignItems: "flex-start", paddingVertical: 13 }]}>
      <View style={[styles.listIconWrap, { backgroundColor: warningWhenOn && value ? "#FEF3C7" : colors.accent, marginTop: 2 }]}>
        <Feather name={icon} size={16} color={warningWhenOn && value ? "#D97706" : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.listDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: warningWhenOn ? "#D97706" : colors.primary }}
        thumbColor="#fff"
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}

function ModalField({
  label, value, onChangeText, icon, placeholder, autoCapitalize, keyboardType, colors,
}: {
  label: string; value: string; onChangeText: (t: string) => void; icon: FeatherName; placeholder?: string; autoCapitalize?: "none" | "sentences" | "words" | "characters"; keyboardType?: "default" | "numeric"; colors: Colors;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.fieldRow, { backgroundColor: colors.secondary, borderColor: focused ? colors.primary : colors.border }]}>
        <Feather name={icon} size={16} color={focused ? colors.primary : colors.mutedForeground} style={{ marginRight: 10 }} />
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={autoCapitalize ?? "words"}
          keyboardType={keyboardType ?? "default"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

function ModalNotifRow({
  icon, label, desc, value, onValueChange, showDivider, colors,
}: {
  icon: FeatherName; label: string; desc: string; value: boolean; onValueChange: (v: boolean) => void; showDivider?: boolean; colors: Colors;
}) {
  return (
    <View style={[styles.notifRow, showDivider && styles.divider, { borderBottomColor: colors.border }]}>
      <View style={[styles.listIconWrap, { backgroundColor: colors.accent, marginTop: 2 }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.listDesc, { color: colors.mutedForeground }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}

function FaqItem({
  item, index, expanded, onToggle, colors,
}: {
  item: { q: string; a: string }; index: number; expanded: boolean; onToggle: () => void; colors: Colors;
}) {
  return (
    <View style={[styles.faqItem, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity style={styles.faqHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{item.q}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      {expanded && (
        <Text style={[styles.faqA, { color: colors.mutedForeground, borderTopColor: colors.border }]}>{item.a}</Text>
      )}
    </View>
  );
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, deleteAccount, updateProfile, updateVehicleData, updatePassword, requestPasswordChangeCode, confirmPasswordChange, isSynced } = useApp();
  const { themePreference, setThemePreference } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPlate, setEditPlate] = useState(user?.plate ?? "");

  const [editVehicleBrand, setEditVehicleBrand] = useState(user?.vehicleBrand ?? "");
  const [editVehicleModel, setEditVehicleModel] = useState(user?.vehicleModel ?? "");
  const [editVehicleYear, setEditVehicleYear] = useState(user?.vehicleYear ?? "");
  const [editVehicleColor, setEditVehicleColor] = useState(user?.vehicleColor ?? "");

  const [notifGeneral, setNotifGeneral] = useState(true);
  const [notifTrips, setNotifTrips] = useState(true);
  const [notifTracking, setNotifTracking] = useState(true);
  const [notifGps, setNotifGps] = useState(true);
  const [notifOffline, setNotifOffline] = useState(true);
  const [notifSync, setNotifSync] = useState(true);
  const [notifLogin, setNotifLogin] = useState(true);
  const [notifDatenschutz, setNotifDatenschutz] = useState(true);

  const [autoTracking, setAutoTracking] = useState(true);
  const [gpsTracking, setGpsTracking] = useState(true);
  const [bgTracking, setBgTracking] = useState(false);
  const [offlineStorage, setOfflineStorage] = useState(true);
  const [trackingPaused, setTrackingPaused] = useState(false);
  const [defaultTripType, setDefaultTripType] = useState<"business" | "private">("business");

  const [pwStep, setPwStep] = useState<"request" | "verify">("request");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwCode, setPwCode] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const vals = await AsyncStorage.multiGet([
        PREF.autoTracking, PREF.gpsTracking, PREF.bgTracking, PREF.offlineStorage,
        PREF.trackingPaused, PREF.defaultTripType,
        PREF.notifGeneral, PREF.notifTrips, PREF.notifTracking, PREF.notifGps,
        PREF.notifOffline, PREF.notifSync, PREF.notifLogin, PREF.notifPrivacy,
      ]);
      const m = Object.fromEntries(vals);
      if (m[PREF.autoTracking] !== null) setAutoTracking(m[PREF.autoTracking] === "true");
      if (m[PREF.gpsTracking] !== null) setGpsTracking(m[PREF.gpsTracking] === "true");
      if (m[PREF.bgTracking] !== null) setBgTracking(m[PREF.bgTracking] === "true");
      if (m[PREF.offlineStorage] !== null) setOfflineStorage(m[PREF.offlineStorage] === "true");
      if (m[PREF.trackingPaused] !== null) setTrackingPaused(m[PREF.trackingPaused] === "true");
      if (m[PREF.defaultTripType] === "private") setDefaultTripType("private");
      if (m[PREF.notifGeneral] !== null) setNotifGeneral(m[PREF.notifGeneral] === "true");
      if (m[PREF.notifTrips] !== null) setNotifTrips(m[PREF.notifTrips] === "true");
      if (m[PREF.notifTracking] !== null) setNotifTracking(m[PREF.notifTracking] === "true");
      if (m[PREF.notifGps] !== null) setNotifGps(m[PREF.notifGps] === "true");
      if (m[PREF.notifOffline] !== null) setNotifOffline(m[PREF.notifOffline] === "true");
      if (m[PREF.notifSync] !== null) setNotifSync(m[PREF.notifSync] === "true");
      if (m[PREF.notifLogin] !== null) setNotifLogin(m[PREF.notifLogin] === "true");
      if (m[PREF.notifPrivacy] !== null) setNotifDatenschutz(m[PREF.notifPrivacy] === "true");
    };
    load();
  }, []);

  useEffect(() => {
    if (user) {
      setEditName(user.name ?? "");
      setEditPlate(user.plate ?? "");
      setEditVehicleBrand(user.vehicleBrand ?? "");
      setEditVehicleModel(user.vehicleModel ?? "");
      setEditVehicleYear(user.vehicleYear ?? "");
      setEditVehicleColor(user.vehicleColor ?? "");
    }
  }, [user]);

  const savePref = useCallback(async (key: string, val: boolean | string) => {
    await AsyncStorage.setItem(key, typeof val === "boolean" ? String(val) : val);
  }, []);

  const handleAutoTracking = useCallback((v: boolean) => { setAutoTracking(v); savePref(PREF.autoTracking, v); }, [savePref]);
  const handleGpsTracking = useCallback((v: boolean) => { setGpsTracking(v); savePref(PREF.gpsTracking, v); }, [savePref]);
  const handleBgTracking = useCallback((v: boolean) => { setBgTracking(v); savePref(PREF.bgTracking, v); }, [savePref]);
  const handleOfflineStorage = useCallback((v: boolean) => { setOfflineStorage(v); savePref(PREF.offlineStorage, v); }, [savePref]);
  const handleTrackingPaused = useCallback((v: boolean) => { setTrackingPaused(v); savePref(PREF.trackingPaused, v); }, [savePref]);
  const handleDefaultTripType = useCallback((v: "business" | "private") => { setDefaultTripType(v); savePref(PREF.defaultTripType, v); }, [savePref]);

  const handleNotifGeneral = useCallback((v: boolean) => { setNotifGeneral(v); savePref(PREF.notifGeneral, v); }, [savePref]);
  const handleNotifTrips = useCallback((v: boolean) => { setNotifTrips(v); savePref(PREF.notifTrips, v); }, [savePref]);
  const handleNotifTracking = useCallback((v: boolean) => { setNotifTracking(v); savePref(PREF.notifTracking, v); }, [savePref]);
  const handleNotifGps = useCallback((v: boolean) => { setNotifGps(v); savePref(PREF.notifGps, v); }, [savePref]);
  const handleNotifOffline = useCallback((v: boolean) => { setNotifOffline(v); savePref(PREF.notifOffline, v); }, [savePref]);
  const handleNotifSync = useCallback((v: boolean) => { setNotifSync(v); savePref(PREF.notifSync, v); }, [savePref]);
  const handleNotifLogin = useCallback((v: boolean) => { setNotifLogin(v); savePref(PREF.notifLogin, v); }, [savePref]);
  const handleNotifDatenschutz = useCallback((v: boolean) => { setNotifDatenschutz(v); savePref(PREF.notifPrivacy, v); }, [savePref]);

  const handleOpenEdit = useCallback(() => {
    setEditName(user?.name ?? "");
    setEditPlate(user?.plate ?? "");
    setEditModalVisible(true);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert(t("error.title"), t("error.nameRequired"));
      return;
    }
    await updateProfile(editName.trim(), editPlate.trim());
    setEditModalVisible(false);
    haptic();
  }, [editName, editPlate, updateProfile, t]);

  const handleOpenVehicle = useCallback(() => {
    setEditVehicleBrand(user?.vehicleBrand ?? "");
    setEditVehicleModel(user?.vehicleModel ?? "");
    setEditVehicleYear(user?.vehicleYear ?? "");
    setEditVehicleColor(user?.vehicleColor ?? "");
    setVehicleModalVisible(true);
  }, [user]);

  const handleSaveVehicle = useCallback(async () => {
    await updateVehicleData(
      editVehicleBrand.trim(),
      editVehicleModel.trim(),
      editVehicleYear.trim(),
      editVehicleColor.trim()
    );
    setVehicleModalVisible(false);
    haptic();
  }, [editVehicleBrand, editVehicleModel, editVehicleYear, editVehicleColor, updateVehicleData]);

  const handleLanguageSelect = useCallback(async (lang: Language) => {
    await setLanguage(lang);
    haptic();
    setLanguageModalVisible(false);
  }, [setLanguage]);

  const openPwModal = useCallback(() => {
    setPwStep("request");
    setPwCode("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setPwLoading(false);
    setPwModalVisible(true);
  }, []);

  const closePwModal = useCallback(() => {
    setPwModalVisible(false);
  }, []);

  const handleRequestCode = useCallback(async () => {
    setPwLoading(true);
    setPwError("");
    const result = await requestPasswordChangeCode();
    setPwLoading(false);
    if (result.success) {
      setPwStep("verify");
    } else {
      setPwError(result.error ?? t("pw.error.sendFailed"));
    }
  }, [requestPasswordChangeCode, t]);

  const handleConfirmPasswordChange = useCallback(async () => {
    if (!pwCode.trim()) { setPwError(t("pw.error.noCode")); return; }
    if (pwNew.length < 8) { setPwError(t("pw.error.tooShort")); return; }
    if (pwNew !== pwConfirm) { setPwError(t("pw.error.mismatch")); return; }
    setPwLoading(true);
    setPwError("");
    const result = await confirmPasswordChange(pwCode.trim(), pwNew);
    setPwLoading(false);
    if (result.success) {
      if (user) await updatePassword(user.email, pwNew);
      closePwModal();
      Alert.alert(t("pw.success.title"), t("pw.success.text"));
    } else {
      setPwError(result.error ?? t("pw.error.invalid"));
    }
  }, [pwCode, pwNew, pwConfirm, confirmPasswordChange, updatePassword, user, closePwModal, t]);

  const handleLogout = useCallback(() => {
    if (Platform.OS !== "web") {
      Alert.alert(t("logout.confirm"), "", [
        { text: t("logout.cancel"), style: "cancel" },
        { text: t("logout.yes"), style: "destructive", onPress: async () => { await logout(); router.replace("/"); } },
      ]);
    } else {
      logout().then(() => router.replace("/"));
    }
  }, [logout, router, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t("deleteAccount.title"),
      t("deleteAccount.message"),
      [
        { text: t("deleteAccount.cancel"), style: "cancel" },
        {
          text: t("deleteAccount.confirm"),
          style: "destructive",
          onPress: async () => {
            const result = await deleteAccount();
            if (result.success) {
              router.replace("/");
            } else {
              Alert.alert("Fehler", t("deleteAccount.error"));
            }
          },
        },
      ]
    );
  }, [deleteAccount, router, t]);

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);

  const themeIcon: FeatherName = themePreference === "dark" ? "moon" : themePreference === "light" ? "sun" : "monitor";
  const langLabel = language === "de" ? t("lang.de") : t("lang.en");

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: colors.card, borderBottomColor: colors.border, shadowColor: "#000" }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("profile.title")}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.accent }]}
            onPress={() => setThemeModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={themeIcon} size={17} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.accent }]}
            onPress={() => setSettingsModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="settings" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
            <TouchableOpacity style={[styles.editProfileBtn, { borderColor: colors.primary }]} onPress={handleOpenEdit}>
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>{t("profile.editBtn")}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statusCell, { borderRightColor: colors.border }]}>
              <Feather name="credit-card" size={15} color={colors.mutedForeground} />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{t("profile.plate")}</Text>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>{user?.plate || "-"}</Text>
            </View>
            <View style={[styles.statusCell, { borderRightColor: colors.border }]}>
              <Feather name="award" size={15} color={colors.primary} />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{t("profile.account")}</Text>
              <Text style={[styles.statusValue, { color: colors.primary, fontWeight: "700" }]}>{t("profile.premium")}</Text>
            </View>
            <View style={styles.statusCell}>
              <Feather name="check-circle" size={15} color={isSynced ? colors.success : colors.mutedForeground} />
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{t("profile.sync")}</Text>
              <Text style={[styles.statusValue, { color: isSynced ? colors.success : colors.mutedForeground }]}>
                {isSynced ? t("profile.synced") : t("profile.offline")}
              </Text>
            </View>
          </View>

          <SectionHeader label={t("section.account")} colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow icon="user" label={t("row.personalData")} onPress={handleOpenEdit} colors={colors} showDivider />
            <ListRow icon="navigation" label={t("row.vehicleProfile")} onPress={handleOpenVehicle} colors={colors} />
          </View>

          <SectionHeader label={t("section.tracking")} colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ToggleRow icon="radio" label={t("row.autoTracking")} description={t("row.autoTracking.desc")} value={autoTracking} onValueChange={handleAutoTracking} colors={colors} showDivider />
            <ToggleRow icon="map-pin" label={t("row.gpsTracking")} description={t("row.gpsTracking.desc")} value={gpsTracking} onValueChange={handleGpsTracking} colors={colors} showDivider />
            <ToggleRow icon="layers" label={t("row.bgTracking")} description={t("row.bgTracking.desc")} value={bgTracking} onValueChange={handleBgTracking} colors={colors} showDivider />
            <ToggleRow icon="database" label={t("row.offline")} description={t("row.offline.desc")} value={offlineStorage} onValueChange={handleOfflineStorage} colors={colors} showDivider />
            <ToggleRow icon="pause-circle" label={t("row.pauseTracking")} description={t("row.pauseTracking.desc")} value={trackingPaused} onValueChange={handleTrackingPaused} colors={colors} warningWhenOn />
          </View>

          <SectionHeader label={t("section.settings")} colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow icon="bell" label={t("row.notifications")} onPress={() => setNotifModalVisible(true)} colors={colors} showDivider />
            <View style={[styles.listRow, styles.divider, { borderBottomColor: colors.border }]}>
              <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                <Feather name="navigation" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>{t("row.defaultTripType")}</Text>
              <View style={[styles.segmented, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.segBtn, defaultTripType === "business" && { backgroundColor: colors.primary, borderRadius: 8 }]}
                  onPress={() => handleDefaultTripType("business")}
                >
                  <Text style={[styles.segBtnText, { color: defaultTripType === "business" ? "#fff" : colors.mutedForeground }]}>{t("tripType.business")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, defaultTripType === "private" && { backgroundColor: colors.primary, borderRadius: 8 }]}
                  onPress={() => handleDefaultTripType("private")}
                >
                  <Text style={[styles.segBtnText, { color: defaultTripType === "private" ? "#fff" : colors.mutedForeground }]}>{t("tripType.private")}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ListRow icon="globe" label={t("row.language")} value={langLabel} onPress={() => setLanguageModalVisible(true)} colors={colors} showDivider />
            <ListRow icon={themeIcon} label={t("row.design")} value={t(`theme.${themePreference}`)} onPress={() => setThemeModalVisible(true)} colors={colors} />
          </View>

          <SectionHeader label={t("section.security")} colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow icon="lock" label={t("row.changePassword")} onPress={openPwModal} colors={colors} showDivider />
            <ListRow icon="shield" label={t("row.privacy")} onPress={() => setPrivacyModalVisible(true)} colors={colors} />
          </View>

          <SectionHeader label={t("section.support")} colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ListRow icon="help-circle" label={t("row.faq")} onPress={() => setFaqModalVisible(true)} colors={colors} showDivider />
            <ListRow
              icon="mail"
              label={t("row.contact")}
              onPress={() => Alert.alert(t("contact.title"), `${t("contact.text")}\n\n${t("contact.email")}`)}
              colors={colors}
              showDivider
            />
            <ListRow icon="info" label={t("row.appVersion")} value={APP_VERSION} colors={colors} />
          </View>

          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.destructive }]}
            onPress={handleLogout}
            testID="logout-btn"
          >
            <Feather name="log-out" size={17} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>{t("row.logout")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteAccountBtn, { borderColor: colors.destructive }]}
            onPress={handleDeleteAccount}
            testID="delete-account-btn"
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
            <Text style={[styles.deleteAccountText, { color: colors.destructive }]}>{t("row.deleteAccount")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* Theme Picker */}
      <Modal visible={themeModalVisible} animationType="fade" transparent onRequestClose={() => setThemeModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setThemeModalVisible(false)}>
          <View style={[styles.themePickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.themePickerTitle, { color: colors.foreground }]}>{t("row.design")}</Text>
            {(["light", "dark", "system"] as ThemePreference[]).map((opt) => {
              const icon: FeatherName = opt === "dark" ? "moon" : opt === "light" ? "sun" : "monitor";
              const active = themePreference === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeOption, active && { backgroundColor: colors.accent }, { borderColor: active ? colors.primary : colors.border }]}
                  onPress={async () => { await setThemePreference(opt); haptic(); setThemeModalVisible(false); }}
                >
                  <View style={[styles.themeOptionIcon, { backgroundColor: active ? colors.primary : colors.secondary }]}>
                    <Feather name={icon} size={17} color={active ? "#fff" : colors.mutedForeground} />
                  </View>
                  <Text style={[styles.themeOptionLabel, { color: active ? colors.primary : colors.foreground, fontWeight: active ? "700" : "400" }]}>
                    {t(`theme.${opt}`)}
                  </Text>
                  {active && <Feather name="check" size={17} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language Picker */}
      <Modal visible={languageModalVisible} animationType="fade" transparent onRequestClose={() => setLanguageModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLanguageModalVisible(false)}>
          <View style={[styles.themePickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.themePickerTitle, { color: colors.foreground }]}>{t("lang.title")}</Text>
            {(["de", "en"] as Language[]).map((opt) => {
              const active = language === opt;
              const flag = opt === "de" ? "🇩🇪" : "🇬🇧";
              const label = opt === "de" ? "Deutsch" : "English";
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeOption, active && { backgroundColor: colors.accent }, { borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => handleLanguageSelect(opt)}
                >
                  <View style={[styles.themeOptionIcon, { backgroundColor: active ? colors.primary : colors.secondary, alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontSize: 14 }}>{flag}</Text>
                  </View>
                  <Text style={[styles.themeOptionLabel, { color: active ? colors.primary : colors.foreground, fontWeight: active ? "700" : "400" }]}>
                    {label}
                  </Text>
                  {active && <Feather name="check" size={17} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Overview Modal */}
      <Modal visible={settingsModalVisible} animationType="fade" transparent onRequestClose={() => setSettingsModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSettingsModalVisible(false)}>
          <View style={[styles.settingsOverlayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.themePickerTitle, { color: colors.foreground }]}>{t("settings.title")}</Text>
            {[
              { icon: "bell" as FeatherName, label: t("row.notifications"), action: () => { setSettingsModalVisible(false); setNotifModalVisible(true); } },
              { icon: "globe" as FeatherName, label: t("row.language"), action: () => { setSettingsModalVisible(false); setLanguageModalVisible(true); } },
              { icon: themeIcon, label: t("row.design"), action: () => { setSettingsModalVisible(false); setThemeModalVisible(true); } },
              { icon: "lock" as FeatherName, label: t("row.changePassword"), action: () => { setSettingsModalVisible(false); openPwModal(); } },
              { icon: "shield" as FeatherName, label: t("row.privacy"), action: () => { setSettingsModalVisible(false); setPrivacyModalVisible(true); } },
              { icon: "help-circle" as FeatherName, label: t("row.faq"), action: () => { setSettingsModalVisible(false); setFaqModalVisible(true); } },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.settingsOverlayRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={item.action}
                activeOpacity={0.7}
              >
                <View style={[styles.listIconWrap, { backgroundColor: colors.accent }]}>
                  <Feather name={item.icon} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.listLabel, { color: colors.foreground, flex: 1 }]}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modalScreen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("editProfile.title")}</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModalField label={t("editProfile.name")} value={editName} onChangeText={setEditName} icon="user" placeholder="Max Mustermann" colors={colors} />
            <ModalField label={t("editProfile.plate")} value={editPlate} onChangeText={(t) => setEditPlate(t.toUpperCase())} icon="credit-card" placeholder="B-MM1234" autoCapitalize="characters" colors={colors} />
            <View style={[styles.infoNote, { backgroundColor: colors.accent, borderColor: colors.border }]}>
              <Feather name="mail" size={14} color={colors.primary} />
              <Text style={[styles.infoNoteText, { color: colors.primary }]}>E-Mail: {user?.email}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vehicle Profile Modal */}
      <Modal visible={vehicleModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modalScreen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("vehicle.title")}</Text>
            <TouchableOpacity onPress={handleSaveVehicle}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModalField label={t("vehicle.brand")} value={editVehicleBrand} onChangeText={setEditVehicleBrand} icon="truck" placeholder={t("vehicle.brandPlaceholder")} colors={colors} />
            <ModalField label={t("vehicle.model")} value={editVehicleModel} onChangeText={setEditVehicleModel} icon="tag" placeholder={t("vehicle.modelPlaceholder")} colors={colors} />
            <ModalField label={t("vehicle.year")} value={editVehicleYear} onChangeText={setEditVehicleYear} icon="calendar" placeholder={t("vehicle.yearPlaceholder")} keyboardType="numeric" colors={colors} />
            <ModalField label={t("vehicle.color")} value={editVehicleColor} onChangeText={setEditVehicleColor} icon="droplet" placeholder={t("vehicle.colorPlaceholder")} colors={colors} />
            <View style={[styles.infoNote, { backgroundColor: colors.accent, borderColor: colors.border, marginTop: 16 }]}>
              <Feather name="credit-card" size={14} color={colors.primary} />
              <Text style={[styles.infoNoteText, { color: colors.primary }]}>{t("vehicle.plate")}: {user?.plate || "-"}</Text>
            </View>
            <Text style={[styles.vehicleHint, { color: colors.mutedForeground }]}>
              {language === "de"
                ? "Das Kennzeichen aenderst du unter Persoenliche Daten."
                : "Change the license plate under Personal Data."}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={notifModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={{ width: 70 }} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("notif.title")}</Text>
            <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingTop: 8 }]}>
            <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
              <ModalNotifRow icon="info" label={t("notif.general")} desc={t("notif.general.desc")} value={notifGeneral} onValueChange={handleNotifGeneral} showDivider colors={colors} />
              <ModalNotifRow icon="map" label={t("notif.trips")} desc={t("notif.trips.desc")} value={notifTrips} onValueChange={handleNotifTrips} showDivider colors={colors} />
              <ModalNotifRow icon="radio" label={t("notif.tracking")} desc={t("notif.tracking.desc")} value={notifTracking} onValueChange={handleNotifTracking} showDivider colors={colors} />
              <ModalNotifRow icon="map-pin" label={t("notif.gps")} desc={t("notif.gps.desc")} value={notifGps} onValueChange={handleNotifGps} showDivider colors={colors} />
              <ModalNotifRow icon="wifi-off" label={t("notif.offline")} desc={t("notif.offline.desc")} value={notifOffline} onValueChange={handleNotifOffline} showDivider colors={colors} />
              <ModalNotifRow icon="refresh-cw" label={t("notif.sync")} desc={t("notif.sync.desc")} value={notifSync} onValueChange={handleNotifSync} showDivider colors={colors} />
              <ModalNotifRow icon="log-in" label={t("notif.login")} desc={t("notif.login.desc")} value={notifLogin} onValueChange={handleNotifLogin} showDivider colors={colors} />
              <ModalNotifRow icon="shield" label={t("notif.datenschutz")} desc={t("notif.datenschutz.desc")} value={notifDatenschutz} onValueChange={handleNotifDatenschutz} colors={colors} />
            </View>
            <Text style={[styles.notifHint, { color: colors.mutedForeground }]}>
              {language === "de"
                ? "Systembenachrichtigungen können in den Geräteeinstellungen verwaltet werden."
                : "System notifications can be managed in the device settings."}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={privacyModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={{ width: 70 }} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("privacy.title")}</Text>
            <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingTop: 16, paddingBottom: 40 }]}>
            <Text style={[styles.privacyText, { color: colors.foreground }]}>{PRIVACY_TEXT}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* FAQ Modal */}
      <Modal visible={faqModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={{ width: 70 }} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("faq.title")}</Text>
            <TouchableOpacity onPress={() => setFaqModalVisible(false)}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingTop: 12, paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
            {FAQ_DATA.map((item, index) => (
              <FaqItem
                key={index}
                item={item}
                index={index}
                expanded={expandedFaqIndex === index}
                onToggle={() => setExpandedFaqIndex(expandedFaqIndex === index ? null : index)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={pwModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modalScreen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closePwModal} disabled={pwLoading}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("row.changePassword")}</Text>
            <View style={{ width: 70 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.stepRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepDotText}>{pwStep === "request" ? "1" : "✓"}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: pwStep === "request" ? colors.foreground : colors.mutedForeground }]}>{t("pw.step1")}</Text>
              </View>
              <View style={[styles.stepLine, { backgroundColor: pwStep === "verify" ? colors.primary : colors.border }]} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: pwStep === "verify" ? colors.primary : colors.border }]}>
                  <Text style={[styles.stepDotText, { color: pwStep === "verify" ? "#fff" : colors.mutedForeground }]}>2</Text>
                </View>
                <Text style={[styles.stepLabel, { color: pwStep === "verify" ? colors.foreground : colors.mutedForeground }]}>{t("pw.step2")}</Text>
              </View>
            </View>

            {pwStep === "request" ? (
              <>
                <View style={[styles.infoNote, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Feather name="mail" size={14} color={colors.primary} />
                  <Text style={[styles.infoNoteText, { color: colors.primary }]}>
                    {language === "de" ? `Ein Bestätigungscode wird an ${user?.email} gesendet.` : `A confirmation code will be sent to ${user?.email}.`}
                  </Text>
                </View>
                {pwError !== "" && <Text style={[styles.errorText, { color: colors.destructive }]}>{pwError}</Text>}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: pwLoading ? colors.mutedForeground : colors.primary }]}
                  onPress={handleRequestCode}
                  disabled={pwLoading}
                >
                  <Text style={styles.primaryBtnText}>{pwLoading ? t("pw.sending") : t("pw.sendCode")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <PwField label={language === "de" ? "Bestätigungscode" : "Confirmation Code"} value={pwCode} onChangeText={setPwCode} icon="key" placeholder="000000" autoCapitalize="none" keyboardType="numeric" colors={colors} />
                <PwField label={language === "de" ? "Neues Passwort" : "New Password"} value={pwNew} onChangeText={setPwNew} icon="lock" placeholder="••••••••" secureTextEntry colors={colors} />
                <PwField label={language === "de" ? "Passwort bestätigen" : "Confirm Password"} value={pwConfirm} onChangeText={setPwConfirm} icon="check" placeholder="••••••••" secureTextEntry colors={colors} />
                {pwError !== "" && <Text style={[styles.errorText, { color: colors.destructive }]}>{pwError}</Text>}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: pwLoading ? colors.mutedForeground : colors.primary }]}
                  onPress={handleConfirmPasswordChange}
                  disabled={pwLoading}
                >
                  <Text style={styles.primaryBtnText}>{pwLoading ? t("pw.changing") : t("pw.changeBtn")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setPwStep("request"); setPwError(""); }}>
                  <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>{t("pw.newCode")}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PwField({
  label, value, onChangeText, icon, placeholder, secureTextEntry, autoCapitalize, keyboardType, colors,
}: {
  label: string; value: string; onChangeText: (t: string) => void; icon: FeatherName; placeholder?: string; secureTextEntry?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters"; keyboardType?: "default" | "numeric"; colors: Colors;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.fieldRow, { backgroundColor: colors.secondary, borderColor: focused ? colors.primary : colors.border }]}>
        <Feather name={icon} size={16} color={focused ? colors.primary : colors.mutedForeground} style={{ marginRight: 10 }} />
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? "none"}
          keyboardType={keyboardType ?? "default"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerRight: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  profileCard: { borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, marginTop: 16 },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  profileName: { fontSize: 20, fontWeight: "700", marginBottom: 3 },
  profileEmail: { fontSize: 14, marginBottom: 14 },
  editProfileBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  editProfileBtnText: { fontSize: 13, fontWeight: "600" },
  statusCard: { flexDirection: "row", borderRadius: 16, borderWidth: 1, marginTop: 12, overflow: "hidden" },
  statusCell: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3, borderRightWidth: 1 },
  statusLabel: { fontSize: 11, textAlign: "center" },
  statusValue: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  listIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  listLabel: { fontSize: 15, fontWeight: "500", flex: 1 },
  listValue: { fontSize: 14 },
  listDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  divider: { borderBottomWidth: 1 },
  notifRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  segmented: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  segBtnText: { fontSize: 13, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24, marginBottom: 8, borderRadius: 14, paddingVertical: 15, borderWidth: 1.5 },
  logoutText: { fontSize: 15, fontWeight: "600" },
  deleteAccountBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderStyle: "dashed", opacity: 0.7 },
  deleteAccountText: { fontSize: 13, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  themePickerCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 20, borderWidth: 1, gap: 10 },
  themePickerTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  themeOption: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, borderWidth: 1.5, padding: 14 },
  themeOptionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  themeOptionLabel: { fontSize: 15 },
  settingsOverlayCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 20, borderWidth: 1 },
  settingsOverlayRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  modalScreen: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 16 : 8, paddingBottom: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, paddingVertical: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalSave: { fontSize: 16, fontWeight: "700", paddingVertical: 4 },
  modalContent: { padding: 20 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 7 },
  fieldRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 10 },
  fieldInput: { flex: 1, fontSize: 15 },
  infoNote: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  infoNoteText: { fontSize: 13, fontWeight: "500", flex: 1 },
  vehicleHint: { fontSize: 12, marginTop: 8, textAlign: "center" },
  notifHint: { fontSize: 12, marginTop: 12, textAlign: "center", paddingHorizontal: 8 },
  privacyText: { fontSize: 13.5, lineHeight: 22, letterSpacing: 0.1 },
  faqItem: { borderRadius: 14, borderWidth: 1, marginBottom: 8, overflow: "hidden" },
  faqHeader: { flexDirection: "row", alignItems: "center", padding: 15 },
  faqQ: { fontSize: 14.5, fontWeight: "600", lineHeight: 20 },
  faqA: { fontSize: 13.5, lineHeight: 21, padding: 15, paddingTop: 12, borderTopWidth: 1 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { fontSize: 14 },
  errorText: { fontSize: 13, marginTop: 6, marginBottom: 2 },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 28, marginTop: 8 },
  stepItem: { alignItems: "center", gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepDotText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepLabel: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, marginBottom: 18 },
});
