import { and, eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import type { ParsedHolding } from "./types";

export async function listHoldings(userId: string) {
  return db.query.holdings.findMany({
    where: eq(schema.holdings.userId, userId),
    orderBy: (h, { asc }) => [asc(h.symbol)],
  });
}

export async function listDistinctHeldSymbols(): Promise<string[]> {
  const rows = await db.selectDistinct({ symbol: schema.holdings.symbol }).from(schema.holdings);
  return rows.map((r) => r.symbol);
}

async function ensureInstrument(symbol: string) {
  await db
    .insert(schema.instruments)
    .values({ symbol })
    .onConflictDoNothing({ target: schema.instruments.symbol });
}

/** Replaces a user's holdings for a given account label with a freshly
 *  imported set. Re-running an import (e.g. after rebalancing) is meant to
 *  be idempotent: it clears the old rows for that account and writes the
 *  new ones inside a single transaction, rather than accumulating duplicates. */
export async function replaceHoldingsForAccount(
  userId: string,
  accountLabel: string | null,
  parsedHoldings: ParsedHolding[]
) {
  return db.transaction(async (tx) => {
    for (const holding of parsedHoldings) {
      await tx
        .insert(schema.instruments)
        .values({ symbol: holding.symbol })
        .onConflictDoNothing({ target: schema.instruments.symbol });
    }

    if (accountLabel) {
      await tx
        .delete(schema.holdings)
        .where(and(eq(schema.holdings.userId, userId), eq(schema.holdings.accountLabel, accountLabel)));
    }

    if (parsedHoldings.length === 0) return [];

    return tx
      .insert(schema.holdings)
      .values(
        parsedHoldings.map((h) => ({
          userId,
          symbol: h.symbol,
          quantity: h.quantity.toString(),
          costBasis: h.costBasis?.toString() ?? null,
          accountLabel: h.accountLabel,
        }))
      )
      .returning();
  });
}

export async function addHolding(userId: string, holding: ParsedHolding) {
  await ensureInstrument(holding.symbol);
  const [row] = await db
    .insert(schema.holdings)
    .values({
      userId,
      symbol: holding.symbol,
      quantity: holding.quantity.toString(),
      costBasis: holding.costBasis?.toString() ?? null,
      accountLabel: holding.accountLabel,
    })
    .returning();
  return row;
}

export async function deleteHolding(userId: string, holdingId: string) {
  await db
    .delete(schema.holdings)
    .where(and(eq(schema.holdings.id, holdingId), eq(schema.holdings.userId, userId)));
}
