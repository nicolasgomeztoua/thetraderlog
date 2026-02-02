# PRD: Command Center Dashboard

## Overview

Complete redesign of the dashboard from a static stats page into a dynamic Command Center - the trader's cockpit that adapts based on time of day and trading activity. Shows journal adjacency, rule compliance, P&L calendar, and mini-snapshots of all major pages for quick context without navigation.

## Goals

- Transform dashboard into an adaptive control center that changes based on market hours
- Surface journal completion status alongside trading activity (no more missed journal days)
- Show rule compliance scorecard for accountability
- Provide at-a-glance previews of Analytics, Strategies, Journal, and Daily Journal
- Add P&L calendar heatmap for visual performance tracking
- Reduce navigation friction with contextual quick actions

## User Stories

### US-000: Audit Existing Dashboard & Utility Functions
**Description**: As a developer, I want to audit existing dashboard code and utilities before implementing the Command Center so that we reuse components and avoid duplication.

**Acceptance Criteria**:
- [ ] Document current dashboard components and their data sources
- [ ] Search `src/lib/` for date/calendar utilities that can be reused
- [ ] Search for existing P&L calculation utilities
- [ ] Search for existing journal/checklist status utilities
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Identify components to keep vs replace
- [ ] Typecheck passes (`bun run check`)

---

### US-001: Create Trading Context Hook
**Description**: As a developer, I want a hook that determines the user's trading context based on their actual activity so that the dashboard can adapt its layout and emphasis.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-trading-context.ts`
- [ ] Context based on **actual user state**, not fixed hours:
  - `hasOpenPositions`: boolean (any open trades)
  - `tradedToday`: boolean (any closed trades today)
  - `journaledToday`: boolean (journal started/completed)
  - `lastTradeTime`: Date | null
  - `suggestedAction`: 'start-journal' | 'review-trades' | 'log-trade' | 'idle'
- [ ] Derive `suggestedAction` logic:
  - Traded today + no journal → 'start-journal'
  - Has unreviewed trades → 'review-trades'
  - No trades today → 'log-trade'
  - Otherwise → 'idle'
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Create Dashboard Layout Grid Component
**Description**: As a developer, I want a responsive grid layout component for the Command Center so that widgets can be arranged in a cohesive dashboard.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/command-center-grid.tsx`
- [ ] CSS Grid layout with named areas for widget placement
- [ ] Responsive: 3-column on desktop, 2-column on tablet, 1-column on mobile
- [ ] Supports widget size variants: `sm` (1x1), `md` (2x1), `lg` (2x2), `wide` (3x1)
- [ ] Terminal design system styling (dark bg, border accents)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-003: Create Base Dashboard Widget Component
**Description**: As a developer, I want a reusable widget wrapper component so that all dashboard cards have consistent styling and behavior.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/dashboard-widget.tsx`
- [ ] Props: `title`, `icon`, `size`, `href` (optional link to full page), `loading`, `children`
- [ ] Terminal window chrome styling (title bar with action dots)
- [ ] "View More" link in header when `href` provided
- [ ] Loading skeleton state
- [ ] Hover state with subtle glow effect
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Create Journal Status Widget
**Description**: As a trader, I want to see today's journal status prominently so that I never forget to journal on trading days.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/journal-status-widget.tsx`
- [ ] Shows status: "Not Started" / "In Progress" / "Completed"
- [ ] Displays word count if started
- [ ] Shows checklist completion percentage
- [ ] One-click "Start Journal" or "Continue Journal" button
- [ ] Visual indicator (icon/color) for each status
- [ ] Links to `/daily-journal`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-005: Create Journal Streak Calendar Widget
**Description**: As a trader, I want to see a calendar showing which trading days I journaled so that I can maintain consistency.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/journal-streak-widget.tsx`
- [ ] Mini calendar view (current month)
- [ ] Color coding: Traded+Journaled (green), Traded+No Journal (red/warning), No Trades (neutral)
- [ ] Shows current streak count ("5 day streak")
- [ ] Shows completion rate ("23/25 trading days journaled")
- [ ] Hover on date shows: trade count, journal status, P&L
- [ ] Links to `/daily-journal` on date click
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-006: Create tRPC Endpoint for Journal Adjacency Data
**Description**: As a frontend, I want an API endpoint that returns journal completion status alongside trading days so that the streak widget can display accurate data.

**Acceptance Criteria**:
- [ ] Add `getJournalAdjacency` query to `dailyJournal` router
- [ ] Input: `{ accountId, startDate, endDate }`
- [ ] Returns array of: `{ date, hasTrades, tradeCount, pnl, hasJournal, journalWordCount, checklistCompletion }`
- [ ] Efficient query joining trades and journals by date
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Integration Tests for Journal Adjacency Endpoint
**Description**: As a developer, I want integration tests for the journal adjacency endpoint so that we verify correct data aggregation.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/journal-adjacency.test.ts`
- [ ] Test returns correct data for dates with trades + journal
- [ ] Test returns correct data for dates with trades + no journal
- [ ] Test returns correct data for dates with no trades
- [ ] Test respects account filtering
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-008: Create Journal Metrics Widget
**Description**: As a trader, I want to see journal metrics (completion rate, avg word count, emotional patterns) so that I can track my journaling habits.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/journal-metrics-widget.tsx`
- [ ] Shows: Completion rate %, Avg word count, Most common emotional state
- [ ] Sparkline chart for journal length over last 30 days
- [ ] Emotional state distribution mini-donut
- [ ] Compact layout fitting `sm` widget size
- [ ] Links to `/daily-journal`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-009: Create Recent Journal Excerpts Widget
**Description**: As a trader, I want to see snippets from my recent journal entries so that I can recall recent insights without navigating away.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/journal-excerpts-widget.tsx`
- [ ] Shows last 3 journal entries as cards
- [ ] Each card: date, first ~100 chars of content (stripped HTML), P&L badge
- [ ] Truncate with "..." and "Read more" link
- [ ] Click opens that date in `/daily-journal`
- [ ] Empty state: "No recent journals"
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-010: Create Rule Compliance Scorecard Widget
**Description**: As a trader, I want to see what percentage of today's trades followed my strategy rules so that I stay accountable.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/rule-compliance-widget.tsx`
- [ ] Shows overall compliance percentage with circular gauge
- [ ] Breakdown by rule category (Entry, Exit, Risk, Management)
- [ ] List of violated rules with violation count
- [ ] Color coding: >80% green, 50-80% yellow, <50% red
- [ ] Links to `/strategies`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-011: Create tRPC Endpoint for Rule Compliance Summary
**Description**: As a frontend, I want an API endpoint that calculates rule compliance for a date range so that the widget can display accurate scorecard data.

**Acceptance Criteria**:
- [ ] Add `getRuleCompliance` query to `strategies` router
- [ ] Input: `{ accountId, startDate, endDate }`
- [ ] Returns: `{ overall: number, byCategory: { entry, exit, risk, management }, violations: [{ ruleId, ruleName, count }] }`
- [ ] Calculates from trade rule check records
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Integration Tests for Rule Compliance Endpoint
**Description**: As a developer, I want integration tests for the rule compliance endpoint so that we verify correct calculations.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/rule-compliance.test.ts`
- [ ] Test returns 100% when all rules followed
- [ ] Test returns correct % with partial compliance
- [ ] Test violation counting is accurate
- [ ] Test category breakdown is correct
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-013: Create P&L Calendar Widget
**Description**: As a trader, I want a P&L calendar heatmap so that I can visually see my daily performance over time.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/pnl-calendar-widget.tsx`
- [ ] Full month calendar grid view
- [ ] Heatmap coloring: profit intensity (greens), loss intensity (reds), no trades (neutral)
- [ ] Hover shows: date, P&L amount, trade count, win rate
- [ ] Month navigation (prev/next)
- [ ] Summary row: total P&L, trading days, win rate for displayed month
- [ ] Uses `md` or `lg` widget size
- [ ] Links to `/analytics` time tab
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-014: Create Analytics Snapshot Widget
**Description**: As a trader, I want a mini-preview of my analytics so that I can see key metrics without navigating to the full page.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/analytics-snapshot-widget.tsx`
- [ ] Shows: Win Rate gauge, Profit Factor, Current Streak, Expectancy
- [ ] Mini cumulative P&L sparkline (last 20 trades)
- [ ] Period toggle: Today / This Week / This Month
- [ ] Compact 2x2 metric grid
- [ ] "View Analytics" link to `/analytics`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-015: Create Strategies Snapshot Widget
**Description**: As a trader, I want a mini-preview of my strategy performance so that I can see which strategies are working.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/strategies-snapshot-widget.tsx`
- [ ] Shows top 3 strategies by P&L (mini leaderboard)
- [ ] Each row: strategy name, color dot, P&L, trade count
- [ ] Highlights "Top Performer" badge on #1
- [ ] Shows "No strategies" empty state if none configured
- [ ] "View Strategies" link to `/strategies`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-016: Create Recent Trades Snapshot Widget
**Description**: As a trader, I want a mini-preview of my recent trades so that I can see latest activity at a glance.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/trades-snapshot-widget.tsx`
- [ ] Shows last 5 trades in compact list
- [ ] Each row: symbol, direction icon, P&L (colored), time ago
- [ ] Quick stats row: Today's trades count, Today's P&L
- [ ] "View All Trades" link to `/journal`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-017: Create Today's Performance Widget
**Description**: As a trader, I want a prominent display of today's trading performance so that I can track my daily progress.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/today-performance-widget.tsx`
- [ ] Large P&L display with profit/loss coloring
- [ ] Trade count, Win/Loss count, Win rate
- [ ] Comparison to daily average: "Above/Below average"
- [ ] For prop accounts: Daily loss limit progress bar
- [ ] Shows "No trades yet" state when `tradedToday` is false
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-018: Create Quick Actions Widget
**Description**: As a trader, I want contextual quick action buttons so that I can perform common tasks without navigation.

**Acceptance Criteria**:
- [ ] Create `src/components/dashboard/widgets/quick-actions-widget.tsx`
- [ ] Actions adapt based on user's actual trading context:
  - Has open positions → "View Open Positions" prominent
  - Traded today + no journal → "Start Journal" prominent
  - Has unreviewed trades → "Review Trades" prominent
  - Default actions always available: "Log Trade", "View Analytics", "View Strategies"
- [ ] Primary action highlighted based on `suggestedAction` from context hook
- [ ] Icon + label for each action
- [ ] Keyboard shortcuts hint on hover
- [ ] Compact horizontal or grid layout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-019: Assemble Command Center Dashboard Page
**Description**: As a developer, I want to assemble all widgets into the new Command Center dashboard page replacing the old dashboard.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/dashboard/page.tsx`
- [ ] Use `CommandCenterGrid` layout
- [ ] Arrange widgets in logical groupings:
  - Top row: Today's Performance (wide), Quick Actions
  - Left column: Journal Status, Journal Streak, Rule Compliance
  - Center: P&L Calendar (large)
  - Right column: Analytics Snapshot, Strategies Snapshot, Recent Trades
  - Bottom: Journal Excerpts (wide)
- [ ] Pass trading context to widgets that need it
- [ ] Loading states for all async data
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser - all widgets render correctly

---

### US-020: Add Dashboard Widget Loading Skeletons
**Description**: As a trader, I want smooth loading states so that the dashboard feels responsive while data loads.

**Acceptance Criteria**:
- [ ] Create skeleton variants for each widget type
- [ ] Skeletons match widget dimensions
- [ ] Subtle pulse animation
- [ ] No layout shift when data loads
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-021: E2E Tests for Command Center Dashboard
**Description**: As a developer, I want E2E tests for the Command Center so that we verify the dashboard works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/command-center.spec.ts`
- [ ] Test dashboard loads with all widgets visible
- [ ] Test P&L calendar navigation works
- [ ] Test quick actions navigate correctly
- [ ] Test journal status click opens journal
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-022: Mobile Responsive Adjustments
**Description**: As a trader on mobile, I want the Command Center to be usable on smaller screens so that I can check my dashboard on the go.

**Acceptance Criteria**:
- [ ] Single column layout on mobile (<768px)
- [ ] Widgets stack in priority order (Today's Performance first)
- [ ] P&L Calendar switches to compact week view on mobile
- [ ] Touch-friendly tap targets (min 44px)
- [ ] Quick Actions become bottom sheet or collapsible
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at mobile viewport

---

## Non-Goals (Out of Scope)

- Real-time price feeds or live market data streaming
- Economic calendar / Forex Factory news integration (explicitly deferred)
- Customizable widget arrangement (drag-and-drop) - fixed layout for V1
- Widget resizing by user
- Multiple dashboard layouts/presets
- Push notifications or alerts

## Technical Considerations

### Database
- No schema changes required - all data exists
- New aggregation queries for journal adjacency and rule compliance
- Leverage existing `getStats`, `getDailyPnl` endpoints

### API (tRPC)
- 2 new endpoints: `dailyJournal.getJournalAdjacency`, `strategies.getRuleCompliance`
- All other data from existing endpoints

### Caching Strategy
- Dashboard data can be cached client-side for 1 minute
- Use React Query's `staleTime` for smart refetching
- P&L calendar data cached longer (5 minutes) - historical data changes less

### Performance
- Parallel data fetching for independent widgets
- Suspense boundaries per widget (isolated loading)
- Virtual scrolling not needed (limited items per widget)

## Design Considerations

### Terminal Design System Compliance
- All widgets use terminal window chrome
- Monospace fonts for data and labels
- Colors: Chartreuse (#d4ff00) primary, Ice Blue (#00d4ff) accents
- Profit green (#00ff88), Loss red (#ff3b3b)
- Dark background (#050505)

### Widget Visual Hierarchy
- Today's Performance: Largest, most prominent
- P&L Calendar: Large, center focus
- Snapshot widgets: Medium, supporting context
- Journal/Compliance: Important but compact

### Interaction Patterns
- Every widget links to its full page
- Hover states reveal additional data
- Click-through to relevant detail views
- Keyboard navigation support

## Success Metrics

- Dashboard load time < 2 seconds
- All widgets render without layout shift
- Journal completion rate increases (tracked via adjacency data)
- Reduced navigation to other pages (users get info from dashboard)

## Open Questions

- Should widgets remember collapsed/expanded state?
- Should there be a "focus mode" that shows only critical widgets?
- Future: User-customizable widget arrangement?

---

## Implementation Order Summary

1. **US-000**: Audit existing code
2. **US-001-003**: Foundation (context hook, grid, widget base)
3. **US-006-007**: Journal adjacency backend + tests
4. **US-011-012**: Rule compliance backend + tests
5. **US-004-005, US-008-009**: Journal widgets (4 widgets)
6. **US-010**: Rule compliance widget
7. **US-013**: P&L Calendar widget
8. **US-014-017**: Snapshot widgets (4 widgets)
9. **US-018**: Quick actions widget
10. **US-019-020**: Assembly + loading states
11. **US-021-022**: E2E tests + mobile polish
