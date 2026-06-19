<div align="center">

# TheTraderLog

**A professional trading journal for futures traders.**
Terminal-inspired dark UI, data-dense analytics, and AI-powered insights.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](./LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)

[Deploy Your Own](./DEPLOY.md) · [Self-Hosting Guide](./SELF_HOSTING.md) · [Contributing](./CONTRIBUTING.md)

</div>

> **Want your own copy live on the internet?** The beginner-friendly
> **[Deploy Your Own](./DEPLOY.md)** guide walks you through signing up for the
> (mostly free) services and deploying to Vercel — mostly just clicking buttons
> and pasting keys.

---

## What it is

TheTraderLog helps futures traders log trades, review performance, and find an
edge. It ingests broker CSV exports, enriches closed trades with real market
data (MAE/MFE excursions from [Databento](https://databento.com)), and surfaces
data-dense analytics across time, risk, symbols, and behavior — plus an AI
assistant that can chat about your trading and generate reports.

> [!NOTE]
> This is **source-available, not open source** in the OSI sense. It's free for
> personal and other noncommercial use under the
> [PolyForm Noncommercial License](./LICENSE). Commercial use requires a separate
> license.

## Features

- 📓 **Trade journal** — manual entry or CSV import (ProjectX and others), partial exits / scale-ins, screenshots, tags, and notes
- 📈 **Analytics** — equity curve, drawdown, R-multiples, win/loss, P&L distribution, calendar heatmap
- ⏱️ **Time / Risk / Symbol / Behavior** breakdowns — by session, day-of-week, hour, instrument, and trading psychology signals
- 🎯 **MAE/MFE** — maximum adverse/favorable excursion computed from real 1-minute futures candles
- 🤖 **AI insights** — chat over your trades and auto-generated performance reports
- 🏆 **Prop-firm aware** — demo, live, prop challenge, and prop funded account types, with challenge → funded linking
- 🔗 **Public sharing** — read-only analytics share links per account
- ⌨️ **Terminal design system** — dark, monospace, keyboard-friendly

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| API | tRPC v11 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| Background jobs | Trigger.dev |
| Storage | S3-compatible (Cloudflare R2) |
| Market data | Databento |
| AI | OpenRouter |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + Testcontainers (real PostgreSQL) |
| Package manager | Bun |

## Quick start

```bash
git clone <your-fork-url> traderlog
cd traderlog
bun install
cp .env.example .env      # then fill in your service keys

# Need a local database? This spins one up in Docker:
./start-database.sh       # (or point DATABASE_URL at Neon / any Postgres)

bun run db:push           # push schema to your database
bun run dev               # http://localhost:3000
```

You'll need accounts with a handful of services (Clerk, Databento, Trigger.dev,
an S3 provider, OpenRouter, and a PostgreSQL host). The
**[Self-Hosting Guide](./SELF_HOSTING.md)** walks through each one and explains
how to unlock all features without setting up billing.

## Data model

```
User (Clerk-synced)
 └── Account (demo | live | prop_challenge | prop_funded)
      └── Trade (entries, exits, P&L)
           ├── TradeExecution (partial exits, scale-ins)
           ├── TradeTags
           └── TradeScreenshots
```

- Users can have multiple accounts; prop challenge accounts link to funded accounts when passed.
- Trades support partial exits via `TradeExecution` records.
- All P&L uses decimal precision (stored as strings, parsed for comparisons).

## Project structure

```
src/
├── app/
│   ├── (marketing)/      # Landing page, public routes
│   ├── (protected)/      # Authenticated app (dashboard, journal, analytics, ai, import, settings)
│   └── api/              # tRPC handler + webhooks (Clerk)
├── server/
│   ├── api/routers/      # tRPC routers: accounts, trades, analytics, marketData, …
│   └── db/schema.ts      # Drizzle schema — single source of truth for the data model
├── components/           # UI (Terminal design system)
├── lib/                  # CSV parsers, P&L / MAE-MFE calculations, market-data service
├── trigger/              # Trigger.dev background tasks
└── contexts/ · hooks/ · stores/
tests/                    # Integration tests (Testcontainers) + e2e (Playwright)
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run test` | Run tests (needs Docker for Testcontainers) |
| `bun run db:push` | Push schema changes |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check` | Biome lint/format |
| `bun run typecheck` | TypeScript check |

## Documentation

- [Deploy Your Own](./DEPLOY.md) — beginner guide: sign up for services + deploy to Vercel
- [Self-Hosting Guide](./SELF_HOSTING.md) — set up every service and run your own instance
- [Contributing](./CONTRIBUTING.md) — dev workflow, conventions, testing
- [Testing Guide](./tests/README.md) — testing philosophy, fixtures, and conventions

## Disclaimer

TheTraderLog is a journaling and analytics tool. It is **not** financial advice,
and nothing it produces is a recommendation to trade. Trading futures involves
substantial risk of loss. Use at your own risk.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE) — free for noncommercial use.
For commercial licensing, open an issue or contact the maintainer.
