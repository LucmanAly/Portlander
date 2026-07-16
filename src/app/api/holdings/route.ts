import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/core/current-user";
import { addHolding, listHoldings } from "@/modules/portfolio/service";

export async function GET() {
  const user = await getCurrentUser();
  const holdings = await listHoldings(user.id);
  return NextResponse.json({ holdings });
}

const addHoldingSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number().positive(),
  costBasis: z.number().nullable().optional(),
  accountLabel: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = addHoldingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getCurrentUser();
  const holding = await addHolding(user.id, {
    symbol: parsed.data.symbol.toUpperCase(),
    quantity: parsed.data.quantity,
    costBasis: parsed.data.costBasis ?? null,
    accountLabel: parsed.data.accountLabel ?? null,
  });
  return NextResponse.json({ holding }, { status: 201 });
}
