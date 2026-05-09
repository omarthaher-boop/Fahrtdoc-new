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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, login } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plate, setPlate] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (mode === "register") {
      if (!name.trim() || !email.trim() || !plate.trim() || !password.trim()) {
        setError("Bitte alle Felder ausfüllen.");
        return;
      }
      if (password.length < 6) {
        setError("Passwort muss mindestens 6 Zeichen lang sein.");
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError("Bitte E-Mail und Passwort eingeben.");
        return;
      }
    }

    setLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 400));

    if (mode === "register") {
      await register(
        { name, email: email.trim(), plate: plate.toUpperCase() },
        password
      );
      setLoading(false);
      router.replace("/(main)/home");
    } else {
      const ok = await login(email.trim(), password);
      setLoading(false);
      if (!ok) {
        setError("Falsches Passwort. Bitte erneut versuchen.");
        return;
      }
      router.replace("/(main)/home");
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
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="navigation" size={32} color="#FFFFFF" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>DriveLog</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Dein digitales Fahrtenbuch
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
                {m === "login" ? "Anmelden" : "Registrieren"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mode === "register" && (
            <InputField
              label="Vollständiger Name"
              value={name}
              onChangeText={setName}
              placeholder="Max Mustermann"
              icon="user"
              colors={colors}
            />
          )}
          <InputField
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            placeholder="email@beispiel.de"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            colors={colors}
          />
          {mode === "register" && (
            <InputField
              label="Kennzeichen"
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
              placeholder="B-DL 1234"
              icon="truck"
              autoCapitalize="characters"
              colors={colors}
            />
          )}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Passwort</Text>
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

          {/* Passwort vergessen – only in login mode */}
          {mode === "login" && (
            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => router.push("/forgot-password")}
              testID="forgot-password-link"
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Passwort vergessen?
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
                {mode === "login" ? "Anmelden" : "Konto erstellen"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {mode === "login"
            ? "Noch kein Konto? Jetzt registrieren."
            : "Alle Daten werden lokal gespeichert."}
        </Text>
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
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
});
