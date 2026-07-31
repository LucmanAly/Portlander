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

- Shell: `AppShell` — desktop sidebar, mobile bottom nav
- Today: `ExposureStrip`, `EventCard`, `FilterBar`
- Calendar: `MonthCalendar`
- Primitives: `Badge`, `Stat`, `Skeleton`, `.input`

## Quality bar

- No layout jump when data arrives
- Empty states teach next action
- Impact score breakdown visible (W/T/R)
