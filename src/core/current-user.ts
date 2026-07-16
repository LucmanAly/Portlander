import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { getConfig } from "@/core/config";

/** v1 is single-tenant: one deployment, one user, identified by
 *  APP_USER_EMAIL. This is the only place that assumption lives — swapping
 *  in Supabase Auth later means replacing this function's body with a
 *  session lookup; every route that calls it stays unchanged. */
export async function getCurrentUser() {
  const { APP_USER_EMAIL } = getConfig();

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, APP_USER_EMAIL)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.users)
    .values({ email: APP_USER_EMAIL })
    .onConflictDoNothing({ target: schema.users.email })
    .returning();

  if (created) return created;

  const [row] = await db.select().from(schema.users).where(eq(schema.users.email, APP_USER_EMAIL)).limit(1);
  if (!row) throw new Error("Failed to resolve current user");
  return row;
}
