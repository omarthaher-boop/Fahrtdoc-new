import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

function sanitizeKey(email: string): string {
  return `dk_${email.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
}

async function getOrCreateDataKey(email: string): Promise<CryptoKey> {
  const storeKey = sanitizeKey(email);

  let hexKey: string | null = null;
  if (Platform.OS === "web") {
    hexKey = localStorage.getItem(storeKey);
  } else {
    hexKey = await SecureStore.getItemAsync(storeKey);
  }

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

  if (Platform.OS === "web") {
    localStorage.setItem(storeKey, hex);
  } else {
    await SecureStore.setItemAsync(storeKey, hex);
  }

  return key;
}

async function encrypt(plaintext: string, email: string): Promise<string> {
  const key = await getOrCreateDataKey(email);
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

async function decrypt(token: string, email: string): Promise<string> {
  const colonIdx = token.indexOf(":");
  const ivHex = token.slice(0, colonIdx);
  const ctHex = token.slice(colonIdx + 1);
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const ct = new Uint8Array(ctHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await getOrCreateDataKey(email);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}

export async function secureSetItem(email: string, key: string, value: string): Promise<void> {
  const encrypted = await encrypt(value, email);
  await AsyncStorage.setItem(key, encrypted);
}

export async function secureGetItem(email: string, key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  if (!raw.includes(":")) return raw;
  try {
    return await decrypt(raw, email);
  } catch {
    return raw;
  }
}

export async function secureRemoveDataKey(email: string): Promise<void> {
  const storeKey = sanitizeKey(email);
  if (Platform.OS === "web") {
    localStorage.removeItem(storeKey);
  } else {
    await SecureStore.deleteItemAsync(storeKey);
  }
}
