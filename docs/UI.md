# Portlander UI system

## Principles

- Dark-first institutional fintech (not crypto neon, not purple SaaS)
- Dense data, calm chrome, tabular numbers
- Motion 150–250ms; skeletons over spinners
- Semantic color only: earnings amber, dividends green, macro blue, accent teal, critical red

## Tokens

Defined in `src/index.css` (`@theme`):

| Token | Role |
|-------|------|
| `ink-950`–`ink-100` | Surfaces and text |
| `accent-*` | Interactive / brand |
| `earnings` / `dividend` / `macro` / `critical` | Event semantics |

Fonts: IBM Plex Sans + IBM Plex Mono (Google Fonts in `index.html`).

## Components

- Shell: `AppShell` — desktop sidebar, mobile bottom nav, 5 routes: `Today / Earnings /
  Calendar / Portfolio / Settings`. No "Book value" card in the sidebar (removed UX-01) —
  `RefreshQuotesButton` is the sole sidebar footer content.
- Today (Morning Desk, UX-03): `MorningHeader`, `EarningsDeck` (+ `CarouselControls`,
  `useSwipe`), `NeedsAttention`. `FilterBar`/`SortToggle` no longer used here — the full
  schedule lives on Earnings/Calendar. `EventCard` was retired in UX-04, replaced by
  `EarningsReportCard`.
- Earnings workspace (UX-04): `EarningsStatusFilter`, grouped `EarningsReportCard`
  (`compact` variant) via `groupEarningsCards`. Reuses `ForwardExposurePanel` and
  `SortToggle` from Today.
- Exposure: `ForwardExposurePanel` (`components/exposure/`) — replaces the old
  `ExposureStrip`'s 3 separate cards with one hairline-divided panel. Shared by Today and
  Earnings.
- Earnings intelligence (UX-02): `EarningsReportCard`, `HistoricalBeatStrip`,
  `GeneratedInsight` — see `src/types/earnings.ts` for the model. No live data source
  populates consensus/actual/surprise/guidance/reaction yet; `src/data/earningsFixtures.ts`
  is the interim source.
- Calendar (UX-06): `MonthCalendar` (day cells are buttons when `onSelectDay` is passed, plain
  divs otherwise — no dead tab stops; a small count badge marks 2+ report days) +
  `SelectedDayDetail` (full per-event detail lives outside the grid, not crammed into cells).
  Weekday headers and the agenda heading use the sentence-case micro-label convention now.
- Primitives: `Badge` (+ `EarningsStateBadge`), `Stat`, `Skeleton`, `Button`/`PillButton`,
  `MetricPair`, `FreshnessLabel`, `CarouselControls`, `EmptyState`, `.input`

## Earnings workspace filter semantics (UX-04)

`EarningsStatusFilter`'s 4 options map onto `EarningsViewState` as: **Active** =
`awaiting` (results due but not yet in), **Upcoming** = `upcoming`, **Recently reported** =
`reported` within the last 7 days, **All** = no filter. The 7-day window is a product
choice, not a data constraint — adjust `RECENT_WINDOW_DAYS` in
`EarningsStatusFilter.tsx` if that changes.

## Micro-label convention

Small labels (stat-tile labels, form field labels) use sentence case, `text-xs text-ink-450`
— not all-caps tracked `text-ink-500`. `ink-450` sits between `ink-400`/`ink-500` specifically
for this contrast level. Accent-colored eyebrow/kicker text (page headers, e.g. "Portfolio
radar") is a different, intentional pattern and keeps its existing all-caps `accent-500`
styling — this convention only applies to neutral-toned micro-labels.

As of UX-08 this has been applied everywhere except accent-colored eyebrow/kicker text on
every page, which is intentionally excluded (see above).

## Settings information architecture (UX-08)

Six sections in a fixed order — `Account`, `Brokerage`, `Data & sync`, `Earnings
intelligence`, `Diagnostics`, `About this build` — via the shared `SettingsSection`
wrapper, with a sticky anchor-link nav (`#account`, `#brokerage`, etc.) at the top so a
long page never has to be scrolled blind. Account and Brokerage always render (never
conditionally hidden) so every nav link always resolves to real content: when Supabase
isn't configured or the user isn't signed in, the section explains why and links to the
section that unblocks it, instead of disappearing. `Earnings intelligence` is new —
static disclosure of what backs the consensus/actual/guidance data (see UX-02) and the
verified/generated separation policy. Diagnostics keeps every health check, actionable
raw error text, and retry action unchanged. Release metadata stays wired to
`src/lib/appMeta.ts` (`v1.0`) — never the prototype's placeholder version string.

## Portfolio workspace (UX-07)

- Summary grid is 3 stats: Total value, Today's change, Total gain/loss. The last is a new
  whole-book figure (`portfolioTotalGainLoss`/`portfolioTotalGainLossPct` in `scoring.ts`) —
  same all-or-nothing honesty as the existing day-change total: undefined (rendered as `—`)
  unless every position has both a live price and a cost basis, never a partial sum presented
  as complete.
- Per-row provenance/freshness (source + last-updated) is a `title` tooltip on the Source
  badge (`provenanceTitle()` in `PortfolioTable.tsx`) rather than a separate icon/date column.

## Truthful states audit (UX-09)

State matrix per route — what each named state looks like and where it's implemented.
"—" means the state can't occur on that route given its data shape.

| Route | Loading | Empty | Stale | Partial | Disconnected/degraded | Error |
|---|---|---|---|---|---|---|
| Today | `AppShell`'s boot skeleton while `booting` | `EmptyState` (0 holdings) | `MorningHeader` flags `lastSyncAt` >24h old (amber, `isStaleSync`) | Day change → honest "unavailable" text, never a fabricated 0% (`portfolioDayChange`) | Local/Demo banner (`AppShell`) when `backend==='local'` | `AppShell`'s global `remoteError` banner |
| Earnings | boot skeleton | `EmptyState` (0 holdings); separately "No reports match this filter" (0 after filter) | — (per-card `FreshnessLabel` already surfaces provenance age) | Cards with no fixture entry show "no estimate available" per field (`MetricPair`), never fabricated | Local/Demo banner | global banner |
| Calendar | boot skeleton | empty days render plainly, no dots; `SelectedDayDetail` prompts "Select a day…" before any pick, "No events this day" after picking an empty one | — | — | Local/Demo banner | global banner |
| Portfolio | boot skeleton | table/cards show `emptyMessage` (0 holdings, or 0 after search/filter) | — (see Diagnostics) | Day change and Total gain/loss both honest-`—` unless the *whole* book qualifies (`portfolioDayChange`/`portfolioTotalGainLoss`); per-row Value shows "No price yet" instead of a fabricated $0.00 when a position has neither price nor cost basis (`hasNoPriceData`) | Local/Demo banner | global banner |
| Settings | boot skeleton (via shared shell) | Account/Brokerage explain *why* instead of disappearing when not configured/signed in (UX-08) | Diagnostics rows show `formatRelativeSync` per provider (visually plain, but the timestamp itself makes staleness legible) | n/a — Settings shows raw state, not aggregates | Diagnostics' `local`/`not-run` states | Diagnostics' `error` state + raw `remoteError`/`quotesError`/`brokerageError` text, not just a status pill |

Two things audited and found already correct, not just asserted:
- **No demo-data flash**: `AppShell` renders the boot skeleton, not routed content, until
  `booting` resolves (Phase 1 work, reverified by screenshot on every PR this session).
- **No fabricated fallback metrics**: audited every `?? 0`/similar fallback added or touched
  this session. The one real gap found — `holdingMarketValue` silently returning `$0` for a
  position with neither price nor cost basis — is fixed via `hasNoPriceData` above; the
  underlying `$0` still feeds totals/weights math (a real, if incomplete, number), but the
  per-row *display* no longer presents it as an observed value.

**DeepSeek resilience**: not applicable yet — no live DeepSeek integration exists in this
codebase (per AGENTS.md's phase ordering, that's backend work after UX-11). `GeneratedInsight`
already degrades correctly for the one state that *is* reachable today (`interpretation`
absent → renders `null`, verified sections unaffected, see UX-05's `EarningsDetailDrawer`
tests). Delayed/rate-limited/malformed-response handling has to be re-verified against the
real integration once it exists — this note exists so that task doesn't skip it.

**Demo/fixture privacy**: `src/data/demo.ts` and `src/data/earningsFixtures.ts` audited —
synthetic tickers/share counts/prices only, no real email, account identifier, or portfolio
value. No screenshot taken during this project's development has shown a real signed-in
book (verified: every screenshot this session was Local/Demo mode).

## Mobile, accessibility, and interaction polish (UX-10)

**Automated scan**: ran `axe-core` (WCAG 2.0/2.1 A+AA ruleset) via a one-off Playwright script
against all 5 routes at desktop (1440×900) and mobile (390×844), plus the earnings detail
drawer open state. `axe-core` was removed from `package.json` afterward — it was a one-time
manual audit tool, not wired into `npm test` (this project doesn't have Playwright as a real
dependency, only available globally in dev sandboxes). Re-run the same way before a future
release if accessibility regressions are a concern; a permanent CI gate would need Playwright
added as a project dependency first.

Findings, all fixed:
- **Contrast (serious, 2 routes)**: `text-ink-500` (`#64748b`) on dark surfaces measured
  ~3.8:1, under the 4.5:1 WCAG AA minimum for normal text. Swapped every `text-ink-500` usage
  to `text-ink-450` (`#7c8ba1`, already introduced in UX-01 for exactly this contrast level)
  app-wide — a strict, monotonic contrast improvement since ink-450 is lighter than ink-500
  against the same dark backgrounds. Re-scanned clean afterward.
- **Keyboard-focusable scrollable region (serious, mobile Settings)**: the Impact-score `<pre>`
  block had horizontally-scrollable content with no focusable descendant, unreachable by
  keyboard in Safari. Added `tabIndex={0}` + `aria-label`.

Manual fixes beyond what the automated scan covers:
- **Safe areas**: mobile bottom nav (`AppShell`) and the mobile bottom sheet (`Dialog`) both
  add `env(safe-area-inset-bottom)` padding so content isn't obscured by the home indicator
  on notched phones.
- **Reduced motion**: a global `prefers-reduced-motion: reduce` rule in `index.css` cuts
  animation/transition duration to near-zero and disables smooth scroll — a duration cut, not
  a functionality cut, nothing depends on motion to be usable.
- **Touch targets**: `CarouselControls`' dots and prev/next arrows now pad out to a real
  tappable area (`p-2.5`) instead of the tiny visible dot itself being the only hit target —
  the dot's small visual size stays unchanged (an inner `<span>`, decoupled from the outer
  `<button>`'s hit area).
- **Screen-reader names for the calendar's visual indicators**: `MonthCalendar`'s per-event
  dots convey type (color) and weight (size) purely visually. Each event row now carries a
  real `aria-label` ("Earnings: MSFT — Microsoft earnings, high impact") and the dot itself is
  `aria-hidden` — matches `HistoricalBeatStrip`'s existing per-dot `aria-label` pattern (UX-02).
- **Keyboard tab order**: manually walked Tab through Today/Earnings/Portfolio — order follows
  visual layout (nav → page controls → content), no traps, no illogical jumps; verified via a
  Playwright script that logs `document.activeElement` on each Tab press.

## Quality bar

- No layout jump when data arrives
- Empty states teach next action
- Impact score breakdown visible (W/T/R)
