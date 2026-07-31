# snaptrade-sync

Pulls the calling user's live brokerage positions from SnapTrade into `public.holdings`.

**Status:** implemented (`index.ts`), fixed after `snaptrade-connect`'s first real click-test
surfaced a client-construction bug shared by both functions (see below) — v2 redeployed. Still
**not yet run against a real connected account** — needs the owner to connect a brokerage via
`snaptrade-connect` first, then click "Sync now".

---

## Behavior

1. Resolve the calling user's id from their JWT (same pattern as `refresh-quotes`).
2. Load that user's `snaptrade_users` row (service-role only); if missing, return a 400 —
   "not connected yet" is a distinct, expected state, not an error to retry blindly.
3. List brokerage authorizations, upsert each into `snaptrade_connections` (`onConflict:
   user_id,authorization_id`) — this is how the "Connected: Fidelity" UI metadata stays fresh,
   no separate write path needed.
4. List accounts, fetch positions per account, aggregate **by ticker across all accounts**
   (sum units → `shares`; cost-weighted average of `cost_basis` — SnapTrade's per-share average
   purchase price field — → our `cost_basis`).
5. Upsert into `holdings` (`onConflict: user_id,ticker`) with `source = 'snaptrade'`. The upsert
   payload deliberately omits `last_price`/`day_change_value`/`day_change_pct` — Postgres
   `ON CONFLICT DO UPDATE` only touches columns present in the payload, so those stay exactly
   whatever `refresh-quotes` last set them to. **Never deletes** — a ticker present in `holdings`
   but absent from this sync (manual/CSV entry, or an unsupported account type) is left alone.
6. Logs to `sync_runs` with `provider = 'snaptrade-positions'`.

## Known v1 gap

If a position is fully sold or a brokerage connection is removed, the corresponding `holdings`
row isn't deleted or zeroed — it just stops being touched by future syncs. Deliberately deferred:
handling it correctly needs a source-scoped diff+delete (only ever removing `source='snaptrade'`
rows, never manual/CSV ones), which adds real complexity for a case that hasn't come up yet.

## Secrets

Same four+two as `snaptrade-connect`:

```bash
SNAPTRADE_CLIENT_ID
SNAPTRADE_CONSUMER_KEY
SUPABASE_URL               # platform-provided
SUPABASE_ANON_KEY          # platform-provided
SUPABASE_SERVICE_ROLE_KEY  # platform-provided
```

## Deploy

```bash
supabase functions deploy snaptrade-sync
```

`verify_jwt` must be **`true`**.

## Invoke

```ts
await supabase.functions.invoke('snaptrade-sync', { method: 'POST' })
```

## Implementation note

Uses the official SDK via `npm:snaptrade-typescript-sdk`. All method names, request-parameter
shapes, and response field names were confirmed by downloading the real
`snaptrade-typescript-sdk@11.0.4` tarball and reading its `.d.ts`/`.mjs` source directly.

### Fixed after first real click-test (v2)

Same client-construction bug as `snaptrade-connect` (see that README) — fixed here too. Three
more real bugs were caught in the same pass, all confirmed against the real SDK types:

1. **`auth.brokerage?.displayName`** (camelCase) doesn't exist on the wire — the real field is
   `display_name` (snake_case). Fixed.
2. **`extractPosition()` read `p.average_purchase_price`** — that field doesn't exist on
   `AccountPosition` at all. The real per-share cost field is `cost_basis` (a numeric string).
   Fixed, and the ticker/name extraction was simplified: `instrument.symbol` and
   `instrument.description` are flat fields on the instrument object for stock/etf/cef/adr/
   mutualfund kinds — no nested unwrapping needed, unlike what was originally guessed.
3. **`getAllAccountPositions` does not return a plain array.** It returns
   `{ results: AccountPosition[], data_freshness }`. The code was iterating `posRes.data`
   directly — this would have silently produced zero parsed positions on every sync (caught by
   the per-account `try/catch`, not a hard failure, so it would never have surfaced as an error —
   holdings just would never have synced). Fixed to `posRes.data.results`.

`extractPosition()` still intentionally skips instrument kinds without a flat string `symbol`
(options, crypto, futures) rather than mis-parsing them — out of scope for v1.
