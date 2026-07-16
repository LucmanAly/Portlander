import type { BrokerImporter } from "./importer";
import type { ImportResult, ParsedHolding } from "../types";

/** Parses a single CSV line, respecting double-quoted fields (Fidelity quotes
 *  every field, including ones with no commas inside). No support for
 *  escaped quotes-within-quotes — Fidelity's export doesn't produce them. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (cleaned === "" || cleaned.toLowerCase() === "n/a" || cleaned === "--") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function normalizeSymbol(raw: string): string {
  // Fidelity appends "**" to cash/money-market sweep positions (e.g. SPAXX**).
  return raw.trim().toUpperCase().replace(/\*+$/, "");
}

const REQUIRED_HEADERS = ["symbol", "quantity"];

export const fidelityCsvImporter: BrokerImporter = {
  name: "fidelity-csv",

  parse(fileContents: string): ImportResult {
    const lines = fileContents.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsed: ParsedHolding[] = [];
    const skipped: { row: string; reason: string }[] = [];

    const headerIndex = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return REQUIRED_HEADERS.every((h) => lower.includes(h));
    });

    if (headerIndex === -1) {
      throw new Error(
        "Couldn't find a header row with Symbol and Quantity columns. Is this a Fidelity Positions export?"
      );
    }

    const headers = parseCsvLine(lines[headerIndex]!).map((h) => h.toLowerCase());
    const col = (name: string) => headers.findIndex((h) => h.includes(name));

    const symbolCol = col("symbol");
    const quantityCol = col("quantity");
    const costBasisCol = headers.findIndex((h) => h.includes("cost basis total"));
    const accountCol = col("account name");

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i]!;
      // Fidelity's export ends with disclaimer paragraphs, not CSV rows.
      if (!line.includes(",")) break;

      const fields = parseCsvLine(line);
      const rawSymbol = fields[symbolCol];
      const rawQuantity = fields[quantityCol];

      if (!rawSymbol || rawSymbol.toLowerCase() === "pending activity") {
        skipped.push({ row: line, reason: "no symbol" });
        continue;
      }

      const symbol = normalizeSymbol(rawSymbol);
      const quantity = parseMoney(rawQuantity);

      if (!symbol || quantity === null) {
        skipped.push({ row: line, reason: "missing/unparseable symbol or quantity" });
        continue;
      }

      parsed.push({
        symbol,
        quantity,
        costBasis: costBasisCol >= 0 ? parseMoney(fields[costBasisCol]) : null,
        accountLabel: accountCol >= 0 ? fields[accountCol] ?? null : null,
      });
    }

    return { parsed, skipped };
  },
};
