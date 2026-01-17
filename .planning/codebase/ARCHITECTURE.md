# Architecture

**Analysis Date:** 2026-01-17

## Pattern Overview

**Overall:** Full-stack Next.js with tRPC, following layered architecture with clear separation between client, API, and data layers.

**Key Characteristics:**
- Server-first architecture using Next.js 15 App Router with React Server Components (RSC)
- Type-safe API layer using tRPC v11 with end-to-end TypeScript inference
- PostgreSQL database with Drizzle ORM for type-safe queries
- Clerk-managed authentication with webhook-based user sync
- Zustand for client-side state management
- Context providers for cross-cutting concerns (accounts, theme)

## Layers

**Presentation Layer (UI):**
- Purpose: Render UI components, handle user interactions
- Location: `src/app/`, `src/components/`
- Contains: Page components, UI components, layouts
- Depends on: tRPC hooks (`src/trpc/react.tsx`), Zustand stores, React Context
- Used by: End users via browser

**API Layer (tRPC):**
- Purpose: Define type-safe RPC procedures, handle business logic
- Location: `src/server/api/`
- Contains: Router definitions, procedures, middleware
- Depends on: Database layer, external services (Clerk, market data APIs)
- Used by: Presentation layer via tRPC client

**Data Layer (Drizzle ORM):**
- Purpose: Database schema definition, query execution
- Location: `src/server/db/`
- Contains: Schema definitions, database connection, type exports
- Depends on: PostgreSQL database
- Used by: API layer

**Shared Layer (Lib):**
- Purpose: Cross-cutting utilities, calculations, constants
- Location: `src/lib/`
- Contains: Analytics calculations, market data service, CSV parsers, shared schemas
- Depends on: Nothing (pure utilities) or database (market data caching)
- Used by: API layer, Presentation layer

## Data Flow

**Read Flow (Query):**

1. Client component calls `api.trades.getAll.useQuery()` via `src/trpc/react.tsx`
2. Request hits `/api/trpc/[trpc]/route.ts` which creates tRPC context
3. Context fetches Clerk userId and attaches database connection
4. `protectedProcedure` middleware validates authentication and syncs user to DB
5. Router procedure (`src/server/api/routers/trades.ts`) executes Drizzle query
6. Response serialized via SuperJSON and returned to client
7. React Query caches result and triggers UI update

**Write Flow (Mutation):**

1. Client calls `api.trades.create.useMutation()` with input data
2. Zod schema validates input at tRPC layer
3. `protectedProcedure` ensures user is authenticated
4. Router inserts record via Drizzle, enforcing user ownership
5. Full created object returned for optimistic updates
6. React Query invalidates related queries

**Server Component Flow:**

1. RSC calls `api.trades.getAll()` directly via `src/trpc/server.ts`
2. Uses `createCaller` with cached context for server-side execution
3. No HTTP round-trip - direct procedure call
4. Data passed to client via RSC serialization

**State Management:**
- Server state: React Query (via tRPC) handles caching, invalidation, optimistic updates
- Client state: Zustand stores (`src/stores/`) for UI state (filters, preferences)
- Persisted state: Zustand persist middleware saves to localStorage
- Context state: React Context (`src/contexts/`) for app-wide concerns (active account, theme)

## Key Abstractions

**tRPC Procedures:**
- Purpose: Type-safe API endpoints with input validation and auth
- Examples: `src/server/api/routers/trades.ts`, `src/server/api/routers/accounts.ts`
- Pattern: `protectedProcedure.input(zodSchema).query/mutation(handler)`

**Drizzle Schema Tables:**
- Purpose: Single source of truth for data model with type inference
- Examples: `src/server/db/schema.ts` - `users`, `accounts`, `trades`, `strategies`
- Pattern: `createTable()` with column definitions, indexes, relations

**React Context Providers:**
- Purpose: Share state across component tree without prop drilling
- Examples: `src/contexts/account-context.tsx`, `src/contexts/theme-context.tsx`
- Pattern: Context + Provider + custom hook (`useAccount()`, `useTheme()`)

**Zustand Stores:**
- Purpose: Client-side state management with persistence
- Examples: `src/stores/analytics-filter-store.ts`, `src/stores/settings-store.ts`
- Pattern: `create<StoreType>()(persist(stateCreator, config))`

**Market Data Service:**
- Purpose: Cache-first OHLC data fetching with multi-provider support
- Examples: `src/lib/market-data/service.ts`
- Pattern: Check DB cache -> fetch from API -> store in cache -> return

## Entry Points

**HTTP Entry Point:**
- Location: `src/app/api/trpc/[trpc]/route.ts`
- Triggers: All tRPC API calls from client components
- Responsibilities: Create context, route to tRPC handler, handle errors

**RSC Entry Point:**
- Location: `src/trpc/server.ts`
- Triggers: Server-side tRPC calls from React Server Components
- Responsibilities: Create cached context, provide direct caller access

**Middleware Entry Point:**
- Location: `src/middleware.ts`
- Triggers: All requests to app routes
- Responsibilities: Route protection via Clerk, redirect unauthenticated users

**Webhook Entry Point:**
- Location: `src/app/api/webhooks/clerk/route.ts`
- Triggers: Clerk user lifecycle events (created, updated, deleted)
- Responsibilities: Sync user data to local database

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: App initialization
- Responsibilities: Clerk provider, tRPC provider, fonts, global styles

**Protected Layout:**
- Location: `src/app/(protected)/layout.tsx`
- Triggers: All authenticated routes
- Responsibilities: Sidebar, theme provider, account provider, settings hydration

## Error Handling

**Strategy:** Errors bubble up through layers with type-safe handling at each level

**Patterns:**
- tRPC throws `TRPCError` with appropriate codes (`UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`)
- Zod validation errors automatically formatted and returned to client
- React Query exposes errors via `error` property on query/mutation results
- Toast notifications via Sonner for user-facing error messages
- Development mode logs detailed tRPC errors to console

## Cross-Cutting Concerns

**Logging:**
- tRPC `onError` handler logs failed procedures in development
- Console logging for debugging (no structured logging service)

**Validation:**
- Zod schemas at tRPC procedure inputs
- Database-level enum constraints
- TypeScript strict mode for compile-time checks

**Authentication:**
- Clerk middleware protects routes at edge
- tRPC `authMiddleware` validates user and syncs to database
- User ownership enforced in every protected procedure - never trust client userId

**Caching:**
- React Query handles client-side caching with configurable stale time
- Market data cached permanently in `candle_cache` table for cross-user reuse
- Database connection cached in development to survive HMR

---

*Architecture analysis: 2026-01-17*
