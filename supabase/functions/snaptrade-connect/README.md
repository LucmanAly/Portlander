# snaptrade-connect

Registers the calling user with SnapTrade (if not already) and returns a Connection Portal URL.

**Status:** implemented (`index.ts`), **not yet click-tested against a real SnapTrade account**
— that verification needs the owner's own session (see below).

---

## Behavior

1. Resolve the **calling user's** id from their JWT — same pattern as `refresh-quotes`.
2. Check `snaptrade_users` (service-role only, RLS-locked with zero client policies) for an
   existing `userSecret` for this user.
   - If absent: call SnapTrade's `registerSnapTradeUser` with `userId = portlander_<supabase user id>`
     (prefixed so it can never collide with anything else), store the returned `userSecret`.
3. Call SnapTrade's `loginSnapTradeUser` to generate a Connection Portal URL (optionally scoped
   to a `broker` slug from the request body), return `{ redirectUrl }`.
4. The frontend must open that URL immediately — it expires in ~5 minutes.

## Secrets

```bash
SNAPTRADE_CLIENT_ID
SNAPTRADE_CONSUMER_KEY
SUPABASE_URL               # platform-provided
SUPABASE_ANON_KEY          # platform-provided
SUPABASE_SERVICE_ROLE_KEY  # platform-provided
```

## Deploy

```bash
supabase functions deploy snaptrade-connect
```

`verify_jwt` must be **`true`** — same reasoning as `refresh-quotes`: this function's security
model depends on the gateway having already validated the caller's token.

## Invoke

```ts
const { data, error } = await supabase.functions.invoke('snaptrade-connect', {
  method: 'POST',
  body: { broker: 'FIDELITY' }, // optional — omit to show the brokerage picker
})
window.open(data.redirectUrl, '_blank')
```

## Implementation note — verify at deploy time

This uses the official `snaptrade-typescript-sdk` via Deno's `npm:` specifier (Supabase Edge
Runtime supports this directly — no esm.sh needed) rather than hand-rolling the HMAC request
signing SnapTrade's raw REST API requires. Method/parameter names
(`authentication.registerSnapTradeUser`, `authentication.loginSnapTradeUser`) are based on the
SDK's documented resource-grouped structure, matching the same grouping (`AccountInformation`,
`Connections`, `Authentication`) seen in SnapTrade's own docs. **This was not deployable-tested
in this session** — the first real deploy + invoke is the actual verification; if the SDK's
exact method signatures differ from what's coded here, TypeScript/runtime errors on first
invoke will point at exactly where.

## RLS note

`snaptrade_users` has RLS enabled with **zero** client-facing policies — only this function's
service-role client can ever read or write it. There is no path for the browser to read a
SnapTrade `userSecret` directly, by design.
