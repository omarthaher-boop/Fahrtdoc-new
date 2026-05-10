import { useState } from "react";

type ThemePreference = "light" | "dark" | "system";

const LIGHT = {
  background: "#F7F9FC",
  card: "#FFFFFF",
  primary: "#2563EB",
  foreground: "#0F172A",
  mutedForeground: "#64748B",
  border: "#E2E8F0",
  accent: "#EFF6FF",
  secondary: "#F1F5F9",
  success: "#16A34A",
  destructive: "#EF4444",
  warning: "#D97706",
};

const DARK = {
  background: "#0D1117",
  card: "#161D2A",
  primary: "#60A5FA",
  foreground: "#F1F5F9",
  mutedForeground: "#64748B",
  border: "#232D40",
  accent: "#1A2D4A",
  secondary: "#1C2535",
  success: "#34D399",
  destructive: "#F87171",
  warning: "#FBBF24",
};

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "Systemeinstellung",
};

type IconName =
  | "settings" | "sun" | "moon" | "monitor" | "edit-2" | "credit-card"
  | "award" | "check-circle" | "user" | "navigation" | "radio" | "map-pin"
  | "layers" | "database" | "pause-circle" | "bell" | "globe" | "lock"
  | "shield" | "aperture" | "help-circle" | "mail" | "info" | "log-out"
  | "chevron-right" | "briefcase";

function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  const paths: Record<IconName, string> = {
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7.07-1.07A8 8 0 1 0 4.93 6.07M4.93 6.07 2 3m0 0h4M2 3v4",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-17v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    monitor: "M21 2H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7l-2 3h6l-2-3h7a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z",
    "edit-2": "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
    "credit-card": "M1 4h22v16H1zM1 10h22",
    award: "M12 15A7 7 0 1 0 12 1a7 7 0 0 0 0 14zm-4 6 4-3 4 3-1.5-4.5L19 13l-4.5-.5L12 8l-2.5 4.5L5 13l4.5 3.5L8 21z",
    "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    navigation: "M3 11l19-9-9 19-2-8-8-2z",
    radio: "M12 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8C6.48 9 2 13.48 2 19h2c0-4.42 3.58-8 8-8s8 3.58 8 8h2c0-5.52-4.48-10-10-10z",
    "map-pin": "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    layers: "M12 2 2 7l10 5 10-5-10-5zm-10 5v5l10 5 10-5V7",
    database: "M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4zm0 2c4.42 0 8 1.34 8 3s-3.58 3-8 3-8-1.34-8-3 3.58-3 8-3z",
    "pause-circle": "M10 15V9m4 6V9M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
    bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
    globe: "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 0v20M2 12h20",
    lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    aperture: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94",
    "help-circle": "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
    mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm18 2-10 7L2 6",
    info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-7v-4m0-4h.01",
    "log-out": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    "chevron-right": "M9 18l6-6-6-6",
    briefcase: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]?.split("M").filter(Boolean).map((d, i) => (
        <path key={i} d={`M${d}`} />
      ))}
    </svg>
  );
}

function Toggle({ on, onToggle, primaryColor, borderColor, warning }: {
  on: boolean; onToggle: () => void;
  primaryColor: string; borderColor: string; warning?: boolean;
}) {
  const trackColor = on ? (warning ? "#D97706" : primaryColor) : borderColor;
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
      backgroundColor: trackColor, position: "relative", transition: "background 0.2s",
      flexShrink: 0,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff",
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function ProfilePreview() {
  const [isDark, setIsDark] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("light");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [tripType, setTripType] = useState<"business" | "private">("business");
  const [appLock, setAppLock] = useState(true);
  const [autoTracking, setAutoTracking] = useState(true);
  const [gpsTracking, setGpsTracking] = useState(true);
  const [bgTracking, setBgTracking] = useState(true);
  const [offlineStorage, setOfflineStorage] = useState(true);
  const [trackingPaused, setTrackingPaused] = useState(false);

  const c = isDark ? DARK : LIGHT;

  const handleTheme = (p: ThemePreference) => {
    setThemePreference(p);
    setIsDark(p === "dark");
    setShowThemePicker(false);
  };

  const themeIcon: IconName = themePreference === "dark" ? "moon" : themePreference === "light" ? "sun" : "monitor";

  return (
    <div style={{
      width: "100%", minHeight: "100vh", backgroundColor: c.background,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      color: c.foreground, transition: "background 0.25s, color 0.25s",
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: c.card, borderBottom: `1px solid ${c.border}`,
        padding: "20px 20px 16px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Profil</span>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ icon: themeIcon as IconName, action: () => setShowThemePicker(true) },
            { icon: "settings" as IconName, action: () => {} }].map(({ icon, action }, i) => (
            <button key={i} onClick={action} style={{
              width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
              backgroundColor: c.accent, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={icon} size={17} color={c.primary} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: c.card, borderRadius: 22, border: `1px solid ${c.border}`,
          padding: "24px 20px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 26, fontWeight: 800, marginBottom: 4,
            boxShadow: `0 4px 12px ${c.primary}40`,
          }}>MM</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>Max Mustermann</div>
          <div style={{ fontSize: 14, color: c.mutedForeground }}>max.mustermann@beispiel.ch</div>
          <button style={{
            display: "flex", alignItems: "center", gap: 7,
            border: `1.2px solid ${c.primary}`, borderRadius: 12,
            padding: "9px 22px", backgroundColor: "transparent",
            cursor: "pointer", marginTop: 4,
          }}>
            <Icon name="edit-2" size={14} color={c.primary} />
            <span style={{ fontSize: 14, fontWeight: 600, color: c.primary }}>Profil bearbeiten</span>
          </button>
        </div>

        {/* Status Card */}
        <div style={{
          backgroundColor: c.card, borderRadius: 18, border: `1px solid ${c.border}`,
          display: "flex", overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}>
          {[
            { icon: "credit-card" as IconName, label: "Kennzeichen", value: "B–MM1234", color: c.mutedForeground },
            { icon: "award" as IconName, label: "Konto", value: "Premium", color: c.primary, bold: true },
            { icon: "check-circle" as IconName, label: "Sync", value: "Synchronisiert", color: c.success },
          ].map((cell, i) => (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: "14px 8px", gap: 3,
              borderRight: i < 2 ? `1px solid ${c.border}` : undefined,
            }}>
              <Icon name={cell.icon} size={15} color={cell.color} />
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: c.mutedForeground }}>
                {cell.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: cell.bold ? 700 : 600, color: cell.color }}>
                {cell.value}
              </span>
            </div>
          ))}
        </div>

        {/* Konto */}
        <SectionHeader label="Konto" color={c.mutedForeground} />
        <ListCard borderColor={c.border} bgColor={c.card}>
          <ListRow icon="user" label="Persönliche Daten" c={c} divider />
          <ListRow icon="navigation" label="Fahrprofil & Fahrzeugdaten" c={c} />
        </ListCard>

        {/* Tracking */}
        <SectionHeader label="Tracking & Fahrterkennung" color={c.mutedForeground} />
        <ListCard borderColor={c.border} bgColor={c.card}>
          <ToggleRowComp icon="radio" label="Automatisches Tracking"
            desc="Fahrten automatisch erkennen und aufzeichnen"
            value={autoTracking} onToggle={() => setAutoTracking(!autoTracking)} c={c} divider />
          <ToggleRowComp icon="map-pin" label="GPS-Tracking"
            desc="Standort während einer Fahrt erfassen"
            value={gpsTracking} onToggle={() => setGpsTracking(!gpsTracking)} c={c} divider />
          <ToggleRowComp icon="layers" label="Hintergrund-Tracking"
            desc="Fahrten auch bei geschlossener App erkennen"
            value={bgTracking} onToggle={() => setBgTracking(!bgTracking)} c={c} divider />
          <ToggleRowComp icon="database" label="Offline-Speicherung"
            desc="Fahrten ohne Internet zwischenspeichern"
            value={offlineStorage} onToggle={() => setOfflineStorage(!offlineStorage)} c={c} divider />
          <ToggleRowComp icon="pause-circle" label="Tracking pausieren"
            desc="Aufzeichnung vorübergehend deaktivieren"
            value={trackingPaused} onToggle={() => setTrackingPaused(!trackingPaused)} c={c} warning />
        </ListCard>

        {/* Einstellungen */}
        <SectionHeader label="Einstellungen" color={c.mutedForeground} />
        <ListCard borderColor={c.border} bgColor={c.card}>
          <ListRow icon="bell" label="Benachrichtigungen" c={c} divider />
          {/* Fahrtart segment */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderBottom: `1px solid ${c.border}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, backgroundColor: c.accent,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name="navigation" size={16} color={c.primary} />
            </div>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: c.foreground }}>Standard-Fahrtart</span>
            <div style={{
              display: "flex", backgroundColor: c.secondary,
              borderRadius: 10, border: `1px solid ${c.border}`, padding: 3, gap: 2,
            }}>
              {(["business", "private"] as const).map((t) => (
                <button key={t} onClick={() => setTripType(t)} style={{
                  padding: "5px 10px", border: "none", cursor: "pointer", borderRadius: 8,
                  backgroundColor: tripType === t ? c.primary : "transparent",
                  color: tripType === t ? "#fff" : c.mutedForeground,
                  fontSize: 12, fontWeight: 600,
                }}>
                  {t === "business" ? "Geschäftlich" : "Privat"}
                </button>
              ))}
            </div>
          </div>
          <ListRow icon="globe" label="Sprache" value="Deutsch" c={c} divider />
          <ListRow
            icon={themeIcon}
            label="Design"
            value={THEME_LABELS[themePreference]}
            c={c}
            onClick={() => setShowThemePicker(true)}
          />
        </ListCard>

        {/* Sicherheit */}
        <SectionHeader label="Sicherheit & Datenschutz" color={c.mutedForeground} />
        <ListCard borderColor={c.border} bgColor={c.card}>
          <ListRow icon="lock" label="Passwort ändern" c={c} divider />
          <ListRow icon="shield" label="Datenschutz" c={c} divider />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, backgroundColor: c.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="aperture" size={16} color={c.primary} />
            </div>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: c.foreground }}>Face ID / App-Sperre</span>
            <Toggle on={appLock} onToggle={() => setAppLock(!appLock)}
              primaryColor={c.primary} borderColor={c.border} />
          </div>
        </ListCard>

        {/* Support */}
        <SectionHeader label="Support" color={c.mutedForeground} />
        <ListCard borderColor={c.border} bgColor={c.card}>
          <ListRow icon="help-circle" label="Hilfe & FAQ" c={c} divider />
          <ListRow icon="mail" label="Kontakt" c={c} divider />
          <ListRow icon="info" label="App-Version" value="v2.4.1" c={c} noArrow />
        </ListCard>

        {/* Abmelden */}
        <button style={{
          marginTop: 8, marginBottom: 8, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10, borderRadius: 18,
          border: `1.5px solid ${c.destructive}`, padding: 16,
          backgroundColor: c.card, cursor: "pointer", width: "100%",
          boxShadow: `0 2px 8px ${c.destructive}15`,
        }}>
          <Icon name="log-out" size={17} color={c.destructive} />
          <span style={{ fontSize: 15, fontWeight: 700, color: c.destructive }}>Abmelden</span>
        </button>
      </div>

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <div onClick={() => setShowThemePicker(false)} style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 24,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: c.card, borderRadius: 20, border: `1px solid ${c.border}`,
            padding: 20, width: "100%", maxWidth: 320,
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center", marginBottom: 12, color: c.foreground }}>
              Design
            </div>
            {(["light", "dark", "system"] as ThemePreference[]).map((opt) => {
              const icon: IconName = opt === "dark" ? "moon" : opt === "light" ? "sun" : "monitor";
              const active = themePreference === opt;
              return (
                <button key={opt} onClick={() => handleTheme(opt)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: 14,
                  borderRadius: 14, border: `1px solid ${active ? c.primary : c.border}`,
                  backgroundColor: active ? c.accent : "transparent",
                  cursor: "pointer", width: "100%", marginBottom: 8,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: active ? c.primary : c.secondary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon name={icon} size={17} color={active ? "#fff" : c.mutedForeground} />
                  </div>
                  <span style={{
                    fontSize: 15, fontWeight: active ? 700 : 400,
                    color: active ? c.primary : c.foreground,
                  }}>
                    {THEME_LABELS[opt]}
                  </span>
                  {active && (
                    <div style={{ marginLeft: "auto" }}>
                      <Icon name="check-circle" size={17} color={c.primary} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: 0.7, marginTop: 8, marginBottom: 2, marginLeft: 6, color,
    }}>{label}</div>
  );
}

function ListCard({ children, borderColor, bgColor }: {
  children: React.ReactNode; borderColor: string; bgColor: string;
}) {
  return (
    <div style={{
      backgroundColor: bgColor, borderRadius: 18, border: `1px solid ${borderColor}`,
      overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
    }}>
      {children}
    </div>
  );
}

function ListRow({ icon, label, value, c, divider, noArrow, onClick }: {
  icon: IconName; label: string; value?: string;
  c: typeof LIGHT; divider?: boolean; noArrow?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 16px",
      borderBottom: divider ? `1px solid ${c.border}` : undefined,
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, backgroundColor: c.accent,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon name={icon} size={16} color={c.primary} />
      </div>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: c.foreground }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: c.mutedForeground }}>{value}</span>}
      {!noArrow && <Icon name="chevron-right" size={16} color={c.mutedForeground} />}
    </div>
  );
}

function ToggleRowComp({ icon, label, desc, value, onToggle, c, divider, warning }: {
  icon: IconName; label: string; desc: string;
  value: boolean; onToggle: () => void;
  c: typeof LIGHT; divider?: boolean; warning?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: divider ? `1px solid ${c.border}` : undefined,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        backgroundColor: value ? c.accent : c.secondary,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={16}
          color={value ? (warning ? c.warning : c.primary) : c.mutedForeground} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: c.foreground }}>{label}</span>
        <span style={{ fontSize: 12, color: c.mutedForeground, lineHeight: "1.4" }}>{desc}</span>
      </div>
      <Toggle on={value} onToggle={onToggle} primaryColor={c.primary}
        borderColor={c.border} warning={warning} />
    </div>
  );
}
