# Market Data Architecture

> **Last Updated:** December 30, 2025
>
> **Purpose:** Document the architecture for fetching, caching, and using market data (OHLC bars) for chart visualization, MAE/MFE analysis, and future AI features.

---

## Table of Contents

- [Overview](#overview)
- [Data Providers](#data-providers)
- [Problem Statement](#problem-statement)
- [Architecture Decisions](#architecture-decisions)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Cost Analysis](#cost-analysis)
- [Future Considerations](#future-considerations)

---

## Overview

EdgeJournal needs market data (OHLC bars) for three main use cases:

1. **Chart Visualization** — Display candlestick charts on trade detail pages
2. **MAE/MFE Analysis** — Calculate Maximum Adverse/Favorable Excursion during trades
3. **Future AI Analysis** — Pattern recognition, trade quality scoring, etc.

The challenge: external market data APIs charge per request, and at scale (1000 users × 5 trades/day = 10K+ daily requests), costs would be prohibitive ($300-500/month).

**Solution:** Cache-first architecture with cross-user deduplication and dual-provider support.

---

## Data Providers

We use **two data providers** to cover all instrument types:

| Provider | Instruments | Use Case |
|----------|-------------|----------|
| **Databento** | CME Futures (ES, NQ, MNQ, MES, etc.), NYMEX, COMEX, CBOT | Index futures, energy, metals, rates, agriculture |
| **Twelve Data** | Forex pairs, Crypto, Commodities (XAU, XAG) | EUR/USD, GBP/USD, BTC/USD, etc. |

### Provider Routing

The `market-data-service.ts` automatically routes requests to the appropriate provider:

```typescript
// Futures → Databento (continuous contracts)
MNQ → MNQ.v.0  // volume-based roll, front month
ES  → ES.v.0
CL  → CL.v.0
GC  → GC.v.0

// Forex/Crypto → Twelve Data
EUR/USD, GBP/USD, USD/JPY, XAU/USD, etc.
```

### Databento Continuous Contract Format

We use Databento's continuous contract symbology: `[ROOT].[ROLL_RULE].[RANK]`
- **v** = volume-based roll (follows liquidity) - **recommended**
- **c** = calendar-based roll (nearest expiration)
- **n** = open interest-based roll
- **0** = front month, 1 = second month, etc.

Example: `ES.v.0` = E-mini S&P 500, volume-based roll, front month

See: https://databento.com/docs/standards-and-conventions/symbology

### Environment Variables

```env
DATABENTO_API_KEY="db-..."      # For futures data
TWELVE_DATA_API_KEY="..."       # For forex/crypto data
```

---

## Problem Statement

### Cost Without Caching

```
1,000 users × 5 trades viewed/day = 5,000 trade views
Each trade view needs OHLC data = 5,000+ API calls/day
At $0.001-0.003 per call = $150-450/month just for viewing trades
```

### Key Insight

Historical market data is **immutable**. ES futures prices on December 15, 2024 will never change. This means:

1. We can cache indefinitely (no TTL needed)
2. Multiple users trading the same symbol on the same day share the same data
3. Once fetched, data never needs to be re-fetched

---

## Architecture Decisions

### 1. Cache Location: PostgreSQL (not Redis)

**Why PostgreSQL over Redis?**

| Factor | PostgreSQL | Redis |
|--------|------------|-------|
| Already in stack | ✅ Yes | ❌ No (new infra) |
| Cost | Free (existing) | $15-50/month |
| Persistence | ✅ Built-in | ⚠️ Needs config |
| Query flexibility | ✅ Full SQL | ❌ Limited |
| Storage size concern | ~1-2GB for 3 years | Same |

**Latency:** PostgreSQL query for cached data: ~5-20ms. Acceptable for our use case.

**Future Migration:** Data structure is simple (JSON blob). Easy to migrate to Redis later if needed.

### 2. Cache Key Design

```
(symbol, interval, date) → OHLC bars for that day
```

- **symbol:** "ES", "EUR/USD", "NQ", etc.
- **interval:** "1min", "5min", "15min", "1h"
- **date:** Start of day (UTC), e.g., `2024-12-15T00:00:00Z`

One row = one day of bars for one symbol at one interval.

### 3. Compute-on-Close vs Lazy Loading

**Chosen: Lazy Loading (compute on first view)**

| Approach | Pros | Cons |
|----------|------|------|
| Compute-on-close | Data ready immediately | API cost on every import |
| Lazy loading | Only pay for viewed trades | First view slightly slower |

Most traders don't review every single trade. Lazy loading means we only fetch data for trades that are actually viewed.

### 4. MAE/MFE Storage Strategy

**Store computed results permanently** in the `trades` table:

```
maePrice, mfePrice, maeAmount, mfeAmount, tradeEfficiency, marketDataQuality
```

After calculation:
- Results stored on the trade record
- OHLC bars stay in cache (shared with other users)
- Subsequent views are instant (no recalculation)

---

## Data Flow

### Chart Visualization Flow

```
┌─────────────────┐
│  Trade Detail   │
│     Page        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ marketData.     │
│ getChartData    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ market-data-    │
│ service.ts      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Cache │ │Twelve │
│  Hit  │ │ Data  │
│       │ │  API  │
└───┬───┘ └───┬───┘
    │         │
    │    ┌────┘
    │    ▼
    │ ┌───────┐
    │ │ Store │
    │ │ Cache │
    │ └───┬───┘
    │     │
    └──┬──┘
       ▼
┌─────────────────┐
│ Return OHLC     │
│ bars to client  │
└─────────────────┘
```

### MAE/MFE Calculation Flow

```
┌─────────────────┐
│ View Closed     │
│ Trade Detail    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check: has      │
│ marketDataQuality? │
└────────┬────────┘
         │
    ┌────┴────┐
    │ No      │ Yes
    ▼         ▼
┌───────┐ ┌───────┐
│Trigger│ │ Show  │
│ calc  │ │ cached│
│ mut.  │ │ data  │
└───┬───┘ └───────┘
    │
    ▼
┌─────────────────┐
│ Fetch OHLC from │
│ cache/API       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │
│ MAE/MFE metrics │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store results   │
│ on trade record │
└─────────────────┘
```

---

## Database Schema

### `candle_cache` Table

```sql
CREATE TABLE candle_cache (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,           -- "ES", "EUR/USD"
  interval TEXT NOT NULL,         -- "1min", "5min", "15min", "1h"
  date TIMESTAMPTZ NOT NULL,      -- Day of data (UTC start of day)
  bars TEXT NOT NULL,             -- JSON array of OHLC bars
  bar_count INTEGER NOT NULL,     -- Number of bars in JSON
  source TEXT NOT NULL,           -- "twelve_data", "polygon"
  fetched_at TIMESTAMPTZ NOT NULL,
  
  UNIQUE(symbol, interval, date)  -- Cache lookup key
);

CREATE INDEX candle_cache_symbol_idx ON candle_cache(symbol);
```

### OHLC Bar JSON Format

```json
[
  {
    "timestamp": 1703116800000,
    "open": 4780.25,
    "high": 4781.50,
    "low": 4779.00,
    "close": 4780.75
  },
  ...
]
```

### `trades` Table Additions

```sql
ALTER TABLE trades ADD COLUMN mae_price DECIMAL(20, 8);
ALTER TABLE trades ADD COLUMN mfe_price DECIMAL(20, 8);
ALTER TABLE trades ADD COLUMN mae_amount DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN mfe_amount DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN trade_efficiency DECIMAL(5, 2);
ALTER TABLE trades ADD COLUMN market_data_quality data_quality;

-- Enum for data quality
CREATE TYPE data_quality AS ENUM ('full', 'partial', 'unavailable', 'pending');
```

---

## API Endpoints

### tRPC Routes

#### `marketData.getChartData`

Fetch OHLC data for chart visualization.

```typescript
input: {
  symbol: string,
  interval: "1min" | "5min" | "15min" | "1h",
  startTime: Date,
  endTime: Date
}

output: {
  bars: OHLCBar[],
  dataQuality: "full" | "partial" | "unavailable"
}
```

#### `trades.calculateMAEMFE`

Calculate and store MAE/MFE for a single trade.

```typescript
input: { tradeId: number }

output: Trade // Updated trade with MAE/MFE fields
```

#### `trades.bulkCalculateMAEMFE`

Calculate MAE/MFE for multiple trades (background job).

```typescript
input: { tradeIds: number[] }

output: { 
  processed: number,
  failed: number,
  errors: string[]
}
```

---

## Cost Analysis

### API Costs

#### Databento (Futures)

| Tier | Pricing Model | Notes |
|------|---------------|-------|
| Pay-as-you-go | ~$0.01-0.05 per query | Based on data volume |
| Historical data | Priced per symbol/day | CME Globex dataset |

#### Twelve Data (Forex/Crypto)

| Plan | Requests/day | Monthly Cost |
|------|--------------|--------------|
| Free | 800 | $0 |
| Basic | 8,000 | $12/month |
| Pro | 100,000 | $79/month |

### With Caching (1,000 users, 5 trades/day)

**Assumptions:**
- 80% of trades are on popular symbols (already cached)
- 20% are unique symbol/date combinations
- Average trade spans 1-2 days of data

**Daily API calls needed:**
```
5,000 trade views × 20% unique × 1.5 days = ~1,500 API calls/day
```

But with cross-user deduplication:
```
If 100 users trade ES on the same day, that's 1 API call, not 100.
Realistic: ~50-100 unique API calls/day
```

**Monthly cost estimates:**
- Twelve Data (forex): ~$0-12 (Free tier or Basic plan)
- Databento (futures): ~$5-20 depending on volume

### Storage Costs

**Per day of data:**
- 1-minute bars: ~390 bars × 50 bytes = ~20 KB
- 5-minute bars: ~78 bars × 50 bytes = ~4 KB

**For 100 symbols × 3 years:**
```
100 symbols × 1,095 days × 20 KB = ~2.2 GB
```

**PostgreSQL storage cost:** Negligible (included in existing hosting)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/market-data-service.ts` | Cache-first OHLC fetching with dual-provider support |
| `src/lib/symbols.ts` | Symbol mappings for Databento and Twelve Data |
| `src/lib/trade-calculations.ts` | MAE/MFE calculation logic |
| `src/server/db/schema.ts` | `candle_cache` table + trade fields |
| `src/server/api/routers/marketData.ts` | tRPC endpoints for chart data |
| `src/server/api/routers/trades.ts` | MAE/MFE calculation endpoints |
| `src/components/trade-detail/tradingview-chart.tsx` | Chart component using cached data |
| `src/app/(protected)/journal/[id]/page.tsx` | Lazy MAE/MFE trigger |

---

## Future Considerations

### 1. Redis Migration

If query latency becomes an issue (unlikely), migrate hot data to Redis:

```typescript
// Same interface, different backend
const cached = await redis.get(`ohlc:${symbol}:${interval}:${date}`);
```

### 2. Background Pre-fetching

For popular symbols, pre-cache recent data:

```typescript
// Daily cron job
const popularSymbols = ["ES", "NQ", "EUR/USD", "GBP/USD"];
for (const symbol of popularSymbols) {
  await prefetchLastNDays(symbol, 30);
}
```

### 3. Real-time Data for Open Trades

Current architecture is for **closed trades** only. For live P&L on open trades:

- WebSocket connection to data provider
- Temporary in-memory storage (Redis pub/sub)
- Different cost model (subscription-based)

### 4. AI Analysis Integration

The cached OHLC data can power:
- Pattern recognition (head & shoulders, double tops, etc.)
- Trade quality scoring
- Entry/exit timing analysis
- Correlation with market conditions

Data is already available; just needs ML pipeline.

---

## Troubleshooting

### "No market data available"

1. Check if symbol is supported in `src/lib/symbols.ts`
2. For futures: Verify `DATABENTO_API_KEY` in `.env`
3. For forex: Verify `TWELVE_DATA_API_KEY` in `.env`
4. Check API rate limits

### "Databento API error"

1. Verify API key is valid and has sufficient credits
2. Check symbol format (should be like `ES.FUT`, `MNQ.FUT`)
3. Ensure date is a valid trading day (not weekend/holiday)

### "Twelve Data API error"

1. Check API rate limits (free tier: 8 requests/minute)
2. Verify symbol is a forex/crypto pair, not a futures contract
3. Check if market was open on the requested date

### Slow first load

Expected behavior for cache miss. Subsequent views will be instant.

### Data quality "partial"

Trade spans multiple days but some days have no market data (weekend, holiday).

### Data quality "unavailable"

Symbol not supported by either provider, or API error. Chart will show TradingView widget fallback.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-30 | Added Databento integration for futures data |
| 2024-12-29 | Initial architecture implementation |
