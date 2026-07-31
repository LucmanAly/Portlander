# snaptrade-sync

Pulls the calling user's live brokerage positions from SnapTrade into `public.holdings`.

**Status:** implemented (`index.ts`), **not yet run against a real connected account** — needs
the owner to connect a brokerage via `snaptrade-connect` first, then click "Sync now".

---

## Behavior

1. Resolve the calling user's id from their JWT (same pattern as `refresh-quotes`).
2. Load that user's `snaptrade_users` row (service-role only); if missing, return a 400 —
   "not connected yet" is a distinct, expected state, not an error to retry blindly.
3. List brokerage authorizations, upsert each into `snaptrade_connections` (`onConflict:
   user_id,authorization_id`) — this is how the "Connected: Fidelity" UI metadata stays fresh,
   no separate write path needed.
4. List accounts, fetch positions per account, aggregate **by ticker across all accounts**
   (sum units → `shares`; cost-weighted average of `average_purchase_price` → `cost_basis`).
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

## Implementation note — verify at deploy time

Same caveat as `snaptrade-connect`: uses the official SDK via `npm:snaptrade-typescript-sdk`,
method names (`connections.listBrokerageAuthorizations`, `accountInformation.listUserAccounts`,
`accountInformation.getAllAccountPositions`) matched against the resource-grouped structure
observed directly from a SnapTrade MCP connector available earlier in this project's session
history, not just documentation. The position-field extraction (`extractPosition` in `index.ts`)
is written defensively against a couple of known possible field shapes, since SnapTrade's
position schema varies by instrument kind — if a real sync doesn't populate holdings correctly,
start there.
