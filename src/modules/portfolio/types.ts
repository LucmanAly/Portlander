export type Holding = {
  id: string;
  userId: string;
  symbol: string;
  quantity: string;
  costBasis: string | null;
  accountLabel: string | null;
  importedAt: Date;
};

export type ParsedHolding = {
  symbol: string;
  quantity: number;
  costBasis: number | null;
  accountLabel: string | null;
};

export type ImportResult = {
  parsed: ParsedHolding[];
  skipped: { row: string; reason: string }[];
};
