# Phase 2 planning — sequencing brainstorm

**Status:** brainstorm only. No option below is chosen. Owner picks one (or
mixes stages from more than one) before the first Phase 2 PR opens.

Authoritative Phase 2 scope (from `AGENTS.md`, "Ritual"): prep cards,
checklists, post-earnings journal, tags, T-7/T-1 email, watchlist on
calendar, week view polish, cluster strip v0, command palette (optional).
Every item below traces back to that list — nothing added, nothing dropped.

---

## What Phase 2 delivers at the end

The full "Ritual" promise: a repeatable pre/post-earnings routine layered on
top of Phase 1's ranked calendar —

- **Prep cards** on upcoming high-impact events, with **checklists** (what to
  check before the print: guidance history, options skew, thesis notes)
- A **post-earnings journal** to record what happened vs. what you expected
- **Tags** to organize holdings/events/journal entries by theme or thesis
- **T-7/T-1 email** reminders so prep isn't missed
- **Watchlist tickers on the calendar**, not just held positions
- A polished **week view** alongside the existing month view
- A first-cut **cluster strip** grouping same-week catalysts
- Optionally, a **command palette** for keyboard-first navigation

Per `AGENTS.md`'s versioning policy, Phase 2's final release ships as `v2.0`.
Everything before that final release ships as `1.x` minor bumps (each
shippable slice is a real release, not one big-bang merge).

---

## Option A — Ritual loop first (build the habit, then decorate it)

Build the actual daily/weekly ritual the phase is named for before anything
else, since every later item either feeds it or is optional polish.

1. **Post-earnings journal** — new data model (entries linked to
   ticker/event: freeform notes + outcome tag). Foundational; nothing else
   in this phase strictly needs it, but it's the smallest new-table lift.
2. **Prep cards + checklists** — pre-earnings card summarizing what to
   check, with a per-event checklist. Reuses the journal's event-linking.
3. **Tags** — cross-cutting taxonomy applied to holdings/events/journal
   entries; easier to retrofit now (2 or 3 features to attach to) than after
   the full list exists.
4. **T-7/T-1 email alerts** — needs email infra (a provider like Resend +
   an Edge Function/cron). Biggest infra lift in the phase; comes after the
   ritual it's reminding you about already exists.
5. **Watchlist on calendar** — extend `MonthCalendar`/`CalendarPage` to
   include watchlist-only tickers.
6. **Week view polish** — new view mode on the same Calendar data.
7. **Cluster strip v0** — grouping logic over existing event data.
8. **Command palette (optional)** — pure UX, cross-cutting keyboard nav;
   last since it depends on nothing and blocks nothing.

**Trade-off:** the biggest, riskiest pieces (journal, prep cards) ship
first, before there's a quick visible win to point to.

---

## Option B — Quick UI wins first, infra last

Ship visible value fast and build momentum; defer the heaviest lift (email)
until there's a real ritual for it to remind people about.

1. **Watchlist on calendar** — small: extend an existing component.
2. **Week view polish** — small: new view mode, same data source.
3. **Cluster strip v0** — moderate: grouping over existing event data, no
   new schema.
4. **Tags** — moderate: new schema + UI to add/filter by tag.
5. **Prep cards + checklists** — moderate/large: new data model, new
   page/section.
6. **Post-earnings journal** — large: new data model, likely reuses prep
   card infra from step 5.
7. **T-7/T-1 email alerts** — large: email service integration + cron.
8. **Command palette (optional)** — last, pure polish.

**Trade-off:** the "Ritual" habit loop (prep → journal) doesn't exist until
late in the phase, even though it's the phase's namesake feature.

---

## Option C — Infra-first (alerts early)

If reminders are the most-wanted feature — nudges before you forget an
earnings date — stand up the email plumbing first; it's also reusable for
Phase 3's daily briefing.

1. **T-7/T-1 email alerts** — sets up email infra (provider + Edge Function
   + cron) that later phases (Phase 3's daily briefing) can reuse.
2. **Watchlist on calendar** + **week view polish** — small UI additions
   that pair naturally with alerts (more to get alerted about, more views
   to see it in).
3. **Tags** — cross-cutting taxonomy before building prep cards on top of
   it, so tags don't need retrofitting later.
4. **Prep cards + checklists**
5. **Post-earnings journal**
6. **Cluster strip v0**
7. **Command palette (optional)** — last.

**Trade-off:** front-loads new external-service risk (email deliverability,
provider setup, secrets) before any of the ritual UI exists to validate
demand for it.

---

## Comparison at a glance

| | First thing shipped | Biggest lift deferred to | Best if... |
|---|---|---|---|
| **A — Ritual first** | Post-earnings journal | Email alerts (step 4) | You want the core habit loop working end-to-end ASAP, even before polish |
| **B — Quick wins first** | Watchlist on calendar | Email alerts (step 7) | You want visible progress every session; comfortable with the "ritual" landing late |
| **C — Infra first** | T-7/T-1 email alerts | Journal (step 5) | Reminders/alerts are the single most-wanted feature; email infra is worth building once |

All three end at the same place: full "Ritual" scope, `v2.0`. The
difference is only what ships in what order.
