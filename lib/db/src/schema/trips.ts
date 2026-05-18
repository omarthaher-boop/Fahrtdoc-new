import { pgTable, text, uuid, real, integer, boolean, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const waypointSchema = z.object({
  addr: z.string(),
  lat: z.number(),
  lon: z.number(),
  timestamp: z.number(),
  note: z.string().optional(),
});
export type WaypointRow = z.infer<typeof waypointSchema>;

export const tripsTable = pgTable("trips", {
  rowId: uuid("row_id").primaryKey().defaultRandom(),
  id: text("id").notNull(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  startAddr: text("start_addr").notNull(),
  endAddr: text("end_addr").notNull(),
  km: real("km").notNull(),
  dur: integer("dur").notNull(),
  type: text("type", { enum: ["business", "private"] }).notNull(),
  edited: boolean("edited").notNull().default(false),
  waypoints: jsonb("waypoints").$type<WaypointRow[]>(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("trips_user_id_id_unique").on(t.userId, t.id),
]);

export const insertTripSchema = createInsertSchema(tripsTable).omit({ rowId: true, createdAt: true, updatedAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripRow = typeof tripsTable.$inferSelect;
