#!/usr/bin/env node
/**
 * Generates the FahrtDoc feature graphic for Google Play Store:
 *  - feature-graphic.png  (1024×500)
 *
 * Screenshots (screenshot-01 through screenshot-04) are captured from the
 * live Expo web app at /store-preview?screen=<name> — see README.md for
 * the capture + scale workflow.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname);

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

// ─── Colors ──────────────────────────────────────────────────────────────────
const BG = "#0D1117";
const CARD = "#161D2A";
const CARD2 = "#1C2535";
const PRIMARY = "#2563EB";
const LIGHT_PRIMARY = "#60A5FA";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";
const SUCCESS = "#16A34A";
const SUCCESS_BG = "#0F2A1A";
const BORDER = "#222D3E";
const ORANGE = "#F59E0B";
const RED = "#EF4444";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    { icon: "M540,30 L80,460 L180,460 L180,820 L380,820 L380,560 L700,560 L700,820 L900,820 L900,460 L1000,460 Z", label: "Home", key: "home", x: 200 },
    { icon: "M540,80 m-200,120 a200,200 0 1,1 400,0 a200,200 0 1,1 -400,0 M340,400 L540,200 L740,400", label: "Fahrten", key: "trips", x: 500 },
    { icon: "M200,100 L800,100 L800,900 L200,900 Z M300,300 L700,300 M300,450 L700,450 M300,600 L600,600", label: "Export", key: "export", x: 800 },
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
    <text x="${cx}" y="${y + 130}" font-family="Arial,sans-serif" font-size="28" fill="${color}" text-anchor="middle" font-weight="${isActive ? '700' : '400'}">${item.label}</text>`;
  }).join("")}`;
}

function tripCard(x, y, w, from, to, date, km, type, color = SUCCESS) {
  const typeColor = type === "Geschäftlich" ? LIGHT_PRIMARY : ORANGE;
  const typeBg = type === "Geschäftlich" ? "#0D2340" : "#2A1A0A";
  return `
  <rect x="${x}" y="${y}" width="${w}" height="180" rx="20" fill="${CARD}"/>
  <rect x="${x}" y="${y}" width="8" height="180" rx="4" fill="${color}"/>
  <text x="${x + 40}" y="${y + 50}" font-family="Arial,sans-serif" font-size="30" fill="${TEXT}" font-weight="700">${from}</text>
  <text x="${x + 40}" y="${y + 90}" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">→ ${to}</text>
  <text x="${x + 40}" y="${y + 130}" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}">${date}</text>
  <rect x="${x + w - 260}" y="${y + 18}" width="220" height="44" rx="12" fill="${typeBg}"/>
  <text x="${x + w - 150}" y="${y + 47}" font-family="Arial,sans-serif" font-size="24" fill="${typeColor}" text-anchor="middle" font-weight="600">${type}</text>
  <text x="${x + w - 40}" y="${y + 130}" font-family="Arial,sans-serif" font-size="28" fill="${TEXT}" text-anchor="end" font-weight="700">${km} km</text>`;
}

// ─── Feature Graphic 1024×500 ─────────────────────────────────────────────────
const featureGraphicSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#0D2340"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <ellipse cx="200" cy="250" rx="320" ry="280" fill="url(#glow)"/>

  <!-- Decorative dots grid right side -->
  ${Array.from({length: 6}, (_, r) => Array.from({length: 8}, (_, c) =>
    `<circle cx="${600 + c * 60}" cy="${80 + r * 60}" r="2.5" fill="${LIGHT_PRIMARY}" opacity="${0.08 + (r + c) * 0.015}"/>`
  ).join("")).join("")}

  <!-- App icon circle -->
  <circle cx="200" cy="240" r="100" fill="#1A2D4A" stroke="${PRIMARY}" stroke-width="3"/>
  <!-- Car icon -->
  <g transform="translate(130, 185) scale(1.4)">
    <path d="M10,35 L20,15 L60,15 L70,35 Z" fill="${LIGHT_PRIMARY}" stroke="${LIGHT_PRIMARY}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="5" y="35" width="70" height="25" rx="6" fill="${LIGHT_PRIMARY}"/>
    <circle cx="18" cy="62" r="9" fill="${BG}" stroke="${LIGHT_PRIMARY}" stroke-width="3"/>
    <circle cx="62" cy="62" r="9" fill="${BG}" stroke="${LIGHT_PRIMARY}" stroke-width="3"/>
    <rect x="22" y="18" width="16" height="14" rx="2" fill="#93C5FD" opacity="0.9"/>
    <rect x="42" y="18" width="16" height="14" rx="2" fill="#93C5FD" opacity="0.9"/>
  </g>

  <!-- Route dots -->
  <circle cx="200" cy="150" r="6" fill="${LIGHT_PRIMARY}" opacity="0.8"/>
  <line x1="200" y1="156" x2="200" y2="178" stroke="${LIGHT_PRIMARY}" stroke-width="2" stroke-dasharray="4,4" opacity="0.5"/>
  <circle cx="200" cy="184" r="4" fill="${LIGHT_PRIMARY}" opacity="0.5"/>
  <circle cx="200" cy="200" r="4" fill="${LIGHT_PRIMARY}" opacity="0.4"/>

  <!-- App name -->
  <text x="360" y="190" font-family="Arial,sans-serif" font-size="88" font-weight="800" fill="${TEXT}" letter-spacing="-2">FahrtDoc</text>
  <!-- Tagline -->
  <text x="362" y="255" font-family="Arial,sans-serif" font-size="32" fill="${LIGHT_PRIMARY}" letter-spacing="1" font-weight="500">Dein digitales Fahrtenbuch</text>
  <!-- Feature pills -->
  <rect x="362" y="295" width="230" height="52" rx="26" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="477" y="328" font-family="Arial,sans-serif" font-size="25" fill="${LIGHT_PRIMARY}" text-anchor="middle">🚗  Auto GPS-Tracking</text>
  <rect x="612" y="295" width="210" height="52" rx="26" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="717" y="328" font-family="Arial,sans-serif" font-size="25" fill="${LIGHT_PRIMARY}" text-anchor="middle">📄  PDF &amp; CSV Export</text>
  <rect x="842" y="295" width="170" height="52" rx="26" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1.5"/>
  <text x="927" y="328" font-family="Arial,sans-serif" font-size="25" fill="${LIGHT_PRIMARY}" text-anchor="middle">🔒  DSGVO</text>
  <!-- Subtitle -->
  <text x="362" y="415" font-family="Arial,sans-serif" font-size="28" fill="${MUTED}">Fahrten automatisch aufzeichnen &amp; Kilometernachweis exportieren</text>
</svg>`;

// ─── Screenshot 1 – Home Screen ───────────────────────────────────────────────
const homeScreenSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <!-- Header -->
  <rect width="1080" height="140" fill="${BG}"/>
  <text x="60" y="150" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="${TEXT}">FahrtDoc</text>
  <circle cx="1000" cy="120" r="50" fill="${CARD2}"/>
  <text x="1000" y="132" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle">MM</text>

  <!-- Aktiv pill -->
  <rect x="60" y="175" width="200" height="50" rx="25" fill="${SUCCESS_BG}"/>
  <circle cx="90" cy="200" r="10" fill="${SUCCESS}"/>
  <text x="115" y="208" font-family="Arial,sans-serif" font-size="26" fill="${SUCCESS}" font-weight="700">Aktiv</text>

  <!-- Quick Start card -->
  <rect x="40" y="248" width="1000" height="240" rx="24" fill="${CARD}"/>
  <rect x="40" y="248" width="1000" height="4" rx="2" fill="${PRIMARY}"/>
  <text x="80" y="316" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="${TEXT}">Fahrt starten</text>
  <text x="80" y="362" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}">GPS-Tracking wird automatisch aktiviert</text>
  <rect x="80" y="390" width="400" height="76" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="437" font-family="Arial,sans-serif" font-size="32" fill="white" text-anchor="middle" font-weight="700">▶  Fahrt beginnen</text>
  <rect x="510" y="390" width="400" height="76" rx="20" fill="${CARD2}"/>
  <text x="710" y="437" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle" font-weight="600">Manuelle Fahrt</text>

  <!-- Stats row -->
  <rect x="40" y="520" width="310" height="180" rx="20" fill="${CARD}"/>
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

  <!-- Recent trips label -->
  <text x="60" y="760" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Letzte Fahrten</text>
  <text x="1000" y="760" font-family="Arial,sans-serif" font-size="28" fill="${LIGHT_PRIMARY}" text-anchor="end">Alle anzeigen</text>

  ${tripCard(40, 780, 1000, "Büro München", "Kunde Frankfurt", "Heute, 09:15", "347", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 990, 1000, "Zuhause", "Supermarkt", "Gestern, 17:42", "8.3", "Privat", ORANGE)}
  ${tripCard(40, 1200, 1000, "Hotel Berlin", "Messe Berlin", "12. Jun, 08:30", "12.7", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 1410, 1000, "Büro München", "Kunde Stuttgart", "11. Jun, 13:05", "225", "Geschäftlich", LIGHT_PRIMARY)}

  ${navBar("home")}
</svg>`;

// ─── Screenshot 2 – Active Trip ───────────────────────────────────────────────
const activeTripSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <!-- Header -->
  <text x="540" y="155" font-family="Arial,sans-serif" font-size="44" font-weight="700" fill="${TEXT}" text-anchor="middle">Fahrt läuft…</text>

  <!-- Pulsing active indicator -->
  <circle cx="540" cy="350" r="140" fill="${SUCCESS_BG}" opacity="0.6"/>
  <circle cx="540" cy="350" r="110" fill="${SUCCESS_BG}" opacity="0.8"/>
  <circle cx="540" cy="350" r="80" fill="${SUCCESS}" opacity="0.15"/>
  <circle cx="540" cy="350" r="60" fill="${SUCCESS}"/>
  <!-- Car icon centered -->
  <g transform="translate(504, 314) scale(1.8)">
    <path d="M5,18 L10,7 L30,7 L35,18 Z" fill="white" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="2" y="18" width="35" height="13" rx="4" fill="white"/>
    <circle cx="9" cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
    <circle cx="30" cy="32" r="4.5" fill="${SUCCESS}" stroke="white" stroke-width="2"/>
  </g>

  <!-- Timer -->
  <text x="540" y="540" font-family="Arial,sans-serif" font-size="100" font-weight="800" fill="${TEXT}" text-anchor="middle" letter-spacing="4">00:23:47</text>
  <text x="540" y="600" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">Fahrzeit</text>

  <!-- Start address card -->
  <rect x="40" y="640" width="1000" height="140" rx="20" fill="${CARD}"/>
  <circle cx="90" cy="710" r="22" fill="#0D2340" stroke="${LIGHT_PRIMARY}" stroke-width="2"/>
  <circle cx="90" cy="710" r="10" fill="${LIGHT_PRIMARY}"/>
  <text x="130" y="695" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">Startpunkt</text>
  <text x="130" y="735" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" font-weight="600">Maximilianstraße 22, München</text>

  <!-- Dashed route line -->
  <line x1="90" y1="780" x2="90" y2="840" stroke="${LIGHT_PRIMARY}" stroke-width="3" stroke-dasharray="8,8" opacity="0.6"/>
  <line x1="90" y1="840" x2="90" y2="900" stroke="${LIGHT_PRIMARY}" stroke-width="3" stroke-dasharray="8,8" opacity="0.4"/>

  <!-- Current location card -->
  <rect x="40" y="920" width="1000" height="140" rx="20" fill="${CARD}"/>
  <circle cx="90" cy="990" r="22" fill="${SUCCESS_BG}" stroke="${SUCCESS}" stroke-width="2"/>
  <circle cx="90" cy="990" r="10" fill="${SUCCESS}"/>
  <text x="130" y="975" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">Aktueller Standort</text>
  <text x="130" y="1015" font-family="Arial,sans-serif" font-size="34" fill="${TEXT}" font-weight="600">A9 Richtung Nürnberg, 147 km/h</text>

  <!-- Stats row -->
  <rect x="40" y="1090" width="300" height="160" rx="20" fill="${CARD}"/>
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

  <!-- Trip purpose selector -->
  <text x="60" y="1310" font-family="Arial,sans-serif" font-size="32" font-weight="600" fill="${TEXT}">Fahrtzweck</text>
  <rect x="40" y="1330" width="480" height="72" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="1375" font-family="Arial,sans-serif" font-size="30" fill="white" text-anchor="middle" font-weight="700">Geschäftlich</text>
  <rect x="540" y="1330" width="500" height="72" rx="20" fill="${CARD2}"/>
  <text x="790" y="1375" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">Privat</text>

  <!-- Stop button -->
  <rect x="40" y="1440" width="1000" height="100" rx="26" fill="${RED}"/>
  <text x="540" y="1503" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle" font-weight="800">■  Fahrt beenden</text>

  <!-- Map preview -->
  <rect x="40" y="1560" width="1000" height="140" rx="20" fill="${CARD2}"/>
  <text x="540" y="1640" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" text-anchor="middle">🗺  Routenvorschau</text>
  <!-- Simple route line decoration -->
  <path d="M100,1630 Q250,1580 400,1620 Q550,1665 700,1610 Q800,1575 980,1620" stroke="${LIGHT_PRIMARY}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
  <circle cx="100" cy="1630" r="8" fill="${LIGHT_PRIMARY}"/>
  <circle cx="980" cy="1620" r="8" fill="${SUCCESS}"/>

  ${navBar("home")}
</svg>`;

// ─── Screenshot 3 – Trip History ──────────────────────────────────────────────
const historyScreenSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <!-- Header -->
  <text x="60" y="155" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}">Fahrten</text>
  <!-- Filter pill -->
  <rect x="780" y="100" width="260" height="60" rx="30" fill="${CARD}"/>
  <text x="910" y="139" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle">🔽  Alle Fahrten</text>

  <!-- Month summary banner -->
  <rect x="40" y="180" width="1000" height="120" rx="20" fill="#0D2340" stroke="${PRIMARY}" stroke-width="1"/>
  <text x="80" y="230" font-family="Arial,sans-serif" font-size="28" fill="${LIGHT_PRIMARY}" font-weight="600">Juni 2026</text>
  <text x="80" y="270" font-family="Arial,sans-serif" font-size="26" fill="${MUTED}">23 Fahrten · 1.847 km · 1.530 km geschäftlich</text>
  <rect x="780" y="210" width="220" height="60" rx="14" fill="${PRIMARY}"/>
  <text x="890" y="248" font-family="Arial,sans-serif" font-size="26" fill="white" text-anchor="middle" font-weight="700">Exportieren</text>

  <!-- Date header -->
  <text x="60" y="360" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">HEUTE, 2. JUNI</text>

  ${tripCard(40, 380, 1000, "Büro München", "Kunde Frankfurt", "09:15 – 14:32", "347", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 580, 1000, "Essen Innenstadt", "Hotel Kempinski", "18:05 – 18:22", "5.2", "Privat", ORANGE)}

  <!-- Date header -->
  <text x="60" y="810" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">GESTERN, 1. JUNI</text>

  ${tripCard(40, 830, 1000, "Hotel Kempinski", "Flughafen FRA", "07:10 – 08:45", "42.1", "Geschäftlich", LIGHT_PRIMARY)}
  ${tripCard(40, 1030, 1000, "Flughafen FRA", "Büro München", "17:20 – 19:05", "345", "Geschäftlich", LIGHT_PRIMARY)}

  <!-- Date header -->
  <text x="60" y="1270" font-family="Arial,sans-serif" font-size="30" fill="${MUTED}" font-weight="600">31. MAI</text>

  ${tripCard(40, 1290, 1000, "Zuhause", "Supermarkt Edeka", "17:42 – 17:58", "8.3", "Privat", ORANGE)}
  ${tripCard(40, 1490, 1000, "Büro München", "Kunde Ingolstadt", "08:30 – 09:45", "84.7", "Geschäftlich", LIGHT_PRIMARY)}

  ${navBar("trips")}
</svg>`;

// ─── Screenshot 4 – PDF Export ────────────────────────────────────────────────
const exportScreenSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <rect width="1080" height="1920" fill="${BG}"/>
  ${statusBar()}

  <!-- Header -->
  <text x="60" y="155" font-family="Arial,sans-serif" font-size="54" font-weight="800" fill="${TEXT}">Export</text>

  <!-- PDF preview card -->
  <rect x="40" y="185" width="1000" height="700" rx="24" fill="${CARD}"/>
  <!-- PDF document mockup -->
  <rect x="110" y="230" width="580" height="620" rx="10" fill="white"/>
  <!-- PDF header bar -->
  <rect x="110" y="230" width="580" height="70" rx="10" fill="${PRIMARY}"/>
  <text x="140" y="273" font-family="Arial,sans-serif" font-size="24" fill="white" font-weight="700">FahrtDoc – Fahrtenbuch</text>
  <text x="650" y="265" font-family="Arial,sans-serif" font-size="20" fill="white" text-anchor="end">Juni 2026</text>
  <!-- PDF rows -->
  ${[0,1,2,3,4,5,6,7].map(i => `
  <rect x="110" y="${310 + i*68}" width="580" height="68" fill="${i%2===0 ? '#F7F9FC' : 'white'}"/>
  <text x="130" y="${348 + i*68}" font-family="Arial,sans-serif" font-size="18" fill="#0F172A">${['02.06.', '02.06.', '01.06.', '01.06.', '31.05.', '31.05.', '30.05.', '30.05.'][i]}</text>
  <text x="200" y="${348 + i*68}" font-family="Arial,sans-serif" font-size="16" fill="#64748B" font-weight="400">${['Büro → Frankfurt', 'Essen → Hotel', 'Hotel → FRA', 'FRA → Büro', 'Zuhause → Edeka', 'Büro → Ingolstadt', 'Zuhause → Büro', 'Büro → Kunde'][i]}</text>
  <text x="660" y="${348 + i*68}" font-family="Arial,sans-serif" font-size="18" fill="#0F172A" text-anchor="end" font-weight="600">${['347', '5.2', '42.1', '345', '8.3', '84.7', '33.4', '216'][i]} km</text>
  `).join("")}
  <!-- PDF footer -->
  <rect x="110" y="822" width="580" height="2" fill="#E2E8F0"/>
  <text x="130" y="845" font-family="Arial,sans-serif" font-size="18" fill="#64748B">Gesamt: 1.847 km | Geschäftlich: 1.530 km | Privat: 317 km</text>

  <!-- QR / badge decoration right -->
  <rect x="730" y="250" width="270" height="200" rx="14" fill="${CARD2}"/>
  <text x="865" y="310" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Zeitraum</text>
  <text x="865" y="355" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle" font-weight="700">01.06.–30.06.</text>
  <text x="865" y="390" font-family="Arial,sans-serif" font-size="22" fill="${MUTED}" text-anchor="middle">2026</text>

  <rect x="730" y="470" width="270" height="200" rx="14" fill="${CARD2}"/>
  <text x="865" y="530" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Fahrten</text>
  <text x="865" y="590" font-family="Arial,sans-serif" font-size="56" fill="${TEXT}" text-anchor="middle" font-weight="800">23</text>
  <text x="865" y="640" font-family="Arial,sans-serif" font-size="22" fill="${SUCCESS}" text-anchor="middle">✓ vollständig</text>

  <!-- Export options -->
  <text x="60" y="950" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Exportformat</text>

  <rect x="40" y="970" width="480" height="140" rx="20" fill="${PRIMARY}"/>
  <text x="280" y="1025" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle">📄</text>
  <text x="280" y="1070" font-family="Arial,sans-serif" font-size="32" fill="white" text-anchor="middle" font-weight="700">PDF exportieren</text>
  <text x="280" y="1098" font-family="Arial,sans-serif" font-size="24" fill="#93C5FD" text-anchor="middle">Steuerl. anerkannt</text>

  <rect x="560" y="970" width="480" height="140" rx="20" fill="${CARD}"/>
  <text x="800" y="1025" font-family="Arial,sans-serif" font-size="38" fill="${TEXT}" text-anchor="middle">📊</text>
  <text x="800" y="1070" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="middle" font-weight="700">CSV exportieren</text>
  <text x="800" y="1098" font-family="Arial,sans-serif" font-size="24" fill="${MUTED}" text-anchor="middle">Für Excel / Numbers</text>

  <!-- Date range selector -->
  <text x="60" y="1180" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Zeitraum</text>
  <rect x="40" y="1200" width="1000" height="90" rx="20" fill="${CARD}"/>
  <text x="80" y="1254" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}">01.06.2026</text>
  <text x="540" y="1254" font-family="Arial,sans-serif" font-size="32" fill="${MUTED}" text-anchor="middle">–</text>
  <text x="1000" y="1254" font-family="Arial,sans-serif" font-size="32" fill="${TEXT}" text-anchor="end">30.06.2026</text>

  <!-- Filter pills -->
  <text x="60" y="1355" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${TEXT}">Fahrten filtern</text>
  <rect x="40" y="1375" width="220" height="60" rx="30" fill="${PRIMARY}"/>
  <text x="150" y="1414" font-family="Arial,sans-serif" font-size="26" fill="white" text-anchor="middle" font-weight="700">Alle</text>
  <rect x="280" y="1375" width="280" height="60" rx="30" fill="${CARD2}"/>
  <text x="420" y="1414" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle">Geschäftlich</text>
  <rect x="580" y="1375" width="200" height="60" rx="30" fill="${CARD2}"/>
  <text x="680" y="1414" font-family="Arial,sans-serif" font-size="26" fill="${TEXT}" text-anchor="middle">Privat</text>

  <!-- Include header toggle -->
  <rect x="40" y="1465" width="1000" height="90" rx="20" fill="${CARD}"/>
  <text x="80" y="1520" font-family="Arial,sans-serif" font-size="30" fill="${TEXT}">Kopfzeile mit Fahrzeug-Info</text>
  <rect x="890" y="1485" width="110" height="50" rx="25" fill="${PRIMARY}"/>
  <circle cx="975" cy="1510" r="22" fill="white"/>

  <!-- Share / save button -->
  <rect x="40" y="1585" width="1000" height="100" rx="26" fill="${PRIMARY}"/>
  <text x="540" y="1648" font-family="Arial,sans-serif" font-size="38" fill="white" text-anchor="middle" font-weight="800">Teilen &amp; Speichern</text>

  ${navBar("export")}
</svg>`;

// ─── Write feature graphic only ───────────────────────────────────────────────
// Screenshots are captured from the live Expo app (see README.md).
write("feature-graphic", featureGraphicSVG);

console.log("\n✅ Feature graphic generated in:", OUT);
console.log("   For screenshots, see README.md → 'Capture workflow'");
