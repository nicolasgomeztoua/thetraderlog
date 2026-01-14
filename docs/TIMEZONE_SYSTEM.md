# Timezone System Documentation

This document explains EdgeJournal's timezone handling system, ensuring consistency across all date/time operations.

## Core Principles

### 1. Trade Timestamps Are Stored in UTC

All trade entry/exit times are stored in UTC in the database. This is the industry standard for timestamp storage and ensures data portability.

### 2. User Timezone for Display and Grouping

Users select their preferred timezone in settings. This timezone is used for:
- Displaying trade times
- Grouping trades by day (daily P&L, calendar views)
- Session time calculations
- All analytics date grouping

### 3. Entry Time for Date Grouping

**All analytics group trades by ENTRY TIME, not exit time.**

Why? A trade's "day" should be determined by when you made the decision to enter, not when the market hit your target. This ensures:
- Consistent daily P&L across all views
- Trades appear on the day you acted
- Morning trades and overnight trades both count for the correct day

### 4. Browser Timezone vs User Timezone

These can differ! A user in New York might use their laptop while traveling in California. The system handles this:
- **Browser timezone**: Used only for local calendar interactions
- **User timezone**: Used for all trade grouping and analytics

## Decision Tree: Which Function to Use?

```
Need to work with a date/time?
│
├─ Is it a trade entry/exit time?
│   │
│   ├─ Displaying to user? ──────────────► formatDateInTimezone()
│   │
│   ├─ Grouping by day? ─────────────────► getDateStringInTimezone()
│   │
│   └─ Getting hour/day of week? ────────► getHourInTimezone() / getDayOfWeekInTimezone()
│
├─ Is it a calendar/journal date (YYYY-MM-DD)?
│   │
│   ├─ Frontend sending to backend? ─────► toDateString() (preserve calendar date)
│   │
│   ├─ Backend querying by date? ────────► getDayBoundsInTimezone()
│   │
│   └─ Displaying date-only value? ──────► formatLocalDate()
│
└─ Is it for calendar grid generation?
    │
    ├─ Getting today's date string? ─────► getDateStringInTimezone(new Date(), userTimezone)
    │
    └─ Generating calendar dates? ───────► generateDateStringsInTimezone() (when available)
```

## Function Reference

### Backend Date Grouping (Trade Analysis)

#### `getDateStringInTimezone(date, timezone)`
**Use for:** Converting trade timestamps to date strings for grouping.

```typescript
// Group trades by entry date in user's timezone
const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
// Result: "2026-01-06" (even if UTC is "2026-01-07T03:00:00Z")
```

#### `getDayBoundsInTimezone(dateString, timezone)`
**Use for:** Getting UTC boundaries for a calendar day in user's timezone.

```typescript
// Query all trades on "Jan 6" in EST
const { start, end } = getDayBoundsInTimezone("2026-01-06", "America/New_York");
// start: 2026-01-06T05:00:00Z (midnight EST in UTC)
// end: 2026-01-07T05:00:00Z (next midnight EST in UTC)

const trades = await db.query.trades.findMany({
  where: and(
    gte(trades.entryTime, start),
    lt(trades.entryTime, end),
  ),
});
```

### Frontend Date Handling

#### `toDateString(date)`
**Use for:** Sending calendar-selected dates to the backend.

```typescript
// User clicks "Jan 6" in calendar
const dateString = toDateString(selectedDate); // "2026-01-06"
// Backend handles timezone conversion
```

**Why not `getDateStringInTimezone`?** If user's browser is in PST but their preference is EST, using `getDateStringInTimezone` would convert the PST date to EST, which is wrong. The calendar already shows the correct date - just preserve it.

#### `formatLocalDate(date, format)`
**Use for:** Displaying calendar dates, journal dates (stored as UTC midnight).

```typescript
// Journal date stored as 2026-01-06T00:00:00Z
formatLocalDate(journalDate, "MMM d, yyyy"); // "Jan 6, 2026"
```

**Why not `formatDateInTimezone`?** Journal dates are stored as UTC midnight representing a calendar date. Converting to EST would show "Jan 5, 2026 7:00 PM" - the wrong day!

### Time Display

#### `formatDateInTimezone(date, timezone, options)`
**Use for:** Displaying trade entry/exit times.

```typescript
// Trade entered at 2026-01-06T16:30:00Z, user in EST
formatDateInTimezone(trade.entryTime, "America/New_York");
// Result: "Jan 6, 2026" (11:30 AM EST)
```

#### `formatTimeInTimezone(date, timezone, options)`
**Use for:** Displaying just the time portion.

```typescript
formatTimeInTimezone(trade.entryTime, "America/New_York");
// Result: "11:30"
```

## Common Patterns

### Pattern 1: Grouping Trades by Day in Analytics

```typescript
// In a tRPC router
const userTimezone = await getUserTimezone(ctx.db, ctx.user.id);

const trades = await ctx.db.query.trades.findMany({
  where: eq(trades.userId, ctx.user.id),
});

const byDay = new Map<string, Trade[]>();
for (const trade of trades) {
  const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
  const existing = byDay.get(dateStr) ?? [];
  byDay.set(dateStr, [...existing, trade]);
}
```

### Pattern 2: Fetching Trades for a Specific Day

```typescript
// Backend receives date string from frontend
const { start, end } = getDayBoundsInTimezone(input.date, userTimezone);

const trades = await ctx.db.query.trades.findMany({
  where: and(
    eq(trades.userId, ctx.user.id),
    gte(trades.entryTime, start),
    lt(trades.entryTime, end),
  ),
});
```

### Pattern 3: Calendar Grid Generation

When generating calendar grids, use date strings directly to avoid timezone ambiguity:

```typescript
// Generate date strings for calendar (avoiding Date object issues)
const today = getDateStringInTimezone(new Date(), userTimezone);
// Generate past/future dates using string-based utilities
```

## Common Mistakes

### Mistake 1: Using `.toISOString().split('T')[0]`

```typescript
// WRONG - ignores user timezone
const dateStr = trade.entryTime.toISOString().split('T')[0];

// CORRECT - respects user timezone
const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
```

### Mistake 2: Using Exit Time for Day Grouping

```typescript
// WRONG - trade appears on wrong day
const dateStr = getDateStringInTimezone(trade.exitTime, userTimezone);

// CORRECT - trade appears on entry day
const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
```

### Mistake 3: Double Timezone Conversion on Frontend

```typescript
// WRONG - double converts if browser TZ !== user TZ
const dateString = getDateStringInTimezone(selectedDate, userTimezone);

// CORRECT - preserve calendar date as-is
const dateString = toDateString(selectedDate);
// Backend handles timezone conversion
```

### Mistake 4: Converting Journal Dates to User Timezone

```typescript
// WRONG - shows wrong day (Jan 5, 2026 7:00 PM)
formatDateInTimezone(journalDate, userTimezone);

// CORRECT - shows calendar date (Jan 6, 2026)
formatLocalDate(journalDate, "MMM d, yyyy");
```

## Testing Timezone Behavior

When testing timezone-sensitive code:

1. **Create trades at timezone boundary times** (11 PM EST = 4 AM UTC next day)
2. **Verify grouping uses entry time**, not exit time
3. **Test with timezones on opposite sides of UTC** (Pacific/Auckland +12, America/Los_Angeles -8)
4. **Test DST transitions** if relevant

Example test case:
```typescript
// Trade entered 11 PM EST on Jan 6 (4 AM UTC Jan 7)
// Closed at 9 AM EST on Jan 7
// Should appear on Jan 6 in calendar (entry date)
```

## Related Files

- `src/lib/shared/timezone.ts` - All timezone utilities
- `src/server/api/helpers/getUserTimezone.ts` - Fetch user's preferred timezone
- `src/server/api/routers/analytics.ts` - Analytics procedures using timezone grouping
- `src/server/api/routers/dailyJournal.ts` - Journal with timezone-aware date handling
