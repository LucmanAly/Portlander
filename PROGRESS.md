# PROGRESS.md — Portlander live status

**Last updated:** 2026-08-02
**Last agent:** claude (session 18)
**Current phase:** Phase 2 — "Signal" (redefined 2026-08-01; scope in `docs/PLAN-PHASE-2.md`, superseded phase-3 AI plan in `docs/AI.md` — both merge via PR #27). Phase 1 promoted to `main` as v1.0 (PR #25/#26). Build order step 1 (structured EPS/revenue + beat/miss on `EventCard`) shipped this session; steps 2–4 (PEG snapshot, `Holding.thesis`, watchlist-on-calendar + week view) are next.

> **Protocol:** Read `AGENTS.md` + this file before work; update this file after work without being asked. Trimmed 2026-08-01 (225 → 112 lines) after session-log bloat crept back in — old debugging narrative for *resolved* issues was cut in favor of the Decisions table (the "why," kept) over the session-by-session "what we tried" (cut). Keep new entries short.

---

## Snapshot

Single source of truth for current state. If it's here, don't re-explain it elsewhere in this file.

| Area | Status | Notes |
|------|--------|-------|
| Local app (UI shell, scoring, CSV, demo) | ✅ Done | Premium dark app, Today/Calendar/Portfolio/Settings; boot skeletons prevent demo-data flash and Local/Demo state is explicit on desktop + mobile |
| Settings diagnostics + release metadata | ✅ Done on `develop` | Central Diagnostics card surfaces backend/auth/positions/prices/events issues; About this build shows version, phase and last-updated metadata |
| Supabase project `vvstmdnnpjnfvueoecwl` | ✅ Live | Schema (`holdings`/`watchlist`/`events`/`sync_runs`/`snaptrade_users`/`snaptrade_connections`) applied, now including `events.eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual`. Only advisories are pre-existing/expected (see Decisions) |
| Netlify | ✅ Live | `https://portlander.netlify.app`, git-linked to `main` |
| `sync-events` Edge Function | ✅ Live (v15) | Global/unscoped, `verify_jwt: true`. Macro rows (FOMC/CPI/NFP) come from the static, hand-verified `supabase/functions/_shared/macro-calendar.ts` — no more heuristic generation. Now writes EPS/revenue estimate+actual to dedicated columns (previously `raw`-only) |
| Phase 2 Signal — structured EPS/revenue beat/miss | ✅ Shipped (this session) | `events` table + `PortfolioEvent` carry `epsEstimate`/`epsActual`/`revenueEstimate`/`revenueActual`; `scoring.ts` computes `epsBeatMissPct`/`revenueBeatMissPct` locally (no AI); `EventCard` shows beat/miss badges post-report and a neutral "EPS est" chip pre-report. Existing live rows backfilled from `raw` so it's visible immediately, not just after tomorrow's cron |
| Daily cron | ✅ Live | `daily-sync-events` targets **9:31 a.m. America/New_York year-round**: `31 13,14 * * *` UTC plus an Eastern-time guard, so exactly one EDT/EST slot executes |
| `refresh-quotes` Edge Function | ✅ Live (v2) | User-scoped, manual "Refresh prices" control. Persists `day_change_value`/`day_change_pct` |
| `snaptrade-sync` / `snaptrade-connect` | ✅ Live (v18 / v17) | Personal-auth mode by default (`SNAPTRADE_AUTH_MODE`). Reconciles sold positions (`seenTickers` diff+delete). Owner click-test still pending — see Blockers |
| Portfolio table + CSV | ✅ Rebuilt | Table-first opening view with total value + whole-book daily gain/loss, management controls below the table, drag-and-drop desktop column ordering, per-row writes (PR 5), CSV Merge/Replace picker, `~` estimated-value marker, search/sort/source filter + mobile compact cards |
| Impact score | ✅ Recalibrated (PR 6) | Portfolio-relative anchor (`max(5, p90weight × 1.5)`) replaced the fixed `/20` clamp; High/Med/Low tiers; `EventCard` leads with weight, not the score |
| Calendar | ✅ Weight-aware (PR 7) | `MonthCalendar` dot size now tracks position weight; agenda dates go through `formatEventDay` |
| Phase 1 exit criteria | 🟡 2 of 5 met | See checklist below |

---

## Phase 1 checklist

- [x] Scaffold, cloud deploy (Netlify + Supabase + `sync-events` + cron), owner signed in with a real synced book
- [x] Calendar/Today UI fixes + manual "Refresh prices" (PR #4 → `develop`)
- [ ] Phase 1 exit criteria formally signed off:
  - [x] Real portfolio loadable; earnings from Finnhub, not demo offsets
  - [ ] Weight ranking + exposure % sanity (math unchanged, not yet owner-verified)
  - [ ] Snappy UI (fixes live on `develop`, awaiting confirmation)
  - [ ] Used on a real morning once

### SnapTrade (new scope, not in original AGENTS.md plan)
- [x] Schema (`snaptrade_users` lockbox, `snaptrade_connections`, `holdings.source`/`day_change_*`), both Edge Functions, Settings "Brokerage" UI
- [x] Personal-vs-Commercial auth root cause found and fixed (`SNAPTRADE_AUTH_MODE`, defaults to `personal`) — see Decisions
- [x] "Position fully sold" gap fixed (v18) — reconciliation not yet exercised against a real sell, since the connect→sync flow has never completed end-to-end
- [ ] **Owner: click "Connect brokerage" once more.** Nothing to configure — needs no new secrets. If it errors, the message names the SnapTrade code and the fix.

---

## Next up (ordered)

1. Phase 2 Signal, build order step 2: PEG snapshot per holding — new Finnhub `/stock/metric` call (verify free-tier endpoint + rate limit before committing), pure-math PEG, shown on `EventCard`/`PortfolioTable`.
2. Build order step 3: `thesis` text column on `holdings` + Portfolio-page UI to write/edit it (freeform capture only — feeds Phase 3's drift detection, no AI processing in Phase 2).
3. Build order step 4: watchlist tickers on the calendar (not just held positions) + a week view alongside the existing month view.
4. Phase 3 ("Intelligence" — thesis drift, morning briefing, "what moved it", guidance summaries; see `docs/AI.md`) starts only once all of Phase 2 ships as `v2.0`.
5. **Owner (background, not blocking):** DeepSeek API key + prepaid balance → Supabase Edge secrets `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` (generic names, not `DEEPSEEK_*`, so the provider shim stays swappable). No code depends on these until Phase 3.
6. **Owner (still open since session 5):** check Netlify → Deploy contexts — Deploy Previews for PRs may burn build minutes separately from `main` pushes.
7. **Owner, still pending:** click "Connect brokerage" → link Fidelity → "Sync now" end-to-end at least once (SnapTrade code has shipped but this path has never been exercised against a real sell/reconcile).

---

## Blockers

- **None outstanding on SnapTrade code.** What remains is verification, not a blocker: the connect → Fidelity → sync path has never run end-to-end, so treat it as unproven until the owner confirms a real sync.

(Resolved blockers are deleted, not kept. Ambient MCP-connector disconnects/reconnects are not a project blocker.)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-01 | Portfolio opens on the book, not its management controls | Holdings/table plus total value and a complete-refresh daily gain/loss summary come first; import/export/add/search/filter/sort controls remain below the table, and desktop column ordering uses drag-and-drop instead of arrow buttons |
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
| 2026-08-02 | Phase 2 Signal step 1's schema migration + `sync-events` redeploy applied directly to the live Supabase project (v14 → v15), plus a one-time backfill of `eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual` from existing rows' `raw` jsonb | Purely additive/nullable columns, zero risk to existing data; matches this file's own standing guidance ("`deploy_edge_function` works... don't hand the owner a deploy step you can do yourself"). Diffed `get_edge_function`'s live source against the repo before deploying, per AGENTS.md's mandatory rule — no drift found. Backfilling from `raw` means the 5 already-reported earnings in the live book show beat/miss immediately instead of waiting on tomorrow's cron |

---

## Session log

Keep entries short — a few bullets, key files, PR/commit pointer for detail. Don't re-narrate the debugging journey; that's what Decisions is for.

### 2026-08-02 — claude (session 18)
- Phase 2 "Signal" build order step 1: promoted Finnhub's EPS/revenue estimate+actual out of `events.raw` into dedicated columns; `PortfolioEvent` carries them; `scoring.ts` computes `epsBeatMissPct`/`revenueBeatMissPct` (pure math, estimate-magnitude denominator so a beat on a loss-estimate reads positive); `EventCard` shows green/red beat-miss badges post-report and a neutral "EPS est" chip pre-report, plus an actual-vs-estimate detail line. No new Finnhub call.
- Applied the schema migration and redeployed `sync-events` (v14 → v15) directly to the live Supabase project, diffing production source first per AGENTS.md; backfilled existing rows' new columns from `raw` so the 5 already-reported earnings in the real book show beat/miss immediately. See Decisions.
- Demo data (`src/data/demo.ts`) got matching sample estimate/actual figures so Local/Demo mode demonstrates the feature too. 76 tests green (9 net new, `scoring.test.ts`); verified in a real browser (Playwright) — badges and colors render correctly on Today.
- Key files: `supabase/schema.sql`, `supabase/functions/sync-events/index.ts`, `src/types/{index,database}.ts`, `src/lib/{mappers,scoring,format}.ts`, `src/components/ui/Badge.tsx`, `src/components/today/EventCard.tsx`, `src/data/demo.ts`.
- PR: branch `claude/phase-2-signal-eps-revenue-w7euc5` → `develop` (draft).

### 2026-08-01 — codex (session 17)
- Portfolio now opens on the holdings table with total value plus whole-book daily dollar and percentage change; incomplete price refreshes show an honest unavailable state.
- Moved CSV import/export, add/update, search, source filters, and sorting below the table.
- Replaced arrow-based desktop column ordering with native drag-and-drop rows; visibility toggles remain beside each column.
- This remains part of the Phase 1 v1.0 candidate on `develop`; production `main`/Netlify is unchanged.

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
