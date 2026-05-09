import { Platform } from "react-native";

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    return `https://${domain}/api`;
  }
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

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<ResetPasswordResponse> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  return res.json();
}
