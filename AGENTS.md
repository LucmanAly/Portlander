# AGENTS.md — Portlander multi-agent protocol

**Read this file before any work. Update `PROGRESS.md` after every meaningful work session without waiting to be asked.**

Other agents (Claude Code, Codex, Grok Build, humans) will continue this project independently. Synchronization depends entirely on these two files plus the code.

---

## What is Portlander?

Portfolio **event intelligence** built around time — not a generic calendar.

> What events could affect my portfolio next, how important are they (by position weight), and what should I prepare for?

**Signature direction:** position-weighted calendar → earnings/catalyst clusters → direct/indirect exposure.

**Stack (locked):**
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend/data: Supabase (Postgres, Auth, Edge Functions)
- Hosting: Netlify
- Market data: one provider (Finnhub preferred for Phase 1 earnings; FMP optional later)
- Charts later: Recharts (not Phase 1 required)

**UI bar:** fast, premium dark finance UI (Mercury / Linear / institutional fintech density). Tabular numbers, calm surfaces, semantic color only.

---

## Mandatory agent workflow

### Before starting work

1. Read **`AGENTS.md`** (this file) fully.
2. Read **`PROGRESS.md`** fully — current phase, completed items, in-progress, blockers, next tasks.
3. Skim relevant files under `src/` and `supabase/` for the task you will touch.
4. Do **not** reinvent stack, rename product, or jump phases unless `PROGRESS.md` explicitly says the prior phase exit criteria are met.

### While working

- Prefer small, coherent commits of value over sprawling rewrites.
- Match existing patterns: types in `src/types`, lib in `src/lib`, components in `src/components`, pages in `src/pages`.
- Keep `user_id` on multi-tenant tables even if single-user for now.
- **Never** call market-data APIs from the browser for calendar data; use Supabase + Edge cron (or local mock until wired).
- **Never `supabase functions deploy` without diffing production first.** Deployed Edge
  Function source is authoritative only once it is in git. Fetch the live source
  (`get_edge_function`) for the slug you are about to deploy, diff it against
  `supabase/functions/<slug>/index.ts`, and reconcile any difference into the repo
  *before* deploying. A blind deploy silently rolls production back to whatever the
  repo happens to hold — which has previously meant re-breaking a working brokerage
  sync. Function version numbers count redeploys, not drift, so they cannot tell you
  whether the repo is current; only a diff can.
- Preserve premium UI tokens in `src/index.css` / Tailwind theme; do not introduce random purple SaaS defaults.
- Do not commit secrets. Use `.env.example` only for env var names.

### After finishing work (required every session)

Update **`PROGRESS.md`**:

1. Set **Last updated** (ISO date) and **Last agent** (e.g. `grok-build`, `claude-code`, `codex`).
2. Move finished items to **Completed**.
3. Update **In progress** / **Blocked**.
4. Refresh **Next up** (ordered, concrete).
5. Add a short entry to **Session log** — a **hard cap of ~10-15 lines**: what changed, key files, one-line pointer to the PR/commit for anyone who needs the full story. Git commit messages and PR descriptions are the permanent detailed record; don't re-narrate them here. If a fact belongs in Snapshot/Decisions/Blockers, put it there once — don't also restate it at length in the session log.
6. If you change architecture or phase scope, note it under **Decisions** — one row, 1-3 sentences of rationale, not a paragraph.

### Keep PROGRESS.md lean (every session, not just when asked)

This file is read in full by every future agent before it does anything — treat it as a budget, not an append-only log.

- **When a Blocker resolves, delete the row.** Don't strike it through and leave it — the resolution belongs in Decisions if it has lasting relevance, or nowhere if it doesn't.
- **When a Decision gets refined or corrected, edit the existing row** instead of adding a new one that references the old one.
- **Snapshot is the single source of truth for current state.** If Snapshot says it, don't also re-explain it in Next up, Blockers, and the session log.
- Session log entries older than ~5 sessions back are fair game to compress further (a few bullets) once their content is no longer actively relevant — the git history never loses this, PROGRESS.md doesn't need to keep carrying it at full length.

If you cannot finish a task, still update PROGRESS with partial state and blockers.

---

## Three-phase program (summary)

### Phase 1 — Foundation (CURRENT unless PROGRESS says otherwise)

**Promise:** Useful every morning — next 14 days ranked by impact + exposure %.

**In scope:**
- Auth-ready schema with `user_id` (local/demo mode OK until Supabase wired)
- Holdings CRUD + CSV import
- Events: earnings (+ ex-div if easy), macro seed (FOMC/CPI/NFP)
- Home **Today**: Next 14 days impact-ranked
- Month **Calendar** (color by type)
- **Exposure strip**: 7d / 30d portfolio % with earnings
- Impact score v0: weight × type × recency
- Confirmed vs estimated badge
- Filters: All / Earnings / Dividends / Macro / Holdings only
- Premium dark shell, tokens, skeletons
- Nightly sync design (Edge Function stub or documented); mock data until API keys exist

**Out of Phase 1:** prep cards, journal, PEG, AI, push, clusters UI (light chip OK), brokerage, options IV, multi-portfolio.

**Exit criteria:** real portfolio loadable; earnings visible; heavy weight ranks above tiny weight; exposure % sane; snappy UI; dogfood mornings.

### Phase 2 — Ritual

Prep cards, checklists, post-earnings journal, tags, T-7/T-1 email, watchlist on calendar, week view polish, cluster strip v0, command palette optional.

### Phase 3 — Intelligence

Daily briefing, theme/indirect exposure, thesis tracker, risk radar, valuation/PEG snapshot, scenarios, PWA push, AI only on structured outputs.

Do not implement Phase 2/3 features unless Phase 1 exit criteria are marked met in PROGRESS.md, except for **schema hooks** that cost nothing (empty tables reserved in SQL is fine).

---

## Repository map

```text
AGENTS.md                 ← you are here (protocol + product rules)
PROGRESS.md               ← live status; update every session
README.md                 ← human quickstart
docs/                     ← roadmap, UI, data notes
supabase/
  schema.sql              ← source of truth for DB
  seed.sql                ← optional demo/macro seed
  functions/              ← Edge Functions (sync-events, etc.)
src/
  main.tsx, App.tsx
  index.css               ← design tokens
  types/                  ← domain types
  lib/                    ← scoring, dates, supabase client, csv
  data/                   ← mock/demo data until live sync
  components/             ← UI primitives + feature components
  pages/                  ← Today, Calendar, Portfolio, Settings
  context/                ← PortfolioContext (state, auth, sync orchestration)
netlify.toml              ← deploy config
.env.example
```

---

## Phase 1 technical rules

### Impact score v0

```text
impact_score =
  0.65 * normalize(position_weight)  // 0 if watchlist-only / no holding
+ 0.25 * event_type_weight           // earnings 1.0, macro 0.55, ex_div 0.35
+ 0.10 * recency_boost               // nearer events higher
```

Expose breakdown in UI (tooltip). Prefer transparency over black-box.

### Data flow

```text
Cron/Edge → upsert events in Postgres → client reads Supabase only
```

Until Supabase is configured: use `src/data` + `localStorage` for holdings so UI is fully dogfoodable offline.

### Design tokens

- Dark-first: ink/charcoal backgrounds
- Accent: restrained teal/cyan for interactive/critical-positive
- Earnings: amber/red spectrum by timing importance
- Dividends: green
- Macro: blue
- Tabular nums for all money and percents

### Naming

Product name: **Portlander**. Do not rename unless owner requests.

---

## Quality bar

- TypeScript strict; no casual `any`
- Mobile: usable agenda; desktop-first premium shell
- Loading: skeletons matching layout
- Empty states that instruct next action
- No secrets in git

---

## How to choose work

1. Look at **PROGRESS.md → Next up**
2. Pick the highest unchecked item you can complete in this session
3. If blocked (API keys, credentials), implement mock/fallback and document in PROGRESS
4. Prefer finishing a vertical slice over starting five half-slices

---

## Explicit non-goals (all phases unless owner overrides)

- Brokerage trading / order entry
- Social feed / copy trading
- Full tax accounting
- AI stock recommendations
- Tick-by-tick realtime quotes as core dependency
