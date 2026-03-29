---
name: e2e-testing
description: Playwright end-to-end testing workflow for TheTraderLog.
---

# E2E Testing Skill

You are a frontend test engineer writing E2E tests for TheTraderLog using Playwright with Clerk authentication.

## Running Tests

| Command | Description |
|---------|-------------|
| `bun run test:e2e` | Run all E2E tests |
| `bun run test:e2e:ui` | Open Playwright UI for debugging |
| `bunx playwright test tests/e2e/specific.spec.ts` | Run a specific test file |

## Project Structure

```
tests/e2e/
├── global.setup.ts    # Clerk auth setup (runs before all tests)
├── dashboard.spec.ts  # Authenticated dashboard tests
└── auth.spec.ts       # Unauthenticated redirect tests
```

## Critical: Playwright Strict Mode

**Playwright's strict mode requires locators to resolve to exactly ONE element.** Vague selectors that match multiple elements will fail with errors like:

```
Error: locator.toBeVisible: Error: strict mode violation
[class*="cl-signIn"] resolved to 3 elements
```

### Solution: Use data-testid Attributes

Always prefer `data-testid` over CSS classes or text selectors.

**Bad (fails strict mode):**
```typescript
// Matches multiple Clerk divs
page.locator('[class*="cl-signIn"]')

// Matches nav link AND page label
page.locator('text="Dashboard"')

// Matches multiple h1 elements
page.locator('h1:has-text("Overview")')
```

**Good (unique selectors):**
```typescript
// data-testid is unique
page.getByTestId("dashboard-heading-overview")

// Clerk's data attribute (already unique)
page.locator('[data-clerk-component="SignIn"]')

// Scoped within parent
page.getByTestId("hero-section").getByRole("button", { name: /start/i })
```

## data-testid Naming Convention

```
[component]-[element]-[qualifier]
```

| Part | Description | Examples |
|------|-------------|----------|
| component | Parent component | `dashboard`, `trade-form`, `nav` |
| element | Element type | `button`, `input`, `heading`, `card` |
| qualifier | Specificity | `submit`, `cancel`, `primary` |

### Examples

```tsx
// Dashboard
<h1 data-testid="dashboard-heading-overview">
<section data-testid="dashboard-hero-journal">
<div data-testid="dashboard-stats-grid">

// Forms
<form data-testid="trade-form">
<input data-testid="trade-form-input-symbol">
<button data-testid="trade-form-button-submit">

// Navigation
<nav data-testid="nav-sidebar">
<button data-testid="nav-button-dashboard">
```

### Adding data-testid During Development

When implementing UI features, add `data-testid` to:
- **Headings** - Page/section headings that tests wait for
- **Containers** - Sections that tests verify are visible
- **Forms** - Form element, all inputs, submit/cancel buttons
- **Interactive elements** - Buttons, links, clickable elements
- **Loading states** - Same testid on skeleton AND loaded state

## Test Patterns

### Authenticated Page Test

```typescript
import { expect, test } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads successfully", async ({ page }) => {
    await page.goto("/dashboard");

    // Use data-testid for reliable selection
    const heading = page.getByTestId("dashboard-heading-overview");
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test("displays hero section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible();

    // Wait for hero to load (has same testid in loading + loaded state)
    const hero = page.getByTestId("dashboard-hero-journal");
    await expect(hero).toBeVisible({ timeout: 10000 });

    // Wait for content to load (button only appears after loading)
    const button = hero.getByRole("button", { name: /start|journal/i });
    await expect(button).toBeVisible({ timeout: 10000 });
  });
});
```

### Unauthenticated Test (Auth Redirect)

```typescript
test.describe("Auth Redirects", () => {
  // Clear auth state for this test block
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in", async ({ page }) => {
    await page.goto("/protected-route");
    await page.waitForURL(/\/sign-in/, { timeout: 15000 });

    expect(page.url()).toContain("/sign-in");
    // Use Clerk's data attribute (unique)
    await expect(page.locator('[data-clerk-component="SignIn"]')).toBeVisible();
  });
});
```

### Form Submission Test

```typescript
test("submits form successfully", async ({ page }) => {
  await page.goto("/form-page");

  await page.getByTestId("form-input-symbol").fill("ES");
  await page.getByTestId("form-input-direction").selectOption("long");
  await page.getByTestId("form-button-submit").click();

  await expect(page.getByTestId("success-message")).toBeVisible();
});
```

## Best Practices

### Selector Priority

1. **`data-testid`** - Most reliable, survives refactors
2. **Scoped selectors** - `parent.getByRole("button")` within a testid container
3. **Semantic roles** - `getByRole("button", { name: "Submit" })`
4. **Text content** - Only for truly unique, user-visible labels
5. **CSS classes** - Avoid (fragile, can match multiple)

### Handle Loading States

```typescript
// Add same data-testid to BOTH loading skeleton AND loaded content
// In component:
if (isLoading) {
  return <div data-testid="dashboard-hero-journal">...skeleton...</div>;
}
return <div data-testid="dashboard-hero-journal">...content...</div>;

// In test - wait for content within the element
const hero = page.getByTestId("dashboard-hero-journal");
await expect(hero).toBeVisible();
const button = hero.getByRole("button"); // Only exists after loading
await expect(button).toBeVisible({ timeout: 10000 });
```

### Timeouts

```typescript
// Element visibility (default 5s, increase for slow loads)
await expect(element).toBeVisible({ timeout: 15000 });

// URL navigation (redirects can be slow)
await page.waitForURL(/pattern/, { timeout: 15000 });
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Strict mode violation | Use `data-testid` or scope within parent element |
| Element not found | Check testid exists, increase timeout |
| Finds loading skeleton | Wait for child element that only exists after load |
| Tests timeout | Check dev server starts, verify selectors are correct |
| Flaky tests | Add explicit waits, don't rely on race conditions |
