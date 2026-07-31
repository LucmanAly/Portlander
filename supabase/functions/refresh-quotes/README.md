# refresh-quotes

Finnhub `/quote` → `public.holdings.last_price` + `public.sync_runs` (Supabase Edge Function).

**Status:** implemented (`index.ts`).

Manual, on-demand price refresh triggered by the "Refresh prices" control in the app shell —
**never** runs on a schedule and **never** touches `events`/earnings data. The daily earnings
sync stays entirely on `sync-events` + `pg_cron`.

---

## Behavior

1. Resolve the **calling user's** id from their JWT (`Authorization` header, verified via an
   anon-key client's `.auth.getUser()`).
2. Load that user's `holdings` tickers only — never other users' (unlike `sync-events`, which
   is deliberately global since it only writes shared macro/earnings rows).
3. For each ticker, call Finnhub `GET /quote?symbol&token`.
4. Partial `update` of `holdings.last_price` + `day_change_value` + `day_change_pct` +
   `updated_at`, scoped by `user_id` + `ticker` — never a full-row upsert, so
   `shares`/`cost_basis`/`notes`/`tags`/`weight_override_pct`/`source` are never touched. This
   is also how SnapTrade-synced holdings (`source = 'snaptrade'`) get their live price and day
   change — this function doesn't care which `source` a holding has, it refreshes every ticker
   in the user's `holdings` table the same way.
5. Write `sync_runs` with `provider = 'finnhub-quotes'` (distinct from `sync-events`'s
   `provider = 'finnhub'`), status `ok` | `partial` | `error`.

Pacing: 200ms between Finnhub calls, same margin as `sync-events`, safe under the free-tier
60/min limit for a single user's holdings list.

## Secrets

Reuses the same project secrets `sync-events` already has — nothing new to set:

```bash
FINNHUB_API_KEY
SUPABASE_URL               # platform-provided
SUPABASE_ANON_KEY          # platform-provided
SUPABASE_SERVICE_ROLE_KEY  # platform-provided
```

## Deploy

```bash
supabase functions deploy refresh-quotes
```

`verify_jwt` must be **`true`** — this function's entire security model depends on the gateway
having already validated the caller's token before the body runs (unlike `sync-events`, where
either setting is tolerable since it only writes shared data).

## Invoke

Only ever called from the signed-in SPA:

```ts
await supabase.functions.invoke('refresh-quotes', { method: 'POST' })
```

`supabase-js` attaches the current session's bearer token automatically — no manual header
wiring needed client-side.

## RLS note

Uses a service-role client (bypasses RLS) but self-imposes `user_id` scoping in code on every
query — the function, not RLS, is what prevents cross-user writes here. `sync_runs` insert/update
only works via service role by design (no insert/update RLS policy exists for it).
