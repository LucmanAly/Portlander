# sync-events

Finnhub → `public.events` + `public.sync_runs` (Supabase Edge Function).

**Status:** deployed and live (`index.ts`, v13), driven by the daily `pg_cron` job
`daily-sync-events`. Needs `FINNHUB_API_KEY` set as an Edge secret.

> **Never redeploy without diffing production first** — see `AGENTS.md`.

---

## Behavior

1. Load distinct tickers from `holdings` ∪ `watchlist` (service role, all users).
2. For each ticker, call Finnhub `GET /calendar/earnings?from&to&symbol`.
3. Upsert global event rows (`user_id = null`, deterministic UUID by `earnings|TICKER|date`).
4. Upsert macro rows (FOMC / CPI / NFP) from the static, hand-verified table in
   `../_shared/macro-calendar.ts` — real published dates only, `source = 'macro-calendar'`. No
   generator: extending the calendar means adding rows to that file from the primary source, not
   computing new ones.
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

Browser **never** calls Finnhub. The UI reads `events` from Postgres after this job runs.

## RLS note

Global rows use `user_id IS NULL` so the existing `events_select_visible` policy returns them to any authenticated user. Service role bypasses RLS for writes.
