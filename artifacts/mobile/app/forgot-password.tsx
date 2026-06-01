import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { requestPasswordReset } from "@/lib/api";

type ErrorKey = "forgot.error.invalidEmail" | "forgot.error.unknown" | "forgot.error.serverError";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorKey(null);
    setServerError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setErrorKey("forgot.error.invalidEmail");
      return;
    }

    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await requestPasswordReset(trimmed);
      if (!res.success) {
        if (res.error) {
          setServerError(res.error);
        } else {
          setErrorKey("forgot.error.unknown");
        }
        setLoading(false);
        return;
      }
      setLoading(false);
      router.push({
        pathname: "/reset-password",
        params: {
          email: trimmed,
          devCode: res.code ?? "",
        },
      });
    } catch {
      setErrorKey("forgot.error.serverError");
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 40;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 20, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("forgot.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t("forgot.subtitle")}
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("forgot.emailLabel")}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: (errorKey || serverError) ? colors.destructive : colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={(text) => { setEmail(text); setErrorKey(null); setServerError(null); }}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                testID="forgot-email-input"
              />
            </View>
          </View>

          {(errorKey || serverError) ? (
            <View style={[styles.errorBanner, { backgroundColor: "#FFF0F3", borderColor: colors.destructive }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {serverError ?? (errorKey ? t(errorKey) : "")}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={loading}
            testID="forgot-submit"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={16} color="#FFFFFF" />
                <Text style={styles.submitText}>{t("forgot.sendCode")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: colors.accent, borderColor: colors.primary + "30" }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            {t("forgot.infoBox")}
          </Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
            {t("forgot.backToLogin")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  iconSection: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  backLink: {
    alignItems: "center",
    padding: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
