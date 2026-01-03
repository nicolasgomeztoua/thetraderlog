## Database Schema Management (Drizzle)

EdgeJournal uses a **push-based** schema management approach with Drizzle Kit - there are no traditional migration files.

### The Push-Based Approach

**Single Source of Truth**: `src/server/db/schema.ts`

All database schema is defined in one file. Changes to the schema are "pushed" directly to the database using Drizzle Kit.

```bash
# Sync schema changes to database
bun run db:push

# This command:
# 1. Reads schema.ts
# 2. Compares with current database state
# 3. Generates and executes DDL (CREATE, ALTER, DROP statements)
# 4. Updates database to match schema.ts
```

### How It Works

**Before (Traditional Migrations)**:
```
1. Write migration file (e.g., 001_add_trades_table.sql)
2. Run migration command
3. Migration stored in DB history
4. Repeat for each change
```

**Now (Drizzle Push)**:
```
1. Edit src/server/db/schema.ts
2. Run `bun run db:push`
3. Database updated automatically
4. Schema.ts remains source of truth
```

### Making Schema Changes

**Adding a New Field**:
```ts
// Before
export const trades = pgTable("trade", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  // ...
});

// After
export const trades = pgTable("trade", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  notes: text("notes"),  // NEW FIELD
  // ...
});
```

Then run: `bun run db:push`

**Adding a New Table**:
```ts
// Add new table definition to schema.ts
export const notifications = pgTable("notification", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Add relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
```

Then run: `bun run db:push`

### Dev vs Production

**Development**:
- Run `bun run db:push` frequently as you iterate
- Drizzle Kit handles schema diffing and DDL generation
- Safe to experiment - changes applied immediately

**Production**:
- Review generated DDL carefully before applying
- Consider backwards compatibility
- Test schema changes in staging first
- `db:push` generates SQL but doesn't execute by default in prod mode

### Data Migrations

For data transformations (not schema changes):

**Option 1**: Manual SQL Script
```bash
# Connect to database
psql $DATABASE_URL

# Run transformation
UPDATE trade SET category = 'scalp' WHERE duration_minutes < 15;
```

**Option 2**: tRPC Procedure (One-Time Admin Action)
```ts
// src/server/api/routers/admin.ts
migrateTradeCategories: protectedProcedure
  .mutation(async ({ ctx }) => {
    await ctx.db
      .update(trades)
      .set({ category: "scalp" })
      .where(lt(trades.durationMinutes, 15));

    return { success: true };
  })
```

### Testing with Testcontainers

Tests use push-based approach too:

```ts
// tests/setup/global-setup.ts
export default async function globalSetup() {
  // Start PostgreSQL container
  const container = await new PostgreSQLContainer().start();

  // Push schema to test database
  const DATABASE_URL = container.getConnectionString();
  execSync("bun run db:push", {
    env: { ...process.env, DATABASE_URL },
  });

  return async () => {
    await container.stop();
  };
}
```

Every test run gets a fresh database with current schema.

### Drizzle Studio

Inspect and edit data visually:

```bash
bun run db:studio
```

Opens web UI at `https://local.drizzle.studio` to:
- View all tables and data
- Run queries
- Edit records
- Inspect relationships

### Version Control

**What to commit**:
- `src/server/db/schema.ts` (always)
- `drizzle.config.ts` (configuration)

**What NOT to commit**:
- No migration files (they don't exist)
- No migration history table

### Rollback Strategy

**No Traditional Rollbacks**:
- Since there are no migration files, you can't "rollback" a migration
- Instead, edit `schema.ts` to the previous state and run `db:push`

**Git-Based Rollback**:
```bash
# Revert schema.ts to previous commit
git checkout HEAD~1 src/server/db/schema.ts

# Push reverted schema
bun run db:push

# Commit the revert
git commit -m "Revert schema changes"
```

### When Push-Based Doesn't Work

For complex migrations requiring:
- Multi-step data transformations
- Zero-downtime schema changes (adding NOT NULL columns)
- Coordinated schema + data migrations

Use manual SQL scripts or Drizzle's `generate` command for custom migrations.

### Best Practices

- **Commit schema.ts frequently**: Every schema change should be committed
- **Test locally first**: Run `db:push` and verify changes before deploying
- **Backwards compatibility**: Consider existing data when adding constraints
- **Document breaking changes**: Add comments in schema.ts for major changes
- **Use Drizzle Studio**: Inspect schema and data before/after changes
- **Soft deletes preferred**: Add `deletedAt` instead of dropping columns
- **Testing**: Testcontainers ensures every test run uses current schema
