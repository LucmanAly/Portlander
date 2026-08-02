# Phase 2 ("Signal") — sequencing

**Status:** the "3 brainstormed sequencing options" version of this doc
(2026-08-01, session 19) is superseded. After a design discussion with the
owner, Phase 2's scope itself changed — see `AGENTS.md`'s "Three-phase
program" section for the authoritative definition, and `PROGRESS.md`
Decisions for why. This doc now holds the concrete build order, not
alternatives to choose between.

Phase 3 ("Intelligence") scope, provider decision, and AI architecture live
in `docs/AI.md` — Phase 2 ships no AI features at all.

---

## Build order (smallest / cheapest / most-unblocked first)

### 1. Structured earnings expectations + actuals + beat/miss — recommended first PR

Finnhub's `/calendar/earnings` call (`supabase/functions/sync-events/index.ts`)
already returns `epsEstimate`, `epsActual`, `revenueEstimate`, `revenueActual`
per row — today they're only used to flip `status` between `confirmed` and
`estimated`, then get partially summarized into the free-text `description`
(revenue is dropped from that summary entirely) and otherwise sit unused
inside the `raw jsonb` column.

- Add structured columns to `events` (or promote the existing values out of
  `raw` into dedicated columns) for eps/revenue estimate + actual.
- Add the same fields to `PortfolioEvent` in `src/types/index.ts`.
- Compute beat/miss % locally (no AI) and show it on `EventCard`.
- **No new external API call** — this unlocks data already being fetched
  and stored.

### 2. PEG snapshot per holding

- New Finnhub call for PE ratio + growth estimate (`/stock/metric` — not
  currently integrated; verify the free-tier endpoint and rate limit before
  committing to it).
- Compute PEG locally, no AI.
- Show on `EventCard`/`PortfolioTable` so "expensive vs. cheap going into
  the print" is visible at a glance, matching how the owner already
  evaluates positions manually.

### 3. Thesis field on Holding

- Add a `thesis` text column to `holdings` (2-line freeform, e.g. "CRWD:
  platform consolidation winner, holding while ARR growth >25%").
- UI to write/edit it (Portfolio page, alongside the existing `notes`
  field).
- Capture only in Phase 2 — no AI processing here. This is the schema hook
  Phase 3's thesis-drift-detection feature reads from.

### 4. Watchlist on calendar + week view polish

- Extend `MonthCalendar`/`CalendarPage` to show watchlist-only tickers
  (not just held positions), visually distinguished from held-position
  events.
- Add a week view mode alongside the existing month view.
- Both are UI-only extensions of existing components — cheap, no schema
  changes, no AI.

---

## What Phase 2 delivers at the end

Every earnings card shows what was expected, what happened, and whether the
beat/miss was big or small — plus whether the position was cheap or
expensive going in (PEG), a place to record why you own it (thesis), and a
calendar that shows what you're watching, not just what you hold. All of it
computed locally, no LLM calls, no new privacy surface.

Ships as `v2.0` per `AGENTS.md`'s versioning policy (phase-final releases
get major version bumps). Phase 3's AI-driven features (thesis drift,
morning briefing, "what moved it," guidance summaries) wait until this
phase is complete, per `AGENTS.md`'s "don't jump phases" rule.
