-- Portlander Phase 1 schema
-- Apply in Supabase SQL editor. Enable RLS. Auth users map to auth.users.

-- Holdings
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  name text,
  shares numeric not null check (shares > 0),
  cost_basis numeric,
  last_price numeric,
  weight_override_pct numeric,
  tags text[] default '{}',
  notes text,
  -- 'snaptrade' rows are authoritative live-brokerage data; 'manual'/'csv' are
  -- owner-entered fallbacks for tickers no connected brokerage covers.
  source text not null default 'manual' check (source in ('manual', 'csv', 'snaptrade')),
  day_change_value numeric,
  day_change_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

-- Helpful for client upserts on conflict (user_id, ticker)
create unique index if not exists holdings_user_ticker_uidx on public.holdings (user_id, ticker);

-- Watchlist
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  name text,
  notes text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create unique index if not exists watchlist_user_ticker_uidx on public.watchlist (user_id, ticker);

-- Events (ticker null for pure macro)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  -- null user_id = global/shared macro calendar rows (optional pattern)
  ticker text,
  title text not null,
  event_type text not null check (
    event_type in (
      'earnings',
      'ex_div',
      'pay_div',
      'fomc',
      'cpi',
      'nfp',
      'other_macro'
    )
  ),
  event_date date not null,
  event_time time,
  timing text not null default 'unknown' check (timing in ('bmo', 'amc', 'unknown')),
  status text not null default 'estimated' check (status in ('confirmed', 'estimated')),
  source text,
  description text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Finnhub's calendar/earnings response already returns these; sync-events
  -- writes them as typed columns instead of leaving them stranded in `raw`
  -- (applied live via migrations 20260802025048/20260802025609, reconciled
  -- into this file during BE-01/BE-04 — see PROGRESS.md Decisions).
  eps_estimate numeric,
  eps_actual numeric,
  revenue_estimate numeric,
  revenue_actual numeric,
  -- BE-06: DeepSeek-generated structured interpretation of this row's
  -- verified facts (summary/model/generatedAt/confidence), written only by
  -- the earnings-interpret Edge Function after strict schema validation.
  -- Never a source of facts — see AGENTS.md Phase 2 data truth rules. Null
  -- until an owner-configured DeepSeek call has run for this event.
  ai_interpretation jsonb
);

create index if not exists events_user_date_idx on public.events (user_id, event_date);
create index if not exists events_ticker_date_idx on public.events (ticker, event_date);

-- Deterministic upserts from sync-events use fixed UUID primary keys (onConflict: id).
-- Optional helper index for lookups by natural key:
create index if not exists events_natural_lookup_idx
  on public.events (ticker, event_type, event_date);

-- SnapTrade per-user secret. As sensitive as a password — RLS is enabled
-- with zero client-facing policies, so only the service-role key (used
-- exclusively inside Edge Functions) can ever read or write it.
create table if not exists public.snaptrade_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snaptrade_user_id text not null,
  user_secret text not null,
  created_at timestamptz not null default now()
);

-- SnapTrade connection metadata — safe for the client to read (no secrets),
-- powers the "Connected: Fidelity" UI. Refreshed by snaptrade-sync on every
-- run; only the service role writes to it.
create table if not exists public.snaptrade_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brokerage_name text not null,
  authorization_id text not null,
  connected_at timestamptz not null default now(),
  unique (user_id, authorization_id)
);

-- Sync run log
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  provider text,
  tickers_count int,
  events_upserted int,
  error text
);

-- Daily position-level evidence for performance briefings. One completed
-- refresh replaces that user's snapshot for the same New York market date.
-- The client only reads these rows; refresh-quotes/service-role owns writes.
create table if not exists public.portfolio_snapshot_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  status text not null check (status in ('ok', 'partial', 'error')),
  expected_positions int not null check (expected_positions >= 0),
  captured_positions int not null check (captured_positions >= 0),
  missing_tickers text[] not null default '{}',
  captured_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_run_id uuid not null references public.portfolio_snapshot_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  ticker text not null,
  shares numeric not null check (shares > 0),
  price numeric not null check (price >= 0),
  previous_close numeric not null check (previous_close >= 0),
  market_value numeric not null,
  day_change_value numeric not null,
  day_change_pct numeric,
  tags text[] not null default '{}',
  quote_timestamp timestamptz,
  captured_at timestamptz not null default now(),
  unique (user_id, snapshot_date, ticker)
);

create index if not exists portfolio_snapshots_user_date_idx
  on public.portfolio_snapshots (user_id, snapshot_date);

-- Cached DeepSeek narration. The evidence hash is calculated from the exact
-- deterministic figures shown in the UI; the model never owns those figures.
create table if not exists public.performance_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  evidence_hash text not null,
  generated_summary jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, evidence_hash)
);

-- RLS
alter table public.holdings enable row level security;
alter table public.watchlist enable row level security;
alter table public.events enable row level security;
alter table public.sync_runs enable row level security;
alter table public.snaptrade_users enable row level security;
alter table public.snaptrade_connections enable row level security;
alter table public.portfolio_snapshot_runs enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.performance_briefings enable row level security;

create policy "holdings_select_own" on public.holdings
  for select using (auth.uid() = user_id);
create policy "holdings_insert_own" on public.holdings
  for insert with check (auth.uid() = user_id);
create policy "holdings_update_own" on public.holdings
  for update using (auth.uid() = user_id);
create policy "holdings_delete_own" on public.holdings
  for delete using (auth.uid() = user_id);

create policy "watchlist_select_own" on public.watchlist
  for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist
  for insert with check (auth.uid() = user_id);
create policy "watchlist_update_own" on public.watchlist
  for update using (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist
  for delete using (auth.uid() = user_id);

-- Events: own rows OR global macro (user_id is null)
create policy "events_select_visible" on public.events
  for select using (user_id is null or auth.uid() = user_id);
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);
create policy "events_update_own" on public.events
  for update using (auth.uid() = user_id);
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = user_id);

-- sync_runs: service role only in production; allow read for authenticated for now
create policy "sync_runs_select_auth" on public.sync_runs
  for select to authenticated using (true);

-- snaptrade_users: intentionally NO policies for `authenticated`/`anon` — RLS
-- with zero permissive policies means only the service role (bypasses RLS)
-- can touch this table. The client must never read the secret directly.

create policy "snaptrade_connections_select_own" on public.snaptrade_connections
  for select using (auth.uid() = user_id);

create policy "portfolio_snapshot_runs_select_own" on public.portfolio_snapshot_runs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "performance_briefings_select_own" on public.performance_briefings
  for select to authenticated using ((select auth.uid()) = user_id);

-- Supabase projects created after the 2026 Data API exposure change may not
-- expose SQL-created public tables automatically. Grant read access explicitly;
-- RLS above still restricts every row to its owner. Writes stay service-role only.
grant select on public.portfolio_snapshot_runs to authenticated;
grant select on public.portfolio_snapshots to authenticated;
grant select on public.performance_briefings to authenticated;

-- Phase 2 reserved (do not use in Phase 1 UI unless exit criteria met)
-- create table journal_entries (...);
-- create table event_notes (...);
