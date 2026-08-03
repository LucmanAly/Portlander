/**
 * Portlander — performance-interpret
 *
 * Authenticated, cached DeepSeek narration over deterministic performance
 * evidence calculated by the client. Exact dollars/percentages stay in code
 * and in the UI; the model is required to produce digit-free qualitative
 * context only, preventing it from inventing or recalculating a number.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type ThemeEvidence = {
  key: string
  label: string
  pnlValue: number
  returnPct: number
  tickers: string[]
}

type Evidence = {
  evidenceHash: string
  startDate: string
  endDate: string
  totalPnlValue: number
  totalReturnPct: number
  themes: ThemeEvidence[]
  holdings: { ticker: string; pnlValue: number }[]
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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')?.trim()
  const deepseekBase = Deno.env.get('DEEPSEEK_BASE_URL')?.trim()
  const model = Deno.env.get('DEEPSEEK_MODEL')?.trim()
  if (!supabaseUrl || !anonKey || !serviceKey || !deepseekKey || !deepseekBase || !model) {
    return json({ error: 'Performance interpretation is not configured' }, 503)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)

  let evidence: Evidence
  try {
    evidence = validateEvidence(await req.json())
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid evidence' }, 400)
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: cached } = await sb
    .from('performance_briefings')
    .select('generated_summary, model, generated_at')
    .eq('user_id', userData.user.id)
    .eq('evidence_hash', evidence.evidenceHash)
    .maybeSingle()
  if (cached) {
    const generated = cached.generated_summary as { headline?: string; summary?: string }
    if (generated.headline && generated.summary) {
      return json({
        headline: generated.headline,
        summary: generated.summary,
        model: cached.model,
        generatedAt: cached.generated_at,
        cached: true,
      })
    }
  }

  let generated: { headline: string; summary: string }
  try {
    generated = await callDeepSeek(deepseekBase, deepseekKey, model, evidence)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'DeepSeek request failed' }, 502)
  }

  const generatedAt = new Date().toISOString()
  const { error: writeError } = await sb.from('performance_briefings').upsert(
    {
      user_id: userData.user.id,
      period_start: evidence.startDate,
      period_end: evidence.endDate,
      evidence_hash: evidence.evidenceHash,
      generated_summary: generated,
      model,
      generated_at: generatedAt,
    },
    { onConflict: 'user_id,evidence_hash' },
  )
  if (writeError) return json({ error: `Could not cache briefing: ${writeError.message}` }, 500)

  return json({ ...generated, model, generatedAt, cached: false })
})

function validateEvidence(value: unknown): Evidence {
  if (!value || typeof value !== 'object') throw new Error('Evidence must be a JSON object')
  const row = value as Record<string, unknown>
  const evidenceHash = text(row.evidenceHash, 'evidenceHash', 64)
  const startDate = isoDate(row.startDate, 'startDate')
  const endDate = isoDate(row.endDate, 'endDate')
  if (startDate > endDate) throw new Error('startDate must be on or before endDate')
  const themes = list(row.themes, 8).map((item, index) => {
    const theme = object(item, `themes[${index}]`)
    return {
      key: text(theme.key, `themes[${index}].key`, 80),
      label: text(theme.label, `themes[${index}].label`, 100),
      pnlValue: finite(theme.pnlValue, `themes[${index}].pnlValue`),
      returnPct: finite(theme.returnPct, `themes[${index}].returnPct`),
      tickers: list(theme.tickers, 80).map((ticker) => text(ticker, 'ticker', 20)),
    }
  })
  const holdings = list(row.holdings, 8).map((item, index) => {
    const holding = object(item, `holdings[${index}]`)
    return {
      ticker: text(holding.ticker, `holdings[${index}].ticker`, 20),
      pnlValue: finite(holding.pnlValue, `holdings[${index}].pnlValue`),
    }
  })
  return {
    evidenceHash,
    startDate,
    endDate,
    totalPnlValue: finite(row.totalPnlValue, 'totalPnlValue'),
    totalReturnPct: finite(row.totalReturnPct, 'totalReturnPct'),
    themes,
    holdings,
  }
}

async function callDeepSeek(
  baseUrl: string,
  apiKey: string,
  model: string,
  evidence: Evidence,
): Promise<{ headline: string; summary: string }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'You write a concise portfolio performance briefing from supplied JSON evidence. ' +
            'Return JSON with exactly headline and summary strings. Mention only labels/tickers present. ' +
            'Do not include digits, number words, currency amounts, percentages, advice, causes, news, ' +
            'predictions, or claims not present in the evidence. The UI displays all exact figures itself.',
        },
        { role: 'user', content: `Evidence JSON:\n${JSON.stringify(evidence)}` },
      ],
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 240)}`)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek returned no content')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek response was not valid JSON')
  }
  const value = object(parsed, 'response')
  const headline = text(value.headline, 'headline', 120)
  const summary = text(value.summary, 'summary', 420)
  if (/[\d$%]/.test(`${headline} ${summary}`)) {
    throw new Error('DeepSeek response attempted to introduce numeric claims')
  }
  return { headline, summary }
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
  return value as Record<string, unknown>
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Expected an array of at most ${max} items`)
  return value
}
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} is invalid`)
  return value.trim()
}
function isoDate(value: unknown, name: string): string {
  const result = text(value, name, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${name} must be YYYY-MM-DD`)
  return result
}
function finite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12) {
    throw new Error(`${name} must be a finite number`)
  }
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
