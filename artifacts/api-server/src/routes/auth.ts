import { Router, type IRouter } from "express";

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

router.post("/auth/forgot-password", (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    return;
  }

  cleanExpired();

  const normalizedEmail = email.trim().toLowerCase();
  const code = generateCode();

  otpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + EXPIRY_MS,
    attempts: 0,
  });

  req.log.info({ email: normalizedEmail }, "Password reset OTP generated");

  res.json({
    success: true,
    message: "Wiederherstellungscode generiert.",
    code,
    note: "In der Produktion wird dieser Code per E-Mail gesendet.",
    expiresInMinutes: 5,
  });
});

router.post("/auth/reset-password", (req, res) => {
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

  req.log.info({ email: normalizedEmail }, "Password reset successful");

  res.json({
    success: true,
    message: "Passwort erfolgreich zurückgesetzt.",
  });
});

export default router;
