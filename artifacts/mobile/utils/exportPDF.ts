import { Platform, Alert } from "react-native";
import type { Trip, UserProfile } from "@/context/AppContext";

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

function buildHTML(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string
): string {
  const totalKm = trips.reduce((a, t) => a + t.km, 0);
  const totalDur = trips.reduce((a, t) => a + t.dur, 0);
  const dateRange = getDateRange(trips, dateFrom, dateTo);

  const rows = trips
    .map(
      (t) => `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td class="${t.type === "business" ? "badge-business" : "badge-private"}">${fmtType(t.type)}</td>
        <td>${t.startAddr}</td>
        <td>${t.endAddr}</td>
        <td class="num">${t.km.toFixed(1)}</td>
        <td class="num">${fmtDur(t.dur)}</td>
      </tr>`
    )
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
    @media print { body { padding: 0; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="brand-name">${headerLabel}</div>
      <div class="brand-sub">Fahrtenbuch</div>
    </div>
    <div class="meta">
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
  <table>
    <thead>
      <tr>
        <th>Datum</th><th>Typ</th><th>Start</th><th>Ziel</th>
        <th class="num">km</th><th class="num">Dauer</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Gesamt</td>
        <td class="num">${totalKm.toFixed(1)} km</td>
        <td class="num">${fmtDur(totalDur)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">
    <span>${headerLabel} · Fahrtenbuch-Export</span>
    <span>Erstellt am ${exportedAt}</span>
  </div>
</body>
</html>`;
}

async function exportPDFWeb(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const totalKm = trips.reduce((a, t) => a + t.km, 0);
  const totalDur = trips.reduce((a, t) => a + t.dur, 0);
  const dateRange = getDateRange(trips, dateFrom, dateTo);
  const exportedAt = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const pageW = 210;
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
  doc.text("Fahrtenbuch", margin, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(68, 68, 68);
  const metaLines: string[] = [];
  if (user?.name) metaLines.push(user.name);
  if (user?.plate) metaLines.push(`Kennzeichen: ${user.plate}`);
  metaLines.push(`Zeitraum: ${dateRange}`);
  metaLines.forEach((line, i) => {
    doc.text(line, pageW - margin, y + i * 5, { align: "right" });
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

  const colWidths = [24, 20, 52, 52, 18, 22];
  const headers = ["Datum", "Typ", "Start", "Ziel", "km", "Dauer"];
  const rowH = 8;
  const pageH = 297;
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
  doc.text(fmtDur(totalDur), totX + colWidths[5] - 4, y + 6, { align: "right" });
  y += totalsH + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`${brandLabel} · Fahrtenbuch-Export`, margin, y);
  doc.text(`Erstellt am ${exportedAt}`, pageW - margin, y, { align: "right" });

  doc.save("Fahrtenbuch.pdf");
}

async function exportPDFNative(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const html = buildHTML(trips, user, dateFrom, dateTo);
  const Print = await import("expo-print");
  const Sharing = await import("expo-sharing");

  const { uri } = await Print.printToFileAsync({ html });
  const isAvailable = await Sharing.isAvailableAsync();

  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Fahrtenbuch exportieren",
      UTI: "com.adobe.pdf",
    });
  } else {
    Alert.alert(
      "PDF erstellt",
      "Die Datei wurde gespeichert, aber das Teilen ist auf diesem Gerät nicht verfügbar.",
      [{ text: "OK" }]
    );
  }
}

export async function exportPDF(
  trips: Trip[],
  user: UserProfile | null,
  dateFrom = "",
  dateTo = ""
): Promise<void> {
  if (trips.length === 0) {
    Alert.alert("Keine Fahrten", "Es gibt keine Fahrten für den gewählten Zeitraum.");
    return;
  }
  if (Platform.OS === "web") {
    await exportPDFWeb(trips, user, dateFrom, dateTo);
  } else {
    await exportPDFNative(trips, user, dateFrom, dateTo);
  }
}
