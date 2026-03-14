# PRD: Daily Market Data Pre-Fetch, 7-Day Chart & Drawing Tools

## Overview

Market data is currently only fetched on-demand when a user views a trade chart or imports trades that trigger MAE/MFE calculation. If no one imports trades for a given day, that day's candle data never gets cached — creating gaps when users later want to view historical charts.

This feature adds a daily cron job (via Trigger.dev scheduled task) that pre-fetches market data for all symbols users have traded, expands the trade detail chart to support viewing up to 7 trading sessions of context, and adds persistent drawing tools (horizontal and vertical lines) to the chart.

## Goals

- Ensure market data is always available for symbols users actively trade, even on days with no imports
- Allow traders to see broader market context (up to 7 trading sessions) around their trades
- Provide basic drawing tools (horizontal/vertical lines) for chart annotation, persisted per-trade in the database
- Leverage existing Trigger.dev infrastructure and `candle_cache` system

## User Stories

### US-001: Create Daily Market Data Pre-Fetch Trigger.dev Scheduled Task

**Description**: As a system, I want to automatically fetch market data at 1:00 AM UTC daily for all symbols that exist in the trades table, so that chart data is always available even when no one imports trades.

**Acceptance Criteria**:
- [ ] New Trigger.dev scheduled task in `src/trigger/daily-market-data-prefetch.ts`
- [ ] Runs at `0 1 * * *` (1:00 AM UTC daily) using `schedules.task()` from Trigger.dev SDK
- [ ] Queries `trades` table for distinct symbols across all users (`SELECT DISTINCT symbol FROM trades WHERE symbol IS NOT NULL`)
- [ ] For each symbol, fetches previous day's data using the existing `getOHLCBars()` service function for both `1min` and `1h` base intervals — the exact same code path used during batch import MAE/MFE processing
- [ ] Fetches every calendar day (including weekends) — Databento returns empty/error for non-trading days, and some futures (e.g., bitcoin) trade on weekends
- [ ] Per-symbol error handling: retry with exponential backoff (3 attempts), log failure, continue with remaining symbols
- [ ] Concurrency limited (reuse `concurrencyLimit: 10` pattern from `processTradeMAEMFE`)
- [ ] Logs summary at completion: total symbols, successes, failures, skipped (already cached)
- [ ] `getOHLCBars()` already checks cache first — if data was already fetched by a user import, it's a no-op for that symbol/date
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-002: Integration Tests for Daily Market Data Pre-Fetch

**Description**: As a developer, I want integration tests for the daily pre-fetch logic so that we can verify correct symbol discovery and error handling.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/daily-market-data-prefetch.test.ts`
- [ ] Core logic (symbol discovery + fetch orchestration) extracted into a testable function separate from the Trigger.dev task wrapper
- [ ] Tests distinct symbol extraction from trades table (inserts test trades with various symbols, verifies correct distinct list)
- [ ] Tests that the pre-fetch function handles empty symbol list (no trades in DB) gracefully
- [ ] Tests error handling when a symbol fetch fails (verifies it continues with others and reports failures)
- [ ] Tests that both `1min` and `1h` intervals are requested per symbol
- [ ] Uses `setupTrader()` / `setupTraderWithTrades()` fixtures for DB setup
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-003: Expand Trade Detail Chart to 7 Trading Sessions

**Description**: As a trader, I want the trade detail chart to show up to 7 trading sessions of data when viewing the 1h timeframe, so that I can see broader market context around my trades.

**Acceptance Criteria**:
- [ ] New tRPC endpoint `marketData.getExtendedChartData` that fetches 1h bars for an extended date range (3 calendar days before entry through 3 calendar days after exit, or up to today) — ~7 trading sessions of context
- [ ] Input: `symbol`, `entryTime`, `exitTime` (optional) — same pattern as `getFullDayChartData`
- [ ] Uses existing `getOHLCBars(symbol, "1h", date)` for each day in the range — same cache-first logic, no new API code
- [ ] Returns bars in lightweight-charts format (timestamps in seconds), same shape as `getFullDayChartData` response
- [ ] Chart component (`tradingview-chart.tsx`) calls `getExtendedChartData` when interval is `1h`, and existing `getFullDayChartData` for sub-hourly intervals (`1min`, `5min`, `15min`, `30min`)
- [ ] Two separate queries — no conditional logic inside a single query. The `useMemo` aggregation logic for sub-hourly intervals stays unchanged.
- [ ] When switching to 1h, chart re-fetches with the extended endpoint; when switching back to sub-hourly, it uses the existing 1min endpoint with client-side aggregation
- [ ] Auto-fit recalculates visible range when switching between 1h (wide) and sub-hourly (narrow) to keep trade centered
- [ ] Weekend/holiday days with no data naturally have no bars (no special handling needed)
- [ ] Data quality correctly aggregated across all fetched days
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: 1h shows ~7 days of context, sub-hourly shows trade day(s) only

**Technical Notes**:
- 7 days of 1h bars ≈ ~168 bars per symbol (lightweight payload)
- 7 days of 1min bars would be ~10,000+ bars — too heavy, hence separate endpoints by interval
- The existing `getFullDayBars()` function already handles multi-day parallel fetching — `getExtendedChartData` follows the same pattern but with `1h` interval and wider date range

### US-004: Chart Drawing Annotations Schema & Backend

**Description**: As a developer, I want a database schema and tRPC endpoints for chart drawing annotations so that horizontal and vertical lines persist per-trade across sessions.

**Acceptance Criteria**:
- [ ] New `chart_annotations` table in `src/server/db/schema.ts`:
  - `id` (text, PK, `ids.chartAnnotation()`)
  - `tradeId` (text, FK → trades, onDelete cascade, NOT NULL)
  - `userId` (text, FK → users, onDelete cascade, NOT NULL)
  - `type` (pgEnum: `horizontal`, `vertical`)
  - `value` (decimal — price for horizontal lines, Unix timestamp in seconds for vertical lines)
  - `lineStyle` (pgEnum: `solid`, `dashed`)
  - `color` (text, default `#d4ff00`)
  - `createdAt` (timestamp with timezone)
- [ ] Add `chartAnnotation: () => createId("ca")` to the `ids` map in `src/lib/shared/id.ts`
- [ ] New tRPC router `chartAnnotations` (or add to `marketData` router) with:
  - `list` query: returns all annotations for a given `tradeId`, validates user owns the trade
  - `create` mutation: adds an annotation, validates user owns the trade
  - `delete` mutation: removes an annotation by ID, validates user owns it
  - `clearAll` mutation: removes all annotations for a given `tradeId`, validates ownership
- [ ] All mutations use `protectedProcedure` with user ownership validation
- [ ] Index on `tradeId` for fast lookups
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-005: Integration Tests for Chart Annotations

**Description**: As a developer, I want integration tests for the chart annotations endpoints so that we can verify CRUD operations and ownership validation.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/chart-annotations.test.ts`
- [ ] Tests `create` mutation: creates horizontal and vertical annotations
- [ ] Tests `list` query: returns annotations for a specific trade, empty for trades with none
- [ ] Tests `delete` mutation: removes a single annotation
- [ ] Tests `clearAll` mutation: removes all annotations for a trade
- [ ] Tests ownership: rejects create/delete/list when user doesn't own the trade
- [ ] Uses `setupTraderWithTrades()` fixtures
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-006: Chart Drawing Tools UI — Toolbar, Horizontal & Vertical Lines

**Description**: As a trader, I want drawing tools in the chart toolbar so that I can place horizontal price lines and vertical time lines on my trade charts.

**Acceptance Criteria**:
- [ ] Drawing toolbar integrated into the existing chart overlay controls bar (same row as symbol badge, timeframe selector, and Fit button — positioned after the Fit button)
- [ ] Toolbar buttons follow existing chart button styling exactly: `bg-muted px-2 py-1 font-mono text-[10px] rounded min-h-[36px] min-w-[36px]` with `hover:bg-muted/80` (see `TimeframeSelector` and Fit button patterns in `tradingview-chart.tsx`)
- [ ] Three tool buttons: Horizontal Line (icon: `Minus`), Vertical Line (icon: `SeparatorVertical` or `GripVertical`), Clear All (icon: `Trash2`)
- [ ] Active drawing tool button highlighted with `bg-primary text-primary-foreground` (same as active timeframe button)
- [ ] Click same tool again to deactivate (return to default crosshair/copy mode)
- [ ] Line style toggle: small button cycling between solid/dashed (icon changes to reflect current style)
- [ ] **Drawing mode interaction**:
  - When a drawing tool is active, chart clicks place lines instead of triggering OHLC price copy-to-clipboard
  - When no drawing tool is active, existing click-to-copy behavior is preserved unchanged
  - Drawing mode changes cursor to `crosshair` via CSS on the chart container
- [ ] **Horizontal line placement**: On click, reads the OHLC-snapped price from `currentSnappedPriceRef` and calls `seriesRef.current.createPriceLine()` with the selected style/color. Also saves to DB via `chartAnnotations.create` mutation.
- [ ] **Vertical line placement**: On click, reads the crosshair timestamp from `param.time` in the `subscribeCrosshairMove` handler and renders a vertical line using the lightweight-charts `ISeriesPrimitive` API (custom canvas `drawLine()` from chart top to bottom at the time coordinate). Also saves to DB via `chartAnnotations.create` mutation.
- [ ] **Line colors**: Default `#d4ff00` (primary accent). Small color palette accessible via a dropdown or cycling button: `#d4ff00`, `#00d4ff`, `#ff3b3b`, `#00ff88`, `#71717a`
- [ ] **Deletion**: Click an existing line to select it (highlight with thicker width), then press `Delete`/`Backspace` key to remove it (calls `chartAnnotations.delete`). Clear All button calls `chartAnnotations.clearAll`.
- [ ] **Load on mount**: When chart mounts, fetch annotations via `chartAnnotations.list` query and render them
- [ ] **State management**: Use component-local refs for lightweight-charts objects (`IPriceLine[]`, primitive instances). No zustand store needed — DB is the source of truth, component refs are the render cache.
- [ ] Keyboard shortcuts: `H` to activate horizontal tool, `V` to activate vertical tool, `Escape` to deactivate current tool, only active when chart container is focused
- [ ] Mobile: toolbar buttons use `min-h-[36px] min-w-[36px]` touch targets (matches existing Fit button mobile pattern). On mobile, use dropdown select for drawing tools instead of button row (matches existing `TimeframeSelector` mobile pattern).
- [ ] Terminal design system compliance: monospace font, `rounded` borders, no `rounded-lg/xl`, muted backgrounds
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: place horizontal lines, vertical lines, switch styles, delete, clear all, refresh page and see lines persist

**Technical Notes**:
- **Horizontal lines**: Use `ISeriesApi.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Solid|LineStyle.Dashed, axisLabelVisible: true })` — same API already used for SL/TP/MAE/MFE lines in the existing chart code (lines 439-493 of `tradingview-chart.tsx`)
- **Vertical lines**: lightweight-charts v5 does NOT have native vertical line support. Use `ISeriesPrimitive` interface: implement `paneViews()` returning a renderer that calls `drawLine(x, 0, x, height)` on the canvas scope. The primitive attaches via `seriesRef.current.attachPrimitive(verticalLinePrimitive)`. Reference the `IPrimitivePaneRenderer.draw(target)` API where `target` provides the canvas scope with `drawLine()` helper.
- **Click handler conflict**: The existing `chart.subscribeClick()` handler (line 620) copies OHLC price to clipboard. Wrap this in a condition: `if (activeDrawingTool === null) { /* existing copy behavior */ } else { /* place drawing */ }`. Use a ref (`activeDrawingToolRef`) to avoid re-creating the chart effect.
- **Crosshair data for vertical lines**: The `subscribeCrosshairMove` callback already receives `param.time` (the bar timestamp) — store this in a ref so the click handler can access it for vertical line placement.
- **Lucide icons**: Import from `lucide-react` (already used in the chart component — `ExternalLink`, `Loader2`, `Maximize2`).

### US-007: E2E Tests for Chart Drawing Tools and 7-Day View

**Description**: As a developer, I want E2E tests for the chart drawing tools and extended date range so that we can verify the UI works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/chart-tools.spec.ts`
- [ ] Tests that drawing toolbar renders on trade detail chart page
- [ ] Tests horizontal line placement: activate tool → click chart → verify line appears
- [ ] Tests vertical line placement: activate tool → click chart → verify line appears
- [ ] Tests clear all: place lines → click clear → verify lines removed
- [ ] Tests persistence: place line → navigate away → return → verify line still present
- [ ] Tests that 1h interval shows extended date range (more bars than sub-hourly)
- [ ] All new UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

## Functional Requirements

1. **FR-001**: Scheduled task runs daily at 1:00 AM UTC via Trigger.dev `schedules.task()`
2. **FR-002**: Pre-fetch targets all distinct symbols from the `trades` table across all users
3. **FR-003**: Both `1min` and `1h` base intervals are fetched per symbol (matching batch import behavior)
4. **FR-004**: Failed symbol fetches retry 3 times with exponential backoff, then skip — other symbols continue
5. **FR-005**: Weekend/holiday fetches are attempted (not skipped) — Databento handles non-trading days gracefully
6. **FR-006**: Trade detail chart shows up to 7 trading sessions when on 1h interval via dedicated endpoint
7. **FR-007**: Sub-hourly intervals maintain current date range (trade days only) via existing endpoint + client-side aggregation
8. **FR-008**: Horizontal lines use `createPriceLine()` API with configurable style/color
9. **FR-009**: Vertical lines use `ISeriesPrimitive` custom canvas rendering (no native support in lightweight-charts v5)
10. **FR-010**: Drawing annotations persisted in `chart_annotations` table, scoped to trade + user
11. **FR-011**: Chart click handler conditionally routes to drawing placement or OHLC copy-to-clipboard based on active tool

## Non-Goals (Out of Scope)

- Trend lines (diagonal lines connecting two points)
- Fibonacci retracements or other advanced drawing tools
- User-configurable cron schedule
- Pre-fetching symbols that no user has ever traded
- Admin UI for monitoring the cron job (use Trigger.dev dashboard)
- Full color picker (small preset palette is sufficient)
- Annotation sharing between users
- Drawing annotations on shared trade links

## Technical Considerations

- **Trigger.dev Scheduled Tasks**: Use `schedules.task()` with CRON expression `0 1 * * *`
- **Symbol Discovery**: `SELECT DISTINCT symbol FROM trades WHERE symbol IS NOT NULL` — no user filter, cross-user deduplication already exists in `candle_cache`
- **Rate Limiting**: Reuse `concurrencyLimit: 10` pattern from existing Trigger.dev tasks
- **Cache Hit Optimization**: `getOHLCBars()` already checks cache first — if data was already fetched it's a no-op
- **lightweight-charts v5 API**: `createPriceLine()` for horizontals; `ISeriesPrimitive` + `IPrimitivePaneRenderer.draw()` for verticals
- **Payload Size**: 7 days of 1h bars ≈ ~168 bars (lightweight). 7 days of 1min bars ≈ ~10,000+ bars — hence interval-gated endpoint switching
- **Schema migration**: `chart_annotations` table requires `bun run db:push` after schema changes

## Design Considerations

- Drawing toolbar integrated into existing chart control bar (not a separate row) — compact, non-intrusive
- Buttons follow exact same styling as existing TimeframeSelector and Fit button: `bg-muted px-2 py-1 font-mono text-[10px] rounded` with `min-h-[36px]` mobile touch targets
- Active drawing tool uses `bg-primary text-primary-foreground` (matches active timeframe button)
- Line color palette: `#d4ff00` (chartreuse), `#00d4ff` (ice blue), `#ff3b3b` (red), `#00ff88` (green), `#71717a` (zinc)
- Chart cursor changes to `crosshair` when drawing tool is active
- Mobile uses dropdown for drawing tools (matches existing TimeframeSelector mobile pattern)

## Success Metrics

- Market data gaps eliminated for actively traded symbols
- Chart loads 7 trading sessions of 1h data in < 2 seconds
- Drawing tools are discoverable and usable without documentation
- Drawn annotations persist across page refreshes and sessions

## Resolved Questions

- **Cron backfill**: No. Only fetch yesterday's data. No backfilling of historical gaps.
- **Annotations in exports**: Not applicable — trade sharing is not implemented yet. Revisit when sharing ships.
