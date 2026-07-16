import { NextResponse } from "next/server";
import { getCurrentUser } from "@/core/current-user";
import { deleteHolding } from "@/modules/portfolio/service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  await deleteHolding(user.id, id);
  return NextResponse.json({ ok: true });
}
