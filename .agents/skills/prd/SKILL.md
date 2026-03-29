---
name: prd
description: Generate structured PRDs with right-sized user stories for implementation.
---

# PRD Generator Skill

Generate detailed Product Requirements Documents through structured Q&A, producing right-sized user stories suitable for Ralph autonomous execution.

## When to Use

- Starting a new feature implementation
- Breaking down a large feature into implementable chunks
- Creating a task list for Ralph autonomous loop
- Documenting requirements before coding

## The Process

### Step 1: Receive Feature Description
User provides a high-level feature description or idea.

### Step 2: Ask Clarifying Questions
Ask 3-5 essential questions with lettered options (A, B, C, D) to understand:

- **Problem/Goal**: What does this solve? Why is it needed?
- **Core Functionality**: What are the key actions/behaviors?
- **Scope/Boundaries**: What should it NOT do?
- **Success Criteria**: How do we know it's done?
- **UI/UX**: Any specific design requirements? (Terminal design system)

User can respond efficiently: "1A, 2C, 3B"

### Step 3: Generate PRD
Create a comprehensive PRD based on answers.

### Step 4: Save
Save to `plans/prd-[feature-name].md`

**Important**: Do NOT start implementing - only create the PRD.

## PRD Structure

```markdown
# PRD: [Feature Name]

## Overview
Brief description of the feature and problem it solves.

## Goals
- Specific, measurable objective 1
- Specific, measurable objective 2

## User Stories

### US-001: [Title]
**Description**: As a [user], I want [feature] so that [benefit].

**Acceptance Criteria**:
- [ ] Specific verifiable criterion
- [ ] Another criterion
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] [UI stories] Verify in browser

### US-002: [Title]
...

## Functional Requirements
1. FR-001: [Explicit requirement]
2. FR-002: [Another requirement]

## Non-Goals (Out of Scope)
- What this feature will NOT do
- Explicit boundaries

## Technical Considerations
- Database changes needed (schema.ts)
- API changes (tRPC routers)
- UI components
- Integration with existing systems

## Design Considerations
- Terminal design system compliance
- Colors: Chartreuse #d4ff00, Ice Blue #00d4ff
- Monospace fonts for interactive elements
- Data-dense layouts

## Success Metrics
- How we measure success

## Open Questions
- Any unresolved decisions
```

## Story Sizing (Critical for Ralph)

Each user story MUST be completable in a single Claude Code iteration. Ralph spawns fresh instances without memory of prior work.

### Right-Sized Stories (Good)
- Add database column to schema
- Create single UI component
- Implement one tRPC endpoint
- Add filter to existing query
- Create utility function

### Too-Large Stories (Split These)
- "Build entire dashboard" → Split into individual widgets
- "Add authentication" → Split into sign-up, sign-in, session, etc.
- "Refactor the API" → Split by endpoint/router

## Story Ordering

Order by dependencies (priority number):
1. **Pre-implementation audit** (for features with calculations/utilities)
2. Schema/database changes
3. Backend logic (tRPC routers, utilities)
4. **Integration tests for backend changes** (MANDATORY)
5. UI components using the backend
6. **E2E tests for UI changes** (MANDATORY)
7. Integration/polish

## Pre-Implementation Audit (MANDATORY for calculation-heavy features)

**Any feature involving calculations, data transformations, or utilities MUST start with an audit story.**

This prevents duplicate code and ensures we reuse existing utilities. Without this, AI tends to write new local helpers instead of reusing existing shared code.

### When to Include Audit Story (US-000)

Include when the feature involves:
- P&L calculations
- Price/tick/pip conversions
- Date/time formatting or manipulation
- Currency formatting
- Any mathematical calculations
- Data transformations that might exist elsewhere
- Running totals, aggregations, or series data

### Audit Story Template

```markdown
### US-000: Audit Existing Utilities for [Feature]
**Description**: As a developer, I want to audit existing code before implementing [feature] so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for existing relevant utilities
- [ ] Search components/routers for local helpers doing similar work
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - Existing utilities to reuse (with file:line)
  - Local helpers to extract (with file:line)
  - New utilities needed
- [ ] If local helpers found that should be shared, add extraction story
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
# Search for relevant exported functions
grep -rn "export function" src/lib/ | grep -i "[keyword]"

# Search for local helpers in components/hooks
grep -rn "^function\|^const.*=" src/components/ src/server/api/routers/ | grep -i "[keyword]"

# Check for existing calculations
grep -rn "calculate\|compute" src/lib/trades/ src/lib/market-data/ src/lib/analytics/
```
```

### Example: Running P&L Feature

For a "Running P&L Chart" feature, the audit would find:
- `calculateFuturesPnL()` in `src/lib/market-data/symbols.ts` ✅ Reuse
- `calculateRunningPnl()` in `use-replay-engine.ts` ⚠️ Local helper, extract to shared lib
- No existing `generateRunningPnlSeries()` → Need to create

## Testing Requirements (MANDATORY)

### Backend: Integration Tests

**Any feature that touches tRPC routers MUST include integration tests.**

This is non-negotiable. Every backend change requires a corresponding test story that:
- Uses Testcontainers (real PostgreSQL, not mocks)
- Tests actual tRPC procedures via `createCallerFactory`
- Validates happy path and error cases
- Runs with `bun run test`

### Frontend: E2E Tests (Playwright)

**Any feature that creates or modifies UI MUST include E2E tests.**

This is non-negotiable. Every UI story requires:
- Playwright tests in `tests/e2e/[feature].spec.ts`
- `data-testid` attributes on all new UI elements
- Tests for happy path user flows
- Runs with `bun run test:e2e`

**Reference:** `.claude/skills/e2e-testing/SKILL.md` for Playwright patterns.

### Test Story Pattern

For each tRPC router/endpoint story, add a follow-up test story.

**Reference:** `.claude/skills/testing/SKILL.md` contains complete testing patterns, fixtures, and examples.

```markdown
### US-XXX: Integration Tests for [Feature] Router
**Description**: As a developer, I want integration tests for the [feature] endpoints so that we can verify correct behavior and prevent regressions.

**Acceptance Criteria**:
- [ ] Test file created: tests/integration/[feature].test.ts
- [ ] Tests use setupTrader() or setupTraderWithTrades() fixtures
- [ ] Happy path tested for each procedure
- [ ] Auth validation tested (unauthorized access rejected)
- [ ] Edge cases covered (empty results, invalid inputs)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)
```

### What to Test

| Procedure Type | Test Coverage |
|----------------|---------------|
| Queries | Returns correct data, respects filters, handles empty results |
| Mutations | Creates/updates correctly, validates ownership, returns updated record |
| Auth | Rejects unauthenticated requests, validates user owns resource |

### Test File Location

All integration tests go in `tests/integration/[feature].test.ts`

Reference existing tests for patterns:
- `tests/integration/trades.test.ts`
- `tests/integration/accounts.test.ts`
- `tests/integration/analytics.test.ts`

### E2E Test Story Pattern

For each UI story, add a follow-up E2E test story:

```markdown
### US-XXX: E2E Tests for [Feature] UI
**Description**: As a developer, I want E2E tests for the [feature] UI so that we can verify user flows work correctly.

**Acceptance Criteria**:
- [ ] Test file created: tests/e2e/[feature].spec.ts
- [ ] All new UI elements have data-testid attributes
- [ ] Happy path user flow tested
- [ ] Loading states handled (wait for content)
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)
```

### E2E Test File Location

All E2E tests go in `tests/e2e/[feature].spec.ts`

Reference existing tests for patterns:
- `tests/e2e/dashboard.spec.ts`
- `tests/e2e/journal.spec.ts`

## TheTraderLog-Specific Checklist

For each story, verify:
- [ ] Follows Terminal design system (CLAUDE.md)
- [ ] Constants in `src/lib/constants/` (never hardcoded)
- [ ] Uses existing patterns from codebase
- [ ] tRPC procedures use `protectedProcedure`
- [ ] Includes typecheck criterion
- [ ] Includes build criterion
- [ ] UI stories include browser verification
- [ ] **Backend stories have corresponding integration test story** (MANDATORY)
- [ ] **UI stories have corresponding E2E test story** (MANDATORY)

## Example PRD

```markdown
# PRD: Trade Screenshot Upload

## Overview
Allow traders to attach screenshots to trades for visual documentation of setups and outcomes.

## Goals
- Enable image uploads attached to trades
- Display screenshots in trade detail view
- Support multiple screenshots per trade

## User Stories

### US-001: Add Screenshot Schema
**Description**: As a developer, I want a database schema for trade screenshots so that images can be stored and linked to trades.

**Acceptance Criteria**:
- [ ] TradeScreenshot table in schema.ts
- [ ] Foreign key to trades table
- [ ] Fields: id, tradeId, url, caption, createdAt
- [ ] Typecheck passes
- [ ] Build passes

### US-002: Create Upload tRPC Endpoint
**Description**: As a frontend, I want an API endpoint to upload screenshots so that users can attach images to trades.

**Acceptance Criteria**:
- [ ] screenshots.upload mutation in tRPC
- [ ] Validates trade ownership
- [ ] Returns screenshot record
- [ ] Typecheck passes
- [ ] Build passes

### US-003: Integration Tests for Screenshots Router
**Description**: As a developer, I want integration tests for the screenshots endpoints so that we can verify correct behavior.

**Acceptance Criteria**:
- [ ] Test file: tests/integration/screenshots.test.ts
- [ ] Tests upload mutation with valid trade
- [ ] Tests upload rejects invalid trade ownership
- [ ] Tests listing screenshots for a trade
- [ ] All tests pass (bun run test)
- [ ] Typecheck passes

### US-004: Trade Detail Screenshot Display
**Description**: As a trader, I want to see screenshots on the trade detail page so that I can review my visual documentation.

**Acceptance Criteria**:
- [ ] Screenshot gallery component
- [ ] Displays in trade detail view
- [ ] Shows caption on hover
- [ ] Terminal design styling
- [ ] Typecheck passes
- [ ] Build passes
- [ ] Verify in browser

### US-005: E2E Tests for Screenshot UI
**Description**: As a developer, I want E2E tests for the screenshot gallery so that we can verify the UI works correctly.

**Acceptance Criteria**:
- [ ] Test file: tests/e2e/screenshots.spec.ts
- [ ] Tests screenshot gallery displays on trade detail
- [ ] Tests upload flow (if applicable)
- [ ] All UI elements have data-testid attributes
- [ ] All tests pass (bun run test:e2e)
- [ ] Typecheck passes

## Non-Goals
- Image editing/cropping
- Video uploads
- Public sharing

## Technical Considerations
- Use external storage (S3/Cloudflare R2)
- Signed URLs for security
- Lazy loading for performance
```

## Output

Save PRD to: `plans/prd-[feature-name].md`

After creating the PRD, suggest running the `/ralph` skill to convert it to `prd.json` for autonomous execution.