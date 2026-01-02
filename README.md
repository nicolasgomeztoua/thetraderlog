# EdgeJournal

A professional trading journal for serious traders who want to consistently find and refine their edge.

## What is EdgeJournal?

EdgeJournal is a data-dense, terminal-inspired trading journal that helps traders track, analyze, and improve their performance. Built for futures and forex traders who take their craft seriously.

### Core Features

- **Trade Logging** — Record entries, exits, stops, targets, and track P&L automatically with proper contract/lot sizing
- **Multi-Account Management** — Track multiple trading accounts including live, demo, and prop firm accounts
- **Prop Firm Tracking** — Monitor challenge progress, drawdown rules, profit targets, and automatically link challenges to funded accounts
- **Analytics Dashboard** — Win rate, profit factor, average win/loss, performance by symbol, time-based analysis
- **AI-Powered Insights** — Chat with your trading data to identify patterns and areas for improvement
- **CSV Import** — Batch import trades from MT4, MT5, ProjectX, and other platforms

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **API** | tRPC v11 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | Clerk |
| **Styling** | Tailwind CSS v4 |
| **Testing** | Vitest + Testcontainers |

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- Docker (for database and testing)
- PostgreSQL (or use the provided Docker script)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd edgejournal

# Install dependencies
bun install

# Start the database
./start-database.sh

# Push the schema to the database
bun run db:push

# Start the development server
bun run dev
```

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/edgejournal"
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

## Project Structure

```
src/
├── app/
│   ├── (marketing)/      # Landing page and public routes
│   ├── (protected)/      # Authenticated app routes
│   │   ├── dashboard/    # Main dashboard
│   │   ├── journal/      # Trade list and details
│   │   ├── analytics/    # Performance analytics
│   │   ├── import/       # CSV import
│   │   ├── ai/           # AI chat interface
│   │   └── settings/     # User settings
│   └── api/
│       └── trpc/         # tRPC API handler
├── server/
│   ├── api/
│   │   ├── routers/      # tRPC routers (trades, accounts, settings, marketData)
│   │   └── trpc.ts       # tRPC initialization and middleware
│   └── db/
│       ├── schema.ts     # Drizzle schema (single source of truth)
│       └── index.ts      # Database connection
├── components/ui/        # Shadcn UI components
└── lib/                  # Utilities (CSV parsers, P&L calculations)

tests/
├── setup/                # Testcontainers and environment setup
├── utils/                # Test utilities and fixtures
└── integration/          # Backend integration tests
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run test` | Run all tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check` | Run Biome linter |

## Documentation

### Project Tracking

- [Roadmap](./ROADMAP.md) — Feature parity roadmap with TradeZella
- [Phase Plans](./plans/) — Detailed implementation plans for each phase
- [Testing Guide](./tests/README.md) — Testing philosophy, fixtures, and conventions

### Claude Code Integration

This project includes [Claude Code](https://claude.com/claude-code) integration for AI-assisted development:

- **[CLAUDE.md](./CLAUDE.md)** — Project context automatically loaded when Claude Code starts

- **Skills** — Specialized guidance in `.claude/skills/`:

  | Skill | Purpose | Documentation |
  |-------|---------|---------------|
  | `frontend-engineer` | Terminal design system, component patterns | `SKILL.md` + `DESIGN_REFERENCE.md` |
  | `architecture` | System architecture, data flow, caching | `SKILL.md` + `MARKET_DATA_REFERENCE.md` |
  | `testing` | Testing patterns, fixtures, conventions | `SKILL.md` + `TESTING_REFERENCE.md` |

Skills provide contextual guidance when working with Claude Code and are automatically invoked based on the type of work being requested.

## Data Model

```
User (Clerk-synced)
 └── Account (demo, live, prop_challenge, prop_funded)
      └── Trade (entries, exits, P&L)
           ├── TradeExecution (partial exits, scale-ins)
           ├── TradeTags
           └── TradeScreenshots
```

Key relationships:
- Users can have multiple accounts
- Prop challenge accounts can be linked to funded accounts when passed
- Trades belong to exactly one account
- Trades support partial exits via executions

## License

Private — All rights reserved.

