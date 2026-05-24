import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  getFaceIdEnabled,
  setFaceIdEnabled,
  getFaceIdAsked,
  setFaceIdAsked,
} from "@/utils/biometrics";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { login, register, biometricLogin } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plate, setPlate] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [faceIdVisible, setFaceIdVisible] = useState(false);
  const [faceIdLoading, setFaceIdLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const [enabled, available] = await Promise.all([getFaceIdEnabled(), isBiometricAvailable()]);
      if (enabled && available) setFaceIdVisible(true);
    })();
  }, []);

  const handleFaceIdLogin = async () => {
    setFaceIdLoading(true);
    try {
      const success = await authenticateWithBiometrics("Mit Face ID bei FahrtDoc anmelden");
      if (!success) return;
      const result = await biometricLogin();
      if (result === "ok") {
        router.replace("/(main)/home");
      } else {
        setFaceIdVisible(false);
        await setFaceIdEnabled(false);
        setError("Sitzung abgelaufen. Bitte melde dich mit deinem Passwort an.");
      }
    } finally {
      setFaceIdLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (mode === "register") {
      if (!name.trim() || !email.trim() || !plate.trim() || !password.trim()) {
        setError(t("auth.error.allFields"));
        return;
      }
      if (password.length < 6) {
        setError(t("auth.error.shortPassword"));
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError(t("auth.error.emailPassword"));
        return;
      }
    }

    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (mode === "register") {
        const result = await register(name.trim(), email.trim(), plate.trim(), password);
        if (result === "exists") {
          setError(t("auth.error.emailExists"));
          return;
        }
      } else {
        const result = await login(email.trim(), password);
        if (result === "not_found") {
          setError(t("auth.error.notFound"));
          return;
        }
        if (result === "wrong_password") {
          setError(t("auth.error.wrongPassword"));
          return;
        }
        if (result === "server_unavailable") {
          setError(t("auth.error.serverUnavailable"));
          return;
        }
      }
      router.replace("/(main)/home");
      if (mode === "login") {
        const [available, asked] = await Promise.all([isBiometricAvailable(), getFaceIdAsked()]);
        if (available && !asked) {
          await setFaceIdAsked();
          Alert.alert(
            "Face ID aktivieren",
            "Möchtest du dich zukünftig schnell und sicher mit Face ID anmelden?",
            [
              { text: "Nicht jetzt", style: "cancel" },
              {
                text: "Aktivieren",
                onPress: async () => {
                  await setFaceIdEnabled(true);
                },
              },
            ]
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>FahrtDoc</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            {t("auth.tagline")}
          </Text>
        </View>

        {/* Toggle */}
        <View style={[styles.toggleWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {(["login", "register"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && { backgroundColor: colors.card }]}
              onPress={() => { setMode(m); setError(""); }}
            >
              <Text style={[styles.toggleText, { color: mode === m ? colors.foreground : colors.mutedForeground }]}>
                {m === "login" ? t("auth.login") : t("auth.register")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mode === "register" && (
            <InputField
              label={t("auth.fullName")}
              value={name}
              onChangeText={setName}
              placeholder={t("auth.namePlaceholder")}
              icon="user"
              colors={colors}
            />
          )}
          <InputField
            label={t("auth.emailLabel")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            colors={colors}
          />
          {mode === "register" && (
            <InputField
              label={t("vehicle.plate")}
              value={plate}
              onChangeText={(text) => setPlate(text.toUpperCase())}
              placeholder={t("auth.platePlaceholder")}
              icon="truck"
              autoCapitalize="characters"
              colors={colors}
            />
          )}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("auth.password")}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
                <Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === "login" && (
            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => router.push("/forgot-password")}
              testID="forgot-password-link"
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                {t("auth.forgotPassword")}
              </Text>
            </TouchableOpacity>
          )}

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: "#FFF0F3", borderColor: colors.destructive }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={loading}
            testID="auth-submit"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "login" ? t("auth.login") : t("auth.createAccount")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {mode === "login" ? t("auth.hint.login") : t("auth.hint.register")}
        </Text>

        {faceIdVisible && mode === "login" && (
          <TouchableOpacity
            style={[styles.faceIdBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleFaceIdLogin}
            disabled={faceIdLoading}
          >
            {faceIdLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="unlock" size={18} color={colors.primary} />
                <Text style={[styles.faceIdText, { color: colors.primary }]}>
                  Mit Face ID anmelden
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  autoCapitalize,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: string;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "characters" | "sentences";
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name={icon as never} size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  logoSection: {
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
  },
  toggleWrap: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  form: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
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
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
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
    marginTop: 4,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
  },
  faceIdBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    marginTop: 4,
  },
  faceIdText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
