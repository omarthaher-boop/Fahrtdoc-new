import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Language = "de" | "en";
const LANG_KEY = "pref_language";

const de: Record<string, string> = {
  "nav.home": "Übersicht",
  "nav.trips": "Fahrten",
  "nav.profile": "Profil",
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.done": "Fertig",
  "common.edit": "Bearbeiten",
  "common.close": "Schließen",
  "profile.title": "Profil",
  "profile.editBtn": "Profil bearbeiten",
  "profile.plate": "Kennzeichen",
  "profile.account": "Konto",
  "profile.sync": "Sync",
  "profile.synced": "Synchronisiert",
  "profile.offline": "Offline",
  "profile.premium": "Premium",
  "section.account": "Konto",
  "section.tracking": "Tracking & Fahrterkennung",
  "section.settings": "Einstellungen",
  "section.security": "Sicherheit & Datenschutz",
  "section.support": "Support",
  "row.personalData": "Persönliche Daten",
  "row.vehicleProfile": "Fahrprofil & Fahrzeugdaten",
  "row.autoTracking": "Automatisches Tracking",
  "row.autoTracking.desc": "Fahrten automatisch erkennen und aufzeichnen",
  "row.gpsTracking": "GPS-Tracking",
  "row.gpsTracking.desc": "Standort während einer Fahrt erfassen",
  "row.bgTracking": "Hintergrund-Tracking",
  "row.bgTracking.desc": "Fahrten auch bei geschlossener App erkennen",
  "row.offline": "Offline-Speicherung",
  "row.offline.desc": "Fahrten ohne Internet zwischenspeichern",
  "row.pauseTracking": "Tracking pausieren",
  "row.pauseTracking.desc": "Aufzeichnung vorübergehend deaktivieren",
  "row.notifications": "Benachrichtigungen",
  "row.defaultTripType": "Standard-Fahrtart",
  "row.language": "Sprache",
  "row.design": "Design",
  "row.changePassword": "Passwort ändern",
  "row.privacy": "Datenschutz",
  "row.faceId": "Face ID / App-Sperre",
  "row.faq": "Hilfe & FAQ",
  "row.contact": "Kontakt",
  "row.appVersion": "App-Version",
  "row.logout": "Abmelden",
  "tripType.business": "Geschäftlich",
  "tripType.private": "Privat",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "theme.system": "Systemeinstellung",
  "lang.de": "Deutsch",
  "lang.en": "Englisch",
  "lang.title": "Sprache wählen",
  "vehicle.title": "Fahrprofil & Fahrzeugdaten",
  "vehicle.brand": "Marke",
  "vehicle.model": "Modell",
  "vehicle.year": "Baujahr",
  "vehicle.color": "Farbe",
  "vehicle.plate": "Kennzeichen",
  "vehicle.brandPlaceholder": "z. B. BMW, VW, Mercedes",
  "vehicle.modelPlaceholder": "z. B. 3er, Golf, C-Klasse",
  "vehicle.yearPlaceholder": "z. B. 2022",
  "vehicle.colorPlaceholder": "z. B. Schwarz, Weiß, Blau",
  "notif.title": "Benachrichtigungen",
  "notif.general": "Allgemeine Hinweise",
  "notif.general.desc": "App-Updates und allgemeine Infos",
  "notif.trips": "Fahrten-Erinnerungen",
  "notif.trips.desc": "Hinweise zu offenen oder unvollständigen Fahrten",
  "notif.tracking": "Automatische Tracking-Hinweise",
  "notif.tracking.desc": "Statusmeldungen bei automatischer Fahrterkennung",
  "notif.gps": "GPS-Status",
  "notif.gps.desc": "Warnungen bei schwachem oder fehlendem GPS-Signal",
  "notif.offline": "Offline-Modus",
  "notif.offline.desc": "Hinweise bei fehlender Internetverbindung",
  "notif.sync": "Synchronisation",
  "notif.sync.desc": "Meldungen zu Datensynchronisation und Backup",
  "notif.login": "Login & Gerätezugriff",
  "notif.login.desc": "Sicherheitshinweise zu Anmeldungen und Gerätezugriffen",
  "notif.datenschutz": "Datenschutz & App-Sperre",
  "notif.datenschutz.desc": "Hinweise zu Datenschutzeinstellungen und App-Sperre",
  "privacy.title": "Datenschutz",
  "faq.title": "Hilfe & FAQ",
  "settings.title": "Einstellungen",
  "pw.step1": "Code anfordern",
  "pw.step2": "Code & Passwort",
  "pw.sendCode": "Code per E-Mail senden",
  "pw.sending": "Senden…",
  "pw.changeBtn": "Passwort ändern",
  "pw.changing": "Wird geändert…",
  "pw.newCode": "Neuen Code anfordern",
  "editProfile.title": "Profil bearbeiten",
  "editProfile.name": "Name",
  "editProfile.plate": "Kennzeichen",
  "logout.confirm": "Wirklich abmelden?",
  "logout.yes": "Abmelden",
  "logout.cancel": "Abbrechen",
  "coming.soon": "Demnächst",
  "coming.soon.desc": "Diese Funktion wird in einer zukünftigen Version verfügbar sein.",
  "contact.email": "support@fahrtdoc.de",
  "contact.title": "Kontakt",
  "contact.text": "Bei Fragen oder Problemen stehen wir dir gerne zur Verfügung.",
  "contact.emailLabel": "E-Mail Support",
  "contact.websiteLabel": "Website",
};

const en: Record<string, string> = {
  "nav.home": "Overview",
  "nav.trips": "Trips",
  "nav.profile": "Profile",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.done": "Done",
  "common.edit": "Edit",
  "common.close": "Close",
  "profile.title": "Profile",
  "profile.editBtn": "Edit Profile",
  "profile.plate": "License Plate",
  "profile.account": "Account",
  "profile.sync": "Sync",
  "profile.synced": "Synced",
  "profile.offline": "Offline",
  "profile.premium": "Premium",
  "section.account": "Account",
  "section.tracking": "Tracking & Trip Detection",
  "section.settings": "Settings",
  "section.security": "Security & Privacy",
  "section.support": "Support",
  "row.personalData": "Personal Data",
  "row.vehicleProfile": "Driving Profile & Vehicle Data",
  "row.autoTracking": "Automatic Tracking",
  "row.autoTracking.desc": "Automatically detect and record trips",
  "row.gpsTracking": "GPS Tracking",
  "row.gpsTracking.desc": "Record location during a trip",
  "row.bgTracking": "Background Tracking",
  "row.bgTracking.desc": "Detect trips even when the app is closed",
  "row.offline": "Offline Storage",
  "row.offline.desc": "Save trips without internet connection",
  "row.pauseTracking": "Pause Tracking",
  "row.pauseTracking.desc": "Temporarily disable recording",
  "row.notifications": "Notifications",
  "row.defaultTripType": "Default Trip Type",
  "row.language": "Language",
  "row.design": "Appearance",
  "row.changePassword": "Change Password",
  "row.privacy": "Privacy",
  "row.faceId": "Face ID / App Lock",
  "row.faq": "Help & FAQ",
  "row.contact": "Contact",
  "row.appVersion": "App Version",
  "row.logout": "Sign Out",
  "tripType.business": "Business",
  "tripType.private": "Private",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "lang.de": "German",
  "lang.en": "English",
  "lang.title": "Choose Language",
  "vehicle.title": "Driving Profile & Vehicle Data",
  "vehicle.brand": "Brand",
  "vehicle.model": "Model",
  "vehicle.year": "Year",
  "vehicle.color": "Color",
  "vehicle.plate": "License Plate",
  "vehicle.brandPlaceholder": "e.g. BMW, VW, Mercedes",
  "vehicle.modelPlaceholder": "e.g. 3 Series, Golf, C-Class",
  "vehicle.yearPlaceholder": "e.g. 2022",
  "vehicle.colorPlaceholder": "e.g. Black, White, Blue",
  "notif.title": "Notifications",
  "notif.general": "General Notices",
  "notif.general.desc": "App updates and general info",
  "notif.trips": "Trip Reminders",
  "notif.trips.desc": "Notices for open or incomplete trips",
  "notif.tracking": "Auto Tracking Notices",
  "notif.tracking.desc": "Status updates for automatic trip detection",
  "notif.gps": "GPS Status",
  "notif.gps.desc": "Warnings for weak or missing GPS signal",
  "notif.offline": "Offline Mode",
  "notif.offline.desc": "Notices when internet connection is unavailable",
  "notif.sync": "Synchronization",
  "notif.sync.desc": "Messages about data sync and backup",
  "notif.login": "Login & Device Access",
  "notif.login.desc": "Security notices for logins and device access",
  "notif.datenschutz": "Privacy & App Lock",
  "notif.datenschutz.desc": "Notices about privacy settings and app lock",
  "privacy.title": "Privacy",
  "faq.title": "Help & FAQ",
  "settings.title": "Settings",
  "pw.step1": "Request Code",
  "pw.step2": "Code & Password",
  "pw.sendCode": "Send Code by Email",
  "pw.sending": "Sending…",
  "pw.changeBtn": "Change Password",
  "pw.changing": "Changing…",
  "pw.newCode": "Request New Code",
  "editProfile.title": "Edit Profile",
  "editProfile.name": "Name",
  "editProfile.plate": "License Plate",
  "logout.confirm": "Really sign out?",
  "logout.yes": "Sign Out",
  "logout.cancel": "Cancel",
  "coming.soon": "Coming Soon",
  "coming.soon.desc": "This feature will be available in a future version.",
  "contact.email": "support@fahrtdoc.de",
  "contact.title": "Contact",
  "contact.text": "We are happy to help you with any questions or issues.",
  "contact.emailLabel": "Email Support",
  "contact.websiteLabel": "Website",
};

const translations: Record<Language, Record<string, string>> = { de, en };

interface LanguageContextType {
  language: Language;
  setLanguage: (l: Language) => Promise<void>;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: "de",
  setLanguage: async () => {},
  t: (key) => de[key] ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>("de");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === "de" || v === "en") setLang(v);
    });
  }, []);

  const setLanguage = useCallback(async (l: Language) => {
    setLang(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => translations[language][key] ?? translations["de"][key] ?? key,
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
