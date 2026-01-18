# Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/testing/SKILL.md` (integration), `.claude/skills/e2e-testing/SKILL.md` (E2E)

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

## E2E Test Patterns

### Strict Mode: Use data-testid (Critical)
**Problem:** Playwright strict mode fails when locators match multiple elements:
```
Error: strict mode violation - [class*="cl-signIn"] resolved to 3 elements
```
**Solution:** Always use `data-testid` attributes instead of CSS classes or vague text selectors:
```typescript
// Bad - matches multiple elements
page.locator('[class*="cl-signIn"]')
page.locator('text="Dashboard"')  // matches nav AND heading

// Good - unique selectors
page.getByTestId("dashboard-heading-overview")
page.locator('[data-clerk-component="SignIn"]')  // Clerk's own attribute
```

### Handle Loading States
**Problem:** Test finds element but it's still showing skeleton (no content)
**Solution:** Add same `data-testid` to BOTH skeleton and loaded state, then wait for child element:
```typescript
// Component has data-testid on both loading and loaded divs
const hero = page.getByTestId("dashboard-hero-journal");
await expect(hero).toBeVisible();

// Wait for button that only exists after loading
const button = hero.getByRole("button", { name: /start/i });
await expect(button).toBeVisible({ timeout: 10000 });
```

### Unauthenticated Tests
**When:** Testing auth redirects
**How:** Clear storage state at test level:
```typescript
test.describe("Auth Redirects", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in", async ({ page }) => {
    await page.goto("/protected-route");
    await page.waitForURL(/\/sign-in/, { timeout: 15000 });
  });
});
```

## Gotchas

### Docker Required for Integration Tests
**Problem:** Tests fail with "Could not find a working container runtime strategy"
**Solution:** Start Docker/OrbStack before running `bun run test`

### E2E Tests Need Dev Server
**Problem:** Tests timeout or fail to connect
**Solution:** The Playwright config auto-starts the dev server, but ensure port 3000 is free

## Decisions

<!-- Architectural decisions and rationale -->
