# Portlander — UX Map

A running log of UX issues found and suggested fixes, based on a review of the `develop` branch source (live site `portlander.netlify.app` could not be fetched directly from this session due to network policy, so findings are grounded in the actual deployed code).

Status legend: `[ ]` not started · `[~]` discussed only · `[x]` implemented

---

## 1. Bottom navigation is too small / low affordance

**File:** `src/components/layout/AppShell.tsx:133-150`

**Problem**
- Icons are `h-4 w-4` (16px), labels are `text-[10px]` (10px), row padding is `py-2.5`. Smaller than the iOS/Material minimum tap-target guidance (44–48pt).
- 5 equal columns (`grid-cols-5`) crowds longer labels ("Portfolio", "Settings") next to a small icon.
- The only "active" indicator is a text color change (`text-accent-400` vs `text-ink-450`) — no background pill, no elevation. Doesn't read as "pressable."

**Suggested fix**
- [ ] Increase row height to ~56–60px, icons to `h-5/h-6`.
- [ ] Give the active tab a filled pill/background, not just a color change.
- [ ] Consider dropping to 4 primary tabs (Today, Earnings, Calendar, Portfolio) and moving Settings behind a profile/avatar icon in the top bar, so the remaining four get more breathing room.

---

## 2. Settings page reads like a developer debug console

**File:** `src/pages/SettingsPage.tsx`

**Problem**
- **Data & sync** (line 238): exposes raw "Write backend: supabase/local" badges, the Supabase host string, holdings/events counts, and a "Cloud setup checklist" with literal env var names (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), a `supabase/schema.sql` reference, and `npm run dev` — install/setup documentation for a developer, shown on the same screen a normal user opens to sign in.
- **Diagnostics** (line 378): a live status panel — Backend / Authentication / Positions / Prices / Events, each with "Healthy / Action needed / Error / Checking / Not tested" chips. Useful while building the app, meaningless to an end user checking their portfolio.
- **About this build** (line 482): prints the literal impact-score formula as a code block. A spec artifact, not user-facing content.
- "Reset demo data" (line ~314) uses a native browser `confirm()` dialog, which visually breaks out of the app's design system.

**Suggested fix**
- [ ] Split Settings into two tiers:
  - **Simple / consumer-facing** (default view): Account (sign in/out), Brokerage connection, Appearance/notifications if applicable, Sign out.
  - **Advanced / Developer** (collapsed accordion, or gated behind a hidden trigger like tapping the version number): Diagnostics, impact-score formula, env var setup checklist, raw backend/host strings.
- [ ] Rewrite the copy that stays visible in plain language — e.g. "Local / demo mode" banner should say what it means for the user ("Your data is saved on this device only"), not describe the backend architecture.
- [ ] Replace the native `confirm()` on "Reset demo data" with an in-system confirmation modal.

---

## 3. Calendar: ticker names get cut to almost nothing in portrait mode

**Files:** `src/components/calendar/MonthCalendar.tsx:195-213`, `src/pages/CalendarPage.tsx`

**Root cause**
- The month grid is always 7 columns (`grid-cols-7`), full width, on every screen size and orientation.
- Each day cell's width is just "available width ÷ 7." On an iPhone in **portrait**, that's roughly 45–55px per cell after grid gaps and padding — after the colored weight-dot and its gap, there are only ~25–30px left for the ticker text.
- The ticker span uses `truncate` (`min-w-0 flex-1 truncate`, line 204), so at that width it clips to essentially one character + ellipsis — which is what you're seeing as "just the first letter."
- In **landscape**, the same 7-column grid gets ~2x the width per cell, so the full ticker (e.g. `AAPL`) fits before truncation kicks in. That's the entire difference — it's not a deliberate landscape-only feature, it's a side effect of a fixed-column grid at a width that only works in landscape.
- This is a known intentional trade-off in the code (see the comment on `SelectedDayDetail.tsx`: cells are meant to stay "scannable dots," with full detail deferred to the day-detail panel) — but the current spacing was tuned/tested at landscape widths, not portrait, which is the orientation most people actually use.

**Suggested fix** (pick one direction, or combine — flagged for a decision):
- [ ] **Adaptive cell content:** on narrow/portrait viewports, stack the ticker text below the dot instead of beside it, freeing up the full cell width for the ticker instead of splitting it with the dot+gap. Drop to showing just 1–2 tickers per cell (with a "+N" overflow badge, which already exists) rather than 3.
- [ ] **Fewer columns on small screens:** switch to a 7-day **week view** as the default on mobile portrait (with swipe/paging between weeks), so each day column gets much more width for the same information — this is the most direct way to guarantee full ticker names are readable without shrinking anything else.
- [ ] **Lead with the agenda list on mobile:** the page already has a full-width "Agenda · next 30 days" list below the grid that shows complete ticker + title text with no truncation problem (`CalendarPage.tsx:62-94`). On mobile portrait, consider making the agenda list the primary view and the month grid a secondary/collapsible view, since the list format doesn't have the space constraint at all.
- [ ] Whichever direction is picked, re-check dot size, badge, and font-size proportions together (not just the ticker width) so the cell reads as one coherently-sized unit rather than a patchwork of independently-tuned pieces.

---

## 4. General smoothness / polish (from earlier discussion)

- [ ] Add a transition (fade or slide) when switching between tabs/pages — navigation is currently an instant hard cut.
- [ ] Add toast/snackbar feedback for actions (sync complete, reset done) instead of relying on state changes buried in Diagnostics.
- [ ] Consider a lightweight first-run onboarding flow (e.g. for connecting a brokerage), since there's currently no guided entry point for a new user.
