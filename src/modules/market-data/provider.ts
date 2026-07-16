export type Quote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  asOf: string; // ISO timestamp
};

export type EarningsEvent = {
  symbol: string;
  eventDate: string; // YYYY-MM-DD
  timeOfDay: "bmo" | "amc" | "unknown";
  epsEstimate: number | null;
  confirmed: boolean;
};

export type CompanyProfile = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  sector: string | null;
};

export interface MarketDataProvider {
  readonly name: string;
  readonly rateLimit: { requests: number; perSeconds: number };

  getQuote(symbol: string): Promise<Quote>;
  getEarningsCalendar(range: { from: string; to: string }): Promise<EarningsEvent[]>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
