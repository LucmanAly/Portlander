# PROGRESS.md — Portlander live status

**Last updated:** 2026-08-01
**Last agent:** codex
**Current phase:** Phase 1.5 — SnapTrade brokerage sync (live on `main`; root cause identified: owner has a **Personal API Key**, while Portlander is implemented as a Commercial integration; owner must complete 2FA to reveal the real consumer key, then code must be refactored to owner-only Personal auth)
**Phase 1 status:** 🟢 Cloud deploy live and verified end-to-end; PR #4 merged. Only formal Phase 1 exit sign-off left. Phase 1.5 (SnapTrade): live on `main`, but the deployed functions use the wrong SnapTrade customer model. Owner confirmed the credentials come from the **Personal API Key** section. The value behind “Can’t scan? Enter key manually” is the authenticator/TOTP setup secret—not the API `consumerKey`—and likely explains the exact bad signature if it was stored in Supabase. Owner must finish 2FA to reveal the actual Personal consumer key. Then Portlander must use `SnaptradeAuth.personalApiKey`, omit user registration and `userId`/`userSecret`, and enforce owner-only access before exposing the Personal brokerage data.

> **Protocol:** Every agent must read `AGENTS.md` + this file before work, and update this file after work without being asked. See `AGENTS.md`'s "Keep PROGRESS.md lean" section — this file was rewritten 2026-07-31 to cut session-log bloat; keep it that way.

---

## Snapshot

Single source of truth for current state. If it's here, don't re-explain it elsewhere in this file.

| Area | Status | Notes |
|------|--------|-------|
| Local app (UI shell, scoring, CSV, demo) | ✅ Done | Premium dark app, Today/Calendar/Portfolio/Settings |
| Supabase project `vvstmdnnpjnfvueoecwl` | ✅ Live | Schema (`holdings`/`watchlist`/`events`/`sync_runs`/`snaptrade_users`/`snaptrade_connections`) applied. Only advisories are pre-existing/expected (see Decisions) |
| Netlify | ✅ Live | `https://portlander.netlify.app`, git-linked to `main`. `main` now includes everything through PR #5 (SnapTrade + configurable table) via PR #6 — owner spent a build minute deliberately to deploy for real testing. |
| `sync-events` Edge Function | ✅ Live | Global/unscoped (writes shared `events` rows), `verify_jwt: true`, `FINNHUB_API_KEY` set and confirmed working |
| Daily cron | ✅ Live | `pg_cron` job `daily-sync-events`, `0 11 * * *` UTC, 60s `pg_net` timeout. Owner can retune the time via `select cron.alter_job(1, schedule => '<expr>');` |
| Owner sign-in + real sync | ✅ Confirmed | Magic-link auth works (after an Auth Site URL fix), 40 real holdings imported, 34 real Finnhub earnings events confirmed live in `events` |
| `refresh-quotes` Edge Function | ✅ Live (v2) | User-scoped. Powers manual "Refresh prices" UI control. Now also persists `day_change_value`/`day_change_pct` from Finnhub's quote response (was fetched, previously discarded) |
| Calendar/Today UI fixes | ✅ Merged | PR #4 — sort toggle, full date labels, ticker-truncation bug, BMO/AMC coloring, 30-day agenda bug, all fixed and live on `develop` |
| SnapTrade integration | 🟡 Root cause identified; Personal-auth refactor pending | Owner confirmed the key is from SnapTrade's **Personal API Key** section. Current v10 functions are Commercial-only (`commercialApiKey` + `registerSnapTradeUser`), which is incompatible. The manually displayed 2FA setup key is not the API consumer key. Supabase currently has 1 auth user, 1 holdings owner, and 40 holdings, so an owner-only Personal flow is appropriate; it must still enforce owner identity to prevent future signed-in users from seeing the owner's brokerage data. |
| Portfolio table | ✅ Rebuilt | Configurable columns (show/hide + left/right reorder, persisted to `localStorage`), new Day change / Total gain/loss / % of portfolio / Source columns. CSV import still works as fallback |
| Phase 1 exit criteria | 🟡 2 of 5 met | See checklist below |

---

## Phase 1 checklist

- [x] Scaffold, UI, scoring, local data, agent docs, build passes
- [x] Cloud deploy: Netlify + Supabase schema + `sync-events` + secret + daily cron, all live
- [x] Owner signed in, real CSV imported, real Finnhub sync confirmed (34 events)
- [x] Calendar/Today UI fixes merged (PR #4 → `develop`)
- [x] Manual "Refresh prices" feature merged (PR #4 → `develop`)
- [ ] Phase 1 exit criteria formally signed off (see below)

### Phase 1 exit criteria
- [x] Real portfolio loadable
- [x] Earnings from Finnhub, not only demo offsets
- [ ] Weight ranking + exposure % sanity (math unchanged, not yet formally owner-verified)
- [ ] Snappy UI (fixes are live on `develop`, awaiting owner confirmation)
- [ ] Used on a real morning once

### SnapTrade (new scope, not in original `AGENTS.md` plan)
- [x] Owner obtained app-level `clientId` + `consumerKey`, stored as Supabase Edge secrets `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY`
- [x] `snaptrade_users` table (RLS enabled, zero client policies — lockbox for the per-user `userSecret`) + `snaptrade_connections` (client-readable metadata only)
- [x] `holdings` gained `source` (`manual`/`csv`/`snaptrade`), `day_change_value`, `day_change_pct`
- [x] `snaptrade-connect` Edge Function: registers user, returns Connection Portal URL
- [x] `snaptrade-sync` Edge Function: pulls positions, upserts `holdings` (additive — never deletes manual/CSV tickers)
- [x] Settings "Brokerage" section: connect + list connections + "Sync now"
- [x] Portfolio table: configurable columns (show/hide + left/right reorder), Day change / Total gain/loss / Source columns
- [x] Owner click-tested "Connect brokerage" repeatedly across two rounds — five real bugs found and fixed (see Decisions), including one that was hiding every other error behind a generic message. The flow now correctly reaches SnapTrade's API and shows the real rejection reason.
- [ ] **Owner: generate a fresh SnapTrade Client ID + Consumer Key pair** (together, not editing existing ones) and set both in Supabase Secrets — current pair fails SnapTrade's signature check (`401`, code `1076`), confirmed not a whitespace/formatting issue (added defensive `.trim()`, no change). Then click-test again — the connect → sync flow has still never succeeded end-to-end.
- [ ] Decide whether to handle the "position fully sold" gap (see `snaptrade-sync/README.md` "Known v1 gap") if it shows up in practice

---

## Next up (ordered)

1. **Owner:** complete SnapTrade 2FA. On one phone, use “Can’t scan?” only to copy the authenticator setup secret into Google Authenticator/Authy/1Password as a **time-based** account; then enter the generated six-digit code plus the SnapTrade account password. That setup secret is not the API consumer key and must not be pasted into Supabase. After 2FA succeeds, reveal/copy the actual **Personal API Key consumerKey** and overwrite `SNAPTRADE_CONSUMER_KEY` in Supabase. Do not share either secret in chat.
2. **Codex/code:** refactor both SnapTrade Edge Functions to owner-only Personal auth: `SnaptradeAuth.personalApiKey`, no `registerSnapTradeUser`, no `userId`/`userSecret` in SnapTrade calls, and an explicit owner-user authorization gate before returning/syncing the Personal account. Retire or leave unused the Commercial-only `snaptrade_users` path only after verifying connect → Fidelity → sync end-to-end.
3. **Owner:** click-test "Refresh prices" too, if not already done — now also confirms Day change populates.
3. **Owner (optional):** retune the `11:00 UTC` cron time to your actual timezone.
4. **Owner (still unaddressed since session 5):** check Netlify → Site configuration → Build & deploy → Deploy contexts — Deploy Previews for PRs may be consuming build minutes separately from `main` pushes.
5. Mark Phase 1 exit criteria formally once the above are confirmed.
6. If real syncs surface the "position fully sold" gap (see SnapTrade checklist above), build the source-scoped diff+delete described in `snaptrade-sync/README.md`.
7. Phase 2 (prep cards, journal, alerts) — separate from SnapTrade work, can proceed in parallel once Phase 1 is signed off.

**Open discussion, not a task yet:** Finnhub rate-limit strategy for adding PE ratio/market cap later. Verified (not memory): 60 calls/min free-tier limit, no daily cap; the earnings-calendar endpoint has a bulk mode (omit `symbol`, get all companies in one call); PE/market cap are price-derived and should refresh 2-3x/day, not weekly (corrected an earlier wrong suggestion); Netlify/Supabase costs are a non-issue at this scale — Finnhub's per-minute limit is the only real constraint. Proposed shape if built: daily bulk earnings call + a 2-3x/day PE/market-cap sync paced ~1.1s/ticker. **Owner hasn't decided whether to build this yet.**

**Advisory, not a task:** owner asked for an opinion on page architecture as the app scales into Phase 2/3. Recommendation: dedicated pages for major new concerns (journal, daily briefing, risk radar), but keep single-item detail (a prep card, notes on one holding) as inline/modal content rather than a new page per item.

---

## Blockers

- **SnapTrade Personal setup + code model mismatch.** Owner confirmed the key comes from SnapTrade's Personal API Key section. The current Commercial-only functions call `registerSnapTradeUser`, which Personal integrations must never do. Owner also has not yet completed 2FA to reveal the actual API consumer key; the “Can’t scan? Enter key manually” value is the authenticator/TOTP seed, not `SNAPTRADE_CONSUMER_KEY`, and likely produced code `1076` if stored there. **Owner action:** complete 2FA and replace the Supabase secret with the real Personal consumer key. **Code action:** implement Personal auth with an explicit owner-only gate; a Personal key always represents the owner's brokerage and cannot safely back unrestricted multi-user logins.

(Resolved blockers are deleted, not kept — see `AGENTS.md`'s lean-file protocol. Ambient MCP-connector disconnects/reconnects are not a project blocker, just expect them.)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | Dual sync paths (local script + Edge Function); deterministic event UUIDs; browser never calls Finnhub; `events-sync.json` gitignored | Local dogfood now, cloud later without rewrite; stable upserts; API keys stay server-side; generated artifact shouldn't be committed |
| 2026-07-31 | `mergeEvents` dedups stale demo/local earnings by ticker, not ticker+date | Demo seed dates are arbitrary offsets that never matched real Finnhub dates, so stale placeholders kept coexisting with real data. Ticker-level purge (Finnhub-sourced rows never purged by this path) fixed it. Known gap: doesn't handle a real earnings date getting *rescheduled* between two Finnhub syncs — would need date-aware purging of future/estimated rows if that shows up in practice. |
| 2026-07-31 | Cloud mode un-deferred; `develop` branch workflow adopted | Owner requested real deployment. Netlify's production branch is `main`; pushing to `develop` costs no build minutes (owner is on a limited plan), so PRs target `develop` and only merge to `main` when ready to actually ship. |
| 2026-07-31 | SnapTrade added as new scope (read-only Fidelity sync) | Owner's explicit request, read-only only (no trading — consistent with `AGENTS.md`'s brokerage non-goal). Not yet added to `AGENTS.md`'s locked stack — do that once actually built. |
| 2026-07-31 | Daily cron via `pg_cron`/`pg_net` (SQL), not a dashboard tab; `net.http_post` timeout raised to 60s | The "Schedules" tab this file used to reference doesn't exist in the current dashboard. Configured directly via `execute_sql`/`apply_migration`. Timeout bumped from `pg_net`'s 5s default because a real 40-ticker sync takes ~16s server-side and was logging a misleading client-side timeout even though the function completed fine. `pg_net`'s public-schema security lint is a known cosmetic issue for that extension (doesn't support `ALTER EXTENSION ... SET SCHEMA`) — left as-is. |
| 2026-07-31 | Added `refresh-quotes`, the project's first **user-scoped** Edge Function | Owner wanted a persistent, click-only "Refresh prices" control (never auto-fires on page load) for live `holdings.last_price`, fully decoupled from the daily earnings cron. Unlike `sync-events` (deliberately global — writes shared rows, safe for any authenticated caller), this does privileged per-user writes: resolves the caller's `user_id` from their JWT (anon-key client's `.auth.getUser()`), then a service-role client scoped to just that user — never iterates all users. Writes via partial `.update({last_price, updated_at})`, never a full-row upsert, so other holding fields are untouched. `verify_jwt: true` is mandatory here (tolerable either way on `sync-events`). Reuses `sync_runs` columns (`provider='finnhub-quotes'`) rather than a migration. |
| 2026-07-31 | Gated (signed-out/local-mode) UI states stay clickable-but-muted, not hard `disabled` | A true `disabled` button has no tap affordance for a `title` tooltip on mobile — muted-but-clickable keeps the explanation reachable everywhere. `disabled` is reserved for genuine in-flight state, to block double-click spam. |
| 2026-07-31 | SnapTrade owns *what you own* (shares/cost basis via `snaptrade-sync`); Finnhub owns *what it's worth* (price/day-change via `refresh-quotes`) | Owner's explicit call after discussing the split. `snaptrade-sync`'s `holdings` upsert deliberately omits `last_price`/`day_change_*` so Postgres `ON CONFLICT DO UPDATE` never touches those columns — `refresh-quotes` already refreshes every ticker in a user's `holdings` regardless of `source`, so no new price path was needed. |
| 2026-07-31 | SnapTrade sync is additive/merge, never destructive; CSV/manual entry stays as a fallback | Owner's explicit call. `snaptrade-sync` upserts by `(user_id, ticker)` and marks matched rows `source='snaptrade'` (authoritative going forward for that ticker), but never deletes — a manual/CSV ticker the brokerage doesn't cover is left untouched indefinitely. Known gap this creates: a fully-sold `snaptrade` position isn't cleaned up either (see `snaptrade-sync/README.md`) — deferred until it shows up in practice, since fixing it correctly needs a `source`-scoped diff+delete, not a blanket one. |
| 2026-07-31 | `snaptrade_users` (holds the SnapTrade `userSecret`) has RLS enabled with **zero** policies for `authenticated`/`anon` | Standard Postgres "lockbox" pattern — RLS enabled + no permissive policy means only the service-role key (used exclusively inside `snaptrade-connect`/`snaptrade-sync`) can ever touch it. Confirmed via `get_advisors`: shows up as the expected `rls_enabled_no_policy` INFO-level lint, not a real finding. `snaptrade_connections` (display metadata, no secrets) has a normal `select`-own policy instead, since the client needs to read it for the "Connected: Fidelity" UI. |
| 2026-07-31 | `snaptrade-connect`/`snaptrade-sync` use the official `snaptrade-typescript-sdk` via Deno's `npm:` specifier, not hand-rolled HMAC request signing | Confirmed working: the import resolves on the hosted Edge Runtime and (as of v2) the client construction and every method/field access have been verified directly against the real `snaptrade-typescript-sdk@11.0.4` source (`.d.ts`/`.mjs`, downloaded from the npm registry tarball and read line-by-line — not docs, not guesses). |
| 2026-07-31 | First real "Connect brokerage" click hit a 500 — root cause: `new Snaptrade({clientId, consumerKey})` is wrong; the SDK requires `new Snaptrade({auth: SnaptradeAuth.commercialApiKey({clientId, consumerKey})})` | Without the `auth` wrapper, `configuration.authMode` stays `undefined`, so the SDK never attaches `clientId` or applies SnapTrade's required request signing — every call went out unsigned and got rejected, surfacing as a generic non-2xx error with no useful detail (the function never `console.error`'d, so Supabase logs only showed the HTTP status). Found by downloading the SDK's real compiled source rather than re-guessing; same fix applied to both Edge Functions since both had the identical bug. Three more real bugs caught in the same verification pass, all in `snaptrade-sync`: `auth.brokerage?.displayName` should be `display_name` (snake_case wire field); `extractPosition()` read a nonexistent `average_purchase_price` field instead of the real `cost_basis`; `getAllAccountPositions` returns `{results: AccountPosition[], data_freshness}`, not a plain array — the code was iterating the wrapper object directly, which would have silently synced zero positions on every run. All four fixed, v2 of both functions redeployed. |
| 2026-07-31 | Added `--color-positive` design token (green, alongside existing `--color-critical` red) | Gain/loss coloring in the new Portfolio table columns needed a semantic positive color distinct from `--color-dividend` (also green, but means something different — a scheduled payout, not a market gain). Tailwind v4 auto-generates `text-positive`/`bg-positive-soft` utilities from the `--color-*` custom property, same mechanism already powering `text-critical`. |
| 2026-08-01 | Established "surface real errors in the client, not the logs" as the debugging pattern for Edge Functions | The Supabase `get_logs` MCP tool was checked repeatedly (4+ times across two sessions) and **only ever returns the HTTP boundary line** (`METHOD \| STATUS \| url`) — `console.error()` output is never retrievable through it, a dead end confirmed conclusively. Meanwhile `src/lib/snaptradeRepository.ts` was found to be discarding the real error entirely: supabase-js's `FunctionsHttpError.message` is always the generic "Edge Function returned a non-2xx status code"; the actual JSON body our functions return lives unread on `error.context` (a `Response`). Added `describeFunctionError()` to parse it — this single fix is what let every subsequent real error (missing secrets, then SnapTrade's actual 401 body) become visible at all. Also added `.responseBody` extraction in both functions' catch blocks (SnaptradeError's real rejection detail, which axios's generic `e.message` never includes) and appended it to the client-visible error string. **Pattern for next time an Edge Function error is opaque: make the function return the detail in its JSON body, and make sure the calling client actually reads that body — don't rely on `get_logs`.** |
| 2026-08-01 | Confirmed Personal API Key and selected an owner-only Personal integration | Owner identified the SnapTrade Dashboard section as **Personal API Key**. The current Commercial registration flow is therefore wrong. The 2FA “manual key” is a TOTP seed, not the API consumer key. Supabase currently has one auth user/holdings owner, so Personal mode fits Portlander today, but the Edge Functions must explicitly authorize that owner because a Personal key maps every API call to the same brokerage account. |

---

## Session log

Keep entries short — a few bullets, key files, pointer to the PR/commit for full detail. Don't re-narrate git history here.

### 2026-08-01 — codex (session 11)
- Owner confirmed the credentials come from SnapTrade's **Personal API Key** section, resolving the remaining authentication-mode fork.
- Identified the likely immediate signature cause: the “Can’t scan? Enter key manually” value in 2FA setup is the authenticator/TOTP seed, not the SnapTrade API consumer key.
- SnapTrade requires completing 2FA before revealing/copying the actual Personal consumer key.
- Supabase read-only check: 1 auth user, 1 holdings owner, 40 holdings; owner-only Personal mode fits current use.
- Security requirement for the refactor: explicitly gate both Edge Functions to the owner user, since a Personal key represents one brokerage identity regardless of which app user invokes it.
- No application code or Edge Function deployment changed in this session; waiting for explicit implementation request and owner completion of 2FA.

### 2026-08-01 — codex (session 10)
- Reopened SnapTrade code 1076 from first principles across GitHub, deployed Supabase v10 functions/logs/database state, SnapTrade's current docs, and the actual SDK v11.0.4 source.
- Confirmed failure occurs on the first `registerSnapTradeUser` call: 0 SnapTrade users/connections/holdings exist; Fidelity and the Connection Portal are never reached.
- Ruled out Supabase health/auth, rate limit, stale deployment, missing signing, and a hand-rolled HMAC path.
- Corrected the earlier over-narrow diagnosis: the remaining fork is **Personal key used in Commercial-only code** versus an **invalid/stale/mismatched Commercial key pair**.
- No application code or Edge Function deployment changed. Next discriminator is the non-secret Personal vs Commercial/Test label on the SnapTrade API Key page.
- Key evidence: request ID `5c7770169c3395b12137f3e820fd579d`; official SnapTrade FAQ/authentication docs; deployed `snaptrade-connect` v10; npm SDK v11.0.4 source.

### 2026-08-01 — claude-code (session 9)
- Owner retested "Connect brokerage" after session 8's fix — still failed with the same generic non-2xx message. Root-caused a real client-side bug: `src/lib/snaptradeRepository.ts` only read supabase-js's generic `FunctionsHttpError.message`, never the actual JSON error body our functions return (`error.context`, unread until now). Fixed via `describeFunctionError()` — this was the real blocker on ever seeing any of the following errors. Frontend change, so it needed `develop` → `main` (PR #8) to reach Netlify, unlike the backend-only fixes below.
- With real errors now visible: found "Missing secrets" (owner hadn't set `SNAPTRADE_CLIENT_ID`/`CONSUMER_KEY` on this Supabase project despite an earlier session's note that they had) → made the error name the exact missing var instead of listing all 5 (PR #9) → owner set the secrets → got a real `401` from SnapTrade's API with only headers, no body → added `.responseBody` surfacing from the SDK's `SnaptradeError` (PR #10) → real reason revealed: `{"detail":"Unable to verify signature sent","code":"1076"}` → added defensive `.trim()` on all 5 secret reads in case of copy-paste whitespace (PR #11) → still fails identically.
- Conclusion: the `SNAPTRADE_CLIENT_ID`/`SNAPTRADE_CONSUMER_KEY` pair itself is invalid/mismatched on SnapTrade's side (not a formatting issue, not an SDK-usage bug — both already ruled out). This needs the owner to generate a fresh pair in the SnapTrade dashboard; no further code fix is possible from here. See Blockers.
- Also confirmed conclusively (checked the `get_logs` MCP tool 4+ times across this and the prior session) that it never surfaces `console.error` output, only HTTP boundary lines — recorded as a Decisions row so future sessions don't waste time on it again.
- Owner brought a second AI's (ChatGPT) suggestions about hand-rolled HMAC signing (query-string order, timestamp units, manual `encodeURI`); confirmed these don't apply since we use the official `snaptrade-typescript-sdk`, not a manual implementation — noted to the owner to avoid a dead-end detour.
- Backend-only fixes (PRs #9, #10, #11) deployed straight to the live Supabase project independently of git, each also merged to `develop` to keep git in sync — none needed `main`/Netlify.
- Key files: `supabase/functions/{snaptrade-connect,snaptrade-sync}/index.ts`, `src/lib/snaptradeRepository.ts`. PRs #7–#11 (all merged).

### 2026-07-31 — claude-code (session 8)
- Merged PR #5 → `develop`, then opened and merged `develop` → `main` (PR #6) at the owner's request — `main`/the live Netlify app now has the full SnapTrade + configurable-table build.
- Owner's first real "Connect brokerage" click hit `Edge Function returned a non-2xx status code`. Diagnosed by downloading the actual `snaptrade-typescript-sdk@11.0.4` tarball from the npm registry and reading its real `.d.ts`/`.mjs` source (couldn't invoke the function as the real user, and Supabase logs only carried the HTTP status, no body). Found the real root cause (client construction — see Decisions) plus three more latent bugs in `snaptrade-sync` in the same pass, all confirmed against real SDK types rather than guessed. Fixed all four, redeployed both functions as v2.
- Also asked a general question about which LLM to use for a future data-analytics feature (ranked 10 models on quality/value/value-per-dollar) — discussion only, no code, not part of the SnapTrade work.
- **Still unverified:** the connect → sync flow has never actually succeeded end-to-end — this was the first real attempt and it hit the bug now fixed. Owner needs to try again.
- Key files: `supabase/functions/{snaptrade-connect,snaptrade-sync}/{index.ts,README.md}`.

### 2026-07-31 — claude-code (session 7)
- Confirmed PR #4 had merged (fixed session 6's open item) and rebuilt this session's branch from `origin/develop` instead of stale `main`.
- Discussed architecture with the owner before writing code (SnapTrade rate limit is 250/min shared, non-issue at this scale; Finnhub vs SnapTrade split; CSV-as-fallback; left/right column reorder) — see Decisions for the calls made.
- Built the full SnapTrade integration end-to-end: schema (`holdings.source`/`day_change_*`, `snaptrade_users` lockbox, `snaptrade_connections`), two new Edge Functions (`snaptrade-connect`, `snaptrade-sync`), extended `refresh-quotes` to persist day-change, Settings "Brokerage" section, `snaptradeRepository.ts`, `PortfolioContext` wiring.
- Rebuilt the Portfolio table as a configurable component (`PortfolioTable.tsx`, `portfolioColumns.ts`, `tablePrefs.ts`) — show/hide + left/right reorder, persisted to `localStorage`; added Day change / Total gain/loss / Source columns (`scoring.ts`: `holdingDayChange`/`holdingTotalGainLoss`/`holdingTotalGainLossPct`).
- Verified: `npm run build`/`lint` clean, all three Edge Functions deployed (`ACTIVE` status), `get_advisors` shows only expected/pre-existing findings, and a full Playwright pass (dev server + global `playwright` package, `chromium-cli` wasn't available) — screenshots confirm the table renders correctly with real demo gain/loss numbers, column customize show/hide + reorder works and persists across reload, and Settings correctly shows zero SnapTrade network calls in signed-out/local mode (the one "snaptrade" URL that fired was Vite serving the local `.ts` module file, not an API call — false positive, double-checked).
- **Could not verify:** the actual authenticated SnapTrade connect → sync happy-path (no real user session in the sandbox). See Next up #1 and each new function's README "verify at deploy time" note for what to check if it errors.
- Key files: `supabase/schema.sql`, `supabase/functions/{snaptrade-connect,snaptrade-sync,refresh-quotes}/`, `src/lib/{snaptradeRepository,portfolioColumns,tablePrefs,scoring,mappers,portfolioRepository,csv}.ts`, `src/context/PortfolioContext.tsx`, `src/pages/{Settings,Portfolio}Page.tsx`, `src/components/portfolio/PortfolioTable.tsx`, `src/types/{index,database}.ts`, `src/index.css`, `src/data/demo.ts`.

### 2026-07-31 — claude-code (session 6)
- Resolved the daily cron (`pg_cron`/`pg_net`), confirmed `FINNHUB_API_KEY` works, fixed a Supabase Auth Site URL misconfig blocking magic-link sign-in, and confirmed a real end-to-end sync (34 real Finnhub events). All infra-only, no `src/` changes — see Decisions for specifics.
- Fixed four owner-reported UI issues (Today sort toggle, full date labels, a real calendar-ticker-truncation CSS bug, BMO/AMC coloring, a real 30-day-agenda bug that was silently capping at ~14 days) and built a new manual "Refresh prices" feature (first user-scoped Edge Function — see Decisions). Verified via `npm run build`/`lint`, Playwright screenshots + computed-style checks, and a live post-deploy auth-boundary test. Key files: `src/pages/{Today,Calendar}Page.tsx`, `src/components/calendar/MonthCalendar.tsx`, `src/lib/{format,scoring}.ts`, `src/context/PortfolioContext.tsx`, `src/lib/portfolioRepository.ts`, `src/components/layout/{AppShell,RefreshQuotesButton}.tsx`, `supabase/functions/refresh-quotes/`.
- Researched (verified against Finnhub's docs, not memory) rate-limit/bulk-call strategy for future PE/market-cap metrics — discussion only, not built. See Next up.
- Discovered PR #3 was merged early and only carried one of five commits; opened **PR #4** for the rest. All stale PR #3 references in this file corrected.
- Owner obtained SnapTrade `clientId`/`consumerKey` and pasted them in chat; talked through where they go and what building the integration needs (verified against SnapTrade's docs), but didn't store or build anything — owner action first.
- Owner asked for a session handoff to paste into a new session — provided in chat, and this file was rewritten to cut accumulated bloat (see `AGENTS.md`'s lean-file protocol, added this session).

### 2026-07-31 — claude-code (session 5)
- Netlify connected via Git-linked continuous deployment, confirmed live. Established the `develop`-branch build-minute-conservation workflow (see Decisions).
- Applied schema + deployed `sync-events` to a previously-empty Supabase project via the Supabase MCP connector. Caught and fixed a real mistake: first deploy had `verify_jwt: false`, which would have let anyone burn Finnhub quota — redeployed correctly.
- Couldn't set secrets or cron (no MCP tool exposes either) — left for session 6, along with a stale "Schedules" tab reference in the function README that turned out not to exist.
- Clarified SnapTrade scope: owner wants read-only live Fidelity holdings, needs the app's own SnapTrade dev registration (distinct from a personal chat-scoped connector that happened to be available). Owner got one of two keys this session.

### 2026-07-31 — claude-code (session 4)
- Bug: earnings dates shown for some tickers were wrong after a real sync. Root cause + fix: see the `mergeEvents` Decisions row above. Files: `src/lib/eventSync.ts`. Verified via build/lint + a standalone before/after repro.

### 2026-03-25 — grok-build (sessions 1-3)
- Session 1: Phase 1 scaffold, UI, local demo data.
- Session 2: Supabase client + repository + magic-link Settings (cloud made optional/deferred).
- Session 3: `sync-events` Edge Function, local `scripts/sync-events.mjs`, `eventSync.ts` merge logic, docs.

---

## Notes for the next agent

1. **Cloud mode is fully live and verified end-to-end.** Nothing left to set up infra-wise — remaining Phase 1 work is UI polish + formal sign-off.
2. **Never trust a PR number in this file without checking.** PR #3 got merged early mid-session and only carried one of five commits. Use `list_pull_requests`/`pull_request_read` before assuming what's merged.
3. **No tool on the Supabase MCP surface exposes secrets management or Auth URL config** — confirmed repeatedly across sessions. Any new secret always needs the owner to paste it into the dashboard themselves.
4. **`sync-events` is deliberately global/unscoped** (writes shared rows, safe for any caller). **`refresh-quotes` is user-scoped** (privileged per-user writes). Don't copy the wrong pattern when adding a new Edge Function — check which shape the new function actually needs.
5. **SnapTrade is fully built and live on `main`**, on v10 of both Edge Functions after two rounds of owner click-tests found and fixed five real bugs (see Decisions) — but **the connect→sync flow has still never succeeded end-to-end**, don't assume it works until the owner confirms a real sync. Currently **blocked on the owner** regenerating their SnapTrade Client ID + Consumer Key pair (see Blockers) — check whether that's happened before doing anything else here. If a *new* error shows up after that, don't re-guess at SDK usage from docs — download the real tarball from the npm registry (`curl https://registry.npmjs.org/snaptrade-typescript-sdk/latest` for the version, then the tarball URL from that response) and grep the `.d.ts`/`.mjs` directly, the way the original bugs were actually found. That was dramatically more reliable than reasoning from documentation or MCP tool names.
5a. **The Supabase `get_logs` MCP tool cannot read `console.error` output — confirmed dead, don't retry it.** It only ever returns the HTTP boundary line (`METHOD | STATUS | url`). If an Edge Function error is opaque, make the function return the detail directly in its JSON response body instead, and verify the calling client code actually reads that body (check `describeFunctionError()` in `src/lib/snaptradeRepository.ts` for the working pattern — supabase-js's `FunctionsHttpError.message` is always generic; the real body is on `error.context`, a `Response` object, unread by default).
6. If a Supabase/Netlify/SnapTrade MCP connector is available, prefer it over asking the owner to click through a dashboard for anything it can do — they reconnect with new internal tool IDs frequently in this project, check via ToolSearch rather than assuming unavailability.
7. **Keep this file lean** — see `AGENTS.md`'s protocol section. Short session-log entries, delete resolved blockers, edit Decisions rows in place rather than layering corrections on top.
8. No `chromium-cli` in this environment as of session 7 — for Playwright verification, `playwright` is installed globally at `/opt/node22/lib/node_modules/playwright`, and the Chromium binary is at `/opt/pw-browsers/chromium` (a symlink straight to the `chrome` executable, not a directory — pass it directly as `executablePath`).
