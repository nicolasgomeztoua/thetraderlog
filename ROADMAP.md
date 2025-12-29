# EdgeJournal - TradeZella Feature Parity Roadmap

> **Goal:** Bring EdgeJournal to feature parity with TradeZella while maintaining "The Terminal" design system.
>
> **Estimated Timeline:** 6-9 months for full feature parity
>
> **Last Updated:** December 29, 2025 (MAE/MFE + Market Data Caching Architecture implemented)

---

## Table of Contents

- [Current State](#current-state)
- [Phase 1: Enhanced Trade Log and Filtering](#phase-1-enhanced-trade-log-and-filtering)
- [Phase 2: Strategy System](#phase-2-strategy-system)
- [Phase 3: Dashboard Customization](#phase-3-dashboard-customization)
- [Phase 4: Advanced Analytics](#phase-4-advanced-analytics)
- [Phase 5: Trade Detail Enhancements](#phase-5-trade-detail-enhancements)
- [Phase 6: Notebook System](#phase-6-notebook-system)
- [Phase 7: Trade Replay](#phase-7-trade-replay)
- [Phase 8: Backtesting](#phase-8-backtesting)
- [Phase 9: Broker Integrations](#phase-9-broker-integrations)
- [Phase 10: Mobile Optimization](#phase-10-mobile-optimization)
- [Phase 11: Educational and Social](#phase-11-educational-and-social)
- [Database Schema Changes](#database-schema-changes)
- [Execution Timeline](#execution-timeline)

---

## Current State

### What EdgeJournal Already Has

| Feature | Status | Location |
|---------|--------|----------|
| Dashboard with basic stats | ✅ Done | `/dashboard` |
| Trade journal with filters | ✅ Done | `/journal` |
| Trade detail with executions | ✅ Done | `/journal/[id]` |
| Advanced analytics (Overview + Time tabs) | ✅ Done | `/analytics` |
| AI Insights (local analysis) | ✅ Done | `/ai` |
| CSV import (ProjectX) | ✅ Done | `/import` |
| Multi-account system | ✅ Done | `/settings` |
| Prop firm account support | ✅ Done | `/settings` |
| Account groups | ✅ Done | `/settings` |
| Trading sessions config | ✅ Done | `/settings` (Trading tab) |
| Clerk profile integration | ✅ Done | `/settings` (General tab) |
| Zustand settings store (global state) | ✅ Done | `src/stores/settings-store.ts` |
| MAE/MFE per-trade analysis | ✅ Done | `/journal/[id]` (lazy calculation) |
| Market data caching layer | ✅ Done | `src/lib/market-data-service.ts` |
| Lightweight-charts integration | ✅ Done | Trade detail chart tab |

---

## Phase 1: Enhanced Trade Log and Filtering

> **Priority:** HIGH | **Dependencies:** None | **Estimate:** 2-3 weeks
>
> **Sub-plan:** [./plans/phase-1-trade-log.md](./plans/phase-1-trade-log.md)

### Goal
Make the trade log more powerful and customizable like TradeZella's.

### Tasks

#### 1.1 Customizable Trade Log Columns
- [x] Column visibility toggle dropdown
- [x] User preferences stored in database
- ~~Drag-and-drop column reordering~~ *(removed - not needed)*
- ~~Remember column widths~~ *(removed - not needed)*

**Files to modify:**
- `src/app/(protected)/journal/page.tsx`
- `src/server/db/schema.ts`
- `src/server/api/routers/settings.ts`

#### 1.2 Trade Rating System
- [x] Add `rating` field to trades table (1-5 stars)
- [x] Star rating component on trade detail page
- [x] Inline rating in trade log
- [x] Filter by rating

**Files to modify:**
- `src/server/db/schema.ts`
- `src/app/(protected)/journal/[id]/page.tsx`
- `src/server/api/routers/trades.ts`

#### 1.3 Trade Review Status
- [x] Add `isReviewed` boolean to trades
- [x] "Mark as reviewed" action button
- [x] Visual indicator for reviewed trades
- [x] Filter reviewed/unreviewed

#### 1.4 Advanced Filter Panel
- [x] Create filter drawer/modal component
- [x] Date range picker
- [x] Day of week filter
- ~~Time of day filter~~ *(deferred)*
- ~~Trade duration filter~~ *(deferred)*
- [x] Filter by month
- [x] Save filter presets

**New files:**
- `src/app/(protected)/journal/_components/filter-panel.tsx`
- `src/app/(protected)/journal/_components/date-range-picker.tsx`

#### 1.5 Tags System Enhancement
- [x] Tag management page/modal
- [x] Multi-tag assignment to trades
- [x] Tag colors
- [x] Filter by tags
- ~~Tag suggestions/autocomplete~~ *(deferred)*

---

## Phase 2: Strategy System

> **Priority:** HIGH | **Dependencies:** Phase 1 | **Estimate:** 2 weeks
>
> **Sub-plan:** [./plans/phase-2-strategies.md](./plans/phase-2-strategies.md)

### Goal
Document and track trading strategies with clear rules.

### Tasks

#### 2.1 Strategy Data Model
- [x] Create `strategies` table
  - id, userId, name, description, color
  - entry_criteria (text/JSON)
  - exit_rules (text/JSON)
  - position_sizing, risk_parameters
- [x] Create `strategy_rules` table (checklist items)
- [x] Add `strategyId` to trades table

#### 2.2 Strategy CRUD Pages
- [x] Strategies listing page (`/strategies`)
- [x] Create strategy form
- [x] Edit strategy form
- [x] Delete strategy with confirmation
- [x] Strategy card component

**New files:**
- `src/app/(protected)/strategies/page.tsx`
- `src/app/(protected)/strategies/new/page.tsx`
- `src/app/(protected)/strategies/[id]/page.tsx`
- `src/server/api/routers/strategies.ts`

#### 2.3 Trade-Strategy Integration
- [x] Strategy tab on trade detail page
- [x] Assign trade to strategy dropdown
- [x] Rule adherence checkboxes
- [x] Compliance percentage display
- [x] Quick strategy assignment in trade log

#### 2.4 Strategy Analytics
- [x] Performance metrics per strategy
- [x] Win rate by strategy
- [x] Profit factor by strategy
- [x] Average R per strategy
- [x] Compare strategies view/chart

#### 2.5 Advanced Strategy Analytics *(NEW)*
- [ ] Add `riskPercentPerTrade` to strategy risk parameters
- [ ] Monte Carlo simulation per strategy (with proper compounding)
- [ ] Strategy-specific equity curve projections
- [ ] Risk-adjusted strategy comparison

---

## Phase 3: Dashboard Customization

> **Priority:** MEDIUM | **Dependencies:** Phase 1 | **Estimate:** 2-3 weeks
>
> **Sub-plan:** [./plans/phase-3-dashboard.md](./plans/phase-3-dashboard.md)

### Goal
Make the dashboard fully customizable with drag-and-drop widgets like TradeZella.

### Tasks

#### 3.1 Widget System Architecture
- [ ] Create widget registry/config
- [ ] Widget wrapper component
- [ ] User dashboard layouts in DB
- [ ] Drag-and-drop (dnd-kit or react-grid-layout)
- [ ] Widget settings modal

#### 3.2 Upper Section Widgets (KPI Cards)
- [ ] Net P&L widget *(existing)*
- [ ] Win Rate widget *(existing)*
- [ ] Profit Factor widget *(existing)*
- [ ] Account Balance widget
- [ ] Day Win Percentage widget
- [ ] Daily Goal Progress widget
- [ ] Trades Today widget

#### 3.3 Lower Section Widgets (Charts/Data)
- [ ] Analytics chart widget *(existing charts)*
- [ ] Calendar widget (trading calendar heatmap)
- [ ] Recent trades widget
- [ ] Notes/reminder widget
- [ ] Performance streak widget
- [ ] Top symbols widget

#### 3.4 Dashboard Views
- [ ] Dollars view (default)
- [ ] Percentage view
- [ ] Privacy view (blur sensitive data)
- [ ] R-Multiple view
- [ ] Ticks view (futures)
- [ ] Pips view (forex)
- [ ] Points view (futures)

#### 3.5 Dashboard Templates
- [ ] Save current layout as template
- [ ] Load template
- [ ] Preset templates (Scalper, Swing, Day Trader)

---

## Phase 4: Advanced Analytics

> **Priority:** HIGH | **Dependencies:** Phase 1, 2 | **Estimate:** 4-5 weeks
>
> **Sub-plan:** [./plans/phase-4-analytics.md](./plans/phase-4-analytics.md) *(DETAILED)*
>
> **Status:** 🔄 In Progress

### Goal
Build 50+ specialized reports like TradeZella, plus professional-grade metrics used by hedge funds and prop firms (Sharpe/Sortino/Calmar ratios, Risk of Ruin, Kelly Criterion, Monte Carlo simulations).

### Tasks

#### 4.1 Time-Based Reports
- [x] Performance by day of week (custom horizontal bar chart)
- [x] Performance by time of day (24-hour heatmap)
- [x] Performance by trading session (user-configurable sessions)
- [x] Performance by month (area chart with trend line)
- [x] Calendar heatmap (GitHub-style daily P&L)
- [x] Best/worst trading days highlighted
- [ ] Trading frequency analysis

#### 4.2 Setup-Based Reports
- [ ] Best setup analysis
- [ ] Setup comparison matrix
- [ ] Win rate by setup type
- [ ] Profit factor by setup
- [ ] Setup performance over time

#### 4.3 Risk Reports
- [x] R-Multiple distribution
- [x] Risk/reward ratio analysis
- [x] Drawdown tracking chart (Equity curve with drawdown highlighting)
- [x] Maximum drawdown calculation
- [x] Position sizing analysis
- ~~MAE/MFE~~ *(moved to Trade Detail - per-trade metric, not aggregate)*

#### 4.3.1 Professional Risk Metrics *(COMPLETED)*
- [x] Sharpe Ratio (risk-adjusted return)
- [x] Sortino Ratio (downside volatility only)
- [x] Calmar Ratio (return / max drawdown)
- [x] Risk of Ruin calculation (with dynamic account limits)
- [x] Kelly Criterion (optimal position sizing)
- [x] Recovery Factor
- [x] Ulcer Index
- [ ] Monte Carlo simulation *(moved to Strategy Analytics - requires risk % per trade)*

#### 4.4 Streak and Pattern Reports
- [ ] Consecutive wins tracking
- [ ] Consecutive losses tracking
- [ ] Performance after win
- [ ] Performance after loss
- [ ] Recovery from drawdown
- [ ] Tilt detection patterns

#### 4.5 Custom Reports & Export
- [ ] Report builder interface
- [ ] Export to PDF
- [ ] Export to CSV
- [ ] Share report (public link)
- [ ] Scheduled report emails

---

## Phase 5: Trade Detail Enhancements

> **Priority:** MEDIUM | **Dependencies:** Phase 2 | **Estimate:** 2 weeks
>
> **Sub-plan:** [./plans/phase-5-trade-detail.md](./plans/phase-5-trade-detail.md)

### Goal
Match TradeZella's comprehensive trade tracking page.

### Tasks

#### 5.0 TradeZella-Style Layout (NEW)
- [x] Two-panel resizable layout (react-resizable-panels v2 + shadcn)
- [x] Left panel: Stats, Strategy, Executions, Attachments tabs
- [x] Right panel: Chart, Notes, Running P&L tabs
- [x] Panel sizes persist to localStorage
- [x] Risk Management section (TP/SL/Trailing Stop/Exit Reason)
- [x] Trade Context section (Setup Type, Emotional State)
- [x] Calculated stats: Points, Ticks, R-Multiple, ROI, Duration

#### 5.1 Daily Trades Sidebar
- [ ] Collapsible sidebar component
- [ ] List all trades for the day
- [ ] Quick navigation between trades
- [ ] Daily P&L summary
- [ ] Previous/next day navigation

#### 5.2 Working Screenshot Uploads
- [ ] Cloud storage integration (S3/Cloudinary/Uploadthing)
- [ ] Multiple screenshots per trade
- [ ] Screenshot captions
- [ ] Before/during/after categorization
- [ ] Screenshot lightbox/gallery view
- [ ] Delete screenshots

#### 5.3 Daily Notes System
- [ ] Daily notes table in schema
- [ ] Notes that apply to entire day
- [ ] Sync across all trades for day
- [ ] Pre-market notes section
- [ ] Post-market notes section

#### 5.4 Chart Integration
- [x] Lightweight-charts implementation (replaced TradingView widget)
- [x] Real OHLC data from cached market data service
- [ ] Display entry/exit markers on chart
- [ ] Multiple timeframe toggle
- [ ] Chart annotation tools

#### 5.5 MAE/MFE Per-Trade Analysis *(COMPLETED)*
- [x] Add `maePrice`, `mfePrice`, `maeAmount`, `mfeAmount`, `tradeEfficiency`, `marketDataQuality` fields to trades schema
- [x] Create `candle_cache` table for cross-user OHLC data deduplication
- [x] Twelve Data API integration for fetching OHLC during trade
- [x] Cache-first market data service (`src/lib/market-data-service.ts`)
- [x] Lazy MAE/MFE calculation on trade detail view
- [x] MAE/MFE stored permanently after calculation
- [x] Show efficiency % (captured P&L vs MFE)
- [ ] Visual markers on chart (MAE/MFE extremes)

---

## Phase 6: Notebook System

> **Priority:** MEDIUM | **Dependencies:** Phase 1 | **Estimate:** 2 weeks
>
> **Sub-plan:** [./plans/phase-6-notebook.md](./plans/phase-6-notebook.md)

### Goal
Comprehensive planning and note-taking like TradeZella's Notebook.

### Tasks

#### 6.1 Notebook Data Model
- [ ] `notebook_entries` table
- [ ] `notebook_templates` table
- [ ] Tags support for entries
- [ ] Trade linking support

#### 6.2 Notebook Pages
- [ ] Notebook listing (`/notebook`)
- [ ] Create new entry
- [ ] Rich text editor (Tiptap or similar)
- [ ] Entry detail view
- [ ] Edit/delete entries

**New files:**
- `src/app/(protected)/notebook/page.tsx`
- `src/app/(protected)/notebook/new/page.tsx`
- `src/app/(protected)/notebook/[id]/page.tsx`

#### 6.3 Pre-Built Templates
- [ ] Pre-market prep template
- [ ] Post-market review template
- [ ] Weekly assessment template
- [ ] Trade review template
- [ ] Monthly recap template

#### 6.4 Notebook Features
- [ ] Full-text search
- [ ] Filter by tags
- [ ] Link entries to trades
- [ ] Embed trading stats (auto-populate)
- [ ] Calendar view of entries

---

## Phase 7: Trade Replay

> **Priority:** LOW | **Dependencies:** Phase 4 | **Estimate:** 3-4 weeks
>
> **Sub-plan:** [./plans/phase-7-replay.md](./plans/phase-7-replay.md)

### Goal
Tick-by-tick trade replay functionality.

### Tasks

#### 7.1 Historical Data Integration
- [ ] Market data provider integration (Polygon/Alpha Vantage)
- [ ] Data fetching and caching
- [ ] Support for forex, futures, stocks
- [ ] Handle different data granularities

#### 7.2 Replay Engine
- [ ] Replay player component
- [ ] Play/pause controls
- [ ] Variable speed (0.5x, 1x, 2x, 5x, 10x)
- [ ] Timeline scrubber
- [ ] Jump to entry/exit buttons

#### 7.3 Replay Visualization
- [ ] Candlestick chart renderer
- [ ] Trade markers on chart
- [ ] Time and sales display
- [ ] Real-time P&L during replay
- [ ] Volume visualization

---

## Phase 8: Backtesting

> **Priority:** LOW | **Dependencies:** Phase 7 | **Estimate:** 3-4 weeks
>
> **Sub-plan:** [./plans/phase-8-backtesting.md](./plans/phase-8-backtesting.md)

### Goal
Strategy backtesting with historical data.

### Tasks

#### 8.1 Backtest Data Model
- [ ] `backtest_sessions` table
- [ ] `backtest_trades` table
- [ ] Link to playbooks

#### 8.2 Backtesting Interface
- [ ] New backtest page (`/backtest`)
- [ ] Symbol selection
- [ ] Timeframe selection
- [ ] Date range selection
- [ ] Manual trade entry during backtest
- [ ] Keyboard shortcuts

#### 8.3 Backtest Results
- [ ] Performance summary
- [ ] Trade list
- [ ] Equity curve
- [ ] Compare to live trading
- [ ] Export results

---

## Phase 9: Broker Integrations

> **Priority:** MEDIUM | **Dependencies:** None | **Estimate:** 1-2 weeks per parser
>
> **Sub-plan:** [./plans/phase-9-brokers.md](./plans/phase-9-brokers.md)

### Goal
Direct broker connections for auto-sync.

### Tasks

#### 9.1 CSV Parser Expansion
- [ ] MT4 parser (complete existing)
- [ ] MT5 parser
- [ ] NinjaTrader parser
- [ ] cTrader parser
- [ ] TradingView parser
- [ ] Tradovate parser
- [ ] Rithmic parser
- [ ] Topstep parser
- [ ] Apex parser

**Files to modify:**
- `src/lib/csv-parsers/`

#### 9.2 Direct API Integrations (Future)
- [ ] OAuth flow for brokers
- [ ] Scheduled sync jobs
- [ ] Real-time trade detection
- [ ] Connection status UI

**Priority brokers:**
1. MetaTrader 4/5
2. Interactive Brokers
3. TradingView
4. Tradovate
5. NinjaTrader

---

## Phase 10: Mobile Optimization

> **Priority:** LOW | **Dependencies:** None | **Estimate:** 2 weeks
>
> **Sub-plan:** [./plans/phase-10-mobile.md](./plans/phase-10-mobile.md)

### Goal
Full mobile experience.

### Tasks

#### 10.1 Responsive Improvements
- [ ] Audit all pages for mobile
- [ ] Mobile navigation improvements
- [ ] Mobile trade entry form
- [ ] Mobile-friendly charts
- [ ] Touch-friendly controls
- [ ] Swipe gestures

#### 10.2 PWA Features
- [ ] Service worker setup
- [ ] Offline support
- [ ] Install prompt
- [ ] App icons and manifest
- [ ] Push notifications (trade reminders)

---

## Phase 11: Educational and Social

> **Priority:** LOW | **Dependencies:** Phase 5 | **Estimate:** Ongoing
>
> **Sub-plan:** [./plans/phase-11-social.md](./plans/phase-11-social.md)

### Goal
Learning resources and community features.

### Tasks

#### 11.1 Mentor Mode
- [ ] Invite mentor (email invite)
- [ ] Read-only access to account
- [ ] Mentor can add annotations
- [ ] Mentor feedback on trades
- [ ] Revoke access

#### 11.2 Learning Hub (Future)
- [ ] Trading guides
- [ ] Video tutorials
- [ ] Strategy library
- [ ] Community forums

---

## Database Schema Changes

### New Tables

```sql
-- Strategies
strategies (id, userId, name, description, color, entryCriteria, exitRules, positionSizing, riskParameters, createdAt, updatedAt)

-- Strategy Rules (checklist items)
strategy_rules (id, strategyId, text, order, createdAt)

-- Market Data Cache (cross-user deduplication) ✅ IMPLEMENTED
candle_cache (id, symbol, interval, date, bars, barCount, source, fetchedAt)
-- Composite unique index on (symbol, interval, date)

-- Notebook
notebook_entries (id, userId, title, content, templateId, tags, tradeIds, createdAt, updatedAt)
notebook_templates (id, userId, name, content, isDefault, createdAt)

-- Dashboard
dashboard_layouts (id, userId, name, layout, isDefault, createdAt, updatedAt)

-- Filter Presets
filter_presets (id, userId, name, filters, createdAt)

-- Daily Notes
daily_notes (id, userId, date, preMarket, postMarket, createdAt, updatedAt)

-- Backtesting
backtest_sessions (id, userId, name, symbol, timeframe, startDate, endDate, createdAt)
backtest_trades (id, sessionId, entryTime, exitTime, entryPrice, exitPrice, direction, quantity, pnl)
```

### Updates to Existing Tables

```sql
-- trades table
ALTER TABLE trades ADD COLUMN rating INTEGER;           -- 1-5 stars
ALTER TABLE trades ADD COLUMN is_reviewed BOOLEAN;      -- review status
ALTER TABLE trades ADD COLUMN strategy_id INTEGER;      -- FK to strategies
ALTER TABLE trades ADD COLUMN is_intraday BOOLEAN;      -- auto-calculated

-- trades table - MAE/MFE fields ✅ IMPLEMENTED
ALTER TABLE trades ADD COLUMN mae_price DECIMAL(20, 8);           -- worst price during trade
ALTER TABLE trades ADD COLUMN mfe_price DECIMAL(20, 8);           -- best price during trade
ALTER TABLE trades ADD COLUMN mae_amount DECIMAL(20, 2);          -- max adverse $ amount
ALTER TABLE trades ADD COLUMN mfe_amount DECIMAL(20, 2);          -- max favorable $ amount
ALTER TABLE trades ADD COLUMN trade_efficiency DECIMAL(5, 2);     -- MFE capture %
ALTER TABLE trades ADD COLUMN market_data_quality data_quality;   -- 'full' | 'partial' | 'unavailable' | 'pending'

-- user_settings table
ALTER TABLE user_settings ADD COLUMN trade_log_columns JSONB;
ALTER TABLE user_settings ADD COLUMN dashboard_layout_id INTEGER;
```

---

## Execution Timeline

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Enhanced Trade Log | 2-3 weeks | ✅ Complete |
| 2 | Strategy System | 2 weeks | ✅ Complete |
| 3 | Dashboard Customization | 2-3 weeks | ⏳ Pending |
| 4 | Advanced Analytics | 4-5 weeks | 🔄 In Progress |
| 5 | Trade Detail Enhancements | 2 weeks | 🔄 In Progress (Layout ✅, MAE/MFE ✅, Screenshot pending) |
| 6 | Notebook System | 2 weeks | ⏳ Pending |
| 9.1 | CSV Parsers | 1-2 weeks | ⏳ Pending |
| 7 | Trade Replay | 3-4 weeks | ⏳ Pending |
| 8 | Backtesting | 3-4 weeks | ⏳ Pending |
| 10 | Mobile Optimization | 2 weeks | ⏳ Pending |
| 11 | Educational/Social | Ongoing | ⏳ Pending |

**Total: 6-9 months for full feature parity**

---

## Legend

- ⏳ Pending
- 🔄 In Progress
- ✅ Complete
- ❌ Blocked

---

## How to Use This Roadmap

1. **Start with Phase 1** - It's foundational for other phases
2. **Create sub-plan files** in `./plans/` for each phase when starting
3. **Update checkboxes** as tasks are completed
4. **Review dependencies** before starting a phase
5. **Adjust estimates** based on actual progress

