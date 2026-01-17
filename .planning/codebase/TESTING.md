# Testing Patterns

**Analysis Date:** 2026-01-17

## Test Framework

**Runner:**
- Vitest 4.0.16
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`)
- Globals enabled (`globals: true`)

**Run Commands:**
```bash
bun run test              # Run all tests once
bun run test:watch        # Watch mode
bun run test:integration  # Same as test (integration only)
bun run test:coverage     # Run with coverage report
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (separate from source)
- Integration tests: `tests/integration/{domain}/{feature}.test.ts`
- Test utilities: `tests/utils/`
- Fixtures: `tests/utils/fixtures/`
- Mocks: `tests/mocks/`

**Naming:**
- Test files: `{feature}.test.ts`
- No spec files used

**Structure:**
```
tests/
├── setup/
│   ├── global-setup.ts       # Container startup, schema push
│   ├── global-teardown.ts    # Container cleanup
│   └── test-env.ts           # Per-file setup, mocks, env vars
├── utils/
│   ├── index.ts              # Barrel export
│   ├── caller.ts             # tRPC caller factory
│   ├── context.ts            # Test context creation
│   ├── db.ts                 # Database utilities
│   ├── dates.ts              # Date helpers
│   └── fixtures/
│       ├── index.ts          # Fixture exports
│       ├── users.ts          # User fixtures
│       ├── accounts.ts       # Account fixtures
│       ├── trades.ts         # Trade fixtures
│       └── scenarios.ts      # Pre-composed setups
├── mocks/
│   └── trigger.ts            # Trigger.dev mock
├── integration/
│   ├── accounts/
│   │   └── accounts.test.ts
│   ├── analytics/
│   │   ├── overview.test.ts
│   │   ├── filters.test.ts
│   │   └── ...
│   ├── trades/
│   │   └── batch-import.test.ts
│   └── daily-journal/
│       └── journal.test.ts
└── e2e/                      # Excluded from Vitest runs
```

## Test Structure

**Suite Organization:**
```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
  createTestCaller,
  createTestUser,
  type TestCaller,
  truncateAllTables,
} from "../../utils";

describe("accounts router", () => {
  let user: User;
  let caller: TestCaller;

  beforeAll(async () => {
    await truncateAllTables();
    user = await createTestUser();
    caller = await createTestCaller(user.clerkId, user);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  // Nested describes for feature groups
  describe("create", () => {
    it("should create a basic account", async () => {
      const account = await caller.accounts.create({
        name: "My Trading Account",
        broker: "Interactive Brokers",
        platform: "other",
        accountType: "live",
        initialBalance: "25000",
        currency: "USD",
      });

      expect(account).toBeDefined();
      expect(account?.name).toBe("My Trading Account");
    });
  });

  // Section headers for major feature groups
  // ============================================================================
  // PROP FIRM CHALLENGE WORKFLOWS
  // ============================================================================
  describe("prop firm challenge lifecycle", () => { ... });
});
```

**Patterns:**
- `beforeAll`: Truncate tables, create user, create caller
- `afterAll`: Truncate tables (cleanup)
- Nested `describe` blocks for logical grouping
- Section comment headers (`// ====...`) for major feature areas

## Mocking

**Framework:** Vitest `vi.mock()`

**Patterns:**
```typescript
// tests/setup/test-env.ts
import { vi } from "vitest";
import { triggerMock } from "../mocks/trigger";

// Mock Trigger.dev tasks BEFORE any imports resolve
vi.mock("@/trigger/process-trade-maemfe", () => ({
  processTradeMAEMFE: {
    batchTrigger: async (
      items: Array<{ payload: { tradeId: string; userId: string } }>,
    ) => {
      triggerMock.batchTriggerCalls.push(items);
      return items.map((_, i) => ({
        id: `mock-run-${Date.now()}-${i}`,
        taskIdentifier: "process-trade-maemfe",
        ok: true as const,
      }));
    },
  },
}));
```

**Mock Utilities:**
```typescript
// tests/mocks/trigger.ts
export const triggerMock = {
  batchTriggerCalls: [] as Array<{ payload: { tradeId: string } }[]>,

  reset() {
    this.batchTriggerCalls = [];
  },

  getLastCall() {
    return this.batchTriggerCalls[this.batchTriggerCalls.length - 1];
  },

  getTotalTriggeredCount() {
    return this.batchTriggerCalls.reduce((sum, call) => sum + call.length, 0);
  },
};
```

**What to Mock:**
- External services (Trigger.dev background jobs)
- Clerk authentication (bypassed via context overrides)
- Environment variables (set in `test-env.ts`)

**What NOT to Mock:**
- Database - use real PostgreSQL via Testcontainers
- tRPC middleware - runs fully including auth checks
- Business logic - test real implementations

## Fixtures and Factories

**Test Data:**
```typescript
// Low-level fixture - creates single entity
export async function createTestUser(options: CreateTestUserOptions = {}) {
  const db = getTestDb();
  userCounter++;

  const clerkId = options.clerkId ?? `test_clerk_${userCounter}_${Date.now()}`;
  const email = options.email ?? `testuser${userCounter}@test.local`;

  const [user] = await db
    .insert(schema.users)
    .values({ clerkId, email, name, role })
    .returning();

  return user;
}

// Low-level fixture - creates trade with sensible defaults
export async function createTestTrade(
  userId: string,
  accountId: string,
  options: CreateTestTradeOptions = {},
) {
  const symbol = options.symbol ?? "ES";
  const direction = options.direction ?? "long";
  const status = options.status ?? "closed";
  const entryPrice = options.entryPrice ?? "5000.00";
  // Auto-calculates P&L if not provided...
}

// High-level scenario - composes multiple fixtures
export async function setupTraderWithMixedTrades(options?: {...}) {
  const { user, account } = await setupTrader({...});

  const winningTrades = await createTestTrades(user.id, account.id, winCount, {
    direction: "long",
    entryPrice: "5000.00",
    exitPrice: "5020.00", // +$1000 per contract
    status: "closed",
  });

  const losingTrades = await createTestTrades(user.id, account.id, lossCount, {
    direction: "long",
    entryPrice: "5000.00",
    exitPrice: "4990.00", // -$500 per contract
    status: "closed",
  });

  return { user, account, trades, winningTrades, losingTrades };
}
```

**Location:**
- `tests/utils/fixtures/` - All fixture files
- `tests/utils/fixtures/index.ts` - Re-exports all fixtures

**Available Fixtures:**

| Fixture | Creates | Use Case |
|---------|---------|----------|
| `createTestUser(options?)` | User | Basic user creation |
| `createTestAccount(userId, options?)` | Account | Account for existing user |
| `createTestTrade(userId, accountId, options?)` | Trade | Single trade |
| `createTestTrades(userId, accountId, count, options?)` | Multiple trades | Batch creation |
| `setupTrader()` | User + Account | Basic test setup |
| `setupTraderWithTrades(count)` | User + Account + Trades | Stats testing |
| `setupTraderWithMixedTrades()` | Wins + Losses | Win rate testing |
| `setupTraderWithAnalyticsData()` | Predictable analytics data | Analytics testing |
| `setupPropChallenge()` | Prop challenge account | Prop firm features |

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
bun run test:coverage
```

## Test Types

**Unit Tests:**
- Not currently used
- Business logic tested via integration tests

**Integration Tests:**
- Primary test type
- Real PostgreSQL via Testcontainers
- Full tRPC procedure execution including middleware
- Located in `tests/integration/`

**E2E Tests:**
- Directory exists (`tests/e2e/`) but excluded from Vitest runs
- Playwright not configured

## Common Patterns

**Async Testing:**
```typescript
it("should create a basic account", async () => {
  const account = await caller.accounts.create({
    name: "My Trading Account",
    accountType: "live",
  });

  expect(account).toBeDefined();
  expect(account?.name).toBe("My Trading Account");
});
```

**Error Testing:**
```typescript
it("should throw error for non-existent account", async () => {
  await expect(
    caller.accounts.getById({ id: "non-existent-id" }),
  ).rejects.toThrow("Account not found");
});

it("should throw error for account owned by another user", async () => {
  const otherUser = await createTestUser({ name: "Another User" });
  const otherAccount = await createTestAccount(otherUser.id, {
    name: "Private Account",
  });

  await expect(
    caller.accounts.getById({ id: otherAccount.id }),
  ).rejects.toThrow("Account not found");
});
```

**Authorization Testing:**
```typescript
describe("authorization", () => {
  it("should not allow accessing another user's account", async () => {
    const otherUser = await createTestUser({ name: "Unauthorized User" });
    const otherAccount = await createTestAccount(otherUser.id, {
      name: "Secret Account",
    });

    // Access denied - returns "not found" (don't reveal existence)
    await expect(
      caller.accounts.getById({ id: otherAccount.id }),
    ).rejects.toThrow("Account not found");

    await expect(
      caller.accounts.update({ id: otherAccount.id, name: "Hacked" }),
    ).rejects.toThrow("Account not found");
  });
});
```

**Decimal Precision Testing:**
```typescript
// Database returns strings with precision
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);
expect(parseFloat(trade?.realizedPnl ?? "0")).toBe(1000);

// Use toBeCloseTo for calculated values
expect(result.winRate).toBeCloseTo(66.67, 1);
expect(result.profitFactor).toBeCloseTo(4.52, 1);
```

**Edge Case Testing:**
```typescript
describe("Edge Cases", () => {
  it("should return zeros when no trades exist", async () => {
    const { user: emptyUser, account: emptyAccount } = await setupTrader();
    const emptyCaller = await createTestCaller(emptyUser.clerkId, emptyUser);

    const result = await emptyCaller.analytics.getOverview({
      accountId: emptyAccount.id,
    });

    expect(result.totalPnl).toBe(0);
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
  });
});
```

## Database Testing

**Container Setup:**
```typescript
// tests/setup/global-setup.ts
export async function setup() {
  container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("testdb")
    .withUsername("testuser")
    .withPassword("testpassword")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  // Push schema using drizzle-kit
  execSync(
    `npx drizzle-kit push --dialect postgresql --schema ./src/server/db/schema.ts --url "${connectionUrl}"`,
  );

  return async () => {
    await container.stop();
  };
}
```

**Table Truncation:**
```typescript
// tests/utils/db.ts
export async function truncateAllTables() {
  const db = getTestDb();
  await db.execute(sql`
    DO $$
    BEGIN
      SET session_replication_role = replica;
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      SET session_replication_role = DEFAULT;
    END $$;
  `);
}
```

**Test Caller Creation:**
```typescript
// tests/utils/caller.ts
export async function createTestCaller(clerkId: string, user?: User) {
  const ctx = await createTestContext(clerkId, user);
  return createCaller(ctx);
}

// Context bypasses Clerk but runs all tRPC middleware
export async function createTestContext(clerkId: string, user?: User) {
  const db = getTestDb();
  const overrides: TRPCContextOverrides = {
    db,
    userId: clerkId,
    user,
  };
  return createTRPCContext({ headers: new Headers() }, overrides);
}
```

## Timeouts

**Configuration (vitest.config.ts):**
```typescript
test: {
  testTimeout: 30000,  // 30s for tests (container startup can be slow)
  hookTimeout: 60000,  // 60s for setup/teardown
  fileParallelism: false,  // Sequential to avoid port conflicts
}
```

---

*Testing analysis: 2026-01-17*
