import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  mini?: boolean;
}

export default function StatCard({ label, value, unit, accent, mini }: Props) {
  const colors = useColors();
  const accentColor = accent ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, mini && styles.mini]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color: colors.foreground }, mini && styles.miniValue]}>
          {value}
        </Text>
        {unit && (
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
        )}
      </View>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  mini: {
    padding: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  value: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  miniValue: {
    fontSize: 20,
  },
  unit: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },
  accent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    opacity: 0.6,
  },
});
