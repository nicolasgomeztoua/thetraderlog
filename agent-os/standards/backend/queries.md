## Database Queries (Drizzle ORM)

EdgeJournal uses Drizzle ORM for type-safe database queries with zero runtime overhead.

### Query Builder Basics

**Find Many**:
```ts
const trades = await ctx.db.query.trades.findMany({
  where: eq(trades.userId, ctx.user.id),
  orderBy: [desc(trades.entryTime)],
  limit: 50,
});
```

**Find First** (returns single record or undefined):
```ts
const trade = await ctx.db.query.trades.findFirst({
  where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
});

if (!trade) {
  throw new Error("Trade not found");
}
```

### Condition Building Pattern

Build conditions dynamically in an array:

```ts
const conditions = [eq(trades.userId, ctx.user.id)];

// Add optional filters
if (!input?.includeDeleted) {
  conditions.push(isNull(trades.deletedAt));
}

if (input?.status) {
  conditions.push(eq(trades.status, input.status));
}

if (input?.startDate) {
  conditions.push(gte(trades.entryTime, new Date(input.startDate)));
}

if (input?.search) {
  const searchTerm = `%${input.search}%`;
  conditions.push(or(
    ilike(trades.symbol, searchTerm),
    ilike(trades.setupType, searchTerm),
  ));
}

// Execute with all conditions
const trades = await ctx.db.query.trades.findMany({
  where: and(...conditions),
  orderBy: [desc(trades.id)],
});
```

### Eager Loading (Avoid N+1)

Use `with:` to load relations in single query:

```ts
const trade = await ctx.db.query.trades.findFirst({
  where: eq(trades.id, input.id),
  with: {
    account: true,                          // One-to-one/many
    strategy: true,
    tradeTags: { with: { tag: true } },    // Nested relations
    executions: { orderBy: [desc(executions.createdAt)] },
  },
});
```

### Comparison Operators

```ts
import { eq, ne, gt, gte, lt, lte, and, or, isNull, isNotNull, inArray, notInArray, like, ilike } from "drizzle-orm";

// Equality
eq(trades.status, "closed")
ne(trades.direction, "long")

// Comparison
gt(trades.netPnl, "0")
gte(trades.entryTime, startDate)
lt(trades.exitTime, endDate)

// Null checks
isNull(trades.deletedAt)
isNotNull(trades.exitPrice)

// Arrays
inArray(trades.id, ["id1", "id2", "id3"])

// String matching
like(trades.symbol, "%USD%")
ilike(trades.symbol, "%usd%")  // Case-insensitive

// Logical operators
and(eq(trades.userId, userId), isNull(trades.deletedAt))
or(eq(trades.status, "open"), isNotNull(trades.exitTime))
```

### SQL Fragments (Advanced)

For complex queries not supported by query builder:

```ts
import { sql } from "drizzle-orm";

// IN clause with dynamic values
const tradeIds = ["id1", "id2", "id3"];
conditions.push(sql`${trades.id} IN (${sql.join(
  tradeIds.map((id) => sql`${id}`),
  sql`, `,
)})`);

// Raw SQL for specific operations
conditions.push(sql`${trades.id} < ${cursor}`);
```

### Insert Operations

**Single Insert**:
```ts
const [created] = await ctx.db
  .insert(trades)
  .values({
    userId: ctx.user.id,
    symbol: input.symbol,
    direction: input.direction,
    entryPrice: input.entryPrice,
    quantity: input.quantity,
  })
  .returning();

return created;  // Full object with defaults populated
```

**Bulk Insert**:
```ts
const insertedTrades = await ctx.db
  .insert(trades)
  .values(tradesToInsert)  // Array of objects
  .returning();
```

### Update Operations

**Single Update**:
```ts
const [updated] = await ctx.db
  .update(trades)
  .set({
    exitPrice: input.exitPrice,
    exitTime: new Date(),
    status: "closed",
  })
  .where(eq(trades.id, input.id))
  .returning();

return updated;
```

**Bulk Update**:
```ts
await ctx.db
  .update(trades)
  .set({ deletedAt: new Date() })
  .where(
    and(
      eq(trades.userId, ctx.user.id),
      sql`${trades.id} IN (${sql.join(
        input.ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    ),
  );
```

### Delete Operations

**Soft Delete** (preferred for user data):
```ts
await ctx.db
  .update(trades)
  .set({ deletedAt: new Date() })
  .where(eq(trades.id, input.id));
```

**Hard Delete**:
```ts
await ctx.db
  .delete(trades)
  .where(eq(trades.id, input.id));
```

### Cursor Pagination

```ts
const limit = input?.limit ?? 50;
const conditions = [eq(trades.userId, ctx.user.id)];

if (input?.cursor) {
  conditions.push(sql`${trades.id} < ${input.cursor}`);
}

const items = await ctx.db.query.trades.findMany({
  where: and(...conditions),
  orderBy: [desc(trades.id)],
  limit: limit + 1,  // Fetch one extra to check if more exist
});

let nextCursor: string | undefined;
if (items.length > limit) {
  const nextItem = items.pop();
  nextCursor = nextItem?.id;
}

return { items, nextCursor };
```

### Post-Query Filtering

For complex logic not expressible in SQL:

```ts
let items = await ctx.db.query.trades.findMany({
  where: and(...baseConditions),
  with: { tradeTags: true },
});

// Filter by tag IDs (junction table)
if (input?.tagIds && input.tagIds.length > 0) {
  items = items.filter((trade) => {
    const tradeTagIds = trade.tradeTags.map((tt) => tt.tagId);
    return input.tagIds.some((id) => tradeTagIds.includes(id));
  });
}

// Filter by P&L result
if (input?.result) {
  items = items.filter((trade) => {
    const pnl = parseFloat(trade.netPnl ?? "0");
    if (input.result === "win") return pnl > 0;
    if (input.result === "loss") return pnl < 0;
    return pnl === 0;
  });
}
```

**Note**: Use post-query filtering sparingly - prefer SQL where possible.

### Transactions

Wrap related operations:

```ts
await ctx.db.transaction(async (tx) => {
  // Delete existing executions
  await tx.delete(executions).where(eq(executions.tradeId, tradeId));

  // Insert new executions
  await tx.insert(executions).values(newExecutions);

  // Update trade summary
  await tx.update(trades)
    .set({ updatedAt: new Date() })
    .where(eq(trades.id, tradeId));
});
```

### Subqueries

```ts
// Helper function for subquery
export function getActiveAccountsSubquery(db: Db, userId: string) {
  return db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));
}

// Usage in main query
const activeAccountIds = getActiveAccountsSubquery(ctx.db, ctx.user.id);
const trades = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    inArray(trades.accountId, activeAccountIds),
  ),
});
```

### Best Practices

- **SQL Injection Prevention**: Drizzle handles parameterization automatically
- **Avoid N+1**: Use `with:` for eager loading relations
- **Condition Arrays**: Build dynamic conditions in arrays, then `and(...conditions)`
- **Type Safety**: Let Drizzle infer types from schema
- **Decimal Parsing**: Use `parseFloat()` when comparing decimal fields
- **Cursor Pagination**: Prefer cursor over offset for performance
- **Post-Query Filtering**: Only for complex logic not expressible in SQL
- **Soft Deletes**: Check `isNull(deletedAt)` in all user-facing queries
- **Ownership**: Always filter by `userId` in multi-tenant queries
