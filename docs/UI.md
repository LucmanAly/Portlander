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

## Quality bar

- No layout jump when data arrives
- Empty states teach next action
- Impact score breakdown visible (W/T/R)
