import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, userSessionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { sendPasswordChangeCode, sendEmailChangeCode } from "../lib/mailer";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

const EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const IP_RATE_WINDOW_MS = 15 * 60 * 1000;
const IP_RATE_MAX = 5;

interface IpRateEntry {
  count: number;
  windowStart: number;
}

const ipRateStore = new Map<string, IpRateEntry>();

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateStore.get(ip);
  if (!entry || now - entry.windowStart > IP_RATE_WINDOW_MS) {
    ipRateStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > IP_RATE_MAX;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
  for (const [ip, entry] of ipRateStore.entries()) {
    if (now - entry.windowStart > IP_RATE_WINDOW_MS) ipRateStore.delete(ip);
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

router.post("/auth/request-change-code", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const email = authReq.userEmail;

  cleanExpired();

  const existing = otpStore.get(email);
  if (existing && Date.now() < existing.expiresAt) {
    res.json({ success: true, message: "Bestätigungscode wurde an deine E-Mail-Adresse gesendet." });
    return;
  }

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
  const userId = authReq.userId;
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

  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.email, email));
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));

  req.log.info({ email }, "Password changed successfully; all sessions revoked");
  res.json({ success: true, message: "Passwort erfolgreich geändert." });
});

const EMAIL_OTP_PREFIX = "email_change:";

router.post("/auth/request-email-change", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const currentEmail = authReq.userEmail;
  const { newEmail } = req.body as { newEmail?: string };

  if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
    res.status(400).json({ error: "Ungültige neue E-Mail-Adresse." });
    return;
  }

  const normalizedNew = newEmail.trim().toLowerCase();

  if (normalizedNew === currentEmail.toLowerCase()) {
    res.status(400).json({ error: "Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden." });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedNew));
  if (existing) {
    res.status(409).json({ error: "Diese E-Mail-Adresse ist bereits registriert." });
    return;
  }

  cleanExpired();

  const storeKey = `${EMAIL_OTP_PREFIX}${currentEmail}`;
  const existingOtp = otpStore.get(storeKey);
  if (existingOtp && Date.now() < existingOtp.expiresAt) {
    res.json({ success: true, message: "Bestätigungscode wurde an deine aktuelle E-Mail-Adresse gesendet." });
    return;
  }

  const code = generateCode();
  otpStore.set(storeKey, { code, expiresAt: Date.now() + EXPIRY_MS, attempts: 0 });

  req.log.info({ currentEmail, newEmail: normalizedNew }, "Email change OTP generated");

  try {
    await sendEmailChangeCode(currentEmail, code, normalizedNew);
  } catch (err) {
    req.log.error({ err, currentEmail }, "Failed to send email change code");
    otpStore.delete(storeKey);
    res.status(500).json({ error: "E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut." });
    return;
  }

  res.json({ success: true, message: "Bestätigungscode wurde an deine aktuelle E-Mail-Adresse gesendet." });
});

router.post("/auth/confirm-email-change", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const currentEmail = authReq.userEmail;
  const userId = authReq.userId;
  const { code, newEmail } = req.body as { code?: string; newEmail?: string };

  if (!code || !newEmail) {
    res.status(400).json({ error: "Code und neue E-Mail-Adresse sind erforderlich." });
    return;
  }

  if (typeof newEmail !== "string" || !newEmail.includes("@")) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    return;
  }

  const normalizedNew = newEmail.trim().toLowerCase();

  if (normalizedNew === currentEmail.toLowerCase()) {
    res.status(400).json({ error: "Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden." });
    return;
  }

  const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedNew));
  if (taken) {
    res.status(409).json({ error: "Diese E-Mail-Adresse ist bereits registriert." });
    return;
  }

  const storeKey = `${EMAIL_OTP_PREFIX}${currentEmail}`;
  const entry = otpStore.get(storeKey);

  if (!entry) {
    res.status(400).json({ error: "Kein aktiver Code gefunden. Bitte fordere einen neuen an." });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(storeKey);
    res.status(400).json({ error: "Der Code ist abgelaufen. Bitte fordere einen neuen an." });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(storeKey);
    res.status(429).json({ error: "Zu viele Versuche. Bitte fordere einen neuen Code an." });
    return;
  }

  if (entry.code !== code.trim()) {
    const remaining = MAX_ATTEMPTS - entry.attempts;
    res.status(400).json({ error: `Ungültiger Code. Noch ${remaining} Versuch${remaining === 1 ? "" : "e"}.` });
    return;
  }

  otpStore.delete(storeKey);

  await db.update(usersTable).set({ email: normalizedNew }).where(eq(usersTable.id, userId));
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));

  req.log.info({ oldEmail: currentEmail, newEmail: normalizedNew }, "Email changed; all sessions revoked");
  res.json({ success: true, message: "E-Mail-Adresse erfolgreich geändert. Bitte melde dich erneut an." });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  cleanExpired();

  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  if (isIpRateLimited(clientIp)) {
    req.log.warn({ ip: clientIp }, "Forgot-password rate limit exceeded");
    res.status(429).json({ error: "Zu viele Anfragen. Bitte versuche es später erneut." });
    return;
  }

  const existing = otpStore.get(normalizedEmail);
  if (existing && Date.now() < existing.expiresAt) {
    res.json({ success: true, message: "Falls ein Konto existiert, wird ein Code gesendet." });
    return;
  }

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

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (!user) {
    res.status(400).json({ error: "Kein Konto für diese E-Mail-Adresse gefunden." });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, user.id));

  req.log.info({ email: normalizedEmail }, "Password reset via forgot-password flow; all sessions revoked");
  res.json({ success: true, message: "Passwort erfolgreich zurückgesetzt." });
});

export default router;
