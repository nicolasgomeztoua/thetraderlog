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
10. **Update AGENTS.md if you discovered something NEW** - this is the ONLY place patterns persist across runs (progress.txt gets archived after each run)
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

If you discover a **reusable pattern** that future iterations should know:

1. Add it to the `## Codebase Patterns` section at TOP of progress.txt (helps remaining iterations in THIS run)
2. **ALSO add it to the relevant AGENTS.md file** (persists across ALL future runs)

**CRITICAL:** progress.txt gets archived after each run. AGENTS.md is the permanent record.

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
- **Backend stories**: Must also pass `bun run test` (integration tests)
- **UI stories**: Must also pass `bun run test:e2e` (E2E tests)
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

## E2E Testing Requirements (UI Stories)

When implementing a **UI story** (creates or modifies user-facing components):

**Read the E2E testing skill first:** `.claude/skills/e2e-testing/SKILL.md`

This skill contains:
- `data-testid` naming convention: `[component]-[element]-[qualifier]`
- **Critical:** Playwright strict mode - why vague selectors fail
- Test patterns (authenticated, unauthenticated, forms, loading states)

### Step 1: Add data-testid Attributes

Add `data-testid` to ALL new UI elements:

```tsx
// Headings (tests wait for these)
<h1 data-testid="dashboard-heading-overview">

// Containers/sections
<section data-testid="dashboard-hero-journal">

// Forms
<form data-testid="trade-form">
<input data-testid="trade-form-input-symbol" />
<button data-testid="trade-form-button-submit">

// Loading states - SAME testid on skeleton AND loaded content
if (isLoading) return <div data-testid="feature-section">...skeleton...</div>
return <div data-testid="feature-section">...content...</div>
```

### Step 2: Write E2E Tests (Required)

After implementing UI, add or update E2E tests:

1. Create/update test file: `tests/e2e/[feature].spec.ts`
2. Use `page.getByTestId()` for reliable selectors (never CSS classes)
3. Test the happy path for the new UI
4. Handle loading states by waiting for child elements

```typescript
test("feature works", async ({ page }) => {
  await page.goto("/feature");

  // Wait for page to load
  await expect(page.getByTestId("feature-heading")).toBeVisible();

  // Test interaction
  await page.getByTestId("feature-button-action").click();
  await expect(page.getByTestId("feature-result")).toBeVisible();
});
```

### Step 3: Run E2E Tests

```bash
bun run test:e2e
```

All E2E tests must pass before committing UI stories.

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

**CRITICAL:** AGENTS.md files persist across ALL Ralph runs. progress.txt gets archived when the branch changes.

If you discover a valuable pattern, gotcha, or decision:
- Add to progress.txt → helps remaining iterations in THIS run
- Add to AGENTS.md → helps ALL future runs on ANY branch

Don't duplicate what's already in AGENTS.md. Only add genuinely NEW learnings.

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
