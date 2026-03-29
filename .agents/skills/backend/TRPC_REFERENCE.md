# tRPC Backend Reference

Complete reference for TheTraderLog tRPC patterns, extracted from existing routers.

## Table of Contents

1. [Context & Authentication](#1-context--authentication)
2. [Input Validation](#2-input-validation)
3. [Procedure Structure](#3-procedure-structure)
4. [Ownership Verification](#4-ownership-verification)
5. [Database Query Patterns](#5-database-query-patterns)
6. [Filtering & Conditional Logic](#6-filtering--conditional-logic)
7. [Pagination](#7-pagination)
8. [Data Type Handling](#8-data-type-handling)
9. [Transactions & Batch Operations](#9-transactions--batch-operations)
10. [Statistics & Aggregation](#10-statistics--aggregation)
11. [Error Handling](#11-error-handling)
12. [Performance Optimization](#12-performance-optimization)
13. [Router-Specific Patterns](#13-router-specific-patterns)
14. [Drizzle ORM Patterns](#14-drizzle-orm-patterns)
15. [Helper Functions](#15-helper-functions)
16. [Testing Patterns](#16-testing-patterns)

---

## 1. Context & Authentication

### Context Creation

```typescript
// src/server/api/trpc.ts
export const createTRPCContext = async (opts: {
  headers: Headers;
  overrides?: TRPCContextOverrides;
}) => {
  const userId = opts.overrides?.userId ?? (await auth()).userId;

  // Auto-sync user on first login
  if (userId) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!existingUser) {
      await db.insert(users).values({ id: userId });
    }
  }

  return { db, userId, user: existingUser };
};
```

### Middleware Chain

```typescript
// Timing middleware (all procedures)
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = performance.now();
  const result = await next();
  const duration = performance.now() - start;
  console.log(`[tRPC] ${path} - ${duration.toFixed(2)}ms`);
  return result;
});

// Auth middleware (protected procedures)
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const user = await ctx.db.query.users.findFirst({
    where: eq(users.id, ctx.userId),
  });
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

  return next({ ctx: { ...ctx, user } });
});

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);
```

---

## 2. Input Validation

### Common Schema Patterns

```typescript
// Single resource
z.object({ id: z.string() })

// Batch operations
z.object({
  ids: z.array(z.string()).min(1).max(100)
})

// Date ranges
z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// Enums with defaults
z.object({
  accountType: z.enum(["demo", "live", "prop_challenge", "prop_funded"])
    .default("live"),
  direction: z.enum(["long", "short"]),
})

// Pagination
z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().nullish(),
})

// Optional objects
z.object({
  filters: z.object({
    symbol: z.string().optional(),
    status: z.enum(["open", "closed"]).optional(),
  }).optional(),
})

// Decimal fields (stored as strings)
z.object({
  entryPrice: z.string(),
  quantity: z.string(),
  fees: z.string().default("0"),
})
```

### Schema Composition

```typescript
const baseAccountInput = z.object({
  name: z.string().min(1).max(100),
  broker: z.string().optional(),
  currency: z.string().default("USD"),
});

const propAccountInput = baseAccountInput.merge(z.object({
  initialBalance: z.string(),
  profitTarget: z.string().optional(),
  maxDrawdown: z.string().optional(),
}));
```

---

## 3. Procedure Structure

### Query Procedure

```typescript
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const record = await ctx.db.query.trades.findFirst({
      where: and(
        eq(trades.id, input.id),
        eq(trades.userId, ctx.user.id)
      ),
      with: { account: true, strategy: true },
    });

    if (!record) throw new Error("Trade not found");
    return record;
  }),
```

### Mutation Procedure

```typescript
create: protectedProcedure
  .input(createTradeInput)
  .mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(trades)
      .values({
        ...input,
        userId: ctx.user.id,
        createdAt: new Date(),
      })
      .returning();

    return created;
  }),
```

### Optional Input

```typescript
list: protectedProcedure
  .input(z.object({
    accountId: z.string().optional(),
    status: z.enum(["open", "closed"]).optional(),
  }).optional())
  .query(async ({ ctx, input }) => {
    // input may be undefined
    const accountId = input?.accountId;
  }),
```

---

## 4. Ownership Verification

### Single Resource

```typescript
const record = await ctx.db.query.trades.findFirst({
  where: and(
    eq(trades.id, input.id),
    eq(trades.userId, ctx.user.id)
  ),
});

if (!record) throw new Error("Not found");
```

### Before Update/Delete

```typescript
// Verify ownership first
const existing = await ctx.db.query.accounts.findFirst({
  where: and(
    eq(accounts.id, input.id),
    eq(accounts.userId, ctx.user.id)
  ),
});

if (!existing) throw new Error("Account not found");

// Then perform operation
await ctx.db
  .update(accounts)
  .set(input.data)
  .where(eq(accounts.id, input.id));
```

### Bulk Operations

```typescript
// Verify ALL records exist and belong to user
const existing = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    inArray(trades.id, input.ids)
  ),
});

if (existing.length !== input.ids.length) {
  throw new Error("Some trades not found or not owned by user");
}

// Then batch update
await ctx.db
  .update(trades)
  .set({ status: "archived" })
  .where(inArray(trades.id, input.ids));
```

---

## 5. Database Query Patterns

### Basic Queries

```typescript
// Find first
const trade = await ctx.db.query.trades.findFirst({
  where: eq(trades.id, input.id),
});

// Find many
const allTrades = await ctx.db.query.trades.findMany({
  where: eq(trades.userId, ctx.user.id),
  orderBy: [desc(trades.entryTime)],
  limit: 100,
});
```

### Selective Column Fetching

```typescript
// Only fetch needed columns
const results = await ctx.db
  .select({
    id: trades.id,
    symbol: trades.symbol,
    netPnl: trades.netPnl,
    exitTime: trades.exitTime,
  })
  .from(trades)
  .where(eq(trades.userId, ctx.user.id));
```

### Relationship Loading

```typescript
const trade = await ctx.db.query.trades.findFirst({
  where: eq(trades.id, input.id),
  with: {
    account: true,
    strategy: true,
    executions: true,
    tradeTags: {
      with: { tag: true },
    },
    screenshots: true,
  },
});
```

### Count Queries

```typescript
const [result] = await ctx.db
  .select({ count: sql<number>`count(*)` })
  .from(trades)
  .where(and(
    eq(trades.userId, ctx.user.id),
    eq(trades.status, "closed")
  ));

const totalTrades = result?.count ?? 0;
```

### Returning After Mutation

```typescript
const [updated] = await ctx.db
  .update(trades)
  .set({ status: "closed", exitTime: new Date() })
  .where(eq(trades.id, input.id))
  .returning();

return updated;
```

---

## 6. Filtering & Conditional Logic

### Dynamic Condition Building

```typescript
const conditions: SQL[] = [eq(trades.userId, ctx.user.id)];

if (input?.accountId) {
  conditions.push(eq(trades.accountId, input.accountId));
}

if (input?.symbol) {
  conditions.push(eq(trades.symbol, input.symbol));
}

if (input?.startDate) {
  conditions.push(gte(trades.entryTime, new Date(input.startDate)));
}

if (input?.endDate) {
  conditions.push(lte(trades.exitTime, new Date(input.endDate)));
}

if (input?.direction) {
  conditions.push(eq(trades.direction, input.direction));
}

if (input?.status) {
  conditions.push(eq(trades.status, input.status));
}

// Exclude soft-deleted
conditions.push(isNull(trades.deletedAt));

const results = await ctx.db.query.trades.findMany({
  where: and(...conditions),
  orderBy: [desc(trades.entryTime)],
});
```

### Search Pattern

```typescript
if (input?.search) {
  const searchTerm = `%${input.search}%`;
  conditions.push(or(
    ilike(trades.symbol, searchTerm),
    ilike(trades.notes, searchTerm),
  ));
}
```

### Post-Query Filtering

```typescript
// When DB filtering isn't practical (e.g., junction tables)
let items = await ctx.db.query.trades.findMany({
  where: and(...conditions),
  with: { tradeTags: true },
});

// Filter by tags in memory
if (input?.tagIds && input.tagIds.length > 0) {
  items = items.filter((trade) => {
    const tradeTagIds = trade.tradeTags.map(tt => tt.tagId);
    return input.tagIds.some(id => tradeTagIds.includes(id));
  });
}
```

---

## 7. Pagination

### Cursor-Based Pagination

```typescript
list: protectedProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().nullish(),
  }).optional())
  .query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 50;
    const conditions = [eq(trades.userId, ctx.user.id)];

    // Cursor is the last item's ID
    if (input?.cursor) {
      conditions.push(sql`${trades.id} < ${input.cursor}`);
    }

    // Fetch one extra to detect next page
    let items = await ctx.db.query.trades.findMany({
      where: and(...conditions),
      orderBy: [desc(trades.id)],
      limit: limit + 1,
    });

    let nextCursor: string | undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }),
```

---

## 8. Data Type Handling

### Decimal/String Precision

```typescript
// Schema: decimal(precision: 20, scale: 8)
// Stored as string for precision

// Reading - parse for calculations
const entryPrice = parseFloat(trade.entryPrice);
const exitPrice = parseFloat(trade.exitPrice ?? "0");
const pnl = (exitPrice - entryPrice) * quantity;

// Writing - convert back to string
const netPnl = pnl.toFixed(2);
await ctx.db.update(trades).set({ netPnl });

// Comparison with nullish handling
const isProfit = trade.netPnl ? parseFloat(trade.netPnl) > 0 : false;
```

### Date Handling

```typescript
// Input: ISO datetime string
const inputSchema = z.object({
  entryTime: z.string().datetime(),
});

// Convert to Date for DB
await ctx.db.insert(trades).values({
  entryTime: new Date(input.entryTime),
});

// Return: Convert back to ISO for JSON
return {
  ...trade,
  entryTime: trade.entryTime.toISOString(),
};
```

### JSON Storage

```typescript
// Complex objects stored as JSON strings
await ctx.db.insert(strategies).values({
  riskParameters: JSON.stringify(input.riskParameters),
  scalingRules: JSON.stringify(input.scalingRules),
});

// Retrieval
const strategy = await ctx.db.query.strategies.findFirst({...});
return {
  ...strategy,
  riskParameters: strategy.riskParameters
    ? JSON.parse(strategy.riskParameters)
    : null,
};
```

---

## 9. Transactions & Batch Operations

### Batch Insert

```typescript
// Insert multiple records efficiently
await ctx.db.insert(tradeTags).values(
  input.tagIds.map(tagId => ({
    tradeId: newTrade.id,
    tagId,
  }))
);
```

### Atomic Operations

```typescript
// Example: Setting default account
// Step 1: Unset all current defaults
await ctx.db
  .update(accounts)
  .set({ isDefault: false })
  .where(eq(accounts.userId, ctx.user.id));

// Step 2: Set new default
const [updated] = await ctx.db
  .update(accounts)
  .set({ isDefault: true })
  .where(eq(accounts.id, input.id))
  .returning();

return updated;
```

### Cascade Operations

```typescript
// When deleting account, handle related trades
await ctx.db
  .update(trades)
  .set({ accountId: null })
  .where(eq(trades.accountId, input.id));

// Then delete account
await ctx.db.delete(accounts).where(eq(accounts.id, input.id));
```

---

## 10. Statistics & Aggregation

### Using Shared Calculation Functions

```typescript
import { calculateAggregateStats } from "~/lib/stats-calculations";

const closedTrades = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    eq(trades.status, "closed")
  ),
});

const stats = calculateAggregateStats(closedTrades, breakevenThreshold);
// Returns: { totalTrades, wins, losses, breakevens, winRate, totalPnl, avgPnl, ... }
```

### Manual Aggregation

```typescript
const wins = closedTrades.filter(t =>
  t.netPnl && parseFloat(t.netPnl) > 0
).length;

const losses = closedTrades.filter(t =>
  t.netPnl && parseFloat(t.netPnl) < 0
).length;

const totalPnl = closedTrades.reduce(
  (sum, t) => sum + (t.netPnl ? parseFloat(t.netPnl) : 0),
  0
);

const avgPnl = closedTrades.length > 0
  ? totalPnl / closedTrades.length
  : 0;
```

### Group-By Operations

```typescript
const dailyData = new Map<string, { pnl: number; trades: number }>();

for (const trade of closedTrades) {
  const dateKey = getDateStringInTimezone(trade.exitTime, userTimezone);
  const existing = dailyData.get(dateKey) || { pnl: 0, trades: 0 };
  existing.pnl += parseFloat(trade.netPnl ?? "0");
  existing.trades += 1;
  dailyData.set(dateKey, existing);
}

return Array.from(dailyData.entries()).map(([date, data]) => ({
  date,
  pnl: data.pnl,
  trades: data.trades,
}));
```

---

## 11. Error Handling

### Standard Error Throws

```typescript
if (!record) throw new Error("Record not found");
if (invalid) throw new Error("Invalid operation");
if (conflict) throw new Error("Already exists");

// Validation
if (existing.accountType !== "prop_challenge") {
  throw new Error("Account is not a prop challenge account");
}
```

### External Service Errors

```typescript
try {
  const data = await externalAPI.fetchData(symbol);
  return { success: true, data };
} catch (error) {
  console.error("API call failed:", error);
  return { available: false, message: "Failed to fetch data" };
}
```

---

## 12. Performance Optimization

### Selective Queries

```typescript
// Bad: fetch entire records
const trades = await ctx.db.query.trades.findMany({...});

// Good: fetch only needed columns
const trades = await ctx.db
  .select({
    id: trades.id,
    netPnl: trades.netPnl,
    exitTime: trades.exitTime,
  })
  .from(trades)
  .where(...);
```

### Batch Operations

```typescript
// Bad: loop and insert one-by-one
for (const tagId of tagIds) {
  await ctx.db.insert(tradeTags).values({ tradeId, tagId });
}

// Good: single batch insert
await ctx.db.insert(tradeTags).values(
  tagIds.map(tagId => ({ tradeId, tagId }))
);
```

### Indexed Lookups

All queries should use indexed columns:
- `user_id` - ownership checks
- `status` - filtering by status
- `entryTime`, `exitTime` - date range queries
- `accountId` - account filtering

---

## 13. Router-Specific Patterns

### Accounts Router

- Multiple account types: `demo`, `live`, `prop_challenge`, `prop_funded`
- Default account logic: first account auto-defaults
- Challenge → Funded conversion: creates linked funded account

### Trades Router

- Dual input: single trade or batch import
- Trade hashing for duplicate detection (closed trades only)
- Soft deletes with restoration
- Partial exits via TradeExecution records
- Extensive filtering options

### Analytics Router

- Overview: aggregate stats in single call
- Time-based: calendar, day-of-week, hour, session, monthly
- Risk metrics: drawdowns, Kelly, Risk of Ruin
- R-Multiple distribution
- Monte Carlo simulations

### Market Data Router

- Cache-first pattern: check DB before API call
- Provider routing: Databento (futures-only)
- Data quality tracking: full, partial, unavailable, pending

---

## 14. Drizzle ORM Patterns

### Schema Definition

```typescript
export const trades = pgTable("trades", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  direction: tradeDirectionEnum("direction").notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  netPnl: decimal("net_pnl", { precision: 20, scale: 8 }),
  status: tradeStatusEnum("status").default("open"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
}, (table) => ({
  userIdx: index("trades_user_id_idx").on(table.userId),
  statusIdx: index("trades_status_idx").on(table.status),
}));
```

### Relationships

```typescript
export const tradesRelations = relations(trades, ({ one, many }) => ({
  user: one(users, { fields: [trades.userId], references: [users.id] }),
  account: one(accounts, { fields: [trades.accountId], references: [accounts.id] }),
  strategy: one(strategies, { fields: [trades.strategyId], references: [strategies.id] }),
  executions: many(tradeExecutions),
  tradeTags: many(tradeTags),
  screenshots: many(tradeScreenshots),
}));
```

### Type Inference

```typescript
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
```

---

## 15. Helper Functions

### Router Helpers

Located in `src/server/api/helpers.ts`:

```typescript
// Get user's breakeven threshold setting
export const getUserBreakevenThreshold = async (db: Database, userId: string) => {
  const setting = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return parseFloat(setting?.breakevenThreshold ?? "0");
};

// Get user's timezone setting
export const getUserTimezone = async (db: Database, userId: string) => {
  const setting = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return setting?.timezone ?? "UTC";
};

// Subquery for active accounts only
export const getActiveAccountsSubquery = (db: Database, userId: string) => {
  return db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(
      eq(accounts.userId, userId),
      eq(accounts.isActive, true)
    ));
};
```

---

## 16. Testing Patterns

### Test Context Override

```typescript
export interface TRPCContextOverrides {
  db?: Database;           // Testcontainers PostgreSQL
  userId?: string | null;  // Mock user ID
  user?: User;             // Pre-created user object
}
```

### Creating Test Caller

```typescript
const caller = createCallerFactory();

const result = await caller({
  db: testDb,
  userId: "test-user-123",
  user: testUser,
}).trades.create({
  symbol: "ES",
  direction: "long",
  entryPrice: "4500.00",
  entryTime: new Date().toISOString(),
});
```

### Test Fixtures

```typescript
// Low-level
const user = await createTestUser(db);
const account = await createTestAccount(db, { userId: user.id });
const trade = await createTestTrade(db, { userId: user.id, accountId: account.id });

// High-level scenarios
const { user, account } = await setupTrader(db);
const { user, account, trades } = await setupTraderWithTrades(db, { tradeCount: 10 });
const { challenge, funded } = await setupPropChallenge(db, { userId: user.id });
```
