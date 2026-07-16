import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";

const DEFAULTS = { leadDays: [30, 7, 1] as number[], emailEnabled: true, inAppEnabled: true };

export async function getOrCreatePreferences(
  userId: string
): Promise<typeof schema.notificationPreferences.$inferSelect> {
  const [existing] = await db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.notificationPreferences)
    .values({ userId, ...DEFAULTS })
    .onConflictDoNothing({ target: schema.notificationPreferences.userId })
    .returning();

  return created ?? (await getOrCreatePreferences(userId));
}

export async function updatePreferences(
  userId: string,
  updates: Partial<{ leadDays: number[]; emailEnabled: boolean; inAppEnabled: boolean; telegramChatId: string | null }>
) {
  await getOrCreatePreferences(userId);
  const [updated] = await db
    .update(schema.notificationPreferences)
    .set(updates)
    .where(eq(schema.notificationPreferences.userId, userId))
    .returning();
  return updated;
}
