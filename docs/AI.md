# docs/AI.md — LLM integration plan (DeepSeek)

**Status:** Plan only. Nothing built. No `DEEPSEEK_API_KEY` exists in any environment yet.
**Last updated:** 2026-08-01

Answers one owner question: *should Portlander connect the DeepSeek API, and if so, where does it actually earn its place?*

---

## Verdict

**Yes — but as a nightly batch enrichment worker, not as a feature you talk to.**

Three conditions, in priority order:

1. **Not yet.** Phase 1 exit criteria aren't signed off and the SnapTrade connect→sync path has never run end-to-end. `AGENTS.md` puts AI in Phase 3. Adding an LLM before the deterministic core is verified means debugging two unproven systems at once.
2. **Never on the numbers.** `src/lib/scoring.ts` owns every number the UI renders — impact score, exposure %, weights, gain/loss. The model may read those numbers and write *prose* about them. It may never produce one. This is the single rule that keeps an LLM from turning a calculator into a slot machine.
3. **Never sees your positions** — see [Data boundary](#data-boundary). This is a hard constraint, and it turns out to cost almost nothing, because the features worth building don't need position data.

The `AGENTS.md` non-goal *"AI stock recommendations"* stays a non-goal. Nothing below suggests what to buy or sell. The line: the model explains and organizes **events**; it never has an opinion on a **security**.

---

## Why DeepSeek specifically

| Property | Relevance to Portlander |
|---|---|
| OpenAI-compatible endpoint (`api.deepseek.com`) | No SDK lock-in. A ~40-line `fetch` wrapper in an Edge Function; no `npm:` specifier gamble like the SnapTrade SDK was |
| Open weights (MIT, V4 Flash and Pro) | The same model is hosted by Together / Fireworks / DeepInfra / OpenRouter. **The jurisdiction is swappable without changing the model** — this is what makes the privacy problem solvable |
| ~$0.14 / 1M input, ~$0.28 / 1M output (V4 Flash) | See [Cost](#cost). At 40 tickers the annual bill is under a movie ticket |
| ~98% cache-hit discount on repeated prefixes | Batch jobs reuse one long instruction block across 40 calls — near-free after the first |
| JSON mode + strict tool-calling | Required. Every integration below returns a validated schema, never prose-to-be-parsed |

**Model ID:** use `deepseek-v4-flash`. The legacy `deepseek-chat` / `deepseek-reasoner` aliases were deprecated 2026-07-24 — already past. Don't copy the older tutorials that still use them.

Reasoning ("thinking") mode is exposed on the same `deepseek-v4-flash` ID. None of the jobs below need it; they're extraction and rewriting, not multi-step reasoning. Leave it off — it's slower and burns output tokens on thinking traces.

> Pricing and model-ID facts above come from third-party aggregators ([TLDL](https://www.tldl.io/resources/deepseek-api-pricing), [NxCode](https://www.nxcode.io/resources/news/deepseek-api-pricing-complete-guide-2026), [DeepInfra](https://deepinfra.com/blog/best-api-providers-for-deepseek-v4)) — `api-docs.deepseek.com` returns 403 to this sandbox. **Re-verify against the official pricing page before wiring billing.**

---

## Data boundary

Portlander now holds real Fidelity positions — share counts and cost basis for 40 tickers. That is the most sensitive data in the app, and it changes the calculus.

DeepSeek's first-party API processes and stores data in the PRC, and publishes no universal zero-retention or no-training commitment for API customers ([privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)). Assume anything sent is retained indefinitely and may be trained on.

**So don't send it.** The boundary:

| Never leaves Supabase | Free to send |
|---|---|
| Share counts, cost basis, market value | Ticker symbols |
| Position weights, exposure %, impact scores | Public event metadata (date, type, BMO/AMC) |
| Account IDs, SnapTrade identifiers, `userSecret` | Public filings, transcripts, press releases |
| Auth email / `user_id` | Company names, sectors |
| Owner's private journal notes (see #6) | |

The pattern that makes this work: **enrich the ticker, join locally.** DeepSeek writes a fact about `NVDA` into a shared table. Postgres joins that row to *your* 6.2% position at render time. The model never learns 6.2% exists — and the output is identical.

One consequence worth stating plainly: this rules out "summarize *my portfolio's* week" as a single prompt. Compose that page from per-ticker enrichments locally instead. If you ever decide you genuinely want position-aware prompting, **switch hosts, don't relax the boundary** — the weights are MIT, so a US-hosted endpoint runs the same model under an enterprise DPA. That's why the code below goes through a provider shim.

---

## Ideas, ranked

Ranked by (value delivered) ÷ (risk + effort). 1–3 are worth building; 4–5 are real but bigger; 6–8 are documented so nobody re-pitches them.

### 1. CSV import repair — *best first build*

**Problem it solves:** already-shipped, already-annoying. Broker CSV exports are wildly inconsistent — `Symbol` vs `Ticker` vs `Description`, `Qty` vs `Shares`, prices as `$1,234.56`, footer disclaimer rows, "Cash & Money Market" pseudo-positions. `src/lib/csv.ts` handles the well-formed case and gives up otherwise.

**Shape:** on a failed parse only, send **the header row plus 2–3 sample rows with numbers redacted** and get back a column mapping:

```json
{ "ticker": "Symbol", "shares": "Qty", "costBasis": "Cost Per Share",
  "skipRows": ["Cash & Money Market"], "confidence": 0.94 }
```

Portlander then parses locally with that mapping. The model sees column *names*, never the portfolio.

**Why first:** self-contained, one call per import, instantly verifiable (it worked or it didn't), and it improves a feature that exists today. It's the cheapest possible proof that the plumbing is sound.

### 2. Event context lines — *highest daily value*

**Problem it solves:** Today shows `AMD — Earnings — Feb 3 — AMC — impact 71`. Correct, but you still have to remember why AMD matters this quarter.

**Shape:** nightly, one call per ticker with an upcoming event, into a new `event_context` table:

```json
{ "ticker": "AMD", "whatToWatch": ["MI400 ramp commentary", "datacenter GPU share vs NVDA"],
  "lastQuarterOutcome": "beat, guided Q1 above consensus",
  "sources": ["..."], "generatedAt": "2026-08-01" }
```

Renders as a subtitle under the event title in `EventCard`. Personalization is the *position weight already next to it* — the model contributes the "why," `scoring.ts` contributes the "how much."

**This is the feature that makes the morning ritual stick.** It's also the one most likely to hallucinate, hence [Grounding](#grounding).

### 3. Macro event copy

**Problem it solves:** `src/data/macro.ts` seeds FOMC/CPI/NFP with static titles. Every CPI print looks like every other one.

**Shape:** one call per macro event per month — ~3 calls. Generates a plain-language "what's at stake" line and a sector-sensitivity tag list, which item #4 later consumes.

Tiny scope, ~$0.001/month, and a safe place to tune prompts before pointing them at 40 tickers.

### 4. Theme / indirect exposure map — *Phase 3's actual hard problem*

**Problem it solves:** `AGENTS.md` Phase 3 promises "theme/indirect exposure," and it's the one item with no deterministic path. You can't compute from Finnhub that a CPI print reaches your portfolio through consumer-discretionary holdings.

**Shape:** quarterly (themes don't move weekly), one call per ticker → a `ticker_themes` table:

```json
{ "ticker": "CRWD", "themes": ["cybersecurity", "enterprise-software", "ai-security"],
  "macroSensitivity": { "fomc": 0.7, "cpi": 0.3 }, "confidence": 0.9 }
```

Then indirect exposure is a **local join**: FOMC × your `ticker_themes` rows × weights from `scoring.ts`. The model supplies the mapping; Postgres and existing code supply the math. Cost: ~40 calls per quarter.

This is the highest-ceiling idea here, and the one that most needs Phase 1 signed off first.

### 5. Earnings digest → prep cards (Phase 2)

Post-earnings, fetch the release/transcript and extract structured fields: guidance direction, segment commentary, notable changes vs prior quarter. Feeds Phase 2 prep cards and gives item #2 real grounding next quarter.

Genuinely valuable, but needs a transcript source Portlander doesn't have yet (Finnhub's transcript endpoint is a paid tier). **Blocked on data access, not on AI.** Revisit when Phase 2 starts.

### 6. Journal structuring (Phase 2) — *use a different host*

Turn freeform post-earnings notes into structured tags and thesis-deltas. Mechanically the easiest job on this list.

But your journal entries are **your investment reasoning** — more sensitive than the positions, and unavoidably part of the prompt. The data boundary can't be engineered around here. If built, route this one job to a US-hosted DeepSeek endpoint under a DPA. The provider shim makes that a config change.

### 7. Natural-language filters — skip

"Show me tech earnings over 3% weight next week." A command palette with real filters is faster, deterministic, and offline. LLM is the wrong tool.

### 8. Anything touching a number, or "should I trim NVDA?" — never

The first breaks the transparency `AGENTS.md` demands of impact score. The second is the explicit non-goal. Not "later" — never.

---

## Architecture

Follows the pattern already established by `refresh-quotes` and `sync-events`. Nothing new to invent.

```text
pg_cron (nightly)
  └→ Edge Function `ai-enrich`
       ├→ reads: distinct tickers with events in next 30d  (NO holdings columns)
       ├→ skips: rows whose content_hash is unchanged      ← the real cost control
       ├→ calls: provider shim → deepseek-v4-flash, JSON mode
       ├→ validates: strict schema; on failure → discard, log, keep old row
       └→ writes: event_context / ticker_themes  (service role)

Browser → Supabase (Postgres only) → renders cached rows
```

**Non-negotiables**, each inherited from a rule the project already follows:

- **Browser never calls DeepSeek.** Same rule as Finnhub. `DEEPSEEK_API_KEY` is a Supabase Edge secret, never `VITE_*`.
- **Provider shim.** `supabase/functions/_shared/llm.ts` exposing `complete(messages, schema)`, reading `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`. Every endpoint under consideration is OpenAI-compatible, so switching to a US host is three env vars. Do this on day one — retrofitting it after four features exist is how the SnapTrade auth-mode refactor became a five-session detour.
- **Persist everything; never call on render.** Every output lands in Postgres with a `generated_at` and a `content_hash`. A page load reads rows. Re-running the cron on unchanged inputs makes zero API calls.
- **Reuse `sync_runs`** with `provider='deepseek-enrich'` — same call made for `finnhub-quotes`, no migration needed.
- **Surface the real error in the response body.** The hard-won lesson in Decisions (2026-08-01): `get_logs` only ever returns the HTTP boundary line. Return provider errors in the JSON body and have the client read `error.context`.
- **Unscoped, like `sync-events`.** Enrichment rows are public facts about tickers, shared across users. No `user_id`, no RLS-per-user complexity, no repeat of the `snaptrade_users` lockbox problem.

### Grounding

Idea #2 is the hallucination risk: an LLM asked "what should I watch for in AMD's quarter?" with no source will write something plausible and possibly wrong. Three defenses, in order of effectiveness:

1. **Feed it text.** Where a source exists (prior earnings digest from #5, filing text), pass it in and require `sources[]` populated from that input. Extraction hallucinates far less than recall.
2. **Require `confidence`** in the schema and drop anything below ~0.7 rather than rendering it.
3. **Label it in the UI.** Context lines get a visible AI-generated marker and a `generatedAt` date. Never styled identically to a Finnhub-sourced fact. Same discipline as the existing confirmed-vs-estimated badge — this project already tells the user how much to trust a row, and AI output is the weakest tier.

Until #5 exists, #2 runs on recall alone. Ship it behind a Settings toggle, default **off**, and dogfood before trusting it.

### Prompt/response rules

- `response_format: {type: 'json_object'}` **requires** the word "json" in the prompt and a worked example, or you get prose back. Cap `max_tokens` generously — truncated JSON is invalid JSON.
- Static instructions and schema go at the **front** of the prompt, variable ticker data at the end. Prefix caching then makes calls 2–40 of each nightly batch ~98% cheaper on input.
- JSON mode and tool-calling are mutually exclusive. These jobs want JSON mode; the model isn't choosing actions.
- Validate before writing. A malformed response keeps the previous row — never a partial write.

---

## Cost

V4 Flash, 40 tickers, all of ideas 1–4 running:

| Job | Frequency | Est. tokens | Est. cost |
|---|---|---|---|
| Event context (#2) | ~15 tickers/night with events | ~2k in / 400 out | ~$0.006/night → **~$2/yr** |
| Macro copy (#3) | ~3/month | ~1k in / 300 out | **<$0.01/yr** |
| Theme map (#4) | 40 tickers/quarter | ~1.5k in / 500 out | **<$0.10/yr** |
| CSV repair (#1) | per failed import | ~1k in / 200 out | rounding error |

**Under $3/year**, before cache discounts. Cost is not a decision input here — treat it as free and decide on privacy and product discipline alone. (Which also means: don't let cheapness talk you into shipping idea #7.)

---

## Sequencing

Deliberately gated on `PROGRESS.md`, not on enthusiasm.

**Now, while Phase 1 finishes** — costs nothing, unblocks everything, allowed under `AGENTS.md`'s "schema hooks that cost nothing" carve-out:
- Merge this doc. Add `DEEPSEEK_API_KEY` (commented) to `.env.example`.
- Reserve `event_context` + `ticker_themes` in `schema.sql`. Empty tables are free.

**After Phase 1 sign-off + a verified SnapTrade sync:**
1. Provider shim + `ai-enrich` skeleton, wired to idea **#1 (CSV repair)** only. Smallest surface, clearest pass/fail.
2. Idea **#3 (macro copy)** — 3 calls/month, safe prompt-tuning ground.
3. Idea **#2 (event context)** behind a Settings toggle, default off. Dogfood a full week before defaulting on.

**Phase 2:** #5 (needs a transcript source), then #6 (on a US-hosted endpoint only).
**Phase 3:** #4, the theme map — the real payoff.

Stop after any step that doesn't earn its place in the morning ritual. Three good context lines beat eight features nobody reads.

---

## Open questions for the owner

1. **Host:** first-party DeepSeek (cheapest, PRC-hosted) for the non-sensitive jobs, accepting the boundary above? Or route everything through a US host from day one and pay ~3–10× on a ~$3/yr bill to make the question disappear?
2. **Trust display:** is a labeled, dated AI context line acceptable next to Finnhub-sourced facts, or should AI output live in a visually separate section?
3. **Idea #5's transcript source** — worth a paid Finnhub tier, or park #5 indefinitely?
