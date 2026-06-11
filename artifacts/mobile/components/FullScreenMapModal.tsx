import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trip } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import TripRouteMap from "@/components/TripRouteMap";

interface Props {
  trip: Trip;
  path?: { lat: number; lon: number }[];
  visible: boolean;
  onClose: () => void;
}

export default function FullScreenMapModal({ trip, path, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerInner}>
            <View style={styles.headerText}>
              <Text
                style={[styles.fromText, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {trip.startAddr || "—"}
              </Text>
              <View style={styles.arrowRow}>
                <Feather name="arrow-right" size={11} color={colors.mutedForeground} />
                <Text
                  style={[styles.toText, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {trip.endAddr || "—"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.mapArea}>
          <TripRouteMap trip={trip} path={path} fullScreen />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  fromText: {
    fontSize: 14,
    fontWeight: "700",
  },
  arrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  toText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mapArea: {
    flex: 1,
  },
});
