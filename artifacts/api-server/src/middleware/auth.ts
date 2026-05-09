import type { Request, Response, NextFunction } from "express";
import { db, userSessionsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [session] = await db
    .select({ userId: userSessionsTable.userId, email: usersTable.email })
    .from(userSessionsTable)
    .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(userSessionsTable.token, token),
        gt(userSessionsTable.expiresAt, new Date())
      )
    );
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).userId = session.userId;
  (req as AuthenticatedRequest).userEmail = session.email;
  next();
}
