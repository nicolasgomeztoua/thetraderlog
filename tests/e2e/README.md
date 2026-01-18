# E2E Testing Setup

End-to-end testing with Playwright and Clerk authentication.

## Prerequisites

1. **Node.js/Bun** - Runtime for running tests
2. **Playwright browsers** - Install with `bunx playwright install`

## Test User Setup

E2E tests require a dedicated test user in Clerk.

### 1. Create Test User in Clerk

1. Open your [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your **Development** instance
3. Go to **Users** → **Create user**
4. Create a user with:
   - Email: `e2e-test@edgejournal.dev` (or your preferred test email)
   - Password: A strong password for testing
5. **Important:** Enable email/password authentication:
   - Go to **Configure** → **Email, phone, username**
   - Ensure **Email address** is enabled as an identifier
   - Go to **Configure** → **Passwords**
   - Ensure password authentication is enabled

### 2. Configure Environment Variables

Create a `.env.test` file (or add to your `.env`):

```bash
E2E_CLERK_USER_EMAIL=e2e-test@edgejournal.dev
E2E_CLERK_USER_PASSWORD=your-test-password
```

See `.env.test.example` for the required variables.

### 3. Verify Setup

Run the E2E tests:

```bash
bun run test:e2e
```

The global setup will:
1. Start the dev server
2. Sign in with the test user
3. Save auth state to `playwright/.clerk/user.json`
4. Run tests with the authenticated state

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
├── README.md          # This file
├── dashboard.spec.ts  # Dashboard tests (authenticated)
└── auth.spec.ts       # Auth redirect tests (unauthenticated)
```

## Troubleshooting

### "E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD required"

Set the environment variables. Either:
- Create `.env.test` with the variables
- Add them to your existing `.env` file
- Export them in your shell before running tests

### "Authentication failed"

1. Verify the test user exists in Clerk dashboard
2. Confirm email/password auth is enabled in Clerk
3. Check the password is correct

### Tests timeout waiting for page elements

1. Ensure the dev server starts correctly (`bun run dev`)
2. Check the test user has access to the dashboard
3. Increase timeout in `playwright.config.ts` if needed

## Writing Tests

See the E2E testing skill: `.claude/skills/e2e-testing/SKILL.md`
