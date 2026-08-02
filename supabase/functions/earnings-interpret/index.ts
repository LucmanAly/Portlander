/**
 * Portlander — earnings-interpret Edge Function (BE-06)
 *
 * Reads verified EarningsFacts for a small, caller-specified set of already-
 * reported earnings events, asks a DeepSeek-compatible chat-completions
 * endpoint to interpret them into a strict JSON summary, validates the
 * response, and writes it to events.ai_interpretation.
 *
 * Per AGENTS.md's Phase 2 data truth rules: the model interprets *supplied*
 * verified evidence — it never computes surprise itself (done here, in code,
 * with the same formula as src/lib/earningsIntel.ts) and is never treated as
 * a source of facts. Any malformed/oversized/missing response is rejected
 * and that event is simply skipped — no interpretation is written, and the
 * client already renders a missing interpretation as nothing
 * (GeneratedInsight), so this fails safe by construction.
 *
 * Deliberately global/unscoped like sync-events (events rows are shared, not
 * per-user) — not per-user like refresh-quotes.
 *
 * Host jurisdiction is a config decision, not a code decision: this function
 * calls whatever OpenAI-compatible /chat/completions endpoint
 * DEEPSEEK_BASE_URL points at. Nothing here is hardcoded to a specific
 * provider or region — set DEEPSEEK_BASE_URL to a first-party or a
 * US-hosted OpenAI-compatible proxy per your own jurisdiction decision (see
 * the open questions in PR #15, branch claude/deepseek-api-integration-k9rwbp,
 * which has a fuller writeup but is unmerged — its analysis is worth reading
 * before configuring this, its code was not reused here). DEEPSEEK_MODEL is
 * required with no default for the same reason models are provider-specific
 * and deprecate — deepseek-chat/deepseek-reasoner were both retired
 * 2026-07-24; verify the current model id before setting this.
 *
 * Rate limit (BE-06: "wire it behind a rate limit before enabling
 * broadly"): hard-capped at MAX_EVENTS_PER_CALL events per invocation, and
 * an event already carrying an ai_interpretation is skipped, never
 * regenerated. Nothing calls this function automatically yet — no cron, and
 * sync-events does not chain into it — so total spend is bounded by
 * whoever invokes it, on purpose, until that's a deliberate follow-up.
 *
 * Secrets (supabase secrets set):
 *   DEEPSEEK_API_KEY
 *   DEEPSEEK_BASE_URL          e.g. https://api.deepseek.com — no default
 *   DEEPSEEK_MODEL             a currently-live model id — no default
 *   SUPABASE_URL               (auto-injected on hosted Edge)
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-injected on hosted Edge)
 *
 * Invoke:
 *   curl -X POST "$SUPABASE_URL/functions/v1/earnings-interpret" \
 *     -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"eventIds": ["<uuid>", "<uuid>"]}'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const MAX_EVENTS_PER_CALL = 5
const MAX_SUMMARY_CHARS = 600
const CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const
type Confidence = (typeof CONFIDENCE_VALUES)[number]

type RequestBody = { eventIds?: unknown }

type EventRowForInterpret = {
  id: string
  ticker: string | null
  event_date: string
  eps_estimate: number | string | null
  eps_actual: number | string | null
  revenue_estimate: number | string | null
  revenue_actual: number | string | null
  raw: Record<string, unknown> | null
  ai_interpretation: unknown
}

type FactsForPrompt = {
  ticker: string
  quarter: string
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  epsSurprisePct: number | null
  revenueSurprisePct: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
  const deepseekBaseUrl = Deno.env.get('DEEPSEEK_BASE_URL')
  const deepseekModel = Deno.env.get('DEEPSEEK_MODEL')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!deepseekKey || !deepseekBaseUrl || !deepseekModel || !supabaseUrl || !serviceKey) {
    return json(
      {
        error: 'Missing secrets — DeepSeek interpretation is not configured',
        need: ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
        note: 'DEEPSEEK_BASE_URL and DEEPSEEK_MODEL are deliberately not defaulted — this is a config decision (host jurisdiction, model currency), not one the code should make for you. See this function\'s README.md.',
      },
      500,
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body — expected {"eventIds": string[]}' }, 400)
  }

  const requestedIds = Array.isArray(body.eventIds)
    ? body.eventIds.filter((v): v is string => typeof v === 'string')
    : []
  if (requestedIds.length === 0) {
    return json({ error: 'eventIds must be a non-empty array of event UUIDs' }, 400)
  }
  if (requestedIds.length > MAX_EVENTS_PER_CALL) {
    return json({ error: `Too many eventIds — max ${MAX_EVENTS_PER_CALL} per call` }, 400)
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error: fetchErr } = await sb
    .from('events')
    .select('id, ticker, event_date, eps_estimate, eps_actual, revenue_estimate, revenue_actual, raw, ai_interpretation')
    .in('id', requestedIds)

  if (fetchErr) {
    return json({ error: `Failed to load events: ${fetchErr.message}` }, 500)
  }

  const results: { id: string; status: 'generated' | 'skipped' | 'error'; reason?: string }[] = []

  for (const row of (rows ?? []) as EventRowForInterpret[]) {
    if (row.ai_interpretation != null) {
      results.push({ id: row.id, status: 'skipped', reason: 'already interpreted' })
      continue
    }

    const facts = extractFacts(row)
    if (!facts) {
      results.push({ id: row.id, status: 'skipped', reason: 'not yet reported — no actual to interpret' })
      continue
    }

    try {
      const generated = await callDeepSeek(deepseekBaseUrl, deepseekKey, deepseekModel, facts)
      const interpretation = {
        summary: generated.summary,
        model: deepseekModel,
        generatedAt: new Date().toISOString(),
        confidence: generated.confidence,
      }
      const { error: updErr } = await sb.from('events').update({ ai_interpretation: interpretation }).eq('id', row.id)
      if (updErr) {
        results.push({ id: row.id, status: 'error', reason: updErr.message })
      } else {
        results.push({ id: row.id, status: 'generated' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ id: row.id, status: 'error', reason: msg })
    }

    // Gentle pacing, same convention as sync-events/refresh-quotes.
    await sleep(300)
  }

  const notFoundIds = requestedIds.filter((id) => !(rows ?? []).some((r) => r.id === id))
  for (const id of notFoundIds) {
    results.push({ id, status: 'error', reason: 'event not found' })
  }

  return json({
    ok: results.every((r) => r.status !== 'error'),
    results,
  })
})

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Same formula as src/lib/earningsIntel.ts's surprisePct() — kept in sync deliberately, not imported (separate Deno runtime). */
function surprisePct(actual: number | null, estimate: number | null): number | null {
  if (actual == null || estimate == null || estimate === 0) return null
  return ((actual - estimate) / Math.abs(estimate)) * 100
}

function quarterLabel(raw: Record<string, unknown> | null, eventDate: string): string {
  const quarter = raw ? num(raw.quarter as number | null) : null
  const year = raw ? num(raw.year as number | null) : null
  if (quarter != null && year != null) return `Q${quarter} ${year}`
  return eventDate
}

function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100
}

/** Only interprets already-reported quarters — at least one real actual is required. */
function extractFacts(row: EventRowForInterpret): FactsForPrompt | null {
  const epsActual = num(row.eps_actual)
  const revenueActual = num(row.revenue_actual)
  if (epsActual == null && revenueActual == null) return null

  const epsEstimate = num(row.eps_estimate)
  const revenueEstimate = num(row.revenue_estimate)

  return {
    ticker: row.ticker ?? 'UNKNOWN',
    quarter: quarterLabel(row.raw, row.event_date),
    epsEstimate,
    epsActual,
    revenueEstimate,
    revenueActual,
    epsSurprisePct: surprisePct(epsActual, epsEstimate),
    revenueSurprisePct: surprisePct(revenueActual, revenueEstimate),
  }
}

async function callDeepSeek(
  baseUrl: string,
  apiKey: string,
  model: string,
  facts: FactsForPrompt,
): Promise<{ summary: string; confidence?: Confidence }> {
  const system = [
    'You interpret already-verified quarterly earnings numbers for a portfolio app.',
    'Every number in the user message is real, final, and already computed — never invent, recompute, round differently, or contradict any of them.',
    'Do not state any number that was not supplied to you. Do not predict future stock performance.',
    'Respond with ONLY a JSON object of the exact shape {"summary": string, "confidence": "low" | "medium" | "high"}. No prose outside the JSON.',
    'summary: 1-2 plain sentences on the beat/miss and what the supplied numbers show, under 400 characters.',
    'confidence: how clearly the supplied numbers support the summary — not a market or price prediction.',
  ].join(' ')

  const user = JSON.stringify({
    ticker: facts.ticker,
    quarter: facts.quarter,
    epsEstimate: facts.epsEstimate,
    epsActual: facts.epsActual,
    revenueEstimate: facts.revenueEstimate,
    revenueActual: facts.revenueActual,
    epsSurprisePct: round2(facts.epsSurprisePct),
    revenueSurprisePct: round2(facts.revenueSurprisePct),
  })

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 220,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response had no message content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek response was not valid JSON')
  }

  return validateInterpretation(parsed)
}

/** Strict validation before anything gets written — a malformed response never reaches events.ai_interpretation. */
function validateInterpretation(value: unknown): { summary: string; confidence?: Confidence } {
  if (!value || typeof value !== 'object') throw new Error('DeepSeek response was not a JSON object')
  const r = value as Record<string, unknown>

  if (typeof r.summary !== 'string') throw new Error('DeepSeek response missing a "summary" string')
  const summary = r.summary.trim()
  if (summary.length === 0) throw new Error('DeepSeek response had an empty summary')
  if (summary.length > MAX_SUMMARY_CHARS) throw new Error(`DeepSeek summary exceeded ${MAX_SUMMARY_CHARS} chars`)

  const confidence =
    typeof r.confidence === 'string' && (CONFIDENCE_VALUES as readonly string[]).includes(r.confidence)
      ? (r.confidence as Confidence)
      : undefined

  return { summary, confidence }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
