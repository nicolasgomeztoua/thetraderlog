# Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/testing/SKILL.md`

## Patterns

### Setting User Timezone for Tests
**When:** Testing timezone-specific behavior
**How:** After `createTestUser()`, insert into `schema.userSettings`:
```typescript
await db.insert(schema.userSettings).values({
  userId: user.id,
  timezone: "America/New_York",
});
```

### Testing Timezone Edge Cases
**When:** Verifying trade grouping by date in user timezone
**How:** Create trades with UTC timestamps that translate to different calendar days in the user's timezone:
- 11 PM EST = 04:00 UTC next day
- Midnight NZDT = 11:00 UTC previous day
Example: Trade at `new Date("2025-01-16T04:00:00Z")` is 11 PM EST on Jan 15.

### Deriving Totals from byTradeCount
**When:** Testing `getOvertradingAnalysis` consistency
**How:** The procedure returns `byTradeCount` buckets, not totals. Derive:
- Total trades: `sum of (bucket.tradeCount * bucket.days)`
- Total days: `sum of bucket.days`

## Gotchas

### Docker Required for Integration Tests
**Problem:** Tests fail with "Could not find a working container runtime strategy"
**Solution:** Start Docker/OrbStack before running `bun run test`

## Decisions

<!-- Architectural decisions and rationale -->
