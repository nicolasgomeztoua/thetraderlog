## API Standards (tRPC)

EdgeJournal uses **tRPC v11** for end-to-end type-safe APIs, not REST. tRPC provides automatic type inference, validation, and serialization.

### Router Structure

**Root Router** (`src/server/api/root.ts`):
```ts
export const appRouter = createTRPCRouter({
  trades: tradesRouter,
  accounts: accountsRouter,
  tags: tagsRouter,
  strategies: strategiesRouter,
  analytics: analyticsRouter,
  marketData: marketDataRouter,
  settings: settingsRouter,
  filterPresets: filterPresetsRouter,
});
```

**Domain Routers** (`src/server/api/routers/<domain>.ts`):
- One router per domain (trades, accounts, tags, etc.)
- Group related procedures together
- Import and merge into root router

### Procedure Types

**Public Procedure** (unauthenticated):
```ts
hello: publicProcedure
  .input(z.object({ name: z.string() }))
  .query(({ input }) => {
    return { message: `Hello ${input.name}` };
  })
```

**Protected Procedure** (authenticated, most common):
```ts
getAll: protectedProcedure
  .query(async ({ ctx }) => {
    // ctx.user.id guaranteed to exist
    return ctx.db.query.trades.findMany({
      where: eq(trades.userId, ctx.user.id),
    });
  })
```

### Query vs Mutation

**Query** - Read operations (GET-like):
```ts
getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const trade = await ctx.db.query.trades.findFirst({
      where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
    });

    if (!trade) {
      throw new Error("Trade not found");
    }

    return trade;
  })
```

**Mutation** - Write operations (POST/PUT/DELETE-like):
```ts
create: protectedProcedure
  .input(createTradeSchema)
  .mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(trades)
      .values({ ...input, userId: ctx.user.id })
      .returning();

    return created;  // Return full object for optimistic updates
  })
```

### Naming Conventions

**Procedure Names** (camelCase, action-based):
- `getAll`, `getById`, `getDeleted` - Read operations
- `create`, `update`, `delete` - Write operations
- `bulkDelete`, `bulkAddToTrades` - Bulk operations
- `batchImport`, `export` - Special operations

**Router Names** (plural, resource-based):
- `trades`, `accounts`, `tags`, `strategies`, `analytics`

### Authentication & Authorization

**Middleware Enforcement**:
```ts
// src/server/api/trpc.ts
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Auto-sync user from Clerk on first login
  const user = await getOrCreateUser(ctx.userId);

  return next({ ctx: { ...ctx, user } });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);
```

**Ownership Verification** (always verify before mutations):
```ts
update: protectedProcedure
  .input(updateTradeSchema)
  .mutation(async ({ ctx, input }) => {
    // Verify ownership
    const existing = await ctx.db.query.trades.findFirst({
      where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
    });

    if (!existing) {
      throw new Error("Trade not found");
    }

    // Proceed with update
    const [updated] = await ctx.db
      .update(trades)
      .set(input)
      .where(eq(trades.id, input.id))
      .returning();

    return updated;
  })
```

### Response Patterns

**Single Object**:
```ts
return trade;  // { id, symbol, direction, ... }
```

**List**:
```ts
return trades;  // Trade[]
```

**Paginated** (cursor-based):
```ts
return {
  items: trades,
  nextCursor: trades.length > limit ? lastItem.id : undefined,
};
```

**Success Indicator**:
```ts
return { success: true, deleted: count };
```

### Input Validation

All inputs validated via Zod schemas:
```ts
create: protectedProcedure
  .input(createTradeSchema)  // Zod schema
  .mutation(async ({ ctx, input }) => {
    // input is fully validated and type-safe
  })
```

### Error Handling

**Simple errors**:
```ts
throw new Error("Trade not found");
throw new Error("Account does not belong to you");
```

**Structured errors**:
```ts
throw new TRPCError({
  code: "UNAUTHORIZED",
  message: "You must be logged in",
});
```

### Cursor Pagination Pattern

```ts
getAll: protectedProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
  }).optional())
  .query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 50;
    const conditions = [eq(trades.userId, ctx.user.id)];

    if (input?.cursor) {
      conditions.push(sql`${trades.id} < ${input.cursor}`);
    }

    const items = await ctx.db.query.trades.findMany({
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
  })
```

### Eager Loading (Relations)

```ts
const trade = await ctx.db.query.trades.findFirst({
  where: eq(trades.id, input.id),
  with: {
    account: true,
    strategy: true,
    tradeTags: { with: { tag: true } },
    executions: true,
  },
});
```

### Context Pattern

```ts
// src/server/api/trpc.ts
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const userId = await getCurrentUser();  // From Clerk

  return {
    db,
    userId,
    ...opts,
  };
};

// Available in all procedures
ctx.db        // Database instance
ctx.user      // User object (in protectedProcedure)
ctx.userId    // Clerk user ID
```

### Testing tRPC Routers

```ts
// Create test caller
const caller = await createTestCaller(user.clerkId, user);

// Call procedures
const account = await caller.accounts.create({
  name: "My Account",
  accountType: "demo",
  initialBalance: "10000",
});

expect(account?.name).toBe("My Account");
```

### Best Practices

- **Return Full Objects**: Return complete objects from mutations for optimistic updates
- **Verify Ownership**: Always check `ctx.user.id` matches resource owner
- **Use Enums**: Import from `@/lib/schemas` for type safety
- **Cursor Pagination**: Prefer cursor over offset for better performance
- **Eager Load Relations**: Use `with:` to avoid N+1 queries
- **Type Safety**: Let tRPC infer types, don't duplicate type definitions
