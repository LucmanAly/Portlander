import type { CompanyProfile, EarningsEvent, MarketDataProvider, Quote } from "../provider";
import { ProviderError } from "../provider";

const BASE_URL = "https://finnhub.io/api/v1";

type FinnhubEarningsRow = {
  date: string;
  symbol: string;
  hour: string | null;
  epsEstimate: number | null;
};

function normalizeTimeOfDay(hour: string | null): EarningsEvent["timeOfDay"] {
  if (hour === "bmo") return "bmo";
  if (hour === "amc") return "amc";
  return "unknown";
}

export function createFinnhubProvider(apiKey: string): MarketDataProvider {
  async function request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("token", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new ProviderError("finnhub", `${path} returned HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    name: "finnhub",
    rateLimit: { requests: 60, perSeconds: 60 },

    async getQuote(symbol: string): Promise<Quote> {
      const data = await request<{ c: number; dp: number | null }>("/quote", { symbol });
      if (!data.c) throw new ProviderError("finnhub", `no quote data for ${symbol}`);
      return {
        symbol,
        price: data.c,
        changePercent: data.dp ?? null,
        asOf: new Date().toISOString(),
      };
    },

    async getEarningsCalendar(range) {
      const data = await request<{ earningsCalendar: FinnhubEarningsRow[] }>(
        "/calendar/earnings",
        { from: range.from, to: range.to }
      );
      return (data.earningsCalendar ?? []).map((row) => ({
        symbol: row.symbol,
        eventDate: row.date,
        timeOfDay: normalizeTimeOfDay(row.hour),
        epsEstimate: row.epsEstimate ?? null,
        confirmed: true,
      }));
    },

    async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
      const data = await request<{ name?: string; exchange?: string; finnhubIndustry?: string }>(
        "/stock/profile2",
        { symbol }
      );
      return {
        symbol,
        name: data.name ?? null,
        exchange: data.exchange ?? null,
        sector: data.finnhubIndustry ?? null,
      };
    },
  };
}
