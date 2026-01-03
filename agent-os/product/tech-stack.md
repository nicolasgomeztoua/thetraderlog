# Tech Stack

EdgeJournal's technology stack is optimized for building a high-performance trading journal with real-time data processing, advanced analytics, and a professional terminal-inspired interface.

## Framework & Runtime

- **Application Framework:** Next.js 15 (App Router with Turbopack for fast refresh)
- **Language:** TypeScript (strict mode enabled, including `noUncheckedIndexedAccess`)
- **Package Manager:** Bun (fast JavaScript runtime and package manager)

## Frontend

- **UI Framework:** React 18+ (via Next.js)
- **CSS Framework:** Tailwind CSS v4
- **UI Components:** shadcn/ui (customized for Terminal Design System)
- **Charts:** lightweight-charts (TradingView-style financial charts)
- **Layout:** react-resizable-panels v2 (for trade detail two-panel layout)
- **Fonts:** JetBrains Mono (monospace for interactive elements), Geist Sans (body text)

## Backend & API

- **API Layer:** tRPC v11 (type-safe API without code generation, end-to-end type safety)
- **Database:** PostgreSQL 15+
- **ORM:** Drizzle ORM (type-safe SQL with zero runtime overhead)
- **Schema Management:** Drizzle Kit (push-based schema migrations, `schema.ts` is single source of truth)

## Authentication & Authorization

- **Authentication:** Clerk (user management with auto-sync to database)
- **Authorization:** User ownership validation in tRPC middleware (all mutations protected)
- **Session Management:** Clerk session tokens with Next.js middleware

## Data & External Services

- **Market Data Providers:**
  - Databento API (futures: ES, NQ, RTY, YM, etc.)
  - Twelve Data API (forex, crypto, extended hours data)
- **Market Data Caching:** Custom caching layer (`candle_cache` table for cross-user deduplication)
- **Background Jobs:** Trigger.dev (for MAE/MFE calculation, batch processing, scheduled tasks)

## Testing & Quality

- **Test Framework:** Vitest (fast unit and integration testing with ESM support)
- **Test Database:** Testcontainers (real PostgreSQL in tests, not mocks - ensures production-like testing)
- **Test Utilities:** Custom fixtures (`createTestUser`, `setupTrader`, `setupTraderWithTrades`)
- **Linting/Formatting:** Biome (fast, unified linting and formatting tool)
- **Type Checking:** TypeScript strict mode with automatic import sorting

## Development Tools

- **Database GUI:** Drizzle Studio (for visual schema inspection and data management)
- **Development Server:** Next.js dev with Turbopack (instant HMR)
- **Commands:** Custom Bun scripts
  - `bun run dev` - Start dev server
  - `bun run build` - Production build
  - `bun run test` - Run tests
  - `bun run test:watch` - Watch mode
  - `bun run db:push` - Push schema changes
  - `bun run db:studio` - Open Drizzle Studio
  - `bun run check` - Run Biome linter

## Key Architecture Decisions

- **No traditional REST API:** tRPC provides end-to-end type safety from frontend to database without code generation
- **No migration files:** `src/server/db/schema.ts` is the single source of truth, pushed directly to database via `db:push`
- **Real database in tests:** Testcontainers ensures integration tests run against actual PostgreSQL, catching production issues early
- **Terminal Design System:** Dark-only theme (#050505 background), electric chartreuse accent (#d4ff00), ice blue for AI features (#00d4ff), monospace fonts for all interactive elements
- **Decimal precision:** All P&L values stored as strings with 8 decimal places, parsed as floats for calculations
- **User ownership enforcement:** All API mutations validate user ownership in middleware, never trusting client-provided userId
- **Absolute imports:** All imports use `~/` alias mapping to `src/` directory for clean import paths

## Data Model Architecture

```
User (Clerk-synced)
 └── Account (demo | live | prop_challenge | prop_funded)
      └── Trade (entries, exits, P&L, MAE/MFE)
           ├── TradeExecution (partial exits, scale-ins)
           ├── TradeTags (many-to-many)
           ├── TradeScreenshots (attachments)
           └── Strategy (rule adherence tracking)
```

**Key Constraints:**
- Users can have unlimited accounts
- Prop challenge accounts can link to funded accounts when passed
- Trades support multiple executions for complex position management
- All enums enforced at database level (trade direction, status, account type)
- Market data cached in `candle_cache` table for cross-user efficiency

## Environment Variables

Required in `.env` and `.env.local`:

- `DATABASE_URL` - PostgreSQL connection string (local dev or hosted)
- `CLERK_SECRET_KEY` - Clerk backend API key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend publishable key
- `DATABENTO_API_KEY` - Databento API key for futures market data
- `TWELVE_DATA_API_KEY` - Twelve Data API key for forex/crypto market data

## Design System (Terminal Theme)

- **Background:** `#050505` (near-black for reduced eye strain)
- **Primary Accent:** `#d4ff00` (electric chartreuse for interactive elements, CTAs, active states)
- **Secondary Accent:** `#00d4ff` (ice blue for AI-powered features)
- **Profit Green:** `#00ff88` (positive P&L, wins)
- **Loss Red:** `#ff3b3b` (negative P&L, losses)
- **Typography:** Monospace (JetBrains Mono) for buttons, labels, navigation, interactive elements; Geist Sans for body text

## Code Style Conventions

- **Linting:** Biome enforced with `bun run check`
- **No non-null assertions:** Avoid `!` operator, use nullish coalescing with safe defaults
- **Const over let:** Prefer immutable bindings, never use `var`
- **Absolute imports:** Always import from `~/` instead of relative paths
- **Type safety:** Strict TypeScript mode, no `any` types without explicit reasoning
- **Database decimals:** Parse with `parseFloat()` for comparisons, return as strings from API
