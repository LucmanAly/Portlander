import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/core/current-user";
import { getOrCreatePreferences, updatePreferences } from "@/modules/notifications/preferences";

export async function GET() {
  const user = await getCurrentUser();
  const preferences = await getOrCreatePreferences(user.id);
  return NextResponse.json({ preferences });
}

const updateSchema = z.object({
  leadDays: z.array(z.number().int().positive()).min(1).optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const user = await getCurrentUser();
  const preferences = await updatePreferences(user.id, parsed.data);
  return NextResponse.json({ preferences });
}
