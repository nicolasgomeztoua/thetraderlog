# PRD: Frontend E2E Testing System (Playwright + Clerk)

## Overview

Implement a frontend E2E testing infrastructure using **Playwright** with **@clerk/testing** for authentication. Tests use `data-testid` attributes for reliable element selection.

**Key Decisions:**
- **Playwright**: No extra API costs, proven reliability, full control
- **data-testid strategy**: Immune to CSS class changes, added incrementally per feature
- **Local execution only**: Ralph runs tests during development, no CI/CD
- **@clerk/testing**: Official Clerk package handles auth tokens and session persistence

## Goals

- Set up E2E testing infrastructure that Ralph can use
- Test real Clerk authentication flows with a dedicated test user
- Create example tests that demonstrate the pattern
- Establish conventions for adding `data-testid` during feature development

## User Stories

### US-001: Install Playwright and Clerk Testing
**Description**: As a developer, I want Playwright and @clerk/testing installed so that E2E tests can run.

**Acceptance Criteria**:
- [ ] Run `bun add -D @playwright/test @clerk/testing`
- [ ] Run `bunx playwright install` to install browsers
- [ ] Create `playwright.config.ts` with base URL localhost:3000
- [ ] Configure webServer to start `bun run dev` before tests
- [ ] Add `test:e2e` script to package.json: `playwright test`
- [ ] Add `test:e2e:ui` script for debugging: `playwright test --ui`
- [ ] Add `playwright/.clerk/` to `.gitignore`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Clerk Global Setup for Auth State
**Description**: As a test author, I want Clerk authentication handled in global setup so tests start authenticated.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/global.setup.ts`
- [ ] Use `clerkSetup()` from @clerk/testing/playwright
- [ ] Sign in with test user credentials from environment variables
- [ ] Save auth state to `playwright/.clerk/user.json`
- [ ] Configure Playwright to load this state in authenticated tests
- [ ] Verify: run empty test, should land on dashboard (not sign-in)
- [ ] Typecheck passes (`bun run check`)

---

### US-003: Test User Setup Documentation
**Description**: As a developer, I want clear documentation on setting up the Clerk test user.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/README.md` with setup instructions
- [ ] Document: Create test user in Clerk dev dashboard (e.g., `e2e-test@edgejournal.dev`)
- [ ] Document: Enable email/password auth in Clerk
- [ ] Document: Required env vars (`E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER_PASSWORD`)
- [ ] Create `.env.test.example` with placeholders
- [ ] Typecheck passes (`bun run check`)

---

### US-004: Example E2E Test - Dashboard Loads
**Description**: As a developer, I want an example test that verifies the dashboard loads when authenticated.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/dashboard.spec.ts`
- [ ] Test: Navigate to `/dashboard`
- [ ] Test: Page loads without error
- [ ] Test: Some expected element is visible (e.g., heading or nav)
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-005: Example E2E Test - Auth Redirect
**Description**: As a developer, I want an example test that verifies unauthenticated users are redirected.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/auth.spec.ts`
- [ ] Test: Unauthenticated user visiting `/dashboard` redirects to `/sign-in`
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-006: E2E Testing Skill
**Description**: As Ralph, I want an E2E testing skill so I know how to write and run frontend tests.

**Acceptance Criteria**:
- [ ] Create `.claude/skills/e2e-testing/SKILL.md`
- [ ] Document: How to run tests (`bun run test:e2e`)
- [ ] Document: Playwright + @clerk/testing setup
- [ ] Document: `data-testid` naming convention
- [ ] Document: How to add `data-testid` to components during feature development
- [ ] Document: Example test patterns (auth, page loads, form submission)
- [ ] Document: Global setup and auth state persistence
- [ ] Reference from `tests/e2e/README.md` (brief README pointing to skill)
- [ ] Typecheck passes (`bun run check`)

---

### US-007: Ralph Loop Integration
**Description**: As Ralph, I want to run E2E tests after implementation.

**Acceptance Criteria**:
- [ ] Update `scripts/ralph/prompt.md` to reference E2E testing skill (`.claude/skills/e2e-testing/SKILL.md`)
- [ ] Add section: "When implementing UI features, read the E2E testing skill"
- [ ] Add guidance: add `data-testid` attributes when creating testable UI
- [ ] Add guidance: run `bun run test:e2e` for UI stories (optional, after backend tests)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. **FR-001**: E2E tests use Playwright with @clerk/testing
2. **FR-002**: Element selection uses `data-testid` (added incrementally per feature)
3. **FR-003**: Tests authenticate using dedicated Clerk test user
4. **FR-004**: Tests run against `localhost:3000` (dev server)
5. **FR-005**: Auth state persisted to avoid login per test
6. **FR-006**: Tests run locally only - Ralph executes during development

## Non-Goals (Out of Scope)

- CI/CD integration
- Adding `data-testid` to all existing components upfront (done incrementally)
- Visual regression testing
- Performance testing
- Comprehensive test coverage initially (start with examples, grow organically)

## Technical Considerations

### Dependencies
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@clerk/testing": "^1.0.0"
  }
}
```

### Environment Variables
```bash
# .env.local (gitignored)
E2E_CLERK_USER_EMAIL=e2e-test@edgejournal.dev
E2E_CLERK_USER_PASSWORD=your-secure-password
```

### File Structure
```
.claude/skills/
└── e2e-testing/
    └── SKILL.md                 # E2E testing skill (Ralph reads this)

tests/
├── e2e/
│   ├── README.md                # Brief README pointing to skill
│   ├── global.setup.ts          # Clerk auth setup
│   ├── auth.spec.ts             # Auth redirect test
│   └── dashboard.spec.ts        # Dashboard loads test
├── integration/                 # Existing backend tests
└── setup/                       # Existing test setup

playwright.config.ts             # Playwright configuration
playwright/
└── .clerk/
    └── user.json               # Saved auth state (gitignored)
```

### data-testid Convention (Added Incrementally)
```
[component]-[element]-[qualifier]

Examples:
- nav-dashboard
- trade-form
- trade-symbol-input
- journal-trade-row
```

When developing a new feature that needs E2E testing:
1. Add `data-testid` attributes to the relevant components
2. Write the E2E test using those test IDs
3. Both happen as part of the same feature PR

### Example Test
```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should load for authenticated user', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify page loaded (adjust selector based on what exists)
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

## Success Metrics

- Infrastructure works: Ralph can run `bun run test:e2e`
- Auth works: Tests can sign in via Clerk test user
- Example tests pass and demonstrate the pattern
- Documentation is clear enough for future test additions

## Dependencies

- Clerk dev instance with test user created (you do this manually)
- Dev server running on localhost:3000
- Playwright browsers installed locally
