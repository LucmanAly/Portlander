# Portlander

**Portfolio event intelligence built around time.**

> What hits your portfolio next, how much weight is on the line, and why it matters.

## Multi-agent workflow

Before any work:

1. Read **`AGENTS.md`**
2. Read **`PROGRESS.md`**

After every session, update **`PROGRESS.md`** (checklist + session log + next up) without being asked.

## Stack

- React + Vite + TypeScript + Tailwind CSS v4
- Supabase (schema ready; app runs in local mode until wired)
- Netlify (`netlify.toml`)

## Quick start

```bash
# Windows PowerShell if npm is blocked by execution policy:
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Demo holdings (CRWD, PANW, FTNT, MSFT, NVDA, META) and relative earnings/macro events seed on first load into `localStorage`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Phase 1 features

- **Today** — next 14 days ranked by impact score
- **Exposure strip** — 7d / 30d earnings portfolio %
- **Calendar** — month grid color-coded by event type
- **Portfolio** — holdings CRUD, CSV import/export, watchlist
- **Settings** — local / Supabase mode, magic-link auth, reset demo

## Data modes

| Mode | When | Behavior |
|------|------|----------|
| **Local / demo** | No Supabase env / not signed in | `localStorage` + demo seed |
| **Supabase cloud** (live) | Env set + signed in | Holdings remote; events from Postgres, filled by the daily Edge cron |

### Cloud mode

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# apply supabase/schema.sql
```

Edge Functions (`sync-events`, `refresh-quotes`, `snaptrade-connect`, `snaptrade-sync`)
and the daily cron are already deployed. See each function's README for its secrets.

> **Never `supabase functions deploy` without diffing production first** — see `AGENTS.md`.

## Project docs

- `AGENTS.md` — protocol for Codex / Claude Code / Grok
- `PROGRESS.md` — live status
- `docs/UI.md` — design system
- `docs/ROADMAP.md` — phases
- `supabase/schema.sql` — database
