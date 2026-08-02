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
- Today: `ExposureStrip`, `EventCard`, `FilterBar`, `SortToggle`
- Calendar: `MonthCalendar`
- Primitives: `Badge`, `Stat`, `Skeleton`, `Button`/`PillButton`, `.input`

## Micro-label convention

Small labels (stat-tile labels, form field labels) use sentence case, `text-xs text-ink-450`
— not all-caps tracked `text-ink-500`. `ink-450` sits between `ink-400`/`ink-500` specifically
for this contrast level. Accent-colored eyebrow/kicker text (page headers, e.g. "Portfolio
radar") is a different, intentional pattern and keeps its existing all-caps `accent-500`
styling — this convention only applies to neutral-toned micro-labels.

As of UX-01 this has been applied to `Stat`, `PortfolioPage`'s `Field`, and the shell nav —
not yet swept across every page (deferred to UX-06/07/08, which already own those pages).

## Quality bar

- No layout jump when data arrives
- Empty states teach next action
- Impact score breakdown visible (W/T/R)
