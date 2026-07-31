# PROGRESS.md — Portlander live status

**Last updated:** 2026-07-31  
**Last agent:** claude-code  
**Current phase:** Phase 1 — Foundation (cloud deploy underway) → Phase 1.5 SnapTrade scoping starting  
**Phase 1 status:** 🟡 In progress — local app done; **owner now actively deploying cloud** (Netlify live, Supabase schema + Edge Function deployed, secret + cron pending)

> **Protocol:** Every agent must read `AGENTS.md` + this file before work, and update this file after work (session log + next up) without being asked.

---

## Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Agent protocol | ✅ Done | AGENTS.md + PROGRESS.md |
| UI shell + Today/Calendar/Portfolio | ✅ Done | Premium dark local app |
| Local holdings + CSV | ✅ Done | localStorage |
| Impact score v0 + exposure strip | ✅ Done | |
| Supabase client (optional) | ✅ Done | **Cloud mode now active by owner request** (was deferred, see 2026-07-31 decision) |
| **Local Finnhub sync** `npm run sync:events` | ✅ Done | Writes `public/data/events-sync.json` |
| **App merge of sync file** | ✅ Done | Boot + Settings Reload |
| **Edge Function sync-events** | ✅ Deployed | Live on Supabase project `vvstmdnnpjnfvueoecwl` (`ref` = project id), `verify_jwt: true` |
| **Supabase schema applied** | ✅ Done | `holdings`/`watchlist`/`events`/`sync_runs` live, RLS on all 4, 0 security advisories |
| **Netlify production deploy** | ✅ Live | `https://portlander.netlify.app` — Git-linked to `main`, confirmed working by owner |
| `FINNHUB_API_KEY` Edge secret | ⏳ Owner action | Owner has the key; needs to paste into Supabase Dashboard → Project Settings → Edge Functions → Secrets |
| Daily cron for sync-events | ⏳ Owner action | Owner couldn't find "Schedules" tab under the function page as this file's README suggested — likely needs Database → Cron Jobs (`pg_cron`) instead; unresolved when session ended |
| Phase 1 exit criteria / dogfood | ⏳ Next | Real portfolio imported and app confirmed working; formal sign-off not yet marked |
| **SnapTrade (Fidelity) integration** | 🆕 New scope, not started | Owner wants live read-only Fidelity holdings via SnapTrade. Not in original AGENTS.md stack. See Decisions + Session log below. |

---

## Phase 1 checklist

### Completed
- [x] Scaffold, UI, scoring, local data, agent docs
- [x] Supabase client + mappers + repository (optional; cloud deferred)
- [x] Edge Function implementation (Finnhub → events + sync_runs)
- [x] Local `scripts/sync-events.mjs` + `npm run sync:events`
- [x] App loads/merges `/data/events-sync.json` without cloud
- [x] Settings docs for local sync path
- [x] Build passes

### Cloud deploy (active now — was deferred, owner requested it)
- [x] Netlify site live, Git-linked to `main`, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` env vars set
- [x] Supabase schema applied to project `vvstmdnnpjnfvueoecwl`
- [x] `sync-events` Edge Function deployed
- [ ] `FINNHUB_API_KEY` secret set on the Edge Function (owner has the key, hasn't pasted it in yet)
- [ ] Daily cron wired up to invoke `sync-events` (blocked — see Blockers)
- [ ] Owner signs in via magic link on the live site once cron/secret are done — note: local holdings do **not** auto-migrate to Supabase on first sign-in, owner will need to re-import CSV once signed in (see `PortfolioContext.tsx` boot logic)

### Not started / owner
- [x] Finnhub API key obtained + first real `npm run sync:events` (done earlier this session)
- [x] Real portfolio CSV dogfood (done)
- [ ] Phase 1 exit criteria sign-off (functionally close, not formally marked)

### SnapTrade (new, not in original scope — see Decisions)
- [ ] Owner to get app-level SnapTrade `clientId` + `consumerKey` from SnapTrade's developer dashboard (attempted on mobile, UI was unusable — retry on desktop)
- [ ] Build new Edge Function for the Fidelity connection-portal + webhook flow
- [ ] New Supabase table for linked SnapTrade accounts/tokens, RLS-scoped by `user_id`
- [ ] Decide how synced SnapTrade positions map into `holdings`
- Note: a **personal** SnapTrade MCP connector was available in-session with the owner's real Fidelity account already linked (2 accounts, live balances) — this is scoped to chat access only and is **not** reusable as the app's credentials; the app-level integration above is still fully unbuilt

### Phase 1 exit criteria
- [ ] Real portfolio loadable
- [ ] Earnings from Finnhub (via sync file or Edge) not only demo offsets
- [ ] Weight ranking + exposure % sanity
- [ ] Snappy UI
- [ ] Used on a real morning once

---

## Next up (ordered)

1. **Owner:** set `FINNHUB_API_KEY` as an Edge Function secret in the Supabase dashboard (Project Settings → Edge Functions → Secrets) — key already obtained.
2. **Owner + agent:** resolve where to actually configure the daily cron — likely Database → Cron Jobs (`pg_cron`) rather than a per-function "Schedules" tab; try setting it directly via SQL (`cron.schedule` + `net.http_post`) through the Supabase MCP connector next time it's connected, rather than dashboard-hunting further.
3. **Owner:** sign in via magic link on the live Netlify site once cron is confirmed working; re-import holdings CSV post-sign-in (local→cloud doesn't auto-migrate).
4. Mark Phase 1 exit criteria formally once the above is confirmed working end-to-end on the live site.
5. **Owner:** retry getting the SnapTrade app-level `clientId`/`consumerKey` from a desktop browser (mobile UI was unusable).
6. Once SnapTrade keys are in hand: scope and build the actual integration (new Edge Function, new table, UI) — this is new work, not in the original Phase 1/2/3 plan in `AGENTS.md`.
7. Phase 1 exit criteria → then Phase 2 (prep cards, journal, alerts) — SnapTrade work above is separate from and can proceed in parallel with this.

---

## Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Can't find Supabase "Schedules" tab under Edge Functions → sync-events | Daily sync cron not yet configured | Likely under Database → Cron Jobs (`pg_cron`) instead — unverified live; try via Supabase MCP `execute_sql` next session |
| Supabase/Netlify MCP connectors intermittently disconnect mid-session | Can't always verify/act live | Ambient session issue, not project-side; retry when reconnected |
| SnapTrade app-level dev keys incomplete | Can't build the real integration yet | Owner has one of two keys; retry getting the other from a desktop browser, not mobile |

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | Cloud mode deferred | Owner request — focus local dogfood |
| 2026-03-25 | Dual sync paths: local script + Edge Function | Local now; cloud later without rewrite |
| 2026-03-25 | Deterministic event UUIDs | Stable upserts by id |
| 2026-03-25 | Browser never calls Finnhub | Key stays in env / Edge secrets only |
| 2026-03-25 | `events-sync.json` gitignored | Generated artifact |
| 2026-07-31 | `mergeEvents` dedups by ticker, not ticker+date, when purging stale demo/local earnings | Demo seed dates are arbitrary "today+N" offsets that (almost) never equal the real Finnhub calendar date, so the old ticker+date match silently never fired — owner ran a real sync and still saw wrong dates because stale demo entries kept coexisting with real ones. Ticker-level purge (still source-gated: only non-Finnhub entries are dropped, existing Finnhub-sourced entries are left alone) fixes it without touching historical Finnhub data. |
| 2026-07-31 | **Cloud mode un-deferred** — owner explicitly requested Netlify + Supabase deployment | Owner has accounts for both, wants a real production deployment now, not just local dogfood. Supersedes the 2026-03-25 "cloud deferred" decision. |
| 2026-07-31 | New `develop` branch created (mirrors `main` at merge of PR #1) | Owner has limited Netlify build minutes; Netlify's production branch is `main`, and pushing to `develop` triggers no build (branch deploys off by default). New workflow: push/review on `develop`, only merge to `main` when ready to actually ship, since that's the only push that costs a build. Agents should target PRs at `develop`, not `main`, going forward, unless told otherwise. |
| 2026-07-31 | SnapTrade added as new planned scope (read-only Fidelity holdings sync) | Owner's explicit request, confirmed as read-only (not trading — stays consistent with `AGENTS.md`'s brokerage-trading non-goal). Not yet in `AGENTS.md`'s locked stack — should be added there once the integration is actually built, per the file's own rule about not changing stack silently. |

---

## Session log

### 2026-07-31 — claude-code (session 5)
- **Context:** owner decided to move Portlander from local-only to a real cloud deployment
  (Netlify + Supabase), and separately wants to add live read-only Fidelity holdings via
  SnapTrade. This session did the deployment legwork and hit a couple of real gaps.
- **Netlify:** owner connected the GitHub repo via Netlify's own Import-from-Git flow
  (proper continuous deployment, not a one-off push). Confirmed live at
  `https://portlander.netlify.app`, matches local `npm run dev` output. `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` env vars set (values from the Supabase project below).
- **Netlify build-minute conservation:** owner is on a limited-credit plan. Established
  workflow: create/push to `develop` (mirrors `main`, created this session), only merge to
  `main` when ready to actually deploy — see Decisions. Also flagged: Deploy Previews for
  PRs may still be consuming minutes separately from `main` pushes; owner should check
  Site configuration → Build & deploy → Deploy contexts and disable/restrict if unwanted.
- **Supabase — a real MCP connector (`mcp__Supabase__*`) became available mid-session**,
  giving direct project access (distinct from the CLI-based instructions given earlier).
  Used it to:
  - Confirm the project (`Portlander`, id/ref `vvstmdnnpjnfvueoecwl`) existed but was
    **completely empty** — the owner's earlier attempt to paste the schema into the SQL
    Editor hadn't actually taken.
  - Apply the full `supabase/schema.sql` via `apply_migration` — all 4 tables now live,
    RLS enabled on all of them, confirmed via `list_tables` + `get_advisors` (0 lints).
  - Deploy `supabase/functions/sync-events/index.ts` via `deploy_edge_function`.
    **Caught and fixed a mistake**: first deploy used `verify_jwt: false`, which would have
    let anyone who found the URL trigger the sync and burn Finnhub quota, since the
    function has no auth logic of its own — redeployed immediately with `verify_jwt: true`
    (function is now version 2).
  - **Could not** set the `FINNHUB_API_KEY` Edge Function secret or a cron schedule —
    this MCP tool surface has no secrets-management or cron tool exposed. Owner has the
    Finnhub key in hand, needs to paste it into Project Settings → Edge Functions →
    Secrets themselves.
  - Owner then couldn't find the "Schedules" tab under Edge Functions → sync-events that
    this repo's own function README describes — that instruction may be stale (dashboard
    UI likely moved). Best current guess, unverified live: Database → Cron Jobs
    (`pg_cron`), not nested under the function page. Left unresolved at session end —
    **next agent: try setting this via `execute_sql` with `cron.schedule(...)` +
    `net.http_post(...)` directly through the Supabase MCP connector if it's available**,
    rather than continuing to guess at dashboard navigation.
- **SnapTrade — clarified real scope.** Owner's actual intent: link their real Fidelity
  account read-only so SnapTrade supplies live portfolio holdings while Finnhub supplies
  market/earnings data, for analysis — not trading (consistent with `AGENTS.md`'s
  brokerage non-goal). A **SnapTrade MCP connector** (`mcp__Snaptarde__*`) also became
  available mid-session and turned out to already have the owner's real Fidelity account
  linked (`getPartnerInfo` showed `is_personal: true` — a personal connection scoped to
  this chat). Important distinction documented for future agents: **this chat-level access
  does not give the deployed Portlander website that ability.** The website needs its own
  separate SnapTrade developer registration (`clientId` + `consumerKey`), which is what the
  owner was originally trying to obtain. Owner got one of the two keys via mobile, couldn't
  get the second (mobile UI issues) — advised to retry on desktop. No SnapTrade integration
  code has been written yet; this is a new, unscoped feature, not part of original Phase
  1/2/3 plan in `AGENTS.md`.
- **MCP connector instability:** Supabase/Netlify/SnapTrade connectors disconnected and
  reconnected several times throughout this session (ambient, not project-related) —
  several steps had to be retried or deferred because a needed connector was temporarily
  unavailable. Worth expecting the same next session.
- **Files touched this session:** none in the app code — all changes were live
  infrastructure (Supabase project, Netlify site config, new `develop` git branch) plus
  this `PROGRESS.md` update.
- **Owner is moving to a new chat session** — this entry is the handoff.

### 2026-07-31 — claude-code (session 4)
- **Bug reported by owner:** after running a real `npm run sync:events` + importing a real
  holdings CSV, earnings dates shown in the app for some tickers were wrong.
- **Root cause found:** `mergeEvents` (`src/lib/eventSync.ts`) only dropped a stale
  demo/local earnings row when it matched an incoming Finnhub row on *both* ticker and
  exact `eventDate`. Demo seed dates (`src/data/demo.ts`) are arbitrary "today + N day"
  placeholders unrelated to the real earnings calendar, so that match essentially never
  fires — the old placeholder date and the new real Finnhub date ended up coexisting in
  `localStorage`, and the placeholder (usually sooner-looking) is what surfaced on
  Today/Calendar for any ticker overlapping the built-in demo set (MSFT, NVDA, META,
  CRWD, PANW, FTNT, ZS).
- **Fix:** `mergeEvents` now purges stale non-Finnhub earnings for a ticker whenever *any*
  real Finnhub earnings row exists for that ticker in the incoming sync, regardless of
  date. Finnhub-sourced entries are still never purged by this path (deliberately — see
  follow-up note below), so historical/past confirmed data isn't affected.
- **Verified:** `npm run build` (`tsc -b && vite build`) and `npm run lint` (`oxlint`) both
  pass clean (one pre-existing unrelated warning in `PortfolioContext.tsx`). Also wrote a
  standalone before/after repro (old logic vs. new logic against the exact reported
  scenario) confirming the old code produces 2 conflicting MSFT entries and the new code
  produces 1 correct one, with an unrelated ticker's demo entry left untouched when no
  Finnhub data exists for it yet.
- **Files:** `src/lib/eventSync.ts` only.
- **Follow-up (not fixed, noted for next agent):** the same staleness pattern can in
  theory recur *between* two real Finnhub syncs — if a ticker's earnings date gets
  rescheduled, the old (now-wrong) Finnhub-sourced row isn't purged either, since this fix
  intentionally only targets non-Finnhub rows (to avoid deleting legitimate past/historical
  Finnhub data that falls outside the current sync's lookback window). If this shows up in
  practice, the right fix is date-aware — purge old *future/estimated* Finnhub rows for a
  ticker not present in the new sync, but keep past ones — not a blanket ticker purge.
- **Owner:** should re-run `npm run sync:events` (or click Settings → Reload data) and
  confirm the previously-wrong tickers now show a single correct date.

### 2026-03-25 — grok-build (session 3)
- Implemented `supabase/functions/sync-events/index.ts` (Finnhub earnings + macro seed + sync_runs).
- Implemented local `scripts/sync-events.mjs`, `scripts/tickers.txt`, `npm run sync:events`.
- Added `src/lib/eventSync.ts`; boot + Reload merge `/data/events-sync.json`.
- Settings: local sync instructions; cloud marked deferred.
- README / .env.example / .gitignore / function README updated.
- **Build:** OK.
- **Follow-up:** Owner runs Finnhub sync; agents polish only if asked; cloud deploy later.

### 2026-03-25 — grok-build (session 2)
- Supabase client + repository + magic-link Settings (cloud optional).

### 2026-03-25 — grok-build (session 1)
- Phase 1 scaffold + UI + local demo.

---

## Notes for the next agent

1. **Cloud mode is now active** (owner explicitly requested it 2026-07-31 — the old "do
   not push cloud mode" guidance is superseded, see Decisions). Netlify + Supabase are both
   live; Edge Function is deployed. What's left: `FINNHUB_API_KEY` secret + cron (owner
   action / blocked, see Blockers), then owner sign-in + re-import CSV on the live site.
2. **Branch workflow changed**: push/PR to `develop` (not `main`) for review; only merge
   `develop` → `main` when ready to actually trigger a Netlify production deploy — owner
   has limited build minutes. Ask before pushing directly to `main`.
3. Local sync command still works as a fallback: `npm run sync:events` (needs
   `FINNHUB_API_KEY` in your shell env, separate from the Supabase Edge secret above).
4. Demo events use relative dates; after sync, Finnhub rows replace *any* stale demo/local
   earnings for that ticker (ticker-level match, not ticker+date — see 2026-07-31 decision).
5. **SnapTrade is new, unscoped work** — see the SnapTrade checklist above and the session
   5 log entry for full context before starting on it. Don't assume any code exists yet.
6. If a Supabase MCP connector (`mcp__Supabase__*`) is available, prefer it over asking the
   owner to click through the dashboard — it can apply schema/deploy functions directly,
   and likely `execute_sql` for the still-unresolved cron setup. Same for Netlify
   (`mcp__Netlify__*`) and SnapTrade (`mcp__Snaptarde__*`) if present — check via ToolSearch
   before assuming they're unavailable, they were intermittent this session.
7. Update this file after your session.
