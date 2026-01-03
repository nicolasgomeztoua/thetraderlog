## Database Models (Drizzle Schema)

EdgeJournal uses Drizzle ORM with PostgreSQL. All schema is defined in `src/server/db/schema.ts` (single source of truth).

### Schema Definition Pattern

**Location**: `src/server/db/schema.ts` (entire schema in one file)

**Basic Table**:
```ts
import { pgTable, text, timestamp, decimal, index } from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    initialBalance: decimal("initial_balance", { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
  ]
);
```

### Naming Conventions

**Table Names**: Singular (e.g., `account`, `trade`, `tag`)
**Column Names**: snake_case in database (e.g., `user_id`, `entry_time`, `net_pnl`)
**TypeScript**: Auto-mapped to camelCase by Drizzle (e.g., `userId`, `entryTime`, `netPnl`)

```ts
// Schema definition (snake_case)
userId: text("user_id")

// TypeScript usage (camelCase)
const trade = { userId: "123", ... };
```

### Field Types

**IDs**: `text("id")` with `$defaultFn(() => createId())` (CUID2)
**Foreign Keys**: `text("user_id").references(() => users.id, { onDelete: "cascade" })`
**Strings**: `text("name")`, `text("symbol")`
**Timestamps**: `timestamp("created_at", { withTimezone: true })`
**Booleans**: `boolean("is_active").default(true)`
**Numbers**: `integer("trade_count")`, `bigint("volume", { mode: "bigint" })`
**Decimals**: See precision section below

### Decimal Precision

**Prices** (8 decimal places for forex/crypto):
```ts
entryPrice: decimal("entry_price", { precision: 20, scale: 8 })
```

**Money/P&L** (2 decimal places for currency):
```ts
netPnl: decimal("net_pnl", { precision: 20, scale: 2 })
fees: decimal("fees", { precision: 20, scale: 2 })
```

**Percentages** (2 decimal places):
```ts
profitSplit: decimal("profit_split", { precision: 10, scale: 2 })
```

### Enums (pgEnum)

Define at DB level before tables:

```ts
export const tradeDirectionEnum = pgEnum("trade_direction", ["long", "short"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const accountTypeEnum = pgEnum("account_type", [
  "prop_challenge",
  "prop_funded",
  "live",
  "demo",
]);

// Use in table
export const trades = pgTable("trade", {
  direction: tradeDirectionEnum("direction").notNull(),
  status: tradeStatusEnum("status").default("open").notNull(),
});
```

### Timestamps

**Pattern**:
```ts
createdAt: timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull(),

updatedAt: timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull(),
```

**Soft Deletes**:
```ts
deletedAt: timestamp("deleted_at", { withTimezone: true })
```

Query with: `isNull(table.deletedAt)` for active records

### Foreign Keys & Relationships

**One-to-Many** (User → Accounts):
```ts
export const accounts = pgTable("account", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ...
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  trades: many(trades),
}));
```

**Many-to-Many** (Trades ↔ Tags via Junction Table):
```ts
export const tradeTags = pgTable(
  "trade_tag",
  {
    tradeId: text("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.tradeId, t.tagId] }),
  ]
);
```

**Self-Referencing** (Prop Challenge → Funded Account):
```ts
linkedAccountId: text("linked_account_id")
  // No FK constraint to allow NULL and avoid circular dependency
```

### Indexes

**Pattern**:
```ts
export const trades = pgTable(
  "trade",
  { /* columns */ },
  (t) => [
    index("trade_user_id_idx").on(t.userId),          // Foreign key
    index("trade_status_idx").on(t.status),           // Filter column
    index("trade_entry_time_idx").on(t.entryTime),    // Date range queries
    uniqueIndex("trade_hash_idx").on(t.tradeHash),    // Duplicate detection
  ]
);
```

**When to Index**:
- All foreign keys
- Columns used in WHERE clauses
- Columns used in ORDER BY
- Columns for date range queries
- Composite indexes for multi-column lookups

### JSON Fields

For complex, flexible data:

```ts
riskParameters: text("risk_parameters")  // Store as JSON string

// Usage
riskParameters: input.riskParameters ? JSON.stringify(input.riskParameters) : null
```

### Type Inference

```ts
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
```

### Default Values

```ts
isActive: boolean("is_active").default(true).notNull()
status: tradeStatusEnum("status").default("open").notNull()
createdAt: timestamp("created_at").defaultNow().notNull()
```

### Nullable vs Not Null

```ts
// Required field
name: text("name").notNull()

// Optional field
exitPrice: decimal("exit_price", { precision: 20, scale: 8 })
```

### Constraints

**NOT NULL**: `.notNull()`
**UNIQUE**: `.unique()` or `uniqueIndex()`
**PRIMARY KEY**: `.primaryKey()`
**FOREIGN KEY**: `.references(() => table.column, { onDelete: "cascade" })`
**DEFAULT**: `.default(value)` or `.defaultNow()`

### Schema Sync

**No migration files** - schema.ts is source of truth:

```bash
bun run db:push   # Sync schema changes to database
bun run db:studio # Open Drizzle Studio to inspect data
```

### Best Practices

- **Single Source of Truth**: All schema in `src/server/db/schema.ts`
- **Enums at DB Level**: Use `pgEnum()` for type safety
- **Decimal Precision**: Match precision to use case (8 for prices, 2 for currency)
- **Index Foreign Keys**: Always index FK columns
- **Timestamps Everywhere**: Include `createdAt` and `updatedAt` on all tables
- **Soft Deletes**: Use `deletedAt` instead of hard deletes for user data
- **Type Inference**: Use `$inferSelect` and `$inferInsert` for types
- **Relations**: Define in separate `relations()` calls for type-safe queries
