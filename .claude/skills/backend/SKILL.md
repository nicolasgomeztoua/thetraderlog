# Backend Development Skill

Quick reference for tRPC endpoints, Drizzle ORM, and API patterns in EdgeJournal.

## Philosophy

- **Type-Safe End-to-End**: tRPC provides full TypeScript inference from server to client
- **Ownership-First Security**: Always verify user owns resources before read/write
- **Schema as Source of Truth**: Drizzle schema defines the data model
- **Return Full Objects**: Mutations return complete objects for optimistic updates

---

## Core Patterns

### 1. Authentication & Context

All authenticated endpoints use `protectedProcedure`:

```typescript
import { protectedProcedure } from "~/server/api/trpc";

myEndpoint: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    // ctx.user.id is the authenticated user
    // ctx.db is the Drizzle database instance
  })
```

**Key Rules:**
- User ID from `ctx.user.id` - NEVER trust client-provided userId
- `ctx.db` for database access
- `ctx.user` contains full user object

### 2. Input Validation (Zod)

Define schemas at router file top, not inline:

```typescript
// Good - at top of file
const createTradeInput = z.object({
  symbol: z.string().min(1),
  direction: z.enum(["long", "short"]),
  entryPrice: z.string(), // Decimals as strings
  entryTime: z.string().datetime(),
  accountId: z.string().optional(),
});

// Common patterns
z.object({ id: z.string() })                    // Single resource
z.object({ ids: z.array(z.string()).min(1) })   // Batch operations
z.object({ limit: z.number().default(50) })     // Pagination
z.string().datetime()                            // ISO datetime
z.string().nullish()                             // Optional null/undefined
```

### 3. Ownership Verification

**Always check ownership before read/write:**

```typescript
// Single resource
const record = await ctx.db.query.trades.findFirst({
  where: and(
    eq(trades.id, input.id),
    eq(trades.userId, ctx.user.id)  // Ownership check
  ),
});
if (!record) throw new Error("Not found");

// Bulk operations - verify ALL records exist
const existing = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    inArray(trades.id, input.ids)
  ),
});
if (existing.length !== input.ids.length) {
  throw new Error("Some records not found");
}
```

### 4. Database Patterns (Drizzle)

**Selective column fetching** (performance):
```typescript
const results = await ctx.db
  .select({
    id: trades.id,
    netPnl: trades.netPnl,
    exitTime: trades.exitTime,
  })
  .from(trades)
  .where(and(...conditions));
```

**Relationship loading** with `.with()`:
```typescript
const trade = await ctx.db.query.trades.findFirst({
  where: eq(trades.id, input.id),
  with: {
    account: true,
    strategy: true,
    executions: true,
    tradeTags: { with: { tag: true } },
  },
});
```

**Get updated record** with `.returning()`:
```typescript
const [updated] = await ctx.db
  .update(trades)
  .set({ status: "closed" })
  .where(eq(trades.id, input.id))
  .returning();
```

**Common operators:**
- `eq()`, `and()`, `or()` - Basic comparisons
- `gte()`, `lte()` - Greater/less than or equal
- `ilike()` - Case-insensitive search
- `inArray()` - IN clause
- `isNull()`, `isNotNull()` - Null checks
- `desc()` - Descending order

### 5. Decimal Handling

Decimals stored as strings for precision:

```typescript
// Schema: decimal(precision: 20, scale: 8)
// Storage: string

// Reading - parse for calculations
const pnl = parseFloat(trade.netPnl ?? "0");

// Writing - back to string
const netPnl = (realizedPnl - fees).toFixed(2);
await ctx.db.update(trades).set({ netPnl });

// Comparison
if (parseFloat(trade.netPnl) > 0) { /* profit */ }
```

### 6. Mutation Return Convention

Return full objects for optimistic updates:

```typescript
// Good - returns full object
create: protectedProcedure
  .input(createInput)
  .mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(trades)
      .values({ ...input, userId: ctx.user.id })
      .returning();
    return created;
  })

// Bad - client can't update cache
.mutation(async ({ ctx, input }) => {
  await ctx.db.insert(trades).values(input);
  return { success: true };
})
```

### 7. Error Handling

Simple throws - tRPC wraps automatically:

```typescript
if (!record) throw new Error("Record not found");
if (invalid) throw new Error("Invalid operation");

// Zod errors are flattened automatically
// Frontend receives zodError for field-level display
```

### 8. Dynamic Filtering

Build conditions array for complex queries:

```typescript
const conditions = [eq(trades.userId, ctx.user.id)];

if (input?.accountId) {
  conditions.push(eq(trades.accountId, input.accountId));
}

if (input?.startDate) {
  conditions.push(gte(trades.entryTime, new Date(input.startDate)));
}

if (input?.status) {
  conditions.push(eq(trades.status, input.status));
}

const results = await ctx.db.query.trades.findMany({
  where: and(...conditions),
  orderBy: [desc(trades.entryTime)],
});
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/server/api/trpc.ts` | tRPC init, context, middleware |
| `src/server/api/routers/*.ts` | Individual routers |
| `src/server/api/root.ts` | Router aggregation |
| `src/server/db/schema.ts` | Drizzle schema (source of truth) |
| `src/server/db/index.ts` | Database connection |

## Existing Routers

| Router | Purpose |
|--------|---------|
| `accounts` | Trading accounts (demo, live, prop) |
| `trades` | Trade CRUD, batch import, filtering |
| `analytics` | Statistics, equity curves, risk metrics |
| `marketData` | OHLC data, caching, provider routing |
| `strategies` | Trading strategy management |
| `tags` | Trade tagging system |

---

## Reference

For complete patterns including pagination, transactions, aggregations, and router-specific patterns, see [TRPC_REFERENCE.md](./TRPC_REFERENCE.md).
