# Codebase Structure

**Analysis Date:** 2026-01-17

## Directory Layout

```
edgejournal/
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── (marketing)/        # Public landing pages
│   │   ├── (protected)/        # Authenticated app routes
│   │   ├── api/                # API routes (tRPC, webhooks)
│   │   ├── sign-in/            # Clerk sign-in pages
│   │   └── sign-up/            # Clerk sign-up pages
│   ├── components/             # React components
│   │   ├── ui/                 # Shadcn UI primitives
│   │   ├── analytics/          # Analytics-specific components
│   │   ├── daily-journal/      # Daily journal components
│   │   ├── strategy/           # Strategy management components
│   │   ├── tags/               # Tag management components
│   │   ├── trade-detail/       # Trade detail view components
│   │   └── trade-log/          # Trade log table components
│   ├── contexts/               # React Context providers
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Shared utilities and business logic
│   │   ├── analytics/          # Analytics calculations
│   │   ├── constants/          # Shared constants
│   │   ├── hooks/              # Non-React utility hooks
│   │   ├── market-data/        # Market data service and caching
│   │   ├── shared/             # Cross-cutting utilities
│   │   ├── storage/            # S3 storage utilities
│   │   ├── trades/             # Trade calculations, CSV parsers
│   │   └── ui/                 # UI utilities (themes, export)
│   ├── server/                 # Backend code
│   │   ├── api/                # tRPC routers and middleware
│   │   │   ├── routers/        # Individual tRPC routers
│   │   │   └── helpers/        # Query helpers (cursor, sort)
│   │   └── db/                 # Database connection and schema
│   ├── stores/                 # Zustand state stores
│   ├── styles/                 # Global CSS
│   ├── trigger/                # Trigger.dev background jobs
│   ├── trpc/                   # tRPC client configuration
│   └── types/                  # TypeScript type definitions
├── tests/                      # Test files
│   ├── integration/            # Backend integration tests
│   ├── setup/                  # Test database setup
│   ├── utils/                  # Test utilities and fixtures
│   └── e2e/                    # End-to-end tests (placeholder)
├── plans/                      # Implementation plans
├── scripts/                    # Build and automation scripts
│   └── ralph/                  # Ralph autonomous loop
├── drizzle/                    # Database migrations
├── public/                     # Static assets
└── .claude/                    # Claude Code configuration
    ├── skills/                 # AI skill definitions
    └── commands/               # Custom Claude commands
```

## Directory Purposes

**`src/app/`**
- Purpose: Next.js App Router - pages, layouts, API routes
- Contains: Page components (`page.tsx`), layouts (`layout.tsx`), route handlers (`route.ts`)
- Key files: `layout.tsx` (root), `(protected)/layout.tsx` (authenticated shell)

**`src/app/(protected)/`**
- Purpose: Authenticated application routes
- Contains: Dashboard, journal, analytics, AI, import, settings, strategies pages
- Key files: `dashboard/page.tsx`, `journal/page.tsx`, `analytics/page.tsx`

**`src/app/api/trpc/[trpc]/`**
- Purpose: tRPC API endpoint handler
- Contains: Route handler that processes all tRPC requests
- Key files: `route.ts`

**`src/server/api/routers/`**
- Purpose: tRPC router definitions - business logic for each domain
- Contains: One router per domain (trades, accounts, analytics, etc.)
- Key files: `trades.ts`, `accounts.ts`, `analytics.ts`, `strategies.ts`, `dailyJournal.ts`

**`src/server/db/`**
- Purpose: Database schema and connection
- Contains: Drizzle schema, connection setup, type exports
- Key files: `schema.ts` (SINGLE SOURCE OF TRUTH), `index.ts`

**`src/components/ui/`**
- Purpose: Shadcn UI primitives styled for Terminal design system
- Contains: Button, Card, Dialog, Table, etc.
- Key files: `button.tsx`, `card.tsx`, `sidebar.tsx`, `table.tsx`

**`src/components/analytics/`**
- Purpose: Analytics dashboard components
- Contains: Charts, stat cards, filter panels
- Key files: Located via `index.ts` barrel export

**`src/lib/market-data/`**
- Purpose: Market data fetching and caching service
- Contains: OHLC data service, symbol mapping, MAE/MFE calculations
- Key files: `service.ts`, `symbols.ts`, `maemfe.ts`

**`src/lib/trades/`**
- Purpose: Trade-related utilities
- Contains: CSV parsers, P&L calculations, hash generation
- Key files: `csv-parsers/index.ts`, `calculations.ts`, `hash.ts`

**`src/lib/shared/`**
- Purpose: Cross-cutting utilities used across frontend and backend
- Contains: ID generation, colors, time utilities, Zod schemas
- Key files: `id.ts`, `colors.ts`, `time.ts`, `schemas.ts`, `timezone.ts`

**`src/lib/constants/`**
- Purpose: Shared constants (NEVER hardcode in components)
- Contains: Trading sessions, day labels, analytics presets
- Key files: `analytics.ts`, `trade-log.ts`

**`src/contexts/`**
- Purpose: React Context providers for global state
- Contains: Account selection, theme management
- Key files: `account-context.tsx`, `theme-context.tsx`

**`src/stores/`**
- Purpose: Zustand stores for client-side state
- Contains: Filter state, chart preferences, settings
- Key files: `analytics-filter-store.ts`, `settings-store.ts`

**`src/trpc/`**
- Purpose: tRPC client setup for both client and server
- Contains: React client, server caller, query client config
- Key files: `react.tsx` (client), `server.ts` (RSC), `query-client.ts`

**`tests/`**
- Purpose: Test files using Vitest with Testcontainers
- Contains: Integration tests, fixtures, database setup
- Key files: `setup/setup.ts`, `utils/fixtures/`, `integration/trades/`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with providers
- `src/app/(protected)/layout.tsx`: Authenticated shell with sidebar
- `src/middleware.ts`: Route protection middleware
- `src/app/api/trpc/[trpc]/route.ts`: tRPC HTTP handler

**Configuration:**
- `src/env.js`: Environment variable validation (Zod)
- `drizzle.config.ts`: Drizzle ORM configuration
- `next.config.js`: Next.js configuration
- `vitest.config.ts`: Test configuration
- `biome.jsonc`: Linting/formatting configuration

**Core Logic:**
- `src/server/db/schema.ts`: Database schema (SINGLE SOURCE OF TRUTH)
- `src/server/api/root.ts`: tRPC app router composition
- `src/server/api/trpc.ts`: tRPC initialization, context, procedures

**Testing:**
- `tests/setup/setup.ts`: Testcontainers PostgreSQL setup
- `tests/utils/caller-factory.ts`: tRPC test caller creation
- `tests/utils/fixtures/`: Test data factories

## Naming Conventions

**Files:**
- Page components: `page.tsx`
- Layout components: `layout.tsx`
- Route handlers: `route.ts`
- React components: `kebab-case.tsx` (e.g., `app-sidebar.tsx`)
- TypeScript modules: `kebab-case.ts` (e.g., `analytics-filter-store.ts`)
- Test files: `*.test.ts` in `tests/integration/` directory

**Directories:**
- Route groups: `(group-name)` (e.g., `(protected)`, `(marketing)`)
- Dynamic routes: `[param]` (e.g., `[id]`)
- Catch-all routes: `[[...param]]` (e.g., `[[...sign-in]]`)
- Private components: `_components/` (not exposed as routes)

**Functions/Variables:**
- React components: `PascalCase` (e.g., `AppSidebar`)
- Functions: `camelCase` (e.g., `createTRPCContext`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_ANALYTICS_FILTERS`)
- tRPC routers: `camelCase` + `Router` suffix (e.g., `tradesRouter`)
- Zod schemas: `camelCase` + `Schema` suffix (e.g., `createTradeSchema`)

## Where to Add New Code

**New Feature (e.g., "Playbook"):**
- Page: `src/app/(protected)/playbook/page.tsx`
- Components: `src/components/playbook/`
- Router: `src/server/api/routers/playbook.ts` (add to `src/server/api/root.ts`)
- Schema tables: `src/server/db/schema.ts` (add tables, relations, types)
- Tests: `tests/integration/playbook/`

**New tRPC Procedure:**
- Add to existing router in `src/server/api/routers/`
- Use `protectedProcedure` for authenticated endpoints
- Add Zod input schema inline or import from shared location

**New Component:**
- Feature component: `src/components/{feature}/component-name.tsx`
- UI primitive: `src/components/ui/component-name.tsx`
- Page-specific: `src/app/(protected)/{page}/_components/`

**New Utility:**
- Shared (FE + BE): `src/lib/shared/`
- Analytics-specific: `src/lib/analytics/`
- Trade-specific: `src/lib/trades/`
- UI helpers: `src/lib/ui/`

**New Hook:**
- Feature-specific: `src/hooks/use-{name}.ts`
- Utility hooks: `src/lib/hooks/`

**New Constant:**
- ALWAYS in `src/lib/constants/` (NEVER hardcode in components)
- Create domain-specific file if needed

**New Test:**
- Integration tests: `tests/integration/{domain}/`
- Use fixtures from `tests/utils/fixtures/`

## Special Directories

**`drizzle/`**
- Purpose: Database migration files generated by Drizzle
- Generated: Yes (by `bun run db:push` or `drizzle-kit generate`)
- Committed: Yes

**`.next/`**
- Purpose: Next.js build output
- Generated: Yes (by `bun run build` or `bun run dev`)
- Committed: No

**`node_modules/`**
- Purpose: NPM dependencies
- Generated: Yes (by `bun install`)
- Committed: No

**`.planning/`**
- Purpose: GSD planning documents
- Generated: By GSD mapping commands
- Committed: Typically no (gitignored)

**`scripts/ralph/archive/`**
- Purpose: Completed Ralph PRD runs
- Generated: Manually moved after PRD completion
- Committed: Yes (for history)

---

*Structure analysis: 2026-01-17*
