import type { CompanyProfile, EarningsEvent, MarketDataProvider, Quote } from "../provider";
import { ProviderError } from "../provider";

const BASE_URL = "https://www.alphavantage.co/query";

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map((f) => f.trim()));
}

/** Picks the horizon bucket that comfortably covers a `from..to` range.
 *  Alpha Vantage only offers fixed 3/6/12-month horizons, not arbitrary
 *  ranges, so we over-fetch and filter client-side. */
function horizonFor(from: string, to: string): "3month" | "6month" | "12month" {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  if (days <= 95) return "3month";
  if (days <= 185) return "6month";
  return "12month";
}

export function createAlphaVantageProvider(apiKey: string): MarketDataProvider {
  async function requestJson<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new ProviderError("alphavantage", `HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (data["Note"] || data["Information"]) {
      throw new ProviderError("alphavantage", String(data["Note"] ?? data["Information"]));
    }
    return data as T;
  }

  async function requestCsv(params: Record<string, string>): Promise<string[][]> {
    const url = new URL(BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new ProviderError("alphavantage", `HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCsv(text);
    return rows.slice(1); // drop header
  }

  return {
    name: "alphavantage",
    // Free tier is 25 requests/day — used as the sparse fallback, not primary.
    rateLimit: { requests: 25, perSeconds: 86_400 },

    async getQuote(symbol: string): Promise<Quote> {
      const data = await requestJson<{ "Global Quote"?: Record<string, string> }>({
        function: "GLOBAL_QUOTE",
        symbol,
      });
      const q = data["Global Quote"];
      const price = q?.["05. price"] ? Number(q["05. price"]) : null;
      if (!price) throw new ProviderError("alphavantage", `no quote data for ${symbol}`);
      const changePercentRaw = q?.["10. change percent"];
      return {
        symbol,
        price,
        changePercent: changePercentRaw ? Number(changePercentRaw.replace("%", "")) : null,
        asOf: new Date().toISOString(),
      };
    },

    async getEarningsCalendar(range) {
      const rows = await requestCsv({
        function: "EARNINGS_CALENDAR",
        horizon: horizonFor(range.from, range.to),
      });
      const events: EarningsEvent[] = [];
      for (const [symbol, , reportDate, , estimate] of rows) {
        if (!symbol || !reportDate) continue;
        if (reportDate < range.from || reportDate > range.to) continue;
        events.push({
          symbol,
          eventDate: reportDate,
          timeOfDay: "unknown",
          epsEstimate: estimate ? Number(estimate) || null : null,
          confirmed: false,
        });
      }
      return events;
    },

    async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
      const data = await requestJson<{ Name?: string; Exchange?: string; Sector?: string }>({
        function: "OVERVIEW",
        symbol,
      });
      return {
        symbol,
        name: data.Name ?? null,
        exchange: data.Exchange ?? null,
        sector: data.Sector ?? null,
      };
    },
  };
}
