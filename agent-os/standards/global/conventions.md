## Development Conventions

EdgeJournal-specific conventions for day-to-day development workflow.

### Project Structure
- **Monorepo Layout**: Single Next.js app with clear separation
  - `src/app/` - Routes (marketing and protected sections)
  - `src/server/` - Backend API and database
  - `src/components/` - Reusable UI components
  - `src/lib/` - Utilities and shared logic
  - `tests/` - Integration tests with real database

### Documentation
- **CLAUDE.md**: Main project documentation (architecture, conventions, commands)
- **tests/README.md**: Testing philosophy and patterns
- **Component Comments**: Minimal comments, self-documenting code preferred
- **Skills**: AI agent guides in `.claude/skills/` for specialized contexts

### Database Schema Management
- **Single Source of Truth**: `src/server/db/schema.ts` defines the database schema
- **No Migration Files**: Use `bun run db:push` to sync schema changes to database
- **Drizzle Studio**: `bun run db:studio` to inspect/edit data in GUI
- **Testing**: Testcontainers pushes schema to fresh PostgreSQL on test startup

### Environment Variables
Required in `.env` (never commit):
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk backend key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `DATABENTO_API_KEY` - Futures market data
- `TWELVE_DATA_API_KEY` - Forex/crypto market data

### Git & Version Control
- **Commit Messages**: Descriptive, imperative mood (e.g., "Add trade filtering", "Fix P&L calculation")
- **Branch Strategy**: Feature branches merged to `main`
- **Co-authored Commits**: Claude-assisted commits include co-author attribution

### Dependency Management
- **Package Manager**: Bun only (no npm/yarn/pnpm)
- **Lock File**: `bun.lockb` committed to repository
- **Updates**: Keep dependencies current, test thoroughly
- **Key Dependencies**: tRPC, Drizzle, Next.js, Tailwind, Clerk

### Testing Requirements
- **Integration Tests Required**: All tRPC routers have integration test coverage
- **Real Database**: Testcontainers PostgreSQL (not mocks or SQLite)
- **Test Philosophy**: Test trading behavior, not implementation details
- **Run Before Commit**: `bun run test` should pass

### Code Review & Quality
- **Biome Checks**: `bun run check` must pass
- **TypeScript**: No type errors (`bun run build`)
- **Self-Review**: Review your own changes before committing
- **PR Descriptions**: Clear description of what changed and why

### Development Workflow
1. Make schema changes in `src/server/db/schema.ts`
2. Run `bun run db:push` to sync to database
3. Update tRPC routers if needed
4. Add/update tests in `tests/integration/`
5. Run `bun run test` and `bun run check`
6. Commit with descriptive message

### Feature Development
- **Incremental**: Build features incrementally, commit working states
- **No Long-Lived Branches**: Merge frequently to avoid drift
- **Testing**: Write integration tests that cover the trading domain logic
- **Type Safety**: Leverage tRPC's end-to-end type safety
