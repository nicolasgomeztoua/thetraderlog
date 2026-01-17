# Technology Stack

**Analysis Date:** 2025-01-17

## Languages

**Primary:**
- TypeScript 5.8.2 - All application code (strict mode enabled)
  - Compiler target: ES2022
  - Module: ESNext with Bundler resolution
  - Strict settings: `strict`, `noUncheckedIndexedAccess`, `checkJs`, `verbatimModuleSyntax`

**Secondary:**
- JavaScript - Config files only (`next.config.js`, `postcss.config.js`)

## Runtime

**Environment:**
- Bun 1.2.10 - Primary runtime and package manager
- Node.js 20.14.0 - Available for tooling compatibility

**Package Manager:**
- Bun (using `bun.lockb`)
- Lockfile: Present

**Runtime Notes:**
- App runs exclusively on Bun (`bun run --bun next dev`)
- S3 operations use Bun's native S3Client (`src/lib/storage/s3.ts`)
- Tests run on Node.js via Vitest (Testcontainers incompatible with Bun)

## Frameworks

**Core:**
- Next.js 15.2.3 - App Router, Turbopack dev server
  - Config: `next.config.js`
  - Entry: `src/app/` directory
  - Route groups: `(marketing)`, `(protected)`

**API Layer:**
- tRPC v11 - Type-safe API with React Query integration
  - Server: `@trpc/server@11.0.0`
  - Client: `@trpc/client@11.0.0`, `@trpc/react-query@11.0.0`
  - Config: `src/server/api/trpc.ts`
  - Routers: `src/server/api/routers/`

**State Management:**
- TanStack React Query 5.69.0 - Server state via tRPC
- Zustand 5.0.9 - Client-side state

**Form Handling:**
- React Hook Form 7.68.0 + Zod 4.1.13 resolvers
- Zod for all validation (backend and frontend)

**Testing:**
- Vitest 4.0.16 - Test runner
- Testcontainers 11.10.0 - Real PostgreSQL for integration tests
- Config: `vitest.config.ts`

**Build/Dev:**
- Turbopack - Next.js dev server (via `--turbo` flag)
- Drizzle Kit 0.30.5 - Database migrations
- tsx 4.21.0 - TypeScript execution for scripts

## Key Dependencies

**Critical:**
- `next@15.2.3` - Framework core
- `drizzle-orm@0.41.0` - Database ORM
- `postgres@3.4.4` - PostgreSQL driver (postgres.js)
- `@clerk/nextjs@6.36.0` - Authentication
- `zod@4.1.13` - Schema validation

**UI Framework:**
- `react@19.0.0`, `react-dom@19.0.0` - React 19
- `tailwindcss@4.0.15` - Styling (v4 with `@tailwindcss/postcss`)
- `class-variance-authority@0.7.1` - Component variants
- `clsx@2.1.1`, `tailwind-merge@3.4.0` - Class utilities
- `lucide-react@0.556.0` - Icons

**Radix UI Primitives:**
- Dialog, Dropdown Menu, Popover, Select, Tabs, Tooltip, etc.
- All @radix-ui/* packages for accessible components

**Rich Text:**
- Tiptap suite (`@tiptap/react@3.15.3`, `@tiptap/starter-kit@3.15.3`)
- Extensions: Image, Link, Task Lists, Placeholder, Bubble/Floating menus

**Charts:**
- `ag-charts-react@12.3.1` - Analytics charts
- `lightweight-charts@5.1.0` - Trading charts (candlestick)

**Background Jobs:**
- `@trigger.dev/sdk@4.3.2` - Background task processing
- Config: `trigger.config.ts`
- Tasks: `src/trigger/`

**Date/Time:**
- `date-fns@4.1.0`, `date-fns-tz@3.2.0` - Date utilities
- `react-day-picker@9.13.0` - Date picker component

**Infrastructure:**
- `superjson@2.2.1` - tRPC serialization
- `@t3-oss/env-nextjs@0.12.0` - Environment variable validation
- `svix@1.82.0` - Webhook verification (Clerk webhooks)
- `nanoid@5.1.6` - ID generation

## Configuration

**Environment:**
- Validation: `src/env.js` using @t3-oss/env-nextjs + Zod
- Required server vars: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `TWELVE_DATA_API_KEY`, `DATABENTO_API_KEY`, `TRIGGER_SECRET_KEY`
- Required S3 vars: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`
- Optional: `S3_PUBLIC_URL`
- Client vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, Clerk redirect URLs

**TypeScript:**
- Config: `tsconfig.json`
- Path alias: `@/*` maps to `./src/*`
- Strict mode with `noUncheckedIndexedAccess`

**Code Quality:**
- Biome 2.2.5 - Linting and formatting
- Config: `biome.jsonc`
- Features: Auto import organization, sorted classes (Tailwind), recommended rules
- Run: `bun run check` (lint), `bun run check:write` (fix)

**Database:**
- Config: `drizzle.config.ts`
- Schema: `src/server/db/schema.ts`
- Commands: `bun run db:push` (sync), `bun run db:studio` (GUI)

**PostCSS:**
- Config: `postcss.config.js`
- Plugin: `@tailwindcss/postcss` (Tailwind v4)

## Platform Requirements

**Development:**
- Bun 1.x (1.2.10 confirmed)
- Docker (for Testcontainers during tests)
- PostgreSQL (via Docker or local)

**Production:**
- Bun runtime
- PostgreSQL database
- S3-compatible storage (Cloudflare R2, AWS S3, etc.)
- Clerk account (authentication)
- Trigger.dev account (background jobs)
- Databento API access (futures market data)
- Twelve Data API access (forex/crypto market data)

---

*Stack analysis: 2025-01-17*
