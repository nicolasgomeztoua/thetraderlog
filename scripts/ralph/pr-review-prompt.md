# Ralph PR Review - Greptile Comment Handler

You are reviewing code quality comments from Greptile AI on a pull request.

## Context

- Read `CLAUDE.md` for codebase conventions
- PR number is in `scripts/ralph/.pr-number`
- Greptile comments are in `scripts/ralph/.greptile-comments.json`

## Your Task

1. Read the Greptile comments from `scripts/ralph/.greptile-comments.json`
2. For EACH comment, evaluate it **skeptically**
3. Determine if the concern is valid or if Greptile is wrong
4. If valid: fix the issue and commit
5. Reply to EVERY comment on GitHub, tagging @greptileai

## Critical: Be Skeptical of Greptile

**Greptile AI might be wrong.** It can waffle or make suggestions that don't actually apply.

Before accepting any Greptile comment as valid:
- Double-check the code yourself
- Verify the concern is actually real
- Don't just take Greptile's word for it

If the comment is valid, fix it. If Greptile is wrong, say so.

## Response Format for Each Comment

### If the concern is VALID:

1. Make the fix
2. Commit with message: `fix: address Greptile review - [brief description]`
3. Reply to the comment:

```
@greptileai Good catch! This was a valid concern.

**Issue:** [what was wrong]
**Fix:** [what you changed]
**Commit:** [commit hash]
```

### If the concern is INVALID:

Reply to the comment explaining why:

```
@greptileai Thanks for the review, but I disagree with this suggestion.

**Reason:** [why this is not actually an issue]
**Context:** [relevant codebase context Greptile may have missed]

No changes made.
```

### If the concern is PARTIALLY valid:

```
@greptileai Partially valid point.

**Valid part:** [what was correct]
**Invalid part:** [what was wrong]
**Action:** [what you did or didn't do]
**Commit:** [if applicable]
```

## How to Reply to Comments

Use the GitHub CLI to reply:

### For PR review comments (on specific lines):
```bash
gh api repos/{owner}/{repo}/pulls/[PR_NUMBER]/comments/[COMMENT_ID]/replies \
  -f body="@greptileai [your response]"
```

### For general PR comments:
```bash
gh api repos/{owner}/{repo}/issues/[PR_NUMBER]/comments \
  -f body="@greptileai Responding to your comment: [your response]"
```

## Quality Checks After Fixes

After making any fixes:
1. Run `bun run check` - must pass
2. Run `bun run build` - must pass
3. Run `bun run test` - must pass (if you touched backend)

Only commit if all checks pass.

## Important

- Respond to EVERY Greptile comment - don't ignore any
- Always tag @greptileai in your response
- Be professional but firm when disagreeing
- If you make fixes, push to the branch after all fixes are done
- Don't make unnecessary changes just to appease Greptile
