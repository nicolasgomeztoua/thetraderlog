# PRD: Full Mobile Adaptation

## Overview

Comprehensive mobile adaptation of TheTraderLog webapp. The Daily Journal page serves as the reference implementation, demonstrating the pattern: `useMediaQuery` hook + Sheet drawer + conditional rendering. All other protected pages and marketing pages need to be adapted following this same pattern.

## Goals

- Make all pages functional and usable on mobile devices (375px - 767px)
- Follow the established Daily Journal mobile pattern consistently
- Ensure touch-friendly interactions (44px minimum tap targets)
- Maintain Terminal design system on mobile
- No horizontal scroll on any page at mobile viewports

## Reference Implementation: Daily Journal

The Daily Journal page (`src/app/(protected)/daily-journal/page.tsx`) demonstrates the mobile pattern:

```tsx
// 1. Mobile detection
const [sidebarOpen, setSidebarOpen] = useState(false);
const isMobile = useMediaQuery("(max-width: 767px)");

// 2. Mobile menu button (md:hidden = hidden above 768px)
<Button className="md:hidden" onClick={() => setSidebarOpen(true)} size="icon-sm">
  <MenuIcon className="size-4" />
</Button>

// 3. Sheet drawer for sidebar content
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
    {/* Sidebar content */}
  </SheetContent>
</Sheet>

// 4. Conditional layout rendering
{isMobile ? (
  <div className="flex-1 overflow-y-auto p-4">/* Mobile stack */</div>
) : (
  <ResizablePanelGroup>/* Desktop panels */</ResizablePanelGroup>
)}

// 5. Responsive text variants
<span className="hidden sm:inline">Start My Journal</span>
<span className="sm:hidden">Start</span>

// 6. Responsive spacing
<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-4">
```

## User Stories

---

### US-001: Dashboard Mobile Responsive Grid

**Description**: As a mobile user, I want the dashboard stats grid to stack properly on mobile so that I can view my trading metrics without horizontal scroll.

**Acceptance Criteria**:
- [ ] Stats grid uses responsive classes: `grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
- [ ] Performance summary grid stacks on mobile: `grid-cols-1 sm:grid-cols-2`
- [ ] StartJournalHero stacks vertically on mobile with `flex-col sm:flex-row`
- [ ] Button text variants: "Start" on mobile, "Start My Journal" on desktop
- [ ] Page title responsive: `text-2xl sm:text-3xl`
- [ ] Responsive padding: `p-4 sm:p-6` on cards
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-002: Trade Detail Mobile Layout

**Description**: As a mobile user, I want the trade detail page to show a mobile-friendly layout with a drawer for stats so that I can review trades on my phone.

**Acceptance Criteria**:
- [ ] Add `useMediaQuery` hook and `sidebarOpen` state
- [ ] Add mobile menu button (`md:hidden`) in header to open stats drawer
- [ ] Replace ResizablePanelGroup with Sheet drawer for StatsPanel on mobile
- [ ] ContentPanel displays full-width on mobile
- [ ] Header actions responsive: hide less important actions on mobile or use icon-only
- [ ] Navigation arrows remain accessible
- [ ] Dialogs (close trade, delete) work correctly on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-003: Journal List Mobile Table

**Description**: As a mobile user, I want the trade list to display in a mobile-friendly format so that I can browse and manage my trades on my phone.

**Acceptance Criteria**:
- [ ] Add `useMediaQuery` hook for mobile detection
- [ ] On mobile: Replace table with card-based list view showing key fields (symbol, direction, P&L, date)
- [ ] Card view includes tap to navigate to trade detail
- [ ] Filter panel collapses into a Sheet drawer on mobile
- [ ] Search bar remains visible at top
- [ ] Bulk actions bar adapts to mobile (icons only or smaller buttons)
- [ ] Column config hidden on mobile (not needed for card view)
- [ ] Trash tab also uses card view on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-004: Analytics Page Mobile Layout

**Description**: As a mobile user, I want the analytics page to be usable on mobile with a simplified layout so that I can view my trading performance metrics.

**Acceptance Criteria**:
- [ ] Add `useMediaQuery` hook for mobile detection
- [ ] Filter controls collapse into Sheet drawer on mobile (button to open filters)
- [ ] Tab navigation works on mobile (horizontal scroll on tab bar if needed)
- [ ] Charts resize responsively (AgCharts should handle this)
- [ ] Stats grids stack: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- [ ] Heatmap components scroll horizontally if needed with `overflow-x-auto`
- [ ] Calendar heatmap shows in scrollable container on mobile
- [ ] Simplify dense data displays for mobile readability
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-005: AI Page Mobile Adaptation

**Description**: As a mobile user, I want the AI assistant page to work on mobile so that I can get AI-powered insights on my phone.

**Acceptance Criteria**:
- [ ] Review current AI page structure
- [ ] Apply responsive padding: `p-4 sm:p-6`
- [ ] Chat/input interface works on mobile (full-width input)
- [ ] Results/insights display stacks vertically
- [ ] Any side panels convert to Sheet drawers
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-006: Settings Page Mobile Adaptation

**Description**: As a mobile user, I want the settings page to display properly on mobile so that I can manage my account settings.

**Acceptance Criteria**:
- [ ] Form layouts stack on mobile: `flex-col sm:flex-row`
- [ ] Input fields full-width on mobile
- [ ] Buttons properly sized for touch (min 44px height)
- [ ] Any tabs or sections work on mobile
- [ ] Responsive padding throughout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-007: Import Page Mobile Adaptation

**Description**: As a mobile user, I want the import page to work on mobile so that I can upload trades from my phone if needed.

**Acceptance Criteria**:
- [ ] File upload area works on mobile (tap to select)
- [ ] Form fields stack vertically
- [ ] Progress indicators visible
- [ ] Results/preview table scrolls horizontally or converts to cards
- [ ] Responsive padding
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-008: New Trade Page Mobile Adaptation

**Description**: As a mobile user, I want to add trades on mobile so that I can log trades immediately after taking them.

**Acceptance Criteria**:
- [ ] Form fields stack vertically on mobile
- [ ] Input fields full-width
- [ ] Date/time pickers work on mobile
- [ ] Number inputs have proper mobile keyboards (inputmode="decimal")
- [ ] Submit button sticky at bottom or easily accessible
- [ ] Responsive padding
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-009: Strategies List Page Mobile Adaptation

**Description**: As a mobile user, I want to view and manage my trading strategies on mobile.

**Acceptance Criteria**:
- [ ] Strategy cards/list stacks vertically
- [ ] Add strategy button accessible
- [ ] Strategy actions (edit, delete) in dropdown or swipe actions
- [ ] Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-010: Strategy Detail/Edit Page Mobile Adaptation

**Description**: As a mobile user, I want to view and edit strategy details on mobile.

**Acceptance Criteria**:
- [ ] Form fields stack vertically
- [ ] Color picker works on mobile
- [ ] Stats display stacks
- [ ] Associated trades list responsive
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-011: Marketing Landing Page Mobile Adaptation

**Description**: As a mobile user visiting the landing page, I want a properly responsive experience so that I can learn about the product and sign up.

**Acceptance Criteria**:
- [ ] Header/nav collapses to hamburger menu on mobile
- [ ] Hero section stacks vertically, responsive text sizes
- [ ] Feature sections stack
- [ ] CTA buttons full-width on mobile
- [ ] Footer stacks
- [ ] Ticker component doesn't cause horizontal scroll
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-012: Protected Layout Mobile Polish

**Description**: As a mobile user, I want the app shell (sidebar, header) to work well on mobile.

**Acceptance Criteria**:
- [ ] Verify shadcn Sidebar component responsive behavior
- [ ] Main content padding responsive: `p-4 sm:p-6`
- [ ] Header height appropriate for mobile
- [ ] SidebarTrigger (hamburger) properly positioned
- [ ] Account selector dropdown usable on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-013: Fix Marketing Navbar Mobile Menu

**Description**: As a mobile user on the landing page, I want the hamburger menu to only show auth actions so that the interface is cleaner and more purposeful.

**Acceptance Criteria**:
- [ ] Remove section navigation links (Features, AI, Pricing) from mobile Sheet drawer
- [ ] Keep only auth actions: Login/Get Started buttons when signed out
- [ ] Keep only Dashboard link when signed in
- [ ] Hamburger button remains visible on mobile (`md:hidden`)
- [ ] Sheet drawer styling consistent with Terminal design
- [ ] Touch targets remain 44px minimum
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

### US-014: Fix Trade Detail Chart Interval Buttons Mobile

**Description**: As a mobile user viewing a trade detail, I want the chart interval selector to use a dropdown on mobile so that controls don't overflow or overlap.

**Acceptance Criteria**:
- [ ] Add `useIsMobile` hook to TradingViewChart component
- [ ] On mobile: Replace TimeframeSelector buttons with a Select/Dropdown showing current interval
- [ ] Dropdown shows all intervals (1m, 5m, 15m, 30m, 1h) as options
- [ ] Selected interval displayed in dropdown trigger
- [ ] On desktop: Keep existing button row (no change)
- [ ] Controls bar (`absolute top-3 left-3`) layout remains clean on mobile
- [ ] Fit button remains accessible on mobile
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at 375px viewport

---

## Functional Requirements

1. **FR-001**: All pages must be usable at 375px viewport width minimum
2. **FR-002**: No horizontal scroll on any page at mobile viewports
3. **FR-003**: Interactive elements must have minimum 44px tap targets
4. **FR-004**: ResizablePanelGroup must be replaced with Sheet drawers on mobile
5. **FR-005**: Tables with many columns must convert to card views or scroll horizontally
6. **FR-006**: Filter/config panels must collapse into Sheet drawers on mobile
7. **FR-007**: Text must be readable without zooming (min 14px for body text)
8. **FR-008**: Forms must use appropriate mobile input types (inputmode, type)

## Non-Goals (Out of Scope)

- Native mobile app development
- Progressive Web App (PWA) features
- Offline functionality
- Mobile-specific features (camera for screenshots, etc.)
- Gesture-based navigation (swipe to delete, etc.)
- Dark/light theme toggle (already dark-only)
- End-to-end testing / Playwright tests

## Technical Considerations

### Patterns to Apply

| Pattern | Usage |
|---------|-------|
| `useMediaQuery("(max-width: 767px)")` | Mobile detection (md breakpoint) |
| `md:hidden` / `hidden md:block` | Show/hide elements by breakpoint |
| `flex-col sm:flex-row` | Stack on mobile, row on desktop |
| `grid-cols-1 sm:grid-cols-2` | Responsive grids |
| `p-4 sm:p-6` | Responsive padding |
| `text-lg sm:text-xl` | Responsive text sizes |
| Sheet component | Mobile drawers for sidebars/panels |

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/(protected)/dashboard/page.tsx` | Responsive grids, button text |
| `src/app/(protected)/journal/[id]/page.tsx` | Sheet drawer, conditional layout |
| `src/app/(protected)/journal/page.tsx` | Card view, filter drawer |
| `src/app/(protected)/analytics/page.tsx` | Filter drawer, responsive charts |
| `src/app/(protected)/ai/page.tsx` | Responsive layout |
| `src/app/(protected)/settings/page.tsx` | Form stacking |
| `src/app/(protected)/import/page.tsx` | Form stacking |
| `src/app/(protected)/trade/new/page.tsx` | Form stacking |
| `src/app/(protected)/strategies/page.tsx` | Card grid |
| `src/app/(protected)/strategies/[id]/page.tsx` | Form stacking |
| `src/app/(protected)/strategies/new/page.tsx` | Form stacking |
| `src/app/(protected)/layout.tsx` | Responsive padding |
| `src/app/(marketing)/**` | Header, hero, sections |

### Components May Need Updates

- `src/components/trade-log/filter-panel.tsx` - Wrap in Sheet on mobile
- `src/components/trade-detail/stats-panel.tsx` - Verify works in Sheet
- `src/components/trade-detail/content-panel.tsx` - Full-width mobile
- Any chart components - Verify responsive behavior

## Design Considerations

- Maintain Terminal design system (dark theme, monospace, chartreuse accent)
- Cards should have `border-border` consistent styling
- Sheet drawers can use `side="left"` or `side="bottom"` depending on content
- Mobile padding: 16px (p-4) standard, avoid smaller
- Touch targets: 44px minimum height for buttons/interactive elements

## Success Metrics

- All pages render without horizontal scroll at 375px
- All interactive elements have 44px+ tap targets
- Typecheck and build pass
- Users can complete core flows (view trades, add trades, view analytics) on mobile

## Open Questions

None - following established Daily Journal pattern with per-page flexibility.

## Story Order (Priority)

1. US-012: Protected Layout Mobile Polish (foundation)
2. US-001: Dashboard Mobile Responsive Grid (high traffic)
3. US-003: Journal List Mobile Table (core flow)
4. US-002: Trade Detail Mobile Layout (core flow)
5. US-008: New Trade Page Mobile Adaptation (core flow)
6. US-004: Analytics Page Mobile Layout (complex)
7. US-005: AI Page Mobile Adaptation
8. US-006: Settings Page Mobile Adaptation
9. US-007: Import Page Mobile Adaptation
10. US-009: Strategies List Page Mobile Adaptation
11. US-010: Strategy Detail/Edit Page Mobile Adaptation
12. US-011: Marketing Landing Page Mobile Adaptation
