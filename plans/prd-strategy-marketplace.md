# PRD: Strategy Section Redesign & Marketplace

## Overview

A comprehensive overhaul of EdgeJournal's strategy section with two major initiatives: (1) redesigning the strategy creation and editing experience to be more spacious, visually distinctive, and engaging with dedicated pages and cover images, and (2) introducing a strategy marketplace where users can share, discover, vote on, and download trading strategies from the community.

## Goals

- Transform strategies into first-class entities with visual identity (cover images, colors)
- Replace cramped modal-based editing with spacious dedicated pages
- Enable community knowledge sharing through a public marketplace
- Surface quality strategies through Reddit-style voting
- Allow traders to learn from others by downloading/copying strategies

## User Stories

### Phase 1: Schema & Infrastructure

---

### US-001: Extend Strategy Schema for Marketplace

**Description**: As a developer, I want to extend the strategies table with marketplace-related fields so that strategies can be shared publicly with proper attribution.

**Acceptance Criteria**:
- [ ] Add `coverImageUrl` column (text, nullable) to strategies table
- [ ] Add `coverImageKey` column (text, nullable) for S3 object key
- [ ] Add `isPublic` column (boolean, default false)
- [ ] Add `isAnonymous` column (boolean, default false) - hide creator identity
- [ ] Add `instruments` column (text[], nullable) - array of instruments (ES, NQ, EUR/USD, etc.)
- [ ] Add `categoryTags` column (text[], nullable) - array of category tags
- [ ] Schema pushed successfully (`bun run db:push`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Create Strategy Votes Table

**Description**: As a developer, I want a votes table to track user votes on public strategies so that we can calculate net scores and prevent duplicate voting.

**Acceptance Criteria**:
- [ ] Create `strategyVotes` table with columns:
  - `id` (text, primary key)
  - `strategyId` (text, FK to strategies)
  - `userId` (text, FK to users)
  - `vote` (integer: 1 for upvote, -1 for downvote)
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)
- [ ] Add unique index on (strategyId, userId) - one vote per user per strategy
- [ ] Add relations to strategies and users
- [ ] Export types: `StrategyVote`, `NewStrategyVote`
- [ ] Schema pushed successfully (`bun run db:push`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Create Strategy Downloads Table

**Description**: As a developer, I want a downloads table to track which users have copied which strategies so that we can show download counts and prevent counting duplicates.

**Acceptance Criteria**:
- [ ] Create `strategyDownloads` table with columns:
  - `id` (text, primary key)
  - `originalStrategyId` (text, FK to strategies) - source strategy
  - `copiedStrategyId` (text, FK to strategies) - user's copy
  - `userId` (text, FK to users) - who downloaded
  - `createdAt` (timestamp)
- [ ] Add index on originalStrategyId for counting downloads
- [ ] Add unique index on (originalStrategyId, userId) - one download per user
- [ ] Add `sourceStrategyId` column to strategies table (text, nullable, FK) - links copy to original
- [ ] Add `cachedStats` column to strategies table (jsonb, nullable) - cached performance metrics
- [ ] Add relations to strategies and users
- [ ] Export types: `StrategyDownload`, `NewStrategyDownload`
- [ ] Schema pushed successfully (`bun run db:push`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003b: Create Strategy Reports Table

**Description**: As a developer, I want a reports table to track user-reported strategies so that we can handle misleading or inappropriate content.

**Acceptance Criteria**:
- [ ] Create `strategyReports` table with columns:
  - `id` (text, primary key)
  - `strategyId` (text, FK to strategies)
  - `reporterId` (text, FK to users) - who reported
  - `reason` (text enum: misleading_stats, inappropriate_content, spam, other)
  - `details` (text, nullable) - optional explanation
  - `status` (text enum: pending, reviewed, dismissed, actioned) - default pending
  - `createdAt` (timestamp)
  - `reviewedAt` (timestamp, nullable)
- [ ] Add index on strategyId for querying reports per strategy
- [ ] Add index on status for admin queue filtering
- [ ] Add unique index on (strategyId, reporterId) - one report per user per strategy
- [ ] Add relations to strategies and users
- [ ] Export types: `StrategyReport`, `NewStrategyReport`
- [ ] Schema pushed successfully (`bun run db:push`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Add Marketplace Constants

**Description**: As a developer, I want centralized constants for marketplace-related values so that they're not hardcoded across the codebase.

**Acceptance Criteria**:
- [ ] Create `src/lib/constants/marketplace.ts`
- [ ] Export `STRATEGY_INSTRUMENTS` array: ["ES", "NQ", "MES", "MNQ", "YM", "RTY", "CL", "GC", "EUR/USD", "GBP/USD", "USD/JPY", "Other"]
- [ ] Export `STRATEGY_CATEGORIES` array: ["Scalping", "Day Trading", "Swing Trading", "Breakout", "Reversal", "Trend Following", "Mean Reversion", "News Trading", "ICT/SMC", "Other"]
- [ ] Export `MARKETPLACE_SORT_OPTIONS`: ["votes", "downloads", "recent"]
- [ ] Export `MARKETPLACE_PAGE_SIZE`: 20
- [ ] Export `MIN_TRADES_TO_PUBLISH`: 20 (minimum trades required to publish)
- [ ] Export `VERIFIED_TRACK_RECORD_THRESHOLD`: 100 (trades for "verified" badge)
- [ ] Export `LIMITED_DATA_THRESHOLD`: 30 (below this, show warning)
- [ ] Export `STRATEGY_REPORT_REASONS`: ["misleading_stats", "inappropriate_content", "spam", "other"]
- [ ] Re-export from `src/lib/constants/index.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### Phase 2: Backend - Cover Image & Edit Page Support

---

### US-005: Add Strategy Cover Image Upload Endpoint

**Description**: As a frontend, I want an API endpoint to get presigned URLs for strategy cover image uploads so that users can add visual identity to their strategies.

**Acceptance Criteria**:
- [ ] Add `getImageUploadUrl` mutation to strategies router
- [ ] Input: `{ strategyId: string, filename: string, mimeType: string, size: number }`
- [ ] Validates strategy ownership
- [ ] Validates file is image type (image/jpeg, image/png, image/webp, image/gif)
- [ ] Validates file size < 5MB
- [ ] Generates S3 key: `strategies/{userId}/{strategyId}/cover-{timestamp}.{ext}`
- [ ] Returns `{ presignedUrl: string, publicUrl: string, key: string }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Update Strategy Mutation for Cover Image

**Description**: As a frontend, I want the strategy update mutation to accept cover image fields so that I can save the URL after upload completes.

**Acceptance Criteria**:
- [ ] Extend `updateStrategySchema` to accept `coverImageUrl` (string, optional)
- [ ] Extend `updateStrategySchema` to accept `coverImageKey` (string, optional)
- [ ] Update mutation handles cover image fields
- [ ] If cover image key changes and old key exists, delete old S3 object
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Add Strategy Auto-Save Endpoint

**Description**: As a frontend, I want an auto-save endpoint that debounces updates so that changes persist automatically without explicit save actions.

**Acceptance Criteria**:
- [ ] Add `autosave` mutation to strategies router
- [ ] Uses same validation as `update` but accepts partial fields
- [ ] Returns `{ updatedAt: Date }` for UI confirmation
- [ ] Validates strategy ownership
- [ ] Does not trigger cache invalidation (silent save)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Integration Tests for Cover Image & Auto-Save

**Description**: As a developer, I want integration tests for the cover image upload and auto-save endpoints so that we can verify correct behavior.

**Acceptance Criteria**:
- [ ] Tests added to `tests/integration/strategies.test.ts`
- [ ] Test `getImageUploadUrl`:
  - Returns presigned URL for valid image request
  - Rejects non-image mime types
  - Rejects files > 5MB
  - Rejects if not strategy owner
- [ ] Test `autosave`:
  - Updates strategy fields correctly
  - Returns updatedAt timestamp
  - Rejects if not strategy owner
- [ ] Test cover image fields in `update`:
  - Accepts coverImageUrl and coverImageKey
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 3: Backend - Marketplace Endpoints

---

### US-009: Add Marketplace Visibility Endpoints

**Description**: As a frontend, I want endpoints to publish/unpublish strategies to the marketplace so that users can control visibility of their strategies.

**Acceptance Criteria**:
- [ ] Add `publish` mutation: sets `isPublic: true`, accepts `isAnonymous`, `instruments`, `categoryTags`
- [ ] Add `unpublish` mutation: sets `isPublic: false`
- [ ] Validates strategy ownership
- [ ] Validates strategy has required fields for publishing (name, description)
- [ ] **Enforces minimum trade count**: rejects if strategy has < `MIN_TRADES_TO_PUBLISH` (20) closed trades
  - Return error: "Strategy needs at least 20 trades before publishing"
- [ ] On publish, compute and cache stats in `cachedStats` column (win rate, profit factor, total trades, avg R)
- [ ] Returns updated strategy with computed stats
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010: Add Marketplace Listing Endpoint

**Description**: As a frontend, I want an endpoint to list public strategies for the marketplace page so that users can browse available strategies.

**Acceptance Criteria**:
- [ ] Add `marketplace.list` query (new router or sub-router)
- [ ] Input: `{ cursor?: string, limit?: number, search?: string, instruments?: string[], categories?: string[], sort?: "votes" | "downloads" | "recent" }`
- [ ] Returns paginated list of public strategies with:
  - Strategy fields (id, name, description, color, coverImageUrl, instruments, categoryTags)
  - Creator info (userId, name, imageUrl) - or null if anonymous
  - Stats from `cachedStats` column (totalTrades, winRate, profitFactor, avgR)
  - Engagement (voteScore, downloadCount)
  - `hasVoted`: current user's vote status (null, 1, or -1)
  - `trackRecordStatus`: "limited" (<30 trades), "normal" (30-99), or "verified" (100+)
- [ ] Supports cursor-based pagination
- [ ] No auth required for listing, auth optional for `hasVoted`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: Add Strategy Voting Endpoints

**Description**: As a frontend, I want endpoints to upvote, downvote, and remove votes so that users can rate strategies.

**Acceptance Criteria**:
- [ ] Add `vote` mutation: `{ strategyId: string, vote: 1 | -1 }`
- [ ] Add `removeVote` mutation: `{ strategyId: string }`
- [ ] Uses upsert pattern (vote replaces existing vote)
- [ ] Only works on public strategies
- [ ] Cannot vote on own strategy
- [ ] **Rate limiting via Upstash Redis**: Max 20 votes per user per hour
  - Use `@upstash/ratelimit` with sliding window algorithm
  - Key pattern: `vote_limit:{userId}`
  - Return error: "Too many votes. Please try again later."
- [ ] Returns new vote score
- [ ] Protected procedures (auth required)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Add Strategy Download/Copy Endpoint

**Description**: As a frontend, I want an endpoint to copy a public strategy to my account so that I can use strategies shared by others.

**Acceptance Criteria**:
- [ ] Add `download` mutation: `{ strategyId: string }`
- [ ] Creates new strategy as copy of original:
  - Copies name (with "(Copy)" suffix), description, color, coverImageUrl
  - Copies entryCriteria, exitRules, riskParameters, scalingRules, trailingRules
  - Copies all strategyRules
  - Sets `sourceStrategyId` to original strategy ID
  - Does NOT copy coverImageKey (user doesn't own that S3 object)
- [ ] Creates `strategyDownload` record linking original to copy
- [ ] Cannot download own strategy
- [ ] Cannot download same strategy twice (check existing download record)
- [ ] Returns the new copied strategy
- [ ] Protected procedure (auth required)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012b: Add Strategy Report Endpoint

**Description**: As a frontend, I want an endpoint to report inappropriate or misleading strategies so that the community can flag problematic content.

**Acceptance Criteria**:
- [ ] Add `report` mutation: `{ strategyId: string, reason: ReportReason, details?: string }`
- [ ] Validates strategy exists and is public
- [ ] Cannot report own strategy
- [ ] Cannot report same strategy twice (one report per user per strategy)
- [ ] Creates `strategyReport` record with status "pending"
- [ ] Returns success confirmation
- [ ] Protected procedure (auth required)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: Add Public Strategy Detail Endpoint

**Description**: As a frontend, I want an endpoint to get full details of a public strategy so that users can view complete information before downloading.

**Acceptance Criteria**:
- [ ] Add `marketplace.getById` query: `{ id: string }`
- [ ] Returns strategy with all fields (same as private getById)
- [ ] Includes creator info (respects isAnonymous)
- [ ] Includes computed stats (from trades)
- [ ] Includes vote score and download count
- [ ] Includes current user's vote status
- [ ] Only works for public strategies
- [ ] No auth required (auth optional for vote status)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013b: Add Cached Stats Refresh Logic

**Description**: As a system, I want strategy stats to refresh when trades are closed so that marketplace stats stay accurate.

**Acceptance Criteria**:
- [ ] When a trade is closed (in `trades.close` or `trades.update` to closed status):
  - Check if trade's strategy is public (`isPublic: true`)
  - If public, recompute stats and update `cachedStats` column
- [ ] Stats to compute: totalTrades, wins, losses, winRate, profitFactor, avgR, avgWin, avgLoss
- [ ] Update `trackRecordStatus` based on new trade count
- [ ] Use a helper function `computeStrategyStats(strategyId)` for reuse
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Integration Tests for Marketplace Backend

**Description**: As a developer, I want integration tests for all marketplace endpoints so that we can verify correct behavior.

**Acceptance Criteria**:
- [ ] Create `tests/integration/marketplace.test.ts`
- [ ] Test `publish`:
  - Sets isPublic, computes and caches stats
  - Rejects incomplete strategies (missing name/description)
  - **Rejects strategies with < 20 trades**
- [ ] Test `unpublish`: sets isPublic false
- [ ] Test `marketplace.list`: returns paginated public strategies, filters work, includes trackRecordStatus
- [ ] Test `vote`: creates vote, replaces existing vote, cannot vote on own
- [ ] Test `removeVote`: removes vote, returns updated score
- [ ] Test `download`: creates copy, records download, cannot download twice
- [ ] Test `marketplace.getById`: returns public strategy, 404 for private
- [ ] Test `report`: creates report, cannot report own, cannot report twice
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 4: Frontend - Strategy Edit Page Redesign

---

### US-015: Create Dedicated Strategy Edit Page Route

**Description**: As a user, I want to edit strategies on a dedicated page at `/strategies/[id]/edit` so that I have more space and a better editing experience.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/strategies/[id]/edit/page.tsx`
- [ ] Page fetches strategy via `strategies.getById`
- [ ] Shows loading skeleton while fetching
- [ ] Shows 404 page if strategy not found
- [ ] Redirects to strategy list if not owner
- [ ] Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page loads at `/strategies/[id]/edit`

---

### US-016: Create Cover Image Upload Component

**Description**: As a user, I want to upload a cover image for my strategy so that it has visual identity.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/cover-image-upload.tsx`
- [ ] Shows current cover image if exists, placeholder if not
- [ ] Click opens file picker (accepts image/*)
- [ ] Uses `useImageUpload` hook with context "strategy-covers"
- [ ] Shows upload progress via toast (existing pattern)
- [ ] Updates strategy via `strategies.update` mutation on upload complete
- [ ] Delete button removes cover image
- [ ] Responsive: full-width banner aspect ratio
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: upload, display, and delete work

---

### US-017: Build Strategy Edit Form with Auto-Save

**Description**: As a user, I want my strategy edits to auto-save so that I don't lose work and don't need to click a save button.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-edit-form.tsx`
- [ ] Fields: name, description, color picker
- [ ] Uses `useDebouncedCallback` (500ms) to trigger `strategies.autosave`
- [ ] Shows "Saving..." indicator during save
- [ ] Shows "All changes saved" with timestamp after save
- [ ] Reverts to "Unsaved changes" if auto-save fails
- [ ] Fields are spacious with breathing room
- [ ] Terminal design styling (monospace inputs)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: edits auto-save with status indicator

---

### US-018: Build Rules Editor Section

**Description**: As a user, I want to edit strategy rules in the spacious edit page so that I can document my entry/exit criteria.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/rules-editor.tsx`
- [ ] Displays rules grouped by category (entry, exit, risk, management)
- [ ] Add rule button per category
- [ ] Edit rule inline (text input)
- [ ] Delete rule with confirmation
- [ ] Drag-and-drop reorder within category
- [ ] Auto-saves rules changes via `strategies.autosave`
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: CRUD operations work, drag-and-drop works

---

### US-019: Build Risk Parameters Section

**Description**: As a user, I want to edit risk management parameters in the spacious edit page so that I can document my risk rules.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/risk-parameters-editor.tsx`
- [ ] Sections for: position sizing, max risk per trade, daily loss limit
- [ ] Position sizing: method dropdown (fixed, risk_percent, kelly) with relevant inputs
- [ ] Max risk: type dropdown (dollars, percent) with value input
- [ ] Daily loss limit: type dropdown (dollars, percent) with value input
- [ ] Max concurrent positions: number input
- [ ] Min R:R ratio: number input
- [ ] Auto-saves on change via `strategies.autosave`
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: all inputs work, values persist

---

### US-020: Assemble Strategy Edit Page Layout

**Description**: As a user, I want the edit page to have a spacious, visually appealing layout so that editing feels premium.

**Acceptance Criteria**:
- [ ] Edit page layout:
  - Full-width cover image at top (with upload overlay)
  - Strategy name as large heading (editable inline)
  - Tabbed sections: Overview, Rules, Risk Management, Advanced
  - Back link to strategy detail page
- [ ] Overview tab: description, color, instruments, categories
- [ ] Rules tab: rules editor component
- [ ] Risk Management tab: risk parameters editor
- [ ] Advanced tab: scaling rules, trailing rules (future - placeholder)
- [ ] Responsive layout (single column on mobile)
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: full edit flow works

---

### Phase 5: Frontend - Strategy Detail Page Update

---

### US-021: Update Strategy Detail Page with Cover Image

**Description**: As a user, I want to see the cover image prominently on the strategy detail page so that strategies have visual identity.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/[id]/page.tsx`
- [ ] Display cover image as hero banner at top (or gradient placeholder if none)
- [ ] Strategy name overlays cover image (with text shadow for readability)
- [ ] Strategy color as accent on the page
- [ ] "Edit" button links to `/strategies/[id]/edit`
- [ ] Keep existing stats and performance sections
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: cover image displays correctly

---

### US-022: Add Publish to Marketplace Section

**Description**: As a user, I want a section to publish my strategy to the marketplace from the detail page so that I can share it with the community.

**Acceptance Criteria**:
- [ ] Add "Share to Marketplace" card section on strategy detail page
- [ ] **If < 20 trades**: show disabled state with message:
  - "Complete at least 20 trades to publish this strategy"
  - Progress indicator: "12/20 trades"
- [ ] If not published (and >= 20 trades): shows "Publish" button with options:
  - Anonymous toggle (hide my identity)
  - Instrument selection (multi-select from STRATEGY_INSTRUMENTS)
  - Category selection (multi-select from STRATEGY_CATEGORIES)
- [ ] If published: shows "Published" badge with:
  - Current vote score
  - Download count
  - Track record status badge
  - "Unpublish" button
  - Link to view in marketplace
- [ ] Calls `strategies.publish` / `strategies.unpublish` mutations
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: publish/unpublish flow works, minimum trades enforced

---

### Phase 6: Frontend - Marketplace Page

---

### US-023: Create Marketplace Page Route

**Description**: As a user, I want a marketplace page at `/marketplace` where I can browse public strategies.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/marketplace/page.tsx`
- [ ] Page title: "Strategy Marketplace"
- [ ] Subtitle explaining the marketplace concept
- [ ] Uses infinite scroll with `marketplace.list` query
- [ ] Shows loading skeleton while fetching
- [ ] Shows empty state if no strategies
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page loads, shows strategies

---

### US-024: Build Marketplace Filter Bar

**Description**: As a user, I want to filter and search marketplace strategies so that I can find relevant strategies.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/filter-bar.tsx`
- [ ] Search input (searches name and description)
- [ ] Instrument filter (multi-select dropdown from STRATEGY_INSTRUMENTS)
- [ ] Category filter (multi-select dropdown from STRATEGY_CATEGORIES)
- [ ] Sort dropdown (Votes, Downloads, Recent)
- [ ] "Clear filters" button when filters active
- [ ] Filters update URL query params
- [ ] Debounced search (300ms)
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: filters work, persist in URL

---

### US-025: Build Marketplace Strategy Card

**Description**: As a user, I want attractive strategy cards in the marketplace so that I can quickly evaluate strategies.

**Acceptance Criteria**:
- [ ] Create `src/components/marketplace/strategy-card.tsx`
- [ ] Shows cover image (or gradient placeholder with color)
- [ ] Strategy name and truncated description
- [ ] Creator name/avatar (or "Anonymous" if anonymous)
- [ ] Instrument/category badges
- [ ] **Track record badge**:
  - "limited" (20-29 trades): Show "⚠️ Limited Data" in muted/warning style
  - "normal" (30-99 trades): No badge
  - "verified" (100+ trades): Show "✓ Verified" in profit green
- [ ] Stats row: Win Rate, Profit Factor, Total Trades
- [ ] Vote controls (up/down arrows with net score)
- [ ] Download count badge
- [ ] "View" button links to marketplace detail page
- [ ] Click anywhere else links to detail page
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: cards render correctly with appropriate badges

---

### US-026: Implement Voting UI

**Description**: As a user, I want to upvote and downvote strategies so that I can surface quality content.

**Acceptance Criteria**:
- [ ] Vote buttons on marketplace cards and detail page
- [ ] Upvote arrow: highlights chartreuse when active
- [ ] Downvote arrow: highlights red when active
- [ ] Click toggles vote (clicking same arrow removes vote)
- [ ] Optimistic UI update (immediate feedback)
- [ ] Calls `strategies.vote` or `strategies.removeVote`
- [ ] Cannot vote on own strategy (buttons disabled/hidden)
- [ ] Login required toast if not authenticated
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: voting works with optimistic updates

---

### US-027: Build Marketplace Strategy Detail Page

**Description**: As a user, I want a detail page for marketplace strategies so that I can see full information before downloading.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/marketplace/[id]/page.tsx`
- [ ] Hero section with cover image, name, creator info
- [ ] **Track record badge** (same logic as card: limited/normal/verified)
- [ ] Full description
- [ ] Entry/exit rules (read-only display)
- [ ] Risk parameters (read-only display)
- [ ] Performance stats: Win Rate, Profit Factor, Avg Win, Avg Loss, Avg R, Total Trades
  - If "limited" status, show warning: "Stats based on limited sample size (<30 trades)"
- [ ] Vote controls (same as card)
- [ ] "Download to My Strategies" button
  - If already downloaded: shows "Already Downloaded" with link to copy
- [ ] **Report button** (flag icon) opens report dialog:
  - Reason dropdown (from STRATEGY_REPORT_REASONS)
  - Optional details textarea
  - Submit calls `strategies.report` mutation
  - Success toast: "Report submitted. We'll review this strategy."
- [ ] Back link to marketplace
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: full detail view works, report flow works

---

### US-028: Implement Download Flow

**Description**: As a user, I want to download/copy a strategy to my account so that I can use it.

**Acceptance Criteria**:
- [ ] "Download" button on marketplace detail page
- [ ] Confirmation dialog: "This will copy the strategy to your account"
- [ ] Calls `strategies.download` mutation
- [ ] Shows loading state during copy
- [ ] Success: redirects to the new strategy's detail page
- [ ] Success toast: "Strategy downloaded! You can now customize it."
- [ ] Error handling for already downloaded
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: download creates copy, redirects correctly

---

### Phase 7: Navigation & Polish

---

### US-029: Add Marketplace to Navigation

**Description**: As a user, I want marketplace accessible from the main navigation so that I can easily find it.

**Acceptance Criteria**:
- [ ] Add "Marketplace" link to sidebar navigation
- [ ] Icon: Store or similar (lucide-react)
- [ ] Position: below "Strategies" in nav
- [ ] Active state when on marketplace routes
- [ ] Terminal design styling matches other nav items
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: nav link works, highlights correctly

---

### US-030: Update Strategy Cards on Main Page

**Description**: As a user, I want strategy cards on the main strategies page to show if a strategy is published so that I can see my public strategies.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/strategy-card.tsx`
- [ ] Show "Public" badge if `isPublic` is true
- [ ] Show vote score and download count if public
- [ ] Badge styled with chartreuse accent
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: badges show on public strategies

---

### US-031: Show Source Strategy Attribution

**Description**: As a user, I want to see which strategies I downloaded from the marketplace so that I remember their origin.

**Acceptance Criteria**:
- [ ] On strategy detail page, if `sourceStrategyId` exists:
  - Show "Downloaded from Marketplace" badge
  - Link to original strategy (if still public)
  - Show original creator (if not anonymous)
- [ ] On strategy cards, show small "Downloaded" indicator if from marketplace
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: attribution displays correctly

---

### Phase 8: Strategy Section UX Improvements

---

### US-032: Create Reusable NullableNumberInput Component

**Description**: As a developer, I want a reusable number input component that properly handles edge cases (0, negatives, empty/null values) so that form inputs work intuitively.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/nullable-number-input.tsx`
- [ ] Component uses internal string state while typing (not controlled number)
- [ ] Allows typing `0` without it being cleared
- [ ] Allows negative numbers (e.g., `-5`)
- [ ] Allows completely empty input (represents `null`)
- [ ] Validates and converts to number on blur (not on every keystroke)
- [ ] Props: `value: number | null`, `onChange: (value: number | null) => void`
- [ ] Props: `placeholder: string`, `min?: number`, `max?: number`, `step?: number`
- [ ] Props: `label?: string` (for error toast context, e.g., "Fixed Size")
- [ ] **Error handling with toast notifications on blur**:
  - If value is not a valid number: toast.error(`${label}: Please enter a valid number`)
  - If value < min: toast.error(`${label}: Must be at least ${min}`)
  - If value > max: toast.error(`${label}: Must be at most ${max}`)
  - On validation error, revert input to previous valid value (or empty)
- [ ] Placeholder text styled distinctly from actual values (use `text-muted-foreground/50` or similar)
- [ ] Terminal design styling (monospace font)
- [ ] Export from `src/components/ui/index.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Implementation Notes**:
```tsx
// Internal state is string to allow intermediate typing states
const [internalValue, setInternalValue] = useState(
  value === null ? "" : String(value)
);

// Only parse and call onChange on blur
const handleBlur = () => {
  if (internalValue === "" || internalValue === "-") {
    onChange(null);
    return;
  }

  const parsed = parseFloat(internalValue);

  if (Number.isNaN(parsed)) {
    toast.error(`${label}: Please enter a valid number`);
    setInternalValue(value === null ? "" : String(value)); // revert
    return;
  }

  if (min !== undefined && parsed < min) {
    toast.error(`${label}: Must be at least ${min}`);
    setInternalValue(value === null ? "" : String(value)); // revert
    return;
  }

  if (max !== undefined && parsed > max) {
    toast.error(`${label}: Must be at most ${max}`);
    setInternalValue(value === null ? "" : String(value)); // revert
    return;
  }

  onChange(parsed);
};
```

---

### US-033: Refactor RiskParametersEditor to Use NullableNumberInput

**Description**: As a user, I want the risk parameters form inputs to allow typing 0 and clearing values so that I can configure my risk settings properly.

**Acceptance Criteria**:
- [ ] Replace all `<Input type="number">` in `risk-parameters-editor.tsx` with `NullableNumberInput`
- [ ] Inputs for: fixedSize, riskPercent, kellyFraction, maxRiskValue, dailyLossValue, maxConcurrentPositions, minRRRatio
- [ ] Can type `0` in any field
- [ ] Can clear any field to empty (null)
- [ ] Placeholders look distinct from actual values (muted styling)
- [ ] Autosave still triggers correctly on blur
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: all number inputs work correctly

---

### US-034: Convert Strategy Detail Page to Read-Only View

**Description**: As a user, I want the strategy detail page (`/strategies/[id]`) to show a read-only view of my strategy so that viewing and editing are separate concerns.

**Acceptance Criteria**:
- [ ] Remove `StrategyForm` component from `/strategies/[id]/page.tsx`
- [ ] Replace with read-only display sections:
  - **Overview**: Name (heading), description (prose text), color swatch
  - **Rules**: Display rules grouped by category (entry, exit, risk, management) as read-only list
  - **Risk Parameters**: Display as formatted key-value pairs
  - **Strategy Details**: Entry criteria and exit rules as formatted text blocks
- [ ] Keep existing: hero banner, stats cards, marketplace section, attribution section
- [ ] "Edit" button prominently displayed, links to `/strategies/[id]/edit`
- [ ] Terminal design styling with terminal-wrapped sections
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page is fully read-only, Edit button works

**Design Pattern** (read-only sections):
```tsx
<div className="overflow-hidden rounded border border-border bg-card">
  {/* Terminal header */}
  <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
    </div>
    <span className="font-mono text-[10px] text-muted-foreground">rules</span>
  </div>
  {/* Content */}
  <div className="p-4">
    {/* Read-only content here */}
  </div>
</div>
```

---

### US-035: Add Duplicate Confirmation Modal with Rename

**Description**: As a user, I want a confirmation modal when duplicating a strategy so that I can rename the copy before it's created.

**Acceptance Criteria**:
- [ ] On Duplicate button click, open confirmation dialog (not immediate action)
- [ ] Dialog shows:
  - Title: "Duplicate Strategy"
  - Description: "Create a copy of [strategy name]"
  - Editable name input pre-filled with "[strategy name] (Copy)"
  - Cancel and "Duplicate" buttons
- [ ] `strategies.duplicate` mutation accepts optional `name` parameter
- [ ] Update tRPC router to accept `{ id: string, name?: string }` input
- [ ] If name provided, use it; otherwise default to "[name] (Copy)"
- [ ] On success: redirect to new strategy detail page
- [ ] Terminal design styling for dialog
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: modal opens, rename works, duplicate creates with custom name

---

### US-036: Add Optimistic Updates for Strategy Color Changes

**Description**: As a user, I want color changes to reflect immediately in the UI so that editing feels responsive.

**Acceptance Criteria**:
- [ ] In `strategy-edit-form.tsx`, implement optimistic update for color field
- [ ] Use `utils.strategies.getById.setData()` for immediate UI update
- [ ] On mutation success: invalidate to sync with server
- [ ] On mutation error: revert to previous value, show error toast
- [ ] Color swatch in header updates immediately when color changed
- [ ] Strategy card color updates after navigating back to list
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: color changes reflect instantly

**Implementation Pattern**:
```tsx
const updateMutation = api.strategies.autosave.useMutation({
  onMutate: async (newData) => {
    await utils.strategies.getById.cancel({ id: strategyId });
    const previous = utils.strategies.getById.getData({ id: strategyId });
    utils.strategies.getById.setData({ id: strategyId }, (old) =>
      old ? { ...old, ...newData } : old
    );
    return { previous };
  },
  onError: (err, newData, context) => {
    if (context?.previous) {
      utils.strategies.getById.setData({ id: strategyId }, context.previous);
    }
    toast.error("Failed to save changes");
  },
  onSettled: () => {
    utils.strategies.getById.invalidate({ id: strategyId });
  },
});
```

---

### US-037: Fix Button Nesting Bug in StrategyEditForm

**Description**: As a developer, I want to fix the hydration error caused by nesting a Checkbox (button) inside a button element.

**Acceptance Criteria**:
- [ ] In `strategy-edit-form.tsx`, locate the instrument/category selection with Checkbox inside button
- [ ] Refactor to use `div` with `onClick` handler instead of `button` wrapping Checkbox
- [ ] Or use Checkbox as standalone with label association
- [ ] No console hydration errors about button nesting
- [ ] Selection behavior unchanged (clicking row toggles checkbox)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: no hydration errors, selection works

**Fix Pattern**:
```tsx
// Before (broken):
<button onClick={toggle}>
  <Checkbox checked={selected} />
  <span>{label}</span>
</button>

// After (fixed):
<div
  role="button"
  tabIndex={0}
  onClick={toggle}
  onKeyDown={(e) => e.key === 'Enter' && toggle()}
  className="cursor-pointer ..."
>
  <Checkbox checked={selected} onCheckedChange={toggle} />
  <span>{label}</span>
</div>
```

---

### US-038: Redesign Strategies List Page

**Description**: As a user, I want the strategies list page (`/strategies`) to have a modern, visually appealing design consistent with the homepage and analytics pages.

**Acceptance Criteria**:
- [ ] Redesign `/strategies/page.tsx` following homepage/analytics design patterns
- [ ] Add hero section with subtle background effects:
  - Grid background pattern (`grid-bg`)
  - Gradient glow orb (`bg-primary/5 blur-[120px]`)
  - Section label badge ("Your Strategies")
  - Main heading with accent color highlight
- [ ] Performance comparison table in terminal-wrapped container
- [ ] Strategy cards with improved styling:
  - Cover image with gradient overlay (or color gradient if no image)
  - Cleaner stats row with terminal styling
  - Public/Downloaded badges
  - Hover state with subtle lift effect
- [ ] Improved empty state matching design system
- [ ] Responsive layout (1/2/3 columns)
- [ ] Terminal design styling throughout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page matches design system, feels polished

**Hero Section Pattern**:
```tsx
<section className="relative py-8 overflow-hidden">
  {/* Background effects */}
  <div className="grid-bg absolute inset-0 opacity-30" />
  <div className="absolute top-1/4 -left-32 h-[400px] w-[400px]
                  rounded-full bg-primary/5 blur-[120px]" />

  <div className="relative mx-auto max-w-none px-4">
    <span className="mb-3 inline-block font-mono text-xs text-primary
                     uppercase tracking-wider">
      Trading Playbook
    </span>
    <h1 className="font-bold text-2xl sm:text-3xl tracking-tight">
      Your <span className="text-primary">Strategies</span>
    </h1>
    <p className="mt-2 font-mono text-muted-foreground text-sm max-w-xl">
      Document your trading strategies with entry rules, risk management, and checklists.
    </p>
  </div>
</section>
```

---

### Phase 9: E2E Testing

---

### US-039: E2E Tests for Strategy Edit Page

**Description**: As a developer, I want E2E tests for the strategy edit page so that we can verify the edit flow works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-edit.spec.ts`
- [ ] Test navigating to edit page from strategy detail
- [ ] Test auto-save indicator shows when editing fields
- [ ] Test tab navigation (Overview, Rules, Risk Management, Advanced)
- [ ] Test color picker interaction
- [ ] Test instruments/categories selection
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Test IDs to verify exist**:
- `strategy-edit-page`
- `strategy-edit-loading`
- `strategy-edit-not-found`
- `strategy-edit-back`
- `strategy-edit-tabs`
- `strategy-edit-tab-overview`
- `strategy-edit-content-overview`
- `risk-parameters-editor`
- `rules-editor`

---

### US-040: E2E Tests for Strategy Detail Page

**Description**: As a developer, I want E2E tests for the strategy detail page so that we can verify the read-only view and marketplace section work correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-detail.spec.ts`
- [ ] Test strategy detail page loads with hero banner
- [ ] Test Edit button navigates to edit page
- [ ] Test marketplace section displays correct state (disabled if < 20 trades, publish options if >= 20)
- [ ] Test attribution section shows for downloaded strategies
- [ ] Test duplicate button opens modal (after US-035)
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Test IDs to verify exist**:
- `strategy-detail-page`
- `strategy-detail-hero`
- `strategy-detail-edit-button`
- `strategy-detail-marketplace-section`
- `strategy-detail-attribution`
- `strategy-detail-duplicate-button`

---

### US-041: E2E Tests for Marketplace Page

**Description**: As a developer, I want E2E tests for the marketplace page so that we can verify browsing and filtering strategies works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/marketplace.spec.ts`
- [ ] Test marketplace page loads with hero section
- [ ] Test filter bar: search input, instrument filter, category filter, sort dropdown
- [ ] Test strategy cards display with correct information
- [ ] Test voting interaction (optimistic update)
- [ ] Test navigation to strategy detail page
- [ ] Test empty state when no results
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Test IDs to verify exist**:
- `marketplace-page`
- `marketplace-hero`
- `marketplace-filter-bar`
- `marketplace-search`
- `marketplace-filter-instruments`
- `marketplace-filter-categories`
- `marketplace-sort`
- `marketplace-strategy-grid`
- `marketplace-strategy-card`
- `marketplace-empty-state`

---

### US-042: E2E Tests for Marketplace Strategy Detail Page

**Description**: As a developer, I want E2E tests for the marketplace strategy detail page so that we can verify the download and report flows work correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/marketplace-detail.spec.ts`
- [ ] Test marketplace detail page loads with strategy info
- [ ] Test vote controls work (up/down/remove)
- [ ] Test download button opens confirmation dialog
- [ ] Test report button opens report dialog
- [ ] Test "Already Downloaded" state shows link to copy
- [ ] Test back link returns to marketplace
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Test IDs to verify exist**:
- `marketplace-detail-page`
- `marketplace-detail-hero`
- `marketplace-detail-vote-controls`
- `marketplace-detail-download-button`
- `marketplace-detail-download-dialog`
- `marketplace-detail-report-button`
- `marketplace-detail-report-dialog`
- `marketplace-detail-back-link`

---

### US-043: E2E Tests for Strategies List Page

**Description**: As a developer, I want E2E tests for the redesigned strategies list page so that we can verify the new design works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategies.spec.ts`
- [ ] Test strategies page loads with hero section
- [ ] Test strategy cards display with cover images/gradients
- [ ] Test public badge shows on published strategies
- [ ] Test downloaded badge shows on marketplace copies
- [ ] Test create strategy button works
- [ ] Test navigation to strategy detail page
- [ ] Test empty state when no strategies
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Test IDs to verify exist**:
- `strategies-page`
- `strategies-hero`
- `strategies-grid`
- `strategies-card`
- `strategies-card-public-badge`
- `strategies-card-downloaded-badge`
- `strategies-create-button`
- `strategies-empty-state`

---

## Non-Goals (Out of Scope)

- Real-time strategy sharing/following (no live sync between original and copy)
- Monetization/paid strategies - requires payments infrastructure
- Comments/discussion on strategies - adds social complexity
- Strategy versioning/history - significant complexity
- Strategy templates/presets - can be added later
- Email notifications for votes/downloads

## Technical Considerations

### Database Changes
- Extend `strategies` table with new columns (see US-001)
- Create `strategyVotes` table (see US-002)
- Create `strategyDownloads` table (see US-003)
- All new tables need proper indexes for performance

### API Changes
- Extend strategies router with new mutations
- Create marketplace router (or sub-router) for public queries
- Public endpoints must not leak private data

### Storage
- Cover images use existing S3 infrastructure (`src/lib/storage/s3.ts`)
- Use `useImageUpload` hook pattern from `src/hooks/use-image-upload.ts`
- Context: "strategy-covers"
- Key pattern: `strategies/{userId}/{strategyId}/cover-{timestamp}.{ext}`

### Performance
- Marketplace list query must use cursor pagination
- Stats cached in `cachedStats` JSONB column, refreshed on trade close
- Use Upstash Redis for vote rate limiting (`@upstash/ratelimit`)

### Rate Limiting (Upstash)
- Vote rate limit: 20 votes per user per hour (sliding window)
- Key pattern: `vote_limit:{userId}`
- Use `@upstash/redis` and `@upstash/ratelimit` packages

### Design Reference
- All UI stories must follow `.claude/skills/frontend-engineer/DESIGN_REFERENCE.md`
- Reference existing components: `src/components/analytics/` for terminal-wrapped charts
- Reference `src/app/(marketing)/_components/` for hero patterns

## Design Specifications (Critical for Stunning UI)

> **Design Reference**: For complete patterns, CSS classes, and component examples, see `.claude/skills/frontend-engineer/DESIGN_REFERENCE.md`

This section captures the key visual patterns. Every story involving UI must adhere to the Terminal design system.

### Core Visual Language

- **Terminal window chrome** (traffic light dots: red/yellow/green) on terminal-wrapped sections
- **Ultra-subtle backgrounds** (`bg-white/1`, `bg-white/2`) for depth
- **Gradient glow orbs** (`bg-primary/5 blur-[120px]`) for atmosphere on hero sections
- **Monospace uppercase `tracking-wider`** on ALL interactive elements
- **Sharp edges** - never use `rounded-lg` or larger

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Obsidian Black | `#050505` | Primary background |
| Electric Chartreuse | `#d4ff00` | Primary accent, CTAs, votes up |
| Ice Blue | `#00d4ff` | Secondary accent, AI elements |
| Profit Green | `#00ff88` | Positive stats, success |
| Loss Red | `#ff3b3b` | Negative stats, votes down |
| Breakeven Gold | `#ffd700` | Neutral, warnings |

### Strategy Card Design (Marketplace)

```
┌─────────────────────────────────────────┐
│ ┌───────────────────────────────────┐   │
│ │     COVER IMAGE (16:9 ratio)      │   │
│ │     with gradient overlay at      │   │
│ │     bottom for text readability   │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Strategy Name                           │
│ Truncated description preview text...   │
│                                         │
│ ┌──────┐ ┌──────┐ ┌─────────┐          │
│ │ ES   │ │ NQ   │ │ Scalping │          │
│ └──────┘ └──────┘ └─────────┘          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Win Rate   PF     Trades   Avg R   │ │
│ │ 67.2%     1.85     247    0.42R   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌───────┐              ┌──────────────┐ │
│ │ ▲ 127 │              │ Anonymous    │ │
│ │   ▼   │              │ 📥 52        │ │
│ └───────┘              └──────────────┘ │
└─────────────────────────────────────────┘
```

**Card CSS patterns:**
```tsx
// Card container
className="overflow-hidden rounded border border-white/5 bg-white/1
           hover:border-white/10 transition-all group"

// Cover image container with gradient
<div className="relative aspect-video overflow-hidden">
  <img className="object-cover w-full h-full" />
  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
</div>

// Instrument/category badges
className="rounded border border-white/10 bg-white/2 px-2 py-1
           font-mono text-[10px] uppercase tracking-wider"

// Stats row
className="grid grid-cols-4 gap-2 rounded bg-white/2 p-2"

// Vote button (active upvote)
className="flex flex-col items-center gap-1 text-primary"
// Vote button (active downvote)
className="flex flex-col items-center gap-1 text-loss"
// Vote button (inactive)
className="flex flex-col items-center gap-1 text-muted-foreground
           hover:text-primary transition-colors"
```

### Strategy Edit Page Layout

**Cover image (Facebook-style banner):**
- Aspect ratio: 3:1 (wide banner, not hero-sized)
- Height: ~200px on desktop, ~150px on mobile
- Click to upload, hover shows upload overlay
- Gradient overlay at bottom for text contrast if needed
- Falls back to strategy color if no image

**Spacious tab content:**
```tsx
// Tab list styling
className="inline-flex bg-secondary/50 p-1 rounded"

// Tab trigger
className="px-6 py-2 font-mono text-xs uppercase tracking-wider
           data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"

// Content sections
className="space-y-8 max-w-3xl" // Centered, breathable layout
```

**Auto-save indicator:**
```tsx
<div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
  {isSaving ? (
    <>
      <div className="h-2 w-2 rounded-full bg-breakeven animate-pulse" />
      <span>Saving...</span>
    </>
  ) : (
    <>
      <div className="h-2 w-2 rounded-full bg-profit" />
      <span>All changes saved</span>
    </>
  )}
</div>
```

### Marketplace Page Layout

**Hero section with search:**
```tsx
<section className="relative py-12 overflow-hidden">
  {/* Background effects (same as homepage) */}
  <div className="grid-bg absolute inset-0 opacity-50" />
  <div className="absolute top-1/4 -left-32 h-[500px] w-[500px]
                  rounded-full bg-primary/5 blur-[120px]" />

  <div className="relative mx-auto max-w-6xl px-6">
    <span className="mb-4 inline-block font-mono text-xs text-primary
                     uppercase tracking-wider">
      Community
    </span>
    <h1 className="font-bold text-4xl sm:text-5xl tracking-tight mb-4">
      Strategy <span className="text-primary">Marketplace</span>
    </h1>
    <p className="font-mono text-muted-foreground text-sm max-w-xl mb-8">
      Discover and download proven trading strategies from the community.
      Share your edge with fellow traders.
    </p>

    {/* Search bar */}
    <div className="relative max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2
                         h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-10 h-12 font-mono bg-white/2 border-white/10"
        placeholder="Search strategies..."
      />
    </div>
  </div>
</section>
```

**Filter bar:**
```tsx
<div className="flex flex-wrap items-center gap-3 py-4 border-y border-white/5">
  {/* Multi-select dropdowns with Terminal styling */}
  <DropdownMenu>
    <DropdownMenuTrigger className="inline-flex items-center gap-2 px-3 py-2
                                     rounded border border-white/10 bg-white/2
                                     font-mono text-xs uppercase tracking-wider">
      Instruments <ChevronDown className="h-3 w-3" />
    </DropdownMenuTrigger>
  </DropdownMenu>

  {/* Sort dropdown */}
  <Select>
    <SelectTrigger className="w-[140px] font-mono text-xs">
      Sort by
    </SelectTrigger>
  </Select>

  {/* Clear filters */}
  {hasFilters && (
    <Button variant="ghost" size="sm" className="font-mono text-xs">
      Clear filters
    </Button>
  )}
</div>
```

### Marketplace Strategy Detail Page

**Terminal-wrapped content sections:**
```tsx
function StrategySection({ title, description, children }) {
  return (
    <div className="overflow-hidden rounded border border-border bg-card">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-border
                      bg-secondary px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {title.toLowerCase().replace(/\s+/g, '-')}
        </span>
        <div className="w-14" />
      </div>

      {/* Section header */}
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="font-mono text-[10px] text-muted-foreground">{description}</p>
      </div>

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
```

**Stats display (same pattern as analytics):**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  <div className="rounded border border-white/5 bg-white/2 p-3">
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
      Win Rate
    </div>
    <div className="font-mono font-bold text-lg text-profit">
      67.2%
    </div>
    <div className="font-mono text-[10px] text-muted-foreground">
      164W / 83L
    </div>
  </div>
  {/* ... more stat cards */}
</div>
```

### Vote UI Component

```tsx
function VoteButtons({
  score,
  userVote,
  onVote
}: {
  score: number;
  userVote: 1 | -1 | null;
  onVote: (vote: 1 | -1) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => onVote(1)}
        className={cn(
          "p-1 rounded transition-colors",
          userVote === 1
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-primary hover:bg-primary/5"
        )}
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      <span className={cn(
        "font-mono font-bold text-sm",
        score > 0 ? "text-profit" : score < 0 ? "text-loss" : "text-muted-foreground"
      )}>
        {score}
      </span>

      <button
        onClick={() => onVote(-1)}
        className={cn(
          "p-1 rounded transition-colors",
          userVote === -1
            ? "text-loss bg-loss/10"
            : "text-muted-foreground hover:text-loss hover:bg-loss/5"
        )}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}
```

### Publish Dialog Design

```tsx
<Dialog>
  <DialogContent className="border-border bg-background max-w-md">
    <DialogHeader>
      <DialogTitle className="font-mono uppercase tracking-wider">
        Share to Marketplace
      </DialogTitle>
      <DialogDescription className="font-mono text-xs">
        Make your strategy public so others can learn from your approach.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      {/* Anonymous toggle */}
      <div className="flex items-center justify-between rounded bg-white/2 p-3">
        <div>
          <div className="font-mono text-sm">Anonymous</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            Hide your identity on this strategy
          </div>
        </div>
        <Switch />
      </div>

      {/* Instrument selection */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Instruments
        </label>
        <div className="flex flex-wrap gap-2">
          {STRATEGY_INSTRUMENTS.map(instrument => (
            <button
              key={instrument}
              className={cn(
                "rounded border px-2 py-1 font-mono text-xs transition-colors",
                selectedInstruments.includes(instrument)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/2 hover:border-white/20"
              )}
            >
              {instrument}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Categories
        </label>
        {/* Same multi-select pattern */}
      </div>
    </div>

    <DialogFooter>
      <Button variant="ghost" className="font-mono text-xs uppercase tracking-wider">
        Cancel
      </Button>
      <Button className="font-mono text-xs uppercase tracking-wider">
        Publish Strategy
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Animation & Polish

**Staggered card entry:**
```tsx
// Apply to marketplace grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {strategies.map((strategy, index) => (
    <div
      key={strategy.id}
      className="animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <StrategyCard strategy={strategy} />
    </div>
  ))}
</div>
```

**Hover effects on cards:**
```tsx
className="group transition-all hover:border-white/10 hover:-translate-y-1 hover:shadow-xl"
```

**Vote button micro-interactions:**
```tsx
// Scale on click
className="active:scale-95 transition-transform"
```

### Track Record Badges

```tsx
function TrackRecordBadge({ status }: { status: "limited" | "normal" | "verified" }) {
  if (status === "limited") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded border border-breakeven/20
                      bg-breakeven/10 px-2 py-1 font-mono text-[10px] text-breakeven
                      uppercase tracking-wider">
        <AlertTriangle className="h-3 w-3" />
        Limited Data
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded border border-profit/20
                      bg-profit/10 px-2 py-1 font-mono text-[10px] text-profit
                      uppercase tracking-wider">
        <Check className="h-3 w-3" />
        Verified Track Record
      </div>
    );
  }

  return null; // "normal" status shows no badge
}
```

**Usage:**
- Card: Show badge below strategy name
- Detail page: Show badge in hero section next to creator info
- Stats section: If "limited", show inline warning below stats

### Empty States

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4">
  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center
                  rounded-full bg-white/5">
    <Compass className="h-8 w-8 text-muted-foreground/50" />
  </div>
  <h3 className="font-semibold text-lg mb-2">No strategies found</h3>
  <p className="font-mono text-sm text-muted-foreground text-center max-w-sm mb-6">
    Try adjusting your filters or search terms to find what you're looking for.
  </p>
  <Button variant="outline" className="font-mono text-xs uppercase tracking-wider">
    Clear Filters
  </Button>
</div>
```

### Responsive Considerations

- **Mobile**: Single column cards, stacked filters, bottom sheet for filter options
- **Tablet**: 2-column grid, side-by-side filters
- **Desktop**: 3-column grid, horizontal filter bar
- All touch targets minimum 44x44px on mobile

### Key Visual Consistency Checks

Before marking any UI story complete, verify:

1. All interactive text uses `font-mono text-xs uppercase tracking-wider`
2. Cards use `bg-white/1` or `bg-white/2` backgrounds
3. Borders use `border-white/5` default, `border-white/10` hover
4. Highlighted elements use `border-primary/20` with `bg-primary/2`
5. Traffic light dots present on terminal-style containers
6. No large border-radius (never use `rounded-lg` or larger)
7. Stats use profit green for positive, loss red for negative
8. Section labels use `font-mono text-xs text-primary uppercase tracking-wider`

## Success Metrics

- Users create strategies with cover images (adoption rate)
- Strategies published to marketplace (share rate)
- Marketplace engagement (votes, downloads)
- Time spent on edit page (indicates spacious layout is usable)

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Minimum trade count before publishing? | Yes, 20 trades minimum (US-009) |
| Stats visibility for small samples? | Show stats but with "Limited Data" badge for <30 trades, "Verified" badge for 100+ (US-025, US-027) |
| Rate limiting on votes? | Yes, 20 votes/hour via Upstash Redis (US-011) |
| Report system for bad content? | Yes, report endpoint with reason categories (US-012b) |
| Strategy detail page editable? | No, detail page is read-only. All editing at /strategies/[id]/edit (US-034) |
| Duplicate confirmation? | Yes, modal with rename option (US-035) |
| Number input handling? | Reusable NullableNumberInput component with string state during typing, validation on blur (US-032) |

## Open Questions

- Admin dashboard for reviewing reports? (can be added later)
- Email notifications when strategy gets votes/downloads? (v2)
- "Editors' Picks" / featured strategies curation? (v2)

---

*PRD generated: 2026-01-18*
*Updated: 2026-01-19 - Added Phase 8: UX Improvements (US-032 to US-038), Phase 9: E2E Testing (US-039 to US-043)*
*Decisions: Upload only for images, All stats public, Full copy on download, Auto-save with debounce, Read-only detail page, Duplicate with rename modal, NullableNumberInput for form fields*
