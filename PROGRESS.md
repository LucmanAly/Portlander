# PROGRESS.md — Portlander live status

**Last updated:** 2026-03-25  
**Last agent:** grok-build  
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
| No Finnhub key on machine yet | Live earnings still demo | Owner runs sync with key |
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

---

## Session log

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
4. Demo events use relative dates; after sync, finnhub rows replace same ticker+date demo earnings.
5. Update this file after your session.
