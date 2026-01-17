# Coding Conventions

**Analysis Date:** 2026-01-17

## Naming Patterns

**Files:**
- Components: PascalCase (`Button.tsx`, `TradeLogTable.tsx`)
- Utilities/Hooks: kebab-case (`use-media-query.ts`, `csv-export.ts`)
- Constants: kebab-case (`trade-log.ts`, `analytics.ts`)
- Schema files: lowercase (`schema.ts`)
- Test files: `{feature}.test.ts` (e.g., `accounts.test.ts`, `overview.test.ts`)

**Functions:**
- camelCase for all functions (`createTestUser`, `formatCurrency`, `getPnLColorClass`)
- Prefix hooks with `use` (`useMediaQuery`)
- Prefix boolean functions with `is`, `has`, `should` when applicable
- tRPC procedures use verb prefixes: `get*`, `create*`, `update*`, `delete*`

**Variables:**
- camelCase for all variables (`testData`, `userCounter`, `connectionUrl`)
- UPPER_SNAKE_CASE for constants (`TRADE_SORT_FIELDS`, `DEFAULT_TRADE_SORT`)
- Prefix private/internal variables with underscore (`_tradeCounter`, `_testUser`)

**Types:**
- PascalCase for all types and interfaces (`User`, `TestCaller`, `CreateTestUserOptions`)
- Suffix option objects with `Options` (`CreateTestTradeOptions`)
- Suffix input schemas with `Schema` or `Input` (`createTradeSchema`, `AnalyticsFilterInput`)

## Code Style

**Formatting:**
- Biome (not ESLint/Prettier)
- Config: `biome.jsonc`
- Tabs for indentation (Biome default)
- Double quotes for strings
- Trailing commas enabled

**Linting:**
- Biome with recommended rules
- `useSortedClasses` for Tailwind class ordering (works with `clsx`, `cva`, `cn`)
- Organize imports enabled
- Sort attributes enabled

**Run Commands:**
```bash
bun run check        # Check for issues
bun run check:write  # Fix issues automatically
bun run check:unsafe # Fix with unsafe transformations
```

## Import Organization

**Order:**
1. Node built-ins (`import { execSync } from "node:child_process"`)
2. External packages (`import { z } from "zod"`, `import { eq } from "drizzle-orm"`)
3. Internal absolute imports (`@/lib/*`, `@/server/*`, `@/components/*`)
4. Relative imports (`./`, `../`)

**Path Aliases:**
- `@/` maps to `src/`
- Always use absolute imports from `@/` for cross-directory imports
- Use relative imports only within the same feature/directory

**Example:**
```typescript
import { execSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { z } from "zod";

import { calculateAggregateStats } from "@/lib/analytics";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { trades, accounts } from "@/server/db/schema";

import { createTestAccount } from "./accounts";
import type { CreateTestUserOptions } from "./users";
```

## Error Handling

**Patterns:**
- Use tRPC's `TRPCError` for API errors with appropriate codes
- Always validate user ownership before operations
- Return descriptive error messages

**tRPC Errors:**
```typescript
// Authentication required
if (!ctx.userId) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}

// Resource not found (also used for authorization - don't reveal existence)
if (!account || account.userId !== ctx.user.id) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Account not found",
  });
}

// Invalid input or business logic violation
throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Account is not a prop challenge account",
});
```

**Null Handling:**
- Never use non-null assertions (`!`) - Biome enforces this
- Use nullish coalescing with safe defaults
- Parse optional values before use

```typescript
// Good
expect(parseFloat(account?.initialBalance ?? "0")).toBe(10000);
await caller.accounts.delete({ id: account?.id ?? "" });

// Avoid - Biome lint error
expect(parseFloat(account!.initialBalance!)).toBe(10000);
```

## Logging

**Framework:** No dedicated logging framework; uses `console.log/error` in development

**Patterns:**
- Emoji prefixes for visual distinction in development
- Progress logging for long operations
- Error context included

```typescript
console.log("\n🐳 Starting PostgreSQL container...");
console.log(`✅ PostgreSQL container started at: ${connectionUrl}`);
console.error("Failed to push schema:", error);
```

## Comments

**When to Comment:**
- Section headers using `// ====...` dividers for major router sections
- JSDoc for exported functions and complex utilities
- Inline comments for non-obvious business logic
- Expected values in test fixtures

**JSDoc:**
```typescript
/**
 * Creates a test trade in the database.
 * Requires userId and accountId (trades belong to a user and account).
 */
export async function createTestTrade(
  userId: string,
  accountId: string,
  options: CreateTestTradeOptions = {},
) {
  // ...
}
```

**Section Headers:**
```typescript
// ============================================================================
// ACCOUNT CRUD OPERATIONS
// ============================================================================

// =============================================================================
// ANALYTICS FILTER INPUT SCHEMA
// Shared input schema for filtering analytics queries
// =============================================================================
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Extract helper functions for complex logic
- Router procedures can be longer due to query building

**Parameters:**
- Use options objects for multiple optional parameters
- Destructure with defaults
- Required parameters before optional

```typescript
export async function createTestTrade(
  userId: string,                    // Required first
  accountId: string,                 // Required second
  options: CreateTestTradeOptions = {}, // Optional object with defaults
) {
  const symbol = options.symbol ?? "ES";
  const status = options.status ?? "closed";
  // ...
}
```

**Return Values:**
- Return full objects from mutations for optimistic updates
- Use explicit return types for complex functions
- Throw errors rather than returning error objects

```typescript
// Mutations return the created/updated entity
const [account] = await db
  .insert(schema.accounts)
  .values({ ... })
  .returning();  // Returns full object

return account;
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Re-export from index files for cleaner imports
- Export types alongside functions

```typescript
// src/lib/shared/index.ts
export * from "./colors";
export * from "./id";
export * from "./utils";

// tests/utils/index.ts
export { createTestCaller, type TestCaller } from "./caller";
export * from "./fixtures";
```

**Barrel Files:**
- `index.ts` files aggregate exports from directories
- Constants organized in `src/lib/constants/`
- Shared utilities in `src/lib/shared/`

**Location:**
- Constants: `src/lib/constants/{domain}.ts`
- Shared enums/schemas: `src/lib/shared/schemas.ts`
- Utility functions: `src/lib/shared/utils.ts` or domain-specific (`src/lib/analytics/`)

## Component Patterns

**Structure:**
- Functional components only (no class components)
- Props typed inline with `React.ComponentProps<>` pattern
- Use `cn()` utility for conditional class merging

```typescript
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded border border-white/10",
        className,
      )}
      data-slot="card"
      {...props}
    />
  );
}
```

**CVA Variants:**
- Use `class-variance-authority` for component variants
- Define variants in `cva()` call above component

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground...",
        destructive: "bg-destructive text-white...",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

## Database Conventions

**Decimals:**
- Stored as strings with 8 decimal places
- Parse with `parseFloat()` for calculations
- Return as strings from database

```typescript
// Database stores: "5000.00000000"
expect(parseFloat(trade?.entryPrice ?? "0")).toBe(5000);
```

**Enums:**
- Defined in `src/server/db/schema.ts` as `pgEnum`
- Corresponding Zod schemas in `src/lib/shared/schemas.ts`
- Use enum values, not raw strings

**IDs:**
- Use `nanoid` for ID generation via `ids.create()`
- Never trust client-provided IDs for ownership
- Always validate user ownership in queries

---

*Convention analysis: 2026-01-17*
