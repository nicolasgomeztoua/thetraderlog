# PRD: Timezone System Unification

## Overview

Unify the date/timezone handling across the entire application to ensure consistent behavior. All dates should display in the user's selected timezone, and all trade grouping should use entry time. Currently there are multiple inconsistencies causing trades to appear on wrong days in different parts of the app.

## Problem Statement

1. **Entry vs Exit Time Inconsistency**: Some analytics use `entryTime` for grouping, others use `exitTime`
2. **Daily Journal Bug**: Uses `toISOString().split("T")[0]` (UTC) instead of user timezone
3. **Calendar Heatmap**: Generates dates in browser local time, converts with user timezone - breaks when they differ
4. **Inconsistent Functions**: `toDateString()` (browser local) vs `getDateStringInTimezone()` (user timezone) used interchangeably
5. **Session Hours**: Recently fixed but was comparing UTC hours against local hours

## Goals

- All trade date grouping uses `entryTime` consistently
- All date strings generated with `getDateStringInTimezone(date, userTimezone)`
- Calendar components work correctly regardless of browser timezone
- User sees all dates in their selected timezone from settings
- Comprehensive test coverage for timezone edge cases

## Core Principle

> **A trade entered at 11:00 PM EST on January 5th should appear on January 5th for a user with EST timezone, regardless of when it was closed or what the browser's timezone is.**

## User Stories

### US-001: Create Timezone System Documentation
**Description**: As a developer, I want clear documentation of the timezone system so that future development maintains consistency.

**Acceptance Criteria**:
- [ ] Add `TIMEZONE_SYSTEM.md` to docs explaining the principles
- [ ] Document which function to use when (decision tree)
- [ ] Document the "entry time for grouping" rule
- [ ] Add examples of correct vs incorrect usage
- [ ] Typecheck passes (`bun run check`)

---

### US-002: Fix Daily Journal Trade Grouping Bug
**Description**: As a trader, I want trades in my daily journal grouped by entry time in my timezone so that trades appear on the correct day.

**File**: `src/server/api/routers/dailyJournal.ts` (Lines 991-999)

**Current (Bug)**:
```typescript
const dateStr = trade.entryTime.toISOString().split("T")[0]; // UTC date
```

**Fixed**:
```typescript
const dateStr = getDateStringInTimezone(trade.entryTime, userTimezone);
```

**Acceptance Criteria**:
- [ ] Import `getDateStringInTimezone` from `@/lib/shared`
- [ ] Fetch `userTimezone` using `getUserTimezone()` helper
- [ ] Replace `.toISOString().split("T")[0]` with `getDateStringInTimezone()`
- [ ] Trade entered 11 PM EST appears on that EST date, not next day
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Fix getOvertradeMetrics to Use Entry Time
**Description**: As a trader, I want overtrade metrics grouped by entry time so that daily P&L is consistent across all analytics.

**File**: `src/server/api/routers/analytics.ts` - `getOvertradeMetrics` procedure

**Acceptance Criteria**:
- [ ] Change date grouping from `exitTime` to `entryTime`
- [ ] Use `getDateStringInTimezone(trade.entryTime, userTimezone)`
- [ ] Verify metrics match calendar heatmap for same days
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Fix getPsychometrics to Use Entry Time
**Description**: As a trader, I want psychometrics grouped by entry time so that daily analysis is consistent.

**File**: `src/server/api/routers/analytics.ts` - `getPsychometrics` procedure

**Acceptance Criteria**:
- [ ] Change date grouping from `exitTime` to `entryTime`
- [ ] Use `getDateStringInTimezone(trade.entryTime, userTimezone)`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Audit All Analytics Procedures for Consistent Date Grouping
**Description**: As a developer, I want to audit all analytics procedures to ensure they use entry time and user timezone consistently.

**File**: `src/server/api/routers/analytics.ts`

**Procedures to verify**:
- `getCalendarData` - should use entryTime ✓
- `getPerformanceByDayOfWeek` - should use entryTime ✓
- `getPerformanceByHour` - should use entryTime ✓
- `getPerformanceBySession` - should use entryTime ✓
- `getPerformanceByMonth` - verify entryTime
- `getEquityCurve` - verify entryTime
- `getDailyPnL` - verify entryTime
- Any other date-grouping procedures

**Acceptance Criteria**:
- [ ] Document findings for each procedure
- [ ] Fix any procedures using exitTime for date grouping
- [ ] All use `getDateStringInTimezone(trade.entryTime, userTimezone)`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Create Timezone-Aware Date String Generator for Frontend
**Description**: As a developer, I want a utility function that generates date strings for calendar grids using the user's timezone so that calendars display correctly.

**File**: `src/lib/shared/timezone.ts`

**New Function**:
```typescript
/**
 * Generate an array of date strings (YYYY-MM-DD) for a date range in user's timezone.
 * Avoids timezone ambiguity by working with strings, not Date objects.
 */
export function generateDateStringsInTimezone(
  startOffset: number,  // days from today (negative = past)
  endOffset: number,    // days from today (0 = today)
  timezone: string
): string[]
```

**Acceptance Criteria**:
- [ ] Function generates YYYY-MM-DD strings based on user's timezone "today"
- [ ] No Date object timezone ambiguity
- [ ] Works correctly across DST transitions
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Create Date String to Display Info Utility
**Description**: As a developer, I want a utility to get display information (day of week, month, formatted date) from a YYYY-MM-DD string so that calendars can render without Date object ambiguity.

**File**: `src/lib/shared/timezone.ts`

**New Functions**:
```typescript
/**
 * Get day of week (0-6) from a date string
 */
export function getDayOfWeekFromDateString(dateStr: string): number

/**
 * Get month (0-11) from a date string
 */
export function getMonthFromDateString(dateStr: string): number

/**
 * Format a date string for display
 */
export function formatDateString(dateStr: string, format: string): string
```

**Acceptance Criteria**:
- [ ] Functions work with YYYY-MM-DD strings directly
- [ ] No timezone conversion issues
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Refactor CalendarHeatmap to Use Date Strings
**Description**: As a trader, I want the analytics calendar heatmap to display trades on the correct day regardless of my browser's timezone.

**File**: `src/components/analytics/calendar-heatmap.tsx`

**Current Problem**:
- Generates `Date[]` at midnight browser local time
- Converts to strings with user timezone
- Mismatch when browser TZ ≠ user TZ

**Solution**:
- Generate `string[]` of YYYY-MM-DD directly in user's timezone
- Use new utility functions for display info
- Match against backend data (already YYYY-MM-DD strings)

**Acceptance Criteria**:
- [ ] Replace Date-based week generation with string-based
- [ ] Use `generateDateStringsInTimezone()` for calendar grid
- [ ] Use `getDayOfWeekFromDateString()` for week alignment
- [ ] Use `getMonthFromDateString()` for month labels
- [ ] Use `formatDateString()` for tooltip display
- [ ] Works correctly when browser TZ ≠ user TZ
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser with different timezone settings

---

### US-009: Verify CalendarSidebar Uses Consistent Timezone
**Description**: As a developer, I want to verify the daily journal calendar sidebar uses the user's timezone consistently.

**File**: `src/components/daily-journal/calendar-sidebar.tsx`

**Acceptance Criteria**:
- [ ] Audit current implementation
- [ ] Verify date lookups use same format as backend
- [ ] Fix any inconsistencies found
- [ ] Document if browser-local approach is intentional (journal dates)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: Integration Tests for Timezone Date Grouping
**Description**: As a developer, I want integration tests verifying trades are grouped by entry time in user's timezone.

**File**: `tests/integration/analytics/timezone-grouping.test.ts`

**Test Scenarios**:
1. Trade entered 11 PM EST, closed next day - appears on entry date
2. Trade entered during DST transition - correct date
3. User in Asia timezone, trade entered their evening - correct local date
4. Multiple trades same UTC day, different user-timezone days

**Acceptance Criteria**:
- [ ] Test file created with timezone grouping tests
- [ ] Tests `getCalendarData` returns correct dates
- [ ] Tests `getOvertradeMetrics` matches calendar data
- [ ] Tests `getPsychometrics` matches calendar data
- [ ] Tests daily journal trade grouping
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-011: Integration Tests for Calendar Heatmap Edge Cases
**Description**: As a developer, I want integration tests for calendar heatmap timezone edge cases.

**File**: `tests/integration/analytics/calendar-heatmap.test.ts`

**Test Scenarios**:
1. User timezone far from UTC (e.g., Pacific/Auckland +12)
2. User timezone negative offset (e.g., America/Los_Angeles -8)
3. DST transition dates
4. Year boundary (Dec 31 / Jan 1)

**Acceptance Criteria**:
- [ ] Test date string generation for various timezones
- [ ] Test week alignment (starts on Sunday)
- [ ] Test month label positions
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-012: Deprecate toDateString for Backend Usage
**Description**: As a developer, I want to add a lint rule or documentation deprecating `toDateString()` for backend date grouping.

**Acceptance Criteria**:
- [ ] Add JSDoc `@deprecated` to `toDateString()` with migration guidance
- [ ] Update function comment to explain when it IS appropriate (frontend calendar selection)
- [ ] Search codebase for backend usages and document them
- [ ] Typecheck passes (`bun run check`)

---

### US-013: Add Timezone Debug Info to Settings
**Description**: As a trader, I want to see my current timezone configuration in settings so I can verify it's correct.

**File**: `src/app/(protected)/settings/_components/settings-content.tsx`

**Acceptance Criteria**:
- [ ] Show current timezone with UTC offset
- [ ] Show current time in selected timezone
- [ ] Show "today's date" in selected timezone
- [ ] Helps users verify their timezone is set correctly
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

## Functional Requirements

1. **FR-001**: All trade date grouping uses `entryTime`, never `exitTime`
2. **FR-002**: All date strings use `getDateStringInTimezone(date, userTimezone)`
3. **FR-003**: Calendar components generate dates in user's timezone, not browser timezone
4. **FR-004**: User's selected timezone from settings is respected everywhere
5. **FR-005**: Timezone conversion happens at the boundary (DB → display), not in business logic

## Non-Goals (Out of Scope)

- Changing how timestamps are stored in database (always UTC)
- Adding per-trade timezone override
- Supporting multiple timezones simultaneously
- Migrating historical data or notifying users of changes
- Changing journal date storage (UTC midnight is fine)

## Technical Considerations

### Database
- No schema changes needed
- Timestamps stored as UTC (correct)
- User timezone stored in `userSettings.timezone`

### Backend Changes
- `dailyJournal.ts`: Fix trade grouping bug
- `analytics.ts`: Standardize on entryTime, verify all procedures

### Frontend Changes
- `calendar-heatmap.tsx`: Refactor to use date strings
- `calendar-sidebar.tsx`: Audit and document

### New Utilities
- `generateDateStringsInTimezone()`
- `getDayOfWeekFromDateString()`
- `getMonthFromDateString()`
- `formatDateString()`

## Design Considerations

- No UI changes beyond settings debug info
- Terminal design system for any new UI elements
- Monospace fonts for timezone display

## Success Metrics

1. Trade entered at 11 PM in user's timezone appears on that date everywhere
2. Calendar heatmap matches daily journal for same dates
3. All analytics procedures show consistent daily P&L
4. Works correctly for users in any timezone (tested with +12, -12, 0)

## Open Questions

1. Should we add a "timezone changed" notification when user updates timezone?
2. Should analytics have a "group by exit time" toggle for users who prefer that?

## Story Dependency Order

```
US-001 (docs)
    ↓
US-006, US-007 (new utilities)
    ↓
US-002, US-003, US-004, US-005 (backend fixes) → US-010 (tests)
    ↓
US-008, US-009 (frontend fixes) → US-011 (tests)
    ↓
US-012 (deprecation)
    ↓
US-013 (settings UI)
```

## Estimated Complexity

| Story | Complexity | Risk |
|-------|------------|------|
| US-001 | Low | Low |
| US-002 | Low | Medium (data change) |
| US-003 | Low | Medium (data change) |
| US-004 | Low | Medium (data change) |
| US-005 | Medium | Low |
| US-006 | Medium | Low |
| US-007 | Low | Low |
| US-008 | High | Medium |
| US-009 | Low | Low |
| US-010 | Medium | Low |
| US-011 | Medium | Low |
| US-012 | Low | Low |
| US-013 | Low | Low |
