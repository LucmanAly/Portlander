# snaptrade-connect

Registers the calling user with SnapTrade (if not already) and returns a Connection Portal URL.

**Status:** implemented (`index.ts`). One real click-test caught a real bug (client
construction, see "Fixed after first real click-test" below) — fixed and redeployed (v2).
The full connect → sync happy-path against a live Fidelity account is still owner-verified,
not agent-verified.

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

## Implementation note

Uses the official `snaptrade-typescript-sdk` via Deno's `npm:` specifier (Supabase Edge Runtime
supports this directly — no esm.sh needed) rather than hand-rolling the HMAC request signing
SnapTrade's raw REST API requires. Method/parameter names (`authentication.registerSnapTradeUser`,
`authentication.loginSnapTradeUser`) were confirmed by downloading the real
`snaptrade-typescript-sdk@11.0.4` tarball and reading its `.d.ts`/`.mjs` source directly — not
guessed from docs.

### Fixed after first real click-test (v2)

The first deploy (v1) constructed the client as `new Snaptrade({ clientId, consumerKey })` —
**wrong**. The SDK requires those wrapped in an `auth` object built via its own factory:

```ts
import { Snaptrade, SnaptradeAuth } from 'npm:snaptrade-typescript-sdk@11'

const snaptrade = new Snaptrade({
  auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
})
```

Without the `auth` wrapper, `configuration.authMode` stays `undefined`, so the SDK never attaches
`clientId` or applies SnapTrade's required request signing (`PartnerSignature`/`PartnerTimestamp`)
— every call went out unsigned and SnapTrade rejected it, surfacing to the owner as a generic
"Edge Function returned a non-2xx status code". Confirmed against the SDK's real `Configuration`
class and compiled `index.mjs` (the `authMode === "commercialApiKey"` branch that gates signing).

## RLS note

`snaptrade_users` has RLS enabled with **zero** client-facing policies — only this function's
service-role client can ever read or write it. There is no path for the browser to read a
SnapTrade `userSecret` directly, by design.
