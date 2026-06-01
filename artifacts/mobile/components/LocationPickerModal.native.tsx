import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

interface Coord {
  lat: number;
  lon: number;
}

interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "de", "User-Agent": "DriveLog/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return (data ?? []).map((item) => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: item.display_name,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

interface Props {
  visible: boolean;
  initialAddress?: string;
  initialCoord?: Coord;
  label: string;
  onConfirm: (coord: Coord) => void;
  onClose: () => void;
}

export default function LocationPickerModal({
  visible,
  initialAddress,
  label,
  onConfirm,
  onClose,
}: Props) {
  const colors = useColors();
  const { t } = useLanguage();

  const [searchText, setSearchText] = useState(initialAddress ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSearchText(initialAddress ?? "");
    setResults([]);
    setSearchError(false);
    setSelected(null);
  }, [visible]);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchError(false);
    setResults([]);
    setSelected(null);
    const found = await geocodeSearch(searchText);
    setSearching(false);
    if (!found.length) {
      setSearchError(true);
      return;
    }
    setResults(found);
  };

  const handleSelect = (item: GeocodeResult) => {
    setSelected(item);
  };

  const handleConfirm = () => {
    if (selected) {
      onConfirm({ lat: selected.lat, lon: selected.lon });
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>{label}</Text>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              onPress={onClose}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t("pin.hint.native")}
          </Text>

          <View
            style={[
              styles.searchRow,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchText}
              onChangeText={(v) => {
                setSearchText(v);
                setSearchError(false);
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              placeholder={t("pin.searchPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={handleSearch}>
                <Feather name="arrow-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {searchError && (
            <Text style={[styles.searchError, { color: "#EF4444" }]}>
              {t("pin.searchError")}
            </Text>
          )}

          {results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected === item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.resultItem,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "18"
                          : colors.secondary,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <Feather
                      name="map-pin"
                      size={14}
                      color={isSelected ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.resultText,
                        { color: isSelected ? colors.foreground : colors.mutedForeground },
                      ]}
                      numberOfLines={2}
                    >
                      {item.display_name}
                    </Text>
                    {isSelected && (
                      <Feather name="check-circle" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: selected ? colors.primary : colors.secondary },
              ]}
              onPress={handleConfirm}
              disabled={!selected}
            >
              <Feather
                name="check"
                size={16}
                color={selected ? "#FFF" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.confirmBtnText,
                  { color: selected ? "#FFF" : colors.mutedForeground },
                ]}
              >
                {t("pin.confirm")}
              </Text>
            </TouchableOpacity>
          </View>
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
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "85%",
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
    marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700" },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchError: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
    marginLeft: 4,
  },
  resultsList: {
    marginTop: 10,
    maxHeight: 220,
    marginBottom: 10,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: { fontSize: 15, fontWeight: "700" },
});
