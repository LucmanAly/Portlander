# Portlander

A calendar for my portfolio holdings — a self-hosted website that pulls market
data from free APIs, tracks holdings imported from a broker (Fidelity CSV
export), and sends a notification when any holding's earnings date is within 30
days (with 7-day and 1-day follow-ups).

## Status

Design phase. The complete architecture — stack, module layout, data model,
earnings-alert pipeline, notification channels, Fidelity import strategy, and
feature roadmap — lives in **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## At a glance

- **Stack:** Next.js 15 + TypeScript, Postgres (Supabase) + Drizzle, Vercel +
  Vercel Cron — all on free tiers
- **Shape:** modular monolith — feature modules (`portfolio`, `market-data`,
  `earnings`, `notifications`, `analysis`) behind typed interfaces
- **Market data:** provider adapters (Finnhub primary, Alpha Vantage fallback)
  with rate limiting and a DB-backed cache
- **Notifications:** in-app center, email (Resend), a subscribable iCal feed
  (native phone reminders for free), then Telegram and Web Push
- **Holdings import:** Fidelity CSV export → importer adapter (aggregator sync
  like SnapTrade possible later)
