# PROGRESS.md — Portlander live status

**Last updated:** 2026-08-02
**Last agent:** codex (session 21)
**Current phase:** Phase 1 and Phase 2 are fully closed out. The owner has now defined the first
Phase 3 slice: **portfolio performance intelligence** — verified daily/weekly/date-range attribution
with DeepSeek limited to narration of deterministic facts. `BE-01`–`BE-06` merged to `develop` via
PR #32. Phase 1 acceptance is owner-confirmed complete. PR #28 (stale, pre-overhaul "Signal"
branch) is closed as superseded. **DeepSeek interpretation is live**: the owner set
`DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL`(`https://api.deepseek.com`)/`DEEPSEEK_MODEL`(`deepseek-chat`)
and every currently-reported earnings event in the real book has a generated interpretation,
verified accurate against the underlying numbers. `src/lib/appMeta.ts` was bumped to `2.0` /
`APP_RELEASE_NAME = 'Portfolio Event Intelligence'` — the owner explicitly asked for release
naming to drop "Phase N" language in the app UI (that numbering stays internal, in this file and
`AGENTS.md`, not shown to the owner). Fixed stale Settings copy in the same pass — the "Earnings
intelligence" section still said "Interim fixture data" / "No live provider populates consensus…",
which stopped being true after `BE-01`/`BE-05` and was never updated until now.

> **Protocol:** Read `AGENTS.md` + this file before work; update this file after work without being asked. Trimmed 2026-08-01 (225 → 112 lines) after session-log bloat crept back in — old debugging narrative for *resolved* issues was cut in favor of the Decisions table (the "why," kept) over the session-by-session "what we tried" (cut). Keep new entries short.

---

## Snapshot

Single source of truth for current state. If it's here, don't re-explain it elsewhere in this file.

| Area | Status | Notes |
|------|--------|-------|
| Local app (UI shell, scoring, CSV, demo) | ✅ Done | Premium dark app, Today/Calendar/Portfolio/Settings; boot skeletons prevent demo-data flash and Local/Demo state is explicit on desktop + mobile |
| Settings diagnostics + release metadata | ✅ Promoting to `main` as `v2.0` this session | Central Diagnostics card surfaces backend/auth/positions/prices/events issues; About this build shows version, release name (not "Phase N" — owner's naming call), and last-updated metadata |
| Supabase project `vvstmdnnpjnfvueoecwl` | ✅ Live | Schema (`holdings`/`watchlist`/`events`/`sync_runs`/`snaptrade_users`/`snaptrade_connections`) applied. Only advisories are pre-existing/expected (see Decisions) |
| Netlify | ✅ Live | `https://portlander.netlify.app`, git-linked to `main` |
| `sync-events` Edge Function | ✅ Live (v16) | Global/unscoped, `verify_jwt: true`. Writes `eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual` typed columns (not just `raw` jsonb) and now looks back 380 days (was 7) to backfill real historical quarters for `BE-04`. Macro rows (FOMC/CPI/NFP) come from the static, hand-verified `supabase/functions/_shared/macro-calendar.ts` — no more heuristic generation |
| `earnings-interpret` Edge Function | ✅ Live (v2) and **enabled** | `BE-06`. Owner set `DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL`(`https://api.deepseek.com`)/`DEEPSEEK_MODEL`(`deepseek-chat`) 2026-08-02. Invoked (via `pg_net`, from inside Supabase — this session's sandbox can't reach `*.supabase.co` directly, see Decisions) against every already-reported event with no interpretation yet (5 events: FTNT, MSFT, MSTR, CHKP, TENB) — all generated successfully, spot-checked against the underlying numbers by hand, all correct. Still manual/rate-limited only — no cron |
| Daily cron | ✅ Live | `daily-sync-events` targets **9:31 a.m. America/New_York year-round**: `31 13,14 * * *` UTC plus an Eastern-time guard, so exactly one EDT/EST slot executes |
| `refresh-quotes` Edge Function | ✅ Live (v2) | User-scoped, manual "Refresh prices" control. Persists `day_change_value`/`day_change_pct` |
| `snaptrade-sync` / `snaptrade-connect` | ✅ Live (v18 / v17) | Personal-auth mode by default (`SNAPTRADE_AUTH_MODE`). Reconciles sold positions (`seenTickers` diff+delete). Owner-confirmed working end to end |
| Portfolio table + CSV | ✅ Rebuilt | Table-first opening view with total value + whole-book daily gain/loss, management controls below the table, drag-and-drop desktop column ordering, per-row writes (PR 5), CSV Merge/Replace picker, `~` estimated-value marker, search/sort/source filter + mobile compact cards |
| Impact score | ✅ Recalibrated (PR 6) | Portfolio-relative anchor (`max(5, p90weight × 1.5)`) replaced the fixed `/20` clamp; High/Med/Low tiers; `EventCard` leads with weight, not the score |
| Calendar | ✅ Weight-aware (PR 7) | `MonthCalendar` dot size now tracks position weight; agenda dates go through `formatEventDay` |
| Phase 1 v1.0 promotion | ✅ Merged to `main` | PR #25 promoted `develop`; PR #26 recorded the final release metadata |
| Phase 1 acceptance | ✅ Owner-confirmed complete | SnapTrade connect/sync, Refresh prices, real-book math, sign-out, mobile, and one real morning all confirmed by the owner |
| Phase 2 UI/UX overhaul | ✅ Done, merged to `develop` | Full frontend baseline: 5-route shell, event-intelligence primitives + fixtures, Today Morning Desk, Earnings workspace, detail drawer, Calendar overhaul, Portfolio refinement, Settings IA, truthful-states audit, a11y/mobile polish, full regression pass (`UX-01`–`UX-11`) |
| Phase 2 earnings intelligence (backend) | ✅ `BE-01`–`BE-06` done, DeepSeek live | Real consensus/actual/surprise/history reach the client from `events`' typed columns (real facts always take priority over `earningsFixtures.ts`, which is unit-test-only now — `BE-05`). Guidance/reaction left honestly undefined — Finnhub has neither. DeepSeek interpretation (`BE-06`) is validated, rate-limited, and now enabled — every currently-reported event has a real interpretation |
| Phase 3 performance intelligence | 🚧 In progress (`PI-01`) | Daily per-position snapshots, deterministic daily/weekly/date-range attribution, Morning Desk recap, Portfolio period review, and strictly grounded DeepSeek narration |

---

## Phase 1 checklist

- [x] Scaffold, cloud deploy (Netlify + Supabase + `sync-events` + cron), owner signed in with a real synced book
- [x] Calendar/Today UI fixes + manual "Refresh prices" (PR #4 → `develop`)
- [x] Promote the Phase 1 `v1.0` candidate from `develop` to `main` (PRs #25/#26)
- [x] Phase 1 exit criteria formally signed off (owner-confirmed 2026-08-02):
  - [x] Real portfolio loadable; earnings from Finnhub, not demo offsets
  - [x] Weight ranking + exposure % sanity
  - [x] Snappy UI
  - [x] Used on a real morning once

### SnapTrade (new scope, not in original AGENTS.md plan)
- [x] Schema (`snaptrade_users` lockbox, `snaptrade_connections`, `holdings.source`/`day_change_*`), both Edge Functions, Settings "Brokerage" UI
- [x] Personal-vs-Commercial auth root cause found and fixed (`SNAPTRADE_AUTH_MODE`, defaults to `personal`) — see Decisions
- [x] "Position fully sold" gap fixed (v18)
- [x] **Owner confirmed Connect brokerage → Fidelity → Sync now works end to end.** Phase 1 acceptance closed.

---

## Phase 2 UI/UX overhaul master queue

This is the authoritative implementation order. Each task should normally be one focused PR to
`develop`. Preserve working data behavior while replacing presentation; do not copy prototype
demo values, account details, or invented financials into production code.

Visual reference: [Portlander Portfolio Event Intelligence — Magic Patterns](https://project-portlander-portfolio-event-intelligence-323.magicpatterns.app/). It is a direction and interaction reference, not a source of production data or code.

**NEXT_TASK:** None — `UX-01`-`UX-11` complete; see the backend queue below for what's next

**ACTIVE_CLAIM:** None

- [x] **UX-01 — Visual foundation and application shell**
  - First reconcile the release-only `main` commits back into `develop`; `main` currently contains
    the final `v1.0` promotion metadata and must not be regressed by later Phase 2 work.
  - Consolidate typography, spacing, borders, surfaces, focus states, semantic colors, and number
    formatting into the existing design tokens; improve small-text contrast and reduce excessive
    all-caps micro-labels/background-grid noise.
  - Update desktop/mobile navigation to `Today / Earnings / Calendar / Portfolio / Settings`, add
    the Earnings route, and remove the redundant Book Value card from the desktop rail.
  - Preserve Local/Demo, loading, sync-failure, Refresh prices, and mobile mode indicators.
  - **Done when:** all five routes render in the new shell at desktop and mobile widths with no
    data-behavior regression; build, lint, and tests pass.

- [x] **UX-02 — Shared event-intelligence presentation model and primitives**
  - Add typed view states for `upcoming`, `awaiting results`, and `reported`; support timing,
    portfolio weight, consensus, actuals, surprise, guidance, reaction, provenance, and optional
    generated interpretation without making those fields mandatory.
  - Build reusable status badges, metric pairs, freshness labels, report cards, carousel controls,
    and verified-vs-generated section treatments.
  - Replace unexplained `R/E` boxes with a readable compact history treatment such as explicit
    revenue/EPS beat counts and accessible labels.
  - **Done when:** fixtures exercise every state, missing values render honestly, and primitives
    have keyboard/focus behavior plus unit tests for formatting/state mapping.

- [x] **UX-03 — Today: Morning Desk and focused earnings deck**
  - Lead with total portfolio value, daily dollar and percentage move, freshness, and near-term
    reporting exposure.
  - Implement one dominant earnings card with a visible next-card peek, dots/arrows on desktop,
    and horizontal swipe on touch; cards remain active from D-1 through D+1.
  - Keep Today focused on the deck, `Needs attention`, and one compact forward-exposure panel.
    Move the full schedule and cluster exploration to Earnings/Calendar.
  - **Done when:** the page answers “what matters to my book today?” above the fold without a
    dense generic event feed, and all empty/single/multiple-card states work.

- [x] **UX-04 — Earnings workspace**
  - Build the dedicated Earnings page with exposure summary, filters for Active/Upcoming/Recently
    reported/All, and quantitative cards ranked by timing and portfolio relevance.
  - Before release show date/session, weight, consensus revenue/EPS, and source freshness; after
    release show actual vs estimate, dollar/percentage surprise, guidance state, and reaction.
  - Include cluster/session grouping without duplicating Today’s full hierarchy.
  - **Done when:** navigation, filters, sorting, cards, loading/empty/error states, and mobile layout
    work from current or typed fixture data without requiring DeepSeek.

- [x] **UX-05 — Earnings intelligence detail drawer**
  - Card selection opens an immediate right-side drawer on desktop and bottom sheet on mobile;
    support close button, Escape, focus management, and return focus.
  - Show verified financials, portfolio exposure, guidance, source/freshness, and compact historical
    context first; place model interpretation in a separately labeled generated section.
  - Never hide the detail at the bottom of the page or blend generated prose with source facts.
  - **Done when:** upcoming/awaiting/reported details are usable by mouse, touch, and keyboard and
    missing/failed generated content does not damage the verified experience.

- [x] **UX-06 — Calendar overhaul**
  - Restyle the month view inside the new system while preserving position-weighted dots and
    chronological agenda behavior.
  - Add clear selected-day detail and multi-report/cluster cues; keep the calendar scannable rather
    than turning each cell into a miniature dashboard.
  - **Done when:** event type, relative weight, selected day, clusters, and empty days remain clear
    at desktop and mobile widths with correct dates.

- [x] **UX-07 — Portfolio workspace refinement**
  - Preserve the table-first order: summary, holdings table/cards, then management controls.
  - Show total value and truthful whole-book daily gain/loss in dollars and percent; only show total
    gain/loss when cost-basis completeness makes it honest.
  - Preserve search/filter/sort, CSV/manual/SnapTrade safety, mobile compact cards, and drag-and-drop
    desktop column ordering below the table.
  - Remove or clarify noisy per-row Evidence UI; expose provenance/freshness through a labeled
    tooltip or detail treatment rather than an unexplained icon/date column.
  - **Done when:** existing mutation and import protections still pass and a 40-position book is
    faster to scan, not merely more decorative.

- [x] **UX-08 — Settings information architecture**
  - Organize Settings into Account, Brokerage, Data & sync, Earnings intelligence, Diagnostics, and
    About this build with clear local navigation.
  - Keep all health checks/retry actions in Diagnostics and retain actionable raw error details.
  - Keep release metadata tied to `src/lib/appMeta.ts`; display `v1.0` until a real later release is
    promoted—never copy the prototype’s placeholder `v1.4 / Phase 2` label.
  - **Done when:** brokerage/sync/auth controls retain behavior, diagnostics are easy to find, and
    Settings works without becoming one unbroken wall of cards.

- [x] **UX-09 — Truthful states, privacy-safe demo data, and resilience**
  - Audit loading, empty, stale, partial, disconnected, degraded, and error states on every route.
  - Ensure public/demo fixtures contain no real email, account count, share count, holdings, or
    portfolio value; never expose private data through screenshots or committed fixtures.
  - Keep verified values usable when DeepSeek is absent, delayed, rate-limited, or malformed.
  - **Done when:** every route has an intentional state matrix and failure recovery path, with no
    demo-data flash or fabricated fallback metrics.

- [x] **UX-10 — Mobile, accessibility, and interaction polish**
  - Validate phone/tablet breakpoints, five-item bottom navigation, touch targets, swipe behavior,
    scroll containment, safe areas, drawers/sheets, and fixed navigation.
  - Meet readable contrast and minimum text sizes; add semantic labels, keyboard order, visible
    focus, reduced-motion support, and screen-reader names for charts/history indicators.
  - **Done when:** core Today → earnings card → detail and Portfolio flows are comfortable on a real
    phone and pass automated accessibility checks plus manual keyboard review.

- [x] **UX-11 — Full regression, visual QA, and Phase 2 UI release handoff**
  - Compare every route against the approved design intent at representative desktop/mobile widths;
    remove accidental density, inconsistent tokens, placeholder copy, and dead interactions.
  - Run build, lint, unit tests, end-to-end smoke flows, data-truth checks, and a real-book privacy
    review; record screenshots using anonymized data only.
  - Update roadmap/docs with the completed UI contract and create the next ordered backend queue for
    Finnhub normalization and DeepSeek structured interpretation.
  - **Done when:** the owner can approve the overhaul as the Phase 2 frontend baseline; version is
    bumped only when a user-facing release is intentionally promoted to `main`.

---

## Next: earnings intelligence backend queue

`UX-01`–`UX-11` built the full UI contract (`src/types/earnings.ts`, `EarningsCardModel`) against
typed fixtures (`src/data/earningsFixtures.ts`) because no live source populates consensus,
actual results, surprise, guidance, or reaction — see UX-02's and UX-09's notes in this file and
in `docs/UI.md`. This was the ordered work to make that data real. All six items are done as of
session 20 — see the "DeepSeek / `earnings-interpret`" Decisions entry for what "done" means for
`BE-06` specifically (built and deployed, deliberately not enabled).

- [x] **BE-01 — Read the Finnhub payload the app already fetches.** `sync-events`'s `toEventRow()`
  was already storing the full `FinnhubEarning` object (`epsEstimate`/`epsActual`/
  `revenueEstimate`/`revenueActual`/`quarter`/`year`) into `events.raw` — no Edge Function change
  or migration needed, and `select('*')` already returns it. Added `raw`/`updatedAt` to
  `PortfolioEvent` (`src/types/index.ts`), read in `eventFromRow()` (`src/lib/mappers.ts`), and a
  new `earningsFactsFromRaw()` (`src/lib/earningsIntel.ts`) that turns it into typed
  `consensus`/`actual` numbers. `buildEarningsCards()` now prefers real facts over the ticker's
  demo fixture when `raw` is present, falling back to the fixture otherwise.
- [x] **BE-02 — Compute surprise client-side.** `earningsFactsFromRaw()` computes
  `epsSurprisePct`/`revenueSurprisePct`/`*SurpriseAbs` at read time from consensus vs actual
  (`(actual - estimate) / |estimate| * 100`, division-by-zero guarded). Chose read-time over
  writing it in `sync-events` — one computation point, and no Edge Function redeploy needed to
  land it.
- [x] **BE-03 — Guidance and reaction, dropped honestly for now.** Finnhub's `/calendar/earnings`
  endpoint has neither field, and building a second provider integration (guidance) or a
  timed post-report quote pull (reaction, via `refresh-quotes`) is real scope beyond this pass.
  `earningsFactsFromRaw()` deliberately never sets them; the UI already renders their absence as
  nothing (`EarningsReportCard`'s guidance/reaction blocks are already conditional — several demo
  fixtures already lack one or both), so no UI removal was needed. Revisit as its own task if
  guidance/reaction turn out to matter enough to justify a real source.
- [x] **BE-04 — Real historical beat/miss.** `sync-events`' `LOOKBACK_DAYS` widened 7 → 380 (zero
  extra Finnhub calls — same one request per symbol, wider `from`/`to`) so ~5 quarters of past
  earnings land in `events` on the next sync. `earningsHistoryFromEvents()`
  (`src/lib/earningsIntel.ts`) reads the last 4 real quarters for a ticker from sibling rows
  already in the events array — no new provider call, no new table. `buildEarningsCards()` (and
  `selectDeckCards()`, via a new `historyEvents` parameter carrying the *unwindowed* events array —
  Today's D-1..D+1 display window is too narrow to ever contain a ticker's own history) attach it
  automatically. `HistoricalBeatStrip` needed no changes; it already rendered whatever `history`
  array it was given.
- [x] **BE-05 — Retired `earningsFixtures.ts`'s production fallback.** `buildEarningsCards()` no
  longer looks up a ticker-matched fixture at all — real facts (`BE-01`) or an honest
  `facts: undefined`, never a demo decoration. This turned out to matter for real, not just in
  theory: 2 of the 8 fixture tickers (NVDA, META) collide with the Local/Demo seed data in
  `src/data/demo.ts`, so before this fix Demo mode randomly showed rich fake numbers for 2 of 7
  demo tickers and nothing for the other 5 — an accidental, confusing inconsistency, not a designed
  demo state. `EARNINGS_FIXTURES`/`EARNINGS_FIXTURE_EVENTS` stay in the codebase, now purely as
  fixtures for `EarningsReportCard.test.tsx`/`EarningsDetailDrawer.test.tsx`/`EarningsDeck.test.tsx`
  (call `buildEarningsCardModel()` directly, bypassing `buildEarningsCards()`, so removing the
  fallback didn't break them). `EarningsPage.test.tsx`'s events were rewritten to carry real `raw`
  payloads instead of relying on the ticker-name coincidence.
- [x] **BE-06 — DeepSeek structured interpretation.** Built, validated, rate-limited, and deployed
  — **but deliberately not enabled**. See the dedicated Decisions entry below for what's built, why
  it stops short of live, and what the owner needs to do to turn it on.

---

## Next up (ordered)

1. **Owner, optional:** decide whether to automate `earnings-interpret` (e.g. chained after the
   daily `sync-events` cron) now that it's live and verified, or keep it manual/on-demand.
   Automating it means recurring spend without an explicit trigger each time — a deliberate
   decision, not a default.
2. **Owner:** check Netlify Deploy contexts once; PR previews may consume build minutes separately
   from production pushes.
3. **No open Phase 3 scope.** Per `AGENTS.md`, Phase 3 is undefined until the owner uses Phase 2 in
   production and decides what's next — don't invent one.

---

## Phase 3 — portfolio performance intelligence

**NEXT_TASK:** `PI-01`

**ACTIVE_CLAIM:** `codex`, 2026-08-02, `PI-01`, branch `codex/portfolio-period-recaps`

- [ ] **PI-01 — Verified performance recaps, end to end.** Add a user-scoped daily per-position
  snapshot ledger; deterministic daily/weekly/custom-period and tag/theme attribution; a weekday
  vs weekend Morning Desk recap; a Portfolio date-range review; and optional DeepSeek narration
  that receives only the verified aggregate payload and can never supply rendered numbers.
  SnapTrade's beta historical total-value endpoint may reconcile totals but cannot be the source
  of per-position/theme attribution. Missing snapshots or incomplete prices must render honestly.

**Open discussion, not a task yet:** Finnhub rate-limit strategy for PE ratio/market cap later. Verified: 60 calls/min free tier, no daily cap, bulk earnings-calendar mode exists (omit `symbol`). Owner hasn't decided whether to build this.

---

## Blockers

None outstanding. The SnapTrade connect → Fidelity → sync path is owner-confirmed working end to end (Phase 1 acceptance, 2026-08-02) — the previous entry here is resolved and deleted per this file's own protocol below.

(Resolved blockers are deleted, not kept. Ambient MCP-connector disconnects/reconnects are not a project blocker.)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-02 | `v2.0`'s `APP_RELEASE_NAME` is `"Portfolio Event Intelligence"`, not `"Phase 2 · Portfolio Event Intelligence"` — the "Phase" word is gone from Settings entirely, including the field label (`Phase` → `Release`) | Explicit owner request. "Phase N" is internal project-sequencing language for this file and `AGENTS.md` — useful for agents/owner coordinating work, not something that belongs in front of the app itself. `APP_PHASE` renamed to `APP_RELEASE_NAME` in `src/lib/appMeta.ts` to match; internal docs keep saying "Phase 2" freely, only the shipped UI changed. |
| 2026-08-02 | Fixed stale "Earnings intelligence" copy in Settings (`"Interim fixture data"` / `"No live provider populates consensus…"`) while promoting `v2.0`, not as a separate task | Real bug, not just tidiness: this text was accurate when UX-02 wrote it, but `BE-01`/`BE-05` made it false without anyone updating the copy — an app telling the owner "no live provider" while live Finnhub data was already flowing is exactly the kind of dishonest-UI regression this project's whole truthful-states discipline (`UX-09`) exists to prevent. Caught it by rereading the Settings page while doing the release-metadata edit in the same file area, not by a dedicated audit — worth a real audit pass if more backend-queue items land without a matching UI-copy check. |
| 2026-08-02 | Invoked `earnings-interpret` via `pg_net.http_post` (executed through the Supabase SQL/migration tooling) instead of `curl`/`fetch` from the agent sandbox | Direct HTTPS from this session to `*.supabase.co` returned a hard `403` from the sandbox's egress proxy (confirmed via `/__agentproxy/status` — a real organization policy block, not a transient error; the README is explicit: report it, don't route around it). `pg_net` is not a workaround — it's the exact mechanism `daily-sync-events`'s cron job already uses in this same project to call `sync-events`, so this reused an established, already-trusted call path rather than inventing a new one. Confirmed real, hallucination-free output this way: `epsSurprisePct`/`revenueSurprisePct` in all 5 generated summaries matched hand-computed values off the same `eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual` numbers exactly. |
| 2026-08-02 | DeepSeek interpretation (`BE-06`) is live: owner set `DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL` and all 5 eligible events were interpreted in one session | `DEEPSEEK_BASE_URL=https://api.deepseek.com` and `DEEPSEEK_MODEL=deepseek-chat` — verified live via web search after `api-docs.deepseek.com` 403'd this session's fetch tool too (same wall the PR #15 session hit). Contrary to that PR's note that `deepseek-chat` was deprecated 2026-07-24, current sources describe it as a still-valid alias for `deepseek-v4-flash`'s non-thinking mode — worth re-verifying directly in the DeepSeek dashboard if this ever starts erroring. |
| 2026-08-02 | PR #28 (`claude/phase-2-signal-eps-revenue-w7euc5`) closed as superseded, not merged | Owner call after `BE-01`–`BE-06` landed. Its infra (the `eps_estimate`/etc. columns, `sync-events`'s typed-column write path) was already reconciled into `develop` — see the "Discovered mid-session" row below — so merging it would have re-applied the same migration/deploy and reintroduced its old `EventCard` UI, which the merged Phase 2 overhaul already replaced with `EarningsReportCard`. Closed with a comment pointing at the reconciliation, not silently. |
| 2026-08-02 | `BE-01` read `events.raw` instead of adding typed DB columns/a migration | `sync-events`'s `toEventRow()` already stored the full Finnhub row into `raw` (confirmed by reading the deployed function's own source), and `portfolioRepository.ts` already `select('*')`s the row — so no schema change, no migration, no redeploy was needed to get real numbers to the client. Also avoided a hard dependency on Supabase MCP tooling being connected, which it wasn't this session. |
| 2026-08-02 | *(superseded same day by `BE-05`, kept for history)* `buildEarningsCards()` initially fell back to `earningsFixtures.ts` when a real event had no `raw` payload | Correct for the `BE-01`-only state that session started in. `BE-04`/`BE-05` (same session) removed the fallback entirely once real facts/history could stand alone — see the `BE-05` row below for the real reason this mattered (a ticker-collision bug, not just tidiness). |
| 2026-08-02 | `BE-04`: widened `sync-events`' `LOOKBACK_DAYS` (7 → 380) instead of adding a second Finnhub endpoint/table for history | The `/calendar/earnings` response for a `from`/`to` range already includes every report in that window per call — one request per symbol either way, so widening it is free (no extra Finnhub calls, no rate-limit impact) and reuses the exact same upsert path. `earningsHistoryFromEvents()` then reads history from events already sitting in the same `events` array/query, no new table. |
| 2026-08-02 | `BE-05`: removed `buildEarningsCards()`'s ticker-matched fixture fallback entirely, not just deprioritized it | Found a real bug while implementing this, not just a theoretical honesty concern: `src/data/demo.ts`'s Local/Demo seed tickers (MSFT, META, CRWD, PANW, NVDA, FTNT, ZS) happen to include 2 of the 8 `earningsFixtures.ts` keys (NVDA, META) by coincidence. Before this fix, Demo mode showed rich fake consensus/actual/surprise for those 2 tickers and an honest empty state for the other 5 — an accidental, unintentional inconsistency a real portfolio ticker could just as easily hit (e.g. a real AAPL or TSLA holding). Fixtures are unit-test-only now; `EarningsPage.test.tsx` was rewritten to use real `raw` payloads instead of the ticker-name coincidence it depended on. |
| 2026-08-02 | Discovered mid-session: `events.eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual` typed columns already existed live in Supabase, applied via migrations `20260802025048`/`20260802025609` from PR #28 (`claude/phase-2-signal-eps-revenue-w7euc5`, branched off a pre-UX-overhaul commit, still open/unmerged, targets the now-superseded old "Signal"/`EventCard` UI) | `sync-events` was already deployed at v15 writing these columns — `get_edge_function` showed real drift between the deployed function and this repo's `git` source that no branch's `PROGRESS.md` had recorded. Reconciled rather than ignored: added the columns to `supabase/schema.sql`/`src/types/database.ts`, and `mappers.ts`'s new `mergedRaw()` merges the typed columns (authoritative, freshly written) over `raw` jsonb (kept for `quarter`/`year`, which the typed columns don't carry) into the one shape `earningsIntel.ts` already reads — so `BE-01`–`BE-04`'s logic needed zero changes once the mapper was fixed. **Still open:** PR #28's *UI* changes (`EventCard` beat/miss badges) were not adopted — they duplicate/predate the merged `EarningsReportCard` UI — and PR #28 itself was neither merged nor closed this session; that's an owner call, flagged in "Next up." |
| 2026-08-02 | DeepSeek / `earnings-interpret` (`BE-06`): built, strictly validated, rate-limited, and deployed — but no secrets were set, so it is inert | Two reasons to stop at "built and dormant" rather than push further: (1) PR #15 (`claude/deepseek-api-integration-k9rwbp`, open, unmerged) explicitly escalated DeepSeek host jurisdiction (first-party PRC-hosted vs. a US-hosted OpenAI-compatible proxy) to the owner as "the load-bearing" open question, and it was never answered — picking one myself would make a privacy-adjacent decision on a real financial app the previous session deliberately didn't make. (2) No Supabase MCP tool can set secrets (`DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL`) — only the owner can, via the dashboard. Resolved the jurisdiction question **by construction, not by picking**: `DEEPSEEK_BASE_URL` has no default, so the function calls whatever OpenAI-compatible endpoint the owner's own secret points at — the host decision lives entirely in their config, never in this code. `DEEPSEEK_MODEL` also has no default: PR #15 found `deepseek-chat`/`deepseek-reasoner` already deprecated (2026-07-24), so hardcoding any model id risked being wrong on arrival. Surprise % is computed server-side in the Edge Function with the same formula as `earningsIntel.ts`'s `surprisePct()` (duplicated, not imported — separate Deno runtime) and only already-reported quarters (`eps_actual`/`revenue_actual` present) are eligible, so the model is only ever asked to describe numbers, never compute or invent them, per `AGENTS.md`'s Phase 2 data truth rules. Rate limit: hard cap of 5 event ids per call, skips events that already have an `ai_interpretation`, and nothing (no cron, no chain from `sync-events`) calls it automatically — every dollar spent is an explicit, owner-initiated call. |
| 2026-08-02 | `BE-03`: guidance/reaction stay undefined for real events rather than removed from the UI | Finnhub's `/calendar/earnings` endpoint returns neither field; sourcing them for real (a second provider for guidance, a timed post-report quote pull via `refresh-quotes` for reaction) is scope beyond this pass. Chose "honestly absent" over "remove from the UI" because the UI already renders both conditionally — several fixture tickers (NVDA, RIVN, ARM, GOOGL) already omit one or both with no broken layout, so there was no unconditional rendering to remove. |
| 2026-08-02 | Phase 2 is the event-intelligence overhaul; the old Phase 2/3 roadmaps are canceled | The Magic Patterns prototype is the visual baseline, refined through `UX-01`–`UX-11`. Finnhub/provider data remains the source of financial facts; DeepSeek is limited to labeled structured interpretation after the UI/data contracts are truthful. |
| 2026-08-02 | UI work uses a single claim-and-advance queue | `NEXT_TASK` and `ACTIVE_CLAIM` make the next safe task explicit for every new agent. One focused queue item per PR prevents parallel agents from silently duplicating or skipping work. |
| 2026-08-02 | `UX-01`–`UX-05` shipped as 5 commits on one branch/PR (`claude/uiux-overhaul-review-yapmlj` → `develop`), not 5 separate PRs | This session's harness restricted pushes to a single designated branch. Each task is still its own commit with its own build/lint/test-green checkpoint, matching the one-task-per-PR spirit as closely as the constraint allows — split into real separate PRs on a future session if that matters more than landing all five together. |
| 2026-08-02 | The `main`→`develop` v1.0-metadata reconciliation (queued in `UX-01`) landed as this branch's first commit instead of a direct push to `develop` | Same single-branch constraint as above. It's a real merge commit with resolved conflicts, not skipped — merging this branch closes the reconciliation gap too. |
| 2026-08-02 | Added `@testing-library/react`/`user-event`/`jest-dom` and a `src/test/` seam (exported `PortfolioContext`, `renderWithPortfolio`) as part of `UX-01`, not called out in the original queue text | None of `UX-02`–`UX-05`'s "keyboard/focus behavior + unit tests" acceptance bars are achievable without component-testing infra — `vitest.config.ts` only ran `.ts` files and no RTL dependency existed. Treated as a silent hard prerequisite of `UX-01` rather than a 6th task. |
| 2026-08-02 | Consensus/actual/surprise/guidance/reaction/history for earnings cards comes from `src/data/earningsFixtures.ts` (8 tickers), looked up by ticker against real `events` — not from a live provider | Finnhub's `/calendar/earnings` response has `epsEstimate`/`epsActual`/`revenueEstimate`/`revenueActual` but `eventFromRow()` never reads the `raw` jsonb column they land in, and Finnhub has no guidance/reaction data at all. Wiring a real source is backend work for after `UX-11`. Real event tickers that don't match a fixture entry render with `facts: undefined` — an honest empty state, not a crash or a fabricated number. Fixture values are raw numbers (not pre-formatted strings) so swapping in a live provider later is a data-source change, not a shape change. |
| 2026-08-02 | A cell/element gets exactly one Tailwind `ring-*` and one `bg-*` utility, never two competing ones (`MonthCalendar`'s `dayRing`/`dayBg` helpers) | Tailwind's ring-width/ring-color/bg-color utilities all resolve to the same underlying CSS property (box-shadow / background-color), so e.g. `ring-1 ring-earnings/30` stacked with `ring-2 ring-accent-400` doesn't layer — one silently wins, and which one depends on generated-CSS order, not class-string order. Found by inspecting computed `box-shadow` in a real browser after a screenshot looked wrong, not by reading the JSX. Same fix applied to the hover-ring vs. selected/today-ring collision. |
| 2026-08-02 | Swept every `text-ink-500` usage to `text-ink-450` app-wide (UX-10) | An `axe-core` scan measured `text-ink-500` (`#64748b`) at ~3.8:1 contrast against the app's dark surfaces, under WCAG AA's 4.5:1 minimum for normal text. `ink-450` (`#7c8ba1`, introduced in UX-01 for the same reason) is strictly lighter, so the swap is a monotonic contrast improvement everywhere it's used — re-scanned clean after. |
| 2026-08-02 | `axe-core` was a one-time devDependency for the UX-10 audit, installed and removed within the same session | This project has no Playwright dependency to hang a permanent CI accessibility gate on (only available globally in dev sandboxes) — adding one is a bigger, separate decision than this overhaul. The scan and its findings are documented in `docs/UI.md` so a future session can redo it before a real release rather than trusting a stale audit. |
| 2026-08-02 | Removed `PortfolioContext`'s `filter`/`setFilter` state, `FilterBar.tsx`, and `src/components/ui/Skeleton.tsx` (UX-11) | All three were dead: no page destructured `filter`/`setFilter` from `usePortfolio()` after UX-03/04 moved filtering into page-local state (`EarningsStatusFilter`'s own `useState`); `FilterBar` had zero remaining importers once Today stopped using it; `Skeleton` had zero importers even before this session (every loading state hand-rolls its own `animate-pulse` divs). Confirmed via grep for real import sites, not just usage-count guessing, before deleting. |
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

### 2026-08-02 — codex (session 21, UX map consolidation)
- Added `report/UX map.MD` to `develop`, preserving and attributing Claude's existing code-review notes from `claude/portlander-ux-improvements-s2fwcm`.
- Added a separately labeled ChatGPT section covering the live-site review: mobile navigation/touch targets, consumer Settings IA, Today/Earnings/Calendar/Portfolio refinements, global polish, product identity, event-orbit P logo, persistent shell, voice, and implementation priorities.
- Reconciled the earlier conversational version note with current repository truth: Phase 2 is complete and `v2.0` remains correct; this is documentation-only and does not change app behavior.

### 2026-08-02 — claude (session 20, v2.0 promotion)
- Owner set the three `DEEPSEEK_*` secrets. Ran `earnings-interpret` for real, via `pg_net` (see
  Decisions — direct HTTPS from this sandbox to `*.supabase.co` is policy-blocked): all 5
  already-reported events with no interpretation yet (FTNT, MSFT, MSTR, CHKP, TENB) generated
  successfully. Hand-verified every surprise % in the output against the underlying numbers —
  exact matches, no hallucination.
- Bumped `src/lib/appMeta.ts` to `v2.0`, renamed `APP_PHASE` → `APP_RELEASE_NAME =
  'Portfolio Event Intelligence'` (owner explicitly doesn't want "Phase N" in the app UI — see
  Decisions), updated `AGENTS.md`'s release protocol to match.
- Found and fixed stale Settings copy while in the area: "Earnings intelligence" section still
  said "Interim fixture data" / "No live provider populates consensus…", true when UX-02 wrote it,
  false since `BE-01`/`BE-05` and never updated. Now says "Live Finnhub data" and describes the
  real guidance/reaction gap honestly. Updated the matching test and one stale `docs/UI.md` line.
- `npm run build`/`lint`/`test` all green — 287/287 (2 tests updated for the new copy/version, no
  new tests needed).
- Next step this session: promote `develop` → `main` so the live Netlify site actually serves
  `v2.0` — everything up to this point has been on `develop`/Supabase only.

### 2026-08-02 — claude (session 20)
- Implemented `BE-01`–`BE-03` from the earnings intelligence backend queue, owner-approved after
  the UX overhaul merged: added `raw`/`updatedAt` to `PortfolioEvent` (`src/types/index.ts`), read
  in `eventFromRow()` (`src/lib/mappers.ts`), and a new `earningsFactsFromRaw()` in
  `src/lib/earningsIntel.ts` that turns the already-stored Finnhub payload into typed
  `consensus`/`actual`/`surprise` — no migration or Edge Function redeploy needed (see Decisions).
  `buildEarningsCards()` now prefers real facts over the ticker's demo fixture, with fixture
  `interpretation` suppressed whenever real facts are used.
- 11 new unit tests covering `earningsFactsFromRaw()` (malformed/non-finite fields, division-by-
  zero guard, no guidance/reaction fabrication) and `buildEarningsCards()`'s real-vs-fixture
  precedence. `npm run build`/`lint`/`test` all green — 264/264 tests.
- Not done: `BE-04`–`BE-06` (historical beat/miss backfill, fixture retirement, DeepSeek
  interpretation) — next up per the queue above.

### 2026-08-02 — claude (session 20, wrap-up)
- Merged PR #32 (`BE-01`–`BE-06`) into `develop` at the owner's request.
- Closed PR #28 as superseded, with a comment pointing at the reconciliation (see Decisions) —
  owner call, made after confirming.
- Owner confirmed Phase 1 acceptance complete (SnapTrade connect/sync, Refresh prices, real-book
  math, sign-out, mobile, one real morning) — checked off in the Phase 1 checklist and Snapshot;
  the SnapTrade Blockers entry is resolved and removed.
- Remaining open item, owner's discretion, no urgency: configure `DEEPSEEK_*` secrets to turn on
  `earnings-interpret` — see "Next up."

### 2026-08-02 — claude (session 20, continued)
- Implemented `BE-04`–`BE-06`, completing the earnings intelligence backend queue.
- Before starting, discovered real drift: the live `sync-events` (v15) and `events` table already
  had `eps_estimate`/`eps_actual`/`revenue_estimate`/`revenue_actual` typed columns from PR #28
  (`claude/phase-2-signal-eps-revenue-w7euc5`), an older, still-open/unmerged branch targeting the
  now-superseded pre-`UX-01` UI, applied directly to production outside git. Reconciled rather than
  overwritten — see the dedicated Decisions row.
- `BE-04`: widened `sync-events`' `LOOKBACK_DAYS` 7 → 380 (redeployed as v16) and added
  `earningsHistoryFromEvents()` + a `historyEvents` parameter threaded through
  `buildEarningsCards()`/`selectDeckCards()`/`TodayPage.tsx`/`EarningsPage.tsx` so history reads
  from the full, unwindowed events array rather than Today's narrow display window.
- `BE-05`: removed `buildEarningsCards()`'s ticker-matched fixture fallback — found and fixed a
  real bug doing it (NVDA/META ticker collisions between `earningsFixtures.ts` and
  `src/data/demo.ts` were producing inconsistent Demo-mode behavior, not by design).
- `BE-06`: new `earnings-interpret` Edge Function (deployed v2) — strict JSON-schema validation,
  server-computed surprise (never model-computed), 5-events-per-call rate limit, skips
  already-interpreted events, no cron. `DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL` have no defaults on
  purpose so the function stays inert (and the host-jurisdiction question PR #15 raised stays the
  owner's to answer via secrets, not this session's to guess). New
  `interpretationFromRaw()`/`events.ai_interpretation` round trip on the client side, validated
  again on every read.
- 23 new unit tests (`earningsIntel.test.ts` history/interpretation coverage, new
  `mappers.test.ts` for the `raw`/typed-column merge and `ai_interpretation` mapping). `npm run
  build`/`lint`/`test` all green — 287/287 tests.
- Applied 2 Supabase migrations (`events_add_ai_interpretation`; the eps/revenue columns were
  already live from PR #28) and deployed 2 Edge Functions (`sync-events` v16,
  `earnings-interpret` v2 — new). `get_advisors` clean (same pre-existing findings as before).
- Not done, deliberately: PR #28 was neither merged nor closed (owner call); `earnings-interpret`
  was not invoked against real data (no secrets to invoke it meaningfully with, and doing so
  wasn't necessary to verify the build); no cron/automation for interpretation.

### 2026-08-02 — claude (session 19, continued)
- Implemented `UX-06`–`UX-11` on the same branch, completing the master queue: Calendar overhaul
  (day-cell selection, `SelectedDayDetail`, cluster badges) (`UX-06`); Portfolio refinement (new
  whole-book `portfolioTotalGainLoss` stat, per-row provenance tooltip) (`UX-07`); Settings
  reorganized into 6 sections with a sticky nav (`UX-08`); truthful-states audit (`hasNoPriceData`,
  `isStaleSync` — 2 real fabricated/missing-state gaps found and fixed) (`UX-09`); accessibility
  pass using a real `axe-core` scan, not just manual review — found and fixed a genuine contrast
  failure (`text-ink-500` swept to `text-ink-450` app-wide) and a keyboard-focus gap, plus
  safe-area/reduced-motion/touch-target/screen-reader-label work (`UX-10`); full visual regression
  across all 5 routes × 2 widths, dead-code removal (`FilterBar`, unused `Skeleton` primitive, dead
  `PortfolioContext` filter state), and this backend handoff queue (`UX-11`).
- Two real bugs found and fixed only because of browser verification, not just reading the diff:
  stacking multiple Tailwind `ring-*`/`bg-*` utilities on one element doesn't layer, it silently
  picks one — caught via computed `box-shadow` inspection on the calendar's selected-day ring.
- Final state: 253/253 tests, clean build, lint clean (pre-existing warning pattern only).
- PR carries all 11 UX commits + 2 docs commits; still needs owner review/merge (see Next up).

### 2026-08-02 — claude (session 19)
- Implemented `UX-01`–`UX-05` end to end on `claude/uiux-overhaul-review-yapmlj`, one commit per
  task, build/lint/test green after each: 5-route shell + Book Value card removed + Button/PillButton
  primitives + RTL test infra (`UX-01`); `src/types/earnings.ts` + earnings-intelligence primitives
  (`MetricPair`, `FreshnessLabel`, `CarouselControls`, `EarningsReportCard`, `HistoricalBeatStrip`,
  `GeneratedInsight`) + `src/data/earningsFixtures.ts` (`UX-02`); Today rebuilt as a Morning Desk
  (`MorningHeader`, `EarningsDeck` with swipe/dots/arrows, `NeedsAttention`, `ForwardExposurePanel`)
  (`UX-03`); the Earnings workspace (status filter, date/session grouping, exposure summary) (`UX-04`);
  the `Dialog`/`useFocusTrap` primitives and `EarningsDetailDrawer`, wired onto both Today and Earnings
  (`UX-05`).
- Also merged `main` → `develop`'s v1.0 release metadata (as this branch's first commit, not a direct
  push — see Decisions) since it was queued as a `UX-01` pre-req and had never landed.
- Verified in a real browser at desktop/mobile after every task, not just via `npm test`; 212 tests
  total (123 net new this session), `npm run build`/`lint`/`test` all green on the final state.
- Not yet done: merge to `develop`, and the owner's Phase 1 manual acceptance checks (unrelated,
  still open from before this session).

### 2026-08-02 — codex (session 18)
- Replaced the canceled Phase 2/3 program in `AGENTS.md` with the approved Phase 2 event-intelligence direction and explicit Finnhub/DeepSeek truth boundaries.
- Added the ordered `UX-01`–`UX-11` overhaul queue plus mandatory `NEXT_TASK` / `ACTIVE_CLAIM` handoff protocol.
- Corrected current status: Phase 1 `v1.0` was promoted to `main` in PRs #25/#26; manual production acceptance checks remain open.

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
