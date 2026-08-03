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

-- Complete point-in-time portfolio captures. A refresh first creates an
-- incomplete header, writes every position row, then marks the header
-- complete. Readers ignore incomplete captures, so a failed partial write can
-- never become a plausible-looking period return.
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  captured_at timestamptz not null default now(),
  holdings_count int not null check (holdings_count >= 0),
  total_value numeric not null check (total_value >= 0),
  is_complete boolean not null default false,
  source text not null default 'finnhub-quotes'
);

create index if not exists portfolio_snapshots_user_date_idx
  on public.portfolio_snapshots (user_id, snapshot_date, captured_at desc);

create table if not exists public.position_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.portfolio_snapshots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  name text,
  shares numeric not null check (shares > 0),
  price numeric not null check (price > 0),
  market_value numeric not null check (market_value >= 0),
  tags text[] not null default '{}',
  source text not null,
  unique (snapshot_id, ticker)
);

create index if not exists position_snapshots_snapshot_idx
  on public.position_snapshots (snapshot_id);
create index if not exists position_snapshots_user_ticker_idx
  on public.position_snapshots (user_id, ticker);

-- Cached qualitative DeepSeek narration. Verified numbers never come from
-- this table: the client renders them from deterministic snapshot math and
-- uses only these digit-free words plus selected verified fact IDs.
create table if not exists public.portfolio_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  summary_key text not null,
  period_start date not null,
  period_end date not null,
  headline text not null,
  narrative text not null,
  selected_ticker_ids text[] not null default '{}',
  selected_theme_ids text[] not null default '{}',
  model text not null,
  generated_at timestamptz not null default now(),
  unique (user_id, summary_key)
);

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

-- RLS
alter table public.holdings enable row level security;
alter table public.watchlist enable row level security;
alter table public.events enable row level security;
alter table public.sync_runs enable row level security;
alter table public.snaptrade_users enable row level security;
alter table public.snaptrade_connections enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.position_snapshots enable row level security;
alter table public.portfolio_recaps enable row level security;

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

create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "position_snapshots_select_own" on public.position_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio_recaps_select_own" on public.portfolio_recaps
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.portfolio_snapshots to authenticated;
grant select on public.position_snapshots to authenticated;
grant select on public.portfolio_recaps to authenticated;

-- Phase 2 reserved (do not use in Phase 1 UI unless exit criteria met)
-- create table journal_entries (...);
-- create table event_notes (...);
