# docs/AI.md — LLM integration plan (DeepSeek)

**Status:** Plan only. Nothing built yet. No `DEEPSEEK_API_KEY` exists in any
environment.
**Last updated:** 2026-08-01
**Supersedes:** an earlier draft of this doc on the never-merged branch
`claude/deepseek-api-integration-k9rwbp` (deferred in session 19 for
merge-conflict reasons, not rejected on substance — most of its
architecture and reasoning carries forward unchanged below). That draft was
written before Phase 2/3 were redefined around earnings intelligence; this
version reflects the actual scoped features and the owner's decisions on
provider and data boundary.

Answers: *should Portlander connect an LLM, and if so, where does it
actually earn its place, under what rules?*

---

## Verdict

**Yes — as a nightly batch enrichment worker plus one on-demand daily
briefing call, not as a feature you talk to.**

Conditions, in priority order:

1. **Waits on Phase 2 ("Signal") shipping first.** Phase 1 is signed off
   (`PROGRESS.md`, 2026-08-01). `AGENTS.md` now puts all AI work in Phase 3,
   gated behind Phase 2's non-AI earnings-intelligence features landing —
   same "don't jump phases" rule as before, just re-pointed at the new
   Phase 2.
2. **Never on the numbers.** `src/lib/scoring.ts` owns every number the UI
   renders — impact score, exposure %, weights, gain/loss, beat/miss %,
   PEG. The model may read those numbers and write *prose* about them. It
   may never produce one. This is the rule that keeps an LLM from turning a
   calculator into a slot machine.
3. **Position data stays out, with exactly one named exception.** See
   [Data boundary](#data-boundary) — this used to be a blanket rule; the
   owner explicitly chose to loosen it for one feature (the morning
   briefing) and accept the tradeoff. Every other feature below needs no
   position data and keeps the original strict boundary.

`AGENTS.md`'s non-goal *"AI stock recommendations"* stays a non-goal.
Nothing below suggests what to buy or sell. The model explains and
organizes **events** (and, for the briefing, organizes your own already-held
**exposure**); it never has an opinion on a **security**.

---

## Why DeepSeek specifically

Owner's explicit decision: resurrect the original plan rather than default
to a US-hosted endpoint, accepting the risk described below.

| Property | Relevance to Portlander |
|---|---|
| OpenAI-compatible endpoint (`api.deepseek.com`) | No SDK lock-in. A ~40-line `fetch` wrapper in an Edge Function; no `npm:` specifier gamble like the SnapTrade SDK was |
| Open weights (MIT, V4 Flash and Pro) | The same model is hosted by Together / Fireworks / DeepInfra / OpenRouter. The jurisdiction is swappable without changing the model — this is what makes a future host-switch cheap if the calculus ever changes |
| ~$0.14 / 1M input, ~$0.28 / 1M output (V4 Flash) | See [Cost](#cost). At 40 tickers plus one daily briefing call, the annual bill is under a movie ticket |
| ~98% cache-hit discount on repeated prefixes | Batch jobs reuse one long instruction block across 40 calls — near-free after the first |
| JSON mode + strict tool-calling | Required. Every integration below returns a validated schema, never prose-to-be-parsed |

**Model ID:** `deepseek-v4-flash`. Reasoning mode is available on the same
ID but unneeded here — these are extraction/rewriting jobs, not multi-step
reasoning; leave it off.

> Pricing and model-ID facts come from third-party aggregators (TLDL,
> NxCode, DeepInfra) — `api-docs.deepseek.com` returned 403 to the sandbox
> that originally verified this. **Re-verify against the official pricing
> page before wiring billing.**

---

## Data boundary

Portlander holds real Fidelity positions — share counts and cost basis for
~40 tickers. DeepSeek's first-party API processes and stores data in the
PRC and publishes no universal zero-retention or no-training commitment for
API customers. Assume anything sent is retained indefinitely and may be
trained on.

**The rule, and its one named exception:**

| Never leaves Supabase (all features) | Sent only for the morning briefing | Free to send (any feature) |
|---|---|---|
| Share counts, cost basis, market value, dollar exposure | Position weight % | Ticker symbols |
| Account IDs, SnapTrade identifiers, `userSecret` | Upcoming event dates for held tickers | Public event metadata (date, type, BMO/AMC) |
| Auth email / `user_id` | | Public filings, transcripts, press releases, company names, sectors |

The briefing is the **only** feature allowed to see anything position-shaped,
and even there it's capped to `ticker + weight% + event date` — never a
dollar figure, never a share count, never account-level totals. This was an
explicit, deliberate risk acceptance by the owner (2026-08-01): it means
aggregate portfolio composition (which tickers, how concentrated) reaches a
PRC-hosted API with no published retention guarantee. If that calculus ever
changes, the fix is switching the briefing's provider-shim config to a
US-hosted endpoint running the same MIT-licensed weights — not relaxing the
boundary further.

Every other feature (thesis drift, guidance summaries, "what moved it")
keeps the original strict rule: **enrich the ticker, join locally.**
DeepSeek writes a fact about `NVDA`; Postgres joins that row to *your*
position at render time. The model never learns your weight in it.

---

## Features, ranked

Mapped to `AGENTS.md`'s redefined Phase 3 scope. 1–4 are the phase's actual
build list; 5–6 are carried-over backlog from the original Phase 3; 7–8 are
documented so nobody re-pitches them; 9 is a good idea that just isn't part
of this phase's scope.

### 1. Thesis drift detection

**Problem it solves:** a thesis you wrote when you bought CRWD doesn't tell
you, six months later, whether a selloff is narrative or fundamentals.

**Shape:** after each earnings report for a holding with a `thesis` value
(Phase 2 schema field), one call: thesis text + that quarter's actual
results (public) in, a structured classification out —

```json
{ "ticker": "CRWD", "verdict": "weakening",
  "reasoning": "Guidance held but platform-consolidation ARR mix cited as flat, not accelerating, vs. the stated thesis",
  "confidence": 0.85 }
```

Reads ticker + thesis text + public results only — no weight, no position
data. Cleanest feature in this doc from a data-boundary standpoint.

### 2. Morning briefing

**Problem it solves:** replaces doom-scrolling financial news with five
bullets actually about your book.

**Shape:** one call per day — `ticker + weight% + upcoming event dates`
(the one position-adjacent input allowed, see [Data boundary](#data-boundary))
plus each ticker's public event context → five bullet points. Cheap (~1
call/day), personal, and — this is basically the original Phase 3 "daily
briefing" done with an actual data boundary decision behind it instead of
being a vague promise.

### 3. Post-earnings "what moved it" notes

**Problem it solves:** beat/miss numbers (Phase 2) don't explain why CRWD
or PANW can beat on EPS and still drop 10% on guidance.

**Shape:** the day after a report, one call with web search, ticker +
public results in, a short explanation out — same shape as the old
"event context" idea, now specifically framed around price reaction. Web
search instead of a paid transcript feed, per the owner's explicit
decision — higher hallucination risk than idea #1's structured
classification, so it needs [grounding](#grounding) treatment before it
ships.

### 4. Guidance summaries on earnings cards

**Problem it solves:** the same beat-but-dropped confusion as #3, but
*before* the reaction — a 3-sentence guidance takeaway shown on the
pre-earnings card itself.

**Shape:** near/at report time, one call with web search (owner's decision
— no paid Finnhub transcript tier for now) summarizing guidance language
from public sources. Same trust-tier/confidence treatment as #3; both are
the riskiest features in this doc and should ship behind the same UI
guardrail, possibly the same Settings toggle.

### 5. Theme / indirect exposure map — carried over, lower priority

Unchanged from the original plan: quarterly, one call per ticker → a
`ticker_themes` table (themes + macro sensitivity), joined locally to
weights for indirect-exposure math. Real payoff, real effort — stays
backlog behind 1–4.

### 6. Macro event copy — carried over, lower priority

Unchanged: a plain-language "what's at stake" line per FOMC/CPI/NFP event,
~3 calls/month. Tiny scope, safe prompt-tuning ground, low priority.

### 7. Natural-language filters — skip

A command palette with real filters is faster, deterministic, and offline.
Wrong tool for an LLM. (Also: command palette itself was cut from Phase 2
scope in the 2026-08 reframe, so this has no home even if built.)

### 8. Anything touching a number, or "should I trim NVDA?" — never

The first breaks the transparency `AGENTS.md` demands of impact score and
PEG. The second is the explicit non-goal. Not "later" — never.

### 9. CSV import repair, journal structuring — out of current scope, not rejected

Both were reasonable ideas in the original draft (LLM-assisted column
mapping for messy broker CSVs; structuring freeform journal notes). Neither
maps to the redefined Phase 2/3: CSV repair isn't part of the earnings-
intelligence scope, and the generic post-earnings journal was explicitly
cut from Phase 2 by the owner. Not dropped forever — just not part of this
phase's build list. Revisit only if re-added to a future phase.

---

## Architecture

Unchanged from the original draft — follows the pattern already established
by `refresh-quotes` and `sync-events`. Nothing new to invent.

```text
pg_cron (nightly)                          Settings "Refresh briefing" or daily cron
  └→ Edge Function `ai-enrich`               └→ Edge Function `ai-briefing`
       ├→ reads: distinct tickers with            ├→ reads: user's holdings (ticker +
       │  events in next 30d (NO holdings          │  weight% only) + upcoming events
       │  columns) — features #1, #3, #4,          ├→ calls: provider shim → deepseek-v4-flash
       │  #5, #6                                    ├→ writes: cached briefing row,
       ├→ skips: rows whose content_hash            │  user-scoped
       │  is unchanged                              └→ never called on page render
       ├→ calls: provider shim → deepseek-v4-flash, JSON mode
       ├→ validates: strict schema; on failure → discard, log, keep old row
       └→ writes: ticker_context / ticker_themes / thesis_drift (service role, unscoped)

Browser → Supabase (Postgres only) → renders cached rows
```

**Non-negotiables**, each inherited from a rule the project already follows:

- **Browser never calls DeepSeek.** Same rule as Finnhub. `DEEPSEEK_API_KEY`
  is a Supabase Edge secret, never `VITE_*`.
- **Provider shim.** `supabase/functions/_shared/llm.ts` exposing
  `complete(messages, schema)`, reading `LLM_BASE_URL` / `LLM_MODEL` /
  `LLM_API_KEY`. Every endpoint under consideration is OpenAI-compatible, so
  switching to a US host is three env vars — this is also the mechanism for
  revisiting the briefing's data-boundary exception later without a
  rewrite. Build this on day one.
- **Persist everything; never call on render.** Every output lands in
  Postgres with a `generated_at` and a `content_hash`. A page load reads
  rows. Re-running the cron on unchanged inputs makes zero API calls.
- **Reuse `sync_runs`** with a distinct `provider` value per job
  (`deepseek-enrich`, `deepseek-briefing`) — same pattern already used for
  `finnhub-quotes`, no migration needed.
- **Surface the real error in the response body.** Same hard-won lesson as
  the SnapTrade functions (`PROGRESS.md` Decisions, 2026-08-01): return
  provider errors in the JSON body, have the client read `error.context`.
- **`ai-enrich` is unscoped** like `sync-events` — ticker facts are public,
  shared across users, no RLS-per-user complexity. **`ai-briefing` is
  user-scoped** like `refresh-quotes`/`snaptrade-sync` — it reads *your*
  holdings' weights, so it needs the same JWT-resolved-identity +
  service-role-write pattern those functions already use.

### Grounding

Ideas #2–#4 (briefing, "what moved it", guidance summaries) are the
hallucination-risk features — an LLM asked to explain a price move with no
source will write something plausible and possibly wrong. Idea #1 (thesis
drift) is comparatively low-risk since it's a bounded classification over
text the owner wrote themselves. Three defenses for the higher-risk ones, in
order of effectiveness:

1. **Feed it text.** Web search results go in as source text; require
   `sources[]` populated from that input. Extraction hallucinates far less
   than recall.
2. **Require `confidence`** in the schema and drop anything below ~0.7
   rather than rendering it.
3. **Label it in the UI.** AI-generated lines get a visible marker and a
   `generatedAt` date, never styled identically to a Finnhub-sourced fact —
   same discipline as the existing confirmed-vs-estimated badge. Exact
   treatment (inline label vs. a separate visually distinct section) is
   still open — decide before #2–#4 ship, not after.

Ship #2–#4 behind a Settings toggle, default **off**, and dogfood before
trusting it — same caution the original draft placed on its riskiest idea.

### Prompt/response rules

- `response_format: {type: 'json_object'}` **requires** the word "json" in
  the prompt and a worked example, or you get prose back. Cap `max_tokens`
  generously — truncated JSON is invalid JSON.
- Static instructions and schema go at the **front** of the prompt, variable
  ticker data at the end. Prefix caching then makes calls 2–40 of each
  nightly batch ~98% cheaper on input.
- JSON mode and tool-calling are mutually exclusive. These jobs want JSON
  mode; the model isn't choosing actions.
- Validate before writing. A malformed response keeps the previous row —
  never a partial write.

---

## Cost

V4 Flash, ~40 tickers, all of features 1–6 running plus one daily briefing:

| Job | Frequency | Est. tokens | Est. cost |
|---|---|---|---|
| Thesis drift (#1) | per earnings report w/ a thesis set | ~1.5k in / 300 out | rounding error |
| Morning briefing (#2) | daily | ~2k in / 400 out | ~$2–3/yr |
| "What moved it" (#3) | per earnings report | ~2k in / 400 out (+ web search cost) | ~$2/yr + search |
| Guidance summaries (#4) | per earnings report | ~2k in / 400 out (+ web search cost) | ~$2/yr + search |
| Theme map (#5) | 40 tickers/quarter | ~1.5k in / 500 out | <$0.10/yr |
| Macro copy (#6) | ~3/month | ~1k in / 300 out | <$0.01/yr |

Still under $10/year on model tokens before cache discounts; web search API
cost (for #3/#4) is the real unknown and should be checked against whatever
search provider gets picked before those two ship. Cost is not the deciding
factor here — privacy and product discipline are — but it's worth
confirming the search line item doesn't change that.

---

## Sequencing

Gated on `PROGRESS.md`, not on enthusiasm — same principle as the original
draft, re-pointed at the new phase boundary.

**Phase 2 ("Signal"), now:** ship the non-AI earnings-intelligence features
(`docs/PLAN-PHASE-2.md`) first. Allowed now, costs nothing, under
`AGENTS.md`'s "schema hooks" carve-out: add `DEEPSEEK_API_KEY` (commented)
to `.env.example`, reserve empty tables for thesis-drift/briefing-cache/
ticker-context output if convenient while already touching `schema.sql` for
Phase 2's `holdings.thesis` column.

**After Phase 2 ships:**
1. Provider shim + `ai-enrich`/`ai-briefing` skeletons.
2. **Thesis drift detection (#1)** first — smallest surface, clearest
   pass/fail, no grounding risk.
3. **Morning briefing (#2)** — the position-data exception, so build it
   deliberately and review the actual prompt sent before turning on the
   daily cron.
4. **"What moved it" (#3) and guidance summaries (#4)**, behind a Settings
   toggle default-off, after grounding/confidence/trust-tier UI is decided.
5. Backlog: theme map (#5), macro copy (#6), whenever there's room.

---

## Open questions for the owner

1. **Trust display** — is a labeled, dated AI line acceptable inline next to
   Finnhub-sourced facts, or should AI output live in a visually separate
   section? Needed before #2–#4 ship.
2. **Web search provider** for #3/#4 — which one, and what it costs — not
   yet picked.
3. ~~Host: DeepSeek vs. US-hosted~~ — **resolved 2026-08-01**: DeepSeek, as
   originally speced, with the named position-data exception above.
4. ~~Idea #5's (now #4's) transcript source~~ — **resolved 2026-08-01**: web
   search, not a paid Finnhub tier.
