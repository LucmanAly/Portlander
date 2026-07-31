#!/usr/bin/env node
/**
 * Local Finnhub earnings sync (no Supabase / cloud mode required).
 *
 * Usage:
 *   set FINNHUB_API_KEY=...          # Windows PowerShell: $env:FINNHUB_API_KEY="..."
 *   npm run sync:events
 *   npm run sync:events -- CRWD PANW MSFT
 *
 * Writes public/data/events-sync.json for the app to merge on boot.
 * Never call Finnhub from the browser — this script is the local offline path.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'public', 'data', 'events-sync.json')

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const LOOKAHEAD_DAYS = 90
const LOOKBACK_DAYS = 7

const token = process.env.FINNHUB_API_KEY?.trim()
if (!token) {
  console.error('Missing FINNHUB_API_KEY. Set it in the environment and re-run.')
  console.error('  PowerShell:  $env:FINNHUB_API_KEY="your_key"')
  console.error('  bash:        export FINNHUB_API_KEY=your_key')
  process.exit(1)
}

const argTickers = process.argv.slice(2).map((t) => t.toUpperCase()).filter(Boolean)
const tickers =
  argTickers.length > 0
    ? argTickers
    : loadDefaultTickers()

console.log(`Syncing earnings for ${tickers.length} tickers: ${tickers.join(', ')}`)

const { from, to } = dateWindow()
const events = []
const errors = []

for (const symbol of tickers) {
  try {
    const rows = await fetchEarnings(symbol, from, to, token)
    for (const row of rows) {
      events.push(toAppEvent(row))
    }
    console.log(`  ${symbol}: ${rows.length} earnings row(s)`)
    await sleep(200)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`${symbol}: ${msg}`)
    console.error(`  ${symbol}: ERROR ${msg}`)
  }
}

// Macro seed (same idea as Edge Function)
events.push(...buildMacroEvents())

const payload = {
  generatedAt: new Date().toISOString(),
  provider: 'finnhub',
  from,
  to,
  tickers,
  events,
  errors,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
console.log(`\nWrote ${events.length} events → ${outPath}`)
if (errors.length) {
  console.log(`Completed with ${errors.length} error(s).`)
  process.exitCode = 2
} else {
  console.log('Done. Restart or refresh the app to merge (or click Reload in Settings).')
}

function loadDefaultTickers() {
  // Prefer tickers from a simple list file if present
  const listPath = join(root, 'scripts', 'tickers.txt')
  if (existsSync(listPath)) {
    return readFileSync(listPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().toUpperCase())
      .filter((l) => l && !l.startsWith('#'))
  }
  // Demo defaults (cyber + AI core)
  return ['CRWD', 'PANW', 'FTNT', 'MSFT', 'NVDA', 'META', 'ZS', 'NET']
}

function dateWindow() {
  const now = new Date()
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS)
  const to = new Date(now)
  to.setUTCDate(to.getUTCDate() + LOOKAHEAD_DAYS)
  return { from: ymd(from), to: ymd(to) }
}

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

async function fetchEarnings(symbol, from, to, token) {
  const url = new URL(`${FINNHUB_BASE}/calendar/earnings`)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.earningsCalendar ?? []).filter(
    (e) => e.symbol?.toUpperCase() === symbol.toUpperCase() && e.date,
  )
}

function mapHour(hour) {
  const h = (hour ?? '').toLowerCase()
  if (h === 'bmo') return 'bmo'
  if (h === 'amc') return 'amc'
  return 'unknown'
}

function toAppEvent(row) {
  const symbol = row.symbol.toUpperCase()
  const status =
    row.epsActual != null || row.revenueActual != null ? 'confirmed' : 'estimated'
  return {
    id: deterministicId(`earnings|${symbol}|${row.date}`),
    ticker: symbol,
    title: `${symbol} earnings`,
    eventType: 'earnings',
    eventDate: row.date,
    eventTime: null,
    timing: mapHour(row.hour),
    status,
    source: 'finnhub',
    description: [
      row.quarter != null && row.year != null ? `Q${row.quarter} ${row.year}` : null,
      row.epsEstimate != null ? `EPS est ${row.epsEstimate}` : null,
      row.epsActual != null ? `EPS act ${row.epsActual}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

function buildMacroEvents() {
  const out = []
  const start = new Date()

  let fomc = nextWeekday(start, 3)
  for (let i = 0; i < 3; i++) {
    const d = addDays(fomc, i * 42)
    out.push(macro('fomc', ymd(d), 'FOMC decision', 'unknown'))
  }

  for (let m = 0; m < 3; m++) {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 13))
    if (month >= start) {
      out.push(macro('cpi', ymd(month), 'CPI release', 'bmo'))
    }
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1))
    const nfp = firstFriday(first)
    if (nfp >= start) {
      out.push(macro('nfp', ymd(nfp), 'Nonfarm payrolls', 'bmo'))
    }
  }
  return out
}

function macro(eventType, eventDate, title, timing) {
  return {
    id: deterministicId(`macro|${eventType}|${eventDate}`),
    ticker: null,
    title,
    eventType,
    eventDate,
    eventTime: null,
    timing,
    status: 'estimated',
    source: 'macro-seed',
    description: title,
  }
}

function nextWeekday(from, day) {
  const d = new Date(from)
  const delta = (day - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + delta)
  return d
}

function firstFriday(monthStart) {
  const d = new Date(monthStart)
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

function addDays(d, n) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function deterministicId(key) {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 0x811c9dc5) >>> 0
  }
  const parts = []
  let a = h1
  let b = h2
  for (let i = 0; i < 4; i++) {
    a = Math.imul(a ^ b, 0x85ebca6b) >>> 0
    b = Math.imul(b ^ a, 0xc2b2ae35) >>> 0
    parts.push(a.toString(16).padStart(8, '0'))
  }
  const h = parts.join('')
  const bytes = h.split('')
  bytes[12] = '4'
  bytes[16] = ((parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16)
  const s = bytes.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
