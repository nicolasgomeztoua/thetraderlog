# PRD: Running P&L Chart

## Overview

Add a Running P&L area chart to the trade detail page that visualizes profit/loss progression over time during a trade. Uses market data (OHLC bars) to show the actual P&L fluctuations from entry to exit, giving traders insight into how their position performed throughout its duration.

## Goals

- Display P&L over time as an area chart in the existing "Running P&L" tab
- Use market data bars for accurate price-based P&L calculation
- Support scale-in/scale-out trades with proper quantity tracking
- Follow Terminal design system and existing AG Charts patterns

## User Stories

### US-001: Add Chart Dimensions Constant

**Description**: Add Running P&L chart dimensions to analytics constants.

**Acceptance Criteria**:
- [ ] Add `runningPnl` entry to `CHART_DIMENSIONS` in `src/lib/analytics/constants.ts`
- [ ] Values: `{ height: 200, strokeWidth: 1.5 }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/lib/analytics/constants.ts`

---

### US-002: Create Running P&L Chart Component

**Description**: Create the main RunningPnlChart component with data fetching, P&L calculation, and AG Charts visualization.

**Acceptance Criteria**:
- [ ] Create `src/components/trade-detail/running-pnl-chart.tsx`
- [ ] Props: symbol, direction, instrumentType, entryTime, exitTime, entryPrice, executions
- [ ] Fetch market data using `api.marketData.getFullDayChartData`
- [ ] Implement `buildPnlTimeSeries()` that:
  - Filters bars from entry to exit time
  - Calculates P&L at each bar's close price
  - Tracks quantity changes from scale-in/scale-out
  - Accumulates realized P&L from exits
- [ ] Use `calculateFuturesPnL()` / `calculateForexPnL()` from `@/lib/market-data`
- [ ] AG Charts area series with:
  - X-axis: time (HH:mm format)
  - Y-axis: currency format
  - Profit green fill when positive, loss red when negative
  - Terminal styling (ANALYTICS_COLORS, CHART_AXIS_STYLE)
- [ ] Custom tooltip showing time and P&L with profit/loss coloring
- [ ] Summary stats row: Final P&L, Peak P&L, Max Drawdown
- [ ] Loading state (spinner while fetching)
- [ ] Empty state (when no market data available)
- [ ] Handle open trades (no exitTime) - show up to last bar
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/components/trade-detail/running-pnl-chart.tsx`

**Reference Patterns**:
- `src/components/analytics/equity-curve.tsx` - AG Charts area chart pattern
- `src/components/trade-detail/replay/use-replay-engine.ts:273-306` - P&L calculation logic

---

### US-003: Integrate Chart into Content Panel

**Description**: Replace the placeholder in content-panel.tsx with the RunningPnlChart component.

**Acceptance Criteria**:
- [ ] Import `RunningPnlChart` in content-panel.tsx
- [ ] Pass required props from trade object
- [ ] Remove placeholder (CandlestickChart icon and "coming soon" text)
- [ ] Maintain proper styling in TabsContent
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: navigate to a trade detail page, click "Running P&L" tab

**Files**: `src/components/trade-detail/content-panel.tsx`

---

## Functional Requirements

1. **FR-001**: Chart displays P&L at 1-minute intervals from trade entry to exit
2. **FR-002**: P&L calculation uses proper point/pip values for futures and forex
3. **FR-003**: Scale-in executions update tracked quantity
4. **FR-004**: Scale-out/exit executions add realized P&L to cumulative total
5. **FR-005**: Area fill color changes based on final P&L direction (green profit, red loss)
6. **FR-006**: Open trades show chart up to last available market data bar

## Non-Goals (Out of Scope)

- Split visualization of realized vs unrealized P&L (combined only)
- Real-time updating for open trades (static snapshot)
- Timeframe aggregation options (uses 1-min bars only)
- Execution markers on the P&L chart (available on Chart tab)

## Technical Considerations

### P&L Calculation Algorithm

```
1. Sort executions by executedAt
2. Find entry execution → set initial quantity, entry price
3. Initialize cumulativeRealizedPnl = 0
4. For each bar from entry to exit:
   a. Check for executions at or before bar time
   b. Scale-in: add to currentQuantity
   c. Scale-out/exit: add realizedPnl to cumulative, reduce quantity
   d. unrealizedPnl = pnlFunction(entry, bar.close, currentQuantity, direction)
   e. totalPnl = unrealizedPnl + cumulativeRealizedPnl
   f. Push data point
5. Return array
```

### Existing Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Market data query | `api.marketData.getFullDayChartData` | Fetches 1-min OHLC bars |
| P&L functions | `src/lib/market-data/symbols.ts` | `calculateFuturesPnL()`, `calculateForexPnL()` |
| Chart constants | `src/lib/analytics/constants.ts` | Colors, axis styles, dimensions |
| Reference chart | `src/components/analytics/equity-curve.tsx` | AG Charts area pattern |

### Data Point Structure

```typescript
interface PnlDataPoint {
  time: number;         // Unix timestamp (seconds)
  displayTime: string;  // "HH:mm" for tooltip
  pnl: number;          // Combined P&L at this point
}
```

## Design Considerations

- Terminal design system (dark theme, #050505 background)
- Profit color: `#00ff88` / fill `#00ff8820`
- Loss color: `#ff3b3b` / fill `#ff3b3b20`
- JetBrains Mono font for all labels
- Chart height: 200px (compact within tab)
- No markers (too many data points)

## Verification

1. Run `bun run check` - typecheck passes
2. Run `bun run build` - build passes
3. Start dev server: `bun run dev`
4. Navigate to a closed trade's detail page
5. Click "Running P&L" tab
6. Verify:
   - Chart renders with area visualization
   - P&L values are reasonable for the trade
   - Hovering shows tooltip with time and P&L
   - Summary stats display above chart
   - Color matches trade outcome (green for profit, red for loss)

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/analytics/constants.ts` | Add `runningPnl` to CHART_DIMENSIONS |
| `src/components/trade-detail/running-pnl-chart.tsx` | Create new component |
| `src/components/trade-detail/content-panel.tsx` | Integrate chart, remove placeholder |
