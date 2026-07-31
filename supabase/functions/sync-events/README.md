# sync-events

Finnhub → `public.events` + `public.sync_runs` (Supabase Edge Function).

**Status:** implemented (`index.ts`).

> **SPA cloud mode (magic-link / client Supabase) is deferred.**  
> This function only needs a Supabase project + service role + Finnhub key when you deploy it.  
> For day-to-day dogfooding without cloud, use the **local** path:

```bash
# Local (no Supabase)
$env:FINNHUB_API_KEY="your_key"   # PowerShell
npm run sync:events
# optional: npm run sync:events -- CRWD MSFT
# writes public/data/events-sync.json — app merges on boot / Reload
```

---

## Behavior

1. Load distinct tickers from `holdings` ∪ `watchlist` (service role, all users).
2. For each ticker, call Finnhub `GET /calendar/earnings?from&to&symbol`.
3. Upsert global event rows (`user_id = null`, deterministic UUID by `earnings|TICKER|date`).
4. Upsert approximate macro seeds (FOMC / CPI / NFP).
5. Write `sync_runs` with status `ok` | `partial` | `error`.

Window: **−7 days → +90 days**.

## Secrets

```bash
supabase secrets set FINNHUB_API_KEY=...
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are normally provided by the platform;
# set explicitly if running outside hosted Edge.
```

## Deploy

```bash
supabase functions deploy sync-events
```

## Invoke

```bash
curl -X POST "$SUPABASE_URL/functions/v1/sync-events" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

## Cron

Supabase Dashboard → **Edge Functions** → **sync-events** → **Schedules**  
Suggested: `0 6 * * *` (06:00 UTC daily).

Or `supabase/config.toml` cron if you use config-as-code.

## Client rule

Browser **never** calls Finnhub.  
- Cloud later: UI reads `events` from Postgres after this job runs.  
- Local now: UI merges `public/data/events-sync.json` produced by `npm run sync:events`.

## RLS note

Global rows use `user_id IS NULL` so the existing `events_select_visible` policy returns them to any authenticated user. Service role bypasses RLS for writes.
