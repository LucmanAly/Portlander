# PROGRESS.md — Portlander live status

**Last updated:** 2026-08-01
**Last agent:** claude (session 19)
**Current phase:** Phase 2 planning — Phase 1 `v1.0` formally signed off 2026-08-01. Phase 2/3 scope redefined the same day around earnings intelligence (see Decisions): Phase 2 "Signal" (structured earnings expectations/actuals, PEG, thesis capture, watchlist-on-calendar, week view — no AI) and Phase 3 "Intelligence" (thesis drift, morning briefing, "what moved it," guidance summaries — DeepSeek). Build order in `docs/PLAN-PHASE-2.md`; AI architecture/data-boundary rules in `docs/AI.md`. No Phase 2 code has been written yet.

> **Protocol:** Read `AGENTS.md` + this file before work; update this file after work without being asked. Trimmed 2026-08-01 (225 → 112 lines) after session-log bloat crept back in — old debugging narrative for *resolved* issues was cut in favor of the Decisions table (the "why," kept) over the session-by-session "what we tried" (cut). Keep new entries short.

---

## Snapshot

Single source of truth for current state. If it's here, don't re-explain it elsewhere in this file.

| Area | Status | Notes |
|------|--------|-------|
| Local app (UI shell, scoring, CSV, demo) | ✅ Done | Premium dark app, Today/Calendar/Portfolio/Settings; boot skeletons prevent demo-data flash and Local/Demo state is explicit on desktop + mobile |
| Settings diagnostics + release metadata | ✅ Done on `main` (`v1.0`) | Central Diagnostics card surfaces backend/auth/positions/prices/events issues; About this build shows version, phase and last-updated metadata |
| Supabase project `vvstmdnnpjnfvueoecwl` | ✅ Live | Schema (`holdings`/`watchlist`/`events`/`sync_runs`/`snaptrade_users`/`snaptrade_connections`) applied. Only advisories are pre-existing/expected (see Decisions) |
| Netlify | ✅ Live | `https://portlander.netlify.app`, git-linked to `main` |
| `sync-events` Edge Function | ✅ Live (v14) | Global/unscoped, `verify_jwt: true`. Macro rows (FOMC/CPI/NFP) come from the static, hand-verified `supabase/functions/_shared/macro-calendar.ts` — no more heuristic generation |
| Daily cron | ✅ Live | `daily-sync-events` targets **9:31 a.m. America/New_York year-round**: `31 13,14 * * *` UTC plus an Eastern-time guard, so exactly one EDT/EST slot executes |
| `refresh-quotes` Edge Function | ✅ Live (v2) | User-scoped, manual "Refresh prices" control. Persists `day_change_value`/`day_change_pct` |
| `snaptrade-sync` / `snaptrade-connect` | ✅ Live (v18 / v17) | Personal-auth mode by default (`SNAPTRADE_AUTH_MODE`). Reconciles sold positions (`seenTickers` diff+delete). Owner completed a real "Connect brokerage" → Fidelity → sync end-to-end |
| Portfolio table + CSV | ✅ Rebuilt | Table-first opening view with total value + whole-book daily gain/loss, management controls below the table, drag-and-drop desktop column ordering, per-row writes (PR 5), CSV Merge/Replace picker, `~` estimated-value marker, search/sort/source filter + mobile compact cards |
| Impact score | ✅ Recalibrated (PR 6) | Portfolio-relative anchor (`max(5, p90weight × 1.5)`) replaced the fixed `/20` clamp; High/Med/Low tiers; `EventCard` leads with weight, not the score |
| Calendar | ✅ Weight-aware (PR 7) | `MonthCalendar` dot size now tracks position weight; agenda dates go through `formatEventDay` |
| Phase 1 exit criteria | ✅ 5 of 5 met — signed off 2026-08-01 | See checklist below |

---

## Phase 1 checklist

- [x] Scaffold, cloud deploy (Netlify + Supabase + `sync-events` + cron), owner signed in with a real synced book
- [x] Calendar/Today UI fixes + manual "Refresh prices" (PR #4 → `develop`)
- [x] Phase 1 exit criteria formally signed off (owner confirmation, 2026-08-01):
  - [x] Real portfolio loadable; earnings from Finnhub, not demo offsets
  - [x] Weight ranking + exposure % sanity confirmed on the real book
  - [x] Snappy UI confirmed on the live `main` build
  - [x] Used on a real morning once

### SnapTrade (new scope, not in original AGENTS.md plan)
- [x] Schema (`snaptrade_users` lockbox, `snaptrade_connections`, `holdings.source`/`day_change_*`), both Edge Functions, Settings "Brokerage" UI
- [x] Personal-vs-Commercial auth root cause found and fixed (`SNAPTRADE_AUTH_MODE`, defaults to `personal`) — see Decisions
- [x] "Position fully sold" gap fixed (v18) — reconciliation exercised against a real sell after the owner completed a real "Connect brokerage" → Fidelity → sync end-to-end

---

## Next up (ordered)

1. **Phase 2 step 1** (`docs/PLAN-PHASE-2.md`): surface Finnhub's already-fetched EPS/revenue estimates + actuals as structured fields on `events`/`PortfolioEvent`, compute beat/miss % locally, show on `EventCard`. No new API call — smallest, most-unblocked next PR.
2. **Phase 2 step 2**: PEG snapshot per holding — new Finnhub PE + growth call (`/stock/metric`, not yet integrated; Finnhub free tier verified at 60 calls/min, no daily cap, so rate limit isn't a blocker for ~40 tickers).
3. **Phase 2 steps 3–4**: thesis field on `Holding`; watchlist-on-calendar + week view polish.
4. Follow AGENTS.md's normal workflow for each (branch off `develop`, PR into `develop`, promote to `main` when ready to ship).
5. **Owner (still open since session 5):** check Netlify → Deploy contexts — Deploy Previews for PRs may burn build minutes separately from `main` pushes.

Phase 3 (AI features — thesis drift, morning briefing, "what moved it," guidance summaries) is scoped in `docs/AI.md` but gated behind Phase 2 shipping — don't start it early.

---

## Blockers

None outstanding.

(Resolved blockers are deleted, not kept. Ambient MCP-connector disconnects/reconnects are not a project blocker.)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-01 | Phase 2/3 redefined around earnings intelligence ("Signal"/"Intelligence"), replacing the original generic "Ritual" scope | Owner + Fable 5 design discussion: prep cards/journal/tags/alerts were generic productivity features written before the app existed. New Phase 2 = structured earnings expectations/actuals, beat/miss, PEG, thesis capture, watchlist-on-calendar, week view (all non-AI, mostly unlocking data already fetched). New Phase 3 = thesis drift detection, morning briefing, "what moved it" notes, guidance summaries (all AI, gated behind Phase 2). Old Phase 2 items tags/generic-journal/T-7-T-1-email/cluster-strip/command-palette are dropped; watchlist-on-calendar/week-view kept. Full detail: `AGENTS.md`, `docs/PLAN-PHASE-2.md`, `docs/AI.md` |
| 2026-08-01 | AI provider: DeepSeek (PRC-hosted), resurrecting the deferred `docs/AI.md` plan; position-data boundary loosened for exactly one feature | Owner explicitly accepted sending `ticker + weight% + event dates` (never dollar/share data) to DeepSeek for the morning-briefing feature only; every other AI feature keeps the original strict no-position-data rule. Guidance summaries and "what moved it" notes use web-search LLM calls instead of a paid Finnhub transcript tier |
| 2026-08-01 | Phase 1 exit criteria marked formally met; Phase 2 planning opened | Owner directly confirmed all four remaining criteria (real-book weight/exposure sanity, snappy UI on live `main`, one real morning of use, completed brokerage connect→sync) rather than a fresh in-app click-through session. Per AGENTS.md/ROADMAP.md, Phase 2 work may now begin; `docs/PLAN-PHASE-2.md` holds sequencing options, none chosen yet |
| 2026-08-01 | Portfolio opens on the book, not its management controls | Holdings/table plus total value and a complete-refresh daily gain/loss summary come first; import/export/add/search/filter/sort controls remain below the table, and desktop column ordering uses drag-and-drop instead of arrow buttons |
| 2026-08-01 | Phase 1 v1.0 promoted to `main` | PR #25 merged `develop` into `main` after CI run #24 passed build, lint, and test; the production-only SnapTrade error-detail commits already on `main` were preserved |
| 2026-08-01 | Settings owns diagnostics and release metadata | Settings now has one Diagnostics card for backend/auth/positions/prices/events errors and retries, plus About this build. Version policy lives in AGENTS.md and `src/lib/appMeta.ts`; Phase 1 candidate is `v1.0`. |
| 2026-08-01 | Daily sync moved to 9:31 a.m. `America/New_York`, DST-safe | Supabase's pg_cron scheduler stays on GMT. The single job wakes at both possible UTC equivalents (`31 13,14 * * *`) and its command runs only when New York local time is `09:31`, avoiding twice-yearly manual retuning without changing the database timezone |
| 2026-07-31 | Cloud mode un-deferred; `develop` branch workflow adopted | Netlify's production branch is `main`; pushing to `develop` costs no build minutes, so PRs target `develop` and only merge to `main` when ready to ship |
| 2026-07-31 | Daily cron via `pg_cron`/`pg_net` (SQL), not a dashboard tab; `net.http_post` timeout raised to 60s | The dashboard "Schedules" tab this file used to reference doesn't exist. A real sync takes ~16s server-side; `pg_net`'s 5s default was logging a misleading timeout even though the function completed fine |
| 2026-07-31 | Added `refresh-quotes`, the project's first **user-scoped** Edge Function | Click-only "Refresh prices" for live `holdings.last_price`, decoupled from the daily earnings cron. Resolves caller's `user_id` from JWT, writes via partial update, never a full-row upsert. `verify_jwt: true` mandatory |
| 2026-07-31 | SnapTrade owns *what you own* (`snaptrade-sync`); Finnhub owns *what it's worth* (`refresh-quotes`) | `snaptrade-sync`'s upsert omits `last_price`/`day_change_*` so `ON CONFLICT DO UPDATE` never touches those columns |
| 2026-07-31 | `snaptrade_users` (holds the SnapTrade `userSecret`) has RLS enabled with **zero** policies | Standard Postgres lockbox pattern — only the service-role key can touch it. Shows up as the expected `rls_enabled_no_policy` INFO lint, not a real finding |
| 2026-07-31 | `snaptrade-connect`/`snaptrade-sync` use the official `snaptrade-typescript-sdk` via Deno's `npm:` specifier | Every method/field access verified directly against the real SDK source (`.d.ts`/`.mjs` from the npm tarball), not docs or guesses — this is how every real SnapTrade bug below was actually found, not from reasoning about docs |
| 2026-08-01 | Established "surface real errors in the client, not the logs" as the debugging pattern for Edge Functions | Supabase's `get_logs` MCP tool never surfaces `console.error` output — only the HTTP boundary line. `describeFunctionError()` in `snaptradeRepository.ts` reads the real JSON error body off `error.context` instead (supabase-js's `FunctionsHttpError.message` is always generic) |
| 2026-08-01 | SnapTrade: support **both** Personal and Commercial API key models behind `SNAPTRADE_AUTH_MODE`, defaulting to `personal`, gated to one owner user | A fresh key pair returned SnapTrade's own `1012` error ("registerUser is not available for personal keys") — settled the question directly. The SDK enforces the split per endpoint (`userId`/`userSecret` typed `never` in personal mode). Personal mode auto-resolves the owner when there's exactly one auth user, else requires `SNAPTRADE_OWNER_USER_ID` — refuses to guess with ≥2 users, since a Personal key always returns the key owner's own brokerage account regardless of caller |
| 2026-08-01 | Macro calendar (FOMC/CPI/NFP) replaced with a static, hand-verified table instead of the plan's original ask for hardcoded dates "through 2027" | The old `buildMacroEvents()` heuristic fabricated dates with no connection to real Fed/BLS schedules. `supabase/functions/_shared/macro-calendar.ts` tables only what's officially published as of 2026-08-01 (2026 FOMC confirmed, 2027 FOMC marked `estimated` per the Fed's own "tentative" label, CPI/NFP through their published horizon) and stops there rather than extrapolating. Extend it from primary sources directly when stale, not by pattern-matching existing rows |
| 2026-08-01 | `snaptrade-sync`'s reconcile-delete only runs when the run returned positions and hit no per-account error | A zero-position response or a per-account failure means the list can't be trusted as complete — deleting under either condition risks wiping real holdings because SnapTrade had a bad moment, not because the user actually sold |
| 2026-08-01 | `portfolioRepository.ts`'s holdings writes are per-row (`upsertHoldingsRemote`/`deleteHoldingsRemote`), not a whole-list select→delete→upsert diff; the client never sends `last_price`/`day_change_*`/`created_at` | The old shape re-diffed the entire book on every single-field edit and let a stale client overwrite Finnhub's price data. The brokerage-synced delete guard moved into the query itself (`.neq('source','snaptrade')`) so it holds regardless of caller |
| 2026-08-01 | Added `portfolioWeightBasis()` as a function distinct from `portfolioTotalValue()`, rather than changing what the latter returns | `portfolioTotalValue()` has to stay a plain dollar sum — it feeds the "Total value" header and `ExposureSummary.totalPortfolioValue`, which don't care about weight overrides. The basis is only for dividing a *non*-overridden holding's value into a weight percentage, scaled so overridden + computed weights sum to 100% |
| 2026-08-01 | `weightAnchor` (`max(5, p90weight × 1.5)`) is recomputed per book inside `scoreEvent` rather than memoized per render | Cheap at this portfolio's scale (tens of holdings, tens of events) — recomputing beats threading another precomputed value through every call site for no measurable benefit |
| 2026-08-01 | Portfolio's mobile card layout ignores the desktop table's column customization (show/hide + reorder) — always the same fixed compact field set | Drag/reorder doesn't map cleanly onto a single column of cards, and the plan only asked for compact cards, not customizable ones. Column prefs stay a `sm:`-and-up affordance |
| 2026-08-01 | Fixed the weight bar's undocumented `× 3` saturation (`PortfolioTable.tsx`, confirmed in `docs/PLAN-2026-08.md`'s verification table but never assigned to a PR) while already touching that file for PR 7's mobile cards | It silently maxed the bar out around 33% weight instead of 100%, on both the desktop cell and the new mobile card that shares its logic. Plain `min(100, weight)` now — same drive-by-fix-while-in-the-file precedent as PR 1's `resetDemo()` fix |

---

## Session log

Keep entries short — a few bullets, key files, PR/commit pointer for detail. Don't re-narrate the debugging journey; that's what Decisions is for.

### 2026-08-01 — claude (session 19)
- Owner confirmed the live `main` build directly (real-book weight/exposure sanity, snappy UI, one real morning of use, completed brokerage connect→sync); marked all 4 remaining Phase 1 exit-criteria boxes met and closed the SnapTrade click-test item.
- Added `docs/PLAN-PHASE-2.md`: three brainstormed sequencing options for Phase 2's original "Ritual" scope. Superseded later this session — see below.
- Owner + Fable 5 design discussion redefined Phase 2/3 around earnings intelligence instead of generic productivity features. Rewrote `AGENTS.md`'s Three-phase program (Phase 2 → "Signal", Phase 3 → "Intelligence" redefined), `docs/ROADMAP.md`, and `docs/PLAN-PHASE-2.md` (now concrete build order, not options) to match. Wrote `docs/AI.md`, superseding the never-merged `claude/deepseek-api-integration-k9rwbp` branch's draft, updated for the owner's decisions: DeepSeek provider, position-data boundary loosened only for the morning briefing (ticker+weight%+dates), guidance summaries/"what moved it" via web search instead of paid transcripts.
- No app code touched; docs-only.

### 2026-08-01 — codex (session 18)
- PR #25 promoted `develop` into `main` as the Phase 1 `v1.0` release; the main-targeted CI run (#24) passed build, lint, and test.
- Preserved the two production-only SnapTrade error-detail commits already on `main`.
- Settings release metadata records the promotion timestamp `2026-08-01T22:51:27Z` (formatted for Eastern Time).
- Remaining Phase 1 work is owner acceptance: brokerage connect/sync, Refresh prices, real-book weight/exposure sanity, sign-out clearing, mobile check, and one real morning.

### 2026-08-01 — codex (session 17)
- Portfolio now opens on the holdings table with total value plus whole-book daily dollar and percentage change; incomplete price refreshes show an honest unavailable state.
- Moved CSV import/export, add/update, search, source filters, and sorting below the table.
- Replaced arrow-based desktop column ordering with native drag-and-drop rows; visibility toggles remain beside each column.
- This became the Phase 1 v1.0 candidate promoted in session 18.

### 2026-08-01 — codex (session 16)
- Settings refactor: added a single Diagnostics card with live Backend/Auth/Positions/Prices/Events status rows, surfaced error details, and reload/price-check actions.
- Added `src/lib/appMeta.ts` with Phase 1 release metadata (`v1.0`) and an Eastern-time formatted last-updated timestamp.
- Added the release/versioning protocol to `AGENTS.md`: phase finals use major versions, feature releases use minor versions, and hotfixes use patch versions.
- This work is on `develop`; production `main` remains unchanged until the owner promotes the final Phase 1 release.

### 2026-08-01 — codex (session 15)
- PR #20 adds a layout-matched boot skeleton and hides local/demo book values until auth + remote loading resolve; CI build/lint/test green, merged to `develop`.
- PR #21 adds an always-visible Local/Demo banner, mobile `Local` badge, and highlighted desktop mode label so sample/device-only data cannot be mistaken for the cloud book.
- Live Supabase cron job `daily-sync-events` moved from 11:00 UTC to a DST-safe 9:31 a.m. America/New_York schedule; verified against summer and winter UTC offsets.
- Phase 1 remains awaiting owner production acceptance only: brokerage connect/sync, Refresh prices, real-book weight/exposure sanity, sign-out clearing, mobile check, and one morning of use.

### 2026-08-01 — claude (session 14)
- PR 5 ("Mutation safety proper"): per-row holdings upsert/delete, trimmed client write authority, CSV Merge/Replace picker with live preview counts, per-row delete confirmation. Verified in a real browser via Playwright (dev server, not just unit tests), not only `npm test`. 63 tests green.
- PR: https://github.com/LucmanAly/Portlander/pull/17 (draft → develop). Key files: `src/lib/{mappers,portfolioRepository,csv}.ts`, `src/context/PortfolioContext.tsx`, `src/pages/PortfolioPage.tsx`, `src/components/portfolio/PortfolioTable.tsx`.
- Owner asked for this file to be trimmed — was 225 lines / 6.1k words and regrowing the bloat it was cut for on 2026-07-31. Collapsed sessions 1–12's debugging narrative into a pointer at Decisions (which already held the resolved "why"), dropped a Decisions row referencing `eventSync.ts` (deleted in PR 2), fixed a stale "known gap" note PR 4 already closed. 225 → 112 lines. Commit `51cbcf4`.
- PR 6 ("Score recalibration"), stacked on PR 5. New `portfolioWeightBasis()` (mixed override/computed books now sum to 100%), `weightAnchor()` (portfolio-relative anchor replaces the fixed `/20` clamp — took the red tier from 1/41 holdings to 7 on the distribution fixture), `isEstimatedValue()` (cost-basis fallback flagged, shown as `~` in the Portfolio table), `scoreTier()`/`TierBadge` (High/Med/Low). `EventCard` now leads with weight%, not the score; the redundant progress bar is gone.
- PR: https://github.com/LucmanAly/Portlander/pull/18 (draft → develop). Verified in a real browser (Playwright), not just `npm test` — Today page's weight-as-hero + tier badges, Portfolio's estimated marker, Settings' updated formula text all confirmed live. 67 tests green (7 net new). Key files: `src/lib/scoring.ts`, `src/components/ui/Badge.tsx`, `src/components/today/EventCard.tsx`, `src/components/portfolio/PortfolioTable.tsx`, `src/pages/{Portfolio,Settings}Page.tsx`.
- PR 7 ("Morning read, sliced"), stacked on PR 6 — the last PR in `docs/PLAN-2026-08.md`'s sequence. `MonthCalendar` dots now vary in size with `positionWeightPct` (was fixed regardless of weight); Portfolio gained search/source-filter/sort (real gap at 41 holdings); `PortfolioTable` gets mobile compact cards below `sm` instead of the horizontally-scrolling table; agenda dates go through `formatEventDay`. Drive-by fix: the weight bar's undocumented `× 3` saturation (flagged in the plan's own verification table, never assigned to a PR) — removed while already in that file for the mobile cards.
- PR: https://github.com/LucmanAly/Portlander/pull/19 (draft → develop). Verified in a real browser at both desktop and mobile viewports (Playwright) — calendar dots visibly scale with weight, search/filter/sort narrow the table with the right empty-state copy, table hidden / cards shown below `sm`, agenda shows human-readable dates. 67 tests green (unchanged — this PR is UI-only, no new pure-logic surface to test at the unit level). Key files: `src/components/calendar/MonthCalendar.tsx`, `src/pages/{Calendar,Portfolio}Page.tsx`, `src/components/portfolio/PortfolioTable.tsx`.
- Owner asked to review and merge all of them: undrafted and merged **#14, #16, #17, #18, #19** into `develop` in that order (each was a superset of the last — stacked branches, not independent diffs). CI was green and no review comments existed on any of them. Skipped **PR #15** ("DeepSeek API integration" plan) at the owner's call: a different session's PR, unrelated to this sequence, and it touched `PROGRESS.md` in a way that would've conflicted. Re-checked out `develop` locally post-merge and reran `build`/`lint`/`test` against the actual merged tree, not just each PR in isolation — still 67/67 green. `main`/Netlify untouched; that's a separate, deliberate step per the `develop`-workflow Decisions row.

### 2026-08-01 — claude (session 13)
- PR 4 ("Data truthfulness"): real published macro dates (see Decisions), reconciled sold SnapTrade positions, per-provider sync freshness in Settings. Deployed + verified live in prod (`sync-events` v14, `snaptrade-sync` v18); `get_advisors` clean.
- PR: https://github.com/LucmanAly/Portlander/pull/16 (draft → develop).

### Sessions 1–12 (2026-03-25 – 2026-08-01)
Scaffolded the app and local demo mode, then cloud deploy (Netlify + Supabase + `sync-events` cron), then the SnapTrade brokerage integration. The SnapTrade Personal-vs-Commercial auth mismatch took several sessions to isolate; the resolved mechanism and every real bug found along the way (SDK client construction, `display_name` field casing, `cost_basis` vs a nonexistent field, `getAllAccountPositions`'s response shape) are in the Decisions table above, not repeated here. PRs #1–#13 cover this work; full narrative is in git history if needed.

---

## Notes for the next agent

1. **Never trust a PR number without checking** — one got merged early mid-session carrying only part of its commits. Use `list_pull_requests`/`pull_request_read` before assuming what's merged.
2. **No Supabase MCP tool exposes secrets management or Auth URL config** — any new secret needs the owner to paste it into the dashboard. **But `deploy_edge_function` works and `get_edge_function` reads deployed source back to verify** — don't hand the owner a deploy step you can do yourself.
3. **`sync-events` is deliberately global/unscoped** (shared rows, safe for any caller). **`refresh-quotes`/`snaptrade-sync` are user-scoped** (privileged per-user writes). Check which shape a new Edge Function actually needs.
4. **If a SnapTrade SDK error shows up, don't guess from docs** — download the real tarball (`npm registry` → `snaptrade-typescript-sdk`) and grep the `.d.ts`/`.mjs` directly. Every real bug here was found that way, not by reasoning about documentation.
5. **The Supabase `get_logs` MCP tool cannot read `console.error` output — confirmed dead.** Make Edge Functions return error detail in the JSON body instead, and make sure the client actually reads it (`describeFunctionError()` in `snaptradeRepository.ts` is the working pattern).
6. If a Supabase/Netlify/SnapTrade MCP connector is available, prefer it over asking the owner to click through a dashboard — check via ToolSearch rather than assuming unavailability.
7. **Keep this file lean.** Short session-log entries, delete resolved blockers, edit Decisions rows in place rather than layering corrections on top.
8. No `chromium-cli` in this environment — for Playwright verification, it's installed globally at `/opt/node22/lib/node_modules/playwright`, Chromium binary at `/opt/pw-browsers/chromium` (pass directly as `executablePath`).
