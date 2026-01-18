# Database Layer - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Text Array Columns
**When:** Need to store arrays of strings (tags, instruments, etc.)
**How:** Use `text("column_name").array()` in Drizzle schema

### Schema Push with Data Loss
**When:** Making schema changes that drop columns
**How:** Use `bun run db:push --force` to auto-approve data loss statements

### Self-Referential Relations
**When:** A table references itself (e.g., strategies.sourceStrategyId → strategies.id)
**How:** Use `relationName` in both directions to distinguish them:
```typescript
// Parent side
sourceStrategy: one(strategies, {
  fields: [strategies.sourceStrategyId],
  references: [strategies.id],
  relationName: "sourceStrategies",
}),
copiedStrategies: many(strategies, {
  relationName: "sourceStrategies",
}),
```

### Multiple Relations to Same Table
**When:** A table has two FKs pointing to the same table (e.g., strategyDownloads with originalStrategyId and copiedStrategyId both → strategies)
**How:** Use distinct `relationName` for each relation pair

## Gotchas

### DB Push Interactive Prompts
**Problem:** `bun run db:push` prompts for column create/rename decisions interactively, which can hang in automated scripts
**Solution:** Use `--force` flag to auto-approve, or use `expect` for complex interactions

### Columns Not in Schema Get Dropped
**Problem:** Any columns in the database that aren't in schema.ts will be dropped during push
**Solution:** Always verify what columns exist before running db:push, especially after switching branches

## Decisions

<!-- Architectural decisions and rationale -->
