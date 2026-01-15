# PRD: Running P&L Chart

## Overview

Add an interactive running P&L (profit/loss) area chart to the trade detail page that visualizes how a trade's P&L evolved from entry to exit. This replaces the current placeholder in the "Running P&L" tab with a full-height area chart showing the trade's performance over time.

## Goals

- Display real-time P&L progression throughout a trade's lifecycle
- Reuse existing P&L calculation utilities from `src/lib/trades/calculations.ts`
- Match the data granularity of the trade replay feature (1m/5m/15m intervals)
- Follow Terminal design system with profit/loss color coding
- Support partial exits (scale-outs) with execution markers

## User Stories

### US-000: Audit Existing Utilities for Running P&L
**Description**: As a developer, I want to audit existing code before implementing the running P&L chart so that we reuse utilities and avoid duplication.

**Audit Results** (completed during PRD creation):
- ✅ `calculateFuturesPnL()` in `src/lib/market-data/symbols.ts:775` - Reuse
- ✅ `calculateForexPnL()` in `src/lib/market-data/symbols.ts:805` - Reuse
- ⚠️ `calculateRunningPnl()` in `src/components/trade-detail/replay/use-replay-engine.ts:273` - LOCAL helper, needs extraction
- ❌ `generateRunningPnlSeries()` - Does not exist, needs creation

**Acceptance Criteria**:
- [ ] Confirm audit findings match current codebase state
- [ ] Document in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

### US-001: Extract Running P&L Calculation Utility
**Description**: As a developer, I want a shared utility function for calculating running P&L so that both the replay feature and running P&L chart can use the same logic.

**Current State**:
- `calculateRunningPnl()` exists as a LOCAL helper in `src/components/trade-detail/replay/use-replay-engine.ts` (lines 273-306)
- It's NOT exported or reusable outside the replay hook
- It calculates P&L at a single point in time, not an array of data points

**Acceptance Criteria**:
- [ ] Create `src/lib/trades/running-pnl.ts` with two functions:
  - `calculateRunningPnlAtTime()` - P&L at a single point (extracted from replay engine)
  - `generateRunningPnlSeries()` - P&L at each bar for chart data
- [ ] `generateRunningPnlSeries()` accepts: bars[], executions[], direction, symbol, instrumentType
- [ ] Returns array of `{ time: number, pnl: number }` data points
- [ ] Handles partial exits correctly (accumulated realized P&L + current unrealized)
- [ ] Reuses `calculateFuturesPnL` and `calculateForexPnL` from `@/lib/market-data/symbols.ts`
- [ ] Export from `src/lib/trades/index.ts`
- [ ] Update `use-replay-engine.ts` to import from shared utility (remove local helper)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-002: Create Running P&L Chart Component
**Description**: As a trader, I want to see an area chart showing my trade's P&L over time so that I can visualize how the trade performed throughout its duration.

**Acceptance Criteria**:
- [ ] Create `RunningPnlChart` component in `src/components/trade-detail/running-pnl-chart.tsx`
- [ ] Uses AG Charts (`ag-charts-react`) following `MonthlyChart` pattern
- [ ] Area chart fills entire tab height (flex-1)
- [ ] X-axis shows timestamps in user's timezone using `useTimezone` hook
- [ ] Y-axis shows P&L in dollars with proper formatting
- [ ] Split coloring: green fill (#00ff8820) above zero, red fill (#ff3b3b20) below zero
- [ ] Uses `ANALYTICS_COLORS` from `src/lib/analytics/constants.ts`
- [ ] Tooltip shows timestamp and P&L value
- [ ] Terminal design system styling (transparent background, monospace labels)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-003: Add Execution Markers to Chart
**Description**: As a trader, I want to see entry, exit, and scale-in/out points marked on the P&L chart so that I can correlate price action with my trading decisions.

**Acceptance Criteria**:
- [ ] Add marker series to the chart for executions
- [ ] Entry marker: chartreuse (#d4ff00) diamond/triangle
- [ ] Exit marker: distinct shape (circle or square)
- [ ] Scale-in/out markers: smaller version of entry/exit markers
- [ ] Hover tooltip shows execution type, price, quantity
- [ ] Markers positioned at correct time and P&L value
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-004: Integrate Chart with Trade Detail Content Panel
**Description**: As a trader, I want the Running P&L tab to display the chart when I select it so that I can view my trade's P&L progression.

**Acceptance Criteria**:
- [ ] Replace placeholder content in ContentPanel's "running-pnl" tab
- [ ] Fetch OHLC bar data using existing market data tRPC endpoint
- [ ] Use same interval logic as trade replay (match bar granularity)
- [ ] Show loading state while fetching data
- [ ] Handle error states gracefully
- [ ] Chart fills available tab space (full height)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

### US-005: Integration Tests for Running P&L Utility
**Description**: As a developer, I want integration tests for the running P&L calculation utility so that we can verify correct P&L calculations across different scenarios.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/running-pnl.test.ts`
- [ ] Tests long trade P&L calculation (profit and loss scenarios)
- [ ] Tests short trade P&L calculation (profit and loss scenarios)
- [ ] Tests partial exit handling (scale-outs)
- [ ] Tests both futures (ES, NQ) and forex symbols
- [ ] Tests empty bars/executions edge cases
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-006: Fix - Stop P&L Calculation at Trade Exit
**Description**: As a trader, I want the running P&L chart to stop at my exit price so that the final P&L is accurate and doesn't continue showing price movement after I closed the trade.

**Bug**: `generateRunningPnlSeries` currently continues calculating P&L for bars AFTER the trade has exited, using post-exit bar prices which gives incorrect final P&L.

**Acceptance Criteria**:
- [ ] `generateRunningPnlSeries` stops generating points after exit execution time
- [ ] Final P&L point uses exit price (not subsequent bar prices)
- [ ] For closed trades, chart ends at exit time with correct realized P&L
- [ ] For open trades (no exit), chart continues to last bar as before
- [ ] Update tests to verify exit time boundary behavior
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: closed trade P&L matches trade stats

## Functional Requirements

1. **FR-001**: Running P&L must calculate unrealized P&L at each bar's close price
2. **FR-002**: P&L must accumulate realized profits from partial exits (scale-outs)
3. **FR-003**: Chart must use proper tick/pip values from `src/lib/market-data/symbols.ts`
4. **FR-004**: Timestamps must display in user's configured timezone
5. **FR-005**: Chart must handle trades without exits (show current unrealized only)
6. **FR-006**: Chart must support both futures and forex instruments

## Non-Goals (Out of Scope)

- Interactive replay controls on the P&L chart (separate Replay tab exists)
- P&L projection or forecasting
- Comparison overlays with price chart
- Export/download of P&L data
- Custom time interval selection (uses trade replay's default)

## Technical Considerations

### Existing Code to Reuse
| Purpose | Location |
|---------|----------|
| P&L calculations | `src/lib/market-data/symbols.ts` - `calculateFuturesPnL`, `calculateForexPnL`, `calculatePnL` |
| Symbol specs (tick values) | `src/lib/market-data/symbols.ts` - `getFuturesSpec`, `getForexSpec`, `getPointValue` |
| Running P&L logic (to extract) | `src/components/trade-detail/replay/use-replay-engine.ts` - local `calculateRunningPnl` (lines 273-306) |
| Chart styling | `src/lib/analytics/constants.ts` - `ANALYTICS_COLORS` |
| Area chart pattern | `src/components/analytics/monthly-chart.tsx` |
| Timezone formatting | `src/hooks/use-timezone.ts` - `useTimezone`, `formatTimeInTimezone` |
| Market data fetch | `src/server/api/routers/marketData.ts` - existing OHLC endpoints |

### New Files to Create
- `src/lib/trades/running-pnl.ts` - Shared running P&L calculation utility
- `src/components/trade-detail/running-pnl-chart.tsx` - Area chart component
- `tests/integration/running-pnl.test.ts` - Integration tests

### Data Flow
1. ContentPanel receives trade with executions
2. Fetch OHLC bars for trade's symbol and time range (entry to exit)
3. Calculate running P&L array using shared utility
4. Render area chart with P&L data and execution markers

## Design Considerations

### Terminal Design System Compliance
- Background: transparent (inherits from container)
- Primary accent: Chartreuse `#d4ff00` for entry markers
- Profit color: `#00ff88` (stroke), `#00ff8820` (fill)
- Loss color: `#ff3b3b` (stroke), `#ff3b3b20` (fill)
- Font: Monospace for all labels and tooltips
- Axis labels: `text-muted-foreground` color
- Grid lines: Subtle, using `border` color

### Chart Layout
- Full height of tab content area (flex-1)
- Responsive width (fills container)
- Y-axis on left with $ formatting
- X-axis on bottom with time in user timezone
- Legend hidden (single series, self-explanatory)

## Success Metrics

- Running P&L chart renders correctly for closed trades
- P&L values match those displayed in trade stats
- Chart loads within 2 seconds after tab selection
- No visual regressions in existing trade detail components

## Open Questions

None - all requirements clarified through Q&A.
