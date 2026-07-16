import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { eventBus, type EarningsUpcomingEvent } from "@/core/events";

const DEFAULT_LEAD_DAYS = [30, 7, 1];

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** For every user, finds holdings whose earnings date lands exactly on one of
 *  the user's configured lead-day milestones (default 30/7/1) and emits one
 *  `earnings.upcoming` event per match. Pure read + emit — no side effects of
 *  its own, which makes it easy to test against seeded rows. */
export async function runEarningsWatcher(): Promise<{ eventsEmitted: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const users = await db.select().from(schema.users);
  let emitted = 0;

  for (const user of users) {
    const [prefs] = await db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, user.id))
      .limit(1);
    const leadDays = prefs?.leadDays ?? DEFAULT_LEAD_DAYS;

    const rows = await db
      .select({
        symbol: schema.holdings.symbol,
        eventDate: schema.earningsEvents.eventDate,
      })
      .from(schema.holdings)
      .innerJoin(schema.earningsEvents, eq(schema.earningsEvents.symbol, schema.holdings.symbol))
      .where(eq(schema.holdings.userId, user.id));

    // A symbol can be held across multiple accounts; only alert once per symbol/date.
    const seen = new Set<string>();

    for (const row of rows) {
      const dedupeCheck = `${row.symbol}:${row.eventDate}`;
      if (seen.has(dedupeCheck)) continue;

      const daysUntil = daysBetween(today, row.eventDate);
      if (!leadDays.includes(daysUntil)) continue;

      seen.add(dedupeCheck);
      const payload: EarningsUpcomingEvent = {
        userId: user.id,
        symbol: row.symbol,
        eventDate: row.eventDate,
        leadDays: daysUntil,
      };
      await eventBus.emit("earnings.upcoming", payload);
      emitted++;
    }
  }

  return { eventsEmitted: emitted };
}
