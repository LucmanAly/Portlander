# Portlander roadmap

**Authoritative live status** is always in `PROGRESS.md`. Product rules live in `AGENTS.md`.
This file is the short map of program phases — not a second task queue.

| Phase | Release | Status | Promise |
|-------|---------|--------|---------|
| 1 — Foundation | `v1.0` | ✅ Shipped on `main` | Real book, impact ranking, Today/Calendar/Portfolio/Settings, SnapTrade, Finnhub sync |
| 2 — Portfolio event intelligence | `v2.0` | ✅ Shipped on `main` | Earnings workspace, D-1..D+1 deck, consensus/actual/surprise, verified vs generated, DeepSeek interpretation |
| Post-v2 — Performance briefings | candidate `v2.1` | 🟠 On `develop`; acceptance pending | Daily snapshots, Morning Desk briefings, `/performance` period review |
| 3 — Unplanned | — | ⚪ Not defined | Defined only after the owner lives with v2 and signs off next scope |

## Current focus

1. Finish **PERF-01 data acceptance** (second market-day capture + authenticated period review).
2. Promote performance briefings to `main` as a deliberate feature release (bump `src/lib/appMeta.ts`).
3. Separately review the consumer UX pass (**PR #34** / `report/UX map.MD`) — do not mix it into PERF acceptance.
4. Do **not** invent Phase 3 features until the owner defines them.

## Explicit non-goals (unless the owner overrides)

See `AGENTS.md`. In short: no trading, no social feed, no tax accounting, no AI stock picks, no tick-by-tick quotes as a core dependency.

## Historical note

An earlier roadmap framed Phase 2 as “Ritual” (prep cards, journal, alerts) and Phase 3 as “Intelligence” (themes, thesis, risk radar). Those plans were **canceled**. Phase 2 was redefined as the event-intelligence overhaul that shipped as `v2.0`.
