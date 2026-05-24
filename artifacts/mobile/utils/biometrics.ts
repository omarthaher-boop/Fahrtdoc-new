import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const FACE_ID_PREF_KEY = "pref_face_id_enabled";
export const FACE_ID_ASKED_KEY = "pref_face_id_asked";

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const LA = await import("expo-local-authentication");
    const [hardware, enrolled] = await Promise.all([
      LA.hasHardwareAsync(),
      LA.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const LA = await import("expo-local-authentication");
    const result = await LA.authenticateAsync({
      promptMessage,
      fallbackLabel: "Passwort verwenden",
      cancelLabel: "Abbrechen",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function getFaceIdEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(FACE_ID_PREF_KEY);
  return val === "true";
}

export async function setFaceIdEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(FACE_ID_PREF_KEY, enabled ? "true" : "false");
}

export async function getFaceIdAsked(): Promise<boolean> {
  const val = await AsyncStorage.getItem(FACE_ID_ASKED_KEY);
  return val === "true";
}

export async function setFaceIdAsked(): Promise<void> {
  await AsyncStorage.setItem(FACE_ID_ASKED_KEY, "true");
}
