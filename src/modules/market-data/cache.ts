import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/core/db/client";

export const TTL = {
  QUOTE_MS: 60 * 1000, // 60s — "realtime enough" for a tracker
  EARNINGS_MS: 24 * 60 * 60 * 1000, // 24h
  PROFILE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(schema.cacheEntries)
    .where(eq(schema.cacheEntries.key, key))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.payload as T;
}

/** Returns a cached value even if expired — used as a last-resort fallback
 *  when every live provider call has failed. Stale beats nothing. */
export async function cacheGetStale<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(schema.cacheEntries)
    .where(eq(schema.cacheEntries.key, key))
    .limit(1);
  return row ? (row.payload as T) : null;
}

export async function cacheSet(key: string, payload: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insert(schema.cacheEntries)
    .values({ key, payload: payload as never, expiresAt })
    .onConflictDoUpdate({
      target: schema.cacheEntries.key,
      set: { payload: payload as never, expiresAt },
    });
}

/** Best-effort cleanup for expired rows; safe to call opportunistically
 *  (e.g. once per daily cron run) since it's just a DELETE ... WHERE. */
export async function cachePurgeExpired(): Promise<void> {
  await db.delete(schema.cacheEntries).where(sql`${schema.cacheEntries.expiresAt} < now()`);
}
