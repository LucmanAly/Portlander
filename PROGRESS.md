# PROGRESS.md — Portlander live status

**Last updated:** 2026-07-31  
**Last agent:** claude-code  
**Current phase:** Phase 1 — Foundation (cloud deploy underway) → Phase 1.5 SnapTrade scoping starting  
**Phase 1 status:** 🟢 Cloud deploy essentially complete — Netlify live, Supabase schema + Edge Function + daily cron all live, `FINNHUB_API_KEY` set, owner signed in and real portfolio synced with real Finnhub data confirmed end-to-end. Several owner-reported UI glitches (calendar ticker truncation, missing full dates, 30-day agenda bug) fixed same session, in PR #3 awaiting merge. Only formal Phase 1 exit sign-off left.

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
| `FINNHUB_API_KEY` Edge secret | ✅ Done | Owner pasted it into Supabase Dashboard → Project Settings → Edge Functions → Secrets. Confirmed working: a manual sync trigger reached Finnhub and returned real data, not the "Missing secrets" 500 the function returns when unset. |
| Daily cron for sync-events | ✅ Done | `pg_cron` job `daily-sync-events` (jobid 1) live, runs `0 11 * * *` UTC, calls `net.http_post` against the Edge Function with the anon key as bearer auth, `timeout_milliseconds := 60000` (bumped from the 5s default — see session 6 log). Set directly via `execute_sql`/`apply_migration` through the Supabase MCP connector — the dashboard "Schedules" tab this file used to point to doesn't exist; `Database → Cron Jobs` UI was never actually used either, SQL was more reliable. |
| Owner sign-in + real sync | ✅ Done | Owner signed in via magic link (after fixing a Supabase Auth Site URL misconfiguration — see session 6 log), re-imported CSV (40 holdings), and a manually-triggered sync confirmed 34 real Finnhub earnings events landed in `events` with correct `confirmed`/`estimated` status and real dates. |
| Phase 1 exit criteria / dogfood | 🟡 Nearly there | Real portfolio imported, real Finnhub data confirmed live end-to-end; formal sign-off not yet marked (see Phase 1 exit criteria checklist) |
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
- [x] `FINNHUB_API_KEY` secret set on the Edge Function
- [x] Daily cron wired up to invoke `sync-events` (`pg_cron` + `pg_net`, `0 11 * * *` UTC, 60s timeout — see Decisions/session 6)
- [x] Owner signs in via magic link on the live site — hit and fixed a Supabase Auth Site URL misconfig along the way (was still default `localhost:3000`, see session 6); re-imported CSV post-sign-in (40 holdings landed in Supabase)

### Not started / owner
- [x] Finnhub API key obtained + first real `npm run sync:events` (done earlier this session)
- [x] Real portfolio CSV dogfood (done)
- [x] Cloud sync end-to-end confirmed with real data (34 events, real dates/status — session 6)
- [ ] Phase 1 exit criteria sign-off (functionally complete, not formally marked)

### SnapTrade (new, not in original scope — see Decisions)
- [ ] Owner to get app-level SnapTrade `clientId` + `consumerKey` from SnapTrade's developer dashboard (attempted on mobile, UI was unusable — retry on desktop)
- [ ] Build new Edge Function for the Fidelity connection-portal + webhook flow
- [ ] New Supabase table for linked SnapTrade accounts/tokens, RLS-scoped by `user_id`
- [ ] Decide how synced SnapTrade positions map into `holdings`
- Note: a **personal** SnapTrade MCP connector was available in-session with the owner's real Fidelity account already linked (2 accounts, live balances) — this is scoped to chat access only and is **not** reusable as the app's credentials; the app-level integration above is still fully unbuilt

### Phase 1 exit criteria
- [x] Real portfolio loadable (40 real holdings imported into cloud Supabase, confirmed via DB query — session 6)
- [x] Earnings from Finnhub (via sync file or Edge) not only demo offsets (34 real events with real dates/status confirmed live in `events` — session 6)
- [ ] Weight ranking + exposure % sanity (not yet formally verified by owner, though the impact-score math is unchanged and was already spot-checked in dev screenshots this session)
- [ ] Snappy UI (owner flagged several concrete glitches this session — calendar ticker truncation, missing full dates, 30-day agenda only showing ~14 days — all fixed in PR #3; awaiting owner confirmation on the live site post-merge)
- [ ] Used on a real morning once (owner to confirm after a real daily cron run)

---

## Next up (ordered)

1. **Owner:** pull PR #3 (`claude/portlander-cloud-handoff-eqnr94` → `develop`) live and confirm the Today sort toggle, full weekday date labels, calendar ticker visibility, BMO/AMC coloring, and 30-day agenda look right on the real site with real data.
2. Once confirmed: merge PR #3 → `develop`, then `develop` → `main` when ready to spend a Netlify build (this PR *does* touch `src/`, unlike the infra-only work before it, so this merge actually needs a real deploy).
3. **Owner (optional):** the daily cron currently runs at `0 11 * * *` UTC (chosen arbitrarily as "a reasonable morning" — see Decisions). Adjust to taste with `select cron.alter_job(1, schedule => '<new cron expr>');` via the Supabase SQL editor or MCP `execute_sql` once a preferred local time is known.
4. Mark Phase 1 exit criteria formally — functionally everything is confirmed working end-to-end (real sign-in, real CSV import, real Finnhub sync, and now the UI glitches the owner flagged); this is just the formal checkbox in the Phase 1 exit criteria section below. "Snappy UI" criterion is now much closer given this session's fixes.
5. **Discussion, not yet decided:** Finnhub free-tier rate-limit strategy for scaling beyond earnings-only sync (owner wants PE ratio, market cap, other fundamentals later). Current sync does one `/calendar/earnings` call per ticker with a 200ms pace; a same-session discussion covered switching to Finnhub's un-filtered (no `symbol` param) earnings-calendar call — believed to return ALL companies' earnings for a date range in a single call, which would need only 1 API call total instead of N — plus fetching future fundamentals (PE/market cap) weekly instead of daily to keep the added budget small, and per-ticker pacing (~1.1s) as a floor if per-symbol calls stay necessary. **Not implemented — owner has not decided on the approach yet.** Revisit before building any new Finnhub-backed metric.
6. **Owner:** retry getting the SnapTrade app-level `clientId`/`consumerKey` from a desktop browser (mobile UI was unusable).
7. Once SnapTrade keys are in hand: scope and build the actual integration (new Edge Function, new table, UI) — this is new work, not in the original Phase 1/2/3 plan in `AGENTS.md`.
8. Phase 1 exit criteria → then Phase 2 (prep cards, journal, alerts) — SnapTrade work above is separate from and can proceed in parallel with this.

---

## Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| ~~Can't find Supabase "Schedules" tab under Edge Functions → sync-events~~ | ~~Daily sync cron not yet configured~~ | **Resolved 2026-07-31 (session 6):** the dashboard tab doesn't exist; cron configured directly via SQL (`pg_cron` + `pg_net`) through the Supabase MCP connector instead. See Decisions/session log. |
| ~~`FINNHUB_API_KEY` not yet set as an Edge Function secret~~ | ~~Cron would invoke `sync-events` but the function would fail~~ | **Resolved 2026-07-31 (session 6):** owner set it; confirmed working via manual trigger (real Finnhub data returned, not the "Missing secrets" error). |
| ~~Supabase Auth "Site URL" was default `http://localhost:3000`~~ | ~~Magic-link emails redirected to a dead `localhost:3000` link instead of the live site~~ | **Resolved 2026-07-31 (session 6):** owner updated Site URL + Redirect URLs in Supabase Dashboard → Authentication → URL Configuration to `https://portlander.netlify.app`. Not fixable via any available MCP tool (no Auth-config tool exists) — owner-only dashboard setting. |
| Supabase/Netlify/SnapTrade MCP connectors intermittently disconnect and reconnect (with new internal tool IDs) mid-session | Can't always verify/act live; happened repeatedly again this session | Ambient session issue, not project-side; retry when reconnected |
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
| 2026-07-31 | Daily cron configured via `pg_cron` + `pg_net` (SQL), not a dashboard "Schedules" tab | The tab this file previously pointed to doesn't exist in the current Supabase dashboard — confirmed stale. `execute_sql`/`apply_migration` through the Supabase MCP connector applied it directly: enabled both extensions, then `cron.schedule('daily-sync-events', '0 11 * * *', ...)` wrapping `net.http_post` against the Edge Function URL with the anon key as `Authorization: Bearer`. Anon key was used (not service role) since `verify_jwt: true` only requires *a* valid Supabase-issued JWT, and the anon key is already public in the deployed frontend bundle — no new secret exposure. |
| 2026-07-31 | Cron schedule set to `0 11 * * *` UTC (arbitrary default) | No owner timezone was on record; picked a plausible "morning somewhere in the US" slot rather than blocking on it. Owner should adjust via `cron.alter_job` once a preferred local time is confirmed — see Next up. |
| 2026-07-31 | Cron job's `net.http_post` given `timeout_milliseconds := 60000` (up from `pg_net`'s 5000ms default) | A real 40-ticker sync took ~16s server-side (sequential per-ticker Finnhub calls with a 200ms pacing delay each), which blew past the 5s default and made `pg_net` log a client-side timeout even though the Edge Function ran to full completion regardless (confirmed via `sync_runs.finished_at`). 60s gives headroom as the holdings list grows and makes `pg_net`'s logged response accurate instead of a misleading timeout. |

---

## Session log

### 2026-07-31 — claude-code (session 6)
- **Context:** picked up the session 5 handoff. The one concrete unresolved item was the
  daily cron for `sync-events` — session 5 suspected `Database → Cron Jobs` (`pg_cron`)
  was the real mechanism (not the "Schedules" tab the function README pointed to) and
  recommended trying it via the Supabase MCP connector directly if available this session.
  It was available.
- **Branch note:** this session's designated branch
  (`claude/portlander-cloud-handoff-eqnr94`) had fallen behind `develop` (missing the
  session-5 `PROGRESS.md` handoff commit `576ca3f`). Fast-forwarded it to `develop`'s tip
  before starting so nothing from session 5 was lost.
- **Cron — resolved.** Via the Supabase MCP connector against project `vvstmdnnpjnfvueoecwl`:
  - `list_extensions` confirmed `pg_cron` and `pg_net` were available but not installed.
  - `apply_migration` enabled both (`create extension if not exists pg_cron;` /
    `pg_net;`).
  - `apply_migration` scheduled the job:
    `cron.schedule('daily-sync-events', '0 11 * * *', $$ select net.http_post(url :=
    '.../functions/v1/sync-events', headers := ..., body := '{}'::jsonb) $$)`. The
    Authorization header uses the project's legacy anon JWT (via `get_publishable_keys`) —
    `verify_jwt: true` on the function just needs a valid Supabase-issued JWT, and the anon
    key is already public in the shipped frontend, so this doesn't introduce a new secret.
  - Verified via `execute_sql` against `cron.job`: job id 1, `daily-sync-events`, schedule
    `0 11 * * *`, `active: true`.
  - `get_advisors` (security) flagged one WARN after enabling `pg_net`: extension installed
    in the `public` schema. Attempted `alter extension pg_net set schema extensions;` to
    clean it up — **pg_net does not support `SET SCHEMA`** (Postgres error 0A000). Left as
    is; this is a known/cosmetic lint for `pg_net` specifically on Supabase-managed
    projects, not a real exposure, and not worth dropping/recreating the extension (which
    would risk the cron job's dependency) to silence.
  - **Not done, still owner-only:** the cron will fire on schedule but the function itself
    will fail server-side until `FINNHUB_API_KEY` is pasted into Project Settings → Edge
    Functions → Secrets — confirmed again this session that no tool on this MCP surface
    exposes secrets management, so this genuinely can't be done by an agent.
  - **Schedule time (`0 11 * * *` UTC) was picked arbitrarily** — no owner timezone was on
    record and blocking on that felt worse than shipping a sane default. Owner can retune
    with `select cron.alter_job(1, schedule => '<cron expr>');` at any time; documented in
    Next up.
- **MCP connector instability, again:** the Supabase (and Netlify/SnapTrade) connectors
  disconnected and reconnected mid-session with new internal tool IDs, exactly as session 5
  flagged. Didn't lose any in-progress work this time since the cron setup completed before
  the reconnect.
- **Files touched this session:** none in app code — this was all live Supabase
  infrastructure (two `apply_migration` calls: extensions + cron schedule) plus this
  `PROGRESS.md` update. No frontend/build changes, so no `npm run build`/`lint` needed.
- **Owner:** cron is live and will start actually populating fresh data as soon as the
  Finnhub secret is set (Next up #1). Everything else from session 5's list is unchanged.
- **Follow-up, same session — full cloud sync verified end-to-end:**
  - Owner set `FINNHUB_API_KEY` in Project Settings → Edge Functions → Secrets. Verified
    it took effect by manually triggering the function (`net.http_post` via `execute_sql`,
    same call the cron uses) and confirming it did **not** return the function's
    `{"error": "Missing secrets", ...}` 500 — it returned `200 {"ok": true, "tickers": 0,
    "upserted": 0, "note": "No tickers"}` instead, i.e. it got past the secrets check.
  - "No tickers" was correct at that point: `auth.users` had 0 rows — owner hadn't
    actually completed magic-link sign-in yet, so the earlier CSV import had only ever
    written to browser localStorage, not Supabase's `holdings`/`watchlist` tables (exactly
    the caveat this file already had noted).
  - Owner attempted magic-link sign-in and hit a dead end: the email link redirected to
    `http://localhost:3000/#error=access_denied&error_code=otp_expired...`. Diagnosed via
    Supabase's own docs (`search_docs`): the project's Auth **Site URL** was still the
    default `http://localhost:3000`, and Supabase only honors `emailRedirectTo` requests
    that match an allow-listed Redirect URL — otherwise it silently falls back to the
    (broken, non-existent) default. **No MCP tool exposes Auth URL configuration** — this
    is dashboard-only. Owner fixed it themselves: Authentication → URL Configuration → Site
    URL set to `https://portlander.netlify.app`, same URL added to Redirect URLs.
  - Owner then successfully signed in and re-imported their CSV (40 holdings landed in
    Supabase — confirmed via `execute_sql`). A second manual trigger of `sync-events`
    processed all 40 tickers: **34 events upserted**, `status: partial` with one
    expected/benign failure — `SPAXX` (a money-market/cash position, not a stock) got a
    Finnhub 403, which is correct behavior since Finnhub's earnings calendar doesn't cover
    mutual funds. Spot-checked `events` directly: real tickers, real dates in the
    `2026-07-29`–`2026-08-06` range, correct `confirmed`/`estimated` split. This is genuine
    live Finnhub data, not demo placeholders — full pipeline (Auth → holdings → Edge
    Function → Finnhub → `events`) confirmed working.
  - That same manual trigger surfaced a real (if minor) issue: `pg_net`'s default 5000ms
    timeout is too short for a 40-ticker sync (~16s server-side, due to the function's
    intentional 200ms per-ticker pacing plus real Finnhub latency) — the request timed out
    client-side even though the Edge Function ran to full completion regardless (proven via
    `sync_runs.finished_at` showing a clean completion). Fixed for the **cron job**
    specifically via `cron.alter_job(1, command => ...)`, adding `timeout_milliseconds :=
    60000` to its `net.http_post` call, so future scheduled runs get an accurate logged
    response instead of a misleading timeout as the holdings list grows.
  - **State as of end of session:** cloud deploy is functionally complete and verified
    live end-to-end. Only the formal Phase 1 exit-criteria checkbox remains (see Phase 1
    exit criteria section) — everything it requires has now actually been demonstrated
    working.
- **Follow-up, same session — owner-reported UI glitches, fixed (first `src/` code changes
  this session; everything above was infra-only):**
  - **Today page:** added an Impact/Date sort toggle (`src/components/today/SortToggle.tsx`)
    next to the event count, matching `FilterBar`'s visual language. Sort logic factored
    into `scoring.ts` as `sortEventsByDate` (renamed the existing impact comparator to
    `sortEventsByImpact` for symmetry), shared with the calendar agenda fix below.
  - **Date formatting** (`format.ts`): `formatEventDay` previously returned a bare relative
    label ("Thursday" with no date, or just "Aug 14" with no weekday past day 7). Owner
    wanted the actual date always visible. Now always renders full weekday + date
    ("Thursday, August 14"), keeping "Today"/"Tomorrow" prefixes (with date appended) for
    near-term events.
  - **Calendar cell ticker truncation — real bug, found and fixed**
    (`MonthCalendar.tsx`): day cells were rendering tickers as a single letter + ellipsis
    (owner's exact complaint). Root cause: `truncate` (`white-space: nowrap; overflow:
    hidden; text-overflow: ellipsis`) was applied to the *outer* flex row rather than the
    text itself — not meaningfully spec-supported on flex containers — while the inner
    text span lacked `min-w-0`/`flex-1`, the standard fix needed for text truncation to
    compute a sane bounded width inside a flex row. Moved `truncate` + `min-w-0 flex-1` to
    the inner span only. Verified via Playwright screenshots + computed-style checks in a
    local dev build (seeded with demo + injected test data) — full ticker names
    (`MSFT`, `CRWD`, `PANW`, etc.) now render correctly.
  - **BMO/AMC color coding** (`MonthCalendar.tsx`): earnings tickers now render
    `text-ink-100` (bright) when `timing === 'bmo'` (reports before the open) and
    `text-ink-400` (dim) when `timing === 'amc'` (reports after the close); non-earnings
    types unchanged. Deliberately reused existing ink-scale tokens (brightness, not a new
    hue) rather than introducing a new color, since a new hue risked visually colliding
    with the existing type-color legend (amber/green/blue for earnings/dividends/macro) —
    owner explicitly asked to avoid clutter. Verified via `getComputedStyle` in-browser:
    BMO → `rgb(241,245,249)`, AMC → `rgb(148,163,184)`. Added one small legend line
    explaining the convention.
  - **Agenda "next 30 days" bug — real bug, found and fixed** (`CalendarPage.tsx`): the
    agenda was sorting by impact score (like Today) and hard-capping at `.slice(0, 12)`.
    Since events further out score lower on the recency component, the last ~2/3 of the
    30-day window was silently invisible even though the section header said "next 30
    days" — exactly the owner's complaint. Fixed by sorting chronologically
    (`sortEventsByDate`) with no artificial cap; verified in-browser with test events
    seeded out to day 28 — all now appear.
  - **Portfolio page:** owner explicitly said no changes needed there; untouched.
  - **Finnhub rate-limit scaling — discussed, not implemented.** Owner wants to add more
    Finnhub-backed metrics later (PE ratio, market cap, etc.) without blowing the free-tier
    rate limit as the sync already needs ~40+ calls (one per ticker) for earnings alone.
    Discussed but did not build: (1) Finnhub's earnings-calendar endpoint called *without*
    a `symbol` filter is believed to return all companies' earnings for a date range in one
    call — would cut the earnings sync from N calls to ~1, worth verifying against current
    Finnhub docs before relying on it; (2) fetch slower-changing fundamentals (PE, market
    cap) weekly rather than daily to keep their added call budget small; (3) if per-symbol
    calls stay necessary, pace at ~1.1s/call (≈54/min) as a hard floor rather than the
    current 200ms, which is only safe today because the full sync finishes in one burst
    under a 60s window. **No code changed for this — owner wants to decide the approach
    first.**
  - **Testing:** `npm install` was needed (`node_modules` wasn't present in this checkout);
    `npm run build` and `npm run lint` both pass clean (the build's pre-existing warning
    about a large chunk and the lint's pre-existing `PortfolioContext.tsx` fast-refresh
    warning are both unrelated/unchanged). Also manually verified in a real browser via a
    local dev server + Playwright (screenshots + computed-style checks), not just
    build/lint — see above for what was checked.
  - Opened as commits on the existing PR #3 (`claude/portlander-cloud-handoff-eqnr94` →
    `develop`) rather than a new PR, since it's a continuation of the same session/branch.
    **Unlike every other change this session, this one touches `src/`** — merging it will
    actually need a real Netlify build, unlike the infra-only work above.

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
   live; Edge Function is deployed; daily `pg_cron` job is live (session 6). What's left:
   `FINNHUB_API_KEY` secret (owner action, genuinely can't be done via any available tool),
   then owner sign-in + re-import CSV on the live site.
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
