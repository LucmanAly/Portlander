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

## Product program (current)

### Phase 1 — Foundation (`v1.0`, released)

The foundation is on `main`: real holdings, portfolio-relative impact ranking, Today,
Calendar, table-first Portfolio, Settings diagnostics, Supabase/Finnhub sync, SnapTrade,
truthful Local/Demo states, and release metadata. A few owner acceptance checks remain in
`PROGRESS.md`; they are post-release verification, not permission to redesign Phase 1.

### Phase 2 — Portfolio event intelligence (CURRENT)

The old "Ritual" and "Intelligence" phase plans were canceled by the owner. Phase 2 is now
one coherent product direction:

1. Rebuild the UI/UX around the approved Magic Patterns event-intelligence concept.
2. Add an Earnings workspace and a D-1 through D+1 quantitative report-card deck.
3. Show consensus before a report and actual-vs-consensus after it, always tied to portfolio
   weight and timing.
4. Add a detail drawer that clearly separates verified financial facts from generated
   interpretation.
5. Integrate DeepSeek only after the underlying provider data and UI contracts are truthful.

The ordered UI work is the master queue in `PROGRESS.md`. Do not improvise a parallel redesign
or revive the canceled Phase 2/3 lists.

### Phase 3 — Unplanned

There is no approved Phase 3 scope. Do not invent one. It will be defined only after the owner
uses and signs off Phase 2.

### Phase 2 data truth rules

- Finnhub (or a later explicitly approved market-data provider) owns earnings dates, consensus,
  reported revenue/EPS, and other source facts. An LLM is not a market-data provider.
- Portfolio value, weight, gain/loss, surprise percentages, and exposure are deterministic code,
  never LLM calculations.
- DeepSeek may extract or interpret supplied evidence into a strict structured output. Generated
  content must be labeled and visually separated from verified facts.
- Missing data renders as unavailable/pending. Never generate a plausible-looking number to fill
  a card.

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

## Release and versioning

- `src/lib/appMeta.ts` is the source of truth for the user-facing release metadata shown in Settings.
- Phase completion versions use major numbers: Phase 1 final = `1.0`, Phase 2 final = `2.0`, Phase 3 final = `3.0`.
- User-facing feature releases between phase finals increment the minor number: `1.1`, `1.2`, `1.3`, and so on.
- Small bug fixes or maintenance releases increment the patch number: `1.2.1`, `1.2.2`, etc.
- When promoting a release to `main`, update `APP_VERSION` and `APP_LAST_UPDATED` together in the same commit. `APP_LAST_UPDATED` must be an ISO-8601 UTC timestamp for that promotion; Settings formats it for Eastern Time.
- Do not bump the version for every internal commit on `develop`; bump it for a user-facing release or hotfix that is intended to ship.
- Keep the version, phase label, and last-updated timestamp visible in Settings under **About this build**.

---
## How to choose and hand off work

`PROGRESS.md → Phase 2 UI/UX overhaul master queue` is the authoritative task sequence.

1. Read `NEXT_TASK` and `ACTIVE_CLAIM`. Take `NEXT_TASK` unless it is explicitly blocked.
2. Before changing code, set `ACTIVE_CLAIM` to your agent name, date, task ID, and working
   branch/PR. Make the claim visible remotely before substantial implementation work when more
   than one agent may be active. Never start a second queue item while another agent owns the
   active one.
3. Keep one queue ID per focused PR. A task is not complete merely because code was written;
   its listed acceptance criteria and required checks must pass.
4. On completion, check the task `[x]`, clear `ACTIVE_CLAIM`, advance `NEXT_TASK` to the next
   unchecked item, and add a short Session log entry in the same commit/PR.
5. If blocked, clear `ACTIVE_CLAIM`, add the precise blocker under Blockers, and either leave
   `NEXT_TASK` in place or advance it only when the following task is genuinely independent.
6. If scope is discovered mid-task, add a child checkbox beneath that task. Do not silently
   expand another task or create an unordered side quest.
7. Prefer finishing the current vertical slice over starting several partial screens.

This claim-and-advance update is mandatory so a newly arriving agent can determine the next safe
task by reading two lines instead of reconstructing the project from git history.

---

## Explicit non-goals (all phases unless owner overrides)

- Brokerage trading / order entry
- Social feed / copy trading
- Full tax accounting
- AI stock recommendations
- Tick-by-tick realtime quotes as core dependency
