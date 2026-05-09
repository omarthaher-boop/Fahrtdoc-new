import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useApp } from "@/context/AppContext";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode: string }>();
  const { updatePassword } = useApp();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleCodeChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setError("");
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (!digit && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !code[idx] && idx > 0) {
      const next = [...code];
      next[idx - 1] = "";
      setCode(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendCooldown(60);
    setError("");
    try {
      await requestPasswordReset(email);
    } catch {
      setError("Erneutes Senden fehlgeschlagen.");
    }
  };

  const handleSubmit = async () => {
    setError("");
    const enteredCode = code.join("");
    if (enteredCode.length < 6) {
      setError("Bitte alle 6 Stellen des Codes eingeben.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await confirmPasswordReset(email ?? "", enteredCode, newPassword);
      if (!res.success) {
        setError(res.error ?? "Ungültiger Code.");
        setLoading(false);
        return;
      }
      await updatePassword(email ?? "", newPassword);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
      setSuccess(true);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 40;

  if (success) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }]}>
        <View style={[styles.successCircle, { backgroundColor: colors.successLight }]}>
          <Feather name="check-circle" size={48} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          Passwort gesetzt!
        </Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt anmelden.
        </Text>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, width: "100%" }]}
          onPress={() => router.replace("/")}
          testID="go-to-login"
        >
          <Feather name="log-in" size={16} color="#FFFFFF" />
          <Text style={styles.submitText}>Zur Anmeldung</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Back */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.iconSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.successLight }]}>
            <Feather name="shield" size={32} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Neues Passwort</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Code gesendet an{" "}
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{email}</Text>
          </Text>
        </View>

        {/* Dev code hint */}
        {!!devCode && (
          <View style={[styles.devBox, { backgroundColor: colors.warningLight ?? "#FFF8E7", borderColor: colors.warning ?? "#FFB703" }]}>
            <Feather name="terminal" size={14} color={colors.warning ?? "#FFB703"} />
            <Text style={[styles.devText, { color: colors.warning ?? "#FFB703" }]}>
              Entwickler-Modus — Dein Code:{" "}
              <Text style={{ fontWeight: "800", letterSpacing: 2 }}>{devCode}</Text>
            </Text>
          </View>
        )}

        {/* 6-digit code input */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>6-stelliger Code</Text>
          <View style={styles.codeRow}>
            {code.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(r) => { inputRefs.current[idx] = r; }}
                style={[
                  styles.codeBox,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.secondary,
                    borderColor: digit ? colors.primary : colors.border,
                  },
                ]}
                value={digit}
                onChangeText={(v) => handleCodeChange(v, idx)}
                onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, idx)}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
                caretHidden
                testID={`code-input-${idx}`}
              />
            ))}
          </View>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={[styles.resendLabel, { color: colors.mutedForeground }]}>
              Keinen Code erhalten?
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
              <Text style={[
                styles.resendBtn,
                { color: resendCooldown > 0 ? colors.mutedForeground : colors.primary },
              ]}>
                {resendCooldown > 0 ? `Erneut senden (${resendCooldown}s)` : "Erneut senden"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* New password */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Neues Passwort</Text>

          <View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Passwort</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError(""); }}
                placeholder="Mindestens 6 Zeichen"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPw}
                testID="new-password-input"
              />
              <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
                <Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Passwort bestätigen</Text>
            <View style={[
              styles.inputRow,
              {
                backgroundColor: colors.secondary,
                borderColor: confirmPassword && confirmPassword !== newPassword
                  ? colors.destructive
                  : colors.border,
              },
            ]}>
              <Feather name="check-circle" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
                placeholder="Passwort wiederholen"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showConfirm}
                testID="confirm-password-input"
              />
              <TouchableOpacity onPress={() => setShowConfirm((p) => !p)}>
                <Feather name={showConfirm ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: "#FFF0F3", borderColor: colors.destructive }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.success }]}
            onPress={handleSubmit}
            disabled={loading}
            testID="reset-submit"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.submitText}>Passwort zurücksetzen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  },
  devBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  devText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  codeBox: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 50,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: "700",
  },
  resendRow: {
    alignItems: "center",
    gap: 4,
  },
  resendLabel: {
    fontSize: 12,
  },
  resendBtn: {
    fontSize: 13,
    fontWeight: "600",
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
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
});
