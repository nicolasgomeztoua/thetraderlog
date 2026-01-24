# PRD: Strategy Section Redesign

## Overview

A comprehensive redesign of the Strategies section to elevate it to the visual quality of the homepage and analytics pages. This includes:
1. **Strategies list page** - Card gallery with mini-charts and visual previews
2. **Strategy creation wizard** - Sidebar stepper with clear progress navigation
3. **Strategy detail/edit page** - Rules compliance-focused dashboard
4. **Number input component** - Fix React controlled input issues with empty values

## Problem Statement

The current strategies section feels "bare bones" compared to other parts of the application:
- List page is too simple, lacking visual engagement
- Input placeholders are not visually distinguishable from actual values
- Number inputs have React controlled component issues (can't clear to empty)
- Creation wizard (tabbed interface) is not intuitive
- Edit page lacks the premium feel of analytics/homepage

## Goals

- Match visual quality of homepage "lightning in a bottle" feel
- Create intuitive sidebar stepper wizard for strategy creation
- Build comprehensive rules compliance dashboard for strategy details
- Fix number input UX issues across the application
- Maintain Terminal design system consistency

## User Stories

### US-000: Audit Existing Utilities for Strategy Analytics
**Description**: As a developer, I want to audit existing code before implementing strategy analytics so that we reuse utilities and avoid duplication.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for existing analytics utilities
- [ ] Search `src/components/analytics/` for reusable chart components
- [ ] Search `src/server/api/routers/` for existing strategy analytics queries
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - Existing utilities to reuse (with file:line)
  - Components that can be reused for strategy analytics
  - New utilities needed
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
# Search for analytics utilities
grep -rn "export function" src/lib/ | grep -i "analytics\|calculate\|format"

# Search for chart components
grep -rn "export function\|export const" src/components/analytics/

# Check existing strategy router queries
grep -rn "procedure" src/server/api/routers/strategies.ts
```

---

### US-001: Create NumericInput Component
**Description**: As a user, I want number inputs that allow clearing to empty so that I can reset optional fields without React controlled input issues.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/numeric-input.tsx`
- [ ] Component manages string internally, exposes number | undefined externally
- [ ] Empty string maps to undefined (not 0)
- [ ] Supports all standard input props (placeholder, step, min, max)
- [ ] Visual styling matches existing Input component
- [ ] Placeholder text has distinct styling (lighter color, italic optional)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Technical Notes**:
- Use internal string state to handle the "empty vs zero" problem
- Call onChange with parsed number or undefined when empty
- Apply `text-muted-foreground` to placeholder via CSS

---

### US-002: Update Strategy Form to Use NumericInput
**Description**: As a developer, I want to replace all number inputs in strategy components with NumericInput so that users can clear optional fields.

**Acceptance Criteria**:
- [ ] Replace number inputs in `src/components/strategy/risk-config.tsx`
- [ ] Replace number inputs in `src/components/strategy/scaling-config.tsx`
- [ ] Replace number inputs in `src/components/strategy/trailing-config.tsx`
- [ ] All existing functionality preserved
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: can type, clear, and re-enter values

---

### US-003: Create StrategyStepper Component
**Description**: As a user, I want a sidebar stepper for creating strategies so that I can see my progress and navigate between sections easily.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-stepper.tsx`
- [ ] Vertical sidebar with numbered steps (1-6)
- [ ] Steps: Basic Info, Strategy, Risk Management, Scaling, Trailing Stops, Rules Checklist
- [ ] Active step highlighted with primary color
- [ ] Completed steps show checkmark icon
- [ ] Clickable navigation between steps
- [ ] Terminal design system styling (monospace, dark bg)
- [ ] Responsive: collapses to horizontal on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Create StrategyWizard Component
**Description**: As a user, I want a multi-step wizard layout so that strategy creation feels guided and professional.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-wizard.tsx`
- [ ] Two-column layout: sidebar stepper (left) + content area (right)
- [ ] Content area shows current step's form fields
- [ ] "Continue" and "Back" buttons for step navigation
- [ ] Final step shows "Create Strategy" button
- [ ] Progress auto-saves to form state
- [ ] Terminal header with traffic lights (like analytics ChartTerminal)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Update New Strategy Page to Use Wizard
**Description**: As a user, I want the /strategies/new page to use the new wizard so that I have a better creation experience.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/new/page.tsx`
- [ ] Replace current form with StrategyWizard component
- [ ] Maintain all existing form submission logic
- [ ] Redirect to strategy detail on success
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: complete wizard flow works

---

### US-006: Create StrategyMiniChart Component
**Description**: As a user, I want to see mini performance charts on strategy cards so that I can quickly assess strategy performance.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-mini-chart.tsx`
- [ ] Small sparkline chart (80px tall) showing cumulative P&L
- [ ] Color: profit green gradient when positive, loss red when negative
- [ ] Handles empty data gracefully (show flat line or placeholder)
- [ ] Uses lightweight canvas/SVG (not full AG Charts)
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Update StrategyCard Component
**Description**: As a user, I want enhanced strategy cards with visual previews so that the list page feels premium.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/strategy-card.tsx`
- [ ] Add StrategyMiniChart showing recent P&L trend
- [ ] Enhanced stats display: Win rate gauge, P&L, Trades count
- [ ] Larger card size with better visual hierarchy
- [ ] Color indicator as accent border (not just left bar)
- [ ] Active/Inactive badge with distinct styling
- [ ] Hover effects with subtle glow
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Add Strategy Performance tRPC Query
**Description**: As a frontend, I want a tRPC query for strategy-specific performance data so that cards and detail pages can show analytics.

**Acceptance Criteria**:
- [ ] Add `getPerformanceByStrategy` query to `src/server/api/routers/strategies.ts`
- [ ] Returns: trades count, win rate, total P&L, profit factor, recent P&L series (last 20 trades)
- [ ] Accepts strategyId parameter
- [ ] Uses existing analytics calculation utilities
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-009: Integration Tests for Strategy Performance Query
**Description**: As a developer, I want integration tests for the strategy performance query so that we can verify correct behavior.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/strategy-performance.test.ts`
- [ ] Tests getPerformanceByStrategy returns correct metrics
- [ ] Tests with no trades (empty result)
- [ ] Tests with mix of wins/losses
- [ ] Tests auth validation (unauthorized access rejected)
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-010: Redesign Strategies List Page
**Description**: As a user, I want a visually rich strategies list page so that it matches the quality of other pages.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/page.tsx`
- [ ] Header with Terminal styling (primary label, title, description)
- [ ] "Create Strategy" CTA button in header
- [ ] Grid of enhanced StrategyCards (2-3 columns responsive)
- [ ] Empty state with compelling CTA
- [ ] Loading skeletons matching new card design
- [ ] Terminal-style section dividers
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-011: Create RulesCompliancePanel Component
**Description**: As a user, I want to see rules compliance statistics so that I can understand which rules I follow or skip.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/rules-compliance-panel.tsx`
- [ ] Shows overall compliance percentage with circular gauge
- [ ] Breakdown by rule category (Entry, Exit, Risk, Management)
- [ ] Individual rule compliance rates (sorted by compliance)
- [ ] Color coding: green (>=80%), yellow (50-79%), red (<50%)
- [ ] "Most Followed" and "Most Skipped" sections
- [ ] Terminal design styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Add Rules Compliance tRPC Query
**Description**: As a frontend, I want a tRPC query for rules compliance data so that the detail page can show compliance statistics.

**Acceptance Criteria**:
- [ ] Add `getRulesCompliance` query to `src/server/api/routers/strategies.ts`
- [ ] Returns: overall compliance %, per-rule compliance, per-category compliance
- [ ] Accepts strategyId parameter
- [ ] Calculates from trade_rule_checks table (or TradeRules association)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: Integration Tests for Rules Compliance Query
**Description**: As a developer, I want integration tests for the rules compliance query so that we can verify correct behavior.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/rules-compliance.test.ts`
- [ ] Tests getRulesCompliance returns correct percentages
- [ ] Tests with no rules checked (100% or N/A)
- [ ] Tests with partial compliance
- [ ] Tests auth validation
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-014: Redesign Strategy Detail Page - Layout
**Description**: As a user, I want a premium strategy detail page layout so that viewing a strategy feels comprehensive.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/[id]/page.tsx`
- [ ] Two-column layout: Sidebar (strategy info/form) + Main (compliance dashboard)
- [ ] Terminal header with strategy name and color indicator
- [ ] Quick stats bar: Trades, Win Rate, P&L, Compliance %
- [ ] Action buttons: Edit mode toggle, Duplicate, Delete
- [ ] Responsive: stacks on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-015: Redesign Strategy Detail Page - Compliance Section
**Description**: As a user, I want the strategy detail page to show rules compliance analytics so that I can improve my trading discipline.

**Acceptance Criteria**:
- [ ] Add RulesCompliancePanel to detail page
- [ ] Show compliance trends over time (simple line chart)
- [ ] Recent trades list with compliance badges
- [ ] "Improvement Tips" section based on lowest compliance rules
- [ ] All data fetched via tRPC queries
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-016: E2E Tests for Strategy Wizard
**Description**: As a developer, I want E2E tests for the strategy wizard so that we can verify the creation flow works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/strategy-wizard.spec.ts`
- [ ] Tests complete wizard flow: all steps + submit
- [ ] Tests step navigation (back/forward, click sidebar)
- [ ] Tests form validation (required fields)
- [ ] All new UI elements have data-testid attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-017: E2E Tests for Strategy List Page
**Description**: As a developer, I want E2E tests for the redesigned strategy list page so that we can verify it works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/strategy-list.spec.ts`
- [ ] Tests page loads with strategy cards
- [ ] Tests empty state when no strategies
- [ ] Tests create button navigation
- [ ] Tests card actions (edit, duplicate, delete)
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-018: E2E Tests for Strategy Detail Page
**Description**: As a developer, I want E2E tests for the strategy detail page so that we can verify compliance features work.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/strategy-detail.spec.ts`
- [ ] Tests detail page loads with compliance panel
- [ ] Tests edit mode toggle
- [ ] Tests action buttons (duplicate, delete)
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

## Non-Goals (Out of Scope)

- Marketplace/community strategies sharing
- Strategy templates library
- AI-generated strategy suggestions
- Strategy backtesting functionality
- Multi-account strategy comparison
- Strategy versioning/history

## Technical Considerations

### Database
- No schema changes required for core redesign
- Rules compliance data comes from existing `trade_rule_checks` or TradeRules associations
- Strategy performance calculated from trades table with strategyId filter

### Components Architecture
```
src/components/strategy/
├── index.ts                    # Exports
├── strategy-form.tsx           # Existing (keep for edit mode)
├── strategy-wizard.tsx         # NEW - Full wizard layout
├── strategy-stepper.tsx        # NEW - Sidebar navigation
├── strategy-card.tsx           # UPDATE - Enhanced cards
├── strategy-mini-chart.tsx     # NEW - Sparkline charts
├── rules-compliance-panel.tsx  # NEW - Compliance dashboard
├── numeric-input.tsx           # NEW (in ui/) - Fixed number input
├── risk-config.tsx             # UPDATE - Use NumericInput
├── scaling-config.tsx          # UPDATE - Use NumericInput
└── trailing-config.tsx         # UPDATE - Use NumericInput
```

### tRPC Router Updates
```typescript
// strategies.ts additions
getPerformanceByStrategy: protectedProcedure
  .input(z.object({ strategyId: z.string() }))
  .query(...)

getRulesCompliance: protectedProcedure
  .input(z.object({ strategyId: z.string() }))
  .query(...)
```

## Design Considerations

### Terminal Design System
- Background: `bg-background` (#050505) with `bg-card` for panels
- Primary accent: Electric Chartreuse (`#d4ff00`) for active states
- Secondary accent: Ice Blue (`#00d4ff`) for AI/insights
- Data colors: Profit green (`#00ff88`), Loss red (`#ff3b3b`)
- All text: `font-mono` for interactive elements
- Small labels: `text-[10px] uppercase tracking-wider text-muted-foreground`
- Terminal headers: Traffic light dots + path-style title

### Stepper Design
- Vertical sidebar: 240px width, `bg-card` background
- Steps: Numbered circles with `border-primary` when active
- Completed: Checkmark icon, subtle green tint
- Clickable but disabled for unvisited steps (or allow free navigation)

### Card Gallery Design
- Cards: `bg-card` with `border-border`, hover: `border-primary/30`
- Mini-chart: Gradient fill, no axes, just the trend line
- Stats: Three-column grid with small gauges
- Responsive: 3 columns on lg, 2 on md, 1 on sm

### Compliance Panel Design
- Large circular gauge for overall compliance (similar to RiskGauge)
- Category bars: Horizontal progress bars with color coding
- Rule list: Compact table with compliance % per rule
- Insights: Callout boxes with recommendations

## Success Metrics

- Users can create strategies with intuitive wizard flow
- Strategy list page feels visually engaging and informative
- Number inputs work correctly (can clear and re-enter values)
- Rules compliance data helps users identify discipline issues
- All pages load under 2 seconds

## Open Questions

- Should wizard steps be freely navigable or sequential only?
  - Decision: Freely navigable (user selected sidebar stepper)
- How many recent trades to show in P&L sparkline?
  - Proposal: Last 20 trades
- Should compliance panel show all-time or filtered by date range?
  - Proposal: All-time by default, add date filter in future iteration

## Story Dependencies

```
US-000 (Audit) → No dependencies

US-001 (NumericInput) → No dependencies
US-002 (Update forms) → US-001

US-003 (Stepper) → No dependencies
US-004 (Wizard) → US-003
US-005 (New page) → US-004, US-002

US-006 (MiniChart) → No dependencies
US-007 (Card update) → US-006
US-008 (Performance query) → US-000
US-009 (Perf tests) → US-008
US-010 (List page) → US-007, US-008

US-011 (CompliancePanel) → No dependencies
US-012 (Compliance query) → US-000
US-013 (Compliance tests) → US-012
US-014 (Detail layout) → US-011
US-015 (Detail compliance) → US-014, US-012

US-016 (E2E Wizard) → US-005
US-017 (E2E List) → US-010
US-018 (E2E Detail) → US-015
```

## Priority Order

1. US-000 - Audit (foundation)
2. US-001 - NumericInput (fixes UX bug)
3. US-002 - Update forms
4. US-003 - Stepper component
5. US-004 - Wizard component
6. US-005 - New strategy page
7. US-006 - MiniChart
8. US-008 - Performance query
9. US-009 - Performance tests
10. US-007 - Card update
11. US-010 - List page redesign
12. US-011 - CompliancePanel
13. US-012 - Compliance query
14. US-013 - Compliance tests
15. US-014 - Detail layout
16. US-015 - Detail compliance
17. US-016 - E2E Wizard tests
18. US-017 - E2E List tests
19. US-018 - E2E Detail tests
