## Tech Stack

EdgeJournal's technology stack is optimized for building a high-performance trading journal with real-time data processing and analytics.

### Framework & Runtime
- **Application Framework:** Next.js 15 (App Router with Turbopack)
- **Language:** TypeScript (strict mode enabled)
- **Package Manager:** Bun (fast JavaScript runtime and package manager)

### Frontend
- **UI Framework:** React 18+ (via Next.js)
- **CSS Framework:** Tailwind CSS v4
- **UI Components:** shadcn/ui (customized for Terminal Design System)
- **Fonts:** JetBrains Mono (monospace), Geist Sans

### Backend & API
- **API Layer:** tRPC v11 (type-safe API without code generation)
- **Database:** PostgreSQL 15+
- **ORM:** Drizzle ORM (type-safe SQL with zero runtime overhead)
- **Schema Management:** Drizzle Kit (push-based schema migrations)

### Authentication & Authorization
- **Authentication:** Clerk (user management with auto-sync to database)
- **Authorization:** User ownership validation in tRPC middleware

### Data & External Services
- **Market Data:**
  - Databento API (futures: ES, NQ, etc.)
  - Twelve Data API (forex, crypto)
- **Background Jobs:** Trigger.dev (for MAE/MFE calculation, batch processing)

### Testing & Quality
- **Test Framework:** Vitest (fast unit and integration testing)
- **Test Database:** Testcontainers (real PostgreSQL in tests, not mocks)
- **Linting/Formatting:** Biome (fast, unified linting and formatting tool)
- **Type Checking:** TypeScript strict mode with `noUncheckedIndexedAccess`

### Development Tools
- **Database GUI:** Drizzle Studio
- **Commands:** Custom Bun scripts (dev, build, test, db:push, db:studio)

### Key Architecture Decisions
- **No traditional REST API** - tRPC provides end-to-end type safety
- **No migration files** - `schema.ts` is single source of truth, pushed to DB
- **Real database in tests** - Testcontainers ensures production-like testing
- **Terminal Design System** - Monospace-first UI for data-dense trading interface
