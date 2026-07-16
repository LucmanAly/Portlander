import { rateLimiter } from "@/core/rate-limiter";
import { getConfig } from "@/core/config";
import type { MarketDataProvider } from "./provider";
import { createFinnhubProvider } from "./providers/finnhub";
import { createAlphaVantageProvider } from "./providers/alpha-vantage";

let providers: MarketDataProvider[] | null = null;

/** Providers in priority order. Finnhub first (generous free limit, has a
 *  proper earnings-calendar endpoint); Alpha Vantage as the sparse fallback.
 *  A provider whose API key isn't configured is simply omitted — the
 *  registry degrades gracefully rather than throwing at boot. */
function buildProviders(): MarketDataProvider[] {
  const config = getConfig();
  const list: MarketDataProvider[] = [];
  if (config.FINNHUB_API_KEY) list.push(createFinnhubProvider(config.FINNHUB_API_KEY));
  if (config.ALPHAVANTAGE_API_KEY) list.push(createAlphaVantageProvider(config.ALPHAVANTAGE_API_KEY));
  return list;
}

export function getProviders(): MarketDataProvider[] {
  if (!providers) providers = buildProviders();
  return providers;
}

/** Runs `fn` against each provider in priority order, skipping any provider
 *  that's currently rate-limited, and returning the first success. */
export async function withFallback<T>(fn: (provider: MarketDataProvider) => Promise<T>): Promise<T> {
  const errors: string[] = [];
  for (const provider of getProviders()) {
    if (!rateLimiter.tryConsume(provider.name, provider.rateLimit.requests, provider.rateLimit.perSeconds)) {
      errors.push(`${provider.name}: rate-limited`);
      continue;
    }
    try {
      return await fn(provider);
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All market-data providers failed or unavailable: ${errors.join("; ")}`);
}
