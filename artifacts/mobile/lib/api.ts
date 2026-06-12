import { Platform } from "react-native";

function getApiBase(): string {
  // Explicit API URL (baked in at EAS build time via eas.json env)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;
  // Dev: set by the Expo start script in the workflow
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  // Web: use the current origin
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:8080/api";
}

const API_BASE = getApiBase();

interface ForgotPasswordResponse {
  success: boolean;
  code?: string;
  note?: string;
  expiresInMinutes?: number;
  error?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ApiWaypoint {
  addr: string;
  lat: number;
  lon: number;
  timestamp: number;
  note?: string;
}

export interface ApiTrip {
  id: string;
  date: string;
  startAddr: string;
  endAddr: string;
  startLat?: number | null;
  startLon?: number | null;
  endLat?: number | null;
  endLon?: number | null;
  km: number;
  dur: number;
  type: "business" | "private" | "arbeitsweg";
  purpose?: string;
  edited?: boolean | null;
  deleted?: boolean;
  waypoints?: ApiWaypoint[];
}

export interface AuthResult {
  token: string;
  email: string;
  name: string;
  plate: string;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "network_error" };
  }
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "network_error" };
  }
}

export async function serverRegister(
  email: string,
  name: string,
  plate: string,
  password: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, plate, password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function serverLogin(email: string, password: string): Promise<AuthResult | null | "network_error"> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return "network_error";
  }
}

export async function fetchServerTrips(token: string): Promise<ApiTrip[] | null> {
  try {
    const res = await fetch(`${API_BASE}/trips`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function serverCreateTrip(token: string, trip: ApiTrip): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${API_BASE}/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(trip),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
}

export async function serverUpdateTrip(token: string, id: string, changes: Partial<ApiTrip>): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${API_BASE}/trips/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(changes),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
}

export async function serverDeleteTrip(token: string, id: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${API_BASE}/trips/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function serverBatchUpsertTrips(token: string, trips: ApiTrip[]): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${API_BASE}/trips/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trips }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
}

export async function serverRequestChangeCode(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/request-change-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  } catch {
    return { success: false, error: "Netzwerkfehler. Bitte versuche es erneut." };
  }
}

export async function serverDeleteAccount(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function serverConfirmChangePassword(
  token: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/confirm-change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, newPassword }),
    });
    return res.json();
  } catch {
    return { success: false, error: "Netzwerkfehler. Bitte versuche es erneut." };
  }
}

export async function serverRequestEmailChangeCode(
  token: string,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/request-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail }),
    });
    return res.json();
  } catch {
    return { success: false, error: "Netzwerkfehler. Bitte versuche es erneut." };
  }
}

export async function serverConfirmEmailChange(
  token: string,
  code: string,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/confirm-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, newEmail }),
    });
    return res.json();
  } catch {
    return { success: false, error: "Netzwerkfehler. Bitte versuche es erneut." };
  }
}
