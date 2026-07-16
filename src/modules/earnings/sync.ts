import { sql } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { listDistinctHeldSymbols } from "@/modules/portfolio/service";
import { getEarningsCalendar } from "@/modules/market-data/service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Refreshes earnings_events for every currently-held symbol over a 45-day
 *  horizon. A 45-day fetch window against a 30-day alert window gives
 *  earnings dates room to shift (they get announced/confirmed/moved) without
 *  falling out of range before the watcher sees them. */
export async function syncEarningsForHoldings(): Promise<{ symbolsChecked: number; eventsUpserted: number }> {
  const heldSymbols = new Set(await listDistinctHeldSymbols());
  if (heldSymbols.size === 0) return { symbolsChecked: 0, eventsUpserted: 0 };

  const from = todayIso();
  const to = addDaysIso(from, 45);

  // One date-range call covers every company reporting in the window;
  // filtering to held symbols happens client-side so API usage stays flat
  // regardless of portfolio size.
  const events = await getEarningsCalendar({ from, to });
  const relevant = events.filter((e) => heldSymbols.has(e.symbol));

  let upserted = 0;
  for (const event of relevant) {
    await db
      .insert(schema.earningsEvents)
      .values({
        symbol: event.symbol,
        eventDate: event.eventDate,
        timeOfDay: event.timeOfDay,
        epsEstimate: event.epsEstimate?.toString() ?? null,
        confirmed: event.confirmed,
        source: "market-data-service",
      })
      .onConflictDoUpdate({
        target: [schema.earningsEvents.symbol, schema.earningsEvents.eventDate],
        set: {
          timeOfDay: event.timeOfDay,
          epsEstimate: event.epsEstimate?.toString() ?? null,
          confirmed: event.confirmed,
          fetchedAt: sql`now()`,
        },
      });
    upserted++;
  }

  return { symbolsChecked: heldSymbols.size, eventsUpserted: upserted };
}
