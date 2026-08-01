# snaptrade-connect

Returns a SnapTrade Connection Portal URL for the caller to link a brokerage.

**Status:** implemented (`index.ts`), v17 — refactored to support SnapTrade **Personal API Keys**,
which is what this project actually has. The full connect → sync happy-path against a live Fidelity
account is still owner-verified, not agent-verified.

---

## The two SnapTrade customer models

SnapTrade sells two kinds of API key and they are **not interchangeable**. `SNAPTRADE_AUTH_MODE`
picks which one this function talks to; it defaults to `personal`.

| | `personal` (default) | `commercial` |
|---|---|---|
| Key source | Dashboard → **Personal API Key** | Dashboard → Commercial API Key |
| SnapTrade users | Exactly one, provisioned with the key at signup | One per Portlander user, registered by us |
| `registerSnapTradeUser` | **Rejected** — 400, code `1012` | Required on first use |
| `userId` / `userSecret` on every call | Must be **omitted** (typed `never` in the SDK) | Required |
| Request signing | `PersonalSignature` / `PersonalTimestamp` | `PartnerSignature` / `PartnerTimestamp` |
| `snaptrade_users` table | Unused | Stores each user's `userSecret` |
| Who can use it | The key owner only (see below) | Any signed-in Portlander user |

This is enforced by the SDK itself, not just by convention — verified by reading
`snaptrade-typescript-sdk@11.0.4`'s compiled source, where `/snapTrade/registerUser` declares
`authModes: ["commercialApiKey"]` and `/snapTrade/login` declares both.

### Why personal mode is gated to one user

A Personal API Key is permanently bound to the key owner's own brokerage account. There is no
per-user isolation available at all — every call made with it returns *the owner's* holdings. So the
function refuses any caller who isn't the owner, rather than quietly serving one user another's
brokerage data.

The owner is resolved as:

1. `SNAPTRADE_OWNER_USER_ID`, if set — the authoritative answer.
2. Otherwise, the project's single `auth.users` row, when there is exactly one (the normal
   single-owner install).
3. Otherwise → **error**, asking for `SNAPTRADE_OWNER_USER_ID`. With more than one user it refuses
   to guess.

So a single-owner project needs no extra configuration; adding a second Portlander user turns the
gate into an explicit, actionable error instead of a data leak.

## Behavior

1. Resolve the **calling user's** id from their JWT — same pattern as `refresh-quotes`.
2. **Personal mode:** check the caller is the owner, then call `loginSnapTradeUser` with no
   `userId`/`userSecret`. No registration step exists.
3. **Commercial mode:** check `snaptrade_users` (service-role only, RLS-locked with zero client
   policies) for an existing `userSecret`; if absent, call `registerSnapTradeUser` with
   `userId = portlander_<supabase user id>` and store the returned secret. Then call
   `loginSnapTradeUser` with both.
4. Either way the portal request passes `connectionType: 'read'` — Portlander is read-only and
   never places trades, so it doesn't ask for trading permission.
5. Return `{ redirectUrl }`. The frontend must open it immediately — it expires in ~5 minutes.

## Secrets

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
SnapTrade's raw REST API requires. Method/parameter names and per-endpoint auth modes were all
confirmed by downloading the real `snaptrade-typescript-sdk@11.0.4` tarball and reading its
`.d.ts`/`.mjs` source directly — not guessed from docs.

### Fixed in v17 — Personal vs Commercial key (400, code `1012`)

Every connect attempt failed with:

```
{"detail":"Personal SnapTrade keys are provisioned with their user automatically at signup.
  Use the OAuth bearer flow to access the API; registerUser is not available for personal keys.",
 "status_code":400,"code":"1012"}
```

The function was hardcoded to the commercial model: `SnaptradeAuth.commercialApiKey` plus a
`registerSnapTradeUser` call. The owner's key is a Personal API Key, so registration is rejected
outright and the flow never reached the Connection Portal. Fixed by adding personal mode
(`SnaptradeAuth.personalApiKey`, no registration, no `userId`/`userSecret`) and defaulting to it.

Note that the error text's "use the OAuth bearer flow" is SnapTrade's generic pointer, not a second
thing to implement — the SDK's `personalApiKey` mode already handles personal-key authentication,
signing with `PersonalSignature`/`PersonalTimestamp`.

If the credentials are ever swapped for a Commercial pair, set `SNAPTRADE_AUTH_MODE=commercial`;
the catch block detects codes `1012`/`1076` and says so in the returned error.

### Fixed after first real click-test (v2)

The first deploy (v1) constructed the client as `new Snaptrade({ clientId, consumerKey })` —
**wrong**. The SDK requires those wrapped in an `auth` object built via its own factory:

```ts
import { Snaptrade, SnaptradeAuth } from 'npm:snaptrade-typescript-sdk@11'

const snaptrade = new Snaptrade({
  auth: SnaptradeAuth.personalApiKey({ clientId, consumerKey }),
})
```

Without the `auth` wrapper, `configuration.authMode` stays `undefined`, so the SDK never attaches
`clientId` or applies SnapTrade's required request signing — every call went out unsigned and
SnapTrade rejected it, surfacing to the owner as a generic "Edge Function returned a non-2xx status
code". Confirmed against the SDK's real `Configuration` class and compiled `index.mjs`.

## RLS note

`snaptrade_users` has RLS enabled with **zero** client-facing policies — only this function's
service-role client can ever read or write it. There is no path for the browser to read a
SnapTrade `userSecret` directly, by design. In personal mode the table is unused entirely (a
personal key has no per-user secret to store).
