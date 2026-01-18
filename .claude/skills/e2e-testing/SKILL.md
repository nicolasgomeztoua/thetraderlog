# E2E Testing Skill

You are a frontend test engineer working on EdgeJournal, a professional trading journal application. You write end-to-end tests that verify user flows and UI behavior using Playwright with Clerk authentication.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Playwright | Browser automation and E2E testing |
| @clerk/testing | Clerk authentication helpers for tests |
| Bun | Test runner via bunx playwright |

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
├── README.md          # Setup instructions
├── dashboard.spec.ts  # Authenticated dashboard tests
└── auth.spec.ts       # Unauthenticated redirect tests

playwright/
└── .clerk/
    └── user.json      # Saved auth state (gitignored)

playwright.config.ts   # Main configuration
```

## Authentication Architecture

### Global Setup

Clerk authentication is handled once in `global.setup.ts`:

1. `clerkSetup()` initializes the Clerk testing environment
2. `clerk.signIn()` authenticates with test user credentials
3. Auth state is saved to `playwright/.clerk/user.json`
4. All browser projects depend on this setup

```typescript
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing", async () => {
  await clerkSetup();
});

setup("authenticate and save state", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_EMAIL!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });
  await page.goto("/dashboard");
  await page.waitForSelector('h1:has-text("Expected Content")');
  await page.context().storageState({ path: "playwright/.clerk/user.json" });
});
```

### Required Environment Variables

```bash
E2E_CLERK_USER_EMAIL=e2e-test@edgejournal.dev
E2E_CLERK_USER_PASSWORD=your-test-password
```

See `tests/e2e/README.md` for test user setup in Clerk dashboard.

## data-testid Conventions

Use `data-testid` attributes to make elements reliably selectable in tests.

### Naming Pattern

```
[component]-[element]-[qualifier]
```

| Part | Description | Examples |
|------|-------------|----------|
| component | Parent component name | `dashboard`, `trade-form`, `nav` |
| element | Specific element type | `button`, `input`, `heading`, `card` |
| qualifier | Optional specificity | `submit`, `cancel`, `primary`, `stats` |

### Examples

```tsx
// Navigation
<nav data-testid="nav-sidebar">
<button data-testid="nav-button-dashboard">

// Dashboard
<section data-testid="dashboard-stats-grid">
<div data-testid="dashboard-card-pnl">
<h1 data-testid="dashboard-heading-overview">

// Trade Form
<form data-testid="trade-form">
<input data-testid="trade-form-input-symbol">
<button data-testid="trade-form-button-submit">

// Lists
<ul data-testid="trades-list">
<li data-testid="trades-item-{tradeId}">
```

### Using in Tests

```typescript
// By data-testid (preferred)
const submitButton = page.getByTestId("trade-form-button-submit");
await submitButton.click();

// By role (semantic elements)
const heading = page.getByRole("heading", { name: "Trading Overview" });

// By text (for labels, content)
const statLabel = page.locator('text="Net P&L"');
```

### Adding data-testid During Development

When implementing UI features:

1. **Forms**: Add testid to form, all inputs, submit/cancel buttons
2. **Navigation**: Add testid to nav container and each link/button
3. **Data displays**: Add testid to cards, tables, lists
4. **Interactive elements**: Any button, link, or clickable element

## Test Patterns

### Authenticated Page Test

```typescript
import { expect, test } from "@playwright/test";

test.describe("Feature Name", () => {
  test("page loads with expected content", async ({ page }) => {
    await page.goto("/protected-route");

    // Wait for page to load
    const heading = page.locator('h1:has-text("Page Title")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Verify specific elements
    await expect(page.getByTestId("feature-element")).toBeVisible();
  });

  test("user can perform action", async ({ page }) => {
    await page.goto("/protected-route");

    // Interact with form
    await page.getByTestId("form-input-name").fill("Test Value");
    await page.getByTestId("form-button-submit").click();

    // Verify result
    await expect(page.getByText("Success")).toBeVisible();
  });
});
```

### Unauthenticated Test (Auth Redirect)

```typescript
import { expect, test } from "@playwright/test";

test.describe("Auth Redirects", () => {
  // Clear auth state for this test block
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/protected-route");

    // Wait for redirect
    await page.waitForURL(/\/sign-in/, { timeout: 15000 });

    // Verify on sign-in page
    expect(page.url()).toContain("/sign-in");
    await expect(page.locator('[class*="cl-signIn"]')).toBeVisible();
  });
});
```

### Form Submission Test

```typescript
test("submits form successfully", async ({ page }) => {
  await page.goto("/form-page");

  // Fill form fields
  await page.getByTestId("form-input-symbol").fill("ES");
  await page.getByTestId("form-input-direction").selectOption("long");
  await page.getByTestId("form-input-price").fill("5000");

  // Submit
  await page.getByTestId("form-button-submit").click();

  // Wait for success state
  await expect(page.getByTestId("success-message")).toBeVisible();
  // Or wait for navigation
  await page.waitForURL(/\/success/);
});
```

### State-Dependent UI Test

```typescript
test("displays correct state", async ({ page }) => {
  await page.goto("/dashboard");

  // When UI can be in multiple states, check for either
  const stateA = page.locator('button:has-text("Start")');
  const stateB = page.locator('text="Completed"');

  const isStateA = await stateA.isVisible().catch(() => false);
  const isStateB = await stateB.isVisible().catch(() => false);

  expect(isStateA || isStateB).toBeTruthy();
});
```

## Best Practices

### Selectors Priority

1. **`data-testid`** - Most reliable, survives refactors
2. **Semantic roles** - `getByRole("button", { name: "Submit" })`
3. **Text content** - For user-visible labels
4. **CSS classes** - Last resort (fragile)

### Timeouts

```typescript
// Element visibility (default 5s, increase for slow loads)
await expect(element).toBeVisible({ timeout: 15000 });

// URL navigation (redirects can be slow)
await page.waitForURL(/pattern/, { timeout: 15000 });
```

### Avoid Flaky Tests

- Always wait for elements before interacting
- Don't rely on timing/delays; use explicit waits
- Use `expect(element).toBeVisible()` before clicking
- Handle loading states with waitForSelector

### Test Isolation

- Each test should be independent
- Don't rely on state from previous tests
- Use `test.describe` to group related tests
- Use `test.use({ storageState: ... })` to override auth per block

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "E2E_CLERK_USER_EMAIL required" | Set env vars in `.env.test` or `.env` |
| Auth fails | Verify test user exists in Clerk dashboard with password auth enabled |
| Element not found | Increase timeout, verify selector is correct |
| Tests timeout | Check dev server starts (`bun run dev`), check network |
| Flaky tests | Add explicit waits, don't rely on race conditions |

## Reference

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [@clerk/testing Documentation](https://clerk.com/docs/testing/playwright)
- [E2E Setup Instructions](../../../tests/e2e/README.md)
