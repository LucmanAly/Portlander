# Portlander — UX Map

A running log of UX issues found and suggested fixes.

## Source attribution

- **Sections 1–4:** Claude, based on a review of the `develop` branch source. The live site could not be fetched directly in that session, so those findings were grounded in the deployed code.
- **Sections 5 onward:** **ChatGPT**, based on a direct user-perspective review of `https://portlander.netlify.app/` across Today, Earnings, Calendar, Portfolio, Settings, the earnings detail drawer, and the responsive navigation rules, followed by a product-identity discussion with the owner.

Status legend: `[ ]` not started · `[~]` discussed only / partially done · `[x]` implemented

## Implementation status — P0 pass

Shipped on `claude/portlander-ux-improvements-s2fwcm`: mobile bottom nav cut to 4 tabs
with Settings moved to a top-bar icon and bigger touch targets; Settings split into a
plain-language default view with Diagnostics/env-setup/impact-formula collapsed under
Troubleshooting/About; Today's Needs Attention rows are now tappable and deep-link into
Earnings/Calendar; Portfolio's search/filter/sort moved above the table, the meta-copy
was removed, the watchlist remove button got a real tap target, and CSV headers are
collapsed under "Import help"; the calendar's portrait ticker-truncation bug is fixed
(ticker stacks under the dot below the `sm` breakpoint); Earnings' "Active" filter was
renamed to "Awaiting results" rather than removed (see §9 note — the underlying state is
real, not just ambiguous labeling). Explicitly **not** done this pass, still open:
native `confirm()` dialogs, page transitions/toasts, Today's information hierarchy
rewrite, Calendar's default-day-selection/Month-Agenda toggle, and everything in
Priority 1/2 below beyond what's noted inline.

## Implementation status — P1 pass

Shipped on top of P0, same branch: Portfolio's Source column now defaults to hidden
(still available via "Customize columns", provenance stays on the row tooltip) and
delete buttons (table row + watchlist) are real 44px targets; Earnings' filter/sort
controls are taller, AMC/BMO badges spell out "Before open"/"After close", EPS/Revenue
blocks disappear entirely (replaced by one honest line) when there's no consensus or
actual data at all instead of doubling up "—" + "no estimate available", and
`FreshnessLabel` renders nothing instead of "Source unknown" when provenance is
missing; Calendar now defaults to today (or the next upcoming event if today's empty)
instead of a blank "select a day" prompt, gained a mobile Month/Agenda toggle
(defaulting to Agenda), the 30-day exposure line reads as a plain sentence instead of
a raw percentage fragment, the legend is one line with the detailed dot/timing rules
in a tooltip, and the month-nav arrows/Today button are a bit bigger. Desktop drawer +
mobile bottom sheet for Earnings detail was already correct (`Dialog.tsx`) — nothing
to do there, just confirmed.

Still open from P1: hiding delete behind a 3-dot menu (kept as a direct 44px button
instead — smaller change, same target-size outcome), wider/responsive Earnings card
grid, and the full Calendar bottom-sheet-for-day-detail pattern (Month view already
shows the detail panel inline; a true bottom sheet wasn't built).

## Implementation status — P2 pass

Shipped on top of P0+P1, same branch:

- **Logo system** (§14): the old "P" text badge is replaced everywhere (desktop sidebar,
  mobile top bar, favicon) with an actual event-orbit mark — `src/components/ui/Logo.tsx`,
  an outlined "P" glyph (stem + bowl) with a bright amber dot sitting on the bowl's curve
  as the "next event" marker, matching the spec's brief almost exactly. Verified visually
  at 24/28/32px via a real headless-browser screenshot, not just eyeballed in code — the
  first version (a stem + dashed-circle arc) read as an abstract squiggle at small sizes,
  not a "P," and was redrawn as a proper glyph outline before shipping.
- **Brand descriptor/tagline** (§13): "Portlander — portfolio event intelligence. Know
  what matters next." added to Settings → About, which is this app's only real
  first-contact/identity surface (there's no separate sign-in or onboarding screen — sign-in
  lives inline in Settings → Account). Not repeated anywhere else.
- **Local/Demo banner → compact pill** (§12): the full-width amber banner that used to
  render on every single page is gone. The existing small "Local" pill (mobile header) and
  a new clickable "Local / demo" caption (desktop sidebar) are the persistent, compact
  signal; tapping either expands the full explanation (with a close button), instead of it
  being permanently on-screen everywhere.
- **Toast feedback** (§12): new `src/components/ui/Toast.tsx` (`ToastProvider` + `useToast`),
  wired to the actions that previously had **zero** feedback: adding/updating a holding,
  removing a holding, adding/removing a watchlist ticker, resetting demo data, signing out,
  and "Reload data" in Troubleshooting. Deliberately **not** wired into refresh-quotes/
  brokerage-connect/CSV-import — those already show their own inline status (captions,
  Diagnostics rows, import-preview panel) and a duplicate toast would just be noise.
- **Subtle transitions** (§12): a 180ms fade+slide on route change (`animate-page-in`,
  keyed on the route so it retriggers per navigation) and on toast entry. Both ride the
  app's existing global `prefers-reduced-motion` clamp in `index.css` (forces
  `animation-duration: 0.01ms` for anyone with reduced-motion on) rather than needing a
  separate `motion-safe:` variant — one mechanism, not two.

**Explicitly not done, deferred:**
- PWA icons (192/512/maskable) and a `manifest.json` (§14) — there's no manifest or PWA
  install flow in this app at all today, so this would be new infrastructure, not a
  refinement of something that exists. Flagging it rather than quietly skipping it.
- A first-run onboarding wizard (§11) — the banner/pill consolidation and descriptor
  addition cover part of the underlying goal ("help a new user understand Demo mode
  without exposing setup internals") without the cost of building a guided flow.
- A broad hover/focus/pressed-state sweep across every interactive surface (§12) — most
  already had `focus-ring`; only the changed surfaces (bottom nav, toast, banner pill)
  got explicit new pressed states this pass, not a full audit.
- Native `confirm()` dialogs (Settings reset, Portfolio row/watchlist delete, CSV replace)
  — same open item carried from P0/P1.

Checkboxes below are updated to match; items not mentioned in any status note are
still open.

---

## 1. Bottom navigation is too small / low affordance

**Source:** Claude

**File:** `src/components/layout/AppShell.tsx:133-150`

**Problem**
- Icons are `h-4 w-4` (16px), labels are `text-[10px]` (10px), row padding is `py-2.5`. Smaller than the iOS/Material minimum tap-target guidance (44–48pt).
- 5 equal columns (`grid-cols-5`) crowds longer labels ("Portfolio", "Settings") next to a small icon.
- The only "active" indicator is a text color change (`text-accent-400` vs `text-ink-450`) — no background pill, no elevation. Doesn't read as "pressable."

**Suggested fix**
- [x] Increase row height to ~56–60px, icons to `h-5/h-6`. (52px min-height row, `h-6` 24px icons.)
- [x] Give the active tab a filled pill/background, not just a color change.
- [x] Consider dropping to 4 primary tabs (Today, Earnings, Calendar, Portfolio) and moving Settings behind a profile/avatar icon in the top bar, so the remaining four get more breathing room.

---

## 2. Settings page reads like a developer debug console

**Source:** Claude

**File:** `src/pages/SettingsPage.tsx`

**Problem**
- **Data & sync** (line 238): exposes raw "Write backend: supabase/local" badges, the Supabase host string, holdings/events counts, and a "Cloud setup checklist" with literal env var names (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), a `supabase/schema.sql` reference, and `npm run dev` — install/setup documentation for a developer, shown on the same screen a normal user opens to sign in.
- **Diagnostics** (line 378): a live status panel — Backend / Authentication / Positions / Prices / Events, each with "Healthy / Action needed / Error / Checking / Not tested" chips. Useful while building the app, meaningless to an end user checking their portfolio.
- **About this build** (line 482): prints the literal impact-score formula as a code block. A spec artifact, not user-facing content.
- "Reset demo data" (line ~314) uses a native browser `confirm()` dialog, which visually breaks out of the app's design system.

**Suggested fix**
- [x] Split Settings into two tiers:
  - **Simple / consumer-facing** (default view): Account (sign in/out), Brokerage connection, Appearance/notifications if applicable, Sign out.
  - **Advanced / Developer** (collapsed accordion, or gated behind a hidden trigger like tapping the version number): Diagnostics, impact-score formula, env var setup checklist, raw backend/host strings.
- [x] Rewrite the copy that stays visible in plain language — e.g. "Local / demo mode" banner should say what it means for the user ("Your data is saved on this device only"), not describe the backend architecture.
- [ ] Replace the native `confirm()` on "Reset demo data" with an in-system confirmation modal. (Still native `confirm()` — out of scope for this pass.)

---

## 3. Calendar: ticker names get cut to almost nothing in portrait mode

**Source:** Claude

**Files:** `src/components/calendar/MonthCalendar.tsx:195-213`, `src/pages/CalendarPage.tsx`

**Root cause**
- The month grid is always 7 columns (`grid-cols-7`), full width, on every screen size and orientation.
- Each day cell's width is just "available width ÷ 7." On an iPhone in **portrait**, that's roughly 45–55px per cell after grid gaps and padding — after the colored weight-dot and its gap, there are only ~25–30px left for the ticker text.
- The ticker span uses `truncate` (`min-w-0 flex-1 truncate`, line 204), so at that width it clips to essentially one character + ellipsis — which is what you're seeing as "just the first letter."
- In **landscape**, the same 7-column grid gets ~2x the width per cell, so the full ticker (e.g. `AAPL`) fits before truncation kicks in. That's the entire difference — it's not a deliberate landscape-only feature, it's a side effect of a fixed-column grid at a width that only works in landscape.
- This is a known intentional trade-off in the code (see the comment on `SelectedDayDetail.tsx`: cells are meant to stay "scannable dots," with full detail deferred to the day-detail panel) — but the current spacing was tuned/tested at landscape widths, not portrait, which is the orientation most people actually use.

**Suggested fix** (pick one direction, or combine — flagged for a decision):
- [x] **Adaptive cell content:** on narrow/portrait viewports, stack the ticker text below the dot instead of beside it, freeing up the full cell width for the ticker instead of splitting it with the dot+gap. Implemented via `sm:` breakpoint (flex-col below, flex-row at `sm`+). Still shows up to 3 events per cell rather than trimming to 1–2 — cells just grow taller instead; revisit if that reads as cramped in practice.
- [ ] **Fewer columns on small screens:** switch to a 7-day **week view** as the default on mobile portrait (with swipe/paging between weeks), so each day column gets much more width for the same information — this is the most direct way to guarantee full ticker names are readable without shrinking anything else. (Not chosen — adaptive stacking above was lower-risk for this pass.)
- [ ] **Lead with the agenda list on mobile:** the page already has a full-width "Agenda · next 30 days" list below the grid that shows complete ticker + title text with no truncation problem (`CalendarPage.tsx:62-94`). On mobile portrait, consider making the agenda list the primary view and the month grid a secondary/collapsible view, since the list format doesn't have the space constraint at all. (Not chosen this pass.)
- [x] Whichever direction is picked, re-check dot size, badge, and font-size proportions together (not just the ticker width) so the cell reads as one coherently-sized unit rather than a patchwork of independently-tuned pieces.

---

## 4. General smoothness / polish

**Source:** Claude

- [ ] Add a transition (fade or slide) when switching between tabs/pages — navigation is currently an instant hard cut.
- [ ] Add toast/snackbar feedback for actions (sync complete, reset done) instead of relying on state changes buried in Diagnostics.
- [ ] Consider a lightweight first-run onboarding flow (e.g. for connecting a brokerage), since there's currently no guided entry point for a new user.

---

# ChatGPT — live-site UX and product-identity recommendations

The following recommendations are explicitly **ChatGPT's**. They extend Claude's code-based notes with observations from the live product and the owner's stated goal: Portlander should feel smooth, interactive, simple, and consumer-friendly rather than like a technical project.

## 5. Product-level diagnosis and guiding principle

**Source:** ChatGPT

**Current diagnosis**

Portlander has a strong visual foundation and useful information, but it still feels partly like a polished engineering dashboard. It does not primarily need more features. It needs:

- Clearer information hierarchy.
- Plain, user-facing language.
- Stronger mobile ergonomics.
- Better empty and unavailable-data states.
- More obvious interactive affordances and feedback.
- A consistent identity tied to portfolio events, not generic stock-market imagery.

**Guiding product sentence**

> Portlander opens and immediately tells me what matters next for my portfolio.

Every major screen and interaction should reinforce that sentence.

**Target personality**

> Calm, observant, precise, and prepared.

The product should not feel playful like a consumer trading game, nor technical like an internal administration console.

---

## 6. Mobile application shell and navigation

**Source:** ChatGPT

**Observed problem**

- The responsive bottom navigation uses 16px icons and 10px labels.
- Several other controls are only 24–32px tall, and some removal controls are smaller still.
- Five equally weighted bottom destinations reduce visual breathing room.
- The active tab is not visually prominent enough.
- Settings is not a daily destination and does not deserve equal bottom-navigation weight.

**Recommended structure**

- [ ] Keep only four primary bottom destinations: **Today, Earnings, Calendar, Portfolio**.
- [ ] Move **Settings** to a gear/profile control in the mobile top-right header.
- [ ] Make the bottom bar fixed, approximately 64–68px tall plus safe-area padding.
- [ ] Use 22–24px icons and 11–12px labels.
- [ ] Ensure every action has at least a 44×44px touch area, including filters, sort controls, calendar arrows, delete controls, and watchlist removal.
- [ ] Give the active tab a visible tinted background, filled pill, or top indicator instead of relying only on color.
- [ ] Add sufficient page-bottom padding so content never sits underneath the fixed bar.
- [ ] Add visible pressed states for touch feedback.

**Persistent shell decision**

- **Desktop:** keep the persistent sidebar. Do not add a redundant desktop top brand bar.
- **Mobile:** use a compact sticky top app bar plus the fixed four-item bottom navigation.
- The top bar carries identity and global actions; the bottom bar carries navigation. Do not make them compete for the same job.

---

## 7. Settings simplification and information architecture

**Source:** ChatGPT

This reinforces Claude's Section 2 but recommends a specific consumer-facing structure.

**Remove from the normal Settings surface**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `.env.local`, `supabase/schema.sql`, and `npm run dev` instructions.
- Raw Supabase project hostname.
- “Write backend” terminology.
- Long implementation explanations about Finnhub, Supabase, and generated content.
- The literal impact-score formula as an always-visible code block.

These details may remain in developer documentation or a deliberately opened advanced diagnostics surface, but they should not be part of the ordinary user journey.

**Recommended Settings home**

| Section | User-facing content |
|---|---|
| Account | Signed in/out state, email, sign-in/sign-out |
| Brokerage | Fidelity/SnapTrade connection state, connect/reconnect/sync |
| Data & sync | Last portfolio, price, and event sync in plain language |
| Data sources | Short explanation of where verified information comes from |
| Troubleshooting | Diagnostics, connection tests, retry actions, raw details only when expanded |
| About | Version, release name, and last-updated date |

**Recommended behavior and copy**

- [ ] Rename the page heading from **Workspace** to **Settings**.
- [ ] Present the sections as a short list of rows/cards; tapping one opens a focused detail view or expandable panel.
- [ ] Place existing Diagnostics under **Troubleshooting**, not alongside everyday account controls.
- [ ] Show one simple health summary such as “Everything is working” or “Brokerage connection needs attention.”
- [ ] Replace “Magic-link sign-in. After auth…” with “Sign in to sync your portfolio across devices.”
- [ ] Replace backend-oriented Local/Demo copy with “Your data is stored on this device only.”
- [ ] Hide the impact formula behind **How impact is calculated**.
- [ ] Put destructive actions such as Reset demo data inside a clear Danger zone and use an in-product confirmation modal.
- [ ] Fix copy defects such as the observed “promoted tomain” spacing error.

**Versioning clarification**

An earlier ChatGPT review suggested keeping `v1.0` because the earlier project context said Phase 2 was not complete. The current repository state now records Phase 2 as complete and `v2.0` as the promoted **Portfolio Event Intelligence** release. Therefore:

- [x] Keep the current `v2.0` release metadata.
- [ ] Do not revert to `v1.0` based on the earlier conversation.
- [ ] Continue using `src/lib/appMeta.ts` as the source of truth.

---

## 8. Today should tell one clear morning story

**Source:** ChatGPT

**Observed problem**

The current Today page presents portfolio value, an empty “nothing reporting” card, Needs attention, exposure percentages, and Next critical as separate widgets. The user has to assemble the meaning.

**Recommended hierarchy**

1. What is happening today?
2. What is the next important event?
3. How much of the portfolio is exposed this week?

**Recommended implementation**

- [ ] Show the date, portfolio value, daily move, and last-updated time in the compact header.
- [ ] Make the dominant card the next important event, for example: **“MSFT earnings in 2 days · 24.3% portfolio exposure.”**
- [ ] Make “Nothing reporting today” a small, reassuring status rather than the central empty card.
- [x] Make every Needs attention / next-event row visibly tappable and open the existing earnings detail drawer. (Deep-links to `/earnings?ticker=` for earnings rows, opening the drawer; non-earnings rows deep-link to `/calendar?date=` since there's no drawer equivalent for macro/dividend events.)
- [x] Add a chevron, hover/pressed state, and consistent pointer behavior to interactive cards. (Needs Attention rows only — EarningsDeck cards already had this.)
- [ ] Follow with a compact seven-day timeline or reporting cluster, then a smaller 30-day summary.
- [ ] Replace technical metric labels with human sentences:
  - “60% of your portfolio reports this week.”
  - “All of your portfolio reports within 30 days.”
  - “MSFT is your highest-impact upcoming event.”
- [ ] Display **High / Medium / Low impact** prominently; keep the raw `77/100` score secondary or in an explanation tooltip.

---

## 9. Earnings workspace cleanup

**Source:** ChatGPT

**Observed problem**

- The meaning of the **Active** filter is ambiguous.
- Filters and sort controls are visually small.
- Cards repeat dashes, “no estimate available,” and “Source unknown,” making truthful missing data look like a broken product.
- “AMC” can be mistaken for the AMC ticker instead of “after market close.”
- Narrow desktop cards leave a large unused area.
- The detail drawer interaction is strong, but when data is sparse it mainly duplicates the card.

**Recommended changes**

- [~] Simplify filters to **Upcoming / Reported / All** unless Active has a distinct user-tested meaning. **Claude's counter:** it does — `earningsIntel.ts`'s `deriveEarningsViewState` models "event date passed, no actual results yet" (real-world reporting lag) as its own `awaiting` state, deliberately distinct from `upcoming`. Collapsing it would hide something the code already tracks correctly. Renamed the label "Active" → "Awaiting results" instead of removing the filter.
- [x] Increase filter and sort controls to at least 40–44px tall. (`PillButton` md and `SortToggle` bumped to `py-2`/`py-1.5` — closer to the target than before; not pixel-exact 44px but a real, scoped improvement.)
- [x] Use **After market close** / **Before market open**, or the shorter **After close** / **Before open**, rather than unexplained AMC/BMO abbreviations.
- [x] Hide EPS/revenue blocks on summary cards when both values are unavailable. (New `hasFinancialData()` in `earningsIntel.ts`; replaced with one line, "No consensus estimates available yet.")
- [x] Consolidate provenance and unavailable-data explanation instead of repeating “Source unknown” on every card. (`FreshnessLabel` now renders nothing when provenance is missing, and callers skip the wrapping Source row entirely — omission read as calmer than a repeated placeholder.)
- [ ] Use wider horizontal cards or a two-column grid on desktop; retain a one-column stack on mobile. (Not touched — current `sm:grid-cols-2 lg:grid-cols-3` left as-is; "leaves unused area" is a subjective call that needs a screenshot/second opinion before changing.)
- [x] Preserve default sorting by portfolio relevance/impact, with Date as an obvious alternate. (Already true; confirmed, not touched.)
- [x] Keep the right-side desktop drawer and mobile bottom sheet. (Already true — `Dialog.tsx` already does exactly this. Confirmed, not touched.)
- [x] Ensure the drawer adds value through verified financials, history, exposure, interpretation, and other genuinely available detail rather than merely repeating the summary card. (Already true; confirmed, not touched.)
- [ ] If no meaningful additional detail exists, avoid presenting the card as if it opens a rich destination.

---

## 10. Calendar interaction and mobile representation

**Source:** ChatGPT

This extends Claude's portrait-layout diagnosis.

**Recommended behavior**

- [x] Select today by default.
- [x] If today has no event, automatically select the next event date so the detail panel is never a dead blank state.
- [ ] On mobile, open selected-day details in a bottom sheet. (Not built — the Month view already shows `SelectedDayDetail` inline next to/below the grid; a true swipe-up sheet is a bigger interaction change, deferred.)
- [x] Provide a clear **Month / Agenda** switch on small screens, with Agenda allowed to become the default in portrait mode. (Agenda is the default on all mobile widths, not orientation-detected specifically — simpler and covers the portrait case, which is the overwhelming majority of mobile usage.)
- [x] Replace overly precise language such as “100.0% of the book reports within 30 days” with “All holdings report this month.” (Uses "All of your portfolio reports within 30 days" / "None of..." / "`X`% of your portfolio reports within 30 days.")
- [x] Shorten the long encoding explanation under the legend and move detailed dot/session rules into an information tooltip.
- [x] Preserve weighted dots and event-type colors while keeping cells scannable rather than miniature dashboards. (Untouched by the P0 truncation fix or this pass; confirmed still true.)
- [~] Ensure calendar arrows, Today, day cells, and event rows meet the 44px touch-target standard. (Nav buttons bumped from `size="sm"` to the shared `Button` default — bigger, not pixel-exact 44px. Day cells/event rows not individually re-measured.)

---

## 11. Portfolio for a real 40-holding book

**Source:** ChatGPT

**Desktop direction**

The table-first desktop structure is good and should be preserved.

**Mobile direction**

Do not squeeze the complete table into a phone viewport. Use compact holding rows/cards with:

- Ticker and company name.
- Current value.
- Daily change.
- Portfolio weight.
- A chevron or detail action.

**Recommended changes**

- [x] Move search, filters, and sorting immediately above the holdings table/cards. These are viewing controls, not management tools, and become essential with roughly 40 holdings.
- [x] Keep add/update, CSV import/export, and other mutations below the primary book view. (Already was; preserved.)
- [x] Hide **Source** by default and expose provenance through a tooltip/detail treatment. (`defaultVisible: false` in `portfolioColumns.ts`; still togglable via "Customize columns", and the mobile card view + row tooltip already carried provenance regardless.)
- [x] Move delete/remove actions into a three-dot menu or provide at least a 44px target with an explicit confirmation. (Went with the 44px-target option — `h-11 w-11` on both the table-row and watchlist-chip delete buttons — rather than a 3-dot menu, which would've been a bigger interaction change for the same outcome. Confirmation is still native `confirm()`, same open item as Settings' Reset action.)
- [x] Fix especially small watchlist remove controls. (14px icon with no padding → 32px (`h-8 w-8`) tap target.)
- [x] Collapse literal CSV headers under an **Import help** disclosure.
- [x] Remove explanatory meta-copy such as “These controls stay below the table…”; the hierarchy should explain itself.
- [x] Keep truthful unavailable states for incomplete price refresh or cost-basis coverage. (Not touched; preserved.)

---

## 12. Global clarity, feedback, and polish

**Source:** ChatGPT

- [x] Replace the full yellow Local/Demo warning repeated on every page with a compact persistent **Demo data** status pill and a full explanation only when first shown or opened. (Compact pill in the mobile header + a clickable sidebar caption; tapping either opens the full explanation with a close button, instead of it being permanent on every page.)
- [ ] Avoid placing “Local/demo” directly beneath the brand; implementation state should not become the app's identity. **Not done** — kept it in the same spot under "Portlander" in the sidebar, just made it compact/interactive instead of relocating it entirely. Moving it elsewhere (e.g. into a status area) is a bigger layout change than this pass covered.
- [ ] Slightly increase normal body-text size and contrast; reduce excessive all-caps micro-labels.
- [x] Keep the existing layout-matched loading skeletons. (Not touched; confirmed still true.)
- [~] Add concise success/error toasts after refresh, sync, import, reset, and connection actions. (New `Toast.tsx` wired to add/update/remove holding, add/remove watchlist, reset demo, sign out, reload data — actions that had zero feedback before. Deliberately *not* wired into refresh-quotes/brokerage-connect/CSV-import, which already have their own inline status and didn't need a second, redundant channel.)
- [x] Use subtle 150–200ms drawer/card/page transitions and respect reduced-motion preferences. (180ms fade+slide on route change and toast entry, riding the app's existing global `prefers-reduced-motion` clamp rather than a separate motion-safe variant.)
- [~] Add clear hover, focus, and pressed states to every interactive surface. (Most already had `focus-ring`; only the surfaces touched this pass — bottom nav, toast, banner pill — got new explicit pressed states. Not a full audit.)
- [x] Do not add animation for decoration alone. Portlander should feel calm and fast, not playful. (Followed by omission — the two animations added are both functional feedback, not decoration.)
- [x] Use honest, quiet unavailable states instead of filling screens with repeated dashes and technical explanations. (Delivered in P1 — EPS/Revenue honest line, `FreshnessLabel` omission.)
- [ ] Consider a lightweight first-run path that helps a new user sign in, connect a brokerage, or understand Demo mode without exposing setup internals. **Not built** — the banner/pill consolidation and About descriptor address part of the underlying goal without the cost of a guided flow.

---

## 13. Portlander product identity

**Source:** ChatGPT

Portlander should have a recognizable identity, but not a large decorative logo repeated throughout the application. Its identity should come from a compact mark, persistent shell, consistent event motif, plain language, and restrained motion.

**Brand hierarchy**

- **Product name:** Portlander
- **Descriptor:** Portfolio event intelligence
- **Tagline:** Know what matters next.

**Usage rules**

- [x] Keep **Portlander** visible in the persistent desktop sidebar and mobile top bar. (Already true; confirmed, not touched.)
- [~] Use **Portfolio event intelligence** on sign-in, onboarding, About, landing/metadata, and other first-contact surfaces where the name needs explanation. (Added to Settings → About — this app's only real first-contact surface, since sign-in lives inline in Settings → Account rather than a dedicated screen.)
- [x] Use **Know what matters next** on sign-in/onboarding or marketing surfaces only; do not repeat it on every application page. (Same single placement as above, About only.)
- [x] Do not rename the product. (Trivially true; not touched.)
- [x] Avoid generic fintech identity cues such as candlesticks, dollar signs, bulls/bears, pie charts, and upward arrows. (Already true; confirmed, not touched.)

---

## 14. Logo system: event-orbit P

**Source:** ChatGPT

**Recommended direction**

Replace or refine the generic rounded-square `P` into an **event-orbit P**:

- A simple vertical stem forming the `P`.
- A partial circular ring forming the upper bowl.
- One bright dot on the ring representing the next important event.
- Teal as the primary brand color.
- Amber reserved for an approaching/attention event where semantically appropriate.

The mark should communicate:

- **P:** Portlander / portfolio.
- **Ring or timeline:** calendar and time.
- **Weighted dot:** the event that matters next.

**Production requirements**

- [x] Remain recognizable at 24–32px. (Verified with real headless-browser screenshots at 24/28/32px, not just eyeballed in code — the first attempt didn't hold up at small size and was redrawn.)
- [x] Create a standalone mark and a mark-plus-wordmark lockup. (`Logo.tsx` is the standalone mark; the sidebar/mobile-header layout — mark + "Portlander" text — is the lockup.)
- [ ] Provide favicon sizes and PWA icons (`192`, `512`, and maskable variants as required by the manifest). **Not done** — there's no `manifest.json` or PWA install flow in this app today, so this would be new infrastructure rather than refining an existing asset. `favicon.svg` was updated to the new mark; the 192/512/maskable raster set was not built.
- [x] Verify the mark against the existing dark background and at small mobile-header size. (Screenshotted at 28px in the actual mobile header.)
- [x] Keep the wordmark in the existing typography family unless a later brand exercise proves a change is necessary. (Not changed.)
- [ ] A cold-load/splash state may use one subtle event-dot motion; the logo should remain static during ordinary use. (No splash screen exists to add this to; not built.)

---

## 15. Where the logo and persistent identity should live

**Source:** ChatGPT

| Surface | Recommendation |
|---|---|
| Desktop application | Logo + Portlander at the top of the existing persistent sidebar |
| Mobile application | 28px logo + Portlander on the left of a compact sticky top bar |
| Mobile global actions | Sync state and Settings/profile control on the right of the top bar |
| Bottom navigation | Four primary destinations only; do not repeat the wordmark here |
| PWA/app icon | Standalone event-orbit P mark |
| Favicon | Simplified standalone mark |
| Loading/splash | Centered mark with restrained one-time dot movement |
| Sign-in/onboarding | Full lockup, descriptor, and occasional tagline |
| Settings → About | Full identity plus version, release name, and last updated |

**Explicit decision**

- [x] Do not add a second persistent desktop top bar; the sidebar already owns desktop identity. (Not added.)
- [x] Do add a compact sticky mobile top bar, approximately 56px tall. (Already existed pre-P2; confirmed, not touched.)
- [x] Do not place a large logo or tagline inside every route. (Tagline only appears in Settings → About.)

---

## 16. Visual language and voice

**Source:** ChatGPT

**Color roles**

- **Teal:** brand, selection, primary interaction.
- **Amber:** approaching event or attention.
- **Red:** actual negative/risk state only.
- **Green:** actual positive result only.
- **Dark navy/charcoal:** calm financial foundation.
- Preserve existing distinct colors for earnings, dividends, and macro events where they carry real meaning.

**Recurring motif**

- [ ] Reuse the orbit/dot/time motif lightly in calendar selection, event indicators, loading, and impact explanations. (The motif lives in the logo only so far — extending it into the calendar/loading states is a deeper design-system pass, not done.)
- [x] Do not turn the motif into decorative background noise. (Trivially satisfied — it isn't used anywhere but the logo.)

**Voice rules**

- [~] Prefer “portfolio” over internal jargon such as “book” when addressing ordinary users. (Calendar's exposure sentence fixed in P1; not audited elsewhere in the app.)
- [~] Prefer direct sentences such as “60% of your portfolio reports this week.” (Done for Calendar in P1; Today's `ForwardExposurePanel` phrasing not rewritten to match — that's §8's fuller Today hierarchy rewrite, still open.)
- [x] Avoid “workspace,” “write backend,” environment-variable language, and raw implementation terminology in normal flows. (Done in P0 — "Workspace" → "Settings," that language moved behind Troubleshooting's collapsed technical details.)
- [x] Be transparent about unavailable or generated information without sounding broken or defensive. (Done in P1 — EPS/Revenue honest line, `FreshnessLabel` omission — plus the pre-existing generated-interpretation separation.)

---

## 17. Recommended implementation order

**Source:** ChatGPT

These items should be treated as refinement work rather than a stack rewrite or new feature phase.

### Priority 0 — biggest immediate UX improvement

1. [~] Mobile four-item navigation, sticky top identity bar, and 44px touch targets. (Nav done; sticky top bar already existed; 44px touch targets done for bottom nav/Portfolio deletes/watchlist remove, partial elsewhere — see §6, §10.)
2. [x] Settings simplification and Troubleshooting separation.
3. [~] Today hierarchy and tappable next-event/Needs attention cards. (Tappability done; the fuller hierarchy rewrite in §8 — compact header restructure, human-sentence labels, 7-day timeline — not done.)
4. [~] Remove or consolidate repeated developer/demo and unavailable-data messaging. (Settings' dev-facing content moved/collapsed; Earnings' repeated "Source unknown"/EPS-Revenue dashes fixed in P1; the repeated full-width Local/Demo banner on every page (§12) not consolidated into a compact pill.)

### Priority 1 — core workspace usability

5. [x] Portfolio view controls above the real 40-holding book and safer/larger row actions. (Controls-above-table shipped in P0; Source-hidden-by-default and 44px delete targets shipped in P1.)
6. [~] Earnings filters, plain session language, missing-data cleanup, and responsive card width. (Filter/sort sizing, AMC/BMO wording, and missing-data cleanup done; responsive card width not touched — see §9.)
7. [x] Calendar default selection and mobile Month/Agenda behavior.

### Priority 2 — identity and delight

8. [~] Event-orbit P logo system, favicon, and PWA assets. (Logo + favicon done; PWA manifest/icon set deferred — no existing manifest to extend.)
9. [x] Consistent brand descriptor/tagline placement.
10. [~] Subtle transitions, pressed states, and action feedback. (Transitions + toast feedback done; pressed-state coverage is scoped to what changed this pass, not a full sweep.)
11. [ ] Lightweight onboarding/sign-in guidance. (Not built; partially addressed indirectly via the banner/pill and descriptor work.)

**Do not introduce as part of this refinement**

- A major stack migration.
- A generic AI chatbot.
- Decorative finance charts without a decision purpose.
- Generic neon-fintech branding.
- Excessive animation.
