import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { UserProfile, Trip } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";

const NAVY = "#1A2B6B";
const BLUE_GRAY = "#5A6A9A";
const LIGHT_BLUE = "#F0F3FA";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function computeDateRange(trips: Trip[], dateFrom: string, dateTo: string, fromLabel: string, toLabel: string): string {
  if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
  if (dateFrom) return `${fromLabel} ${dateFrom}`;
  if (dateTo) return `${toLabel} ${dateTo}`;
  if (trips.length === 0) return "–";
  const timestamps = trips.map((t) => new Date(t.date).getTime());
  const min = new Date(Math.min(...timestamps));
  const max = new Date(Math.max(...timestamps));
  return `${fmtDate(min.toISOString())} – ${fmtDate(max.toISOString())}`;
}

interface Props {
  user: UserProfile | null;
  trips: Trip[];
  dateFrom: string;
  dateTo: string;
}

export default function PDFHeaderPreview({ user, trips, dateFrom, dateTo }: Props) {
  const { t, language } = useLanguage();

  const brandLabel = user?.companyName || "FahrtDoc";
  const fromLabel = language === "de" ? "ab" : "from";
  const toLabel = language === "de" ? "bis" : "until";
  const dateRange = computeDateRange(trips, dateFrom, dateTo, fromLabel, toLabel);

  const metaLines: { label: string; value: string }[] = [];
  if (user?.name) {
    metaLines.push({ label: t("export.pdfPreview.driver"), value: user.name });
  }
  if (user?.plate) {
    metaLines.push({ label: t("export.pdfPreview.plate"), value: user.plate });
  }
  metaLines.push({ label: t("export.pdfPreview.period"), value: dateRange });

  const totalKm = trips.reduce((a, trip) => a + trip.km, 0);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>{t("export.pdfPreview")}</Text>
      <View style={styles.previewCard}>
        {/* Top accent bar */}
        <View style={styles.topBar} />

        <View style={styles.headerContent}>
          {/* Center column: logo + title */}
          <View style={styles.centerCol}>
            {!!user?.logoUri && (
              <Image
                source={{ uri: user.logoUri }}
                style={styles.companyLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.brandName} numberOfLines={1}>{brandLabel}</Text>
            <Text style={styles.subLabel}>{t("export.pdfPreview.subtitle")}</Text>
          </View>

          {/* Right column: meta lines */}
          <View style={styles.rightCol}>
            {metaLines.map(({ label, value }, i) => (
              <View key={i} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{label}</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>{t("export.pdfPreview.trips").toUpperCase()}</Text>
            <Text style={styles.summaryItemValue}>{trips.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>{t("export.pdfPreview.distance").toUpperCase()}</Text>
            <Text style={styles.summaryItemValue}>{totalKm.toFixed(1)} km</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>{t("export.pdfPreview.period").toUpperCase()}</Text>
            <Text style={styles.summaryItemValue} numberOfLines={1}>{dateRange}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: BLUE_GRAY,
  },
  previewCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8DDF0",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  topBar: {
    height: 4,
    backgroundColor: NAVY,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  centerCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  companyLogo: {
    width: 56,
    height: 22,
    marginBottom: 2,
  },
  brandName: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  subLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: BLUE_GRAY,
    textAlign: "center",
  },
  rightCol: {
    gap: 3,
    minWidth: 110,
    alignItems: "flex-end",
  },
  metaRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 9,
    fontWeight: "700",
    color: "#333",
    maxWidth: 90,
  },
  divider: {
    height: 1,
    backgroundColor: NAVY,
    marginHorizontal: 12,
  },
  summaryBar: {
    flexDirection: "row",
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 4,
  },
  summaryItem: {
    flex: 1,
    gap: 1,
  },
  summaryItemLabel: {
    fontSize: 7,
    fontWeight: "700",
    color: "#666",
    letterSpacing: 0.3,
  },
  summaryItemValue: {
    fontSize: 10,
    fontWeight: "800",
    color: NAVY,
  },
});
