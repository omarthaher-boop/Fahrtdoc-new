import { Platform, Alert, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { Trip, UserProfile } from "@/context/AppContext";
import type { Language } from "@/context/LanguageContext";

// ─── Export error messages ────────────────────────────────────────────────────

const exportErrors: Record<Language, Record<string, string>> = {
  de: {
    title: "Exportfehler",
    storage: "Nicht genug Speicherplatz. Bitte gib Speicher frei und versuche es erneut.",
    permission: "Kein Zugriff auf den Speicher. Bitte prüfe die App-Berechtigungen.",
    unknown: "Export fehlgeschlagen. Bitte versuche es erneut.",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Export Error",
    storage: "Not enough storage space. Please free up some space and try again.",
    permission: "Storage access denied. Please check app permissions.",
    unknown: "Export failed. Please try again.",
    retry: "Try Again",
  },
};

function getExportErrorMessage(err: unknown, lang: Language): string {
  const msgs = exportErrors[lang];
  const raw = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (raw.includes("no space") || raw.includes("enospc") || raw.includes("not enough space") || raw.includes("quota")) {
    return msgs.storage;
  }
  if (raw.includes("permission") || raw.includes("eperm") || raw.includes("eacces") || raw.includes("not permitted")) {
    return msgs.permission;
  }
  return msgs.unknown;
}

function showExportError(err: unknown, lang: Language, retry: () => void): void {
  const msgs = exportErrors[lang];
  const message = getExportErrorMessage(err, lang);
  console.error("[exportPDF] Export failed:", err instanceof Error ? err.message : String(err));
  Alert.alert(msgs.title, message, [
    { text: "OK", style: "cancel" },
    { text: msgs.retry, onPress: retry },
  ]);
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  let s = String(value);
  // Neutralize spreadsheet formula injection: prefix metacharacter-led values
  // with a single quote so spreadsheet apps treat the cell as plain text.
  if (s.length > 0 && (s[0] === "=" || s[0] === "+" || s[0] === "-" || s[0] === "@")) {
    s = "'" + s;
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSV(trips: Trip[], user?: UserProfile | null, dateFrom?: string, dateTo?: string): string {
  const exportedAt = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateRange = dateFrom || dateTo
    ? [dateFrom, dateTo].filter(Boolean).join(" - ")
    : trips.length > 0
      ? (() => {
          const ts = trips.map((t) => new Date(t.date).getTime());
          const min = new Date(Math.min(...ts)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
          const max = new Date(Math.max(...ts)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
          return `${min} - ${max}`;
        })()
      : "";

  const totalKm = trips.reduce((a, t) => a + t.km, 0);

  const header: string[] = [
    "FahrtDoc - Fahrtenbuch",
    user?.name ? `Fahrer: ${user.name}` : "",
    user?.plate ? `Kennzeichen: ${user.plate}` : "",
    dateRange ? `Zeitraum: ${dateRange}` : "",
    `Fahrten gesamt: ${trips.length}  |  Strecke gesamt: ${totalKm.toFixed(1)} km`,
    `Exportiert am: ${exportedAt}`,
    "",
  ].filter((line, i) => i === 0 || line !== "");

  const dataHeaders = ["Datum", "Typ", "Startadresse", "Zieladresse", "Kilometer", "Dauer", "Notiz"];
  const rows: string[] = [...header.map((h) => csvCell(h)), dataHeaders.join(",")];

  for (const t of trips) {
    const date = new Date(t.date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const type = t.type === "business" ? "Geschäftlich" : "Privat";
    rows.push(
      [date, type, t.startAddr, t.endAddr, t.km.toFixed(1), fmtDur(t.dur), ""]
        .map(csvCell)
        .join(",")
    );

    (t.waypoints ?? []).forEach((wp, i) => {
      rows.push(
        ["", `Zwischenstopp ${i + 1}`, wp.addr, "", "", "", wp.note ?? ""]
          .map(csvCell)
          .join(",")
      );
    });
  }

  return rows.join("\r\n");
}

async function exportCSVWeb(trips: Trip[], user?: UserProfile | null, dateFrom?: string, dateTo?: string, filename = "Fahrtenbuch.csv"): Promise<void> {
  const csv = buildCSV(trips, user, dateFrom, dateTo);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCSVNative(trips: Trip[], user?: UserProfile | null, dateFrom?: string, dateTo?: string, filename = "Fahrtenbuch.csv"): Promise<void> {
  const csv = buildCSV(trips, user, dateFrom, dateTo);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error("cacheDirectory unavailable");
  const fileUri = cacheDir + filename;
  await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    await Share.share({ url: fileUri, title: "CSV exportieren" });
  } catch {
    // Share dismissed or unavailable — not an error worth surfacing
  }
}

export async function exportCSV(trips: Trip[], user?: UserProfile | null, dateFrom?: string, dateTo?: string, lang: Language = "de"): Promise<void> {
  if (trips.length === 0) {
    Alert.alert("Keine Fahrten", "Es gibt keine Fahrten für den gewählten Zeitraum.");
    return;
  }
  if (Platform.OS === "web") {
    await exportCSVWeb(trips, user, dateFrom, dateTo);
  } else {
    try {
      await exportCSVNative(trips, user, dateFrom, dateTo);
    } catch (err) {
      showExportError(err, lang, () => exportCSV(trips, user, dateFrom, dateTo, lang));
    }
  }
}

const fmtDur = (s: number): string => {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtType = (type: "business" | "private"): string =>
  type === "business" ? "Geschäftl." : "Privat";

const escHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function getDateRange(trips: Trip[], dateFrom: string, dateTo: string): string {
  if (trips.length === 0) return "–";
  if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
  if (dateFrom) return `ab ${dateFrom}`;
  if (dateTo) return `bis ${dateTo}`;
  const timestamps = trips.map((t) => new Date(t.date).getTime());
  const min = new Date(Math.min(...timestamps));
  const max = new Date(Math.max(...timestamps));
  return `${fmtDate(min.toISOString())} – ${fmtDate(max.toISOString())}`;
}

async function getAppLogoBase64(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const logoSrc = require("../assets/images/logo.png") as string;
      const resp = await fetch(logoSrc);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      // Bundled assets cannot be reliably read via FileSystem in Hermes
      // production builds (TestFlight/Release). Skip the app logo on native.
      return null;
    }
  } catch {
    return null;
  }
}

function buildHTML(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string,
  typeLabel?: string,
  appLogoBase64?: string | null
): string {
  const totalKm = trips.reduce((a, t) => a + t.km, 0);
  const totalDur = trips.reduce((a, t) => a + t.dur, 0);
  const dateRange = getDateRange(trips, dateFrom, dateTo);

  const bizTrips = trips.filter((t) => t.type === "business");
  const prvTrips = trips.filter((t) => t.type === "private");
  const bizKm = bizTrips.reduce((a, t) => a + t.km, 0);
  const prvKm = prvTrips.reduce((a, t) => a + t.km, 0);
  const bizKmPct = totalKm > 0 ? Math.round((bizKm / totalKm) * 100) : 0;
  const prvKmPct = totalKm > 0 ? 100 - bizKmPct : 0;

  const totalKmRoute = trips.some((t) => t.kmRoute !== undefined)
    ? trips.reduce((a, t) => a + (t.kmRoute ?? 0), 0)
    : null;

  const rows = trips
    .map((t) => {
      const waypointRows = (t.waypoints ?? [])
        .map(
          (wp, i) => {
            const noteHtml = wp.note
              ? `<br><span style="font-style:italic;color:#888;font-size:8.5pt;">${escHtml(wp.note)}</span>`
              : "";
            return `<tr class="waypoint-row"><td></td><td></td><td colspan="2" style="padding-left:22px;color:#5a6a9a;font-size:9pt;">&#8627; Zwischenstopp ${i + 1}: ${wp.addr}${noteHtml}</td><td></td><td></td><td></td></tr>`;
          }
        )
        .join("");
      return `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td class="${t.type === "business" ? "badge-business" : "badge-private"}">${fmtType(t.type)}</td>
        <td>${t.startAddr}</td>
        <td>${t.endAddr}</td>
        <td class="num">${t.km.toFixed(1)}</td>
        <td class="num">${t.kmRoute !== undefined ? t.kmRoute.toFixed(1) : "–"}</td>
        <td class="num">${fmtDur(t.dur)}</td>
      </tr>${waypointRows}`;
    })
    .join("");

  const exportedAt = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const logoHtml = user?.logoUri
    ? `<img src="${user.logoUri}" style="max-height:48px; max-width:160px; object-fit:contain; display:block; margin-bottom:6px;" alt="Logo" />`
    : "";
  const headerLabel = user?.companyName ? user.companyName : "FahrtDoc";
  const subLabel = typeLabel ? typeLabel : "Fahrtenbuch";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Fahrtenbuch</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      color: #111;
      background: #fff;
      padding: 28px 32px;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #1A2B6B;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-name { font-size: 22pt; font-weight: 800; color: #1A2B6B; letter-spacing: -0.5px; }
    .brand-sub { font-size: 10pt; color: #5a6a9a; font-weight: 500; margin-top: 2px; }
    .meta { text-align: right; font-size: 10pt; color: #444; line-height: 1.6; }
    .meta strong { color: #111; font-weight: 700; }
    .summary {
      display: flex;
      gap: 24px;
      margin-bottom: 18px;
      background: #f0f3fa;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .summary-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; }
    .summary-value { font-size: 14pt; font-weight: 800; color: #1A2B6B; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    thead tr { background: #1A2B6B; color: #fff; }
    thead th { padding: 8px 10px; text-align: left; font-weight: 700; font-size: 9.5pt; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #e8eaf0; }
    tbody tr:nth-child(even) { background: #f8f9fc; }
    tbody td { padding: 7px 10px; vertical-align: top; line-height: 1.4; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .badge-business {
      display: inline-block; background: #e8edf9; color: #1A2B6B;
      border-radius: 4px; padding: 1px 6px; font-weight: 700; font-size: 9pt;
    }
    .badge-private {
      display: inline-block; background: #f0f0f0; color: #555;
      border-radius: 4px; padding: 1px 6px; font-weight: 600; font-size: 9pt;
    }
    tfoot tr { background: #1A2B6B; color: #fff; }
    tfoot td { padding: 9px 10px; font-weight: 800; font-size: 10.5pt; }
    tfoot td.num { text-align: right; }
    .footer {
      margin-top: 24px; font-size: 9pt; color: #888;
      display: flex; justify-content: space-between;
      border-top: 1px solid #e0e4f0; padding-top: 12px;
    }
    .stats-section {
      display: flex; gap: 0; margin-bottom: 16px;
      border: 1px solid #e0e4f0; border-radius: 8px; overflow: hidden;
    }
    .stats-col { flex: 1; padding: 12px 16px; }
    .stats-col + .stats-col { border-left: 1px solid #e0e4f0; background: #fafbfd; }
    .stats-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 700; margin-bottom: 4px; }
    .stats-km { font-size: 15pt; font-weight: 800; color: #1A2B6B; }
    .stats-sub { font-size: 8.5pt; color: #888; margin-top: 2px; margin-bottom: 7px; }
    .stats-bar-wrap { height: 5px; background: #e8eaf0; border-radius: 3px; overflow: hidden; }
    .stats-bar-biz { height: 100%; background: #1A2B6B; border-radius: 3px; }
    .stats-bar-prv { height: 100%; background: #aab6d8; border-radius: 3px; }
    @media print { body { padding: 0; } @page { size: A4 landscape; margin: 1.2cm 1.5cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="brand-name">${headerLabel}</div>
      <div class="brand-sub">${subLabel}</div>
    </div>
    <div class="meta">
      ${appLogoBase64 ? `<img src="${appLogoBase64}" style="max-height:44px; max-width:100px; object-fit:contain; display:block; margin-left:auto; margin-bottom:6px;" alt="FahrtDoc" />` : ""}
      ${user ? `<strong>${user.name}</strong><br>` : ""}
      ${user?.plate ? `Kennzeichen: <strong>${user.plate}</strong><br>` : ""}
      Zeitraum: <strong>${dateRange}</strong>
    </div>
  </div>
  <div class="summary">
    <div>
      <div class="summary-label">Fahrten</div>
      <div class="summary-value">${trips.length}</div>
    </div>
    <div>
      <div class="summary-label">Gesamtstrecke</div>
      <div class="summary-value">${totalKm.toFixed(1)} km</div>
    </div>
    <div>
      <div class="summary-label">Fahrzeit gesamt</div>
      <div class="summary-value">${fmtDur(totalDur)}</div>
    </div>
  </div>
  <div class="stats-section">
    <div class="stats-col">
      <div class="stats-label">Geschäftlich</div>
      <div class="stats-km">${bizKm.toFixed(1)} km</div>
      <div class="stats-sub">${bizTrips.length} Fahrten &middot; ${bizKmPct}% der Strecke</div>
      <div class="stats-bar-wrap"><div class="stats-bar-biz" style="width:${bizKmPct}%"></div></div>
    </div>
    <div class="stats-col">
      <div class="stats-label">Privat</div>
      <div class="stats-km">${prvKm.toFixed(1)} km</div>
      <div class="stats-sub">${prvTrips.length} Fahrten &middot; ${prvKmPct}% der Strecke</div>
      <div class="stats-bar-wrap"><div class="stats-bar-prv" style="width:${prvKmPct}%"></div></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Datum</th><th>Typ</th><th>Startadresse</th><th>Zieladresse</th>
        <th class="num">GPS-Strecke (km)</th><th class="num">Kürzeste Route (km)</th><th class="num">Dauer</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Gesamt</td>
        <td class="num">${totalKm.toFixed(1)}</td>
        <td class="num">${totalKmRoute !== null ? totalKmRoute.toFixed(1) : "–"}</td>
        <td class="num">${fmtDur(totalDur)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">
    <span>${headerLabel} · ${subLabel}-Export</span>
    <span>Erstellt am ${exportedAt}</span>
  </div>
</body>
</html>`;
}

async function exportPDFWeb(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string,
  filename = "Fahrtenbuch.pdf",
  typeLabel?: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const totalKm = trips.reduce((a, t) => a + t.km, 0);
  const totalDur = trips.reduce((a, t) => a + t.dur, 0);
  const dateRange = getDateRange(trips, dateFrom, dateTo);
  const jsBizTrips = trips.filter((t) => t.type === "business");
  const jsPrvTrips = trips.filter((t) => t.type === "private");
  const jsBizKm = jsBizTrips.reduce((a, t) => a + t.km, 0);
  const jsPrvKm = jsPrvTrips.reduce((a, t) => a + t.km, 0);
  const jsBizKmPct = totalKm > 0 ? Math.round((jsBizKm / totalKm) * 100) : 0;
  const jsPrvKmPct = totalKm > 0 ? 100 - jsBizKmPct : 0;
  const exportedAt = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const pageW = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  const navy = [26, 43, 107] as const;
  const white = [255, 255, 255] as const;
  const lightBlue = [240, 243, 250] as const;
  const gray = [136, 136, 136] as const;

  doc.setFillColor(...navy);
  doc.setDrawColor(...navy);

  const brandLabel = user?.companyName || "FahrtDoc";
  const subLabel = typeLabel ?? "Fahrtenbuch";

  const appLogo = await getAppLogoBase64();

  if (user?.logoUri) {
    try {
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new window.Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });
      const img = await loadImg(user.logoUri);
      const ratio = img.naturalWidth / img.naturalHeight;
      const maxW = 40;
      const maxH = 16;
      let w = maxW;
      let h = maxW / ratio;
      if (h > maxH) { h = maxH; w = maxH * ratio; }
      const matchFmt = user.logoUri.match(/^data:image\/(\w+);base64,/);
      const fmt = matchFmt ? matchFmt[1].toUpperCase() : "JPEG";
      doc.addImage(user.logoUri, fmt, margin, y, w, h);
      y += h + 2;
    } catch {
      // skip logo if loading fails
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(brandLabel, margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 106, 154);
  doc.text(subLabel, margin, y + 6);

  // App logo top-right
  if (appLogo) {
    try {
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new window.Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });
      const logoImg = await loadImg(appLogo);
      const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
      const maxH = 14;
      const maxW = 28;
      let lh = maxH;
      let lw = maxH * ratio;
      if (lw > maxW) { lw = maxW; lh = maxW / ratio; }
      const matchFmt = appLogo.match(/^data:image\/(\w+);base64,/);
      const fmt = matchFmt ? matchFmt[1].toUpperCase() : "PNG";
      doc.addImage(appLogo, fmt, pageW - margin - lw, y - 4, lw, lh);
    } catch {
      // skip if loading fails
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(68, 68, 68);
  const metaLines: string[] = [];
  if (user?.name) metaLines.push(user.name);
  if (user?.plate) metaLines.push(`Kennzeichen: ${user.plate}`);
  metaLines.push(`Zeitraum: ${dateRange}`);
  const metaStartY = appLogo ? y + 12 : y;
  metaLines.forEach((line, i) => {
    doc.text(line, pageW - margin, metaStartY + i * 5, { align: "right" });
  });

  y += 14;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFillColor(...lightBlue);
  doc.roundedRect(margin, y, contentW, 16, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  const summaryItems = [
    { label: "FAHRTEN", value: `${trips.length}` },
    { label: "GESAMTSTRECKE", value: `${totalKm.toFixed(1)} km` },
    { label: "FAHRZEIT GESAMT", value: fmtDur(totalDur) },
  ];
  summaryItems.forEach((item, i) => {
    const x = margin + 8 + i * (contentW / 3);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(102, 102, 102);
    doc.text(item.label, x, y + 5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    doc.text(item.value, x, y + 12);
  });
  y += 22;

  // ── Statistics block: Geschäftlich vs. Privat ────────────────────────────
  const statH = 22;
  const halfW = (contentW - 6) / 2;

  // Business box
  doc.setFillColor(240, 243, 250);
  doc.roundedRect(margin, y, halfW, statH, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90, 106, 154);
  doc.text("GESCHÄFTLICH", margin + 4, y + 5);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(`${jsBizKm.toFixed(1)} km`, margin + 4, y + 12);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`${jsBizTrips.length} Fahrten  |  ${jsBizKmPct}% der Strecke`, margin + 4, y + 18);

  // Private box
  const prvX = margin + halfW + 6;
  doc.setFillColor(250, 251, 253);
  doc.roundedRect(prvX, y, halfW, statH, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90, 106, 154);
  doc.text("PRIVAT", prvX + 4, y + 5);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(`${jsPrvKm.toFixed(1)} km`, prvX + 4, y + 12);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`${jsPrvTrips.length} Fahrten  |  ${jsPrvKmPct}% der Strecke`, prvX + 4, y + 18);

  // Ratio bar
  y += statH + 3;
  doc.setFillColor(232, 234, 240);
  doc.roundedRect(margin, y, contentW, 3, 1, 1, "F");
  if (jsBizKmPct > 0) {
    doc.setFillColor(...navy);
    doc.rect(margin, y, (contentW * jsBizKmPct) / 100, 3, "F");
  }
  y += 8;
  // ────────────────────────────────────────────────────────────────────────

  const colWidths = [26, 20, 70, 70, 28, 28, 17];
  const headers = ["Datum", "Typ", "Startadresse", "Zieladresse", "GPS-Strecke", "Kurzeste Route", "Dauer"];
  const rowH = 8;
  const pageH = 210;
  const bottomMargin = 20;

  const drawTableHeader = (atY: number): number => {
    doc.setFillColor(...navy);
    doc.rect(margin, atY, contentW, rowH, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    let cx = margin + 2;
    headers.forEach((h, i) => {
      if (i >= 4) {
        doc.text(h, cx + colWidths[i] - 4, atY + 5.5, { align: "right" });
      } else {
        doc.text(h, cx, atY + 5.5);
      }
      cx += colWidths[i];
    });
    return atY + rowH;
  };

  y = drawTableHeader(y);

  let pageRowIdx = 0;
  doc.setFontSize(8.5);
  trips.forEach((t) => {
    if (y + rowH > pageH - bottomMargin) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(y);
      pageRowIdx = 0;
    }
    const even = pageRowIdx % 2 === 1;
    pageRowIdx++;
    if (even) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setDrawColor(232, 234, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 17, 17);

    const cells = [
      fmtDate(t.date),
      fmtType(t.type),
      t.startAddr,
      t.endAddr,
      t.km.toFixed(1),
      t.kmRoute !== undefined ? t.kmRoute.toFixed(1) : "-",
      fmtDur(t.dur),
    ];
    let cellX = margin + 2;
    cells.forEach((cell, i) => {
      const isNum = i >= 4;
      const maxChars = Math.floor(colWidths[i] * 1.8);
      const truncated = cell.length > maxChars ? cell.slice(0, maxChars - 1) + "…" : cell;
      if (isNum) {
        doc.text(truncated, cellX + colWidths[i] - 4, y + 5.5, { align: "right" });
      } else {
        doc.text(truncated, cellX, y + 5.5);
      }
      cellX += colWidths[i];
    });
    y += rowH;

    // Waypoint sub-rows
    if (t.waypoints && t.waypoints.length > 0) {
      t.waypoints.forEach((wp, wpIdx) => {
        const hasNote = !!wp.note;
        const wpRowH = hasNote ? rowH + 5 : rowH;
        if (y + wpRowH > pageH - bottomMargin) {
          doc.addPage();
          y = 20;
          y = drawTableHeader(y);
        }
        const wpX = margin + 2 + colWidths[0] + colWidths[1];
        const maxChars = Math.floor((colWidths[2] + colWidths[3]) * 1.8);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(90, 106, 154);
        const waypointLabel = `  ↳ Zwischenstopp ${wpIdx + 1}: ${wp.addr}`;
        const truncated = waypointLabel.length > maxChars ? waypointLabel.slice(0, maxChars - 1) + "…" : waypointLabel;
        doc.text(truncated, wpX, y + 5);
        if (hasNote) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(136, 136, 136);
          const noteTruncated = wp.note!.length > maxChars ? wp.note!.slice(0, maxChars - 1) + "…" : wp.note!;
          doc.text(`    ${noteTruncated}`, wpX, y + 10);
        }
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setDrawColor(232, 234, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y + wpRowH, margin + contentW, y + wpRowH);
        y += wpRowH;
      });
    }
  });

  const totalsH = rowH + 1;
  if (y + totalsH + 12 > pageH - bottomMargin) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(...navy);
  doc.rect(margin, y, contentW, totalsH, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.text("Gesamt", margin + 2, y + 6);
  let totX = margin + 2;
  colWidths.slice(0, 4).forEach((w) => { totX += w; });
  doc.text(`${totalKm.toFixed(1)} km`, totX + colWidths[4] - 4, y + 6, { align: "right" });
  totX += colWidths[4];
  const totalKmRouteJsPdf = trips.some((t) => t.kmRoute !== undefined)
    ? trips.reduce((a, t) => a + (t.kmRoute ?? 0), 0)
    : null;
  doc.text(
    totalKmRouteJsPdf !== null ? `${totalKmRouteJsPdf.toFixed(1)} km` : "-",
    totX + colWidths[5] - 4,
    y + 6,
    { align: "right" }
  );
  totX += colWidths[5];
  doc.text(fmtDur(totalDur), totX + colWidths[6] - 4, y + 6, { align: "right" });
  y += totalsH + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`${brandLabel} · ${subLabel}-Export`, margin, y);
  doc.text(`Erstellt am ${exportedAt}`, pageW - margin, y, { align: "right" });

  doc.save(filename);
}

async function exportPDFNative(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string,
  dialogTitle = "Fahrtenbuch exportieren",
  typeLabel?: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const totalKm = trips.reduce((a, t) => a + t.km, 0);
  const totalDur = trips.reduce((a, t) => a + t.dur, 0);
  const dateRange = getDateRange(trips, dateFrom, dateTo);
  const bizTripsN = trips.filter((t) => t.type === "business");
  const prvTripsN = trips.filter((t) => t.type === "private");
  const bizKmN = bizTripsN.reduce((a, t) => a + t.km, 0);
  const prvKmN = prvTripsN.reduce((a, t) => a + t.km, 0);
  const bizKmPctN = totalKm > 0 ? Math.round((bizKmN / totalKm) * 100) : 0;
  const prvKmPctN = totalKm > 0 ? 100 - bizKmPctN : 0;
  const exportedAt = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const pageW = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  const navy = [26, 43, 107] as const;
  const white = [255, 255, 255] as const;
  const lightBlue = [240, 243, 250] as const;
  const gray = [136, 136, 136] as const;

  const brandLabel = user?.companyName || "FahrtDoc";
  const subLabel = typeLabel ?? "Fahrtenbuch";

  const appLogo = await getAppLogoBase64();

  // User company logo (native: fixed dimensions, no DOM needed)
  if (user?.logoUri) {
    try {
      const matchFmt = user.logoUri.match(/^data:image\/(\w+);base64,/);
      const fmt = matchFmt ? matchFmt[1].toUpperCase() : "JPEG";
      doc.addImage(user.logoUri, fmt, margin, y, 36, 14);
      y += 16;
    } catch {
      // skip logo if loading fails
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(brandLabel, margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 106, 154);
  doc.text(subLabel, margin, y + 6);

  // App logo top-right (native: fixed dimensions)
  if (appLogo) {
    try {
      const matchFmt = appLogo.match(/^data:image\/(\w+);base64,/);
      const fmt = matchFmt ? matchFmt[1].toUpperCase() : "PNG";
      doc.addImage(appLogo, fmt, pageW - margin - 20, y - 4, 20, 14);
    } catch {
      // skip if loading fails
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(68, 68, 68);
  const metaLines: string[] = [];
  if (user?.name) metaLines.push(user.name);
  if (user?.plate) metaLines.push(`Kennzeichen: ${user.plate}`);
  metaLines.push(`Zeitraum: ${dateRange}`);
  const metaStartY = appLogo ? y + 12 : y;
  metaLines.forEach((line, i) => {
    doc.text(line, pageW - margin, metaStartY + i * 5, { align: "right" });
  });

  y += 14;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFillColor(...lightBlue);
  doc.roundedRect(margin, y, contentW, 16, 3, 3, "F");
  const summaryItemsN = [
    { label: "FAHRTEN", value: `${trips.length}` },
    { label: "GESAMTSTRECKE", value: `${totalKm.toFixed(1)} km` },
    { label: "FAHRZEIT GESAMT", value: fmtDur(totalDur) },
  ];
  summaryItemsN.forEach((item, i) => {
    const x = margin + 8 + i * (contentW / 3);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(102, 102, 102);
    doc.text(item.label, x, y + 5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    doc.text(item.value, x, y + 12);
  });
  y += 22;

  const statH = 22;
  const halfW = (contentW - 6) / 2;

  doc.setFillColor(240, 243, 250);
  doc.roundedRect(margin, y, halfW, statH, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90, 106, 154);
  doc.text("GESCHÄFTLICH", margin + 4, y + 5);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(`${bizKmN.toFixed(1)} km`, margin + 4, y + 12);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`${bizTripsN.length} Fahrten  |  ${bizKmPctN}% der Strecke`, margin + 4, y + 18);

  const prvX = margin + halfW + 6;
  doc.setFillColor(250, 251, 253);
  doc.roundedRect(prvX, y, halfW, statH, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90, 106, 154);
  doc.text("PRIVAT", prvX + 4, y + 5);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(`${prvKmN.toFixed(1)} km`, prvX + 4, y + 12);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  doc.text(`${prvTripsN.length} Fahrten  |  ${prvKmPctN}% der Strecke`, prvX + 4, y + 18);

  y += statH + 3;
  doc.setFillColor(232, 234, 240);
  doc.roundedRect(margin, y, contentW, 3, 1, 1, "F");
  if (bizKmPctN > 0) {
    doc.setFillColor(...navy);
    doc.rect(margin, y, (contentW * bizKmPctN) / 100, 3, "F");
  }
  y += 8;

  const colWidths = [26, 20, 70, 70, 28, 28, 17];
  const headers = ["Datum", "Typ", "Startadresse", "Zieladresse", "GPS-Strecke", "Kurzeste Route", "Dauer"];
  const rowH = 8;
  const pageH = 210;
  const bottomMargin = 20;

  const drawTableHeader = (atY: number): number => {
    doc.setFillColor(...navy);
    doc.rect(margin, atY, contentW, rowH, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    let cx = margin + 2;
    headers.forEach((h, i) => {
      if (i >= 4) {
        doc.text(h, cx + colWidths[i] - 4, atY + 5.5, { align: "right" });
      } else {
        doc.text(h, cx, atY + 5.5);
      }
      cx += colWidths[i];
    });
    return atY + rowH;
  };

  y = drawTableHeader(y);

  let pageRowIdx = 0;
  doc.setFontSize(8.5);
  trips.forEach((t) => {
    if (y + rowH > pageH - bottomMargin) {
      doc.addPage();
      y = 20;
      y = drawTableHeader(y);
      pageRowIdx = 0;
    }
    const even = pageRowIdx % 2 === 1;
    pageRowIdx++;
    if (even) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setDrawColor(232, 234, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 17, 17);
    const cells = [
      fmtDate(t.date),
      fmtType(t.type),
      t.startAddr,
      t.endAddr,
      t.km.toFixed(1),
      t.kmRoute !== undefined ? t.kmRoute.toFixed(1) : "-",
      fmtDur(t.dur),
    ];
    let cellX = margin + 2;
    cells.forEach((cell, i) => {
      const isNum = i >= 4;
      const maxChars = Math.floor(colWidths[i] * 1.8);
      const truncated = cell.length > maxChars ? cell.slice(0, maxChars - 1) + "…" : cell;
      if (isNum) {
        doc.text(truncated, cellX + colWidths[i] - 4, y + 5.5, { align: "right" });
      } else {
        doc.text(truncated, cellX, y + 5.5);
      }
      cellX += colWidths[i];
    });
    y += rowH;

    if (t.waypoints && t.waypoints.length > 0) {
      t.waypoints.forEach((wp, wpIdx) => {
        const hasNote = !!wp.note;
        const wpRowH = hasNote ? rowH + 5 : rowH;
        if (y + wpRowH > pageH - bottomMargin) {
          doc.addPage();
          y = 20;
          y = drawTableHeader(y);
        }
        const wpX = margin + 2 + colWidths[0] + colWidths[1];
        const maxChars = Math.floor((colWidths[2] + colWidths[3]) * 1.8);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(90, 106, 154);
        const waypointLabel = `  ↳ Zwischenstopp ${wpIdx + 1}: ${wp.addr}`;
        const truncated = waypointLabel.length > maxChars ? waypointLabel.slice(0, maxChars - 1) + "…" : waypointLabel;
        doc.text(truncated, wpX, y + 5);
        if (hasNote) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(136, 136, 136);
          const noteTruncated = wp.note!.length > maxChars ? wp.note!.slice(0, maxChars - 1) + "…" : wp.note!;
          doc.text(`    ${noteTruncated}`, wpX, y + 10);
        }
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setDrawColor(232, 234, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y + wpRowH, margin + contentW, y + wpRowH);
        y += wpRowH;
      });
    }
  });

  const totalsH = rowH + 1;
  if (y + totalsH + 12 > pageH - bottomMargin) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(...navy);
  doc.rect(margin, y, contentW, totalsH, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.text("Gesamt", margin + 2, y + 6);
  let totX = margin + 2;
  colWidths.slice(0, 4).forEach((w) => { totX += w; });
  doc.text(`${totalKm.toFixed(1)} km`, totX + colWidths[4] - 4, y + 6, { align: "right" });
  totX += colWidths[4];
  const totalKmRouteN = trips.some((t) => t.kmRoute !== undefined)
    ? trips.reduce((a, t) => a + (t.kmRoute ?? 0), 0)
    : null;
  doc.text(
    totalKmRouteN !== null ? `${totalKmRouteN.toFixed(1)} km` : "-",
    totX + colWidths[5] - 4,
    y + 6,
    { align: "right" }
  );
  totX += colWidths[5];
  doc.text(fmtDur(totalDur), totX + colWidths[6] - 4, y + 6, { align: "right" });
  y += totalsH + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`${brandLabel} · ${subLabel}-Export`, margin, y);
  doc.text(`Erstellt am ${exportedAt}`, pageW - margin, y, { align: "right" });

  // Save to temp file and share
  const pdfBase64 = doc.output("datauristring").split(",")[1];
  const filename = `Fahrtenbuch_${Date.now()}.pdf`;
  const cacheDir2 = FileSystem.cacheDirectory;
  if (!cacheDir2) throw new Error("cacheDirectory unavailable");
  const fileUri = cacheDir2 + filename;
  await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    await Share.share({ url: fileUri, title: dialogTitle });
  } catch {
    // Share dismissed or unavailable — not an error worth surfacing
  }
}

export async function exportPDF(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom = "",
  dateTo = "",
  lang: Language = "de"
): Promise<void> {
  if (trips.length === 0) {
    Alert.alert("Keine Fahrten", "Es gibt keine Fahrten für den gewählten Zeitraum.");
    return;
  }
  if (Platform.OS === "web") {
    await exportPDFWeb(trips, user, dateFrom, dateTo);
  } else {
    try {
      await exportPDFNative(trips, user, dateFrom, dateTo);
    } catch (err) {
      showExportError(err, lang, () => exportPDF(trips, user, dateFrom, dateTo, lang));
    }
  }
}

export async function exportSplitPDF(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom = "",
  dateTo = "",
  lang: Language = "de"
): Promise<void> {
  if (trips.length === 0) {
    Alert.alert("Keine Fahrten", "Es gibt keine Fahrten für den gewählten Zeitraum.");
    return;
  }

  const businessTrips = trips.filter((t) => t.type === "business");
  const privateTrips = trips.filter((t) => t.type === "private");

  if (businessTrips.length === 0 && privateTrips.length === 0) {
    Alert.alert("Keine Fahrten", "Es gibt keine Fahrten für den gewählten Zeitraum.");
    return;
  }

  if (Platform.OS === "web") {
    if (businessTrips.length > 0) {
      await exportPDFWeb(
        businessTrips,
        user,
        dateFrom,
        dateTo,
        "Fahrtenbuch_Geschaeftlich.pdf",
        "Geschäftliche Fahrten"
      );
    }
    if (privateTrips.length > 0) {
      await exportPDFWeb(
        privateTrips,
        user,
        dateFrom,
        dateTo,
        "Fahrtenbuch_Privat.pdf",
        "Private Fahrten"
      );
    }
  } else {
    try {
      if (businessTrips.length > 0) {
        await exportPDFNative(
          businessTrips,
          user,
          dateFrom,
          dateTo,
          "Geschäftliche Fahrten exportieren",
          "Geschäftliche Fahrten"
        );
      }
      if (privateTrips.length > 0) {
        await exportPDFNative(
          privateTrips,
          user,
          dateFrom,
          dateTo,
          "Private Fahrten exportieren",
          "Private Fahrten"
        );
      }
    } catch (err) {
      showExportError(err, lang, () => exportSplitPDF(trips, user, dateFrom, dateTo, lang));
    }
  }
}
