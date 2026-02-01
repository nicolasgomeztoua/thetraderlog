# E2E Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/e2e-testing/SKILL.md`

---

## Purpose: Smoke Tests Only

E2E tests are expensive (slow, flaky, hard to maintain). They exist to verify **critical user journeys work end-to-end**, not to test UI details.

### Good E2E Tests

- User can log in and see dashboard
- User can create a strategy and see it in the list
- User can navigate from list to detail page

### Bad E2E Tests (Don't Write These)

- Form shows validation error when name is empty
- Toggle switch changes state when clicked
- Button is disabled until form is valid
- Specific UI element has correct styling
- Detailed section visibility tests

These belong in **integration tests** (if they involve backend logic) or simply aren't worth testing.

---

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with Playwright UI for debugging
bun run test:e2e:ui

# Run a specific test file
bunx playwright test tests/e2e/strategies.spec.ts
```

---

## Essential Patterns

### Use data-testid Selectors

```typescript
// Good - unique, stable selectors
page.getByTestId("strategies-header")
page.getByTestId("strategy-card-link")

// Bad - fragile, matches multiple elements
page.locator('text="Strategies"')
page.locator('[class*="card"]')
```

### Wait for Loading States

```typescript
await expect(page.getByTestId("strategies-header")).toBeVisible({
  timeout: 15000,
});
```

### Skip When No Data Exists

```typescript
const cards = page.getByTestId("strategy-card");
if ((await cards.count()) === 0) {
  // No data to test, skip gracefully
  return;
}
```

### Increase Timeout for Navigation-Heavy Tests

```typescript
test("full creation flow", async ({ page }, testInfo) => {
  testInfo.setTimeout(60000);
  // ... navigation-heavy test
});
```

---

## Gotchas

### E2E Tests Need Dev Server
The Playwright config auto-starts the dev server, but ensure port 3000 is free.

### Prefer Waiting for Elements Over waitForTimeout
```typescript
// Better - wait for specific element
await expect(page.getByTestId("strategies-grid")).toBeVisible();

// Avoid when possible - hardcoded wait
await page.waitForTimeout(3000);
```

---

## Decisions

- E2E tests are smoke tests only - detailed UI tests belong in integration tests
- Use section comments (`// ===`) to organize tests by feature area
- Skip tests gracefully when data doesn't exist rather than failing
