# EdgeJournal

A professional trading journal for futures traders. Terminal-inspired dark UI, data-dense analytics, and AI-powered insights.

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
- Use absolute imports from `@/` (maps to `src/`)

### Constants
- **NEVER hardcode constants** in UI components or backend routers
- All shared constants belong in `src/lib/constants/` (create domain-specific files)
- Examples: trading sessions, day labels, hour ranges, filter options, preset values
- Export as named constants with clear naming: `TRADING_SESSIONS`, `DAY_LABELS`, `QUICK_DATE_PRESETS`
- **Error messages** live in `src/lib/constants/errors.ts` — never hardcode error strings
- Use `ERR_` prefix for static messages, `err` prefix for dynamic template functions
- Frontend catch blocks: use `getErrorMessage(error, ERR_FALLBACK)` from `@/lib/shared/utils`
- This ensures single source of truth and easy updates across the codebase

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

## Documentation

Reference documentation is organized in `.claude/skills/` for AI-assisted development:

| Topic | Skill | Full Reference |
|-------|-------|----------------|
| Design System | `.claude/skills/frontend/SKILL.md` | `.claude/skills/frontend/DESIGN_REFERENCE.md` |
| Architecture | `.claude/skills/architecture/SKILL.md` | `.claude/skills/architecture/MARKET_DATA_REFERENCE.md` |
| Testing | `.claude/skills/testing/SKILL.md` | `.claude/skills/testing/TESTING_REFERENCE.md` |
| Planning | `.claude/skills/planning/SKILL.md` | - |
| Code Quality | `.claude/skills/consistency-audit/SKILL.md` | - |
| PRD Generation | `.claude/skills/prd/SKILL.md` | - |
| UX Design | `.claude/skills/ux/SKILL.md` | `.claude/skills/ux/UX_REFERENCE.md` |
| Ralph Converter | `.claude/skills/ralph/SKILL.md` | - |
| Compound Engineering | `.claude/skills/compound-engineering/SKILL.md` | - |

Other documentation:
- [Testing README](./tests/README.md) - Quick testing overview
- [Roadmap](./ROADMAP.md) - Feature parity roadmap
- [Phase Plans](./plans/) - Detailed implementation plans

## Skills

Claude Code skills provide contextual guidance when invoked:

| Skill | Purpose |
|-------|---------|
| `frontend` | Terminal design system, component patterns, Tailwind styling |
| `architecture` | System architecture, data flow, market data caching |
| `testing` | Testing patterns, fixtures, database testing |
| `planning` | Interview-based planning to collaboratively design features through Q&A |
| `consistency-audit` | Detect duplicated calculations, repeated utilities, AI slop |
| `prd` | Generate PRDs with right-sized user stories for autonomous execution |
| `ux` | 3-step UX workflow: Lite PRD → Clarifier → UX Spec → Build Prompts |
| `ralph` | Convert PRD markdown to prd.json for Ralph autonomous loop |
| `compound-engineering` | Self-improving documentation via AGENTS.md files |

Skills are automatically suggested based on the type of work you're doing.

## Ralph Autonomous Loop

Ralph is an autonomous AI agent loop that executes PRD user stories one at a time, then creates a PR and handles Greptile AI code review. Based on [snarktank/ralph](https://github.com/snarktank/ralph), adapted for Claude Code.

### Quick Start

```bash
# 1. Create a PRD (use /prd skill or manually)
# 2. Convert to JSON (use /ralph skill or manually)
cp scripts/ralph/prd.example.json scripts/ralph/prd.json
# Edit prd.json with your stories

# 3. Run Ralph
./scripts/ralph/ralph.sh              # Default: 20 impl iterations, 10 PR review cycles
./scripts/ralph/ralph.sh 30           # 30 impl iterations, 10 PR review cycles
./scripts/ralph/ralph.sh 30 5         # 30 impl iterations, 5 PR review cycles
```

### Workflow Phases

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Implementation Loop                                │
│   - Pick highest priority story with passes: false          │
│   - Implement, test, commit                                 │
│   - Update prd.json, repeat until all complete              │
├─────────────────────────────────────────────────────────────┤
│ PHASE 2: Code Quality Review                                │
│   - Security audit (uses security-audit skill)              │
│   - Consistency audit (uses consistency-audit skill)        │
│   - Fix issues, commit                                      │
├─────────────────────────────────────────────────────────────┤
│ PHASE 3: Create Pull Request                                │
│   - Push branch to remote                                   │
│   - Create PR with summary from prd.json                    │
├─────────────────────────────────────────────────────────────┤
│ PHASE 4: Score-Driven Greptile Review Loop                   │
│   - Poll for Greptile summary (30s intervals, 10min timeout)│
│   - Target: Confidence Score 5/5                            │
│   - Fix inline comments + summary-only concerns             │
│   - Tag @greptileai to trigger re-review after fixes        │
└─────────────────────────────────────────────────────────────┘
```

### Files

| File | Purpose |
|------|---------|
| `scripts/ralph/ralph.sh` | Main orchestration loop (4 phases) |
| `scripts/ralph/prompt.md` | Instructions for implementation iterations |
| `scripts/ralph/code-review-prompt.md` | Instructions for security & consistency audit |
| `scripts/ralph/pr-review-prompt.md` | Instructions for Greptile review handling |
| `scripts/ralph/prd.json` | Your task manifest (create from example) |
| `scripts/ralph/progress.txt` | Persistent learnings between iterations |
| `scripts/ralph/prd.example.json` | Template for PRD format |

### Story Sizing

Each story must complete in ONE iteration. Right-sized examples:
- Add database column
- Create tRPC endpoint
- Build single UI component
- Write integration tests

Too large (split these):
- "Build entire dashboard"
- "Add authentication"

### Compound Engineering (Self-Improving)

Ralph reads and updates `AGENTS.md` files in core directories:

| Directory | AGENTS.md Contains |
|-----------|-------------------|
| `src/server/api/routers/` | tRPC patterns, auth, query gotchas |
| `src/server/db/` | Schema patterns, decimal handling |
| `src/components/` | UI patterns, Terminal design |
| `tests/` | Test patterns, fixtures |

After each story, Ralph adds learnings (patterns, mistakes, decisions) so future iterations benefit.

### Greptile Review Handling

Ralph uses a **score-driven review loop** targeting Confidence Score 5/5:
- **Polls every 30s** for Greptile's summary comment (10min timeout per cycle)
- **Evaluates skeptically** - Greptile can be wrong
- **Fixes valid issues** - commits with `fix: address Greptile review`
- **Summary-only mode** - when no inline comments but score < 5, reads summary context to proactively fix flagged concerns
- **Tags @greptileai** after each fix cycle to trigger re-review
- **Exits early** when score reaches 5/5

### Debugging

```bash
# View story status
cat scripts/ralph/prd.json | jq '.userStories[] | {id, title, passes}'

# Check progress
cat scripts/ralph/progress.txt

# Check PR number
cat scripts/ralph/.pr-number

# View processed Greptile comments
cat scripts/ralph/.processed-comments

# Recent commits
git log --oneline -10
```
