import { Router, type IRouter } from "express";
import { eq, and, sql, isNull } from "drizzle-orm";
import { db, tripsTable } from "@workspace/db";
import {
  CreateTripBody,
  UpdateTripBody,
  ListTripsResponse,
  ListTripsResponseItem,
  BatchUpsertTripsBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import type { Request } from "express";

const router: IRouter = Router();

function toApiTrip(row: typeof tripsTable.$inferSelect) {
  return ListTripsResponseItem.parse({
    id: row.id,
    date: row.date,
    startAddr: row.startAddr,
    endAddr: row.endAddr,
    km: row.km,
    dur: row.dur,
    type: row.type,
    edited: row.edited ?? null,
    deleted: row.deletedAt != null,
  });
}

router.get("/trips", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rows = await db.select().from(tripsTable).where(eq(tripsTable.userId, userId));
  res.json(ListTripsResponse.parse(rows.map(toApiTrip)));
});

router.post("/trips", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { id, date, startAddr, endAddr, km, dur, type, edited } = parsed.data;
  const [row] = await db
    .insert(tripsTable)
    .values({ id, userId, date, startAddr, endAddr, km, dur, type, edited: edited ?? false })
    .onConflictDoUpdate({
      target: [tripsTable.userId, tripsTable.id],
      set: { date, startAddr, endAddr, km, dur, type, edited: edited ?? false },
    })
    .returning();
  res.status(201).json(toApiTrip(row));
});

router.post("/trips/batch", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = BatchUpsertTripsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.trips.length === 0) {
    res.json([]);
    return;
  }
  const deduped = new Map<string, typeof parsed.data.trips[number]>();
  for (const trip of parsed.data.trips) {
    deduped.set(trip.id, trip);
  }
  const values = [...deduped.values()].map(({ id, date, startAddr, endAddr, km, dur, type, edited }) => ({
    id,
    userId,
    date,
    startAddr,
    endAddr,
    km,
    dur,
    type,
    edited: edited ?? false,
  }));
  const rows = await db
    .insert(tripsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [tripsTable.userId, tripsTable.id],
      set: {
        date: sql`excluded.date`,
        startAddr: sql`excluded.start_addr`,
        endAddr: sql`excluded.end_addr`,
        km: sql`excluded.km`,
        dur: sql`excluded.dur`,
        type: sql`excluded.type`,
        edited: sql`excluded.edited`,
      },
    })
    .returning();
  res.json(ListTripsResponse.parse(rows.map(toApiTrip)));
});

router.patch("/trips/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const tripId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { edited, ...rest } = parsed.data;
  const updateData = { ...rest, ...(edited != null ? { edited } : {}) };
  const [row] = await db
    .update(tripsTable)
    .set(updateData)
    .where(and(eq(tripsTable.id, tripId), eq(tripsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.json(toApiTrip(row));
});

router.delete("/trips/:id", requireAuth, async (req: Request, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const tripId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [row] = await db
    .update(tripsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(tripsTable.id, tripId), eq(tripsTable.userId, userId), isNull(tripsTable.deletedAt)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
