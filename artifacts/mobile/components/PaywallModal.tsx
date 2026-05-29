import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

const FEATURES = [
  "PDF & CSV Export des Fahrtenbuchs",
  "Fahrtenbuch per E-Mail senden",
  "Unbegrenzte Fahrtenhistorie",
  "Prioritäts-Support",
];

export default function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { offerings, purchase, isPurchasing } = useSubscription();
  const [selectedPkg, setSelectedPkg] = useState<"monthly" | "annual">("annual");

  const currentOffering = offerings?.current;
  const monthlyPkg = currentOffering?.monthly;
  const annualPkg = currentOffering?.annual;

  const activePkg = selectedPkg === "monthly" ? monthlyPkg : annualPkg;

  const handlePurchase = async () => {
    if (!activePkg) {
      Alert.alert("Fehler", "Kein Produkt gefunden. Bitte später erneut versuchen.");
      return;
    }
    try {
      await purchase(activePkg);
      onClose();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert("Kauf fehlgeschlagen", e?.message ?? "Unbekannter Fehler");
    }
  };

  const monthlyPrice = monthlyPkg?.product?.priceString ?? "4,99 €/Monat";
  const annualPrice = annualPkg?.product?.priceString ?? "39,99 €/Jahr";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>FahrtDoc Premium</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="star" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              7 Tage kostenlos testen
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
              Danach automatische Verlängerung. Jederzeit kündbar.
            </Text>
          </View>

          <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.checkCircle, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="check" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plansRow}>
            <TouchableOpacity
              style={[
                styles.planCard,
                { borderColor: selectedPkg === "monthly" ? colors.primary : colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => setSelectedPkg("monthly")}
              activeOpacity={0.8}
            >
              <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>Monatlich</Text>
              <Text style={[styles.planPrice, { color: colors.foreground }]}>{monthlyPrice}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planCard,
                styles.planCardBest,
                { borderColor: selectedPkg === "annual" ? colors.primary : colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => setSelectedPkg("annual")}
              activeOpacity={0.8}
            >
              <View style={[styles.bestBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.bestBadgeText}>Beste Wahl</Text>
              </View>
              <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>Jährlich</Text>
              <Text style={[styles.planPrice, { color: colors.foreground }]}>{annualPrice}</Text>
              <Text style={[styles.planSub, { color: colors.primary }]}>~33% günstiger</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.purchaseBtn, { backgroundColor: colors.primary }, isPurchasing && { opacity: 0.6 }]}
            onPress={handlePurchase}
            disabled={isPurchasing}
            activeOpacity={0.85}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseBtnText}>Jetzt kostenlos starten</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.cancelWarning, { color: colors.mutedForeground }]}>
            Wenn Sie Ihr Abo beenden, werden alle Ihre Daten gelöscht und können nicht wiederhergestellt werden.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  body: { padding: 20, gap: 20 },
  heroSection: { alignItems: "center", gap: 12, paddingTop: 12 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  heroSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  featuresCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  plansRow: { flexDirection: "row", gap: 12 },
  planCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    alignItems: "center",
    gap: 4,
    position: "relative",
    paddingTop: 20,
  },
  planCardBest: { paddingTop: 28 },
  bestBadge: {
    position: "absolute",
    top: -1,
    left: 0,
    right: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingVertical: 4,
    alignItems: "center",
  },
  bestBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  planLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  planPrice: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  planSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  footer: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  purchaseBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  purchaseBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  restoreBtn: { alignItems: "center", paddingVertical: 4 },
  restoreText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cancelWarning: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: 8,
  },
});
