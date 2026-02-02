# tRPC Routers - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/backend/SKILL.md`

## Patterns

### Date-Based Lookups
**When:** Queries that need to fetch by date (journals, daily stats)
**How:** Create a `normalizeDate` helper that sets hours/minutes/seconds to 0 UTC. Store dates normalized to midnight UTC in the database.

### Auto-Create Pattern
**When:** Fetching an entity that should exist if the user accesses it (e.g., daily journal)
**How:** Query first, if not found insert with returning(), guard against undefined, re-fetch with relations.

### Router Registration
**When:** Creating a new tRPC router
**How:** 1) Create file in routers/, 2) Export router, 3) Import in root.ts, 4) Add to appRouter object

### Date Range Queries
**When:** Queries that filter by a date range (e.g., calendar views, reports)
**How:** Import `gte`, `lte` from drizzle-orm, normalize both dates to midnight UTC, use `and(eq(userId), gte(date, start), lte(date, end))`

### Date Boundary Filtering (Within a Single Day)
**When:** Querying records that fall within a specific day (e.g., trades by entry time for a date)
**How:** Use `gte(field, normalizedDate)` AND `lt(field, nextDay)` where nextDay is normalizedDate + 1 day. This avoids edge cases with end-of-day timestamps. Always include `isNull(deletedAt)` for soft-deleted entities.

### Timezone-Aware Trade Queries
**When:** Filtering trades by date where the user's timezone matters
**Problem:** Trade timestamps are stored in UTC. "Jan 6" in EST is different UTC hours than "Jan 6" in UTC.
**Frontend/Backend Split:**
- Frontend sends date string as clicked (e.g., "2026-01-06") using `format(date, "yyyy-MM-dd")`
- Backend converts using user's preferred timezone to get UTC bounds
**Solution:** Use `getUserTimezone` helper and `getDayBoundsInTimezone`:
```typescript
import { getDayBoundsInTimezone } from "@/lib/shared";
import { getUserTimezone } from "@/server/api/helpers";

const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);
const { start, end } = getDayBoundsInTimezone(input.date, userTimezone);

// Query trades within the day in user's timezone
const trades = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    gte(trades.entryTime, start),  // UTC start of day in user's TZ
    lt(trades.entryTime, end),     // UTC end of day in user's TZ
  ),
});
```
**Important:** Do NOT expect the frontend to convert dates with timezone. The frontend preserves the calendar date as-is, and the backend handles all timezone logic.

## Gotchas

### Drizzle returning() can be undefined
**Problem:** TypeScript error when using `const [created] = await db.insert().returning()`
**Solution:** Always guard with `if (!created) throw new Error("Failed to create...")`

### Validate Child Ownership Through Parent
**When:** Deleting/updating a child record (attachment, check, etc.)
**How:** Query child with `{ with: { parent: true } }`, then check `child.parent.userId === ctx.user.id`. Use same error message for "not found" and "not authorized" to avoid leaking information.

### Image Upload Pattern (S3 Keys vs Presigned URLs)
**Problem:** Presigned URLs expire after ~1 hour. Storing them in the database causes broken images.
**Solution:** Store S3 keys in DB, generate presigned URLs on-demand.

**Upload Flow:**
1. Client uploads to S3 via presigned PUT URL
2. Server returns presigned GET URL for display (NOT the S3 key)
3. Client displays image using presigned URL
4. Before save, client transforms presigned URLs → S3 keys (`transformHtmlToS3Keys`)
5. S3 keys stored in database (never expire)
6. On read, server transforms S3 keys → fresh presigned URLs (`transformHtmlWithPresignedUrls`)

**Critical Rules:**
- Never save blob URLs (`blob:...`) - these are temporary previews during upload
- Never save presigned URLs - they expire after 1 hour
- Always save S3 keys (e.g., `images/user_xxx/context/file.png`)
- Use `transformHtmlToS3Keys()` before saving HTML content with images
- Use `transformHtmlWithPresignedUrls()` when returning HTML content to client

**Files:**
- `src/lib/storage/s3.ts` - Transform functions
- `src/hooks/use-image-upload.ts` - Generic upload hook (returns presigned URL)
- `src/hooks/use-tiptap-image-handlers.ts` - Paste/drop handlers with blob preview

## Decisions

<!-- Architectural decisions and rationale -->
