#!/usr/bin/env node
/**
 * Generates FahrtDoc iOS App Store assets:
 *   - screenshot-01-home.png        (1290×2796 – iPhone 6.7")
 *   - screenshot-02-active.png      (1290×2796 – iPhone 6.7")
 *   - screenshot-03-history.png     (1290×2796 – iPhone 6.7")
 *   - screenshot-04-export.png      (1290×2796 – iPhone 6.7")
 *   - ipad-screenshot-01-home.png   (2048×2732 – iPad Pro 12.9")
 *   - ipad-screenshot-02-active.png (2048×2732 – iPad Pro 12.9")
 *   - ipad-screenshot-03-export.png (2048×2732 – iPad Pro 12.9")
 *   - feature-banner.png            (1024×500  – promotional banner)
 *
 * Strategy: all phone SVGs are authored at the Android base size
 * (1080×1920) and then wrapped in a non-uniform scale transform so
 * they fill the iPhone 6.7" canvas (1290×2796) exactly.
 * iOS-specific chrome (Dynamic Island, home indicator) is drawn in the
 * outer 1290×2796 coordinate space so it never gets distorted.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUT = __dirname;

function write(name, svg) {
  const svgPath = path.join(OUT, name + ".svg");
  const pngPath = path.join(OUT, name + ".png");
  fs.writeFileSync(svgPath, svg, "utf8");
  execSync(`magick -background none "${svgPath}" "${pngPath}"`, {
    stdio: "inherit",
  });
  fs.unlinkSync(svgPath);
  console.log("✓", name + ".png");
}

// ─── Design tokens (identical to Android generator) ───────────────────────────
const BG            = "#0D1117";
const CARD          = "#161D2A";
const CARD2         = "#1C2535";
const PRIMARY       = "#2563EB";
const LIGHT_PRIMARY = "#60A5FA";
const TEXT          = "#F1F5F9";
const MUTED         = "#64748B";
const SUCCESS       = "#16A34A";
const SUCCESS_BG    = "#0F2A1A";
const BORDER        = "#222D3E";
const ORANGE        = "#F59E0B";
const RED           = "#EF4444";

// ─── Scale factors: 1080×1920 → 1290×2796 ────────────────────────────────────
const XS = 1290 / 1080; // ≈ 1.1944
const YS = 2796 / 1920; // ≈ 1.4563

// ─── iPhone 6.7" chrome helpers ───────────────────────────────────────────────
// These are drawn *after* the scaled content, in 1290×2796 space.
function dynamicIsland() {
  return `
  <!-- Dynamic Island -->
  <rect x="495" y="14" width="300" height="40" rx="20" fill="#000000"/>`;
}

function homeIndicator() {
  return `
  <!-- Home indicator -->
  <rect x="495" y="2746" width="300" height="8" rx="4" fill="${TEXT}" opacity="0.35"/>`;
}

// ─── iPad 12.9" chrome helper ─────────────────────────────────────────────────
function ipadStatusBar(w = 2048) {
  return `
  <rect width="${w}" height="80" fill="${BG}" opacity="0.96"/>
  <text x="70" y="56" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" font-weight="600">9:41</text>
  <g transform="translate(${w - 220}, 22)">
    <rect x="0" y="8" width="40" height="24" rx="4" fill="none" stroke="${TEXT}" stroke-width="3" opacity="0.8"/>
    <rect x="40" y="16" width="5" height="9" rx="2" fill="${TEXT}" opacity="0.8"/>
    <rect x="3" y="11" width="31" height="18" rx="2" fill="${TEXT}" opacity="0.8"/>
    <rect x="56" y="10" width="24" height="20" rx="3" fill="${TEXT}" opacity="0.6"/>
    <rect x="60" y="14" width="16" height="12" rx="1" fill="${BG}" opacity="0.4"/>
    <rect x="92" y="8" width="28" height="7" rx="3" fill="${TEXT}" opacity="0.7"/>
    <rect x="92" y="20" width="22" height="7" rx="3" fill="${TEXT}" opacity="0.5"/>
    <rect x="92" y="32" width="14" height="7" rx="3" fill="${TEXT}" opacity="0.3"/>
  </g>`;
}

// ─── Inner content functions (authored at 1080×1920 base) ─────────────────────
function statusBar(w = 1080) {
  return `
  <rect width="${w}" height="72" fill="${BG}" opacity="0.95"/>
  <text x="60" y="50" font-family="Arial,sans-serif" font-size="30" fill="${TEXT}" font-weight="600">9:41</text>
  <g transform="translate(${w - 200}, 20)">
    <rect x="0" y="8" width="36" height="22" rx="4" fill="none" stroke="${TEXT}" stroke-width="3" opacity="0.8"/>
    <rect x="36" y="15" width="5" height="8" rx="2" fill="${TEXT}" opacity="0.8"/>
    <rect x="3" y="11" width="27" height="16" rx="2" fill="${TEXT}" opacity="0.8"/>
    <rect x="50" y="10" width="22" height="18" rx="3" fill="${TEXT}" opacity="0.6"/>
    <rect x="54" y="14" width="14" height="10" rx="1" fill="${BG}" opacity="0.4"/>
    <rect x="80" y="8" width="24" height="6" rx="3" fill="${TEXT}" opacity="0.7"/>
    <rect x="80" y="18" width="18" height="6" rx="3" fill="${TEXT}" opacity="0.5"/>
    <rect x="80" y="28" width="12" height="6" rx="3" fill="${TEXT}" opacity="0.3"/>
  </g>`;
}

function navBar(active, w = 1080, y = 1720) {
  const items = [
    { icon: "M540,30 L80,460 L180,460 L180,820 L380,820 L380,560 L700,560 L700,820 L900,820 L900,460 L1000,460 Z", label: "Home",   key: "home",   x: 200 },
    { icon: "M540,80 m-200,120 a200,200 0 1,1 400,0 a200,200 0 1,1 -400,0 M340,400 L540,200 L740,400",               label: "Fahrten",key: "trips",  x: 500 },
    { icon: "M200,100 L800,100 L800,900 L200,900 Z M300,300 L700,300 M300,450 L700,450 M300,600 L600,600",             label: "Export", key: "export", x: 800 },
  ];
  const tabW = w / 3;
  return `
  <rect x="0" y="${y}" width="${w}" height="200" fill="${CARD}"/>
  <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${BORDER}" stroke-width="2"/>
  ${items.map((item, i) => {
    const cx = (i + 0.5) * tabW;
    const isActive = item.key === active;
    const color = isActive ? LIGHT_PRIMARY : MUTED;
    return `
    <g transform="translate(${cx - 30}, ${y + 20}) scale(0.06)" opacity="${isActive ? 1 : 0.6}">
      <path d="${item.icon}" fill="${color}"/>
    </g>
    <text x="${cx}" y="${y + 130}" font-family="Arial,sans-serif" font-size="28" fill="${color}" text-anchor="middle" font-weight="${isActive ? "700" : "400"}">${item.label}</text>`;
  }).join("")}`;
}

function tripCard(x, y, w, from, to, date, km, type, color = SUCCESS) {
  const typeColor = type === "Geschäftlich" ? LIGHT_PRIMARY : ORANGE;
  const typeBg    = type === "Geschäftlich" ? "#0D2340"     : "#2A1A0A";
  return `
  <rect x="${x}" y="${y}" width="${w}" height="180" rx="20" fill="${CARD}"/>
  <rect x="${x}" y="${y}" width="8" height="180" rx="4" fill="${color}"/>
  <text x="${x + 40}" y="${y + 50}"  font-family="Arial,sans-serif" font-size="30" fill="${TEXT}"  font-weight="700">${from}</text>
  <text x="${x + 40}" y="${y + 90}"  font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">→ ${to}</text>
  <text x="${x + 40}" y="${y + 130}" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}">${date}</text>
  <rect x="${x + w - 260}" y="${y + 18}" width="220" height="44" rx="12" fill="${typeBg}"/>
  <text x="${x + w - 150}" y="${y + 47}" font-family="Arial,sans-serif" font-size="24" fill="${typeColor}" text-anchor="middle" font-weight="600">${type}</text>
  <text x="${x + w - 40}"  y="${y + 130}" font-family="Arial,sans-serif" font-size="28" fill="${TEXT}" text-anchor="end" font-weight="700">${km} km</text>`;
}

// ─── Wrap 1080×1920 inner SVG for iPhone 6.7" ────────────────────────────────
function iphoneWrap(innerContent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1290" height="2796">
  <!-- Scaled app content (1080×1920 → 1290×2796) -->
  <g transform="scale(${XS}, ${YS})">
    ${innerContent}
  </g>
  ${dynamicIsland()}
  ${homeIndicator()}
</svg>`;
}

// ─── Screen: Home (1080×1920 inner) ──────────────────────────────────────────
const homeInner = `
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <rect width="1080" height="140" fill="${BG}"/>
  <text x="60" y="150" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="${TEXT}">FahrtDoc</text>
  <circle cx="1000" cy="120" r="50" fill="${CARD2}"/>
  <text x="1000" y="132" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle">MM</text>

  <rect x="60" y="175" width="200" height="50" rx="25" fill="${SUCCESS_BG}"/>
  <circle cx="90" cy="200" r="10" fill="${SUCCESS}"/>
  <text x="115" y="208" font-family="Arial,sans-serif" font-size="26" fill="${SUCCESS}" font-weight="700">Aktiv</text>

  <rect x="40" y="248" width="1000" height="240" rx="24" fill="${CARD}"/>
  <rect x="40" y="248" width="1000" height="4"   rx="2"  fill="${PRIMARY}"/>
  <text x="80" y="316" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="${TEXT}">Fahrt starten</text>
  <text x="80" y="362" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}">GPS-Tracking wird automatisch aktiviert</text>
  <rect x="80"  y="390" width="400" height="76" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="437" font-family="Arial,sans-serif" font-size="32" fill="white" text-anchor="middle" font-weight="700">▶  Fahrt beginnen</text>
  <rect x="510" y="390" width="400" height="76" rx="20" fill="${CARD2}"/>
  <text x="710" y="437" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle" font-weight="600">Manuelle Fahrt</text>

  <rect x="40"  y="520" width="310" height="180" rx="20" fill="${CARD}"/>
  <text x="195" y="580" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">Diese Woche</text>
  <text x="195" y="648" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="${TEXT}" text-anchor="middle">347</text>
  <text x="195" y="685" font-family="Arial,sans-serif" font-size="26" fill="${LIGHT_PRIMARY}" text-anchor="middle">km</text>

  <rect x="375" y="520" width="310" height="180" rx="20" fill="${CARD}"/>
  <text x="530" y="580" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">Fahrten</text>
  <text x="530" y="648" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="${TEXT}" text-anchor="middle">12</text>
  <text x="530" y="685" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">diesen Monat</text>

  <rect x="710" y="520" width="330" height="180" rx="20" fill="${CARD}"/>
  <text x="875" y="580" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">Geschäftlich</text>
  <text x="875" y="648" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="${TEXT}" text-anchor="middle">83%</text>
  <text x="875" y="685" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">aller Fahrten</text>

  <text x="60"   y="760" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Letzte Fahrten</text>
  <text x="1000" y="760" font-family="Arial,sans-serif" font-size="28" fill="${LIGHT_PRIMARY}" text-anchor="end">Alle anzeigen</text>

  ${tripCard(40,  780, 1000, "Büro München",  "Kunde Frankfurt",  "Heute, 09:15",   "347",  "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40,  990, 1000, "Zuhause",       "Supermarkt",       "Gestern, 17:42", "8.3",  "Privat",       ORANGE)}
  ${tripCard(40, 1200, 1000, "Hotel Berlin",  "Messe Berlin",     "12. Jun, 08:30", "12.7", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 1410, 1000, "Büro München",  "Kunde Stuttgart",  "11. Jun, 13:05", "225",  "Geschäftlich", LIGHT_PRIMARY)}

  ${navBar("home")}`;

// ─── Screen: Active Trip (1080×1920 inner) ───────────────────────────────────
const activeInner = `
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <text x="540" y="155" font-family="Arial,sans-serif" font-size="44" font-weight="700" fill="${TEXT}" text-anchor="middle">Fahrt läuft…</text>

  <circle cx="540" cy="350" r="140" fill="${SUCCESS_BG}" opacity="0.6"/>
  <circle cx="540" cy="350" r="110" fill="${SUCCESS_BG}" opacity="0.8"/>
  <circle cx="540" cy="350" r="80"  fill="${SUCCESS}"    opacity="0.15"/>
  <circle cx="540" cy="350" r="60"  fill="${SUCCESS}"/>
  <g transform="translate(504, 314) scale(1.8)">
    <path d="M5,18 L10,7 L30,7 L35,18 Z" fill="white" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="2" y="18" width="35" height="13" rx="4" fill="white"/>
    <circle cx="9"  cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
    <circle cx="30" cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
  </g>

  <text x="540" y="540" font-family="Arial,sans-serif" font-size="100" font-weight="800" fill="${TEXT}" text-anchor="middle" letter-spacing="4">00:23:47</text>
  <text x="540" y="600" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">Fahrzeit</text>

  <rect x="40" y="640" width="1000" height="140" rx="20" fill="${CARD}"/>
  <circle cx="90" cy="710" r="22" fill="#0D2340" stroke="${LIGHT_PRIMARY}" stroke-width="2"/>
  <circle cx="90" cy="710" r="10" fill="${LIGHT_PRIMARY}"/>
  <text x="130" y="695" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">Startpunkt</text>
  <text x="130" y="735" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" font-weight="600">Maximilianstraße 22, München</text>

  <line x1="90" y1="780" x2="90" y2="840" stroke="${LIGHT_PRIMARY}" stroke-width="3" stroke-dasharray="8,8" opacity="0.6"/>
  <line x1="90" y1="840" x2="90" y2="900" stroke="${LIGHT_PRIMARY}" stroke-width="3" stroke-dasharray="8,8" opacity="0.4"/>

  <rect x="40" y="920" width="1000" height="140" rx="20" fill="${CARD}"/>
  <circle cx="90" cy="990" r="22" fill="${SUCCESS_BG}" stroke="${SUCCESS}" stroke-width="2"/>
  <circle cx="90" cy="990" r="10" fill="${SUCCESS}"/>
  <text x="130" y="975"  font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">Aktueller Standort</text>
  <text x="130" y="1015" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" font-weight="600">A9 Richtung Nürnberg, 147 km/h</text>

  <rect x="40"  y="1090" width="300" height="160" rx="20" fill="${CARD}"/>
  <text x="190" y="1150" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">Strecke</text>
  <text x="190" y="1210" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}" text-anchor="middle">47.3</text>
  <text x="190" y="1238" font-family="Arial,sans-serif" font-size="24" fill="${LIGHT_PRIMARY}" text-anchor="middle">km</text>

  <rect x="365" y="1090" width="310" height="160" rx="20" fill="${CARD}"/>
  <text x="520" y="1150" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">Geschwindigkeit</text>
  <text x="520" y="1210" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}" text-anchor="middle">147</text>
  <text x="520" y="1238" font-family="Arial,sans-serif" font-size="24" fill="${LIGHT_PRIMARY}" text-anchor="middle">km/h</text>

  <rect x="700" y="1090" width="340" height="160" rx="20" fill="${CARD}"/>
  <text x="870" y="1150" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}" text-anchor="middle">GPS-Punkte</text>
  <text x="870" y="1210" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}" text-anchor="middle">284</text>
  <text x="870" y="1238" font-family="Arial,sans-serif" font-size="24" fill="${SUCCESS}" text-anchor="middle">aufgezeichnet</text>

  <text x="60" y="1310" font-family="Arial,sans-serif" font-size="32" font-weight="600" fill="${TEXT}">Fahrtzweck</text>
  <rect x="40"  y="1330" width="480" height="72" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="1375" font-family="Arial,sans-serif" font-size="30" fill="white" text-anchor="middle" font-weight="700">Geschäftlich</text>
  <rect x="540" y="1330" width="500" height="72" rx="20" fill="${CARD2}"/>
  <text x="790" y="1375" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">Privat</text>

  <rect x="40"  y="1440" width="1000" height="100" rx="26" fill="${RED}"/>
  <text x="540" y="1503" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle" font-weight="800">■  Fahrt beenden</text>

  <rect x="40" y="1560" width="1000" height="140" rx="20" fill="${CARD2}"/>
  <text x="540" y="1640" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">🗺  Routenvorschau</text>
  <path d="M100,1630 Q250,1580 400,1620 Q550,1665 700,1610 Q800,1575 980,1620" stroke="${LIGHT_PRIMARY}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
  <circle cx="100" cy="1630" r="8" fill="${LIGHT_PRIMARY}"/>
  <circle cx="980" cy="1620" r="8" fill="${SUCCESS}"/>

  ${navBar("home")}`;

// ─── Screen: Trip History (1080×1920 inner) ───────────────────────────────────
const historyInner = `
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <text x="60" y="155" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}">Fahrten</text>
  <rect x="780" y="100" width="260" height="60" rx="30" fill="${CARD}"/>
  <text x="910" y="139" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle">🔽  Alle Fahrten</text>

  <rect x="40" y="180" width="1000" height="120" rx="20" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1"/>
  <text x="80"  y="230" font-family="Arial,sans-serif" font-size="28" fill="${LIGHT_PRIMARY}" font-weight="600">Juni 2026</text>
  <text x="80"  y="270" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">23 Fahrten · 1.847 km · 1.530 km geschäftlich</text>
  <rect x="780" y="210" width="220" height="60" rx="14" fill="${PRIMARY}"/>
  <text x="890" y="248" font-family="Arial,sans-serif" font-size="26" fill="white" text-anchor="middle" font-weight="700">Exportieren</text>

  <text x="60" y="360" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">HEUTE, 2. JUNI</text>
  ${tripCard(40,  380, 1000, "Büro München",    "Kunde Frankfurt",  "09:15 – 14:32", "347",  "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40,  580, 1000, "Essen Innenstadt","Hotel Kempinski",  "18:05 – 18:22", "5.2",  "Privat",       ORANGE)}

  <text x="60" y="810" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">GESTERN, 1. JUNI</text>
  ${tripCard(40,  830, 1000, "Hotel Kempinski", "Flughafen FRA",    "07:10 – 08:45", "42.1", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 1030, 1000, "Flughafen FRA",   "Büro München",     "17:20 – 19:05", "345",  "Geschäftlich", LIGHT_PRIMARY)}

  <text x="60" y="1270" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">31. MAI</text>
  ${tripCard(40, 1290, 1000, "Zuhause",         "Supermarkt Edeka", "17:42 – 17:58", "8.3",  "Privat",       ORANGE)}
  ${tripCard(40, 1490, 1000, "Büro München",    "Kunde Ingolstadt", "08:30 – 09:45", "84.7", "Geschäftlich", LIGHT_PRIMARY)}

  ${navBar("trips")}`;

// ─── Screen: Export (1080×1920 inner) ─────────────────────────────────────────
const exportInner = `
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <text x="60" y="155" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}">Export</text>

  <rect x="40"  y="185" width="1000" height="700" rx="24" fill="${CARD}"/>
  <rect x="110" y="230" width="580"  height="620" rx="10" fill="white"/>
  <rect x="110" y="230" width="580"  height="70"  rx="10" fill="${PRIMARY}"/>
  <text x="140" y="273" font-family="Arial,sans-serif" font-size="24" fill="white" font-weight="700">FahrtDoc – Fahrtenbuch</text>
  <text x="650" y="265" font-family="Arial,sans-serif" font-size="20" fill="white" text-anchor="end">Juni 2026</text>
  ${[0,1,2,3,4,5,6,7].map(i => `
  <rect x="110" y="${310 + i * 68}" width="580" height="68" fill="${i % 2 === 0 ? "#F7F9FC" : "white"}"/>
  <text x="130" y="${348 + i * 68}" font-family="Arial,sans-serif" font-size="18" fill="#0F172A">${["02.06.","02.06.","01.06.","01.06.","31.05.","31.05.","30.05.","30.05."][i]}</text>
  <text x="200" y="${348 + i * 68}" font-family="Arial,sans-serif" font-size="16" fill="#64748B">${["Büro → Frankfurt","Essen → Hotel","Hotel → FRA","FRA → Büro","Zuhause → Edeka","Büro → Ingolstadt","Zuhause → Büro","Büro → Kunde"][i]}</text>
  <text x="660" y="${348 + i * 68}" font-family="Arial,sans-serif" font-size="18" fill="#0F172A" text-anchor="end" font-weight="600">${["347","5.2","42.1","345","8.3","84.7","33.4","216"][i]} km</text>`).join("")}
  <rect x="110" y="822" width="580" height="2" fill="#E2E8F0"/>
  <text x="130" y="845" font-family="Arial,sans-serif" font-size="18" fill="#64748B">Gesamt: 1.847 km | Geschäftlich: 1.530 km | Privat: 317 km</text>

  <rect x="730" y="250" width="270" height="200" rx="14" fill="${CARD2}"/>
  <text x="865" y="310" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Zeitraum</text>
  <text x="865" y="355" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle" font-weight="700">01.06.–30.06.</text>
  <text x="865" y="390" font-family="Arial,sans-serif" font-size="22" fill="${MUTED}" text-anchor="middle">2026</text>

  <rect x="730" y="470" width="270" height="200" rx="14" fill="${CARD2}"/>
  <text x="865" y="530" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Fahrten</text>
  <text x="865" y="590" font-family="Arial,sans-serif" font-size="56" fill="${TEXT}" text-anchor="middle" font-weight="800">23</text>
  <text x="865" y="640" font-family="Arial,sans-serif" font-size="22" fill="${SUCCESS}" text-anchor="middle">✓ vollständig</text>

  <text x="60"  y="950" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Exportformat</text>

  <rect x="40"  y="970" width="480" height="140" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="1025" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle">📄</text>
  <text x="280" y="1070" font-family="Arial,sans-serif" font-size="32" fill="white" text-anchor="middle" font-weight="700">PDF exportieren</text>
  <text x="280" y="1098" font-family="Arial,sans-serif" font-size="24" fill="#93C5FD" text-anchor="middle">Steuerl. anerkannt</text>

  <rect x="560" y="970" width="480" height="140" rx="20" fill="${CARD}"/>
  <text x="800" y="1025" font-family="Arial,sans-serif" font-size="38" fill="${TEXT}" text-anchor="middle">📊</text>
  <text x="800" y="1070" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle" font-weight="700">CSV exportieren</text>
  <text x="800" y="1098" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Für Excel / Numbers</text>

  <text x="60"  y="1180" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Zeitraum wählen</text>

  <rect x="40"  y="1200" width="220" height="80" rx="20" fill="${PRIMARY}"/>
  <text x="150" y="1250" font-family="Arial,sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="700">Monat</text>
  <rect x="280" y="1200" width="220" height="80" rx="20" fill="${CARD}"/>
  <text x="390" y="1250" font-family="Arial,sans-serif" font-size="28" fill="${MUTED}" text-anchor="middle">Quartal</text>
  <rect x="520" y="1200" width="220" height="80" rx="20" fill="${CARD}"/>
  <text x="630" y="1250" font-family="Arial,sans-serif" font-size="28" fill="${MUTED}" text-anchor="middle">Jahr</text>
  <rect x="760" y="1200" width="280" height="80" rx="20" fill="${CARD}"/>
  <text x="900" y="1250" font-family="Arial,sans-serif" font-size="28" fill="${MUTED}" text-anchor="middle">Benutzerdefiniert</text>

  <rect x="40"  y="1310" width="1000" height="96" rx="26" fill="${PRIMARY}"/>
  <text x="540" y="1369" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle" font-weight="800">📤  Jetzt exportieren</text>

  <rect x="40"  y="1440" width="1000" height="240" rx="20" fill="${CARD}"/>
  <text x="80"  y="1495" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">LETZTER EXPORT</text>
  <text x="80"  y="1540" font-family="Arial,sans-serif" font-size="36" fill="${TEXT}" font-weight="700">Fahrtenbuch_Mai_2026.pdf</text>
  <text x="80"  y="1580" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">19 Fahrten · 1.243 km · 01.05. – 31.05.2026</text>
  <rect x="80"  y="1600" width="240" height="56" rx="16" fill="${CARD2}"/>
  <text x="200" y="1635" font-family="Arial,sans-serif" font-size="26" fill="${LIGHT_PRIMARY}" text-anchor="middle" font-weight="600">📋  Teilen</text>
  <rect x="360" y="1600" width="240" height="56" rx="16" fill="${CARD2}"/>
  <text x="480" y="1635" font-family="Arial,sans-serif" font-size="26" fill="${LIGHT_PRIMARY}" text-anchor="middle" font-weight="600">📂  Öffnen</text>

  ${navBar("export")}`;

// ─── iPad 12.9" Home Screen (2048×2732) ──────────────────────────────────────
// iPad uses a two-column layout to take advantage of the wider canvas.
const ipadHomeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732">
  <rect width="2048" height="2732" fill="${BG}"/>
  ${ipadStatusBar(2048)}

  <!-- Header -->
  <text x="80" y="200" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}">FahrtDoc</text>
  <circle cx="1950" cy="160" r="70" fill="${CARD2}"/>
  <text x="1950" y="180" font-family="Arial,sans-serif" font-size="42" fill="${TEXT}" text-anchor="middle">MM</text>
  <rect x="80" y="230" width="260" height="64" rx="32" fill="${SUCCESS_BG}"/>
  <circle cx="115" cy="262" r="13" fill="${SUCCESS}"/>
  <text x="145" y="270" font-family="Arial,sans-serif" font-size="32" fill="${SUCCESS}" font-weight="700">Aktiv</text>

  <!-- Quick Start card (left column) -->
  <rect x="60" y="324" width="1920" height="280" rx="28" fill="${CARD}"/>
  <rect x="60" y="324" width="1920" height="5"   rx="2"  fill="${PRIMARY}"/>
  <text x="110" y="408" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="${TEXT}">Fahrt starten</text>
  <text x="110" y="464" font-family="Arial,sans-serif" font-size="38" fill="${MUTED}">GPS-Tracking wird automatisch aktiviert</text>
  <rect x="110" y="492" width="540" height="88" rx="24" fill="${PRIMARY}"/>
  <text x="380" y="548" font-family="Arial,sans-serif" font-size="40" fill="white" text-anchor="middle" font-weight="700">▶  Fahrt beginnen</text>
  <rect x="680" y="492" width="520" height="88" rx="24" fill="${CARD2}"/>
  <text x="940" y="548" font-family="Arial,sans-serif" font-size="40" fill="${TEXT}" text-anchor="middle" font-weight="600">Manuelle Fahrt</text>

  <!-- Stats row -->
  <rect x="60"   y="640" width="600" height="220" rx="24" fill="${CARD}"/>
  <text x="360"  y="720" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">Diese Woche</text>
  <text x="360"  y="820" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">347</text>
  <text x="360"  y="862" font-family="Arial,sans-serif" font-size="34" fill="${LIGHT_PRIMARY}" text-anchor="middle">km</text>

  <rect x="700"  y="640" width="600" height="220" rx="24" fill="${CARD}"/>
  <text x="1000" y="720" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">Fahrten</text>
  <text x="1000" y="820" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">12</text>
  <text x="1000" y="862" font-family="Arial,sans-serif" font-size="34" fill="${MUTED}" text-anchor="middle">diesen Monat</text>

  <rect x="1340" y="640" width="640" height="220" rx="24" fill="${CARD}"/>
  <text x="1660" y="720" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">Geschäftlich</text>
  <text x="1660" y="820" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">83%</text>
  <text x="1660" y="862" font-family="Arial,sans-serif" font-size="34" fill="${MUTED}" text-anchor="middle">aller Fahrten</text>

  <!-- Recent trips label -->
  <text x="80"   y="940" font-family="Arial,sans-serif" font-size="48" font-weight="700" fill="${TEXT}">Letzte Fahrten</text>
  <text x="1980" y="940" font-family="Arial,sans-serif" font-size="38" fill="${LIGHT_PRIMARY}" text-anchor="end">Alle anzeigen</text>

  <!-- Trip cards – two columns -->
  ${[
    [60,  960, 920, "Büro München",   "Kunde Frankfurt",  "Heute, 09:15",   "347",  "Geschäftlich", LIGHT_PRIMARY],
    [1060,960, 920, "Zuhause",        "Supermarkt",       "Gestern, 17:42", "8.3",  "Privat",       ORANGE],
    [60,  1180,920, "Hotel Berlin",   "Messe Berlin",     "12. Jun, 08:30", "12.7", "Geschäftlich", LIGHT_PRIMARY],
    [1060,1180,920, "Büro München",   "Kunde Stuttgart",  "11. Jun, 13:05", "225",  "Geschäftlich", LIGHT_PRIMARY],
    [60,  1400,920, "Flughafen FRA",  "Büro München",     "01. Jun, 17:20", "345",  "Geschäftlich", LIGHT_PRIMARY],
    [1060,1400,920, "Büro München",   "Kunde Ingolstadt", "31. Mai, 08:30", "84.7", "Geschäftlich", LIGHT_PRIMARY],
    [60,  1620,920, "Zuhause",        "Supermarkt Edeka", "31. Mai, 17:42", "8.3",  "Privat",       ORANGE],
    [1060,1620,920, "Hotel Kempinski","Flughafen FRA",    "01. Jun, 07:10", "42.1", "Geschäftlich", LIGHT_PRIMARY],
    [60,  1840,920, "Büro München",   "Kunde Frankfurt",  "30. Mai, 09:15", "347",  "Geschäftlich", LIGHT_PRIMARY],
    [1060,1840,920, "Zuhause",        "Supermarkt",       "29. Mai, 17:42", "8.3",  "Privat",       ORANGE],
  ].map(([x, y, w, from, to, date, km, type, color]) => {
    const typeColor = type === "Geschäftlich" ? LIGHT_PRIMARY : ORANGE;
    const typeBg    = type === "Geschäftlich" ? "#0D2340"     : "#2A1A0A";
    return `
    <rect x="${x}" y="${y}" width="${w}" height="200" rx="24" fill="${CARD}"/>
    <rect x="${x}" y="${y}" width="10"  height="200" rx="5"  fill="${color}"/>
    <text x="${Number(x)+50}" y="${Number(y)+60}"  font-family="Arial,sans-serif" font-size="36" fill="${TEXT}"  font-weight="700">${from}</text>
    <text x="${Number(x)+50}" y="${Number(y)+108}" font-family="Arial,sans-serif" font-size="32" fill="${MUTED}">→ ${to}</text>
    <text x="${Number(x)+50}" y="${Number(y)+154}" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}">${date}</text>
    <rect x="${Number(x)+Number(w)-300}" y="${Number(y)+22}" width="260" height="52" rx="14" fill="${typeBg}"/>
    <text x="${Number(x)+Number(w)-170}" y="${Number(y)+56}" font-family="Arial,sans-serif" font-size="30" fill="${typeColor}" text-anchor="middle" font-weight="600">${type}</text>
    <text x="${Number(x)+Number(w)-48}"  y="${Number(y)+154}" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" text-anchor="end" font-weight="700">${km} km</text>`;
  }).join("")}

  <!-- Bottom nav -->
  <rect x="0" y="2572" width="2048" height="160" fill="${CARD}"/>
  <line x1="0" y1="2572" x2="2048" y2="2572" stroke="${BORDER}" stroke-width="2"/>
  ${[
    { label: "Home",    key: "home",   icon: "M540,30 L80,460 L180,460 L180,820 L380,820 L380,560 L700,560 L700,820 L900,820 L900,460 L1000,460 Z" },
    { label: "Fahrten", key: "trips",  icon: "M540,80 m-200,120 a200,200 0 1,1 400,0 a200,200 0 1,1 -400,0 M340,400 L540,200 L740,400" },
    { label: "Export",  key: "export", icon: "M200,100 L800,100 L800,900 L200,900 Z M300,300 L700,300 M300,450 L700,450 M300,600 L600,600" },
  ].map((item, i) => {
    const cx = (i + 0.5) * (2048 / 3);
    const isActive = item.key === "home";
    const color = isActive ? LIGHT_PRIMARY : MUTED;
    return `
    <g transform="translate(${cx - 36}, 2582) scale(0.07)" opacity="${isActive ? 1 : 0.6}">
      <path d="${item.icon}" fill="${color}"/>
    </g>
    <text x="${cx}" y="2718" font-family="Arial,sans-serif" font-size="34" fill="${color}" text-anchor="middle" font-weight="${isActive ? "700" : "400"}">${item.label}</text>`;
  }).join("")}
</svg>`;

// ─── iPad Active Trip (2048×2732) ─────────────────────────────────────────────
const ipadActiveSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732">
  <rect width="2048" height="2732" fill="${BG}"/>
  ${ipadStatusBar(2048)}

  <text x="1024" y="210" font-family="Arial,sans-serif" font-size="60" font-weight="700" fill="${TEXT}" text-anchor="middle">Fahrt läuft…</text>

  <!-- Left: big active indicator -->
  <circle cx="512"  cy="600" r="220" fill="${SUCCESS_BG}" opacity="0.5"/>
  <circle cx="512"  cy="600" r="170" fill="${SUCCESS_BG}" opacity="0.8"/>
  <circle cx="512"  cy="600" r="120" fill="${SUCCESS}"    opacity="0.2"/>
  <circle cx="512"  cy="600" r="90"  fill="${SUCCESS}"/>
  <g transform="translate(460, 558) scale(2.6)">
    <path d="M5,18 L10,7 L30,7 L35,18 Z" fill="white" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="2" y="18" width="35" height="13" rx="4" fill="white"/>
    <circle cx="9"  cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
    <circle cx="30" cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
  </g>

  <!-- Right: timer + info -->
  <text x="1400" y="480" font-family="Arial,sans-serif" font-size="130" font-weight="800" fill="${TEXT}" text-anchor="middle" letter-spacing="6">00:23:47</text>
  <text x="1400" y="560" font-family="Arial,sans-serif" font-size="40"  fill="${MUTED}" text-anchor="middle">Fahrzeit</text>

  <!-- Stats row -->
  <rect x="60"   y="840" width="600" height="200" rx="24" fill="${CARD}"/>
  <text x="360"  y="910" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">Strecke</text>
  <text x="360"  y="1000" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">47.3</text>
  <text x="360"  y="1030" font-family="Arial,sans-serif" font-size="36" fill="${LIGHT_PRIMARY}" text-anchor="middle">km</text>

  <rect x="720"  y="840" width="600" height="200" rx="24" fill="${CARD}"/>
  <text x="1020" y="910" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">Geschwindigkeit</text>
  <text x="1020" y="1000" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">147</text>
  <text x="1020" y="1030" font-family="Arial,sans-serif" font-size="36" fill="${LIGHT_PRIMARY}" text-anchor="middle">km/h</text>

  <rect x="1380" y="840" width="620" height="200" rx="24" fill="${CARD}"/>
  <text x="1690" y="910" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}" text-anchor="middle">GPS-Punkte</text>
  <text x="1690" y="1000" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}" text-anchor="middle">284</text>
  <text x="1690" y="1030" font-family="Arial,sans-serif" font-size="36" fill="${SUCCESS}" text-anchor="middle">aufgezeichnet</text>

  <!-- Addresses -->
  <rect x="60" y="1080" width="1920" height="160" rx="24" fill="${CARD}"/>
  <circle cx="130" cy="1160" r="28" fill="#0D2340" stroke="${LIGHT_PRIMARY}" stroke-width="3"/>
  <circle cx="130" cy="1160" r="13" fill="${LIGHT_PRIMARY}"/>
  <text x="185" y="1145" font-family="Arial,sans-serif" font-size="34" fill="${MUTED}">Startpunkt</text>
  <text x="185" y="1195" font-family="Arial,sans-serif" font-size="46" fill="${TEXT}" font-weight="600">Maximilianstraße 22, München</text>

  <line x1="130" y1="1240" x2="130" y2="1360" stroke="${LIGHT_PRIMARY}" stroke-width="4" stroke-dasharray="10,10" opacity="0.5"/>

  <rect x="60" y="1360" width="1920" height="160" rx="24" fill="${CARD}"/>
  <circle cx="130" cy="1440" r="28" fill="${SUCCESS_BG}" stroke="${SUCCESS}" stroke-width="3"/>
  <circle cx="130" cy="1440" r="13" fill="${SUCCESS}"/>
  <text x="185" y="1425" font-family="Arial,sans-serif" font-size="34" fill="${MUTED}">Aktueller Standort</text>
  <text x="185" y="1475" font-family="Arial,sans-serif" font-size="46" fill="${TEXT}" font-weight="600">A9 Richtung Nürnberg, 147 km/h</text>

  <!-- Purpose + Stop -->
  <text x="80" y="1600" font-family="Arial,sans-serif" font-size="42" font-weight="600" fill="${TEXT}">Fahrtzweck</text>
  <rect x="60"   y="1630" width="740" height="100" rx="28" fill="${PRIMARY}"/>
  <text x="430"  y="1694" font-family="Arial,sans-serif" font-size="40" fill="white" text-anchor="middle" font-weight="700">Geschäftlich</text>
  <rect x="840"  y="1630" width="740" height="100" rx="28" fill="${CARD2}"/>
  <text x="1210" y="1694" font-family="Arial,sans-serif" font-size="40" fill="${MUTED}" text-anchor="middle">Privat</text>

  <rect x="60" y="1760" width="1920" height="120" rx="32" fill="${RED}"/>
  <text x="1024" y="1836" font-family="Arial,sans-serif" font-size="52" fill="white" text-anchor="middle" font-weight="800">■  Fahrt beenden</text>

  <!-- Route preview -->
  <rect x="60" y="1920" width="1920" height="680" rx="24" fill="${CARD2}"/>
  <text x="1024" y="1990" font-family="Arial,sans-serif" font-size="40" fill="${MUTED}" text-anchor="middle">🗺  Routenvorschau</text>
  <path d="M200,2300 Q500,2100 800,2200 Q1100,2320 1400,2150 Q1650,2050 1870,2200" stroke="${LIGHT_PRIMARY}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
  <circle cx="200"  cy="2300" r="14" fill="${LIGHT_PRIMARY}"/>
  <circle cx="1870" cy="2200" r="14" fill="${SUCCESS}"/>
  <circle cx="650"  cy="2160" r="10" fill="${LIGHT_PRIMARY}" opacity="0.6"/>
  <circle cx="1100" cy="2270" r="10" fill="${LIGHT_PRIMARY}" opacity="0.6"/>

  <!-- Bottom nav -->
  <rect x="0" y="2572" width="2048" height="160" fill="${CARD}"/>
  <line x1="0" y1="2572" x2="2048" y2="2572" stroke="${BORDER}" stroke-width="2"/>
  ${[
    { label: "Home",    key: "home",   icon: "M540,30 L80,460 L180,460 L180,820 L380,820 L380,560 L700,560 L700,820 L900,820 L900,460 L1000,460 Z" },
    { label: "Fahrten", key: "trips",  icon: "M540,80 m-200,120 a200,200 0 1,1 400,0 a200,200 0 1,1 -400,0 M340,400 L540,200 L740,400" },
    { label: "Export",  key: "export", icon: "M200,100 L800,100 L800,900 L200,900 Z M300,300 L700,300 M300,450 L700,450 M300,600 L600,600" },
  ].map((item, i) => {
    const cx = (i + 0.5) * (2048 / 3);
    const isActive = false;
    const color = MUTED;
    return `
    <g transform="translate(${cx - 36}, 2582) scale(0.07)" opacity="0.6">
      <path d="${item.icon}" fill="${color}"/>
    </g>
    <text x="${cx}" y="2718" font-family="Arial,sans-serif" font-size="34" fill="${color}" text-anchor="middle">${item.label}</text>`;
  }).join("")}
</svg>`;

// ─── iPad Export Screen (2048×2732) ───────────────────────────────────────────
const ipadExportSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2732">
  <rect width="2048" height="2732" fill="${BG}"/>
  ${ipadStatusBar(2048)}

  <text x="80" y="200" font-family="Arial,sans-serif" font-size="80" font-weight="800" fill="${TEXT}">Export</text>

  <!-- PDF preview (left column) -->
  <rect x="60" y="240" width="1140" height="1600" rx="28" fill="${CARD}"/>
  <rect x="120" y="290" width="1020" height="1500" rx="14" fill="white"/>
  <rect x="120" y="290" width="1020" height="100"  rx="14" fill="${PRIMARY}"/>
  <text x="158" y="355" font-family="Arial,sans-serif" font-size="36" fill="white" font-weight="700">FahrtDoc – Fahrtenbuch Juni 2026</text>
  ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i => `
  <rect x="120" y="${400 + i * 100}" width="1020" height="100" fill="${i % 2 === 0 ? "#F7F9FC" : "white"}"/>
  <text x="145" y="${460 + i * 100}" font-family="Arial,sans-serif" font-size="26" fill="#0F172A">${["02.06.","02.06.","01.06.","01.06.","31.05.","31.05.","30.05.","30.05.","29.05.","29.05.","28.05.","28.05."][i]}</text>
  <text x="240" y="${460 + i * 100}" font-family="Arial,sans-serif" font-size="24" fill="#64748B">${["Büro → Frankfurt","Essen → Hotel","Hotel → FRA","FRA → Büro","Zuhause → Edeka","Büro → Ingolstadt","Zuhause → Büro","Büro → Kunde","Büro → München","Hotel → Firma","Zuhause → Büro","Büro → Messe"][i]}</text>
  <text x="1110" y="${460 + i * 100}" font-family="Arial,sans-serif" font-size="26" fill="#0F172A" text-anchor="end" font-weight="600">${["347","5.2","42.1","345","8.3","84.7","33.4","216","189","12.8","33.4","28.7"][i]} km</text>`).join("")}
  <rect x="120" y="1600" width="1020" height="3" fill="#E2E8F0"/>
  <text x="145" y="1640" font-family="Arial,sans-serif" font-size="26" fill="#64748B">Gesamt: 1.847 km | Geschäftlich: 1.530 km | Privat: 317 km</text>
  <rect x="120" y="1660" width="1020" height="100" rx="0" fill="white"/>
  <text x="145" y="1712" font-family="Arial,sans-serif" font-size="26" fill="#64748B">Steuerlich anerkanntes Fahrtenbuch – erstellt mit FahrtDoc</text>

  <!-- Right column: controls -->
  <rect x="1260" y="240" width="728" height="300" rx="24" fill="${CARD}"/>
  <text x="1300" y="310" font-family="Arial,sans-serif" font-size="36" fill="${MUTED}">Zeitraum</text>
  <text x="1300" y="374" font-family="Arial,sans-serif" font-size="44" fill="${TEXT}" font-weight="700">01.06. – 30.06.2026</text>
  <text x="1300" y="420" font-family="Arial,sans-serif" font-size="32" fill="${MUTED}">23 Fahrten · 1.847 km</text>
  <rect x="1300" y="440" width="280" height="64" rx="18" fill="${CARD2}"/>
  <text x="1440" y="480" font-family="Arial,sans-serif" font-size="30" fill="${LIGHT_PRIMARY}" text-anchor="middle">Ändern</text>

  <rect x="1260" y="580" width="360" height="200" rx="24" fill="${PRIMARY}"/>
  <text x="1440" y="648" font-family="Arial,sans-serif" font-size="50" fill="white" text-anchor="middle">📄</text>
  <text x="1440" y="712" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle" font-weight="700">PDF</text>
  <text x="1440" y="754" font-family="Arial,sans-serif" font-size="28" fill="#93C5FD" text-anchor="middle">Steuerl. anerkannt</text>

  <rect x="1628" y="580" width="360" height="200" rx="24" fill="${CARD}"/>
  <text x="1808" y="648" font-family="Arial,sans-serif" font-size="50" fill="${TEXT}" text-anchor="middle">📊</text>
  <text x="1808" y="712" font-family="Arial,sans-serif" font-size="38" fill="${TEXT}" text-anchor="middle" font-weight="700">CSV</text>
  <text x="1808" y="754" font-family="Arial,sans-serif" font-size="28" fill="${MUTED}" text-anchor="middle">Excel / Numbers</text>

  <rect x="1260" y="820" width="728" height="120" rx="32" fill="${PRIMARY}"/>
  <text x="1624" y="896" font-family="Arial,sans-serif" font-size="46" fill="white" text-anchor="middle" font-weight="800">📤  Exportieren</text>

  <rect x="1260" y="980" width="728" height="680" rx="24" fill="${CARD}"/>
  <text x="1300" y="1050" font-family="Arial,sans-serif" font-size="34" fill="${MUTED}" font-weight="600">STATISTIKEN JUNI</text>
  ${[
    ["Geschäftlich",  "1.530 km", LIGHT_PRIMARY],
    ["Privat",        "317 km",   ORANGE],
    ["Ø Fahrt",       "80.3 km",  TEXT],
    ["Längste Fahrt", "347 km",   SUCCESS],
  ].map(([label, value, color], i) => `
  <text x="1300" y="${1110 + i * 130}" font-family="Arial,sans-serif" font-size="32" fill="${MUTED}">${label}</text>
  <text x="1950" y="${1110 + i * 130}" font-family="Arial,sans-serif" font-size="40" fill="${color}" text-anchor="end" font-weight="700">${value}</text>
  <line x1="1300" y1="${1130 + i * 130}" x2="1950" y2="${1130 + i * 130}" stroke="${BORDER}" stroke-width="1"/>`).join("")}

  <!-- Bottom nav -->
  <rect x="0" y="2572" width="2048" height="160" fill="${CARD}"/>
  <line x1="0" y1="2572" x2="2048" y2="2572" stroke="${BORDER}" stroke-width="2"/>
  ${[
    { label: "Home",    key: "home",   icon: "M540,30 L80,460 L180,460 L180,820 L380,820 L380,560 L700,560 L700,820 L900,820 L900,460 L1000,460 Z" },
    { label: "Fahrten", key: "trips",  icon: "M540,80 m-200,120 a200,200 0 1,1 400,0 a200,200 0 1,1 -400,0 M340,400 L540,200 L740,400" },
    { label: "Export",  key: "export", icon: "M200,100 L800,100 L800,900 L200,900 Z M300,300 L700,300 M300,450 L700,450 M300,600 L600,600" },
  ].map((item, i) => {
    const cx = (i + 0.5) * (2048 / 3);
    const isActive = item.key === "export";
    const color = isActive ? LIGHT_PRIMARY : MUTED;
    return `
    <g transform="translate(${cx - 36}, 2582) scale(0.07)" opacity="${isActive ? 1 : 0.6}">
      <path d="${item.icon}" fill="${color}"/>
    </g>
    <text x="${cx}" y="2718" font-family="Arial,sans-serif" font-size="34" fill="${color}" text-anchor="middle" font-weight="${isActive ? "700" : "400"}">${item.label}</text>`;
  }).join("")}
</svg>`;

// ─── Feature Banner 1024×500 (iOS-styled) ────────────────────────────────────
const featureBannerSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#0D2340"/>
    </linearGradient>
    <radialGradient id="glow1" cx="25%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="80%" cy="30%" r="40%">
      <stop offset="0%" stop-color="#16A34A" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#16A34A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <ellipse cx="220" cy="250" rx="340" ry="300" fill="url(#glow1)"/>
  <ellipse cx="850" cy="150" rx="260" ry="200" fill="url(#glow2)"/>

  <!-- Dot grid -->
  ${Array.from({length: 6}, (_, r) => Array.from({length: 9}, (_, c) =>
    `<circle cx="${580 + c * 56}" cy="${70 + r * 60}" r="2.5" fill="${LIGHT_PRIMARY}" opacity="${0.07 + (r + c) * 0.012}"/>`
  ).join("")).join("")}

  <!-- iOS phone silhouette -->
  <rect x="60" y="40" width="180" height="360" rx="28" fill="#1A2D4A" stroke="${PRIMARY}" stroke-width="2.5"/>
  <!-- Dynamic Island -->
  <rect x="120" y="54" width="60" height="14" rx="7" fill="#000"/>
  <!-- Screen content mockup -->
  <rect x="72" y="76" width="156" height="296" rx="4" fill="${BG}"/>
  <!-- App bar -->
  <rect x="72" y="76" width="156" height="32" rx="4" fill="${CARD}"/>
  <text x="86" y="98" font-family="Arial,sans-serif" font-size="14" fill="${TEXT}" font-weight="700">FahrtDoc</text>
  <!-- Active pill -->
  <rect x="86" y="116" width="60" height="16" rx="8" fill="${SUCCESS_BG}"/>
  <circle cx="96" cy="124" r="5" fill="${SUCCESS}"/>
  <text x="106" y="128" font-family="Arial,sans-serif" font-size="10" fill="${SUCCESS}" font-weight="700">Aktiv</text>
  <!-- Mini trip cards -->
  <rect x="82" y="142" width="136" height="38" rx="6" fill="${CARD}"/>
  <rect x="82" y="142" width="3"   height="38" rx="2" fill="${LIGHT_PRIMARY}"/>
  <text x="92" y="158" font-family="Arial,sans-serif" font-size="9" fill="${TEXT}" font-weight="600">Büro → Frankfurt</text>
  <text x="92" y="173" font-family="Arial,sans-serif" font-size="9" fill="${MUTED}">347 km  Geschäftlich</text>
  <rect x="82" y="186" width="136" height="38" rx="6" fill="${CARD}"/>
  <rect x="82" y="186" width="3"   height="38" rx="2" fill="${ORANGE}"/>
  <text x="92" y="202" font-family="Arial,sans-serif" font-size="9" fill="${TEXT}" font-weight="600">Zuhause → Edeka</text>
  <text x="92" y="217" font-family="Arial,sans-serif" font-size="9" fill="${MUTED}">8.3 km  Privat</text>
  <!-- Export button mockup -->
  <rect x="82" y="316" width="136" height="28" rx="8" fill="${PRIMARY}"/>
  <text x="150" y="335" font-family="Arial,sans-serif" font-size="11" fill="white" text-anchor="middle" font-weight="700">PDF exportieren</text>
  <!-- Home indicator -->
  <rect x="126" y="388" width="48" height="5" rx="2.5" fill="${TEXT}" opacity="0.3"/>

  <!-- App name & tagline -->
  <text x="306" y="175" font-family="Arial,sans-serif" font-size="82" font-weight="800" fill="${TEXT}" letter-spacing="-2">FahrtDoc</text>
  <text x="308" y="230" font-family="Arial,sans-serif" font-size="30" fill="${LIGHT_PRIMARY}" letter-spacing="0.5" font-weight="500">Dein digitales Fahrtenbuch</text>

  <!-- Feature pills -->
  <rect x="308" y="268" width="234" height="48" rx="24" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="425" y="300" font-family="Arial,sans-serif" font-size="22" fill="${LIGHT_PRIMARY}" text-anchor="middle">🚗  Auto GPS-Tracking</text>

  <rect x="560" y="268" width="214" height="48" rx="24" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="667" y="300" font-family="Arial,sans-serif" font-size="22" fill="${LIGHT_PRIMARY}" text-anchor="middle">📄  PDF &amp; CSV Export</text>

  <rect x="792" y="268" width="174" height="48" rx="24" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="879" y="300" font-family="Arial,sans-serif" font-size="22" fill="${LIGHT_PRIMARY}" text-anchor="middle">🔒  DSGVO</text>

  <!-- Available on App Store badge area -->
  <rect x="308" y="338" width="294" height="64" rx="16" fill="#1A2D4A" stroke="${BORDER}" stroke-width="1.5"/>
  <text x="336" y="362" font-family="Arial,sans-serif" font-size="14" fill="${MUTED}">Verfügbar im</text>
  <text x="336" y="390" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" font-weight="700">App Store</text>

  <!-- Subtitle -->
  <text x="308" y="460" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}">Fahrten automatisch aufzeichnen &amp; Kilometernachweis exportieren</text>
</svg>`;

// ─── Generate all assets ──────────────────────────────────────────────────────
write("screenshot-01-home",        iphoneWrap(homeInner));
write("screenshot-02-active",      iphoneWrap(activeInner));
write("screenshot-03-history",     iphoneWrap(historyInner));
write("screenshot-04-export",      iphoneWrap(exportInner));
write("ipad-screenshot-01-home",   ipadHomeSVG);
write("ipad-screenshot-02-active", ipadActiveSVG);
write("ipad-screenshot-03-export", ipadExportSVG);
write("feature-banner",            featureBannerSVG);

console.log("\nDone! All iOS App Store assets written to:", OUT);
