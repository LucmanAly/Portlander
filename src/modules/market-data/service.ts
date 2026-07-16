import type { CompanyProfile, EarningsEvent, Quote } from "./provider";
import { withFallback } from "./registry";
import { cacheGet, cacheGetStale, cacheSet, TTL } from "./cache";

/** Public surface other modules call — providers, caching, and fallback are
 *  all implementation details hidden behind these three functions. */

export async function getQuote(symbol: string): Promise<Quote> {
  const key = `quote:${symbol}`;
  const cached = await cacheGet<Quote>(key);
  if (cached) return cached;

  try {
    const quote = await withFallback((p) => p.getQuote(symbol));
    await cacheSet(key, quote, TTL.QUOTE_MS);
    return quote;
  } catch (err) {
    const stale = await cacheGetStale<Quote>(key);
    if (stale) return stale;
    throw err;
  }
}

export async function getEarningsCalendar(range: { from: string; to: string }): Promise<EarningsEvent[]> {
  const key = `earnings:${range.from}:${range.to}`;
  const cached = await cacheGet<EarningsEvent[]>(key);
  if (cached) return cached;

  try {
    const events = await withFallback((p) => p.getEarningsCalendar(range));
    await cacheSet(key, events, TTL.EARNINGS_MS);
    return events;
  } catch (err) {
    const stale = await cacheGetStale<EarningsEvent[]>(key);
    if (stale) return stale;
    throw err;
  }
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const key = `profile:${symbol}`;
  const cached = await cacheGet<CompanyProfile>(key);
  if (cached) return cached;

  try {
    const profile = await withFallback((p) => p.getCompanyProfile(symbol));
    await cacheSet(key, profile, TTL.PROFILE_MS);
    return profile;
  } catch (err) {
    const stale = await cacheGetStale<CompanyProfile>(key);
    if (stale) return stale;
    throw err;
  }
}
