# Ralph PR Review - Greptile Comment Handler

You are reviewing code quality comments from Greptile AI on a pull request.

## Context

- Read `CLAUDE.md` for codebase conventions
- PR number is in `scripts/ralph/.pr-number`
- Greptile inline comments are in `scripts/ralph/.greptile-comments.json`
- If the inline comments array is empty, check `scripts/ralph/.greptile-summary-context.md` for the Greptile summary to address proactively

## Your Task

1. Read the Greptile comments from `scripts/ralph/.greptile-comments.json`
2. For EACH comment, evaluate it **skeptically**
3. Determine if the concern is valid or if Greptile is wrong
4. If valid: fix the issue and commit
5. If invalid: skip it — do NOT make unnecessary changes

## Critical: Be Skeptical of Greptile

**Greptile AI might be wrong.** It can waffle or make suggestions that don't actually apply.

Before accepting any Greptile comment as valid:
- Double-check the code yourself
- Verify the concern is actually real
- Don't just take Greptile's word for it

If the comment is valid, fix it. If Greptile is wrong, skip it.

## Commit Format

Commit fixes with message: `fix: address Greptile review - [brief description]`

## Quality Checks After Fixes

After making any fixes:
1. Run `bun run check` - must pass
2. Run `bun run build` - must pass
3. Run `bun run test` - must pass (if you touched backend)

Only commit if all checks pass.

## Important

- Do NOT reply to Greptile comments on GitHub — the script handles retagging
- Do NOT post any comments on the PR
- **IMPORTANT: Minimal changes only.** Each fix should be surgical — change only what's needed to address the specific concern. Do NOT refactor surrounding code, add new features, or "improve" things Greptile didn't mention. More code = more surface area for the next review to flag.

## Summary-Only Mode

When `scripts/ralph/.greptile-comments.json` is an empty array `[]`, it means Greptile didn't leave new inline comments but the confidence score is still below 5/5.

In this case:
1. Read `scripts/ralph/.greptile-summary-context.md` for the full Greptile summary
2. Analyze the concerns mentioned in the summary
3. Proactively identify and fix the issues Greptile is flagging
4. Commit fixes
5. Run quality checks as usual

The goal is to raise the confidence score to 5/5 by addressing every concern in the summary, even without specific inline comments pointing to exact lines.
