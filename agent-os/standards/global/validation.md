## Validation

EdgeJournal uses Zod for runtime type validation and tRPC for automatic input validation.

### Zod Schema Patterns

All tRPC procedure inputs are validated with Zod schemas:

**Basic Schema**:
```ts
import { z } from "zod";
import { directionEnum, instrumentTypeEnum } from "@/lib/schemas";

const createTradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  direction: directionEnum,  // "long" | "short"
  instrumentType: instrumentTypeEnum,  // "futures" | "forex" | etc
  entryPrice: z.string(),  // Decimals as strings
  quantity: z.string(),
  stopLoss: z.string().optional(),
  takeProfit: z.string().optional(),
  accountId: z.string(),
});
```

**Schema Composition**:
```ts
// Reuse common fields
const propFieldsSchema = z.object({
  maxDrawdown: z.string().optional(),
  profitTarget: z.string().optional(),
  profitSplit: z.number().min(0).max(100).optional(),
});

const updateAccountSchema = z
  .object({ id: z.string(), name: z.string().optional() })
  .merge(propFieldsSchema);
```

### Enum Validation

Enums are imported from `@/lib/schemas` and enforced at DB + validation layers:

```ts
import {
  directionEnum,
  tradeStatusEnum,
  accountTypeEnum,
  instrumentTypeEnum,
} from "@/lib/schemas";

const schema = z.object({
  direction: directionEnum,  // Zod enum from DB pgEnum
  status: tradeStatusEnum,
});
```

### Decimal/Numeric Validation

Decimals stored as strings, validated as strings, parsed for calculations:

```ts
// Input validation
const schema = z.object({
  entryPrice: z.string(),  // Not z.number()
  quantity: z.string(),
  fees: z.string().optional(),
});

// Usage in procedure
.mutation(async ({ ctx, input }) => {
  const fees = parseFloat(input.fees || "0");
  const quantity = parseFloat(input.quantity);

  // Database stores as decimal, returns as string
  await ctx.db.insert(trades).values({
    ...input,
    quantity: input.quantity,  // String to DB
  });
})
```

### Optional vs Nullish

```ts
// Optional: value can be undefined (but not null)
z.string().optional()

// Nullish: value can be null or undefined
z.string().nullish()

// Default value if missing
z.string().default("demo")
```

### Array Validation

```ts
const schema = z.object({
  tagIds: z.array(z.string()).optional(),
  tradeIds: z.array(z.string()).min(1).max(100),  // With constraints
});
```

### Automatic Validation in tRPC

Validation happens automatically before procedure executes:

```ts
create: protectedProcedure
  .input(createTradeSchema)
  .mutation(async ({ ctx, input }) => {
    // input is fully validated and type-safe here
    // If validation failed, tRPC returns error before this code runs
  })
```

Error response format:
```ts
{
  code: "BAD_REQUEST",
  message: "Validation failed",
  fieldErrors: {
    symbol: ["Symbol is required"],
    entryPrice: ["Invalid decimal format"]
  }
}
```

### Server-Side Only Validation

- **No Client Validation**: tRPC handles validation server-side
- **Type Safety**: TypeScript ensures correct types at compile-time
- **Runtime Validation**: Zod validates at runtime (API boundary)
- **Database Constraints**: PostgreSQL enforces NOT NULL, foreign keys, enums

### Business Logic Validation

Beyond Zod schemas, validate business rules in procedure logic:

```ts
create: protectedProcedure
  .input(createTradeSchema)
  .mutation(async ({ ctx, input }) => {
    // Verify account exists and belongs to user
    const account = await ctx.db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, input.accountId),
        eq(accounts.userId, ctx.user.id)
      ),
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Validate P&L calculation makes sense
    if (input.exitPrice) {
      const pnl = calculatePnL(input);
      if (Number.isNaN(pnl)) {
        throw new Error("Invalid P&L calculation");
      }
    }

    // Proceed with creation
  })
```

### Validation Best Practices

- **Fail Early**: Validate input before database queries
- **Type Safety**: Leverage Zod + TypeScript for compile-time + runtime safety
- **Specific Errors**: Return field-specific error messages
- **Enum Consistency**: Import enums from `@/lib/schemas`, use across DB + validation
- **Decimal Handling**: Always use strings for decimal inputs, parse for calculations
- **Ownership Checks**: Validate user owns resources before mutations
- **Business Rules**: Validate domain logic after input validation
