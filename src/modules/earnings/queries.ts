import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";

export type UpcomingEarnings = {
  symbol: string;
  eventDate: string;
  daysUntil: number;
  confirmed: boolean;
};

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Nearest upcoming earnings date per held symbol, soonest first. Used by
 *  the dashboard — a read-only view, distinct from the watcher's job of
 *  deciding when to *notify*. */
export async function getUpcomingEarningsForUser(userId: string): Promise<UpcomingEarnings[]> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      symbol: schema.earningsEvents.symbol,
      eventDate: schema.earningsEvents.eventDate,
      confirmed: schema.earningsEvents.confirmed,
    })
    .from(schema.holdings)
    .innerJoin(schema.earningsEvents, eq(schema.earningsEvents.symbol, schema.holdings.symbol))
    .where(eq(schema.holdings.userId, userId));

  const nearestBySymbol = new Map<string, UpcomingEarnings>();
  for (const row of rows) {
    if (row.eventDate < today) continue;
    const existing = nearestBySymbol.get(row.symbol);
    if (existing && existing.eventDate <= row.eventDate) continue;
    nearestBySymbol.set(row.symbol, {
      symbol: row.symbol,
      eventDate: row.eventDate,
      daysUntil: daysBetween(today, row.eventDate),
      confirmed: row.confirmed,
    });
  }

  return [...nearestBySymbol.values()].sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getAllUpcomingEarningsForUser(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      symbol: schema.earningsEvents.symbol,
      eventDate: schema.earningsEvents.eventDate,
      confirmed: schema.earningsEvents.confirmed,
    })
    .from(schema.holdings)
    .innerJoin(schema.earningsEvents, eq(schema.earningsEvents.symbol, schema.holdings.symbol))
    .where(eq(schema.holdings.userId, userId));

  const seen = new Set<string>();
  const events = rows
    .filter((r) => r.eventDate >= today)
    .filter((r) => {
      const key = `${r.symbol}:${r.eventDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({ ...r, daysUntil: daysBetween(today, r.eventDate) }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  return events;
}
