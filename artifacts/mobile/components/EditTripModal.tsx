import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trip } from "@/context/AppContext";

interface Props {
  trip: Trip | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, changes: Partial<Trip>) => void;
}

export default function EditTripModal({ trip, visible, onClose, onSave }: Props) {
  const colors = useColors();
  const [type, setType] = useState<"business" | "private">("business");
  const [startAddr, setStartAddr] = useState("");
  const [endAddr, setEndAddr] = useState("");
  const [km, setKm] = useState("");
  const [durMin, setDurMin] = useState("");

  useEffect(() => {
    if (trip) {
      setType(trip.type);
      setStartAddr(trip.startAddr);
      setEndAddr(trip.endAddr);
      setKm(trip.km.toFixed(1));
      setDurMin(String(Math.round(trip.dur / 60)));
    }
  }, [trip]);

  const handleSave = () => {
    if (!trip) return;
    const kmNum = parseFloat(km.replace(",", "."));
    const durNum = parseInt(durMin, 10);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(trip.id, {
      type,
      startAddr: startAddr.trim() || trip.startAddr,
      endAddr: endAddr.trim() || trip.endAddr,
      km: isNaN(kmNum) ? trip.km : kmNum,
      dur: isNaN(durNum) ? trip.dur : durNum * 60,
      edited: true,
    });
    onClose();
  };

  if (!trip) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheet}
      >
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Fahrt bearbeiten</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type toggle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Fahrtzweck</Text>
              <View style={[styles.typeRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.typeBtn, type === "business" && { backgroundColor: colors.primary }]}
                  onPress={() => setType("business")}
                >
                  <Feather name="briefcase" size={14} color={type === "business" ? "#FFF" : colors.mutedForeground} />
                  <Text style={[styles.typeBtnText, { color: type === "business" ? "#FFF" : colors.mutedForeground }]}>
                    Geschäftlich
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, type === "private" && { backgroundColor: colors.success }]}
                  onPress={() => setType("private")}
                >
                  <Feather name="user" size={14} color={type === "private" ? "#FFF" : colors.mutedForeground} />
                  <Text style={[styles.typeBtnText, { color: type === "private" ? "#FFF" : colors.mutedForeground }]}>
                    Privat
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Start address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Startadresse</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={[styles.addrDot, { backgroundColor: colors.primary }]} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={startAddr}
                  onChangeText={setStartAddr}
                  placeholder="Startadresse"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            {/* End address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Zieladresse</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={[styles.addrDotHollow, { borderColor: colors.mutedForeground }]} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={endAddr}
                  onChangeText={setEndAddr}
                  placeholder="Zieladresse"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            {/* km + Duration */}
            <View style={styles.twoColRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Strecke (km)</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name="navigation" size={14} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={km}
                    onChangeText={setKm}
                    placeholder="0.0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Dauer (Min)</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={durMin}
                    onChangeText={setDurMin}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              testID="edit-trip-save"
            >
              <Feather name="check" size={16} color="#FFF" />
              <Text style={styles.saveBtnText}>Änderungen speichern</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14 },
  addrDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  addrDotHollow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    flexShrink: 0,
  },
  twoColRow: { flexDirection: "row", gap: 12 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
