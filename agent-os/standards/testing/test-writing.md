## Testing (Vitest + Testcontainers)

EdgeJournal uses Vitest with real PostgreSQL via Testcontainers for integration testing. Tests verify trading domain behavior, not implementation details.

### Testing Philosophy

**Behavioral Integration Tests**:
- Test trading scenarios, not database operations
- Use real PostgreSQL (not mocks or SQLite)
- Validate business logic and data integrity
- Tests read like trading workflows

**Example**:
```ts
// Good: Trading scenario
it("should calculate P&L correctly for a winning long trade", async () => {
  const trade = await caller.trades.create({
    symbol: "ES",
    direction: "long",
    entryPrice: "5000.00",
    exitPrice: "5100.00",
    quantity: "1",
    accountId: account.id,
  });

  expect(parseFloat(trade.netPnl ?? "0")).toBeGreaterThan(0);
});

// Bad: Implementation detail
it("should call db.insert with trade values", async () => { /* ... */ });
```

### Test Setup (Testcontainers)

**Global Setup** (`tests/setup/global-setup.ts`):
```ts
export default async function globalSetup() {
  // Start PostgreSQL 15-alpine container
  const container = await new PostgreSQLContainer().start();

  // Push schema to test database
  const DATABASE_URL = container.getConnectionString();
  execSync("bun run db:push", {
    env: { ...process.env, DATABASE_URL },
  });

  process.env.TEST_DATABASE_URL = DATABASE_URL;

  return async () => {
    await container.stop();
  };
}
```

**Every test run gets fresh PostgreSQL with current schema.**

### Test File Structure

**Isolation by File, Composable Within**:

```ts
describe("accounts router", () => {
  let user: User;
  let caller: TestCaller;

  beforeAll(async () => {
    // Clean slate for this test file
    await truncateAllTables();

    // Create user and authenticated caller
    user = await createTestUser();
    caller = await createTestCaller(user.clerkId, user);
  });

  afterAll(async () => {
    // Clean up for next test file
    await truncateAllTables();
  });

  it("should create an account", async () => {
    const account = await caller.accounts.create({
      name: "Demo Account",
      accountType: "demo",
      initialBalance: "10000",
    });

    expect(account?.name).toBe("Demo Account");
  });

  it("should get all accounts for user", async () => {
    // Builds on previous test's account
    const accounts = await caller.accounts.getAll();
    expect(accounts.length).toBeGreaterThan(0);
  });
});
```

**Key Patterns**:
- Each `.test.ts` file is isolated from others
- Tests within a file can build on each other
- `beforeAll`: truncate + create user/caller
- `afterAll`: truncate for next file

### Fixtures

**Low-Level Fixtures** (atomic):
```ts
// Create user
const user = await createTestUser();

// Create account
const account = await createTestAccount(user.id, {
  accountType: "demo",
  initialBalance: "10000",
});

// Create trade
const trade = await createTestTrade(user.id, account.id, {
  symbol: "ES",
  direction: "long",
  entryPrice: "5000.00",
  exitPrice: "5100.00",
});
```

**High-Level Scenarios** (composed):
```ts
// User + default account
const { user, account, caller } = await setupTrader();

// User + account + N trades
const { user, account, trades, caller } = await setupTraderWithTrades(10);

// User + wins and losses
const { user, account, caller } = await setupTraderWithMixedTrades(5, 3);

// Prop challenge
const { user, account, caller } = await setupPropChallenge();
```

### Authentication in Tests

**Auth Bypassed, Business Logic Enforced**:

```ts
// Create authenticated caller
const caller = await createTestCaller(user.clerkId, user);

// All tRPC middleware still runs
// Ownership validation enforced
const trade = await caller.trades.create({ /* ... */ });

// Unauthenticated caller
const unauthedCaller = await createUnauthenticatedCaller();

// Correctly receives UNAUTHORIZED error
await expect(unauthedCaller.trades.getAll()).rejects.toThrow("UNAUTHORIZED");
```

**Clerk is mocked, but user ownership checks still work.**

### Testing Patterns

**CRUD Operations**:
```ts
it("should create, read, update, and delete an account", async () => {
  const created = await caller.accounts.create({
    name: "Test Account",
    accountType: "demo",
    initialBalance: "10000",
  });

  const fetched = await caller.accounts.getById({ id: created.id });
  expect(fetched?.name).toBe("Test Account");

  const updated = await caller.accounts.update({
    id: created.id,
    name: "Updated Name",
  });
  expect(updated?.name).toBe("Updated Name");

  await caller.accounts.delete({ id: created.id });
  const deleted = await caller.accounts.getById({ id: created.id });
  expect(deleted).toBeUndefined();
});
```

**Authorization Testing**:
```ts
it("should not allow access to other user's trades", async () => {
  const otherUser = await createTestUser();
  const otherAccount = await createTestAccount(otherUser.id);
  const otherTrade = await createTestTrade(otherUser.id, otherAccount.id);

  // Current user cannot access other user's trade
  const trade = await caller.trades.getById({ id: otherTrade.id });
  expect(trade).toBeUndefined();
});
```

**Decimal Precision**:
```ts
it("should maintain 8 decimal precision for forex prices", async () => {
  const trade = await caller.trades.create({
    symbol: "EURUSD",
    instrumentType: "forex",
    entryPrice: "1.12345678",  // 8 decimals
    exitPrice: "1.12456789",
    // ...
  });

  expect(trade.entryPrice).toBe("1.12345678");
});
```

### Decimal Handling in Tests

**Always parse before comparison**:
```ts
const account = await caller.accounts.create({
  initialBalance: "10000.00",
});

// Parse string to number
const balance = parseFloat(account.initialBalance ?? "0");
expect(balance).toBe(10000);
```

### Test Naming

**Describe behavior, not methods**:
```ts
// Good
it("should calculate P&L correctly for a short trade")
it("should prevent deletion of linked prop challenge account")
it("should return trades sorted by entry time descending")

// Bad
it("should call create()")
it("tests the delete method")
it("getAll works")
```

### Commands

```bash
bun run test              # Run all tests once
bun run test:watch        # Watch mode
bun run test:integration  # Integration tests only
bun run test:coverage     # Coverage report
```

### Best Practices

- **Real Database**: Testcontainers ensures production-like behavior
- **Test Trading Scenarios**: Not implementation details
- **Isolation by File**: Each file starts fresh
- **Composable Fixtures**: Build complex scenarios from simple parts
- **No Mocks for DB**: Use real PostgreSQL
- **Parse Decimals**: Use `parseFloat()` for comparisons
- **Auth Bypassed**: But business logic (ownership) still enforced
- **Clear Test Names**: Describe behavior in plain English
- **Truncate Pattern**: `beforeAll` and `afterAll` ensure clean slate
- **Type Safety**: Leverage TypeScript for test code too
