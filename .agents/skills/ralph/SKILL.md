---
name: ralph
description: Convert PRD markdown files into prd.json for the Ralph execution loop.
---

# Ralph PRD Converter Skill

Convert PRD markdown files into `prd.json` format for Ralph autonomous execution loop.

## When to Use

- After creating a PRD with the `/prd` skill
- When you have a markdown PRD ready for autonomous implementation
- To prepare tasks for `./scripts/ralph/ralph.sh`

## The Process

### Step 1: Read the PRD
Read the PRD file from `plans/prd-[feature-name].md`

### Step 2: Validate Story Sizing
Ensure each story is completable in ONE Claude Code iteration:

**Right-sized** (single iteration):
- Database schema change
- Single tRPC endpoint
- One UI component
- Adding a filter/query
- Utility function

**Too large** (split these):
- "Build entire dashboard"
- "Add authentication system"
- "Refactor all routers"

### Step 3: Validate Test Coverage
**MANDATORY**: Every tRPC router story MUST have a corresponding integration test story.

If a PRD has backend stories without test stories, REJECT it and ask to add them.

### Step 4: Order by Dependencies
Set priority numbers so dependencies come first:
1. Schema/database changes
2. Backend utilities
3. tRPC endpoints
4. **Integration tests for backend** (MANDATORY - must follow tRPC stories)
5. UI components
6. Integration/polish

### Step 5: Generate prd.json
Create the JSON file with proper structure.

### Step 6: Create Branch
Create and checkout the feature branch.

## JSON Structure

```json
{
  "project": "EdgeJournal",
  "branchName": "ralph/[feature-kebab-case]",
  "description": "Brief feature description",
  "userStories": [
    {
      "id": "US-001",
      "title": "Short descriptive title",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Specific verifiable criterion",
        "Another criterion",
        "Typecheck passes (bun run check)",
        "Build passes (bun run build)"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Field Definitions

| Field | Description |
|-------|-------------|
| `project` | Always "EdgeJournal" |
| `branchName` | `ralph/[feature-name]` format |
| `description` | One-line feature summary |
| `id` | `US-XXX` format, sequential |
| `title` | Short action-oriented title |
| `description` | User story format |
| `acceptanceCriteria` | Array of verifiable criteria |
| `priority` | Execution order (1 = first) |
| `passes` | Start as `false`, Ralph sets to `true` |
| `notes` | Empty string, Ralph fills during execution |

## Acceptance Criteria Requirements

Every story MUST include:
- `"Typecheck passes (bun run check)"`
- `"Build passes (bun run build)"`

UI stories MUST also include:
- `"Verify in browser"`

**Test stories** MUST include:
- `"All tests pass (bun run test)"`

Criteria must be **verifiable**, not vague:
- Good: "TradeScreenshot table exists in schema.ts"
- Bad: "Screenshots work properly"

## Integration Test Story Format

For every tRPC router, include a test story immediately after.

**Reference:** `.claude/skills/testing/SKILL.md` contains complete testing patterns, fixtures, and examples.

```json
{
  "id": "US-XXX",
  "title": "Integration Tests for [Feature] Router",
  "description": "As a developer, I want integration tests for [feature] endpoints to verify correct behavior.",
  "acceptanceCriteria": [
    "Test file created: tests/integration/[feature].test.ts",
    "Uses setupTrader() or setupTraderWithTrades() fixtures",
    "Happy path tested for each procedure",
    "Auth validation tested (unauthorized access rejected)",
    "All tests pass (bun run test)",
    "Typecheck passes (bun run check)"
  ],
  "priority": 4,
  "passes": false,
  "notes": ""
}
```

## EdgeJournal-Specific Criteria

Add these when applicable:
- "Uses protectedProcedure for auth"
- "Constants defined in src/lib/constants/"
- "Follows Terminal design system"
- "Uses existing Shadcn components"
- "Decimal values stored as strings"

## Output

1. **Save**: `scripts/ralph/prd.json`
2. **Archive previous**: If `prd.json` exists with different branch, archive it first
3. **Create branch**: `git checkout -b ralph/[feature-name]`
4. **Initialize progress**: Reset `scripts/ralph/progress.txt` if new feature

## Pre-Save Checklist

- [ ] Each story completable in one iteration
- [ ] Stories ordered by dependencies (priority)
- [ ] All stories have typecheck criterion
- [ ] All stories have build criterion
- [ ] UI stories have browser verification
- [ ] **Backend/tRPC stories have corresponding test story** (MANDATORY)
- [ ] Test stories have "All tests pass" criterion
- [ ] Criteria are specific and verifiable
- [ ] Branch name follows `ralph/[feature]` format
- [ ] No duplicate story IDs

## Running Ralph

After generating `prd.json`:

```bash
# Start autonomous loop (default 10 iterations)
./scripts/ralph/ralph.sh

# Or specify max iterations
./scripts/ralph/ralph.sh 20
```

## Example Conversion

**Input PRD** (`plans/prd-screenshot-upload.md`):
```markdown
### US-001: Add Screenshot Schema
**Acceptance Criteria**:
- [ ] TradeScreenshot table in schema.ts
- [ ] Foreign key to trades table
- [ ] Typecheck passes
- [ ] Build passes
```

**Output JSON** (`scripts/ralph/prd.json`):
```json
{
  "project": "EdgeJournal",
  "branchName": "ralph/screenshot-upload",
  "description": "Add trade screenshot upload functionality",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add Screenshot Schema",
      "description": "As a developer, I want a database schema for trade screenshots so that images can be stored and linked to trades.",
      "acceptanceCriteria": [
        "TradeScreenshot table exists in schema.ts",
        "Foreign key references trades table",
        "Typecheck passes (bun run check)",
        "Build passes (bun run build)"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Debugging Commands

```bash
# View story status
cat scripts/ralph/prd.json | jq '.userStories[] | {id, title, passes}'

# Count remaining stories
cat scripts/ralph/prd.json | jq '[.userStories[] | select(.passes == false)] | length'

# View progress log
cat scripts/ralph/progress.txt
```