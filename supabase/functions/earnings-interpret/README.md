# earnings-interpret

DeepSeek-compatible chat-completions call → `public.events.ai_interpretation` (Supabase Edge
Function). BE-06 of the earnings intelligence backend queue.

**Status:** implemented (`index.ts`), **not enabled** — `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` /
`DEEPSEEK_MODEL` are unset. The function returns a clear "Missing secrets" error until an owner
configures them; nothing calls it automatically.

Manual, caller-specified invocation only — **not** wired into `sync-events` or any `pg_cron`
schedule. Deliberately global/unscoped like `sync-events` (event rows are shared, not per-user),
not per-user like `refresh-quotes`.

---

## Behavior

1. Caller supplies `{"eventIds": string[]}`, capped at 5 UUIDs per call (hard rate limit — BE-06
   says "wire it behind a rate limit before enabling broadly").
2. For each event: skip if it already has an `ai_interpretation` (never regenerate), skip if it
   has no `eps_actual`/`revenue_actual` yet (only already-reported quarters get interpreted — an
   "upcoming"/"awaiting" card has nothing to interpret).
3. Compute `epsSurprisePct`/`revenueSurprisePct` **in code**, identical formula to
   `src/lib/earningsIntel.ts`'s `surprisePct()` (kept in sync deliberately, not imported — separate
   Deno runtime). The model is never asked to compute or invent a number, only to describe ones
   it's given — see `AGENTS.md`'s Phase 2 data truth rules.
4. Call `${DEEPSEEK_BASE_URL}/chat/completions` (OpenAI-compatible `/chat/completions` shape) with
   a system prompt that forbids inventing numbers and requires a strict
   `{"summary": string, "confidence": "low"|"medium"|"high"}` JSON response.
5. Validate the response: `summary` must be a non-empty string under 600 chars; `confidence` must
   be one of the three allowed values or is dropped. Any parse failure, missing field, or oversized
   summary throws — that event is recorded as `status: "error"` in the response and **nothing is
   written**. `GeneratedInsight` on the client already renders nothing when `interpretation` is
   absent, so this fails safe by construction.
6. On success, writes `events.ai_interpretation = { summary, model, generatedAt, confidence }`.
   `src/lib/earningsIntel.ts`'s `interpretationFromRaw()` re-validates this shape again on every
   client read — defense in depth for a field an external model produced.

## Host jurisdiction is a config decision, not a code decision

Nothing here is hardcoded to a specific DeepSeek host or region. `DEEPSEEK_BASE_URL` has **no
default** — you must set it explicitly to whichever OpenAI-compatible endpoint you've decided on
(first-party DeepSeek, or a US-hosted proxy). This was flagged as the "load-bearing" open question
in PR #15 (`claude/deepseek-api-integration-k9rwbp`, still open, unmerged — its `docs/AI.md`
writeup has the fuller tradeoff analysis and is worth reading before configuring this; none of its
code was reused here) and is deliberately left to you to answer via secrets, not picked by this
code.

`DEEPSEEK_MODEL` also has no default — `deepseek-chat` and `deepseek-reasoner` were both
deprecated 2026-07-24; verify whatever model id you set is still live before setting it.

## Secrets

```bash
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL          # e.g. https://api.deepseek.com — your jurisdiction call, no default
DEEPSEEK_MODEL              # a currently-live model id — no default
SUPABASE_URL                # platform-provided
SUPABASE_SERVICE_ROLE_KEY   # platform-provided
```

## Deploy

```bash
supabase functions deploy earnings-interpret
```

`verify_jwt: true` — same as `sync-events`; a valid Supabase JWT (anon key is sufficient) must be
presented, but this function's own authorization boundary is "who can invoke Edge Functions on
this project," same as `sync-events`.

## Invoke

```bash
curl -X POST "$SUPABASE_URL/functions/v1/earnings-interpret" \
  -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventIds": ["<uuid>", "<uuid>"]}'
```

Find candidate event ids for already-reported earnings via:

```sql
select id, ticker, event_date from public.events
where event_type = 'earnings' and eps_actual is not null and ai_interpretation is null
order by event_date desc limit 5;
```

## Not done here (deliberately)

- No cron/automation — each call is an explicit, bounded spend the owner controls.
- No client UI to trigger this — `src/lib/earningsIntel.ts`'s `interpretationFromRaw()` and the
  existing `GeneratedInsight` component already render a stored interpretation the moment one
  exists, so wiring a trigger button (or a scheduled batch, per PR #15's "nightly batch enrichment
  worker" recommendation) is a separate follow-up once the owner has picked a host and verified
  cost/quality on a few tickers manually.
