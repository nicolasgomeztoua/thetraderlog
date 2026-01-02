# EdgeJournal - Project Analysis

## Executive Summary

EdgeJournal is a professional trading journal SaaS application built on modern web technologies. It provides serious traders with tools to track, analyze, and improve their trading performance through a sophisticated, data-dense terminal-inspired UI.

**Version:** 0.1.0 | **Status:** Active Development

---

## 1. Project Structure & Architecture

### Directory Organization

```
edgejournal/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (marketing)/              # Public landing pages
│   │   ├── (protected)/              # Authenticated app routes
│   │   │   ├── dashboard/            # Main dashboard with KPIs
│   │   │   ├── journal/              # Trade journal & details
│   │   │   ├── analytics/            # Performance analytics
│   │   │   ├── import/               # CSV import interface
│   │   │   ├── ai/                   # AI chat interface
│   │   │   ├── strategies/           # Strategy management
│   │   │   ├── playbooks/            # Trading playbooks
│   │   │   └── settings/             # User settings
│   │   └── api/                      # API routes (tRPC, webhooks, queue)
│   ├── server/
│   │   ├── api/routers/              # tRPC routers (~5,076 LOC total)
│   │   └── db/                       # Drizzle ORM schema & connection
│   ├── components/                   # React components (ui/, analytics/, etc.)
│   ├── lib/                          # Utility functions & services
│   ├── trpc/                         # tRPC client setup
│   ├── contexts/                     # React contexts
│   ├── stores/                       # Zustand stores
│   └── hooks/                        # Custom React hooks
├── tests/                            # Vitest + Testcontainers tests
├── drizzle/                          # Database migrations
└── plans/                            # Feature planning docs
```

### Architecture Pattern

**Layered Architecture:**
- **Client Layer:** Next.js 15 App Router (React 19)
- **API Layer:** tRPC v11 (end-to-end type safety)
- **Business Logic:** Router-based procedures with middleware
- **Data Layer:** Drizzle ORM with PostgreSQL
- **External Services:** Clerk (auth), Upstash QStash (queuing)

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.2.3 | App Router with server components |
| React | 19.0.0 | Component framework |
| TypeScript | 5.8.2 | Full type safety |
| shadcn/ui | - | Radix-based UI components |
| Tailwind CSS | 4.0.15 | Utility-first styling |
| Zustand | 5.0.9 | Global state management |
| react-hook-form | 7.68.0 | Form handling |
| lightweight-charts | 5.1.0 | TradingView-like charts |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| tRPC | 11.0.0 | Type-safe RPC framework |
| Drizzle ORM | 0.41.0 | SQL-first ORM |
| PostgreSQL | - | Relational database |
| Clerk | 6.36.0 | Authentication |
| Upstash QStash | 2.8.4 | Background task processing |
| Zod | 4.1.13 | Schema validation |

### Development Tools
| Tool | Purpose |
|------|---------|
| Bun | Package manager & runtime |
| Biome | Linting & formatting |
| Vitest | Unit & integration testing |
| Testcontainers | PostgreSQL containers for tests |
| Drizzle Kit | Migration management |

---

## 3. Key Components & Responsibilities

### Core Domain Entities

| Entity | Router | Description |
|--------|--------|-------------|
| **Users** | - | Clerk-managed with PostgreSQL sync |
| **Accounts** | `accounts.ts` (654 LOC) | Trading accounts (live, demo, prop firm) |
| **Trades** | `trades.ts` (1,345 LOC) | Core trade journal with MAE/MFE metrics |
| **Analytics** | `analytics.ts` (1,490 LOC) | Complex performance aggregations |
| **Strategies** | `strategies.ts` (815 LOC) | Trading strategies with rule checking |
| **Tags** | `tags.ts` (339 LOC) | Trade categorization |

### Key Services

| Service | File | Purpose |
|---------|------|---------|
| **Market Data** | `market-data-service.ts` | Cache-first OHLC data fetching |
| **MAE/MFE** | `maemfe-service.ts` | Maximum Adverse/Favorable Excursion calculations |
| **Trade Calculations** | `trade-calculations.ts` | P&L, risk metrics, efficiency |
| **CSV Parsers** | `csv-parsers/` | MT4, MT5, ProjectX import |
| **Queue** | `queue.ts` | Upstash QStash background processing |

---

## 4. Build & Test Commands

### Development
```bash
bun run dev              # Start development server (Turbo bundler)
bun run build            # Production build
bun run start            # Start production server
bun run preview          # Build + preview locally
```

### Testing
```bash
bun run test             # Run tests once
bun run test:watch       # Watch mode
bun run test:integration # Integration tests only
bun run test:coverage    # Coverage report
```

### Database
```bash
bun run db:push          # Push schema to database
bun run db:generate      # Generate migration files
bun run db:migrate       # Run pending migrations
bun run db:studio        # Open Drizzle Studio GUI
```

### Code Quality
```bash
bun run check            # Biome lint & format check
bun run check:write      # Auto-fix issues
bun run check:unsafe     # Unsafe fixes (imports, etc.)
bun run typecheck        # TypeScript type checking
```

---

## 5. Conventions & Patterns

### Database Schema Patterns
- **Typed IDs:** Prefix-based nanoid (e.g., `us-`, `tr-`, `ac-`)
- **Timestamps:** Always timezone-aware with auto-generation
- **Soft Deletes:** `deletedAt` field for trades
- **Decimal Precision:** `decimal(20, 8)` for financial data

### API Design
- **Input Validation:** Zod schemas for all inputs
- **String Decimals:** Use strings for precision, parse on client
- **Auth Middleware:** Auto-sync Clerk users to PostgreSQL
- **Error Handling:** tRPC errors with specific codes

### Code Organization
```typescript
// Router structure pattern
export const router = createTRPCRouter({
  // === QUERIES ===
  getAll: protectedProcedure.query(...),
  
  // === MUTATIONS ===
  create: protectedProcedure.input(schema).mutation(...),
});
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Files | `kebab-case` | `market-data-service.ts` |
| DB Tables | `snake_case` | `trade_execution` |
| TypeScript | `camelCase` | `tradeEfficiency` |
| Types | `PascalCase` | `TradeWithRelations` |
| IDs | Prefixed | `ids.trade()` → `tr-abc123...` |

### Component Patterns
- **Server Components by default** (App Router)
- **`'use client'`** only for interactive features
- **react-hook-form + Zod** for forms
- **Zustand** for global UI state
- **React Query (via tRPC)** for server state

### Styling Conventions
- Tailwind utility classes
- Monospace font (`font-mono`) for data/labels
- Terminal-inspired design with `bg-white/[0.01]` subtle backgrounds
- CSS variables for semantic colors

### Testing Philosophy
- **Real database testing** with Testcontainers PostgreSQL
- **Trading domain scenarios**, not implementation details
- **Isolation by test file**, composition within files
- Test utilities: `setupTrader()`, `createTestTrade()`, etc.

---

## Summary

EdgeJournal demonstrates professional patterns:
- ✅ **End-to-end type safety** (tRPC + Drizzle + Zod)
- ✅ **Modern React** (Next.js 15, React 19, Server Components)
- ✅ **Robust testing** (Real PostgreSQL via Testcontainers)
- ✅ **Clear separation of concerns** (routers, services, components)
- ✅ **Production-ready infrastructure** (Clerk auth, queue processing, caching)