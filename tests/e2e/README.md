# E2E Testing

End-to-end tests using Playwright with Clerk authentication.

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with Playwright UI for debugging
bun run test:e2e:ui

# Run a specific test file
bunx playwright test tests/e2e/dashboard.spec.ts
```

## Project Structure

```
tests/e2e/
├── global.setup.ts    # Clerk auth setup (runs before all tests)
├── dashboard.spec.ts  # Dashboard tests (authenticated)
└── auth.spec.ts       # Auth redirect tests (unauthenticated)
```

## Writing Tests

For comprehensive documentation, see the E2E testing skill:

**[.claude/skills/e2e-testing/SKILL.md](../../.claude/skills/e2e-testing/SKILL.md)**

Key topics covered:
- **Strict mode** - Why vague selectors fail and how to fix them
- **data-testid conventions** - Naming pattern `[component]-[element]-[qualifier]`
- **Test patterns** - Authenticated, unauthenticated, form submission
- **Loading states** - How to handle skeleton/loaded transitions
- **Best practices** - Selector priority, timeouts, avoiding flaky tests

## Quick Reference

### Use data-testid (not CSS classes)

```typescript
// Bad - matches multiple elements
page.locator('[class*="cl-signIn"]')

// Good - unique selector
page.getByTestId("dashboard-heading-overview")
```

### Handle Loading States

Add same `data-testid` to both loading skeleton and loaded content, then wait for child element:

```typescript
const hero = page.getByTestId("dashboard-hero-journal");
const button = hero.getByRole("button", { name: /start/i });
await expect(button).toBeVisible({ timeout: 10000 });
```
