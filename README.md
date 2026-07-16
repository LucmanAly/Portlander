# Portlander

A calendar for my portfolio holdings — a self-hosted website that pulls market
data from free APIs, tracks holdings imported from a broker (Fidelity CSV
export), and sends a notification when any holding's earnings date is within 30
days (with 7-day and 1-day follow-ups).

## Status

v1 is implemented: holdings import, earnings sync/watch, and notifications
(in-app, email, iCal feed) all work end to end. The full architecture — stack,
module layout, data model, earnings-alert pipeline, notification channels,
Fidelity import strategy, and feature roadmap — lives in
**[ARCHITECTURE.md](./ARCHITECTURE.md)**.

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

## Setup

1. **Create a Supabase project** (free tier) → Project Settings → Database →
   copy the connection string (URI, "Session pooler" or direct, either works
   for this app's traffic level) into `DATABASE_URL`.
2. **Get free API keys:**
   - [Finnhub](https://finnhub.io) — primary market data / earnings calendar
   - [Alpha Vantage](https://www.alphavantage.co/support/#api-key) — fallback
   - [Resend](https://resend.com) — email delivery (100/day free)
3. **Copy `.env.example` to `.env.local`** and fill in the values above, plus:
   - `CRON_SECRET` / `CALENDAR_FEED_TOKEN` — generate with `openssl rand -hex 32`
   - `APP_USER_EMAIL` — your email; v1 is single-tenant, this is "you"
4. **Install and set up the database:**
   ```bash
   npm install
   npm run db:push   # applies the schema in src/core/db/schema.ts to your DB
   ```
5. **Run it:** `npm run dev` → http://localhost:3000. Go to **Import**, upload
   your Fidelity Positions CSV, then **Settings** to grab your calendar feed
   URL and subscribe to it from your phone's calendar app.
6. **Trigger the daily job manually** to test before deploying a cron:
   ```bash
   curl -X POST http://localhost:3000/api/jobs/daily \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

### Deploying

Push to GitHub, import the repo in [Vercel](https://vercel.com), add all the
`.env.local` variables as Environment Variables in the Vercel project
settings, and deploy. `vercel.json` already defines the daily cron
(`0 13 * * *` UTC ≈ 8–9am US Eastern depending on DST) — Vercel wires it up
automatically and signs requests with `CRON_SECRET` for you.
