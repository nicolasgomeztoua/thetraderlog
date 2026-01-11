# tRPC Routers - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Date-Based Lookups
**When:** Queries that need to fetch by date (journals, daily stats)
**How:** Create a `normalizeDate` helper that sets hours/minutes/seconds to 0 UTC. Store dates normalized to midnight UTC in the database.

### Auto-Create Pattern
**When:** Fetching an entity that should exist if the user accesses it (e.g., daily journal)
**How:** Query first, if not found insert with returning(), guard against undefined, re-fetch with relations.

### Router Registration
**When:** Creating a new tRPC router
**How:** 1) Create file in routers/, 2) Export router, 3) Import in root.ts, 4) Add to appRouter object

### Date Range Queries
**When:** Queries that filter by a date range (e.g., calendar views, reports)
**How:** Import `gte`, `lte` from drizzle-orm, normalize both dates to midnight UTC, use `and(eq(userId), gte(date, start), lte(date, end))`

## Gotchas

### Drizzle returning() can be undefined
**Problem:** TypeScript error when using `const [created] = await db.insert().returning()`
**Solution:** Always guard with `if (!created) throw new Error("Failed to create...")`

## Decisions

<!-- Architectural decisions and rationale -->
