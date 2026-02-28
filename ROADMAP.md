# EdgeJournal - TradeZella Feature Parity Roadmap

> **Goal:** Bring EdgeJournal to feature parity with TradeZella while maintaining "The Terminal" design system.
>
> **Estimated Timeline:** 6-9 months for full feature parity
>
> **Last Updated:** February 15, 2026 (Final status update)

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
- [Phase 8: Broker Integrations](#phase-8-broker-integrations)
- [Phase 9: Mobile Optimization](#phase-9-mobile-optimization)
- [Phase 10: AI Analytics](#phase-10-ai-analytics)
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
| Chart preferences persistence (Zustand) | ✅ Done | `src/stores/chart-preferences-store.ts` |
| OHLC snapping crosshair | ✅ Done | Trade detail chart (snaps to nearest O/H/L/C) |
| Multi-day trade data fetching | ✅ Done | Parallel fetch for trades spanning multiple days |
| Trade Replay | ✅ Done | Trade detail Replay tab (play/pause, speed, scrub, jump by interval) |
| Daily Journal system | ✅ Done | `/daily-journal` (checklist, editor, attachments, streaks) |
| S3 attachment infrastructure | ✅ Done | `src/lib/s3.ts` |

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
> **Status:** ❌ Scrapped — Not pursuing dashboard widget customization. Current dashboard is sufficient.

---

## Phase 4: Advanced Analytics (RESTRUCTURED)

> **Priority:** HIGH | **Dependencies:** Phase 1, 2 | **Estimate:** 6-8 weeks
>
> **Sub-plan:** [./plans/phase-4-analytics.md](./plans/phase-4-analytics.md)
>
> **Status:** ✅ Complete

### Goal
Complete 5-tab analytics system (Overview, Time, Risk, Symbols, Behavior) with cross-filterable dimensions and a full query builder.

### Completed Tabs

#### Overview Tab ✅
- [x] 8 metric cards (P&L, Win Rate, Profit Factor, Avg Trade, Expectancy, Payoff Ratio, Sharpe, Streak)
- [x] Win/Loss distribution donut chart
- [x] Cumulative P&L area chart
- [x] P&L by trade bar chart (last 50)

#### Time Tab ✅
- [x] Calendar heatmap (365 days daily P&L)
- [x] Day of week performance breakdown
- [x] Hourly performance heatmap (24h, timezone-aware)
- [x] Trading session analysis (user-configurable)
- [x] Monthly P&L trend chart

#### Risk Tab ✅
- [x] 8 risk metric cards (Max DD, Current DD, Sortino, Calmar, Recovery Factor, Ulcer Index, Drawdowns, Time in DD)
- [x] Equity curve with drawdown highlighting
- [x] R-Multiple distribution histogram
- [x] Risk/Reward analysis (planned vs actual)
- [x] Risk of Ruin gauge
- [x] Kelly Criterion display
- [x] Position sizing analysis
- [x] Drawdown history table

#### Symbols Tab ✅
- [x] Symbol performance table (P&L, trades, win rate, profit factor per symbol)
- [x] Best/worst symbols ranking
- [x] Symbol distribution pie chart
- [x] Symbol performance over time (line chart per symbol)

#### Behavior Tab ✅
- [x] Streak analysis (consecutive wins/losses, max streaks)
- [x] Performance after win vs after loss (revenge trading detection)
- [x] Trade frequency analysis (trades per day distribution)
- [x] Overtrading detection (performance vs trade count correlation)
- [x] Holding time analysis (performance by duration buckets)
- [x] Behavioral metrics summary (tilt score, discipline, overtrading tendency)

#### Cross-Filtering System ✅
- [x] Zustand store for analytics filters (`src/stores/analytics-filter-store.ts`)
- [x] 11 filter dimensions: symbol, date range, day of week, hour, session, strategy, tags, R-multiple range, position size range, outcome, reviewed
- [x] All 19+ analytics queries accept filter parameters
- [x] Filter chips UI showing active filters
- [x] Filter panel with all controls
- [x] Query builder with AND/OR conditions between groups
- [x] Filter presets (save/load/manage/set default)
- [x] Auto-load default preset on page visit

#### Export ✅
- [x] Export filtered trades to CSV
- [x] Export button in page header

---

## Phase 5: Trade Detail Enhancements

> **Priority:** MEDIUM | **Dependencies:** Phase 2 | **Estimate:** 2 weeks
>
> **Sub-plan:** [./plans/phase-5-trade-detail.md](./plans/phase-5-trade-detail.md)
>
> **Status:** ✅ Complete

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

#### 5.1 Trade Notes Image Support ✅ *(COMPLETED)*
- [x] S3 infrastructure (shared with Daily Journal)
- [x] Drag-and-drop image upload in Trade Notes tab
- [x] Paste image from clipboard
- [x] Inline image display in notes
- [x] Reuse Daily Journal's Tiptap image handling

*Note: Leverage existing `AttachmentUpload` patterns and S3 utilities from Daily Journal.*

#### 5.3 Daily Journal System ✅
- [x] Daily journal schema (dailyJournals table with checks, templates, attachments)
- [x] DailyChecklist component with template-based checks
- [x] ChecklistSettings modal for custom checklist items
- [x] JournalEditor with markdown shortcuts (Tiptap)
- [x] EditorToolbar component
- [x] AttachmentUpload + AttachmentGallery with S3 integration
- [x] TradesSummary component (shows day's trades in journal)
- [x] DailyJournalPreview integrated into trade detail page
- [x] Streak tracking and compliance stats UI
- [x] CalendarSidebar + DateNavigation components
- [x] Mobile sidebar with drag-and-drop
- [x] findOrCreateJournal helper (race condition handling)

**New files:**
- `src/app/(protected)/daily-journal/page.tsx`
- `src/components/daily-journal/` (11 components)
- `src/server/api/routers/dailyJournal.ts`
- `src/lib/s3.ts`

#### 5.4 Chart Integration
- [x] Lightweight-charts implementation (replaced TradingView widget)
- [x] Real OHLC data from cached market data service
- [x] Display entry/exit markers on chart (elegant arrows + circles)
- [x] Multiple timeframe toggle (1m, 5m, 15m, 30m, 1h with persistence)
- [x] OHLC snapping crosshair (snaps to nearest O/H/L/C value)
- [x] Fit-to-trade button (reset zoom to trade window)
- [x] Chart preferences persistence (timeframe + zoom via Zustand)

#### 5.6 Running P&L Chart ✅ *(NEW - COMPLETED)*
- [x] Extract shared running P&L utility (`src/lib/trades/running-pnl.ts`)
- [x] generateRunningPnlSeries() for charting P&L over time
- [x] RunningPnlChart component with AG Charts area chart
- [x] Split coloring: green (profit) / red (loss) fill
- [x] Execution markers: entry (chartreuse diamond), exit (ice blue circle)
- [x] Scale-in/out markers with distinct shapes and sizes
- [x] Integration with ContentPanel's "Running P&L" tab
- [x] Stop P&L calculation at trade exit for accuracy
- [x] Comprehensive integration tests (futures)

#### 5.5 MAE/MFE Per-Trade Analysis *(COMPLETED)*
- [x] Add `maePrice`, `mfePrice`, `maeAmount`, `mfeAmount`, `tradeEfficiency`, `marketDataQuality` fields to trades schema
- [x] Create `candle_cache` table for cross-user OHLC data deduplication
- [x] Twelve Data API integration for fetching OHLC during trade
- [x] Cache-first market data service (`src/lib/market-data-service.ts`)
- [x] Lazy MAE/MFE calculation on trade detail view
- [x] MAE/MFE stored permanently after calculation
- [x] Show efficiency % (captured P&L vs MFE)
- [x] Visual markers on chart (MAE/MFE extremes as dotted price lines)

---

## Phase 6: Daily Journal System ✅

> **Priority:** HIGH | **Dependencies:** Phase 1 | **Estimate:** 3 weeks
>
> **Sub-plan:** [./plans/prd-daily-journal.md](./plans/prd-daily-journal.md)
>
> **Status:** ✅ Complete (39 user stories)

### Goal
Daily journaling system with rich text editor, file uploads, checklists, and trade integration. Supersedes the original "Notebook System" concept.

### Completed Features

#### 6.1 Database Schema ✅
- [x] `dailyJournals` table (id, userId, date, content, contentFormat)
- [x] `dailyChecklistTemplates` table (user-defined checklist items)
- [x] `dailyChecklistChecks` table (daily check tracking)
- [x] `journalAttachments` table (S3 file references)

#### 6.2 tRPC Router ✅
- [x] `getByDate` - fetch/auto-create journal for date
- [x] `updateContent` - save journal content with upsert
- [x] `getRange` - fetch journals for calendar display
- [x] `getWithTrades` - journal + trades for context
- [x] Template CRUD (create, update, delete, reorder)
- [x] Check operations (toggle, bulk update)
- [x] `getStreak` - consecutive journaling days
- [x] `getComplianceStats` - checklist adherence metrics

#### 6.3 S3 Storage Integration ✅
- [x] Presigned upload URLs (`getUploadUrl`)
- [x] Upload confirmation (`confirmUpload`)
- [x] Attachment deletion with S3 cleanup
- [x] Inline image paste/drop in editor

#### 6.4 UI Components ✅
- [x] `/daily-journal` page with resizable panels
- [x] `DateNavigation` - prev/next/today/picker
- [x] `CalendarSidebar` - month grid with P&L colors
- [x] `DailyChecklist` - toggleable checklist with compliance %
- [x] `ChecklistSettings` - template management modal
- [x] `JournalEditor` - Tiptap with auto-save (500ms debounce)
- [x] `EditorToolbar` - formatting buttons
- [x] `AttachmentUpload` - drag-drop with progress
- [x] `AttachmentGallery` - grid view with lightbox
- [x] `TradesSummary` - day's trades with P&L
- [x] `DailyJournalPreview` - compact view for trade detail

#### 6.5 Editor Features ✅
- [x] Markdown shortcuts (#, **, *, -, 1., >)
- [x] Bold, italic, strikethrough, headings
- [x] Bullet and ordered lists
- [x] Link insertion
- [x] Image paste/drop with S3 upload

#### 6.6 Gamification ✅
- [x] Journaling streak (consecutive days)
- [x] Checklist compliance percentage
- [x] Visual indicators (flame icon, progress bar)

#### 6.7 Future Enhancement
- [ ] Full-text search across journal entries (PostgreSQL `tsvector`)

---

## Phase 7: Trade Replay

> **Priority:** LOW | **Dependencies:** Phase 4 | **Estimate:** 3-4 weeks
>
> **Sub-plan:** [./plans/phase-7-replay.md](./plans/phase-7-replay.md)
>
> **Status:** ✅ Complete

### Goal
Tick-by-tick trade replay functionality.

### Tasks

#### 7.1 Historical Data Integration
- [x] Market data provider integration (Databento for futures)
- [x] Data fetching and caching (existing market data service)
- [x] Support for futures instruments
- [x] Handle different data granularities (1m, 5m, 15m, 30m, 1h aggregation)

#### 7.2 Replay Engine
- [x] Replay player component (`TradeReplay`, `useReplayEngine` hook)
- [x] Play/pause controls
- [x] Variable speed (1x, 2x, 5x, 10x)
- [x] Timeline scrubber (Shadcn Slider)
- [x] Jump forward/backward by candle interval
- [x] Reset to start button
- [x] Speed preferences persistence (Zustand store)

#### 7.3 Replay Visualization
- [x] Candlestick chart renderer (lightweight-charts)
- [x] Trade markers on chart (entry arrows, exit circles, scale-in/out)
- [x] Time & Sales panel component
- [x] Real-time running P&L during replay (proper futures calculations)
- [x] SL/TP price lines on chart
- [x] Chart zoom/position preserved during playback

---

## Phase 8: Broker Integrations

> **Priority:** MEDIUM | **Dependencies:** None | **Estimate:** 1-2 weeks per parser
>
> **Sub-plan:** [./plans/phase-8-brokers.md](./plans/phase-8-brokers.md)

### Goal
Direct broker connections for auto-sync.

### Tasks

#### 8.1 CSV Parser Expansion
- [x] ProjectX parser *(fully implemented)*
- [ ] NinjaTrader parser
- [ ] cTrader parser
- [ ] TradingView parser
- [ ] Tradovate parser
- [ ] Rithmic parser
- [ ] Topstep parser
- [ ] Apex parser

**Files to modify:**
- `src/lib/csv-parsers/`

#### 8.2 Direct API Integrations (Future)
- [ ] OAuth flow for brokers
- [ ] Scheduled sync jobs
- [ ] Real-time trade detection
- [ ] Connection status UI

**Priority brokers:**
1. Interactive Brokers
2. TradingView
3. Tradovate
4. NinjaTrader

---

## Phase 9: Mobile Optimization

> **Priority:** LOW | **Dependencies:** None | **Estimate:** 2 weeks
>
> **Status:** ✅ Complete — Responsive design implemented across all pages.

---

## Phase 10: AI Analytics (Core Differentiator)

> **Priority:** HIGHEST | **Dependencies:** Phase 3 | **Estimate:** 10-15 weeks
>
> **Sub-plan:** [./plans/phase-10-ai-analytics.md](./plans/phase-10-ai-analytics.md), [./plans/prd-ai-analytics.md](./plans/prd-ai-analytics.md), [./plans/prd-mdx-report-viewer-emails.md](./plans/prd-mdx-report-viewer-emails.md), [./plans/prd-ai-ui-redesign.md](./plans/prd-ai-ui-redesign.md)
>
> **Status:** ✅ Complete

### Goal
Deep AI-powered analysis. Users ask ANY question via chat or get professional-grade reports with interactive charts. This is the core differentiator over TradeZella.

### Completed Features

#### AI Infrastructure ✅
- [x] OpenRouter integration (model flexibility — Kimi K2 for chat, GLM-5 for reports)
- [x] AI service with streaming and non-streaming support
- [x] `aiConversations`, `aiMessages`, `aiReports` tables
- [x] Schema context generator (auto-documents all tables, columns, relationships)
- [x] User context builder (loads strategies, tags, sessions, accounts, journals)
- [x] Trading analyst system prompt (chat + report modes)

#### AI Tools ✅
- [x] `run_query` — read-only SQL with automatic user scoping
- [x] `call_analytics` — invoke 22+ tRPC analytics endpoints
- [x] `get_market_data` — fetch OHLC candle data
- [x] `run_python` — Python sandbox execution (pandas, matplotlib, etc.)
- [x] `store_report_data` — register datasets for MDX component rendering
- [x] Tool registry with mode-aware selection (chat vs report)

#### Chat Mode ✅
- [x] Multi-turn tool-calling conversation loop
- [x] Streaming responses
- [x] Conversation CRUD (create, list, delete)
- [x] Polished chat UI with typewriter effect, tool badges, mobile drawer
- [x] Suggested queries for empty state

#### Report Mode ✅
- [x] Trigger.dev background task for long-running reports (30min timeout, 20 tool rounds)
- [x] MDX report viewer at `/ai/reports/[reportId]` (replaces PDF pipeline)
- [x] 12 interactive chart components via MDX (EquityCurve, MonthlyChart, HourHeatmap, etc.)
- [x] Display components (MetricCard, MetricGrid, Callout, DataTable, ChartImage)
- [x] Data artifacts stored as JSONB, hydrated via React context
- [x] Client-side PDF export (html2canvas + jsPDF)
- [x] Print and share functionality
- [x] Granular progress tracking (real pipeline stages, not fake percentages)
- [x] Report history with status badges

#### Email System ✅
- [x] React Email system in `src/emails/` with Terminal-themed base layout
- [x] Report completion email with viewer link (permanent, no expiring URLs)
- [x] Resend integration for delivery

#### AI UI Redesign ✅
- [x] Polished chat interface (empty state, message layout, tool badges, input area)
- [x] Typewriter streaming effect with blinking cursor
- [x] Mobile sidebar drawer
- [x] Mode toggle (Chat / Reports) with active indicator
- [x] Enhanced message renderer (code blocks, tables, images, blockquotes)
- [x] Report form with quick date presets and suggested prompts
- [x] Report history panel with real progress tracking

---

## Phase 11: Payments & Billing

> **Priority:** HIGHEST | **Dependencies:** None | **Estimate:** 3-5 days
>
> **Status:** ⏳ Pending

### Goal
Monetize EdgeJournal with a simple Free → Pro subscription model using Clerk Billing (built on Stripe). Launch with unlimited AI for paid users, add caps later only if needed.

### Pricing

| | Free | Pro ($24/mo · $199/yr) |
|---|------|------------------------|
| AI Chat | No | Unlimited |
| AI Reports | No | Unlimited |
| Trades | 25/month | Unlimited |
| Accounts | 1 | Unlimited |
| Analytics | Overview tab only | All 5 tabs |
| Daily Journal | No | Yes |
| Trade Replay | No | Yes |
| CSV Export | No | Yes |

### Cost Analysis
- AI costs per user: $0.86 (light) – $4.28 (heavy) per month
- Kimi K2 for chat, GLM-5 for reports — 90%+ margins at $24/mo
- Infrastructure (DB, email, storage) covered by free tiers
- Transaction fees: Stripe 2.9% + $0.30 + Clerk Billing 0.7% (same as Stripe Billing)

### Tasks

#### 11.1 Clerk Billing Setup
- [ ] Connect Stripe account in Clerk Dashboard
- [ ] Create "Free" plan with feature flags
- [ ] Create "Pro" plan at $24/mo and $199/yr
- [ ] Define feature flags: `ai_chat`, `ai_reports`, `unlimited_trades`, `full_analytics`, `daily_journal`, `trade_replay`, `csv_export`

#### 11.2 Feature Gating — Middleware & Server
- [ ] Update `src/middleware.ts` — gate `/ai` routes behind Pro plan
- [ ] Add `has({ plan: 'pro' })` checks to AI tRPC router
- [ ] Add trade count enforcement for free tier (25/month limit)
- [ ] Gate analytics tabs (free = Overview only)
- [ ] Gate daily journal, trade replay, CSV export routes
- [ ] Add `<Protect plan="pro">` wrappers on client-side UI where needed

#### 11.3 Pricing Page
- [ ] Create `/pricing` page with `<PricingTable />` component
- [ ] Terminal design styling (dark bg, monospace, chartreuse accents)
- [ ] Annual/monthly toggle
- [ ] Feature comparison list
- [ ] CTA from free tier upgrade prompts → pricing page

#### 11.4 Free Tier Upgrade Prompts
- [ ] AI page: show upgrade prompt instead of chat/report interface
- [ ] Trade limit: show "25/25 trades used this month — upgrade for unlimited"
- [ ] Analytics: locked tab indicators with upgrade CTA
- [ ] Journal/Replay: upgrade gate with preview of what they're missing

#### 11.5 Grandfather Early Users
- [ ] Identify existing beta users
- [ ] Assign Pro plan via Clerk Backend API (custom $0 price or extended trial)
- [ ] Ensure existing users retain full access

#### 11.6 Billing Management
- [ ] Add billing section to `/settings` page
- [ ] Show current plan, next billing date, manage subscription link
- [ ] Cancel/downgrade flow (Clerk handles this, just link to portal)

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

-- Daily Journal ✅ IMPLEMENTED (Phase 6)
dailyJournals (id, userId, date, content, contentFormat, createdAt, updatedAt)
dailyChecklistTemplates (id, userId, text, order, isActive, createdAt)
dailyChecklistChecks (journalId, templateId, checked, checkedAt) -- composite PK
journalAttachments (id, journalId, url, key, filename, mimeType, size, caption, createdAt)

-- Dashboard
dashboard_layouts (id, userId, name, layout, isDefault, createdAt, updatedAt)

-- Filter Presets ✅ IMPLEMENTED (Phase 4)
filter_presets (id, userId, name, filters, createdAt)
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
| 2 | Strategy System | 2 weeks | ✅ Complete (2.5 Monte Carlo ⏳) |
| 3 | Dashboard Customization | — | ❌ Scrapped |
| 4 | Advanced Analytics | 6-8 weeks | ✅ Complete (5 tabs + cross-filtering + query builder + presets + export) |
| 5 | Trade Detail Enhancements | 2 weeks | ✅ Complete |
| 6 | Daily Journal System | 3 weeks | ✅ Complete (39 stories, search ⏳) |
| 7 | Trade Replay | 3-4 weeks | ✅ Complete |
| 8 | Broker Integrations | 1-2 weeks per parser | ⏳ Pending (ProjectX done, others pending) |
| 9 | Mobile Optimization | 2 weeks | ✅ Complete |
| 10 | AI Analytics (Core Differentiator) | 10-15 weeks | ✅ Complete (chat + MDX reports + email + UI redesign) |
| **11** | **Payments & Billing** | **3-5 days** | **⏳ Next up** |

**8 of 9 original phases complete. Phase 11 (Payments via Clerk Billing) is next.**

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

