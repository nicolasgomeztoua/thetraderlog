# E2E Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/e2e-testing/SKILL.md`

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with Playwright UI for debugging
bun run test:e2e:ui

# Run a specific test file
bunx playwright test tests/e2e/strategies.spec.ts
```

## Project Structure

```
tests/e2e/
├── global.setup.ts    # Clerk auth setup (runs before all tests)
├── auth.spec.ts       # Auth redirect tests (unauthenticated)
├── dashboard.spec.ts  # Dashboard tests (authenticated)
└── strategies.spec.ts # Strategies feature tests (list, detail, form, rules)
```

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

### data-testid Naming Convention
Pattern: `[component]-[element]-[qualifier]`
```typescript
// Examples
"strategies-header"              // Component: strategies, Element: header
"strategy-card-title"            // Component: strategy-card, Element: title
"strategy-form-tab-risk"         // Component: strategy-form, Element: tab, Qualifier: risk
"strategy-detail-action-back"    // Component: strategy-detail, Element: action, Qualifier: back
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

### Conditional Tests (Skip When No Data)
**When:** Testing features that depend on existing data (strategies, trades)
**How:** Check for data first, return early if none exists:
```typescript
const cards = page.getByTestId("strategy-card");
const count = await cards.count();
if (count === 0) {
  // No strategy cards to test, skip
  return;
}
// Continue with test...
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

### Navigation-Heavy Tests
**When:** Tests with multiple page navigations
**How:** Increase timeout at test level:
```typescript
test("full creation flow", async ({ page }, testInfo) => {
  testInfo.setTimeout(60000);
  // ... long navigation test
});
```

## Gotchas

### E2E Tests Need Dev Server
**Problem:** Tests timeout or fail to connect
**Solution:** The Playwright config auto-starts the dev server, but ensure port 3000 is free

### waitForTimeout vs Proper Waits
**Problem:** Using hardcoded `waitForTimeout(3000)` is flaky
**Better:** Wait for specific elements when possible:
```typescript
// Okay for data loading (tRPC calls)
await page.waitForTimeout(3000);

// Better when you can wait for specific element
await expect(page.getByTestId("strategies-grid")).toBeVisible({ timeout: 10000 });
```

### Form Navigation
**When:** Testing multi-tab forms
**How:** Click tab, then verify section content loaded:
```typescript
await page.getByTestId("strategy-form-tab-risk").click();
await expect(page.getByTestId("risk-config-max-risk-toggle")).toBeVisible();
```

## Test File Organization

Follow integration test structure with `describe` blocks organized by feature area:

```typescript
// ============================================================================
// SECTION NAME
// ============================================================================

test.describe("Section Name", () => {
  test("specific behavior", async ({ page }) => {
    // test implementation
  });
});
```

## Decisions

- Combined `strategies-redesign.spec.ts` and `strategy-checklist.spec.ts` into single `strategies.spec.ts` for cohesion
- Use section comments (`// ===`) to organize tests by feature area within a file
- Skip tests gracefully when data doesn't exist rather than failing
