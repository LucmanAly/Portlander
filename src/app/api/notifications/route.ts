import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { getCurrentUser } from "@/core/current-user";

export async function GET() {
  const user = await getCurrentUser();
  const notifications = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: NextRequest) {
  const { id } = (await request.json()) as { id: string };
  const user = await getCurrentUser();
  const [updated] = await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
