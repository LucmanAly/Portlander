# PROGRESS.md — Portlander live status

**Last updated:** 2026-07-31
**Last agent:** claude-code
**Current phase:** Phase 1 — Foundation, cloud deploy complete → Phase 1.5 SnapTrade scoping
**Phase 1 status:** 🟢 Cloud deploy live and verified end-to-end. UI fixes + a new manual "Refresh prices" feature are built but **unmerged** — in **PR #4**, not PR #3 (see PR state below). Only formal Phase 1 exit sign-off left.

> **Protocol:** Every agent must read `AGENTS.md` + this file before work, and update this file after work without being asked. See `AGENTS.md`'s "Keep PROGRESS.md lean" section — this file was rewritten 2026-07-31 to cut session-log bloat; keep it that way.

---

## Snapshot

Single source of truth for current state. If it's here, don't re-explain it elsewhere in this file.

| Area | Status | Notes |
|------|--------|-------|
| Local app (UI shell, scoring, CSV, demo) | ✅ Done | Premium dark app, Today/Calendar/Portfolio/Settings |
| Supabase project `vvstmdnnpjnfvueoecwl` | ✅ Live | Schema (`holdings`/`watchlist`/`events`/`sync_runs`, RLS on all 4) applied, 0 security advisories |
| Netlify | ✅ Live | `https://portlander.netlify.app`, git-linked to `main`. Owner is on limited build minutes — see Decisions for the `develop` workflow |
| `sync-events` Edge Function | ✅ Live | Global/unscoped (writes shared `events` rows), `verify_jwt: true`, `FINNHUB_API_KEY` set and confirmed working |
| Daily cron | ✅ Live | `pg_cron` job `daily-sync-events`, `0 11 * * *` UTC, 60s `pg_net` timeout. Owner can retune the time via `select cron.alter_job(1, schedule => '<expr>');` |
| Owner sign-in + real sync | ✅ Confirmed | Magic-link auth works (after an Auth Site URL fix), 40 real holdings imported, 34 real Finnhub earnings events confirmed live in `events` |
| `refresh-quotes` Edge Function | ✅ Deployed | First **user-scoped** function in the project — see Decisions. Powers a new manual "Refresh prices" UI control. Auth boundary verified (anon-key-only request correctly 401s); full authenticated click-through still needs the owner's own test |
| Calendar/Today UI fixes | ✅ Built | Sort toggle, full date labels, ticker-truncation bug, BMO/AMC coloring, 30-day agenda bug — all fixed, see PR #4 |
| SnapTrade integration | 🟡 Keys obtained, nothing built | Owner has `clientId`/`consumerKey`, not yet stored as Edge secrets. New table + 2 Edge Functions + UI + a holdings-merge decision all still needed |
| Phase 1 exit criteria | 🟡 2 of 5 met | See checklist below |

### PR state (check before trusting any PR number in this file)

- PR #1, #2: merged.
- **PR #3: merged early** by the owner, right after opening — only captured the first of five commits on the branch (the cloud-sync-confirmed writeup).
- **PR #4** (same branch `claude/portlander-cloud-handoff-eqnr94` → `develop`): carries the four commits PR #3 missed — UI fixes, Finnhub research docs, the `refresh-quotes` feature. **Currently open, unmerged.** This is the one to review.

---

## Phase 1 checklist

- [x] Scaffold, UI, scoring, local data, agent docs, build passes
- [x] Cloud deploy: Netlify + Supabase schema + `sync-events` + secret + daily cron, all live
- [x] Owner signed in, real CSV imported, real Finnhub sync confirmed (34 events)
- [x] Calendar/Today UI fixes built (PR #4, unmerged)
- [x] Manual "Refresh prices" feature built (PR #4, unmerged)
- [ ] PR #4 merged and confirmed live by owner
- [ ] Phase 1 exit criteria formally signed off (see below)

### Phase 1 exit criteria
- [x] Real portfolio loadable
- [x] Earnings from Finnhub, not only demo offsets
- [ ] Weight ranking + exposure % sanity (math unchanged, not yet formally owner-verified)
- [ ] Snappy UI (fixes are built, awaiting owner confirmation on live site post-merge)
- [ ] Used on a real morning once

### SnapTrade (new scope, not in original `AGENTS.md` plan)
- [x] Owner obtained app-level `clientId` + `consumerKey`
- [ ] Store as Supabase Edge secrets `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` (owner action — no MCP tool can do this)
- [ ] New `snaptrade_connections` table (RLS-locked, service-role-write-only — stores SnapTrade's per-user `userSecret`, as sensitive as a password)
- [ ] New Edge Function: register user + generate Connection Portal link
- [ ] New Edge Function: pull holdings once connected
- [ ] "Connect Fidelity" UI (likely Settings)
- [ ] Decide how synced positions map into `holdings` (overwrite vs. `source`-tagged coexistence with manual/CSV holdings)

Note: a **personal** SnapTrade MCP connector has appeared in some sessions with the owner's real Fidelity account already linked — that's chat-scoped only, not reusable as the app's own credentials. Verified real API flow (SnapTrade's docs, not memory): `registerUser` → `userSecret`, then `loginSnapTradeUser` → a 5-minute Connection Portal URL. This integration is bigger/higher-stakes than `refresh-quotes` (external OAuth-like flow, a second per-user secret, a real holdings-merge decision) — plan it with the same rigor before writing code.

---

## Next up (ordered)

1. **Owner:** review and merge **PR #4** (not #3), then `develop` → `main` when ready to spend a Netlify build.
2. **Owner:** click-test "Refresh prices" live while signed in — confirm a holding's price updates. Not verified from the agent sandbox (no real user session available; deliberately didn't try to mint one).
3. **Owner:** paste SnapTrade keys into Supabase secrets (names above).
4. **Owner (optional):** retune the `11:00 UTC` cron time to your actual timezone.
5. **Owner (still unaddressed since session 5):** check Netlify → Site configuration → Build & deploy → Deploy contexts — Deploy Previews for PRs may be consuming build minutes separately from `main` pushes, worth confirming given the limited-minutes plan.
6. Mark Phase 1 exit criteria formally once #1-2 are confirmed.
7. Once SnapTrade secrets are stored: scope and build the integration (see checklist above).
8. Phase 2 (prep cards, journal, alerts) — separate from SnapTrade work, can proceed in parallel once Phase 1 is signed off.

**Open discussion, not a task yet:** Finnhub rate-limit strategy for adding PE ratio/market cap later. Verified (not memory): 60 calls/min free-tier limit, no daily cap; the earnings-calendar endpoint has a bulk mode (omit `symbol`, get all companies in one call); PE/market cap are price-derived and should refresh 2-3x/day, not weekly (corrected an earlier wrong suggestion); Netlify/Supabase costs are a non-issue at this scale — Finnhub's per-minute limit is the only real constraint. Proposed shape if built: daily bulk earnings call + a 2-3x/day PE/market-cap sync paced ~1.1s/ticker. **Owner hasn't decided whether to build this yet.**

**Advisory, not a task:** owner asked for an opinion on page architecture as the app scales into Phase 2/3. Recommendation: dedicated pages for major new concerns (journal, daily briefing, risk radar), but keep single-item detail (a prep card, notes on one holding) as inline/modal content rather than a new page per item.

---

## Blockers

None currently active. (Resolved blockers are deleted, not kept — see `AGENTS.md`'s lean-file protocol. Ambient MCP-connector disconnects/reconnects are not a project blocker, just expect them.)

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

---

## Session log

Keep entries short — a few bullets, key files, pointer to the PR/commit for full detail. Don't re-narrate git history here.

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
5. **SnapTrade: keys obtained, nothing built.** Check the checklist above before assuming secrets are stored or any code exists.
6. If a Supabase/Netlify/SnapTrade MCP connector is available, prefer it over asking the owner to click through a dashboard for anything it can do — they reconnect with new internal tool IDs frequently in this project, check via ToolSearch rather than assuming unavailability.
7. **Keep this file lean** — see `AGENTS.md`'s protocol section. Short session-log entries, delete resolved blockers, edit Decisions rows in place rather than layering corrections on top.
