# Database Layer - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Self-Referencing Foreign Keys
**When:** A table needs to reference itself (e.g., strategies that can be copies of other strategies)
**How:**
1. Add the FK column as nullable text: `sourceStrategyId: text("source_strategy_id")`
2. Add an index for lookups: `index("strategy_source_strategy_id_idx").on(t.sourceStrategyId)`
3. Define relations with explicit `relationName` to distinguish forward/reverse:
```ts
sourceStrategy: one(strategies, {
  fields: [strategies.sourceStrategyId],
  references: [strategies.id],
  relationName: "strategySource",
}),
derivedStrategies: many(strategies, {
  relationName: "strategySource",
}),
```

### JSON Arrays in Text Columns
**When:** Storing lists of values that don't need relational queries (e.g., instruments, tags)
**How:** Store as JSON string in text column, parse in application code. Good for display/filtering but not for complex relational queries.

### One-Per-User Constraints
**When:** Enforcing that a user can only have one record per related entity (e.g., one vote per strategy)
**How:** Use a unique index on (userId, entityId):
```ts
(t) => [
  uniqueIndex("strategy_vote_user_strategy_idx").on(t.userId, t.strategyId),
  index("strategy_vote_strategy_id_idx").on(t.strategyId),
]
```
This enforces the constraint at the database level, preventing race conditions.

## Gotchas

<!-- Mistakes/gotchas encountered -->

## Decisions

### Schema Changes for Nullable Fields
**Choice:** Use nullable text/boolean fields for new columns
**Why:** Non-breaking migration - existing rows get null values automatically
