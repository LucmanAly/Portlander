/**
 * Portlander — portfolio-recap Edge Function (PI-01)
 *
 * Produces cached, qualitative DeepSeek narration for a deterministic
 * performance summary. The model receives labels, directions, and ranks — no
 * share counts, account identifiers, prices, dollar amounts, or percentages.
 * It may select which verified fact IDs deserve emphasis, but the browser
 * renders every number from its own snapshot calculation. Output containing
 * digits/currency/percent signs is rejected before storage.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Direction = 'gain' | 'loss' | 'flat'
type PromptFact = { id: string; label: string; direction: Direction; rank: number }
type RequestBody = {
  summaryKey?: unknown
  periodStart?: unknown
  periodEnd?: unknown
  periodLabel?: unknown
  direction?: unknown
  hasPositionChanges?: unknown
  themes?: unknown
  tickers?: unknown
}

type ValidRequest = {
  summaryKey: string
  periodStart: string
  periodEnd: string
  periodLabel: string
  direction: Direction
  hasPositionChanges: boolean
  themes: PromptFact[]
  tickers: PromptFact[]
}

const DIRECTIONS = ['gain', 'loss', 'flat'] as const
const MAX_FACTS = 5
const MAX_HEADLINE = 140
const MAX_NARRATIVE = 600

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

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
  const deepseekBaseUrl = Deno.env.get('DEEPSEEK_BASE_URL')
  const deepseekModel = Deno.env.get('DEEPSEEK_MODEL')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!deepseekKey || !deepseekBaseUrl || !deepseekModel || !supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Portfolio narration is not configured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  let request: ValidRequest
  try {
    request = validateRequest((await req.json()) as RequestBody)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400)
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: cached, error: cacheErr } = await sb
    .from('portfolio_recaps')
    .select('headline, narrative, selected_ticker_ids, selected_theme_ids, model, generated_at')
    .eq('user_id', userId)
    .eq('summary_key', request.summaryKey)
    .maybeSingle()
  if (cacheErr) return json({ error: `Failed to check recap cache: ${cacheErr.message}` }, 500)
  if (cached) return json({ ...toResponse(cached), cached: true })

  try {
    const generated = await callDeepSeek(deepseekBaseUrl, deepseekKey, deepseekModel, request)
    const row = {
      user_id: userId,
      summary_key: request.summaryKey,
      period_start: request.periodStart,
      period_end: request.periodEnd,
      headline: generated.headline,
      narrative: generated.narrative,
      selected_ticker_ids: generated.selectedTickerIds,
      selected_theme_ids: generated.selectedThemeIds,
      model: deepseekModel,
      generated_at: new Date().toISOString(),
    }
    const { data: saved, error: saveErr } = await sb
      .from('portfolio_recaps')
      .upsert(row, { onConflict: 'user_id,summary_key' })
      .select('headline, narrative, selected_ticker_ids, selected_theme_ids, model, generated_at')
      .single()
    if (saveErr || !saved) return json({ error: `Failed to cache recap: ${saveErr?.message ?? 'no row'}` }, 500)
    return json({ ...toResponse(saved), cached: false })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Narration failed' }, 502)
  }
})

function validateRequest(body: RequestBody): ValidRequest {
  const summaryKey = typeof body.summaryKey === 'string' ? body.summaryKey.trim() : ''
  if (!/^performance-[a-f0-9]{8}$/.test(summaryKey)) throw new Error('Invalid summaryKey')
  const periodStart = validDate(body.periodStart)
  const periodEnd = validDate(body.periodEnd)
  const periodLabel = typeof body.periodLabel === 'string' ? body.periodLabel.trim() : ''
  if (!periodLabel || periodLabel.length > 40) throw new Error('Invalid periodLabel')
  const direction = validDirection(body.direction)
  return {
    summaryKey,
    periodStart,
    periodEnd,
    periodLabel,
    direction,
    hasPositionChanges: body.hasPositionChanges === true,
    themes: validFacts(body.themes),
    tickers: validFacts(body.tickers),
  }
}

function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid period date')
  return value
}

function validDirection(value: unknown): Direction {
  if (typeof value !== 'string' || !(DIRECTIONS as readonly string[]).includes(value)) {
    throw new Error('Invalid direction')
  }
  return value as Direction
}

function validFacts(value: unknown): PromptFact[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_FACTS).map((fact) => {
    if (!fact || typeof fact !== 'object') throw new Error('Invalid performance fact')
    const row = fact as Record<string, unknown>
    if (typeof row.id !== 'string' || row.id.length > 80) throw new Error('Invalid fact id')
    if (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 80) throw new Error('Invalid fact label')
    const rank = Number(row.rank)
    if (!Number.isInteger(rank) || rank < 1 || rank > MAX_FACTS) throw new Error('Invalid fact rank')
    return { id: row.id, label: row.label.trim(), direction: validDirection(row.direction), rank }
  })
}

async function callDeepSeek(
  baseUrl: string,
  apiKey: string,
  model: string,
  request: ValidRequest,
): Promise<{ headline: string; narrative: string; selectedTickerIds: string[]; selectedThemeIds: string[] }> {
  const system = [
    'You write a concise qualitative portfolio recap from verified directional facts.',
    'Never claim causation, give advice, forecast, or invent news.',
    'Never output digits, currency symbols, percentages, or numeric words.',
    'If positionChanges is true, explicitly say trading or cash flows may affect the period comparison.',
    'Output only JSON with this exact shape: {"headline": string, "narrative": string, "selectedTickerIds": string[], "selectedThemeIds": string[]}.',
    'Use only supplied fact IDs. Headline is short. Narrative is at most two plain sentences.',
  ].join(' ')

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: JSON.stringify({
            period: request.periodLabel,
            portfolioDirection: request.direction,
            positionChanges: request.hasPositionChanges,
            themes: request.themes,
            tickers: request.tickers,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 220,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 240)}`)
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek response had no content')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('DeepSeek response was not valid JSON')
  }
  return validateNarrative(parsed, request)
}

function validateNarrative(
  value: unknown,
  request: ValidRequest,
): { headline: string; narrative: string; selectedTickerIds: string[]; selectedThemeIds: string[] } {
  if (!value || typeof value !== 'object') throw new Error('DeepSeek response was not an object')
  const row = value as Record<string, unknown>
  const headline = validText(row.headline, 'headline', MAX_HEADLINE)
  const narrative = validText(row.narrative, 'narrative', MAX_NARRATIVE)
  const disallowedNumbers = /[\d$%€£¥]/
  if (disallowedNumbers.test(headline) || disallowedNumbers.test(narrative)) {
    throw new Error('DeepSeek narrative contained a number or currency symbol')
  }
  const selectedTickerIds = selectedIds(row.selectedTickerIds, request.tickers)
  const selectedThemeIds = selectedIds(row.selectedThemeIds, request.themes)
  return { headline, narrative, selectedTickerIds, selectedThemeIds }
}

function validText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`DeepSeek response missing ${field}`)
  const text = value.trim()
  if (text.length > max) throw new Error(`DeepSeek ${field} exceeded ${max} characters`)
  return text
}

function selectedIds(value: unknown, allowedFacts: PromptFact[]): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set(allowedFacts.map((fact) => fact.id))
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))].slice(0, 3)
}

function toResponse(row: Record<string, unknown>) {
  return {
    headline: row.headline,
    narrative: row.narrative,
    selectedTickerIds: row.selected_ticker_ids,
    selectedThemeIds: row.selected_theme_ids,
    model: row.model,
    generatedAt: row.generated_at,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
