# PRD: Full-Text Journal Search

## Overview
Add full-text search across journal entries, trade notes, checklist items, and attachment captions using PostgreSQL `tsvector`. Search is accessible both from a search bar on the daily journal page and via a global search in the main header — letting traders quickly find any entry by keyword.

## Goals
- Enable keyword search across all journal-related text content
- Surface results as date-linked snippets with highlighted matches
- Make search discoverable from both the journal page and the global header
- Communicate to users that they can search *everything* (journal text, trade notes, checklists, captions)

## Reference Documentation
- **Design System**: `.claude/skills/frontend/SKILL.md` + `.claude/skills/frontend/DESIGN_REFERENCE.md`
- **Backend Patterns**: `.claude/skills/backend/SKILL.md`
- **Testing Patterns**: `.claude/skills/testing/SKILL.md` + `.claude/skills/testing/TESTING_REFERENCE.md`
- **E2E Testing**: `.claude/skills/e2e-testing/SKILL.md`
- **Architecture**: `.claude/skills/architecture/SKILL.md`
- **Schema (source of truth)**: `src/server/db/schema.ts`
- **Journal Router**: `src/server/api/routers/dailyJournal.ts`
- **Journal Page**: `src/app/(protected)/daily-journal/page.tsx`
- **Protected Layout (header)**: `src/app/(protected)/layout.tsx`
- **Existing Integration Tests**: `tests/integration/` (follow patterns from `trades.test.ts`, `accounts.test.ts`)
- **Existing E2E Tests**: `tests/e2e/` (follow patterns from `dashboard.spec.ts`, `journal.spec.ts`)
- **Constants**: `src/lib/constants/` (add any new constants here, never hardcode)
- **Error Messages**: `src/lib/constants/errors.ts`

## User Stories

### US-000: Audit Existing Utilities for Full-Text Search
**Description**: As a developer, I want to audit existing code before implementing full-text search so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for any existing search/filter utilities
- [ ] Search `src/server/api/routers/dailyJournal.ts` for existing query patterns we can extend
- [ ] Check if any tsvector/tsquery usage exists in the codebase
- [ ] Review how `getRange` and `getJournalAdjacency` queries work (potential patterns to reuse)
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

---

### US-001: Add tsvector Column and GIN Index to dailyJournals
**Skills**: `/backend`, `/architecture`
**Description**: As a developer, I want a `tsvector` column on the `dailyJournals` table with a GIN index so that PostgreSQL can efficiently perform full-text search on journal content.

**Acceptance Criteria**:
- [ ] Add `searchVector` column (`tsvector`, nullable) to `dailyJournals` in `schema.ts`
- [ ] Add GIN index on `searchVector` column
- [ ] Run `bun run db:push` successfully
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Create Search Vector Update Utility
**Skills**: `/backend`
**Description**: As a developer, I want a utility function that builds a combined tsvector from journal content, trade notes, checklist text, and attachment captions so that the search vector stays up-to-date.

**Acceptance Criteria**:
- [ ] Create utility in `src/lib/journal/search.ts` (or similar)
- [ ] Strip HTML tags from journal `content` before indexing
- [ ] Combine text from: journal content, trade notes (from trades on that date), checklist template text, attachment captions
- [ ] Use `to_tsvector('english', ...)` for proper stemming
- [ ] Weight journal content higher (A) than trade notes (B) than checklist/captions (C)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Update Search Vector on Journal Save
**Skills**: `/backend`
**Description**: As a developer, I want the search vector to update whenever journal content is saved so that search results are always current.

**Acceptance Criteria**:
- [ ] Hook into `updateContent` mutation in `dailyJournal.ts` router
- [ ] After upserting journal content, regenerate and save the `searchVector`
- [ ] Include related trade notes, checklist text, and attachment captions in the vector
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Backfill Existing Journals Search Vectors
**Description**: As a developer, I want a one-time migration script to backfill `searchVector` for all existing journal entries so that old entries are searchable immediately.

**Acceptance Criteria**:
- [ ] Create script at `scripts/backfill-search-vectors.ts`
- [ ] Iterates all existing `dailyJournals` rows
- [ ] Builds search vector using the same utility from US-002
- [ ] Handles HTML stripping for existing content
- [ ] Can be run with `bun run scripts/backfill-search-vectors.ts`
- [ ] Typecheck passes (`bun run check`)

---

### US-005: Create Search tRPC Endpoint
**Skills**: `/backend`
**Description**: As a frontend developer, I want a `search` query on the dailyJournal router so that I can search across all journal content by keyword.

**Acceptance Criteria**:
- [ ] Add `search` procedure to `dailyJournal` router
- [ ] Input: `query` (string, min 2 chars), optional `limit` (default 20)
- [ ] Uses `plainto_tsquery('english', query)` for safe keyword parsing
- [ ] Returns array of `{ journalId, date, snippet, rank }` ordered by relevance
- [ ] Uses `ts_headline()` to generate highlighted snippets (with configurable highlight markers)
- [ ] Scoped to authenticated user's journals only
- [ ] Returns empty array for no matches (not an error)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Integration Tests for Search Endpoint
**Skills**: `/testing`
**Ref**: `.claude/skills/testing/SKILL.md`, `.claude/skills/testing/TESTING_REFERENCE.md`, `tests/integration/`
**Description**: As a developer, I want integration tests for the journal search endpoint so that we can verify correct behavior and prevent regressions.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/journal-search.test.ts`
- [ ] Tests use `setupTrader()` fixtures
- [ ] Tests: search returns matching journal entries
- [ ] Tests: search respects user ownership (can't find other users' journals)
- [ ] Tests: search returns empty array for no matches
- [ ] Tests: search with short query (< 2 chars) is rejected
- [ ] Tests: snippet contains highlighted match text
- [ ] Tests: results are ranked by relevance
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-007: Journal Page Search Bar Component
**Skills**: `/frontend`
**Ref**: `.claude/skills/frontend/SKILL.md`, `.claude/skills/frontend/DESIGN_REFERENCE.md`
**Description**: As a trader, I want a search bar on the daily journal page so that I can quickly find past journal entries by keyword.

**Acceptance Criteria**:
- [ ] Search bar component added above or alongside the calendar sidebar on the journal page
- [ ] Debounced input (300ms) triggers search
- [ ] Results dropdown shows matching dates with text snippets and highlighted keywords
- [ ] Clicking a result navigates to that journal date
- [ ] Empty state: "No matching entries" message
- [ ] Loading state: subtle spinner or skeleton
- [ ] Clear button to reset search
- [ ] Helper text communicates searchable scope: "Search journal entries, trade notes, checklists, and more"
- [ ] Terminal design system: monospace input, chartreuse accent on focus, dark dropdown
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-008: Global Search in Header
**Skills**: `/frontend`
**Ref**: `.claude/skills/frontend/SKILL.md`, `.claude/skills/frontend/DESIGN_REFERENCE.md`
**Description**: As a trader, I want a global search bar in the app header so that I can search my journal from any page.

**Acceptance Criteria**:
- [ ] Search trigger button added to the header bar (layout.tsx) with `Cmd+K` / `Ctrl+K` shortcut
- [ ] Opens a command-palette style modal/dialog
- [ ] Search input with same debounced search behavior as journal page
- [ ] Results show date + snippet, clicking navigates to `/daily-journal?date=YYYY-MM-DD`
- [ ] Modal closes on navigation, Escape, or clicking outside
- [ ] Keyboard navigation: arrow keys to move through results, Enter to select
- [ ] Terminal design system: dark overlay, monospace text, chartreuse highlights
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-009: E2E Tests for Journal Search UI
**Skills**: `/e2e-testing`
**Ref**: `.claude/skills/e2e-testing/SKILL.md`, `tests/e2e/`
**Description**: As a developer, I want E2E tests for the search UI so that we can verify user flows work correctly.

**Acceptance Criteria**:
- [ ] Test file created: `tests/e2e/journal-search.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Tests: journal page search bar renders and accepts input
- [ ] Tests: search results appear after typing
- [ ] Tests: clicking a result navigates to the correct journal date
- [ ] Tests: global search opens with Cmd+K
- [ ] Tests: global search results navigate correctly
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements
1. FR-001: Full-text search uses PostgreSQL `tsvector`/`tsquery` with GIN index
2. FR-002: Searchable content includes journal HTML content (stripped), trade notes, checklist template text, and attachment captions
3. FR-003: Search uses `plainto_tsquery` for safe user input handling
4. FR-004: Results ranked by relevance using `ts_rank`
5. FR-005: Snippets generated with `ts_headline` for keyword highlighting
6. FR-006: Search scoped to authenticated user only
7. FR-007: Search vector updated on every journal content save
8. FR-008: Existing journals backfilled via migration script

## Non-Goals (Out of Scope)
- Fuzzy/typo-tolerant search (e.g., Levenshtein distance)
- Search across non-journal content (analytics, account settings)
- Saved searches or search history
- Search filters (date range, P&L) — future enhancement
- Real-time search vector updates when trades are edited (manual re-index acceptable for now)

## Technical Considerations

### Database Changes
- New `searchVector` (`tsvector`) column on `dailyJournals`
- GIN index for fast full-text search queries
- `ts_headline()` for snippet generation with highlight markers

### API Changes
- New `search` procedure on `dailyJournal` router
- Search vector regeneration hooked into `updateContent` mutation

### HTML Stripping
- Journal content is stored as HTML (Tiptap editor)
- Must strip HTML tags before indexing into tsvector
- Use a lightweight HTML-to-text approach (regex or a small utility)

### Text Weighting
- Weight A: Journal content (primary)
- Weight B: Trade notes
- Weight C: Checklist text, attachment captions

### UI Components
- `JournalSearchBar` — inline search for journal page
- `GlobalSearch` — command-palette modal (Cmd+K) in header

## Design Considerations
- Terminal design system: monospace inputs, dark dropdowns, no rounded corners
- Chartreuse (`#d4ff00`) for search highlight markers and focused states
- Search result snippets in `text-muted-foreground` with highlighted terms in `text-primary`
- Global search modal: dark overlay with `bg-secondary` panel, subtle border
- Search icon in header: muted by default, chartreuse on hover

## Success Metrics
- Users can find any past journal entry by keyword in under 2 seconds
- Search covers all text content types (journal, trades, checklists, captions)
- Zero false negatives for exact keyword matches

## Open Questions
- Should search vector update when trades for a date are modified? (Current plan: no, only on journal save. Can add later.)
- Should we use `websearch_to_tsquery` instead of `plainto_tsquery` for quoted phrase support? (Can upgrade later.)
