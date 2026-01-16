# Database Layer - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Adding New Tables to Schema
**When:** Creating new database tables
**How:**
1. Add the enum (if needed) in the ENUMS section
2. Add the table definition with createTable()
3. Use ids.entityName() for ID generation (add to src/lib/shared/id.ts first)
4. Add indexes for frequently queried columns
5. Add uniqueIndex for upsert support where needed
6. Add type exports at the end: `export type X = typeof x.$inferSelect; export type NewX = typeof x.$inferInsert;`

### ID Generator Pattern
**When:** Creating new entity types
**How:** Add to `src/lib/shared/id.ts` with unique 2-char prefix (e.g., "ee" for economicEvent)

## Gotchas

<!-- Mistakes/gotchas encountered -->

## Decisions

<!-- Architectural decisions and rationale -->
