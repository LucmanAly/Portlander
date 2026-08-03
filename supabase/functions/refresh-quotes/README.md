# refresh-quotes

Finnhub `/quote` → live holdings prices + one position-level performance snapshot per market date.

**Status:** implemented (`index.ts`).

Manual refresh remains available in the app shell. A single-owner deployment can also call this
same function after market close through Supabase Cron. It never touches `events`/earnings data;
the earnings sync stays on `sync-events`.

---

## Behavior

1. Resolve the **calling user's** id from their JWT (`Authorization` header, verified via an
   anon-key client's `.auth.getUser()`).
2. Load that user's `holdings` tickers/shares/tags only — never other users' (unlike `sync-events`, which
   is deliberately global since it only writes shared macro/earnings rows).
3. For each ticker, call Finnhub `GET /quote?symbol&token`.
4. Partial `update` of `holdings.last_price` + `day_change_value` + `day_change_pct` +
   `updated_at`, scoped by `user_id` + `ticker` — never a full-row upsert, so
   `shares`/`cost_basis`/`notes`/`tags`/`weight_override_pct`/`source` are never touched. This
   is also how SnapTrade-synced holdings (`source = 'snaptrade'`) get their live price and day
   change — this function doesn't care which `source` a holding has, it refreshes every ticker
   in the user's `holdings` table the same way.
5. Use Finnhub's quote timestamp to identify the real New York market date, then replace that
   date's `portfolio_snapshots` rows only when all positions have price/previous-close evidence.
   A later partial refresh never destroys an earlier complete snapshot.
6. Write `sync_runs` with `provider = 'finnhub-quotes'` (distinct from `sync-events`'s
   `provider = 'finnhub'`), status `ok` | `partial` | `error`.

Pacing: 200ms between Finnhub calls, same margin as `sync-events`, safe under the free-tier
60/min limit for a single user's holdings list.

## Secrets

Manual invocation reuses the existing secrets. Scheduled single-owner capture adds two:

```bash
FINNHUB_API_KEY
SUPABASE_URL               # platform-provided
SUPABASE_ANON_KEY          # platform-provided
SUPABASE_SERVICE_ROLE_KEY  # platform-provided
PERFORMANCE_OWNER_USER_ID  # the one Portlander auth user whose book may be captured by cron
PERFORMANCE_CRON_SECRET    # long random value also supplied by the cron request header
```

## Deploy

```bash
supabase functions deploy refresh-quotes
```

`verify_jwt` must be **`true`** — this function's entire security model depends on the gateway
having already validated the caller's token before the body runs (unlike `sync-events`, where
either setting is tolerable since it only writes shared data).

## Invoke

Manual calls come from the signed-in SPA:

```ts
await supabase.functions.invoke('refresh-quotes', { method: 'POST' })
```

`supabase-js` attaches the current session's bearer token automatically — no manual header
wiring needed client-side.

## Automatic after-close capture

Schedule the Edge Function for **4:15 p.m. America/New_York, Monday–Friday**, using the same
two-UTC-slot plus Eastern-time guard pattern as `daily-sync-events` so daylight-saving changes do
not create duplicate runs. The request must include:

- `Authorization: Bearer <project anon key>` so the `verify_jwt: true` gateway accepts it.
- `x-performance-cron-secret: <PERFORMANCE_CRON_SECRET>`.

The function ignores any user id in the request and uses only `PERFORMANCE_OWNER_USER_ID`. This is
appropriate for Portlander's current personal deployment. A future commercial/multi-user product
needs a queue/fan-out design with per-user rate budgeting; do not reuse this owner-only cron path.

## RLS note

Uses a service-role client (bypasses RLS) but self-imposes `user_id` scoping in code on every
query — the function, not RLS, is what prevents cross-user writes here. `sync_runs` insert/update
only works via service role by design (no insert/update RLS policy exists for it).
