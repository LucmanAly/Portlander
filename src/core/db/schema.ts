import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// A single-tenant deployment can hardcode one row here; the shape supports
// multi-user from day one so Supabase Auth can be dropped in later without
// a schema change.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Shared reference data: one row per ticker, regardless of how many users
// (or accounts) hold it. Earnings events hang off this, not off holdings.
export const instruments = pgTable("instruments", {
  symbol: text("symbol").primaryKey(),
  name: text("name"),
  exchange: text("exchange"),
  sector: text("sector"),
  type: text("type").notNull().default("stock"), // stock | etf | fund | other
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol")
      .notNull()
      .references(() => instruments.symbol, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    costBasis: numeric("cost_basis", { precision: 20, scale: 6 }),
    accountLabel: text("account_label"), // e.g. "Fidelity - Roth IRA"
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSymbolIdx: index("holdings_user_symbol_idx").on(t.userId, t.symbol),
  })
);

export const earningsEvents = pgTable(
  "earnings_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol")
      .notNull()
      .references(() => instruments.symbol, { onDelete: "cascade" }),
    eventDate: text("event_date").notNull(), // YYYY-MM-DD, exchange-local
    timeOfDay: text("time_of_day"), // bmo | amc | unknown
    epsEstimate: numeric("eps_estimate", { precision: 12, scale: 4 }),
    confirmed: boolean("confirmed").notNull().default(false),
    source: text("source").notNull(), // finnhub | alphavantage
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    symbolDateUnique: uniqueIndex("earnings_symbol_date_unique").on(t.symbol, t.eventDate),
  })
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  leadDays: integer("lead_days").array().notNull().default([30, 7, 1]),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  telegramChatId: text("telegram_chat_id"),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // earnings_upcoming
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    // "{userId}:{symbol}:{eventDate}:{leadDays}" — guarantees exactly-once
    // delivery per milestone even if the daily job reruns.
    dedupeKey: text("dedupe_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupeUnique: uniqueIndex("notifications_dedupe_key_unique").on(t.dedupeKey),
    userIdx: index("notifications_user_idx").on(t.userId),
  })
);

// Generic DB-backed cache for market-data provider responses.
export const cacheEntries = pgTable("cache_entries", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
