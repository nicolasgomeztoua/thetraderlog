# Ralph Review Evaluator

You are evaluating Greptile's latest response to determine if the PR review is complete.

## Context

- Read `scripts/ralph/.greptile-latest-response.md` — this is Greptile's most recent reply
- Read `scripts/ralph/.fix-summary.md` — these are the fixes that were applied

## Your Task

Read Greptile's response and determine: **Is Greptile satisfied, or does it have remaining concerns?**

### Signals that Greptile is SATISFIED (approve):
- Says "all resolved", "all addressed", "looks good", "nice work", "ready to merge"
- Confirms fixes are correct with checkmarks or positive language
- No new issues or concerns raised
- Score updated to 5/5
- General praise without flagging new problems

### Signals that Greptile has REMAINING CONCERNS (continue):
- Flags new bugs, issues, or concerns
- Says "one more thing", "remaining issue", "should also fix"
- Points out code that still needs changes
- Asks questions that imply something is wrong
- Gives a score below 5/5 with specific reasons

## Output

After your analysis, you MUST output exactly one of these XML tags at the very end of your response:

If Greptile is satisfied and the PR is ready to merge:
```
<review_status>APPROVED</review_status>
```

If Greptile still has concerns that need fixing:
```
<review_status>NEEDS_WORK</review_status>
```

**IMPORTANT:** You MUST include one of these tags. The bash script depends on it to decide whether to continue the review loop.

## Rules

- Be generous in interpreting approval — if Greptile says "all good" even with minor style suggestions, that's APPROVED
- Only return NEEDS_WORK if there are genuine code concerns (bugs, security, correctness)
- Cosmetic suggestions, optional improvements, or "nice to have" comments are NOT reasons to continue
- If Greptile's response is ambiguous, lean toward APPROVED — we don't want infinite loops
