# Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/testing/SKILL.md` (integration), `.claude/skills/e2e-testing/SKILL.md` (E2E)

---

## Testing Pyramid Philosophy

```
        /\
       /  \     E2E (Smoke tests only)
      /----\    - Critical user flows
     /      \   - Login → create → verify
    /--------\
   /          \ Unit Tests
  /            \ - Pure functions
 /              \ - Parsers, generators
/----------------\ - Utilities
|                |
| Integration    | PRIMARY LAYER
| Tests          | - tRPC endpoints
|                | - Business logic
|                | - Database operations
|________________| - Fast, reliable
```

### When to Write Which Test Type

| Question | Test Type |
|----------|-----------|
| Can I test this with a tRPC call? | Integration test |
| Is this a pure function with no DB? | Unit test |
| Is this a critical user journey? | E2E smoke test |

**Integration tests are king.** They're fast, reliable, and test real business logic with a real DB.

**E2E tests are smoke tests only.** Don't write detailed UI tests for form validation, toggle states, or button behaviors. Those belong in integration tests or aren't worth testing.

---

## Unit Test Patterns

### Running Unit Tests (No Database Required)
**When:** Testing pure functions that don't need database access
**How:** Use the separate vitest config:
```bash
bunx vitest run --config vitest.config.unit.ts
```
Unit tests go in `tests/unit/` directory. They don't require Docker since they don't use the global setup that starts PostgreSQL.

### Unit vs Integration Tests
**When:** Choosing test type
**How:**
- **Unit tests:** Pure functions, utilities, parsers, generators (no DB, no tRPC)
- **Integration tests:** tRPC endpoints, database operations, multi-component flows

## Integration Test Patterns

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

## E2E Test Patterns (Smoke Tests Only)

E2E tests are expensive (slow, flaky, hard to maintain). Use them sparingly for critical user journeys only.

**Good E2E tests:**
- User can log in and see dashboard
- User can create a strategy and see it in the list
- User can import trades and see them in journal

**Bad E2E tests (don't write these):**
- Form shows validation error when name is empty
- Toggle switch changes state when clicked
- Button is disabled until form is valid
- Specific UI element has correct styling

### Use data-testid for Selectors
```typescript
// Good - unique selectors
page.getByTestId("strategies-header")

// Bad - matches multiple elements
page.locator('text="Dashboard"')
```

### Wait for Loading States
```typescript
const hero = page.getByTestId("dashboard-hero-journal");
await expect(hero).toBeVisible({ timeout: 10000 });
```

## Gotchas

### Floating Point Boundary Tests
**Problem:** Testing exact threshold boundaries (e.g., `1 - 0.7 === 0.3`) fails because `1 - 0.7 = 0.30000000000000004` in JavaScript.
**Solution:** Never test exact boundary values. Use values clearly on one side of the threshold (e.g., `7.1 / 10 = 0.29` instead of `7 / 10 = 0.3`).

### Docker Required for Integration Tests
**Problem:** Tests fail with "Could not find a working container runtime strategy"
**Solution:** Start Docker/OrbStack before running `bun run test`

### E2E Tests Need Dev Server
**Problem:** Tests timeout or fail to connect
**Solution:** The Playwright config auto-starts the dev server, but ensure port 3000 is free

### Prop Account Fixture Completeness
**When:** Writing integration tests that need prop accounts with all fields set
**How:** Use `setupPropChallenge({ account: { ...overrides } })` — it now sets all prop fields by default (drawdownType, dailyLossLimit, consistencyRule, minTradingDays, challengeStartDate, challengeEndDate, challengeStatus). Override only what your test needs.

### Compliance Threshold Math for Test Expectations
**When:** Testing compliance status (safe/caution/danger)
**How:** Buffer = 1 - (used / limit). SAFE > 30% buffer, CAUTION 10-30%, DANGER < 10%. For 6% max drawdown: need > 5.4% current to get danger. For 3% daily loss limit ($3000): need > $2700 loss to get danger.

## Decisions

<!-- Architectural decisions and rationale -->
