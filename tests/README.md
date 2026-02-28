# EdgeJournal Testing Guide

> **💡 Claude Code Skill Available:** For AI-assisted test development, use the `testing` skill located at `.claude/skills/testing/`. The skill provides contextual guidance for writing tests following these patterns, fixtures, and conventions.

This document establishes the testing philosophy and conventions for EdgeJournal. It serves as a reference for both developers and AI assistants when writing or maintaining tests.

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

| Layer | Purpose | Speed | Tools | Location |
|-------|---------|-------|-------|----------|
| **Integration** | Business logic, tRPC, DB | Fast (ms) | Vitest + Testcontainers | `tests/integration/` |
| **Unit** | Pure functions, parsers, utilities | Fast (ms) | Vitest (no DB) | `tests/unit/` |
| **E2E** | Critical user flows (smoke tests) | Slow (s) | Playwright | `tests/e2e/` |

### When to Use Each Test Type

**Integration tests (primary):**
- Can I test this with a tRPC call? → Integration test
- Testing database operations, business logic, auth

**Unit tests:**
- Is this a pure function with no DB? → Unit test
- Parsers, generators, formatters, utilities

**E2E tests (smoke tests only):**
- Is this a critical user journey? → E2E smoke test
- Login flow, create resource flow, critical paths
- **NOT** for form validation, toggle states, or UI details

### Commands

| Command | Description |
|---------|-------------|
| `bun run test` | Run integration tests |
| `bunx vitest run --config vitest.config.unit.ts` | Run unit tests |
| `bun run test:e2e` | Run E2E smoke tests |

---

## Testing Philosophy

### 1. Test the Trading Domain, Not Implementation

Tests should read like trading scenarios, not technical operations.

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

We use **Testcontainers PostgreSQL** to run tests against a real database, not mocks or SQLite.

**Why this matters for trading apps:**
- P&L calculations must handle decimal precision correctly
- Enum constraints (trade direction, status) are enforced
- Foreign key relationships (user → account → trade) are validated
- Concurrent operations behave as they would in production

### 3. Isolation by Test File, Not Test Case

Each test file represents a **trading session** with its own user and account context.

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

### 4. Auth is Bypassed, Business Logic is Not

Clerk authentication is bypassed at the context level, but **all tRPC middleware runs**:

- User ownership checks are enforced
- The auth middleware creates users in the database
- Protected procedures reject unauthenticated requests

```typescript
// This WILL throw UNAUTHORIZED
const unauthCaller = await createUnauthenticatedCaller();
await unauthCaller.accounts.getAll(); // ❌ Throws

// This works - user is injected into context
const caller = await createTestCaller(user.clerkId, user);
await caller.accounts.getAll(); // ✅ Returns user's accounts
```

### 5. Composable Fixtures Follow Data Dependencies

The trading domain has strict data dependencies:

```
User (required)
 └── Account (requires User)
      └── Trade (requires User + Account)
           └── Execution (requires Trade)
```

Fixtures are **composable building blocks**:

```typescript
// Low-level: create exactly what you need
const user = await createTestUser();
const account = await createTestAccount(user.id);
const trade = await createTestTrade(user.id, account.id);

// High-level: pre-composed scenarios
const { user, account, trades } = await setupTraderWithMixedTrades();
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vitest                                   │
├─────────────────────────────────────────────────────────────────┤
│  Global Setup                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Start PostgreSQL container (Testcontainers)              ││
│  │ 2. Push schema via drizzle-kit push                         ││
│  │ 3. Export DATABASE_URL to environment                       ││
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

---

## Fixture Reference

### Low-Level Fixtures

| Fixture | Creates | Requires | Example |
|---------|---------|----------|---------|
| `createTestUser(options?)` | User in DB | Nothing | `createTestUser({ name: "Trader" })` |
| `createTestAccount(userId, options?)` | Account | User ID | `createTestAccount(user.id, { platform: "mt4" })` |
| `createTestTrade(userId, accountId, options?)` | Trade | User ID + Account ID | `createTestTrade(user.id, account.id, { symbol: "ES" })` |
| `createTestTrades(userId, accountId, count, options?)` | Multiple trades | User ID + Account ID | `createTestTrades(user.id, account.id, 5)` |

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

---

## Conventions

### Naming Tests

Use descriptive names that describe the **behavior**, not the method:

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

Use nullish coalescing with safe defaults, never non-null assertions:

```typescript
// Good
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);
await caller.accounts.delete({ id: account?.id ?? 0 });

// Avoid (biome lint error)
expect(parseFloat(account!.initialBalance!)).toBe(10000);
```

### Asserting Before Using

Always assert a value exists before using it:

```typescript
const account = await caller.accounts.create({ name: "Test" });
expect(account).toBeDefined();

// Now safe to use
const stats = await caller.accounts.getStats({ id: account?.id ?? 0 });
```

### Decimal Precision

Database returns decimals as strings with precision. Parse them for comparison:

```typescript
// Database returns "10000.00", not "10000"
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);

// For P&L with 8 decimal places
expect(parseFloat(trade?.quantity ?? "0")).toBe(2);
```

---

## Test Patterns by Domain

### Accounts

```typescript
describe("accounts router", () => {
  // Setup: Create user, get caller
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

### Trades

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

### Statistics

```typescript
describe("statistics", () => {
  beforeAll(async () => {
    await truncateAllTables();
    // Setup with known win/loss distribution
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

---

## Commands

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

**Location:** `tests/unit/`
**Config:** `vitest.config.unit.ts`

### Good Candidates for Unit Tests

- Parsers (CSV, rule triggers)
- Generators (rule generator, hash functions)
- Utilities (formatters, calculators)
- Pure business logic with no DB dependencies

### Example

```typescript
// tests/unit/rule-generator.test.ts
describe("parseRLevelFromTrigger", () => {
  it("should parse +1R pattern", () => {
    expect(parseRLevelFromTrigger("At +1R take 50%")).toBe(1);
  });
});
```

---

## Troubleshooting

### "Container runtime not found"

Docker must be running. Start Docker Desktop or your container runtime.

### "TEST_DATABASE_URL not set"

The global setup failed. Check Docker is running and ports are available.

### Tests are slow

First run downloads the PostgreSQL Docker image (~150MB). Subsequent runs reuse it.

### Flaky tests

- Ensure `truncateAllTables()` is called in `beforeAll`
- Don't rely on specific IDs (they auto-increment across test runs)
- Use `expect().toBeDefined()` before accessing properties

---

## Adding New Tests

### Integration Tests

1. Create a file in `tests/integration/` named `{domain}.test.ts`
2. Import utilities from `../utils`
3. Set up user and caller in `beforeAll`
4. Truncate tables in `beforeAll` and `afterAll`
5. Write tests that describe trading behavior

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

### Unit Tests

1. Create a file in `tests/unit/` named `{module}.test.ts`
2. No database setup needed
3. Import directly from `@/lib/...`

```typescript
import { describe, expect, it } from "vitest";
import { myPureFunction } from "@/lib/my-module";

describe("myPureFunction", () => {
  it("should return expected result", () => {
    expect(myPureFunction(input)).toBe(expected);
  });
});
```

### E2E Tests (Smoke Tests Only)

E2E tests are expensive. Only add them for critical user journeys:
- User can log in and see dashboard
- User can create a resource and see it
- User can complete a critical flow end-to-end

**Do NOT write E2E tests for:**
- Form validation details
- Toggle/switch state changes
- Button disabled states
- Specific styling or layout

