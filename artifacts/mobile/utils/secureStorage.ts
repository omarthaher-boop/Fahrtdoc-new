import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";

// On native (iOS/Android), data is stored directly in SecureStore (backed by iOS Keychain /
// Android Keystore) — no need for AES-GCM on top.
// On web, data is encrypted with AES-GCM in localStorage because there is no SecureStore.

// ---------- native helpers ----------

async function nativeKey(email: string, storageKey: string): Promise<string> {
  const hash = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `${email}_${storageKey}`
  );
  return hash.slice(0, 64);
}

// ---------- web helpers (crypto.subtle is available in browsers) ----------

function webSanitize(email: string): string {
  return `dk_${email.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
}

async function getOrCreateWebKey(email: string): Promise<CryptoKey> {
  const storeKey = webSanitize(email);
  const hexKey = localStorage.getItem(storeKey);
  if (hexKey) {
    const bytes = new Uint8Array(hexKey.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const raw = await crypto.subtle.exportKey("raw", key);
  const hex = Array.from(new Uint8Array(raw))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  localStorage.setItem(storeKey, hex);
  return key;
}

async function webEncrypt(plaintext: string, email: string): Promise<string> {
  const key = await getOrCreateWebKey(email);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ctHex = Array.from(new Uint8Array(ciphertext))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${ivHex}:${ctHex}`;
}

async function webDecrypt(token: string, email: string): Promise<string> {
  const colonIdx = token.indexOf(":");
  const ivHex = token.slice(0, colonIdx);
  const ctHex = token.slice(colonIdx + 1);
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const ct = new Uint8Array(ctHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await getOrCreateWebKey(email);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}

// ---------- public API ----------

export async function secureSetItem(email: string, key: string, value: string): Promise<void> {
  if (Platform.OS !== "web") {
    const storeKey = await nativeKey(email, key);
    await SecureStore.setItemAsync(storeKey, value);
    return;
  }
  const encrypted = await webEncrypt(value, email);
  localStorage.setItem(key, encrypted);
}

const nativeSessionKey = "fahrtdoc_session";

export async function secureSetSession(value: string): Promise<void> {
  if (Platform.OS !== "web") {
    await SecureStore.setItemAsync(nativeSessionKey, value);
    return;
  }
  localStorage.setItem(nativeSessionKey, value);
}

export async function secureGetSession(): Promise<string | null> {
  if (Platform.OS !== "web") {
    const value = await SecureStore.getItemAsync(nativeSessionKey);
    if (value !== null) return value;
    return AsyncStorage.getItem("session");
  }
  return localStorage.getItem(nativeSessionKey) ?? AsyncStorage.getItem("session");
}

export async function secureRemoveSession(): Promise<void> {
  if (Platform.OS !== "web") {
    await Promise.all([
      SecureStore.deleteItemAsync(nativeSessionKey).catch(() => {}),
      AsyncStorage.removeItem("session").catch(() => {}),
    ]);
    return;
  }
  localStorage.removeItem(nativeSessionKey);
  await AsyncStorage.removeItem("session");
}

export async function secureGetItem(email: string, key: string): Promise<string | null> {
  if (Platform.OS !== "web") {
    const storeKey = await nativeKey(email, key);
    const value = await SecureStore.getItemAsync(storeKey);
    if (value !== null) return value;
    // Migration: old builds stored data encrypted in AsyncStorage — those entries are now
    // unreadable without crypto.subtle. Return null so the caller treats the token as missing.
    return null;
  }
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  if (!raw.includes(":")) return raw;
  try {
    return await webDecrypt(raw, email);
  } catch {
    return raw;
  }
}

export async function secureRemoveDataKey(email: string): Promise<void> {
  if (Platform.OS !== "web") {
    // Remove all known SecureStore entries for this account.
    const tripKey = await nativeKey(email, `trips_${email}`);
    const tokenKey = await nativeKey(email, `server_token_${email}`);
    await Promise.all([
      SecureStore.deleteItemAsync(tripKey).catch(() => {}),
      SecureStore.deleteItemAsync(tokenKey).catch(() => {}),
    ]);
    return;
  }
  const storeKey = webSanitize(email);
  localStorage.removeItem(storeKey);
}
