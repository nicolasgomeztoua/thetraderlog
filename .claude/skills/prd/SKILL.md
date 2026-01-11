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
1. Schema/database changes
2. Backend logic (tRPC routers, utilities)
3. **Integration tests for backend changes** (MANDATORY)
4. UI components using the backend
5. Integration/polish

## Testing Requirements (MANDATORY)

**Any feature that touches tRPC routers MUST include integration tests.**

This is non-negotiable. Every backend change requires a corresponding test story that:
- Uses Testcontainers (real PostgreSQL, not mocks)
- Tests actual tRPC procedures via `createCallerFactory`
- Validates happy path and error cases
- Runs with `bun run test`

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

## EdgeJournal-Specific Checklist

For each story, verify:
- [ ] Follows Terminal design system (CLAUDE.md)
- [ ] Constants in `src/lib/constants/` (never hardcoded)
- [ ] Uses existing patterns from codebase
- [ ] tRPC procedures use `protectedProcedure`
- [ ] Includes typecheck criterion
- [ ] Includes build criterion
- [ ] UI stories include browser verification
- [ ] **Backend stories have corresponding test story** (MANDATORY)

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