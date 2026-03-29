---
name: testing
description: Testing strategy and patterns for validating TheTraderLog behavior.
---

# Testing Skill

You are a test engineer working on TheTraderLog, a professional trading journal application. You write tests that validate trading behavior using domain-driven language.

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

**Integration tests are king.** They're fast, reliable, and test real business logic with a real DB.

**Unit tests for pure logic.** Parsers, generators, utilities that don't need database access.

**E2E tests are smoke tests only.** Don't write detailed UI tests for form validation, toggle states, or button behaviors.

---

## Testing Philosophy

### 1. Test Trading Behavior, Not Implementation

Tests should read like trading scenarios:

**Good:**
```typescript
it("should calculate P&L correctly for a winning long trade", async () => {
  // A trader goes long ES at 5000, exits at 5020
  // Expected profit: 20 points × $50/point = $1000
});
```

**Avoid:**
```typescript
it("should call the database insert method with correct parameters", async () => {
  // This tests implementation, not behavior
});
```

### 2. Real Database, Real Behavior

We use **Testcontainers PostgreSQL**—not mocks or SQLite.

**Why for a trading app:**
- P&L calculations require decimal precision
- Enum constraints (trade direction, status) are enforced
- Foreign keys (user → account → trade) are validated
- Concurrent operations behave as production

### 3. Isolation by Test File

Each test file = its own trading session with isolated user/account context.

```
accounts.test.ts     → Creates User A, tests account operations
trades.test.ts       → Creates User B, tests trade operations
```

**Within a file**, tests can build on each other:
```typescript
describe("trade lifecycle", () => {
  it("should create an open trade");      // Creates trade
  it("should update trade notes");         // Uses same trade
  it("should close the trade with P&L");   // Closes same trade
});
```

**Between files**, tables are truncated for a clean slate.

## Test File Structure

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestCaller,
  truncateAllTables,
  setupTrader,
  type TestCaller,
} from "../utils";

describe("my-feature router", () => {
  let caller: TestCaller;

  beforeAll(async () => {
    await truncateAllTables();
    const { user } = await setupTrader();
    caller = await createTestCaller(user.clerkId, user);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  it("should do something", async () => {
    // Test code
  });
});
```

## Fixtures

### Data Dependencies

```
User (required)
 └── Account (requires User)
      └── Trade (requires User + Account)
           └── Execution (requires Trade)
```

### Low-Level Fixtures

| Fixture | Creates | Requires |
|---------|---------|----------|
| `createTestUser(options?)` | User in DB | Nothing |
| `createTestAccount(userId, options?)` | Account | User ID |
| `createTestTrade(userId, accountId, options?)` | Trade | User ID + Account ID |
| `createTestTrades(userId, accountId, count, options?)` | Multiple trades | User ID + Account ID |

### High-Level Scenarios

| Scenario | Creates | Use Case |
|----------|---------|----------|
| `setupTrader()` | User + default Account | Basic test setup |
| `setupTraderWithTrades(count)` | User + Account + N closed trades | Statistics testing |
| `setupTraderWithMultipleAccounts(count)` | User + N accounts | Multi-account features |
| `setupPropChallenge()` | User + prop challenge account | Prop firm testing |
| `setupTraderWithMixedTrades()` | User + Account + wins + losses | Win rate, P&L testing |

### Utility Functions

| Function | Purpose |
|----------|---------|
| `truncateAllTables()` | Clear all data between test files |
| `createTestCaller(clerkId, user?)` | Create authenticated tRPC caller |
| `createUnauthenticatedCaller()` | Create unauthenticated caller (for auth tests) |
| `getTestDb()` | Get raw Drizzle DB instance |

## Conventions

### Naming Tests

Describe **behavior**, not the method:

```typescript
// Good
it("should set the first account as default automatically")
it("should calculate P&L correctly for a short trade")
it("should reject trades for accounts the user doesn't own")

// Avoid
it("should call create()")
it("works correctly")
```

### Handling Optional Values

Use nullish coalescing, never non-null assertions:

```typescript
// Good
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);
await caller.accounts.delete({ id: account?.id ?? 0 });

// Avoid (biome lint error)
expect(parseFloat(account!.initialBalance!)).toBe(10000);
```

### Asserting Before Using

```typescript
const account = await caller.accounts.create({ name: "Test" });
expect(account).toBeDefined();

// Now safe to use
const stats = await caller.accounts.getStats({ id: account?.id ?? 0 });
```

### Decimal Precision

Database returns decimals as strings:

```typescript
// Database returns "10000.00", not "10000"
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);

// For values with decimal places
expect(parseFloat(trade?.quantity ?? "0")).toBe(2);
```

## Test Patterns by Domain

### Account Tests

```typescript
describe("accounts router", () => {
  beforeAll(async () => {
    await truncateAllTables();
    user = await createTestUser();
    caller = await createTestCaller(user.clerkId, user);
  });

  it("should create an account", async () => {
    const account = await caller.accounts.create({
      name: "My Account",
      platform: "mt4",
      accountType: "demo",
      initialBalance: "10000",
    });
    expect(account?.name).toBe("My Account");
  });

  it("should set first account as default", async () => {
    const accounts = await caller.accounts.getAll();
    expect(accounts[0]?.isDefault).toBe(true);
  });
});
```

### Trade Tests

```typescript
describe("trades router", () => {
  beforeAll(async () => {
    await truncateAllTables();
    const setup = await setupTrader();
    user = setup.user;
    account = setup.account;
    caller = await createTestCaller(user.clerkId, user);
  });

  it("should calculate P&L for a long trade", async () => {
    const trade = await caller.trades.create({
      symbol: "ES",
      instrumentType: "futures",
      direction: "long",
      entryPrice: "5000.00",
      exitPrice: "5010.00",
      quantity: "1",
      accountId: account.id,
      entryTime: new Date().toISOString(),
      exitTime: new Date().toISOString(),
    });

    // ES is $50/point, 10 points = $500
    expect(parseFloat(trade?.realizedPnl ?? "0")).toBe(500);
  });
});
```

### Statistics Tests

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
    // 6 wins / 10 decisive trades = 60%
    expect(stats.winRate).toBeCloseTo(60, 0);
  });
});
```

### Auth Tests

```typescript
it("should reject unauthenticated requests", async () => {
  const unauthCaller = await createUnauthenticatedCaller();
  await expect(unauthCaller.accounts.getAll()).rejects.toThrow("UNAUTHORIZED");
});
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run test` | Run integration tests |
| `bunx vitest run --config vitest.config.unit.ts` | Run unit tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:e2e` | Run E2E smoke tests |
| `bun run test:coverage` | Run tests with coverage report |

## File Locations

| Path | Purpose |
|------|---------|
| `tests/integration/` | Integration tests (tRPC routers) |
| `tests/unit/` | Unit tests (pure functions) |
| `tests/e2e/` | E2E smoke tests (Playwright) |
| `tests/utils/` | Test utilities and fixtures |
| `tests/setup.ts` | Global test setup (Testcontainers) |
| `vitest.config.ts` | Vitest configuration (integration) |
| `vitest.config.unit.ts` | Vitest configuration (unit) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Container runtime not found" | Start Docker Desktop |
| "TEST_DATABASE_URL not set" | Global setup failed—check Docker |
| Tests are slow | First run downloads PostgreSQL image (~150MB) |
| Flaky tests | Ensure `truncateAllTables()` in beforeAll, don't rely on specific IDs |

## Reference

For complete testing documentation including architecture diagrams and advanced patterns:
- [Full Testing Guide](./TESTING_REFERENCE.md)
- [tests/README.md](../../../tests/README.md)
