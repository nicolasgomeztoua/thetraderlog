# Ralph Code Quality Review

You are performing a code quality review before creating a PR.

## Context

- Read `CLAUDE.md` for codebase conventions
- PRD is in `scripts/ralph/prd.json` - check what was implemented
- This runs after all stories are complete, before PR creation

## Your Task

Review ALL code changes made during this Ralph run for:
1. **Security issues**
2. **Code consistency / AI slop**
3. **General quality**

Fix any issues found, commit with descriptive messages.

## Step 1: Identify Changed Files

```bash
git diff main --name-only
```

Review each changed file.

## Step 2: Security Audit

Read and follow: `.claude/skills/security-audit/SKILL.md`

Key checks:
- SQL injection (user input in queries)
- XSS (unsanitized rendering)
- Auth bypass (missing `protectedProcedure`)
- Hardcoded secrets
- Input validation

## Step 3: Consistency Audit (Run Thoroughly)

Read and follow: `.claude/skills/consistency-audit/SKILL.md`

**IMPORTANT**: This is the most common source of tech debt. Run ALL phases including Phase 3b.

Key checks:
- Duplicate calculations (same logic in multiple places)
- Hardcoded constants (should be in `src/lib/constants/`)
- Inconsistent patterns (not matching existing code)
- Unnecessary complexity

### Critical: Local Helper Extraction Check

Run these commands to find local helpers that should be shared:

```bash
# Find local calculate/format functions in changed files
git diff main --name-only | xargs grep -l "function calculate\|function format\|function compute\|function get" 2>/dev/null

# Compare against existing lib exports
grep -rn "^export function calculate\|^export function format" src/lib/

# Check if new code duplicates existing utilities
git diff main -- "*.ts" "*.tsx" | grep "^+.*calculate\|^+.*compute" | head -20
```

If you find:
- Local function with same name as lib/ export → Import instead of redefine
- Local calculation function → Consider extracting to `src/lib/`
- Multiple similar local helpers → Consolidate to shared utility

## Step 4: General Quality

- Are there any obvious bugs?
- Is error handling appropriate?
- Are types correct?
- Does the code match CLAUDE.md conventions?

## Fixing Issues

For each issue found:

1. Fix the issue
2. Run quality checks:
   ```bash
   bun run check
   bun run build
   bun run test  # if backend changed
   ```
3. Commit with descriptive message:
   ```
   fix: [security|consistency|quality] - brief description
   ```

## Output

After review, summarize:
- Issues found and fixed
- Issues found but intentionally left (with justification)
- Checks that passed

Don't create a report file - just fix issues and commit.

## Important

- Fix real issues, don't nitpick
- Keep changes minimal and focused
- All commits must pass `bun run check` and `bun run build`
- If you find no issues, that's fine - just confirm the review passed
