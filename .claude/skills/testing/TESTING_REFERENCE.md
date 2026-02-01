# EdgeJournal Testing Reference

Complete reference guide for the EdgeJournal testing infrastructure. This document provides in-depth coverage of the testing architecture, fixtures, patterns, and troubleshooting.

---

## Testing Pyramid

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

| Layer | Purpose | Speed | Location |
|-------|---------|-------|----------|
| **Integration** | Business logic, tRPC, DB | Fast (ms) | `tests/integration/` |
| **Unit** | Pure functions, parsers, utilities | Fast (ms) | `tests/unit/` |
| **E2E** | Critical user flows (smoke tests) | Slow (s) | `tests/e2e/` |

### When to Use Each Test Type

| Question | Test Type |
|----------|-----------|
| Can I test this with a tRPC call? | Integration test |
| Is this a pure function with no DB? | Unit test |
| Is this a critical user journey? | E2E smoke test |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vitest                                   │
├─────────────────────────────────────────────────────────────────┤
│  Global Setup                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Start PostgreSQL container (Testcontainers)              ││
│  │ 2. Push schema via drizzle-kit push                         ││
│  │ 3. Export TEST_DATABASE_URL to environment                  ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Test File (e.g., accounts.test.ts)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ beforeAll:                                                  ││
│  │   - truncateAllTables()                                     ││
│  │   - createTestUser() → user                                 ││
│  │   - createTestCaller(user.clerkId) → caller                 ││
│  │                                                              ││
│  │ it("test case"):                                            ││
│  │   - caller.accounts.create(...)                             ││
│  │   - expect(result).toBe(...)                                ││
│  │                                                              ││
│  │ afterAll:                                                   ││
│  │   - truncateAllTables()                                     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Global Teardown                                                 │
│  └── Stop PostgreSQL container                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
tests/
├── setup/
│   ├── global-setup.ts      # Starts PostgreSQL container, pushes schema
│   ├── global-teardown.ts   # Stops PostgreSQL container
│   └── test-env.ts          # Environment configuration
├── integration/
│   └── accounts.test.ts     # Integration tests for accounts router
├── unit/
│   └── rule-generator.test.ts  # Unit tests for pure functions
├── e2e/
│   ├── global.setup.ts      # Clerk auth setup
│   ├── auth.spec.ts         # Auth redirect smoke tests
│   ├── dashboard.spec.ts    # Dashboard smoke tests
│   └── strategies.spec.ts   # Strategies smoke tests
├── utils/
│   ├── index.ts             # Re-exports all utilities
│   ├── caller.ts            # createTestCaller, createUnauthenticatedCaller
│   ├── context.ts           # createTestContext, createUnauthenticatedTestContext
│   ├── db.ts                # getTestDb, truncateAllTables
│   └── fixtures/
│       ├── index.ts         # Re-exports all fixtures
│       ├── users.ts         # createTestUser
│       ├── accounts.ts      # createTestAccount
│       ├── trades.ts        # createTestTrade, createTestTrades
│       └── scenarios.ts     # Pre-composed test scenarios
└── README.md                # Testing philosophy and conventions
```

## Data Model Dependencies

Understanding the trading domain data model is essential for writing correct tests:

```
User (required)
 └── Account (requires User)
      └── Trade (requires User + Account)
           └── Execution (requires Trade)
```

### Key Constraints

- **Users** must have unique `clerkId` and `email`
- **Accounts** belong to exactly one user; first account is auto-default
- **Trades** require both `userId` and `accountId`
- **P&L Calculations** use decimal precision (returned as strings from DB)

## Fixture API Reference

### User Fixtures

```typescript
// tests/utils/fixtures/users.ts

interface CreateTestUserOptions {
  clerkId?: string;    // Default: test_clerk_{counter}_{timestamp}
  email?: string;      // Default: testuser{counter}@test.local
  name?: string;       // Default: Test User {counter}
  role?: "user" | "admin";  // Default: "user"
}

// Create a single user
const user = await createTestUser();
const user = await createTestUser({ name: "Pro Trader", role: "admin" });

// Reset counter for consistent IDs
resetUserCounter();
```

### Account Fixtures

```typescript
// tests/utils/fixtures/accounts.ts

interface CreateTestAccountOptions {
  name?: string;       // Default: Test Account {counter}
  broker?: string;     // Default: undefined
  platform?: "mt4" | "mt5" | "projectx" | "ninjatrader" | "other"; // Default: "other"
  accountType?: "prop_challenge" | "prop_funded" | "live" | "demo"; // Default: "demo"
  initialBalance?: string;  // Default: "10000"
  currency?: string;        // Default: "USD"
  isDefault?: boolean;      // Default: false
  isActive?: boolean;       // Default: true
  // Prop firm fields
  maxDrawdown?: string;
  profitTarget?: string;
  profitSplit?: string;
}

// Create account (requires userId)
const account = await createTestAccount(user.id);
const account = await createTestAccount(user.id, {
  name: "FTMO Challenge",
  accountType: "prop_challenge",
  initialBalance: "100000",
  maxDrawdown: "6",
  profitTarget: "10",
});

// Reset counter
resetAccountCounter();
```

### Trade Fixtures

```typescript
// tests/utils/fixtures/trades.ts

interface CreateTestTradeOptions {
  symbol?: string;           // Default: "ES"
  instrumentType?: "futures" | "forex";  // Default: "futures"
  direction?: "long" | "short";          // Default: "long"
  status?: "open" | "closed";            // Default: "closed"
  entryPrice?: string;       // Default: "5000.00"
  entryTime?: Date;          // Default: new Date()
  exitPrice?: string;        // Default: "5010.00" (for closed trades)
  exitTime?: Date;           // Default: new Date() (for closed trades)
  quantity?: string;         // Default: "1"
  stopLoss?: string;
  takeProfit?: string;
  realizedPnl?: string;      // Auto-calculated if not provided
  netPnl?: string;           // Auto-calculated if not provided
  fees?: string;             // Default: "2.50"
  setupType?: string;
  notes?: string;
}

// Create single trade (requires userId and accountId)
const trade = await createTestTrade(user.id, account.id);
const trade = await createTestTrade(user.id, account.id, {
  symbol: "NQ",
  direction: "short",
  entryPrice: "18000.00",
  exitPrice: "17980.00",
});

// Create multiple trades
const trades = await createTestTrades(user.id, account.id, 5);
const trades = await createTestTrades(user.id, account.id, 3, {
  status: "closed",
  direction: "long",
});

// Reset counter
resetTradeCounter();
```

### P&L Auto-Calculation

When creating closed trades without explicit `realizedPnl`, the fixture calculates it:

```typescript
// Calculation: priceDiff × direction × quantity × contractMultiplier
// Contract multipliers:
//   - ES (E-mini S&P 500): $50 per point
//   - NQ (E-mini NASDAQ): $20 per point
//   - Other: $1 per point

// Example: Long ES, entry 5000, exit 5010, qty 1
// = (5010 - 5000) × 1 × 1 × $50 = $500

// Example: Short NQ, entry 18000, exit 17980, qty 2
// = (17980 - 18000) × (-1) × 2 × $20 = $800
```

### Pre-Composed Scenarios

```typescript
// tests/utils/fixtures/scenarios.ts

// Basic trader setup (user + default account)
const { user, account } = await setupTrader();
const { user, account } = await setupTrader({
  user: { name: "Day Trader" },
  account: { platform: "ninjatrader" },
});

// Trader with N closed trades
const { user, account, trades } = await setupTraderWithTrades(10);
const { user, account, trades } = await setupTraderWithTrades(5, {
  trade: { symbol: "NQ" },
});

// Trader with multiple accounts
const { user, accounts } = await setupTraderWithMultipleAccounts(3);

// Prop firm challenge setup
const { user, account } = await setupPropChallenge();
const { user, account } = await setupPropChallenge({
  initialBalance: "200000",
  profitTarget: "8",
  maxDrawdown: "5",
});

// Mixed winning/losing trades (for statistics testing)
const { user, account, trades, winningTrades, losingTrades } =
  await setupTraderWithMixedTrades();
const { user, account, trades, winningTrades, losingTrades } =
  await setupTraderWithMixedTrades({
    winCount: 7,
    lossCount: 3,
  });
```

## Utility Functions

### Database Utilities

```typescript
// tests/utils/db.ts

// Get Drizzle DB instance for direct queries
const db = getTestDb();
const users = await db.select().from(schema.users);

// Clear all tables (use in beforeAll/afterAll)
await truncateAllTables();

// Close connection (handled by global teardown)
await closeTestDb();
```

### tRPC Caller Utilities

```typescript
// tests/utils/caller.ts

// Create authenticated caller
const caller = await createTestCaller(user.clerkId, user);
const accounts = await caller.accounts.getAll();

// Create unauthenticated caller (for auth tests)
const unauthCaller = await createUnauthenticatedCaller();
await expect(unauthCaller.accounts.getAll()).rejects.toThrow("UNAUTHORIZED");

// Type helper
type TestCaller = Awaited<ReturnType<typeof createTestCaller>>;
```

### Context Utilities

```typescript
// tests/utils/context.ts

// Create test context with auth bypass
const ctx = await createTestContext(clerkId, user);

// Create unauthenticated context
const ctx = await createUnauthenticatedTestContext();
```

## Test Patterns

### Standard Test Structure

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
  createTestCaller,
  truncateAllTables,
  setupTrader,
  type TestCaller,
} from "../utils";

describe("feature router", () => {
  let user: User;
  let caller: TestCaller;

  beforeAll(async () => {
    await truncateAllTables();
    const setup = await setupTrader();
    user = setup.user;
    caller = await createTestCaller(user.clerkId, user);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe("create", () => {
    it("should create a resource", async () => {
      const result = await caller.feature.create({ name: "Test" });
      expect(result).toBeDefined();
      expect(result?.name).toBe("Test");
    });
  });
});
```

### Testing CRUD Operations

```typescript
describe("accounts CRUD", () => {
  // CREATE
  it("should create an account", async () => {
    const account = await caller.accounts.create({
      name: "My Account",
      accountType: "live",
      initialBalance: "25000",
    });
    expect(account?.name).toBe("My Account");
  });

  // READ
  it("should get account by ID", async () => {
    const accounts = await caller.accounts.getAll();
    const account = await caller.accounts.getById({ id: accounts[0]?.id ?? "" });
    expect(account).toBeDefined();
  });

  // UPDATE
  it("should update account", async () => {
    const accounts = await caller.accounts.getAll();
    const updated = await caller.accounts.update({
      id: accounts[0]?.id ?? "",
      name: "Updated Name",
    });
    expect(updated?.name).toBe("Updated Name");
  });

  // DELETE
  it("should delete account", async () => {
    const account = await caller.accounts.create({ name: "To Delete" });
    const result = await caller.accounts.delete({ id: account?.id ?? "" });
    expect(result.success).toBe(true);
  });
});
```

### Testing P&L Calculations

```typescript
describe("P&L calculations", () => {
  it("should calculate P&L for long trade", async () => {
    const trade = await caller.trades.create({
      symbol: "ES",
      direction: "long",
      entryPrice: "5000.00",
      exitPrice: "5010.00",
      quantity: "1",
      accountId: account.id,
      entryTime: new Date().toISOString(),
      exitTime: new Date().toISOString(),
    });

    // ES: $50/point × 10 points × 1 contract = $500
    expect(parseFloat(trade?.realizedPnl ?? "0")).toBe(500);
  });

  it("should calculate P&L for short trade", async () => {
    const trade = await caller.trades.create({
      symbol: "ES",
      direction: "short",
      entryPrice: "5010.00",
      exitPrice: "5000.00",
      quantity: "2",
      accountId: account.id,
      entryTime: new Date().toISOString(),
      exitTime: new Date().toISOString(),
    });

    // ES: $50/point × 10 points × 2 contracts = $1000
    expect(parseFloat(trade?.realizedPnl ?? "0")).toBe(1000);
  });
});
```

### Testing Statistics

```typescript
describe("statistics", () => {
  beforeAll(async () => {
    await truncateAllTables();
    const setup = await setupTraderWithMixedTrades({
      winCount: 6,
      lossCount: 4,
    });
    caller = await createTestCaller(setup.user.clerkId, setup.user);
  });

  it("should calculate correct win rate", async () => {
    const stats = await caller.trades.getStats();
    // 6 wins / 10 total = 60%
    expect(stats.winRate).toBeCloseTo(60, 0);
  });

  it("should calculate total P&L", async () => {
    const stats = await caller.trades.getStats();
    // Winning trades: 6 × $1000 = $6000
    // Losing trades: 4 × -$500 = -$2000
    // Net: $4000
    expect(stats.totalPnl).toBeGreaterThan(0);
  });
});
```

### Testing Authorization

```typescript
describe("authorization", () => {
  it("should reject unauthenticated requests", async () => {
    const unauthCaller = await createUnauthenticatedCaller();
    await expect(unauthCaller.accounts.getAll()).rejects.toThrow("UNAUTHORIZED");
  });

  it("should not allow accessing another user's resources", async () => {
    // Create another user with their own account
    const otherUser = await createTestUser({ name: "Other Trader" });
    const otherAccount = await createTestAccount(otherUser.id);

    // Original caller should not access other user's account
    await expect(
      caller.accounts.getById({ id: otherAccount.id })
    ).rejects.toThrow("Account not found");
  });

  it("should not allow modifying another user's resources", async () => {
    const otherUser = await createTestUser();
    const otherAccount = await createTestAccount(otherUser.id);

    await expect(
      caller.accounts.update({ id: otherAccount.id, name: "Hacked" })
    ).rejects.toThrow("Account not found");

    await expect(
      caller.accounts.delete({ id: otherAccount.id })
    ).rejects.toThrow("Account not found");
  });
});
```

### Testing Business Logic Workflows

```typescript
describe("prop firm challenge lifecycle", () => {
  let challengeAccount: Account;

  beforeAll(async () => {
    challengeAccount = await caller.accounts.create({
      name: "FTMO Challenge",
      accountType: "prop_challenge",
      initialBalance: "100000",
      maxDrawdown: "6",
      profitTarget: "10",
    });
  });

  it("should create challenge with active status", () => {
    expect(challengeAccount?.challengeStatus).toBe("active");
  });

  it("should convert challenge to funded on pass", async () => {
    const result = await caller.accounts.convertToFunded({
      challengeAccountId: challengeAccount?.id ?? "",
      name: "FTMO Funded",
      initialBalance: "100000",
      profitSplit: "80",
    });

    expect(result.challengeAccount.challengeStatus).toBe("passed");
    expect(result.fundedAccount?.accountType).toBe("prop_funded");
    expect(result.fundedAccount?.linkedAccountId).toBe(challengeAccount?.id);
  });

  it("should mark challenge as failed", async () => {
    const failedChallenge = await caller.accounts.create({
      name: "Failed Challenge",
      accountType: "prop_challenge",
      initialBalance: "50000",
    });

    const result = await caller.accounts.markChallengeFailed({
      id: failedChallenge?.id ?? "",
    });

    expect(result?.challengeStatus).toBe("failed");
  });
});
```

## Handling Edge Cases

### Decimal Precision

Database returns decimals as strings with precision. Always parse for comparisons:

```typescript
// Database returns "10000.00", not "10000"
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);

// For high-precision values
expect(parseFloat(trade?.quantity ?? "0")).toBe(2);

// Use toBeCloseTo for floating-point comparisons
expect(stats.winRate).toBeCloseTo(60, 0);
```

### Optional Values

Use nullish coalescing, never non-null assertions:

```typescript
// Good - passes biome linting
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);
await caller.accounts.delete({ id: account?.id ?? "" });

// Bad - biome lint error
expect(parseFloat(account!.initialBalance!)).toBe(10000);
```

### Assert Before Use

Always assert a value exists before using it:

```typescript
const account = await caller.accounts.create({ name: "Test" });
expect(account).toBeDefined();

// Now safe to use in subsequent operations
const stats = await caller.accounts.getStats({ id: account?.id ?? "" });
```

### Test Isolation

Don't rely on specific IDs—they auto-increment across test runs:

```typescript
// Bad - fragile
expect(account.id).toBe("account_1");

// Good - test properties, not IDs
expect(account.name).toBe("Expected Name");
expect(account.isDefault).toBe(true);
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Container runtime not found" | Docker not running | Start Docker Desktop |
| "TEST_DATABASE_URL not set" | Global setup failed | Check Docker is running, ports available |
| "Failed to create test user" | Database constraint violation | Ensure `truncateAllTables()` in beforeAll |
| Tests timeout | First run downloads PostgreSQL image | Wait for download (~150MB) |
| Flaky tests | State leaking between tests | Verify truncation, don't rely on IDs |

### Debugging Tests

```typescript
// Add console logs for debugging
it("should do something", async () => {
  const result = await caller.accounts.getAll();
  console.log("Accounts:", JSON.stringify(result, null, 2));
  expect(result.length).toBeGreaterThan(0);
});

// Use Drizzle directly for inspection
it("should verify database state", async () => {
  const db = getTestDb();
  const users = await db.select().from(schema.users);
  console.log("Users in DB:", users);
});
```

### Running Specific Tests

```bash
# Run single test file
bun run test accounts.test.ts

# Run tests matching pattern
bun run test -t "should create"

# Run with verbose output
bun run test --reporter verbose

# Run in watch mode
bun run test:watch
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `bun run test` | Run integration tests |
| `bunx vitest run --config vitest.config.unit.ts` | Run unit tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:e2e` | Run E2E smoke tests |
| `bun run test:coverage` | Run tests with coverage report |

---

## Unit Tests

For pure functions that don't need database access.

### Location & Config

- **Location:** `tests/unit/`
- **Config:** `vitest.config.unit.ts`
- **Run:** `bunx vitest run --config vitest.config.unit.ts`

### Good Candidates for Unit Tests

- Parsers (CSV, rule triggers)
- Generators (rule generator, hash functions)
- Utilities (formatters, calculators)
- Pure business logic with no DB dependencies

### Example Unit Test

```typescript
// tests/unit/rule-generator.test.ts
import { describe, expect, it } from "vitest";
import { parseRLevelFromTrigger } from "@/lib/strategy/rule-generator";

describe("parseRLevelFromTrigger", () => {
  it("should parse +1R pattern", () => {
    expect(parseRLevelFromTrigger("At +1R take 50%")).toBe(1);
  });

  it("should return null for text without R-level", () => {
    expect(parseRLevelFromTrigger("On pullback to EMA")).toBeNull();
  });
});
```

### Unit Test Structure

```typescript
import { describe, expect, it } from "vitest";
import { myPureFunction } from "@/lib/my-module";

describe("myPureFunction", () => {
  it("should handle normal input", () => {
    expect(myPureFunction(input)).toBe(expected);
  });

  it("should handle edge cases", () => {
    expect(myPureFunction(null)).toBe(defaultValue);
  });
});
```

---

## E2E Tests (Smoke Tests Only)

E2E tests are expensive (slow, flaky, hard to maintain). They exist to verify **critical user journeys work end-to-end**, not to test UI details.

### Good E2E Tests

- User can log in and see dashboard
- User can create a strategy and see it in the list
- User can import trades and see them in journal

### Bad E2E Tests (Don't Write These)

- Form shows validation error when name is empty
- Toggle switch changes state when clicked
- Button is disabled until form is valid
- Specific UI element has correct styling

These belong in **integration tests** (if they involve backend logic) or simply aren't worth testing.

### Example E2E Smoke Test

```typescript
test("can create a strategy and see it in the list", async ({ page }, testInfo) => {
  testInfo.setTimeout(60000);

  await page.goto("/strategies/new");
  await expect(page.getByTestId("strategy-form")).toBeVisible({ timeout: 15000 });

  const strategyName = `E2E Test ${Date.now()}`;
  await page.getByTestId("strategy-form-input-name").fill(strategyName);
  await page.getByTestId("strategy-form-button-submit").click();

  await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });
  await expect(page.getByTestId("strategy-detail-name")).toContainText(strategyName);
});
```

---

## Adding New Tests

### 1. Create Test File

Create a file in `tests/integration/` named `{domain}.test.ts`.

### 2. Set Up Imports

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
  createTestCaller,
  truncateAllTables,
  setupTrader,
  type TestCaller,
} from "../utils";
```

### 3. Set Up Test Suite

```typescript
describe("my-feature router", () => {
  let user: User;
  let caller: TestCaller;

  beforeAll(async () => {
    await truncateAllTables();
    const { user: u } = await setupTrader();
    user = u;
    caller = await createTestCaller(user.clerkId, user);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  // Your tests here
});
```

### 4. Write Domain-Focused Tests

Describe trading behavior, not implementation:

```typescript
// Good
it("should calculate P&L correctly for a winning long trade");
it("should reject trades for accounts the user doesn't own");
it("should set first account as default automatically");

// Avoid
it("should call create()");
it("works correctly");
it("should insert row into database");
```

### 5. Adding New Fixtures

If you need new fixture types, add them to `tests/utils/fixtures/`:

```typescript
// tests/utils/fixtures/executions.ts
export interface CreateTestExecutionOptions {
  // ...
}

export async function createTestExecution(
  tradeId: string,
  options: CreateTestExecutionOptions = {}
) {
  // ...
}
```

Then re-export from `tests/utils/fixtures/index.ts`.
