# EdgeJournal

A professional trading journal for futures and forex traders. Terminal-inspired dark UI, data-dense analytics, and AI-powered insights.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| API | tRPC v11 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + Testcontainers |
| Package Manager | Bun |

## Key Files & Directories

```
src/
├── app/
│   ├── (marketing)/           # Landing page, public routes
│   ├── (protected)/           # Authenticated app (dashboard, journal, analytics, ai)
│   └── api/trpc/              # tRPC API handler
├── server/
│   ├── api/routers/           # tRPC routers: accounts, trades, analytics, marketData, strategies, tags
│   ├── api/trpc.ts            # tRPC initialization, middleware, context
│   └── db/
│       ├── schema.ts          # Drizzle schema (SINGLE SOURCE OF TRUTH for data model)
│       └── index.ts           # Database connection
├── components/ui/             # Shadcn UI components (styled to match Terminal design)
└── lib/                       # Utilities (CSV parsers, P&L calculations, market data service)

tests/
├── setup/                     # Testcontainers PostgreSQL setup
├── utils/                     # Test fixtures, helpers, caller factory
└── integration/               # Backend integration tests
```

## Data Model

```
User (Clerk-synced)
 └── Account (demo | live | prop_challenge | prop_funded)
      └── Trade (entries, exits, P&L)
           ├── TradeExecution (partial exits, scale-ins)
           ├── TradeTags
           └── TradeScreenshots
```

- Users can have multiple accounts
- Prop challenge accounts link to funded accounts when passed
- Trades support partial exits via TradeExecution records
- All P&L uses decimal precision (8 decimal places)

## Conventions

### Code Style
- **Biome** for linting/formatting (`bun run check`)
- No non-null assertions (`!`) - use nullish coalescing with safe defaults
- Prefer `const` over `let`, avoid `var`
- Use absolute imports from `~/` (maps to `src/`)

### Database
- Schema changes: Edit `src/server/db/schema.ts`, then `bun run db:push`
- Decimals stored as strings, parse with `parseFloat()` for comparisons
- Enums enforced at DB level (trade direction, status, account type)

### API (tRPC)
- All mutations require authentication (enforced by `protectedProcedure`)
- User ownership validated in middleware - never trust client-provided userId
- Return full objects from mutations for optimistic updates

### Testing
- Real PostgreSQL via Testcontainers (not mocks)
- Test trading behavior, not implementation details
- Use fixtures: `createTestUser()`, `setupTrader()`, `setupTraderWithTrades()`
- Truncate tables in `beforeAll` and `afterAll`

### Styling (Terminal Design System)
- Dark theme only (`bg-background: #050505`)
- Primary accent: Electric Chartreuse (`#d4ff00`)
- Secondary accent: Ice Blue (`#00d4ff`) for AI features
- Monospace (`font-mono`) for ALL interactive elements (buttons, labels, nav)
- Data colors: Profit green (`#00ff88`), Loss red (`#ff3b3b`)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with Turbopack |
| `bun run build` | Production build |
| `bun run test` | Run all tests |
| `bun run test:watch` | Tests in watch mode |
| `bun run db:push` | Push schema changes |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check` | Run Biome linter |

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk backend key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `DATABENTO_API_KEY` - For futures market data (ES, NQ, etc.)
- `TWELVE_DATA_API_KEY` - For forex/crypto market data

## Documentation

Reference documentation is organized in `.claude/skills/` for AI-assisted development:

| Topic | Skill | Full Reference |
|-------|-------|----------------|
| Design System | `.claude/skills/frontend-engineer/SKILL.md` | `.claude/skills/frontend-engineer/DESIGN_REFERENCE.md` |
| Architecture | `.claude/skills/architecture/SKILL.md` | `.claude/skills/architecture/MARKET_DATA_REFERENCE.md` |
| Testing | `.claude/skills/testing/SKILL.md` | `.claude/skills/testing/TESTING_REFERENCE.md` |
| Planning | `.claude/skills/planning/SKILL.md` | - |

Other documentation:
- [Testing README](./tests/README.md) - Quick testing overview
- [Roadmap](./ROADMAP.md) - Feature parity roadmap
- [Phase Plans](./plans/) - Detailed implementation plans

## Skills

Claude Code skills provide contextual guidance when invoked:

| Skill | Purpose |
|-------|---------|
| `frontend-engineer` | Terminal design system, component patterns, Tailwind styling |
| `architecture` | System architecture, data flow, market data caching |
| `testing` | Testing patterns, fixtures, database testing |
| `planning` | Interview-based planning to collaboratively design features through Q&A |

Skills are automatically suggested based on the type of work you're doing.
