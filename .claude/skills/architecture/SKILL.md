# Architecture Skill

You are a systems architect working on EdgeJournal, a professional trading journal application. You understand the data model, service architecture, and system design decisions.

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| API | tRPC v11 (type-safe RPC) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (user management, sessions) |
| Package Manager | Bun |

## Data Model

```
User (Clerk-synced)
 └── Account (demo | live | prop_challenge | prop_funded)
      ├── AccountGroup (for copy trading)
      └── Trade (entries, exits, P&L)
           ├── TradeExecution (partial exits, scale-ins)
           ├── TradeTags (junction table)
           ├── TradeScreenshots
           ├── TradeRuleChecks (strategy compliance)
           └── MAE/MFE data (computed from market data)

Strategy
 └── StrategyRules (entry, exit, risk, management)

CandleCache (market data cache - shared across users)
```

### Key Relationships

- **Users → Accounts**: One user, multiple accounts (demo, live, prop)
- **Accounts → Trades**: Trades belong to accounts, not directly to users
- **Prop Accounts**: Challenge accounts can link to funded accounts via `linkedAccountId`
- **Copy Trading**: Accounts can be grouped via `AccountGroup` for copy trading scenarios

## Service Architecture

### tRPC Routers

| Router | Purpose | Key Procedures |
|--------|---------|----------------|
| `accounts` | Account CRUD, balance tracking | `create`, `list`, `update`, `delete`, `getStats` |
| `trades` | Trade management, import, P&L | `create`, `list`, `update`, `calculateMAEMFE`, `bulkImport` |
| `analytics` | Performance metrics, charts | `getPerformanceStats`, `getEquityCurve`, `getCalendarData` |
| `marketData` | OHLC data for charts | `getChartData`, `getMAEMFEData` |
| `strategies` | Strategy CRUD, rules | `create`, `list`, `update`, `getRules` |
| `tags` | Trade tagging | `create`, `list`, `assignToTrade` |
| `settings` | User preferences | `get`, `update` |
| `filterPresets` | Saved journal filters | `create`, `list`, `delete` |

### Authentication Flow

```
Client Request → tRPC → protectedProcedure middleware
                              ↓
                    Clerk validateRequest()
                              ↓
                    Get/create user in DB
                              ↓
                    ctx.userId available to procedures
```

All mutations require authentication via `protectedProcedure`. User ownership is validated in middleware—never trust client-provided userId.

## Market Data Architecture

EdgeJournal uses a **cache-first architecture** for market data to minimize API costs.

### The Problem

- External APIs charge per request
- At scale: 1000 users × 5 trades/day = 10K+ API calls/day
- Historical data is **immutable**—ES futures prices on Dec 15, 2024 never change

### The Solution

```
┌─────────────────┐
│  Trade Detail   │
│     Page        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ market-data-    │
│ service.ts      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│ Cache │ │ Provider  │
│  Hit  │ │ Routing   │
│       │ │           │
└───┬───┘ └─────┬─────┘
    │           │
    │      ┌────┴────┐
    │      ▼         ▼
    │  ┌───────┐ ┌────────┐
    │  │Twelve │ │Databento│
    │  │ Data  │ │ (CME)   │
    │  └───┬───┘ └────┬───┘
    │      │          │
    │      └────┬─────┘
    │           ▼
    │    ┌───────────┐
    │    │Store Cache│
    │    └─────┬─────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│ Return OHLC     │
│ bars to client  │
└─────────────────┘
```

### Provider Routing

| Provider | Instruments | Use Case |
|----------|-------------|----------|
| **Databento** | CME Futures (ES, NQ, MNQ, MES) | Index futures via continuous contracts |
| **Twelve Data** | Forex, Crypto, Commodities | EUR/USD, GBP/USD, BTC/USD, XAU/USD |

Symbol routing happens automatically in `market-data-service.ts`:

```typescript
// Futures → Databento (continuous contracts)
MNQ → MNQ.v.0  // volume-based roll, front month
ES  → ES.v.0

// Forex/Crypto → Twelve Data
EUR/USD, GBP/USD, USD/JPY, etc.
```

### Cache Key Design

```
(symbol, interval, date) → OHLC bars for that day
```

- **symbol**: "ES", "EUR/USD", "NQ"
- **interval**: "1min", "5min", "15min", "1h"
- **date**: Normalized to midnight UTC

One row = one day of bars for one symbol at one interval. Cross-user deduplication means if 100 users trade ES on the same day, that's 1 API call, not 100.

## MAE/MFE Analysis

Maximum Adverse/Favorable Excursion analysis shows trade efficiency.

### Calculation Flow

1. Trade detail page loads
2. Check if trade has `marketDataQuality` (already calculated?)
3. If not, trigger `calculateMAEMFE` mutation
4. Fetch OHLC bars from cache (or API)
5. Calculate MAE/MFE prices and amounts
6. Store results permanently on trade record
7. Subsequent views are instant (no recalculation)

### Trade Fields for MAE/MFE

```typescript
maePrice: decimal       // Price of max adverse excursion
mfePrice: decimal       // Price of max favorable excursion
maeAmount: decimal      // $ value of MAE
mfeAmount: decimal      // $ value of MFE
tradeEfficiency: decimal // % of MFE captured (0-100)
marketDataQuality: enum // 'full' | 'partial' | 'unavailable' | 'pending'
```

## Database Patterns

### Schema as Single Source of Truth

All data model changes go through `src/server/db/schema.ts`:

```bash
# Edit schema.ts, then push changes
bun run db:push
```

### Decimal Handling

- Stored as strings in PostgreSQL (precision: 20, scale: 2-8)
- Parse with `parseFloat()` for comparisons
- Display with `toLocaleString()` for formatting

### Enum Usage

Enums enforced at DB level:
- `trade_direction`: "long" | "short"
- `trade_status`: "open" | "closed"
- `account_type`: "demo" | "live" | "prop_challenge" | "prop_funded"
- `data_quality`: "full" | "partial" | "unavailable" | "pending"

### Soft Deletes

Trades use soft delete via `deletedAt` timestamp. Query with `isNull(trades.deletedAt)`.

## Key Files

| File | Purpose |
|------|---------|
| `src/server/db/schema.ts` | Database schema (SINGLE SOURCE OF TRUTH) |
| `src/server/api/trpc.ts` | tRPC initialization, context, middleware |
| `src/server/api/root.ts` | Router aggregation |
| `src/server/api/routers/*.ts` | Individual tRPC routers |
| `src/lib/market-data-service.ts` | Cache-first OHLC fetching |
| `src/lib/symbols.ts` | Symbol mappings for data providers |
| `src/lib/trade-calculations.ts` | P&L and MAE/MFE calculations |
| `src/lib/stats-calculations.ts` | Analytics calculations |

## Reference

For detailed market data architecture including cost analysis, troubleshooting, and future considerations:
- [Market Data Architecture Reference](./MARKET_DATA_REFERENCE.md)
- [Full Documentation](../../../MARKET_DATA_ARCHITECTURE.md)
