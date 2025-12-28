# Phase 4: Advanced Analytics

> **Parent:** [../ROADMAP.md](../ROADMAP.md)
>
> **Priority:** HIGH | **Dependencies:** Phase 1, 2 | **Estimate:** 4-5 weeks
>
> **Status:** 🔄 In Progress

---

## Overview

Transform EdgeJournal's analytics from basic charts into a professional-grade performance analysis system. Combines TradeZella's 50+ report categories with institutional metrics used by hedge funds and prop firms: Sharpe/Sortino/Calmar ratios, Risk of Ruin, MAE/MFE analysis, Kelly Criterion, and Monte Carlo simulations.

---

## Professional Metrics Reference

### Risk-Adjusted Return Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| Sharpe Ratio | (Return - RiskFree) / StdDev | Overall risk-adjusted performance |
| Sortino Ratio | (Return - RiskFree) / DownsideStdDev | Penalizes only downside volatility |
| Calmar Ratio | Annualized Return / Max Drawdown | Return per unit of drawdown risk |

### Risk Management Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| Risk of Ruin | Probability calculation | Chance of blowing account |
| Kelly Criterion | (W × AvgWin - L × AvgLoss) / AvgWin | Optimal position size % |
| Recovery Factor | Net Profit / Max Drawdown | How efficiently you recover |
| Ulcer Index | RMS of drawdown percentages | Drawdown depth + duration |

### Trade Quality Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| MAE | Max Adverse Excursion | Optimize stop loss placement |
| MFE | Max Favorable Excursion | Optimize take profit placement |
| Trade Efficiency | Actual P&L / MFE | % of available move captured |
| Expectancy | (Win% × AvgWin) - (Loss% × AvgLoss) | Expected $ per trade |

---

## Sprint Breakdown

### Sprint 4.1: Infrastructure and Core Metrics (Week 1)

**Goal:** Set up analytics router, extend stats calculations, build reusable chart components, add tab navigation.

#### Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Create `src/server/api/routers/analytics.ts` router | High | ✅ | New router for all analytics |
| Add analytics router to `root.ts` | High | ✅ | Register in tRPC |
| Create `getOverview` procedure | High | ✅ | All core metrics in one call |
| Extend `stats-calculations.ts` with Sharpe/Sortino | High | ✅ | Risk-adjusted returns |
| Add expectancy and payoff ratio calculations | High | ✅ | Trade quality metrics |
| Add standard deviation helpers | Medium | ✅ | Required for ratios |
| Refactor analytics page with tab navigation | High | ✅ | Overview, Time, Risk, Symbol, Behavior tabs |
| Create `MetricCard` component with tooltip | High | ✅ | **REQUIRED: Every metric needs tooltip with what/why/benchmark** |
| Create `DistributionChart` component | Medium | ⏳ | For histograms |
| Style tabs following Terminal design | Medium | ✅ | Consistent with app |

#### Files to Create

```
src/server/api/routers/analytics.ts        # New analytics router
src/components/analytics/metric-card.tsx   # Metric display with info tooltip
src/components/analytics/distribution-chart.tsx  # Histogram component
src/components/analytics/index.ts          # Barrel export
```

#### Files to Modify

```
src/server/api/root.ts                     # Add analytics router
src/lib/stats-calculations.ts              # Add new calculations
src/app/(protected)/analytics/page.tsx     # Refactor with tabs
```

#### Acceptance Criteria

- [ ] Analytics page has 5 tabs: Overview, Time, Risk, Symbols, Behavior
- [ ] Overview tab shows all existing metrics plus Expectancy, Payoff Ratio
- [ ] MetricCard component shows info icon with tooltip explaining the metric
- [ ] All calculations have unit tests
- [ ] Page loads in under 2 seconds with 500+ trades

---

### Sprint 4.2: Time-Based Analysis (Week 2)

**Goal:** Performance breakdowns by day of week, hour of day, month, and trading session.

#### Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Create `getPerformanceByDayOfWeek` procedure | High | ✅ | P&L, win rate per day |
| Create `getPerformanceByHour` procedure | High | ✅ | Respect user timezone |
| Create `getPerformanceByMonth` procedure | High | ✅ | Monthly comparison |
| Create `getPerformanceBySession` procedure | Medium | ✅ | Uses user-defined sessions from settings |
| Create `getCalendarData` procedure | High | ✅ | Daily P&L for heatmap |
| Build `CalendarHeatmap` component | High | ✅ | GitHub-style, clickable |
| Build `DayOfWeekChart` component | High | ✅ | Bar chart by weekday |
| Build `HourHeatmap` component | Medium | ✅ | 24-hour grid |
| Build `SessionChart` component | Medium | ✅ | Session breakdown |
| Build `MonthlyChart` component | Medium | ✅ | Month-over-month |
| Implement Time tab UI | High | ✅ | Layout and styling |

#### Files to Create

```
src/components/analytics/calendar-heatmap.tsx  # GitHub-style calendar
src/components/analytics/day-of-week-chart.tsx # Weekday performance
src/components/analytics/hour-heatmap.tsx      # Hour-by-hour grid
src/components/analytics/session-chart.tsx     # Trading sessions
src/components/analytics/monthly-chart.tsx     # Monthly comparison
```

#### Files to Modify

```
src/server/api/routers/analytics.ts   # Add time procedures
src/app/(protected)/analytics/page.tsx # Time tab content
```

#### Trading Sessions Configuration

**✅ IMPLEMENTED:** Sessions are now user-configurable in Settings → Trading tab.

- Added `tradingSessions` field to `userSettings` schema (JSON)
- Added Trading tab to Settings page with session management UI
- Sessions have name, startHour, endHour (UTC), and color
- Analytics router fetches user's custom sessions
- Default sessions: Asia (0-8), London (8-16), New York (13-21)

**TODO:** Display session times in user's timezone (needs Zustand settings store)

#### Acceptance Criteria

- [ ] Calendar heatmap shows daily P&L with color intensity
- [ ] Clicking a calendar day shows trades for that day
- [ ] Day of week chart identifies best/worst trading days
- [ ] Hour analysis respects user's timezone setting
- [ ] Session analysis works for both futures and forex
- [ ] All charts follow Terminal design system

---

### Sprint 4.3: Risk Metrics (Week 3)

**Goal:** Professional risk analytics - drawdown tracking, risk-adjusted returns, risk of ruin.

#### Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Create `src/lib/risk-calculations.ts` | High | ✅ | All risk formulas |
| Implement `calculateDrawdowns` function | High | ✅ | Find all drawdown periods |
| Implement `calculateSharpeRatio` function | High | ✅ | Daily returns-based |
| Implement `calculateSortinoRatio` function | High | ✅ | Downside deviation only |
| Implement `calculateCalmarRatio` function | Medium | ✅ | Annualized return / MDD |
| Implement `calculateRiskOfRuin` function | High | ✅ | Probability formula |
| Implement `calculateKellyCriterion` function | High | ✅ | Optimal sizing |
| Implement `calculateUlcerIndex` function | Low | ✅ | RMS of drawdowns |
| Implement `calculateRecoveryFactor` function | Medium | ✅ | Net profit / MDD |
| Create `getRiskMetrics` procedure | High | ✅ | Return all risk data |
| Create `getDrawdownHistory` procedure | High | ✅ | For drawdown table |
| Build `EquityCurve` component | High | ✅ | With drawdown highlighting |
| Build `DrawdownTable` component | High | ✅ | Top 10 drawdowns |
| Build `RiskOfRuinGauge` component | Medium | ✅ | Visual probability |
| Build `KellyDisplay` component | Medium | ✅ | Position size recommendation |
| Implement Risk tab UI | High | ✅ | Layout all components |
| Build `RMultipleChart` component | High | ✅ | R-Multiple distribution histogram |
| Build `RiskRewardPanel` component | High | ✅ | Risk/Reward analysis panel |
| Create `getPositionSizeAnalysis` procedure | High | ✅ | Performance by position size |
| Build `PositionSizeChart` component | High | ✅ | Position sizing analysis |

#### Files to Create

```
src/lib/risk-calculations.ts               # Risk metric calculations
src/components/analytics/equity-curve.tsx  # Equity with drawdowns
src/components/analytics/drawdown-table.tsx # Top drawdowns list
src/components/analytics/risk-gauge.tsx    # Risk of ruin visualization
src/components/analytics/kelly-display.tsx # Kelly recommendation
```

#### Files to Modify

```
src/server/api/routers/analytics.ts   # Add risk procedures
src/app/(protected)/analytics/page.tsx # Risk tab content
```

#### Risk of Ruin Formula

```typescript
// Simplified Risk of Ruin formula
// RoR = ((1 - Edge) / (1 + Edge))^Units
// Where Edge = (WinRate * PayoffRatio - LossRate) / PayoffRatio
function calculateRiskOfRuin(
  winRate: number,      // e.g., 0.55
  payoffRatio: number,  // avgWin / avgLoss, e.g., 1.5
  riskPerTrade: number, // % of capital risked, e.g., 0.02
  ruinThreshold: number // e.g., 0.5 for 50% drawdown
): number
```

#### Acceptance Criteria

- [x] Equity curve clearly shows drawdown periods in red
- [x] Drawdown table shows depth, duration, and recovery time
- [x] Risk of Ruin displays as percentage with visual gauge
- [x] Kelly Criterion shows recommended position size %
- [x] Sharpe/Sortino/Calmar displayed with industry benchmarks
- [x] All calculations match standard financial formulas

---

### Sprint 4.4: Symbol and Setup Analysis (Week 4)

**Goal:** Performance breakdown by symbol, setup type, strategy, and direction.

#### Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Create `getSymbolPerformance` procedure | High | ⏳ | Stats grouped by symbol |
| Create `getSetupPerformance` procedure | High | ⏳ | Stats by setup type |
| Create `getDirectionPerformance` procedure | Medium | ⏳ | Long vs Short |
| Create `getInstrumentTypePerformance` procedure | Medium | ⏳ | Futures vs Forex |
| Create `getStrategyComparison` procedure | High | ⏳ | Compare strategies |
| Build `PerformanceTable` component | High | ⏳ | Sortable, filterable |
| Build `ComparisonChart` component | High | ⏳ | Multi-series bars |
| Build `SymbolBreakdown` component | Medium | ⏳ | Pie/donut chart |
| Build `DirectionComparison` component | Medium | ⏳ | Long vs Short visual |
| Implement Symbol tab UI | High | ⏳ | Layout components |

#### Files to Create

```
src/components/analytics/performance-table.tsx  # Sortable stats table
src/components/analytics/comparison-chart.tsx   # Multi-series comparison
src/components/analytics/symbol-breakdown.tsx   # Symbol distribution
src/components/analytics/direction-comparison.tsx # Long vs Short
```

#### Files to Modify

```
src/server/api/routers/analytics.ts   # Add symbol procedures
src/app/(protected)/analytics/page.tsx # Symbol tab content
```

#### Performance Table Columns

```typescript
const PERFORMANCE_TABLE_COLUMNS = [
  'name',        // Symbol, Setup, or Strategy name
  'trades',      // Total trade count
  'winRate',     // Win rate %
  'totalPnl',    // Net P&L
  'avgPnl',      // Average P&L per trade
  'profitFactor',// Profit factor
  'avgWin',      // Average winning trade
  'avgLoss',     // Average losing trade
  'expectancy',  // Expected value per trade
];
```

#### Acceptance Criteria

- [ ] Performance table is sortable by any column
- [ ] Can compare up to 5 symbols/strategies side-by-side
- [ ] Direction analysis shows Long vs Short clearly
- [ ] Setup type analysis works with user-defined setups
- [ ] Strategy comparison links to strategy detail pages
- [ ] Top performers highlighted visually

---

### Sprint 4.5: Behavioral Patterns and Streaks (Week 4-5)

**Goal:** Identify behavioral patterns, streaks, and psychological tendencies.

#### Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Create `getStreakAnalysis` procedure | High | ⏳ | Win/loss streaks |
| Create `getAfterWinPerformance` procedure | High | ⏳ | Performance after wins |
| Create `getAfterLossPerformance` procedure | High | ⏳ | Revenge trading detection |
| Create `getOvertradingAnalysis` procedure | Medium | ⏳ | Trade count vs P&L |
| Create `getHoldDurationAnalysis` procedure | Medium | ⏳ | Duration vs P&L |
| Create `getPositionSizeAnalysis` procedure | Medium | ⏳ | Size vs performance |
| Build `StreakCard` component | High | ⏳ | Current + longest streaks |
| Build `AfterWinLossChart` component | High | ⏳ | Before/after comparison |
| Build `CorrelationChart` component | Medium | ⏳ | Scatter plot with trend |
| Build `OvertradingWarning` component | Medium | ⏳ | Alert if pattern detected |
| Implement Behavior tab UI | High | ⏳ | Layout components |

#### Files to Create

```
src/components/analytics/streak-card.tsx        # Win/loss streak display
src/components/analytics/after-win-loss.tsx     # Performance patterns
src/components/analytics/correlation-chart.tsx  # X vs Y scatter
src/components/analytics/overtrading-warning.tsx # Behavioral alert
```

#### Files to Modify

```
src/server/api/routers/analytics.ts   # Add behavior procedures
src/app/(protected)/analytics/page.tsx # Behavior tab content
```

#### Streak Analysis Schema

```typescript
interface StreakAnalysis {
  currentStreak: {
    type: 'win' | 'loss' | 'none';
    count: number;
  };
  longestWinStreak: {
    count: number;
    startDate: Date;
    endDate: Date;
    totalPnl: number;
  };
  longestLossStreak: {
    count: number;
    startDate: Date;
    endDate: Date;
    totalPnl: number;
  };
  averageWinStreak: number;
  averageLossStreak: number;
}
```

#### Overtrading Detection Logic

```typescript
// Flag overtrading if:
// 1. Days with 5+ trades have lower avg P&L than days with 1-3 trades
// 2. Win rate decreases as daily trade count increases
// 3. Performance degrades in latter half of session
```

#### Acceptance Criteria

- [ ] Current streak prominently displayed
- [ ] Longest win/loss streaks shown with dates and P&L
- [ ] After-win performance clearly shows if user maintains edge
- [ ] After-loss performance reveals revenge trading patterns
- [ ] Overtrading warning triggers when pattern detected
- [ ] Hold duration analysis buckets trades appropriately

---

### ~~Sprint 4.6: MAE/MFE~~ (REMOVED)

**Status:** ❌ Removed from Analytics

**Reason:** MAE/MFE is a per-trade metric, not an aggregate analytics feature. Comparing MAE across different symbols and trade durations in aggregate doesn't provide meaningful insights.

**Moved to:** Phase 5 Trade Detail (Section 5.5)

The per-trade MAE/MFE implementation includes:
- TradingView widget for chart display
- Twelve Data API for fetching high/low during trade
- Per-trade efficiency calculation (captured P&L vs MFE)
- Visual markers on the trade detail chart

**Monte Carlo:** Moved to Phase 2.5 Strategy Analytics (requires risk % per trade for proper compounding simulation)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Analytics Page                               │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐           │
│  │Overview │  Time   │  Risk   │ Symbols │Behavior │           │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘           │
└───────┼─────────┼─────────┼─────────┼─────────┼─────────────────┘
        │         │         │         │         │
        ▼         ▼         ▼         ▼         ▼
┌───────────────────────────────────────────────────────────────┐
│                    analytics.ts Router                         │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │ getOverview  │getTimeAnalysis│getRiskMetrics│getSymbol... │ │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘ │
└─────────┼──────────────┼──────────────┼──────────────┼────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│stats-calculations│ │risk-calculations│ │   Database (trades)  │
│   .ts           │ │      .ts        │ │                      │
└─────────────────┘ └─────────────────┘ └──────────────────────┘
```

---

## File Summary

### New Files (12 total)

```
src/server/api/routers/analytics.ts           # Main analytics router
src/lib/risk-calculations.ts                  # Risk metric formulas

src/components/analytics/
├── index.ts                                  # Barrel exports
├── metric-card.tsx                           # Metric with tooltip
├── distribution-chart.tsx                    # Histogram
├── calendar-heatmap.tsx                      # Daily P&L calendar
├── day-of-week-chart.tsx                     # Weekday performance
├── hour-heatmap.tsx                          # Hour grid
├── session-chart.tsx                         # Trading sessions
├── equity-curve.tsx                          # With drawdowns
├── drawdown-table.tsx                        # Top drawdowns
├── performance-table.tsx                     # Symbol/setup stats
└── streak-card.tsx                           # Win/loss streaks
```

*Note: MAE/MFE and Monte Carlo components moved to Phase 5 Trade Detail and Phase 2.5 Strategy Analytics respectively.*

### Modified Files

```
src/server/api/root.ts                        # Add analytics router
src/lib/stats-calculations.ts                 # Extend with new calcs
src/app/(protected)/analytics/page.tsx        # Complete refactor
```

---

## Success Criteria

- [ ] Analytics page loads in under 2 seconds with 1000+ trades
- [ ] All calculations match industry-standard formulas
- [ ] **Every metric has an info tooltip explaining what it means and why it matters**
- [ ] Mobile-responsive following Terminal design
- [ ] Charts use ag-charts-react consistent with existing
- [ ] Risk of Ruin and Kelly Criterion provide actionable insights
- [ ] Time analysis helps identify optimal trading windows
- [ ] Behavioral analysis reveals psychological patterns

---

## UX Requirement: Metric Tooltips

**Every analytic metric MUST have an info tooltip** with:
1. **What it is** — One-sentence definition
2. **Why it matters** — How traders use this metric
3. **Good vs Bad** — What values indicate strong/weak performance

Example for Sharpe Ratio:
```
What: Measures risk-adjusted return (excess return per unit of volatility)
Why: Higher Sharpe = better returns for the risk taken
Benchmark: >1 is good, >2 is excellent, <0 means losing money
```

Implementation: Use the `MetricCard` component with an info icon that shows a tooltip on hover.

---

## Notes

*Add implementation notes here as sprints progress.*

### Sprint 4.1 Notes
*(To be filled during implementation)*

### Sprint 4.2 Notes
*(To be filled during implementation)*

### Sprint 4.3 Notes

**Completed December 28, 2025:**

Added comprehensive risk analysis features to the Risk tab:

1. **R-Multiple Distribution** (`r-multiple-chart.tsx`)
   - Horizontal bar histogram showing trade count per R-bucket
   - Stats: avg R-multiple, avg win R, avg loss R, max/min R
   - Uses existing `getRMultipleDistribution` endpoint

2. **Risk/Reward Analysis** (`risk-reward-panel.tsx`)
   - Summary cards: avg R-multiple, avg planned R:R, trade efficiency %
   - Category breakdown table by planned R:R range
   - Uses existing `getRiskRewardAnalysis` endpoint

3. **Position Sizing Analysis** (`position-size-chart.tsx`)
   - NEW backend: `getPositionSizeAnalysis` procedure
   - Groups trades into small/medium-small/medium-large/large buckets based on percentiles
   - Shows performance by position size tier

**Note:** Monte Carlo simulation was initially implemented but moved to Strategy Analytics (Section 2.5) because it requires risk % per trade to properly simulate compounding. Without knowing the risk per trade, the simulation just shuffles dollar P&L values which doesn't account for position sizing based on equity.

All components follow Terminal design system with tooltips explaining each metric.

### Sprint 4.4 Notes
*(To be filled during implementation)*

### Sprint 4.5 Notes
*(To be filled during implementation)*

### Sprint 4.6 Notes

**December 28, 2025:** Sprint removed from Phase 4 Analytics.

MAE/MFE was determined to be a per-trade metric rather than an aggregate analytics feature. Aggregate MAE/MFE comparison across different symbols and trade durations doesn't provide meaningful insights.

**New location:** Phase 5 Trade Detail (Section 5.5) - Per-trade MAE/MFE with TradingView chart integration and Twelve Data API for price data.
