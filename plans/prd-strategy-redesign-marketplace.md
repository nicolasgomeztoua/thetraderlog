# PRD: Strategy Section Redesign & Marketplace

## Overview

A comprehensive overhaul of EdgeJournal's strategy section with three major initiatives:

1. **Foundation Fixes**: Create a robust `NumberInput` component that properly handles zero values, validation, and edge cases (fixing bugs found in `risk-config.tsx` where `parseFloat(val) || undefined` rejects zero)

2. **Strategy Redesign**: Transform strategies into first-class entities with visual identity (cover images, colors), replace cramped tab-based editing with spacious dedicated pages, and add debounced auto-save with conflict resolution

3. **Strategy Marketplace**: A community hub where users can share, discover, vote on, and download trading strategies with full search, filtering, and Reddit-style voting

## Research Findings & Design Decisions

### Critical Bug: Zero Values Rejected

**Found in**: `src/components/strategy/risk-config.tsx` lines 102, 125, 148, 285, 304

```typescript
// BROKEN: Zero is falsy in JavaScript!
parseFloat(e.target.value) || undefined  // When user types "0", this stores undefined
```

**Impact**: Users cannot set:
- Fixed position size to 0
- Risk percent to 0
- Kelly fraction to 0
- Max concurrent positions to 0
- Min R:R ratio to 0

**Solution**: Create `NumberInput` component with proper value handling.

### Auto-Save Pattern (from journal-editor.tsx)

- 500ms debounce delay
- Compare against `lastSavedContentRef` to prevent unnecessary saves
- Save status: `'idle' | 'saving' | 'saved' | 'error'`
- **Gap**: No conflict detection, no navigation blocking

**Enhancement needed**:
- Add `updatedAt` timestamp for optimistic concurrency
- Add `beforeunload` handler for navigation blocking
- Add conflict resolution UI

### Image Upload Pattern (from daily-journal)

- Two-phase: `getUploadUrl` → S3 PUT → `confirmUpload`
- Progress tracking via XMLHttpRequest
- Blob URL for instant preview, swap to final URL
- S3 key stored for deletion cleanup

**Reusable for**: Strategy cover images with context `"strategy-cover"`

---

## Goals

- Fix number input handling across the codebase (zero values, validation)
- Transform strategies into visually distinctive entities with 16:9 cover images
- Provide spacious, dedicated pages for strategy creation and editing
- Implement debounced auto-save with optimistic concurrency control
- Enable community knowledge sharing through a public marketplace
- Surface quality strategies through Reddit-style upvote/downvote voting
- Allow traders to download/copy strategies with "Derived from" attribution
- Full-featured discovery with search, instrument/category filters, and sorting

---

## User Stories

---

## Phase 0: Foundation - NumberInput Component

**Rationale**: Before building any new forms, we must fix the fundamental number input handling that's broken across the codebase.

---

### US-000: Create NumberInput Component
**Priority**: 0 (BLOCKER - must be done first)

**Description**: As a developer, I want a reusable NumberInput component that correctly handles zero values, empty states, and validation so that all number inputs in the app work correctly.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/number-input.tsx`
- [ ] Component uses local string state while editing (prevents controlled input issues)
- [ ] Syncs with external value only when input is not focused
- [ ] Zero values are correctly stored as `0`, not `undefined` or `null`
- [ ] Empty input stores as `null` (for optional fields) or shows error (for required)
- [ ] Allows intermediate typing states: "0.", "-", "." without validation errors
- [ ] Validates on blur with toast notification for invalid values
- [ ] Supports props: `value`, `onChange`, `min`, `max`, `step`, `precision`, `required`, `placeholder`, `prefix`, `suffix`, `disabled`
- [ ] Handles paste with currency symbol stripping ($, €, £, commas)
- [ ] Uses `inputMode="decimal"` for mobile keyboard
- [ ] Matches existing Input component styling (Terminal design)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Technical Design**:
```typescript
interface NumberInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number; // decimal places to round to
  required?: boolean;
  placeholder?: string;
  prefix?: string; // "$", "%"
  suffix?: string; // "R", "lots"
  disabled?: boolean;
  className?: string;
}

// Key: parseValue does NOT use || fallback
const parseValue = (str: string): number | null => {
  if (str === "" || str === "-" || str === ".") return null;
  const num = parseFloat(str);
  return Number.isNaN(num) ? null : num;
};
```

---

### US-001: Migrate Risk Config to NumberInput
**Priority**: 1

**Description**: As a user, I want to be able to set risk parameters to zero so that I can configure my strategy correctly.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/risk-config.tsx` to use NumberInput
- [ ] Replace all `parseFloat(e.target.value) || undefined` patterns
- [ ] Replace all `parseInt(e.target.value, 10) || undefined` patterns
- [ ] All 7 number inputs migrated: fixedSize, riskPercent, kellyFraction, maxRiskValue, dailyLossValue, maxConcurrentPositions, minRRRatio
- [ ] User can set any field to 0
- [ ] User can clear optional fields to empty
- [ ] Validation shows toast on blur for out-of-range values
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: can set fixedSize to 0

---

### US-002: Migrate Scaling and Trailing Config to NumberInput
**Priority**: 2

**Description**: As a user, I want consistent number input behavior across all strategy config sections.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/scaling-config.tsx` to use NumberInput
- [ ] Update `src/components/strategy/trailing-config.tsx` to use NumberInput
- [ ] All number inputs use consistent validation and zero handling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-003: Replace prompt() with Inline R-Multiple Input
**Priority**: 3

**Description**: As a user, I want to add target R multiples using an inline input instead of browser prompt() so that the UX is consistent and modern.

**Acceptance Criteria**:
- [ ] Remove `prompt()` usage from `risk-config.tsx` line 348
- [ ] Add inline NumberInput that appears when "Add Target" is clicked
- [ ] Input auto-focuses when shown
- [ ] Enter key confirms and adds the value
- [ ] Escape key cancels
- [ ] Click outside cancels
- [ ] Validate: must be a positive number
- [ ] Show error toast if invalid
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-004: Integration Tests for NumberInput
**Priority**: 4

**Description**: As a developer, I want integration tests for the NumberInput component to prevent regressions.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/number-input.test.ts`
- [ ] Test zero value is stored correctly (not null/undefined)
- [ ] Test empty string returns null for optional fields
- [ ] Test min/max validation
- [ ] Test precision rounding
- [ ] Test paste with currency symbols strips them
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 1: Schema & Infrastructure

---

### US-005: Audit Existing Utilities for Strategy Redesign
**Priority**: 5

**Description**: As a developer, I want to audit existing code before implementing the strategy redesign so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Review `src/hooks/use-image-upload.ts` - can reuse for cover images
- [ ] Review `src/server/api/routers/storage.ts` - has `getImageUploadUrl` endpoint
- [ ] Review `src/hooks/use-debounced-mutation.ts` - can reuse for auto-save
- [ ] Review `src/components/daily-journal/journal-editor.tsx` - save status pattern
- [ ] Review `src/components/trade-detail/editable-field.tsx` - local state pattern
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - `useImageUpload` hook with context param: REUSE
  - `useDebouncedMutation` hook: REUSE for auto-save
  - SaveStatus type pattern: REPLICATE
  - EditableField local state pattern: REFERENCE for NumberInput
- [ ] Typecheck passes (`bun run check`)

---

### US-006: Extend Strategy Schema for Visual Identity
**Priority**: 6

**Description**: As a developer, I want to add cover image fields to the strategies table so that strategies can have distinctive visual appearances.

**Acceptance Criteria**:
- [ ] Add to `src/server/db/schema.ts` strategies table:
  - `coverImageUrl` (text, nullable) - public URL
  - `coverImageKey` (text, nullable) - S3 key for deletion
- [ ] Schema changes applied with `bun run db:push`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Extend Strategy Schema for Marketplace
**Priority**: 7

**Description**: As a developer, I want to add marketplace-related fields to the strategies table so that strategies can be published publicly.

**Acceptance Criteria**:
- [ ] Add to `src/server/db/schema.ts` strategies table:
  - `isPublic` (boolean, default false)
  - `isAnonymous` (boolean, default false)
  - `instruments` (text, nullable) - JSON array stored as string
  - `categoryTags` (text, nullable) - JSON array stored as string
  - `sourceStrategyId` (text, nullable, self-referencing FK)
  - `publishedAt` (timestamp with timezone, nullable)
  - `updatedAt` (timestamp with timezone, auto-update) - VERIFY EXISTS for conflict detection
- [ ] Add index on `isPublic` for marketplace queries
- [ ] Schema changes applied with `bun run db:push`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Create Strategy Votes Table
**Priority**: 8

**Description**: As a developer, I want a database table for strategy votes so that users can upvote/downvote marketplace strategies.

**Acceptance Criteria**:
- [ ] Create `strategyVotes` table in `src/server/db/schema.ts`:
  ```typescript
  strategyVotes = createTable("strategy_vote", {
    id: text("id").primaryKey().$defaultFn(() => ids.strategyVote()),
    strategyId: text("strategy_id").notNull().references(() => strategies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    voteType: text("vote_type", { enum: ["up", "down"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
  }, (t) => [
    uniqueIndex("strategy_vote_user_strategy_idx").on(t.userId, t.strategyId),
    index("strategy_vote_strategy_id_idx").on(t.strategyId),
  ])
  ```
- [ ] Add relation definitions
- [ ] Add ID generator in `src/server/db/ids.ts`: `strategyVote: () => createId("sv")`
- [ ] Schema changes applied with `bun run db:push`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: Create Strategy Downloads Table
**Priority**: 9

**Description**: As a developer, I want a database table for tracking strategy downloads so that we can show download counts and track attribution.

**Acceptance Criteria**:
- [ ] Create `strategyDownloads` table in `src/server/db/schema.ts`:
  ```typescript
  strategyDownloads = createTable("strategy_download", {
    id: text("id").primaryKey().$defaultFn(() => ids.strategyDownload()),
    strategyId: text("strategy_id").notNull().references(() => strategies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    copiedStrategyId: text("copied_strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new Date()),
  }, (t) => [
    index("strategy_download_strategy_id_idx").on(t.strategyId),
    index("strategy_download_user_id_idx").on(t.userId),
  ])
  ```
- [ ] Add relation definitions
- [ ] Add ID generator: `strategyDownload: () => createId("sd")`
- [ ] Schema changes applied with `bun run db:push`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: Add Marketplace Constants
**Priority**: 10

**Description**: As a developer, I want centralized constants for marketplace categories, instruments, and sort options.

**Acceptance Criteria**:
- [ ] Create `src/lib/constants/marketplace.ts`
- [ ] Add `STRATEGY_CATEGORIES`:
  ```typescript
  export const STRATEGY_CATEGORIES = [
    { value: "scalping", label: "Scalping" },
    { value: "day_trading", label: "Day Trading" },
    { value: "swing_trading", label: "Swing Trading" },
    { value: "position_trading", label: "Position Trading" },
    { value: "news_trading", label: "News Trading" },
    { value: "breakout", label: "Breakout" },
    { value: "mean_reversion", label: "Mean Reversion" },
    { value: "trend_following", label: "Trend Following" },
    { value: "range_trading", label: "Range Trading" },
    { value: "other", label: "Other" },
  ] as const;
  ```
- [ ] Add `TRADEABLE_INSTRUMENTS` grouped by asset class:
  ```typescript
  export const TRADEABLE_INSTRUMENTS = {
    futures: [
      { value: "ES", label: "ES (S&P 500)" },
      { value: "NQ", label: "NQ (Nasdaq)" },
      { value: "YM", label: "YM (Dow)" },
      { value: "RTY", label: "RTY (Russell)" },
      { value: "CL", label: "CL (Crude Oil)" },
      { value: "GC", label: "GC (Gold)" },
      // ...
    ],
    forex: [
      { value: "EUR/USD", label: "EUR/USD" },
      { value: "GBP/USD", label: "GBP/USD" },
      // ...
    ],
    crypto: [
      { value: "BTC/USD", label: "BTC/USD" },
      { value: "ETH/USD", label: "ETH/USD" },
    ],
  } as const;
  ```
- [ ] Add `MARKETPLACE_SORT_OPTIONS`:
  ```typescript
  export const MARKETPLACE_SORT_OPTIONS = [
    { value: "votes", label: "Most Voted" },
    { value: "downloads", label: "Most Downloaded" },
    { value: "newest", label: "Newest" },
    { value: "updated", label: "Recently Updated" },
  ] as const;
  ```
- [ ] Add image constraints:
  ```typescript
  export const COVER_IMAGE_ASPECT_RATIO = "16:9";
  export const COVER_IMAGE_MAX_SIZE_MB = 5;
  export const COVER_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
  export const COVER_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  ```
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

## Phase 2: Backend - Strategy Visual Identity & Auto-Save

---

### US-011: Add Cover Image Upload Endpoint
**Priority**: 11

**Description**: As a frontend, I want an API endpoint to get a presigned URL for uploading strategy cover images.

**Acceptance Criteria**:
- [ ] Add `getCoverImageUploadUrl` mutation to strategies router
- [ ] Input: `{ strategyId: string, filename: string, mimeType: string, size: number }`
- [ ] Validate user owns the strategy
- [ ] Validate `mimeType` is in `COVER_IMAGE_ACCEPTED_TYPES`
- [ ] Validate `size` is <= `COVER_IMAGE_MAX_SIZE_BYTES`
- [ ] Generate S3 key: `images/${userId}/strategy-covers/${strategyId}/${nanoid()}-${filename}`
- [ ] Return `{ presignedUrl: string, key: string, publicUrl: string }`
- [ ] Reuse existing S3 client from `src/lib/storage/s3.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Add Cover Image Confirmation Endpoint
**Priority**: 12

**Description**: As a frontend, I want an API endpoint to confirm a cover image upload and update the strategy.

**Acceptance Criteria**:
- [ ] Add `confirmCoverImage` mutation to strategies router
- [ ] Input: `{ strategyId: string, key: string, url: string }`
- [ ] Validate user owns the strategy
- [ ] If strategy already has `coverImageKey`, delete old S3 object (graceful failure)
- [ ] Update strategy with new `coverImageUrl` and `coverImageKey`
- [ ] Return updated strategy
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: Add Cover Image Deletion Endpoint
**Priority**: 13

**Description**: As a frontend, I want an API endpoint to delete a strategy's cover image.

**Acceptance Criteria**:
- [ ] Add `deleteCoverImage` mutation to strategies router
- [ ] Input: `{ strategyId: string }`
- [ ] Validate user owns the strategy
- [ ] Delete S3 object using `coverImageKey` (graceful failure - continue if S3 delete fails)
- [ ] Set `coverImageUrl` and `coverImageKey` to `null`
- [ ] Return updated strategy
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Add Strategy Auto-Save Endpoint with Conflict Detection
**Priority**: 14

**Description**: As a frontend, I want an API endpoint for auto-saving strategy changes with optimistic concurrency control.

**Acceptance Criteria**:
- [ ] Add `autosave` mutation to strategies router
- [ ] Input: same as `update` mutation PLUS `clientUpdatedAt: string` (ISO timestamp)
- [ ] Validate user owns the strategy
- [ ] Compare `clientUpdatedAt` with strategy's `updatedAt`:
  - If `clientUpdatedAt` < server's `updatedAt`: return `{ success: false, conflict: true, serverVersion: strategy }`
  - If equal or newer: proceed with update
- [ ] On success: return `{ success: true, savedAt: string, strategy: updatedStrategy }`
- [ ] Do NOT invalidate any queries (auto-save should be silent)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Technical Note**: This prevents lost updates when two browser tabs edit the same strategy.

---

### US-015: Integration Tests for Visual Identity Endpoints
**Priority**: 15

**Description**: As a developer, I want integration tests for the cover image and auto-save endpoints.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/strategies-images.test.ts`
- [ ] Test `getCoverImageUploadUrl`:
  - Returns presigned URL for valid request
  - Rejects invalid mime types
  - Rejects file size over limit
  - Rejects non-owner access
- [ ] Test `confirmCoverImage`:
  - Updates strategy with image URL
  - Rejects non-owner
- [ ] Test `deleteCoverImage`:
  - Clears image fields
  - Rejects non-owner
- [ ] Test `autosave`:
  - Saves changes with current timestamp
  - Returns conflict when server version is newer
  - Does not conflict when timestamps match
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 3: Backend - Marketplace

---

### US-016: Add Strategy Publish Endpoint
**Priority**: 16

**Description**: As a frontend, I want an API endpoint to publish a strategy to the marketplace.

**Acceptance Criteria**:
- [ ] Add `publish` mutation to strategies router
- [ ] Input: `{ strategyId: string, instruments: string[], categoryTags: string[], isAnonymous: boolean }`
- [ ] Validate user owns the strategy
- [ ] Validate `instruments` are valid (exist in `TRADEABLE_INSTRUMENTS`)
- [ ] Validate `categoryTags` are valid (exist in `STRATEGY_CATEGORIES`)
- [ ] Require at least one instrument and one category
- [ ] Recommend (but don't require) cover image - show warning if missing
- [ ] Update strategy: `isPublic = true`, `publishedAt = new Date()`, store instruments/categories as JSON
- [ ] Return updated strategy
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-017: Add Strategy Unpublish Endpoint
**Priority**: 17

**Description**: As a frontend, I want an API endpoint to unpublish a strategy from the marketplace.

**Acceptance Criteria**:
- [ ] Add `unpublish` mutation to strategies router
- [ ] Input: `{ strategyId: string }`
- [ ] Validate user owns the strategy
- [ ] Set `isPublic = false`
- [ ] Keep `instruments`, `categoryTags`, `publishedAt` intact (for easy re-publishing)
- [ ] Return updated strategy
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-018: Add Strategy Vote Endpoint
**Priority**: 18

**Description**: As a frontend, I want an API endpoint to vote on marketplace strategies.

**Acceptance Criteria**:
- [ ] Add `vote` mutation to strategies router
- [ ] Input: `{ strategyId: string, voteType: 'up' | 'down' | null }`
- [ ] `null` removes existing vote
- [ ] Validate strategy is public (`isPublic = true`)
- [ ] Prevent users from voting on their own strategies
- [ ] Upsert vote record:
  - If exists with same type: delete (toggle off)
  - If exists with different type: update
  - If not exists: insert
- [ ] Return `{ upvotes: number, downvotes: number, netVotes: number, userVote: 'up' | 'down' | null }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-019: Add Strategy Download/Copy Endpoint
**Priority**: 19

**Description**: As a frontend, I want an API endpoint to download/copy a marketplace strategy to my collection.

**Acceptance Criteria**:
- [ ] Add `download` mutation to strategies router
- [ ] Input: `{ strategyId: string }`
- [ ] Validate strategy is public
- [ ] Prevent downloading own strategies (error: "You already own this strategy")
- [ ] Check if user already downloaded (has strategy with this sourceStrategyId):
  - If yes: return existing copy (idempotent)
  - If no: create new copy
- [ ] Create full copy:
  - Copy all content fields (name + " (Copy)", description, entryCriteria, exitRules)
  - Copy config fields (riskParameters, scalingRules, trailingRules)
  - Copy rules to new strategy
  - Set `sourceStrategyId` to original
  - Copy `coverImageUrl` (reference same image - don't duplicate in S3)
  - Set `isPublic = false`, clear `publishedAt`, `instruments`, `categoryTags`
- [ ] Create `strategyDownloads` record
- [ ] Return new strategy
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-020: Add Marketplace List Query with Pagination
**Priority**: 20

**Description**: As a frontend, I want an API endpoint to list marketplace strategies with search, filtering, and cursor pagination.

**Acceptance Criteria**:
- [ ] Add `marketplace` sub-router or namespace in strategies router
- [ ] Add `marketplace.list` query
- [ ] Input:
  ```typescript
  {
    search?: string,           // Search name and description
    instruments?: string[],    // Filter by any of these instruments
    categories?: string[],     // Filter by any of these categories
    sortBy?: 'votes' | 'downloads' | 'newest' | 'updated',
    cursor?: string,           // Compound cursor (sortValue + id)
    limit?: number,            // Default 20, max 50
  }
  ```
- [ ] Only return `isPublic = true` strategies
- [ ] Calculate aggregate fields:
  - `upvotes`: count of up votes
  - `downvotes`: count of down votes
  - `netVotes`: upvotes - downvotes
  - `downloadCount`: count of downloads
  - `authorName`: user name, or "Anonymous" if `isAnonymous`
  - `currentUserVote`: 'up' | 'down' | null (for authenticated users)
- [ ] Sort by selected option (use compound cursor for stable pagination):
  - 'votes': netVotes DESC, id DESC
  - 'downloads': downloadCount DESC, id DESC
  - 'newest': publishedAt DESC, id DESC
  - 'updated': updatedAt DESC, id DESC
- [ ] Return `{ strategies: Strategy[], nextCursor: string | null }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-021: Add Marketplace Strategy Detail Query
**Priority**: 21

**Description**: As a frontend, I want an API endpoint to get a single marketplace strategy with full details.

**Acceptance Criteria**:
- [ ] Add `marketplace.getById` query
- [ ] Input: `{ strategyId: string }`
- [ ] Only return if `isPublic = true` (else throw "Strategy not found")
- [ ] Include all strategy fields plus computed fields from list query
- [ ] Include `rules` array with full rule details
- [ ] Include source info if this is a copy: `sourceStrategy: { id, name, authorName, isPublic }`
- [ ] Include `copiesCount`: how many times this has been downloaded
- [ ] Include `currentUserHasDownloaded`: boolean
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-022: Add User's Downloaded Strategies Query
**Priority**: 22

**Description**: As a frontend, I want an API endpoint to list strategies I've downloaded from the marketplace.

**Acceptance Criteria**:
- [ ] Add `getDownloaded` query to strategies router
- [ ] Return all strategies where `sourceStrategyId IS NOT NULL` for current user
- [ ] Include source strategy basic info: `{ id, name, authorName, isPublic }`
- [ ] Sort by `createdAt` DESC (most recent downloads first)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-023: Integration Tests for Marketplace Endpoints
**Priority**: 23

**Description**: As a developer, I want integration tests for the marketplace endpoints.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/marketplace.test.ts`
- [ ] Setup: create two test users (author, browser)
- [ ] Test `publish`:
  - Successfully publishes with valid data
  - Rejects invalid instruments/categories
  - Rejects non-owner
  - Requires at least one instrument and category
- [ ] Test `unpublish`:
  - Successfully unpublishes
  - Rejects non-owner
- [ ] Test `vote`:
  - Creates new vote
  - Toggles off when same vote clicked
  - Changes vote type
  - Removes vote with null
  - Prevents voting on own strategy
  - Prevents voting on private strategy
- [ ] Test `download`:
  - Creates copy with correct attribution
  - Records download
  - Returns existing copy on second download (idempotent)
  - Prevents downloading own strategy
  - Prevents downloading private strategy
- [ ] Test `marketplace.list`:
  - Returns only public strategies
  - Filters by instruments work (OR logic)
  - Filters by categories work (OR logic)
  - Search works (name and description)
  - Sorting works for all options
  - Pagination works
- [ ] Test `marketplace.getById`:
  - Returns public strategy details
  - Returns 404 for private strategy
  - Returns 404 for non-existent strategy
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 4: UI - Cover Image & Auto-Save Components

---

### US-024: Create useStrategyAutosave Hook
**Priority**: 24

**Description**: As a developer, I want a reusable auto-save hook for strategy editing with conflict resolution.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-strategy-autosave.ts`
- [ ] Hook accepts: `strategyId`, `initialData`, `onConflict`
- [ ] Returns:
  ```typescript
  {
    formData: StrategyFormData,
    updateField: (field, value) => void,
    saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict',
    isDirty: boolean,
    lastSavedAt: Date | null,
    conflictData: Strategy | null,
    resolveConflict: (choice: 'keep-mine' | 'use-server') => void,
  }
  ```
- [ ] Debounce delay: 1500ms after last change
- [ ] Track `clientUpdatedAt` for conflict detection
- [ ] Compare against `lastSavedData` to prevent unnecessary saves
- [ ] Call `autosave` mutation with conflict detection
- [ ] Handle conflict response: set `conflictData`, show UI
- [ ] Cancel pending save when new changes occur (no race conditions)
- [ ] Clear dirty state on successful save
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-025: Add Navigation Blocking for Unsaved Changes
**Priority**: 25

**Description**: As a user, I want to be warned before leaving a page with unsaved strategy changes.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-unsaved-changes-warning.ts`
- [ ] Hook accepts: `isDirty: boolean`, `message?: string`
- [ ] Add `beforeunload` event handler when `isDirty` is true
- [ ] Use Next.js router events to intercept navigation:
  - `router.events.on('routeChangeStart')` for soft navigation
  - Show confirmation dialog using browser `confirm()`
  - Cancel navigation if user declines
- [ ] Clean up event listeners on unmount
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-026: Create Save Status Indicator Component
**Priority**: 26

**Description**: As a user, I want to see the auto-save status so I know if my changes are being saved.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/save-status-indicator.tsx`
- [ ] Display states (matching journal-editor.tsx pattern):
  - `'idle'`: hidden
  - `'saving'`: "Saving..." with Loader2Icon spinner
  - `'saved'`: "Saved" with CheckCircleIcon in text-profit color (fade out after 2s)
  - `'error'`: "Save failed" with AlertCircleIcon in text-loss color, retry button
  - `'conflict'`: "Conflict detected" with AlertTriangleIcon, "View Changes" button
- [ ] Small, unobtrusive design (positioned top-right of edit area)
- [ ] Terminal design: monospace font, chartreuse checkmark
- [ ] Props: `status`, `onRetry?`, `onViewConflict?`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-027: Create Conflict Resolution Dialog
**Priority**: 27

**Description**: As a user, I want to see what changed on the server when there's a conflict so I can decide which version to keep.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/conflict-dialog.tsx`
- [ ] Modal showing:
  - Header: "Changes Conflict"
  - Explanation: "Someone else (or another tab) updated this strategy. Choose which version to keep."
  - Two columns: "Your Changes" vs "Server Version"
  - Highlight differences (changed fields)
  - Show timestamps for both versions
- [ ] Actions:
  - "Keep My Changes" - overwrite server (force save)
  - "Use Server Version" - discard local changes, reload
  - "Cancel" - close dialog, keep editing (local changes preserved)
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-028: Create Cover Image Upload Component
**Priority**: 28

**Description**: As a user, I want to upload a cover image for my strategy to give it visual identity.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/cover-image-upload.tsx`
- [ ] 16:9 aspect ratio container (use `aspect-video` Tailwind class)
- [ ] Empty state: dashed border, upload icon, "Add Cover Image" text
- [ ] Drag-and-drop support (highlight on drag over)
- [ ] Click to open file picker
- [ ] File validation: max 5MB, accepted types from constants
- [ ] Show upload progress bar during upload (use XMLHttpRequest pattern from journal-editor)
- [ ] On success: display uploaded image filling container
- [ ] Hover state on existing image: semi-transparent overlay with "Change Image" text
- [ ] Delete button (X icon) in top-right corner on hover
- [ ] Error handling: toast notifications for validation/upload failures
- [ ] Props: `strategyId`, `currentImageUrl`, `onImageChange`
- [ ] Use existing `useImageUpload` hook with context `"strategy-cover"`
- [ ] Terminal design styling (chartreuse accents, dark overlay)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-029: Create Default Cover Gradient Component
**Priority**: 29

**Description**: As a user, I want a generated gradient cover when I don't upload an image so my strategy still looks distinctive.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/default-cover.tsx`
- [ ] Generate gradient based on strategy's `color` field
- [ ] Gradient style: diagonal linear gradient from strategy color (top-left) to darker shade (bottom-right)
  - Use color manipulation: darken by 30% for end color
- [ ] Display strategy name in large monospace text, centered vertically
- [ ] Truncate long names with ellipsis
- [ ] Optional category badge displayed as small pill in bottom-left
- [ ] 16:9 aspect ratio matching uploaded covers
- [ ] Props: `strategyName`, `strategyColor`, `categoryTag?`, `className?`
- [ ] Pure component (no side effects, no state)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser with different strategy colors

---

### US-030: E2E Tests for Cover Image Upload
**Priority**: 30

**Description**: As a developer, I want E2E tests for the cover image upload component.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/strategy-cover-image.spec.ts`
- [ ] Add `data-testid` attributes to cover image upload component:
  - `data-testid="cover-upload-zone"`
  - `data-testid="cover-image"`
  - `data-testid="cover-delete-button"`
  - `data-testid="cover-change-overlay"`
- [ ] Test displays default gradient when no image
- [ ] Test displays existing image correctly
- [ ] Test delete button removes image
- [ ] Test drag-and-drop zone shows hover state
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 5: UI - Strategy Page Redesign

---

### US-031: Create Strategy Hero Banner Component
**Priority**: 31

**Description**: As a user, I want a hero banner at the top of my strategy detail page showing the cover image.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-hero.tsx`
- [ ] Full-width container, max height ~200px (cropped from 16:9)
- [ ] Display cover image or default gradient
- [ ] Strategy name overlaid on bottom-left with text shadow for readability
- [ ] Semi-transparent gradient overlay from bottom for text readability
- [ ] Edit indicator (pencil icon) on hover when in edit mode
- [ ] Props: `strategy`, `isEditing`, `onEditCoverImage`
- [ ] Responsive: scales height on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-032: Create Strategy Stats Summary Component
**Priority**: 32

**Description**: As a user, I want to see key performance stats for my strategy at a glance.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-stats-summary.tsx`
- [ ] Grid of stat cards (responsive: 2 cols mobile, 5 cols desktop)
- [ ] Stats displayed:
  - Total Trades (number, link to filtered trade log)
  - Win Rate (percent, colored green/red based on 50% threshold)
  - Total P&L (currency, colored by profit/loss)
  - Profit Factor (ratio, colored by 1.0 threshold)
  - Avg R (R-multiple, colored by positive/negative)
- [ ] Use existing MetricCard pattern for consistency
- [ ] Loading skeleton state
- [ ] Empty state: "No trades yet - link your first trade to this strategy"
- [ ] Props: `stats`, `isLoading`, `strategyId`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-033: Redesign Strategy Detail Page Layout
**Priority**: 33

**Description**: As a user, I want a spacious strategy detail page with better organization.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/[id]/page.tsx`
- [ ] New layout structure:
  1. Hero banner (cover image/gradient with name)
  2. Action bar: Back button, Edit toggle, Publish button, More menu (Duplicate, Delete)
  3. Stats summary row
  4. Tabbed content area
- [ ] Remove old cramped bordered container
- [ ] Full-width layout (remove max-width constraints)
- [ ] Integrate auto-save hook (`useStrategyAutosave`)
- [ ] Show save status indicator
- [ ] Add navigation blocking when dirty
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-034: Redesign Strategy Form with Improved Tabs
**Priority**: 34

**Description**: As a user, I want improved tabbed navigation in the strategy editor with icons and better spacing.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/strategy-form.tsx`
- [ ] New tab structure with icons (from lucide-react):
  - Overview (Info icon): Name, description, color picker, cover image
  - Strategy (FileText icon): Entry criteria, exit rules (rich text areas)
  - Risk (Shield icon): Risk parameters config
  - Scaling (Layers icon): Scale-in/out config
  - Trailing (TrendingUp icon): Trailing stop config
  - Checklist (CheckSquare icon): Rule checklist management
- [ ] Tab bar styling:
  - Horizontal scrollable on mobile
  - Active tab: chartreuse underline, white text
  - Inactive: muted text, hover shows border
  - Icons always visible, labels hidden on mobile (tooltip)
- [ ] Tab content in spacious container with consistent padding
- [ ] Remember active tab in sessionStorage
- [ ] Keyboard navigation: Arrow keys move between tabs
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-035: Create Strategy Overview Tab Content
**Priority**: 35

**Description**: As a user, I want a dedicated Overview tab with basic strategy info grouped together.

**Acceptance Criteria**:
- [ ] Overview tab content in strategy form
- [ ] Two-column layout on desktop, single column on mobile
- [ ] Left column:
  - Strategy name input (required, max 100 chars)
  - Description textarea (optional, with character count, max 500)
- [ ] Right column:
  - Color picker with preset swatches (10 colors) + custom hex input
  - Cover image upload component
- [ ] Bottom section (if applicable):
  - "Derived from" link if `sourceStrategyId` exists
  - "Published to Marketplace" badge if `isPublic`
- [ ] Spacious layout with clear labels
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-036: E2E Tests for Strategy Detail Page
**Priority**: 36

**Description**: As a developer, I want E2E tests for the redesigned strategy detail page.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/strategy-detail.spec.ts`
- [ ] Add `data-testid` attributes to all new UI elements
- [ ] Test page loads with strategy data
- [ ] Test hero banner displays correctly
- [ ] Test tab navigation works
- [ ] Test edit mode toggle
- [ ] Test save status indicator shows correct states
- [ ] Test navigation prevention when dirty (if possible)
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 6: UI - Marketplace Discovery

---

### US-037: Create Marketplace Page Layout
**Priority**: 37

**Description**: As a user, I want a dedicated marketplace page to discover public strategies.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/marketplace/page.tsx`
- [ ] Layout structure:
  1. Header: "Strategy Marketplace" title, subtitle "Discover strategies from the community"
  2. Search bar (prominent, centered, full-width on mobile)
  3. Filter row: Instruments dropdown, Categories dropdown, Sort dropdown
  4. Active filters display (chips that can be cleared)
  5. Results count: "Showing X strategies"
  6. Strategy card grid (responsive: 1/2/3 columns)
  7. Load more button or infinite scroll
- [ ] Empty state when no results: "No strategies found. Try adjusting your filters."
- [ ] Loading skeleton while fetching
- [ ] URL state sync: filters and search reflected in URL params
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-038: Create Marketplace Search Component
**Priority**: 38

**Description**: As a user, I want a search bar to find strategies by name or description.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/search-bar.tsx`
- [ ] Input with search icon on left
- [ ] Placeholder: "Search strategies..."
- [ ] Debounced search: 300ms delay before updating
- [ ] Clear button (X) when text present
- [ ] Search synced to URL params (`?q=searchterm`)
- [ ] Keyboard shortcut: "/" to focus (when not already in an input)
- [ ] Terminal design: dark input, chartreuse focus ring
- [ ] Props: `value`, `onChange`, `onClear`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-039: Create Marketplace Filter Components
**Priority**: 39

**Description**: As a user, I want filter dropdowns to narrow down marketplace strategies.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/marketplace-filters.tsx`
- [ ] Instruments multi-select dropdown:
  - Grouped by category (Futures, Forex, Crypto) with section headers
  - Checkbox for each instrument
  - "Clear" button in header
  - Show selected count as badge on trigger: "Instruments (3)"
  - Popover with ScrollArea for long lists
- [ ] Categories multi-select dropdown:
  - Checkbox for each category
  - "Clear" button
  - Selected count badge
- [ ] Sort single-select dropdown:
  - Radio-style selection
  - Current selection shown on trigger
  - Options from `MARKETPLACE_SORT_OPTIONS`
- [ ] "Clear all filters" button (shown when any filter active)
- [ ] URL sync: filters reflected in URL params (`?instruments=ES,NQ&categories=scalping`)
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-040: Create Marketplace Strategy Card
**Priority**: 40

**Description**: As a user, I want marketplace strategy cards that show key info at a glance.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/marketplace-strategy-card.tsx`
- [ ] Card structure (top to bottom):
  1. Cover image/gradient (16:9, cropped to shorter height)
  2. Strategy name (bold, truncate with ellipsis if long)
  3. Author: username or "Anonymous" with user icon
  4. Tags row: category pills (max 2 visible + "+N more"), instrument pills (max 3 + "+N")
  5. Stats row: upvotes, downvotes, net score, download count
  6. Inline vote buttons (see US-041)
- [ ] Click card to navigate to detail page
- [ ] Hover effect: subtle border color change
- [ ] Loading skeleton variant
- [ ] Props: `strategy`, `currentUserVote`, `onVote`
- [ ] Terminal design: dark card, chartreuse accents
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-041: Create Voting Component
**Priority**: 41

**Description**: As a user, I want to upvote/downvote marketplace strategies to indicate quality.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/vote-buttons.tsx`
- [ ] Layout: Upvote button, score, Downvote button (horizontal row)
- [ ] Upvote: ArrowBigUp icon, chartreuse when active
- [ ] Downvote: ArrowBigDown icon, loss red when active
- [ ] Score display: net votes (upvotes - downvotes)
- [ ] Click behavior:
  - Click active vote → removes vote
  - Click inactive vote → sets vote (and removes opposite if exists)
- [ ] Optimistic updates: update UI immediately, rollback on error
- [ ] Disabled state for own strategies (with tooltip: "You can't vote on your own strategy")
- [ ] Loading state: show spinner while mutation pending
- [ ] Props: `strategyId`, `upvotes`, `downvotes`, `currentUserVote`, `disabled?`, `onVoteChange`
- [ ] Compact variant for cards, larger variant for detail page
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-042: E2E Tests for Marketplace Page
**Priority**: 42

**Description**: As a developer, I want E2E tests for the marketplace page.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/marketplace.spec.ts`
- [ ] Add `data-testid` attributes to marketplace components
- [ ] Test page loads with strategy cards
- [ ] Test search filters results
- [ ] Test instrument filter works
- [ ] Test category filter works
- [ ] Test sort options change order
- [ ] Test pagination/load more
- [ ] Test clicking card navigates to detail
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 7: UI - Marketplace Detail & Publishing

---

### US-043: Create Marketplace Strategy Detail Page
**Priority**: 43

**Description**: As a user, I want a detailed view of marketplace strategies before downloading.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/marketplace/[id]/page.tsx`
- [ ] Layout structure:
  1. Cover image hero banner (full width)
  2. Title bar: strategy name, author info, published date
  3. Action bar: Vote buttons (large), Download button (primary CTA)
  4. Stats row: Downloads, Votes, Published date
  5. Tags: instrument and category pills
  6. Tabbed content:
     - Overview: description
     - Entry/Exit: entry criteria and exit rules (read-only, formatted)
     - Risk Management: risk parameters (read-only, formatted display)
     - Rules: checklist items (read-only list)
- [ ] "Derived from" section if `sourceStrategyId` exists
- [ ] "Downloaded X times" display
- [ ] Back to marketplace link
- [ ] 404 page if strategy not found or not public
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-044: Create Strategy Download Button Component
**Priority**: 44

**Description**: As a user, I want a clear download button with feedback when I download a strategy.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/download-button.tsx`
- [ ] States:
  - Default: "Add to My Strategies" (chartreuse button)
  - Loading: "Adding..." with spinner
  - Downloaded: "Downloaded ✓" (disabled, green check)
- [ ] On click:
  - Call `download` mutation
  - Show loading state
  - On success: toast "Strategy added to your collection" with "View Strategy" link
  - Transition to "Downloaded" state
- [ ] Check `currentUserHasDownloaded` from query to show initial state
- [ ] Disabled for own strategies (shouldn't be possible to reach this page for own)
- [ ] Props: `strategyId`, `hasDownloaded`, `onDownloaded`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-045: Create Strategy Publish Dialog
**Priority**: 45

**Description**: As a user, I want a dialog to publish my strategy to the marketplace with proper metadata.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/publish-dialog.tsx`
- [ ] Triggered from strategy detail page action bar
- [ ] Dialog content:
  1. Header: "Publish to Marketplace"
  2. Warning text: "This will make your strategy visible to all EdgeJournal users."
  3. Form fields:
     - Instruments multi-select (required, from constants)
     - Categories multi-select (required, from constants)
     - Anonymous toggle with label: "Publish anonymously (hide your name)"
  4. Cover image preview with warning if none: "Strategies with cover images get more attention"
  5. Preview section: how it will appear in marketplace
- [ ] Footer buttons:
  - "Cancel" (secondary)
  - "Publish" (primary, chartreuse)
- [ ] Form validation: require at least one instrument and one category
- [ ] On success: close dialog, show toast, refresh strategy data
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-046: Add Publish/Unpublish Actions to Strategy Detail Page
**Priority**: 46

**Description**: As a user, I want to publish/unpublish my strategies from the detail page.

**Acceptance Criteria**:
- [ ] Update strategy detail page action bar
- [ ] When not published:
  - Show "Publish to Marketplace" button (opens publish dialog)
- [ ] When published:
  - Show "Published" badge with green dot and date
  - Show "View on Marketplace" link (opens in new tab or navigates)
  - Show "Unpublish" button in more menu
  - Unpublish confirmation: "This will remove your strategy from the marketplace. Users who downloaded it will keep their copies."
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-047: E2E Tests for Marketplace Detail and Publishing
**Priority**: 47

**Description**: As a developer, I want E2E tests for the marketplace detail page and publishing flow.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/marketplace-detail.spec.ts`
- [ ] Add `data-testid` attributes to components
- [ ] Test detail page loads with strategy content
- [ ] Test voting works on detail page
- [ ] Test download button flow
- [ ] Test publish dialog opens and validates
- [ ] Test successful publish updates UI
- [ ] Test unpublish flow
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 8: Navigation & Polish

---

### US-048: Add Marketplace to Navigation
**Priority**: 48

**Description**: As a user, I want marketplace in the main navigation so I can easily access it.

**Acceptance Criteria**:
- [ ] Add "Marketplace" link to main sidebar navigation
- [ ] Icon: Store or Globe icon (from lucide-react)
- [ ] Position: after "Strategies" in nav order
- [ ] Active state styling when on `/marketplace` routes
- [ ] Mobile nav includes marketplace
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-049: Add "My Downloads" Section to Strategies Page
**Priority**: 49

**Description**: As a user, I want to see downloaded strategies grouped separately in my strategies list.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/page.tsx`
- [ ] Section header: "My Strategies" for original strategies (`sourceStrategyId IS NULL`)
- [ ] Section header: "Downloaded from Marketplace" for copied strategies
- [ ] Downloaded section:
  - Shows source attribution: "From [Strategy Name]" with link
  - Link goes to marketplace detail if still public, otherwise shows "Source no longer available"
  - Badge: "Downloaded" on cards
- [ ] Empty state for downloads section: "No downloaded strategies yet" with "Browse Marketplace" link
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-050: Redesign Strategy Card with Cover Image
**Priority**: 50

**Description**: As a user, I want strategy cards to display cover images prominently.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/strategy-card.tsx`
- [ ] New card structure:
  1. Cover image/gradient at top (16:9, cropped to ~120px height)
  2. Content area below:
     - Strategy name with color bar accent
     - Description (truncated, 2 lines max)
     - Stats row: trade count, win rate, rule count
- [ ] Hover effect: subtle scale (1.02) and shadow
- [ ] Actions menu (three dots) in top-right corner of image
- [ ] Click navigates to detail page
- [ ] Responsive: cards stack on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-051: E2E Tests for Updated Strategies List
**Priority**: 51

**Description**: As a developer, I want E2E tests for the redesigned strategies list page.

**Acceptance Criteria**:
- [ ] Update test file: `tests/e2e/strategies.spec.ts`
- [ ] Add `data-testid` attributes to list page elements
- [ ] Test page loads with strategy cards showing cover images
- [ ] Test "My Strategies" section displays
- [ ] Test "Downloaded" section displays (when user has downloads)
- [ ] Test new strategy button works
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Phase 9: Performance & Edge Cases

---

### US-052: Add Optimistic Updates for Voting
**Priority**: 52

**Description**: As a developer, I want optimistic updates for voting so the UI feels instant.

**Acceptance Criteria**:
- [ ] Update vote mutation to use tRPC's `onMutate` for optimistic update
- [ ] Snapshot previous vote state before mutation
- [ ] Update local cache immediately on vote
- [ ] On error: roll back to previous state, show toast
- [ ] Handle rapid clicking: debounce or disable during mutation (300ms cooldown)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-053: Add Marketplace Query Caching
**Priority**: 53

**Description**: As a developer, I want proper caching for marketplace queries for fast navigation.

**Acceptance Criteria**:
- [ ] Configure tRPC query options for `marketplace.list`:
  - `staleTime`: 30 seconds (don't refetch if data is fresh)
  - `cacheTime`: 5 minutes (keep in cache for quick back-navigation)
- [ ] Invalidate marketplace cache when user votes or downloads
- [ ] Optional: prefetch on hover over strategy cards
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-054: Handle Strategy Deletion Edge Cases
**Priority**: 54

**Description**: As a developer, I want proper handling when a published strategy is deleted.

**Acceptance Criteria**:
- [ ] When deleting a published strategy:
  - CASCADE DELETE: votes and download records are deleted (via FK)
  - Downloaded copies remain (they have their own `id`, just `sourceStrategyId` becomes orphaned)
- [ ] When viewing a downloaded strategy whose source was deleted:
  - Show "Source strategy no longer available" in the "Derived from" section
  - Strategy still fully functional for the user
- [ ] Cover image cleanup: delete from S3 when strategy deleted
  - Add to `delete` mutation: if `coverImageKey`, delete S3 object
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-055: Add Rate Limiting for Votes
**Priority**: 55

**Description**: As a developer, I want rate limiting on votes to prevent abuse.

**Acceptance Criteria**:
- [ ] Create rate limiting middleware or use existing pattern
- [ ] Limit: 30 votes per minute per user
- [ ] On exceeded: throw error with code `TOO_MANY_REQUESTS`
- [ ] Frontend handles gracefully: show toast "Slow down! Try again in a moment."
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-056: Integration Tests for Edge Cases
**Priority**: 56

**Description**: As a developer, I want integration tests for edge cases.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/marketplace-edge-cases.test.ts`
- [ ] Test downloading same strategy twice returns same copy (idempotent)
- [ ] Test accessing deleted strategy returns 404
- [ ] Test unpublishing strategy: downloads remain valid
- [ ] Test deleting strategy: downloads still work, source shows unavailable
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements Summary

| ID | Requirement |
|----|-------------|
| FR-001 | NumberInput component must correctly store zero as `0`, not `null` or `undefined` |
| FR-002 | NumberInput must validate on blur and show toast for invalid values |
| FR-003 | Strategies must support 16:9 cover images up to 5MB (JPEG, PNG, WebP) |
| FR-004 | Strategies without covers display generated gradients from strategy color |
| FR-005 | Auto-save debounces at 1500ms with optimistic concurrency control |
| FR-006 | Conflict detection compares `updatedAt` timestamps |
| FR-007 | Navigation blocking warns users about unsaved changes |
| FR-008 | Published strategies require at least one instrument and one category |
| FR-009 | Users can publish anonymously or with their name |
| FR-010 | Users can upvote OR downvote (one vote per strategy) |
| FR-011 | Users cannot vote on or download their own strategies |
| FR-012 | Downloaded strategies are full copies with attribution link |
| FR-013 | Marketplace search queries name and description |
| FR-014 | Marketplace filters support multiple instruments and categories |
| FR-015 | Marketplace supports sorting by votes, downloads, newest, updated |

---

## Non-Goals (Out of Scope)

- Comments/discussions on strategies
- Following authors
- Strategy versioning or update notifications
- Paid/premium strategies
- Analytics for authors (who viewed/downloaded)
- Real-time updates (polling is acceptable)
- Mobile app (web responsive only)
- Strategy templates
- AI-generated strategy suggestions
- Side-by-side strategy comparison tool

---

## Technical Considerations

### Database
- Extend `strategies` table with 6 new columns
- Create `strategyVotes` table with unique constraint
- Create `strategyDownloads` table
- Use existing pattern: JSON stored as text strings

### S3/Storage
- Reuse existing S3 infrastructure
- Key prefix: `images/{userId}/strategy-covers/`
- Cleanup on deletion and replacement

### API
- Extend strategies router with ~12 new endpoints
- Use compound cursors for stable marketplace pagination
- Implement rate limiting for votes

### Caching
- 30-second stale time for marketplace list
- Invalidate on vote/download

### Performance
- Paginate marketplace (20 per page)
- Lazy load cover images
- Use database counts, not loading all records

---

## Design Considerations

### Terminal Design System
- All components follow Terminal design from CLAUDE.md
- Primary: Chartreuse `#d4ff00`
- Secondary: Ice Blue `#00d4ff`
- Monospace for all interactive elements
- Dark theme only

### Cover Images
- 16:9 aspect ratio
- Full-width hero on detail (cropped height)
- Maintain ratio in cards
- Gradients use strategy color with darkened end

### Voting UI
- Horizontal: upvote | score | downvote
- Active: chartreuse up, red down
- Disabled clearly visible

### Responsive
- Cards: 1 col mobile, 2 tablet, 3 desktop
- Filters collapse on mobile
- Tabs scroll horizontally on mobile

---

## Success Metrics

1. **Number Input Fix**: Zero values can be entered in all risk/scaling/trailing fields
2. **Auto-Save**: <1% edits lost to navigation
3. **Cover Images**: 50%+ strategies have custom covers within 30 days
4. **Marketplace**: 100+ strategies published in first month
5. **Engagement**: Average 5+ downloads per active user

---

## Story Dependency Graph

```
Phase 0 (NumberInput Fix)
US-000 → US-001 → US-002 → US-003 → US-004

Phase 1 (Schema)
US-005 → US-006 → US-007 → US-008 → US-009 → US-010

Phase 2 (Backend - Visual)
US-011 → US-012 → US-013 → US-014 → US-015

Phase 3 (Backend - Marketplace)
US-016 → US-017 → US-018 → US-019 → US-020 → US-021 → US-022 → US-023

Phase 4 (UI - Components)
US-024 → US-025 → US-026 → US-027 → US-028 → US-029 → US-030

Phase 5 (UI - Strategy Page)
US-031 → US-032 → US-033 → US-034 → US-035 → US-036

Phase 6 (UI - Marketplace Discovery)
US-037 → US-038 → US-039 → US-040 → US-041 → US-042

Phase 7 (UI - Detail & Publish)
US-043 → US-044 → US-045 → US-046 → US-047

Phase 8 (Navigation)
US-048 → US-049 → US-050 → US-051

Phase 9 (Performance)
US-052 → US-053 → US-054 → US-055 → US-056
```

---

*Generated for Ralph autonomous execution. Each story is sized to complete in a single iteration.*
