# Phase 5: Trade Detail Enhancements

> **Parent:** [../ROADMAP.md](../ROADMAP.md)
>
> **Priority:** MEDIUM | **Dependencies:** Phase 2 | **Estimate:** 2 weeks
>
> **Status:** 🔄 In Progress

---

## Overview

Enhance the trade detail page with MAE/MFE analysis, chart integration, daily trades sidebar, working screenshot uploads, and daily notes system.

---

## Completed Work

### 5.0 TradeZella-Style Layout ✅
- Two-panel resizable layout (react-resizable-panels v2 + shadcn)
- Left panel: Stats, Strategy, Executions, Attachments tabs
- Right panel: Chart, Notes, Running P&L tabs
- Panel sizes persist to localStorage
- Risk Management section (TP/SL/Trailing Stop/Exit Reason)
- Trade Context section (Setup Type, Emotional State)
- Calculated stats: Points, Ticks, R-Multiple, ROI, Duration

### 5.5 MAE/MFE Per-Trade Analysis ✅ (December 29, 2025)

**Architecture Implemented:**

#### Database Schema
- Added `candle_cache` table for cross-user OHLC data deduplication
  - Composite unique index on (symbol, interval, date)
  - Stores JSON array of OHLC bars per day
  - Permanent storage (no TTL) - historical data doesn't change
- Added MAE/MFE fields to `trades` table:
  - `mae_price` - worst price during trade
  - `mfe_price` - best price during trade  
  - `mae_amount` - max adverse $ amount
  - `mfe_amount` - max favorable $ amount
  - `trade_efficiency` - MFE capture percentage
  - `market_data_quality` - enum: 'full' | 'partial' | 'unavailable' | 'pending'

#### Market Data Service (`src/lib/market-data-service.ts`)
- Cache-first architecture for fetching OHLC data
- Twelve Data API integration as primary data source
- Cross-user deduplication (shared candle cache)
- Automatic caching after API fetch
- `getOHLCBars(symbol, interval, date)` - single day fetch
- `getOHLCForTimeRange(symbol, interval, start, end)` - multi-day aggregation

#### Trade Calculations (`src/lib/trade-calculations.ts`)
- `calculateMAEMFE()` - computes MAE/MFE metrics from OHLC bars
- `analyzePostExit()` - analyzes price action after exit
- Supports both futures and forex with proper point values

#### tRPC Endpoints
- `trades.calculateMAEMFE` - calculate for single trade
- `trades.bulkCalculateMAEMFE` - bulk calculation for multiple trades
- `trades.getTradesNeedingMAEMFE` - find trades without data
- `marketData.getChartData` - fetch chart data for visualization
- `marketData.getCacheStats` - cache statistics

#### Lazy Loading Implementation
- MAE/MFE calculated on-demand when viewing trade detail
- Auto-trigger when viewing closed trade without `marketDataQuality`
- Results stored permanently (no re-calculation needed)
- Background operation - doesn't block page load

### 5.4 Chart Integration (Partial) ✅
- Lightweight-charts implementation (replaced TradingView widget)
- Real OHLC data from cached market data service
- Fallback to mock data if real data unavailable

---

## Sprint Breakdown

### Sprint 5.1: Daily Trades Sidebar ⏳

*To be detailed when starting this phase.*

### Sprint 5.2: Screenshot Uploads ⏳

*To be detailed when starting this phase.*

### Sprint 5.3: Daily Notes System ⏳

*To be detailed when starting this phase.*

### Sprint 5.4: Chart Integration Remaining ⏳
- [ ] Display entry/exit markers on chart
- [ ] Multiple timeframe toggle
- [ ] Chart annotation tools
- [ ] MAE/MFE visual markers (high/low extremes)

---

## Files Created/Modified

### New Files
- `src/lib/market-data-service.ts` - Cache-first OHLC fetching
- `drizzle/0002_bright_jamie_braddock.sql` - Migration for schema changes

### Modified Files
- `src/server/db/schema.ts` - Added `candle_cache` table and MAE/MFE fields
- `src/server/api/routers/trades.ts` - Added MAE/MFE calculation endpoints
- `src/server/api/routers/marketData.ts` - Added chart data and cache stats endpoints
- `src/lib/trade-calculations.ts` - Added MAE/MFE calculation functions
- `src/components/trade-detail/tradingview-chart.tsx` - Real OHLC data integration
- `src/app/(protected)/journal/[id]/page.tsx` - Lazy MAE/MFE trigger

---

## Cost Analysis

**Estimated API costs for 1000 users, 5 trades/day:**
- Without caching: ~10,000+ API calls/day = ~$300-500/month
- With caching: ~50-100 API calls/day = ~$1.50-3/month (97% reduction)

**Storage costs:**
- Candle cache for 3 years of popular symbols: ~1-2 GB in PostgreSQL
- Negligible cost vs. API savings

---

## Notes

- MAE/MFE is calculated lazily on first view, then permanently stored
- Cross-user deduplication means if User A and User B trade ES on the same day, OHLC data is fetched only once
- No TTL on cache - historical market data is immutable
- Easy to migrate to Redis in future if needed (same data structure)
