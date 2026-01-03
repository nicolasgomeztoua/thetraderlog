## Error Handling

EdgeJournal uses tRPC's error handling system with centralized error formatting.

### Error Types in tRPC

**Simple String Errors** (most common):
```ts
// For simple cases - tRPC converts to proper error object
throw new Error("Trade not found");
throw new Error("Account does not belong to you");
throw new Error("Invalid P&L calculation");
```

**Structured tRPC Errors** (for specific HTTP codes):
```ts
import { TRPCError } from "@trpc/server";

throw new TRPCError({
  code: "UNAUTHORIZED",
  message: "Could not fetch user data from Clerk",
});

throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Invalid date range",
});
```

Available codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`

### Ownership Verification Pattern

Always verify user ownership before mutations:

```ts
const existingTrade = await ctx.db.query.trades.findFirst({
  where: and(eq(trades.id, input.id), eq(trades.userId, ctx.user.id)),
});

if (!existingTrade) {
  throw new Error("Trade not found"); // 404-like behavior
}

// Proceed with mutation
await ctx.db.update(trades)...
```

Never trust client-provided `userId` - always use `ctx.user.id` from authenticated middleware.

### Centralized Error Formatting

Defined in `src/server/api/trpc.ts`:
- Flattens Zod validation errors for frontend type safety
- Preserves error codes and messages
- Logs errors in development

### Validation Errors (Zod)

Input validation happens automatically via `.input()` schemas:

```ts
create: protectedProcedure
  .input(createTradeSchema)  // Zod schema
  .mutation(async ({ ctx, input }) => {
    // If validation fails, tRPC returns formatted error
    // No manual validation needed
  })
```

Client receives:
```ts
{
  code: "BAD_REQUEST",
  message: "Validation failed",
  fieldErrors: { symbol: ["Required"], quantity: ["Must be positive"] }
}
```

### Authentication Errors

Handled by middleware in `src/server/api/trpc.ts`:

```ts
if (!ctx.userId) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "You must be logged in",
  });
}
```

### Error Boundaries

- **tRPC Layer**: Catches all procedure errors, formats response
- **Next.js Error Boundary**: Catches React component errors
- **API Routes**: Handle external API failures gracefully

### External Service Failures

For market data APIs and background jobs:

```ts
try {
  const data = await fetchMarketData(symbol);
  return data;
} catch (error) {
  // Log error but don't crash
  console.error("Market data fetch failed:", error);

  // Return partial data or cached fallback
  return { status: "unavailable", cached: true };
}
```

### Best Practices

- **Fail Early**: Validate ownership and input at procedure start
- **Clear Messages**: User-facing errors should be actionable ("Trade not found" not "Query failed")
- **Never Expose Internals**: Don't leak database queries, API keys, or stack traces to client
- **Log for Debugging**: Console.error in development, structured logging in production
- **Graceful Degradation**: Non-critical features (market data) shouldn't break core functionality (trade CRUD)
