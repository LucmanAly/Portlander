# snaptrade-sync

Pulls the calling user's live brokerage positions from SnapTrade into `public.holdings`.

**Status:** implemented (`index.ts`), v17 — refactored alongside `snaptrade-connect` to support
SnapTrade **Personal API Keys**, which is what this project actually has. Still **not yet run
against a real connected account** — needs the owner to connect a brokerage via
`snaptrade-connect` first, then click "Sync now".

---

## Auth modes

Mirrors `snaptrade-connect` exactly — `SNAPTRADE_AUTH_MODE` selects `personal` (default) or
`commercial`, and personal mode is gated to the single key owner. See that function's README for
the full comparison table and the reason for the gate; the short version is that a Personal API Key
is bound to one brokerage account (the key owner's) and every call must omit `userId`/`userSecret`.

## Behavior

1. Resolve the calling user's id from their JWT (same pattern as `refresh-quotes`).
2. **Personal mode:** check the caller is the owner; there is no `snaptrade_users` row to load and
   no `userSecret` — the key itself identifies the account.
   **Commercial mode:** load that user's `snaptrade_users` row (service-role only); if missing,
   return a 400 — "not connected yet" is a distinct, expected state, not an error to retry blindly.
3. List brokerage authorizations, upsert each into `snaptrade_connections` (`onConflict:
   user_id,authorization_id`) — this is how the "Connected: Fidelity" UI metadata stays fresh,
   no separate write path needed.
4. List accounts, fetch positions per account, aggregate **by ticker across all accounts**
   (sum units → `shares`; cost-weighted average of `cost_basis` — SnapTrade's per-share average
   purchase price field — → our `cost_basis`).
5. Upsert into `holdings` (`onConflict: user_id,ticker`) with `source = 'snaptrade'`. The upsert
   payload deliberately omits `last_price`/`day_change_value`/`day_change_pct` — Postgres
   `ON CONFLICT DO UPDATE` only touches columns present in the payload, so those stay exactly
   whatever `refresh-quotes` last set them to. A ticker present in `holdings` but absent from this
   sync because it's a manual/CSV entry, or an unsupported account type, is left alone.
6. Reconcile sold-off positions: any existing `source = 'snaptrade'` row for this user whose ticker
   isn't in this run's aggregated positions gets deleted — a `seenTickers` diff scoped strictly to
   `source = 'snaptrade'`, never touching manual/CSV rows. Skipped entirely if this run returned
   zero positions or hit an error on any account, since either means the position list can't be
   trusted as complete.
7. Logs to `sync_runs` with `provider = 'snaptrade-positions'`.

## Secrets

Same as `snaptrade-connect`:

```bash
SNAPTRADE_CLIENT_ID
SNAPTRADE_CONSUMER_KEY
SNAPTRADE_AUTH_MODE        # optional — 'personal' (default) | 'commercial'
SNAPTRADE_OWNER_USER_ID    # optional — personal mode, only once >1 auth user exists
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

### Fixed in v17 — Personal vs Commercial key

Same root cause as `snaptrade-connect` (see that README): the function was hardcoded to the
commercial model, sending `userId`/`userSecret` on every read. A personal key rejects those — the
SDK types them `never` — so no sync could ever have succeeded even once connect was fixed. The
three reads this function needs (`listBrokerageAuthorizations`, `listUserAccounts`,
`getAllAccountPositions`) now go through a small `SnaptradeReader` interface built per mode, which
keeps the credential difference in one place instead of threading it through the sync loop.

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
