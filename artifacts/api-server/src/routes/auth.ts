import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { sendPasswordChangeCode } from "../lib/mailer";

const router: IRouter = Router();

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

const EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

router.post("/auth/request-change-code", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const email = authReq.userEmail;

  cleanExpired();

  const code = generateCode();
  otpStore.set(email, {
    code,
    expiresAt: Date.now() + EXPIRY_MS,
    attempts: 0,
  });

  req.log.info({ email }, "Password change OTP generated");

  try {
    await sendPasswordChangeCode(email, code);
  } catch (err) {
    req.log.error({ err, email }, "Failed to send password change email");
    res.status(500).json({ error: "E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut." });
    return;
  }

  res.json({ success: true, message: "Bestätigungscode wurde an deine E-Mail-Adresse gesendet." });
});

router.post("/auth/confirm-change-password", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const email = authReq.userEmail;
  const { code, newPassword } = req.body as { code?: string; newPassword?: string };

  if (!code || !newPassword) {
    res.status(400).json({ error: "Code und neues Passwort sind erforderlich." });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Das Passwort muss mindestens 6 Zeichen lang sein." });
    return;
  }

  const entry = otpStore.get(email);

  if (!entry) {
    res.status(400).json({ error: "Kein aktiver Code gefunden. Bitte fordere einen neuen an." });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    res.status(400).json({ error: "Der Code ist abgelaufen. Bitte fordere einen neuen an." });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(email);
    res.status(429).json({ error: "Zu viele Versuche. Bitte fordere einen neuen Code an." });
    return;
  }

  if (entry.code !== code.trim()) {
    const remaining = MAX_ATTEMPTS - entry.attempts;
    res.status(400).json({ error: `Ungültiger Code. Noch ${remaining} Versuch${remaining === 1 ? "" : "e"}.` });
    return;
  }

  otpStore.delete(email);

  const passwordHash = await sha256Hex(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.email, email));

  req.log.info({ email }, "Password changed successfully");
  res.json({ success: true, message: "Passwort erfolgreich geändert." });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    return;
  }

  cleanExpired();

  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    res.json({ success: true, message: "Falls ein Konto existiert, wird ein Code gesendet." });
    return;
  }

  const code = generateCode();
  otpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + EXPIRY_MS,
    attempts: 0,
  });

  req.log.info({ email: normalizedEmail }, "Forgot-password OTP generated");

  try {
    await sendPasswordChangeCode(normalizedEmail, code);
  } catch (err) {
    req.log.error({ err, email: normalizedEmail }, "Failed to send forgot-password email");
    res.status(500).json({ error: "E-Mail konnte nicht gesendet werden." });
    return;
  }

  res.json({ success: true, message: "Falls ein Konto existiert, wird ein Code gesendet." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };

  if (!email || !code || !newPassword) {
    res.status(400).json({ error: "E-Mail, Code und neues Passwort sind erforderlich." });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Das Passwort muss mindestens 6 Zeichen lang sein." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    res.status(400).json({ error: "Kein aktiver Code für diese E-Mail-Adresse gefunden." });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    res.status(400).json({ error: "Der Code ist abgelaufen. Bitte fordere einen neuen an." });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    res.status(429).json({ error: "Zu viele Versuche. Bitte fordere einen neuen Code an." });
    return;
  }

  if (entry.code !== code.trim()) {
    res.status(400).json({
      error: `Ungültiger Code. Noch ${MAX_ATTEMPTS - entry.attempts} Versuche.`,
    });
    return;
  }

  otpStore.delete(normalizedEmail);

  const passwordHash = await sha256Hex(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.email, normalizedEmail));

  req.log.info({ email: normalizedEmail }, "Password reset via forgot-password flow");
  res.json({ success: true, message: "Passwort erfolgreich zurückgesetzt." });
});

export default router;
