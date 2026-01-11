# Ralph Agent Instructions

You are an autonomous coding agent working on the EdgeJournal project.

## Context

- Read `CLAUDE.md` at the project root for codebase conventions and tech stack
- This is a Next.js 15 + tRPC + Drizzle project with Terminal-inspired dark UI
- All code must follow the conventions documented in CLAUDE.md

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. **Read AGENTS.md files** in directories you'll be working in (they contain learnings from past work)
4. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
5. Pick the **highest priority** user story where `passes: false`
6. Implement that single user story
7. Run quality checks: `bun run check` (Biome) and `bun run build` (TypeScript)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD (`scripts/ralph/prd.json`) to set `passes: true` for the completed story
10. **Update AGENTS.md if you learned something** - patterns, gotchas, or decisions worth noting (see Compound Engineering section)
11. Append your progress to `scripts/ralph/progress.txt`

## Progress Report Format

APPEND to scripts/ralph/progress.txt (never replace, always append):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context for future work
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist):

```
## Codebase Patterns
- Use Drizzle ORM for all database operations
- All constants go in src/lib/constants/ (never hardcode)
- Terminal design: monospace fonts, chartreuse accent (#d4ff00)
- Protected routes use tRPC protectedProcedure
```

Only add patterns that are **general and reusable**, not story-specific details.

## Quality Requirements

- ALL commits must pass: `bun run check` and `bun run build`
- **Test stories**: Must also pass `bun run test`
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns from CLAUDE.md
- Use the Terminal design system (dark theme, monospace, data-dense)

## Testing Requirements (CRITICAL)

When implementing a **test story** (title contains "Integration Tests"):

**Read the testing skill first:** `.claude/skills/testing/SKILL.md`

This skill contains:
- Test file structure and patterns
- All available fixtures (`setupTrader()`, `setupTraderWithTrades()`, etc.)
- Domain-specific test examples (accounts, trades, statistics)
- Auth testing patterns

Quick reference:
1. Create test file in `tests/integration/[feature].test.ts`
2. Use `truncateAllTables()` in `beforeAll` and `afterAll`
3. Use `createTestCaller(clerkId, user)` for authenticated calls
4. Use `createUnauthenticatedCaller()` for auth rejection tests
5. Test patterns:
   - Happy path for each procedure
   - Auth validation (reject unauthorized)
   - Edge cases (empty results, invalid inputs)
6. Run `bun run test` and ensure ALL tests pass

Reference existing tests:
- `tests/integration/trades.test.ts`
- `tests/integration/accounts.test.ts`
- `tests/integration/analytics.test.ts`

## EdgeJournal-Specific Guidelines

- Database: Edit `src/server/db/schema.ts`, then `bun run db:push`
- API: Use tRPC routers in `src/server/api/routers/`
- UI: Components in `src/components/ui/` follow Shadcn + Terminal styling
- Constants: Never hardcode - use `src/lib/constants/`
- Styling: Tailwind v4, colors defined in CLAUDE.md

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Compound Engineering (Self-Improving Documentation)

**Read:** `.claude/skills/compound-engineering/SKILL.md`

After completing each story, update the relevant `AGENTS.md` file with learnings:

### AGENTS.md Locations
- `src/server/api/routers/AGENTS.md` - tRPC patterns, auth, queries
- `src/server/db/AGENTS.md` - Schema, migrations, decimal handling
- `src/components/AGENTS.md` - UI patterns, Terminal design
- `tests/AGENTS.md` - Test patterns, fixtures, assertions

### What to Add

**Patterns discovered:**
```markdown
### [Pattern Name]
**When:** [context]
**How:** [brief explanation]
```

**Mistakes made:**
```markdown
### [Gotcha Title]
**Problem:** [what went wrong]
**Solution:** [how to fix/avoid]
```

**Decisions made:**
```markdown
### [Decision]
**Choice:** [what you chose]
**Why:** [rationale]
```

Only add learnings that would help future iterations. If you didn't learn anything new, skip this step.

## Important

- Work on ONE story per iteration
- Commit after each story
- Keep builds green
- Read AGENTS.md files before working in a directory
- Update AGENTS.md files with learnings after completing work
- Read the Codebase Patterns section in progress.txt before starting
- Reference CLAUDE.md for all conventions
