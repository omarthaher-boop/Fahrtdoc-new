/**
 * Auth routes: POST /api/auth/register, POST /api/auth/login,
 *              DELETE /api/auth/account
 * Owns user account creation, session token issuance, and account deletion.
 * See routes/trips.ts for trip CRUD; middleware/auth.ts for token validation.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, userSessionsTable, tripsTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody, LoginUserResponse } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import type { Request } from "express";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (SHA256_HEX_RE.test(storedHash)) {
    const candidate = await sha256Hex(password);
    return candidate === storedHash;
  }
  return bcrypt.compare(password, storedHash);
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, name, plate, password } = parsed.data;
  const key = email.toLowerCase().trim();

  // Hash the password before the INSERT attempt so that response timing is
  // identical regardless of whether the email is new or already registered.
  const passwordHash = await hashPassword(password);

  const inserted = await db
    .insert(usersTable)
    .values({ email: key, name, plate, passwordHash })
    .onConflictDoNothing()
    .returning({ id: usersTable.id });

  if (inserted.length > 0) {
    req.log.info({ userId: inserted[0].id }, "User registered");
  }

  // Always return the same response regardless of whether the email was new or
  // already taken. This prevents account enumeration via differential response.
  // Clients must complete the flow by calling /api/auth/login.
  res.status(200).json({ success: true, message: "If this email is not already registered, your account has been created. Please log in to continue." });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const key = email.toLowerCase().trim();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, key));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (SHA256_HEX_RE.test(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
    req.log.info({ userId: user.id }, "Password hash upgraded to bcrypt on login");
  }

  const [session] = await db
    .insert(userSessionsTable)
    .values({ userId: user.id, expiresAt: sessionExpiry() })
    .returning();

  req.log.info({ userId: user.id }, "User logged in");
  res.json(LoginUserResponse.parse({ token: session.token, email: user.email, name: user.name, plate: user.plate }));
});

router.delete("/auth/account", requireAuth, async (req: Request, res): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;

  await db.delete(tripsTable).where(eq(tripsTable.userId, userId));
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  req.log.info({ userId }, "Account and all associated data deleted");
  res.status(200).json({ success: true });
});

export default router;
