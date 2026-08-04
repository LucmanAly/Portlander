# Portlander

**Portfolio event intelligence built around time.**

> What hits your portfolio next, how much weight is on the line, and why it matters.

**Live:** [portlander.netlify.app](https://portlander.netlify.app) · **Current release:** `v2.0` “Portfolio Event Intelligence”

## Multi-agent workflow

Before any work:

1. Read **`AGENTS.md`**
2. Read **`PROGRESS.md`**

After every session, update **`PROGRESS.md`** (checklist + session log + next up) without being asked.

## Stack

- React + Vite + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Edge Functions)
- Netlify (`netlify.toml`) — production branch is `main`
- Market data: Finnhub (earnings + quotes via Edge Functions)
- Brokerage: SnapTrade (Fidelity positions)
- Optional narration: DeepSeek (labeled, structured; never computes portfolio math)

## Quick start

```bash
# Windows PowerShell if npm is blocked by execution policy:
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Demo holdings and relative earnings/macro events seed on first load into `localStorage` when Supabase is not configured.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | oxlint |
| `npm run test` | vitest |

## What’s in the product

| Area | What you get |
|------|----------------|
| **Today** | Morning Desk: portfolio value, daily move, D-1..D+1 earnings deck, needs attention, forward exposure |
| **Earnings** | Workspace of report cards (consensus / actual / surprise / history), filters, detail drawer |
| **Calendar** | Position-weighted month grid + selected-day detail + agenda |
| **Portfolio** | Table-first book, CSV merge/replace, SnapTrade sync, search/sort/source filter |
| **Settings** | Account, brokerage, data & sync, earnings disclosure, diagnostics, about this build |
| **Performance** *(on `develop`, pending promotion)* | Daily/period briefings from complete position snapshots |

## Data modes

| Mode | When | Behavior |
|------|------|----------|
| **Local / demo** | No Supabase env / not signed in | `localStorage` + demo seed |
| **Supabase cloud** | Env set + signed in | Holdings remote; events from Postgres (daily Edge cron) |

### Cloud mode

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# apply supabase/schema.sql
```

Edge Functions (`sync-events`, `refresh-quotes`, `snaptrade-connect`, `snaptrade-sync`,
`earnings-interpret`, `performance-interpret`) and crons are deployed for the live project.
See each function’s README for secrets.

> **Never `supabase functions deploy` without diffing production first** — see `AGENTS.md`.

## Branch workflow

- **`main`** — production (Netlify). Promote only when ready to ship.
- **`develop`** — integration branch. Feature PRs target `develop`.

## Project docs

| File | Role |
|------|------|
| `AGENTS.md` | Protocol for Codex / Claude Code / Grok |
| `PROGRESS.md` | Live status, checklists, next task |
| `docs/ROADMAP.md` | Phase map |
| `docs/UI.md` | Design system + UI contract |
| `docs/PERFORMANCE-BRIEFINGS.md` | PERF reliability and calculation contract |
| `report/UX map.MD` | Consumer UX backlog (PR #34 and follow-ons) |
| `supabase/schema.sql` | Database source of truth |
