---
name: compound-engineering
description: Principles for making each implementation step improve future work.
---

# Compound Engineering Skill

Each unit of engineering work should make subsequent units easier—not harder.

## Philosophy

Turn every problem discovered during work into documented knowledge that future iterations can use. Mistakes become lessons, patterns become templates, decisions become guidance.

## The Loop

```
Work → Learn → Document → (next iteration benefits)
```

## What to Document

### Patterns Discovered
When you find or create a useful pattern:

```markdown
## Pattern: [Name]
**When to use:** [context]
**Example:**
```typescript
// code example
```
**See:** [file reference]
```

### Decisions Made
When you choose between approaches:

```markdown
## Decision: [What was decided]
**Context:** [situation]
**Options:** [alternatives considered]
**Choice:** [what was chosen]
**Why:** [rationale]
```

### Mistakes & Fixes
Turn every bug into prevention:

```markdown
## Gotcha: [Short description]
**Symptom:** [what you observed]
**Cause:** [actual problem]
**Fix:** [solution]
**Prevention:** [how to avoid next time]
```

### Observations
Things worth noting:

```markdown
## Note: [Topic]
[Observation that might help future work]
```

## Where to Document

### Directory-Level AGENTS.md

Each core directory should have an `AGENTS.md` file with learnings specific to that area:

| Directory | AGENTS.md Purpose |
|-----------|-------------------|
| `src/server/api/routers/` | tRPC patterns, common queries, auth gotchas |
| `src/server/db/` | Schema patterns, migration lessons, query optimization |
| `src/app/(protected)/` | Page patterns, data fetching, layout gotchas |
| `src/components/` | Component patterns, styling conventions |
| `src/lib/` | Utility patterns, shared logic |
| `tests/` | Test patterns, fixture usage, common assertions |

### Project-Level Progress

`scripts/ralph/progress.txt` captures cross-cutting learnings in the "Codebase Patterns" section.

## AGENTS.md Template

```markdown
# [Directory Name] - Agent Knowledge

## Patterns

### [Pattern Name]
**When:** [context]
**How:** [brief explanation]
**Example:** [code or file reference]

## Decisions

### [Decision Topic]
**Choice:** [what was decided]
**Why:** [rationale]

## Gotchas

### [Gotcha Title]
**Problem:** [what goes wrong]
**Solution:** [how to fix/avoid]

## Notes

- [Observation 1]
- [Observation 2]
```

## When to Compound

After completing any significant work:

1. **What patterns did I use or create?** → Document in relevant AGENTS.md
2. **What mistakes did I make?** → Add to Gotchas section
3. **What decision did I make and why?** → Document rationale
4. **What would help the next person?** → Add to Notes

## Integration with Ralph

Ralph's prompt instructs it to:
1. Read AGENTS.md files in directories it's working in
2. Update them with new learnings after each story
3. Consolidate cross-cutting patterns to progress.txt

## Success Indicators

Compound engineering is working when:
- Similar tasks get easier over time
- Mistakes happen once, not repeatedly
- New iterations can learn from past work
- Knowledge accumulates, not evaporates
