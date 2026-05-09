/**
 * Auth routes: POST /api/auth/register, POST /api/auth/login
 * Owns user account creation and session token issuance.
 * See routes/trips.ts for trip CRUD; middleware/auth.ts for token validation.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userSessionsTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody, LoginUserResponse } from "@workspace/api-zod";
const router: IRouter = Router();

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, key));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await sha256Hex(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email: key, name, plate, passwordHash })
    .returning();

  const [session] = await db
    .insert(userSessionsTable)
    .values({ userId: user.id, expiresAt: sessionExpiry() })
    .returning();

  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json(LoginUserResponse.parse({ token: session.token, email: user.email, name: user.name, plate: user.plate }));
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

  const passwordHash = await sha256Hex(password);
  if (passwordHash !== user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const [session] = await db
    .insert(userSessionsTable)
    .values({ userId: user.id, expiresAt: sessionExpiry() })
    .returning();

  req.log.info({ userId: user.id }, "User logged in");
  res.json(LoginUserResponse.parse({ token: session.token, email: user.email, name: user.name, plate: user.plate }));
});

export default router;
