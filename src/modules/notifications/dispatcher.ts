import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { eventBus, type EarningsUpcomingEvent } from "@/core/events";
import type { NotificationChannel } from "./channel";
import { inAppChannel } from "./channels/in-app";
import { emailChannel } from "./channels/email";

const channels: NotificationChannel[] = [inAppChannel, emailChannel];

function buildDedupeKey(payload: EarningsUpcomingEvent): string {
  return `${payload.userId}:${payload.symbol}:${payload.eventDate}:${payload.leadDays}`;
}

async function handleEarningsUpcoming(payload: EarningsUpcomingEvent): Promise<void> {
  const dedupeKey = buildDedupeKey(payload);

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.userId)).limit(1);
  if (!user) return;

  const [prefs] = await db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, payload.userId))
    .limit(1);

  // The unique index on dedupe_key is what makes this exactly-once: if the
  // daily cron reruns or overlaps, every retry after the first is a no-op.
  const [inserted] = await db
    .insert(schema.notifications)
    .values({
      userId: payload.userId,
      type: "earnings_upcoming",
      payload: { symbol: payload.symbol, eventDate: payload.eventDate, leadDays: payload.leadDays },
      dedupeKey,
    })
    .onConflictDoNothing({ target: schema.notifications.dedupeKey })
    .returning();

  if (!inserted) return;

  const notificationPayload = { symbol: payload.symbol, eventDate: payload.eventDate, leadDays: payload.leadDays };

  for (const channel of channels) {
    if (!channel.isEnabledFor(prefs)) continue;
    try {
      await channel.send(user, notificationPayload);
    } catch (err) {
      // One channel failing (e.g. email provider down) shouldn't stop the
      // others, and shouldn't roll back the notification row — the in-app
      // center is the source of truth even if delivery elsewhere failed.
      console.error(`[notifications] channel "${channel.name}" failed for user ${user.id}:`, err);
    }
  }

  await db.update(schema.notifications).set({ sentAt: new Date() }).where(eq(schema.notifications.id, inserted.id));
}

let registered = false;

/** Wires the dispatcher up to the event bus. Idempotent and cheap to call at
 *  the top of any entrypoint (e.g. the daily cron route) that might emit
 *  `earnings.upcoming` — serverless invocations get a fresh module scope, so
 *  this must run per-invocation rather than once at deploy time. */
export function registerNotificationListeners(): void {
  if (registered) return;
  eventBus.on("earnings.upcoming", handleEarningsUpcoming);
  registered = true;
}
