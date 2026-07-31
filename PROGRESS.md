# PROGRESS.md — Portlander live status

**Last updated:** 2026-07-31  
**Last agent:** claude-code  
**Current phase:** Phase 1 — Foundation  
**Phase 1 status:** 🟡 In progress (~85% — local app + Finnhub sync paths; cloud mode deferred)

> **Protocol:** Every agent must read `AGENTS.md` + this file before work, and update this file after work (session log + next up) without being asked.

---

## Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Agent protocol | ✅ Done | AGENTS.md + PROGRESS.md |
| UI shell + Today/Calendar/Portfolio | ✅ Done | Premium dark local app |
| Local holdings + CSV | ✅ Done | localStorage |
| Impact score v0 + exposure strip | ✅ Done | |
| Supabase client (optional) | ✅ Done | **Cloud mode deferred by owner** — leave alone unless asked |
| **Local Finnhub sync** `npm run sync:events` | ✅ Done | Writes `public/data/events-sync.json` |
| **App merge of sync file** | ✅ Done | Boot + Settings Reload |
| **Edge Function sync-events** | ✅ Done | `supabase/functions/sync-events/index.ts` — deploy later |
| Edge deploy + cron in production | ⏳ Deferred | When owner enables cloud |
| Phase 1 exit criteria / dogfood | ⏳ Next | Owner: Finnhub key + real CSV |

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

### Deferred (do not prioritize)
- [ ] Cloud magic-link / remote holdings day-to-day use
- [ ] Deploy Edge Function + Supabase cron
- [ ] Netlify env for VITE_SUPABASE_*

### Not started / owner
- [ ] Finnhub API key + first real `npm run sync:events`
- [ ] Real portfolio CSV dogfood
- [ ] Phase 1 exit criteria sign-off

### Phase 1 exit criteria
- [ ] Real portfolio loadable
- [ ] Earnings from Finnhub (via sync file or Edge) not only demo offsets
- [ ] Weight ranking + exposure % sanity
- [ ] Snappy UI
- [ ] Used on a real morning once

---

## Next up (ordered)

1. **Owner:** set `FINNHUB_API_KEY`, run `npm run sync:events`, refresh app, verify real earnings dates on Today.
2. **Owner:** import real holdings CSV; adjust `scripts/tickers.txt` to match.
3. Polish if needed: empty state when sync file missing; show “last Finnhub sync” from `events-sync.json` metadata on Settings.
4. **Later (cloud):** deploy Edge Function + daily cron; enable Supabase auth only when wanted.
5. Phase 1 exit criteria → then Phase 2 (prep cards, journal, alerts).

---

## Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Cloud deliberately deferred | No remote multi-device sync | OK — local path is primary |

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

---

## Session log

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

1. **Do not push cloud mode** unless owner asks — local Finnhub file is the active path.
2. Sync command: `npm run sync:events` (needs `FINNHUB_API_KEY`).
3. Edge function is ready to deploy later; see `supabase/functions/sync-events/README.md`.
4. Demo events use relative dates; after sync, Finnhub rows replace *any* stale demo/local
   earnings for that ticker (ticker-level match, not ticker+date — see 2026-07-31 decision).
5. Update this file after your session.
