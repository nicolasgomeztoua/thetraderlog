# Market Data Architecture Reference

> Detailed reference for the market data system. For an overview, see [SKILL.md](./SKILL.md).

---

## Table of Contents

- [Data Providers](#data-providers)
- [Cache Architecture](#cache-architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Cost Analysis](#cost-analysis)
- [Implementation Details](#implementation-details)
- [Troubleshooting](#troubleshooting)
- [Future Roadmap](#future-roadmap)

---

## Data Providers

### Dual-Provider Strategy

EdgeJournal uses two data providers to cover all instrument types:

| Provider | Instruments | API Key Env Var |
|----------|-------------|-----------------|
| **Databento** | CME Futures (ES, NQ, MNQ, MES), NYMEX, COMEX, CBOT | `DATABENTO_API_KEY` |
| **Twelve Data** | Forex pairs, Crypto, Commodities (XAU, XAG) | `TWELVE_DATA_API_KEY` |

### Databento Configuration

#### Continuous Contract Symbology

We use Databento's continuous contract format: `[ROOT].[ROLL_RULE].[RANK]`

| Roll Rule | Meaning | Use Case |
|-----------|---------|----------|
| `v` | Volume-based roll (follows liquidity) | **Recommended** for most cases |
| `c` | Calendar-based roll (nearest expiration) | Expiration-based analysis |
| `n` | Open interest-based roll | Less common |

| Rank | Meaning |
|------|---------|
| `0` | Front month (most traded) |
| `1` | Second month |
| `2` | Third month |

**Examples:**
- `ES.v.0` = E-mini S&P 500, volume-based roll, front month
- `MNQ.v.0` = Micro E-mini Nasdaq, volume-based roll, front month
- `CL.v.0` = Crude Oil, volume-based roll, front month

Documentation: https://databento.com/docs/standards-and-conventions/symbology

#### Symbol Mappings

Defined in `src/lib/symbols.ts`:

```typescript
// User symbol → Databento continuous contract
const DATABENTO_MAPPINGS = {
  'ES': 'ES.v.0',
  'MES': 'MES.v.0',
  'NQ': 'NQ.v.0',
  'MNQ': 'MNQ.v.0',
  'CL': 'CL.v.0',
  'GC': 'GC.v.0',
  'ZB': 'ZB.v.0',
  'ZN': 'ZN.v.0',
  // ... see symbols.ts for full list
};
```

### Twelve Data Configuration

#### Supported Instruments

- **Forex**: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, etc.
- **Crypto**: BTC/USD, ETH/USD, etc.
- **Commodities**: XAU/USD (Gold), XAG/USD (Silver)

#### Rate Limits

| Plan | Requests/Minute | Requests/Day | Monthly Cost |
|------|-----------------|--------------|--------------|
| Free | 8 | 800 | $0 |
| Basic | 60 | 8,000 | $12 |
| Pro | 800 | 100,000 | $79 |

---

## Cache Architecture

### Why PostgreSQL Over Redis

| Factor | PostgreSQL | Redis |
|--------|------------|-------|
| Already in stack | Yes | No (new infra) |
| Cost | Free (existing) | $15-50/month |
| Persistence | Built-in | Needs config |
| Query flexibility | Full SQL | Limited |
| Typical latency | 5-20ms | 1-5ms |

**Decision:** PostgreSQL is sufficient. Cache queries are simple lookups, and 5-20ms latency is acceptable. Easy to migrate to Redis later if needed.

### Cache Key Design

```
PRIMARY KEY: (symbol, interval, date)
```

- **symbol**: Normalized symbol name ("ES", "EUR/USD")
- **interval**: Bar timeframe ("1min", "5min", "15min", "1h")
- **date**: Start of day in UTC (e.g., `2024-12-15T00:00:00Z`)

One database row = one day of OHLC bars for one symbol at one interval.

### Cross-User Deduplication

Historical data is **immutable**. ES futures prices on December 15, 2024 will never change.

**Impact:**
- If 100 users trade ES on the same day → 1 API call (not 100)
- Data fetched once is shared across all users
- No TTL needed (data never expires)

### Lazy Loading Strategy

```
┌─────────────────────────────────────────────────────┐
│ Approach Comparison                                  │
├─────────────────┬──────────────┬────────────────────┤
│                 │ Compute-on-  │ Lazy Loading       │
│                 │ close        │ (CHOSEN)           │
├─────────────────┼──────────────┼────────────────────┤
│ Data ready      │ Immediately  │ On first view      │
│ API cost        │ Every import │ Only viewed trades │
│ Best for        │ Review all   │ Review some        │
└─────────────────┴──────────────┴────────────────────┘
```

Most traders don't review every trade. Lazy loading means we only pay for data that's actually viewed.

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
  source TEXT NOT NULL,           -- "twelve_data", "databento"
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
  {
    "timestamp": 1703116860000,
    "open": 4780.75,
    "high": 4782.00,
    "low": 4780.50,
    "close": 4781.25
  }
]
```

### Trade MAE/MFE Fields

```sql
-- Added to trades table
ALTER TABLE trades ADD COLUMN mae_price DECIMAL(20, 8);
ALTER TABLE trades ADD COLUMN mfe_price DECIMAL(20, 8);
ALTER TABLE trades ADD COLUMN mae_amount DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN mfe_amount DECIMAL(20, 2);
ALTER TABLE trades ADD COLUMN trade_efficiency DECIMAL(5, 2);
ALTER TABLE trades ADD COLUMN market_data_quality data_quality;

-- Enum for data quality
CREATE TYPE data_quality AS ENUM ('full', 'partial', 'unavailable', 'pending');
```

**Data Quality States:**

| State | Meaning |
|-------|---------|
| `full` | Complete OHLC data for entire trade duration |
| `partial` | Some data missing (weekend, holiday gaps) |
| `unavailable` | Symbol not supported or API error |
| `pending` | Calculation in progress |

---

## API Endpoints

### tRPC: `marketData.getChartData`

Fetch OHLC data for chart visualization.

```typescript
// Input
{
  symbol: string,
  interval: "1min" | "5min" | "15min" | "1h",
  startTime: Date,
  endTime: Date
}

// Output
{
  bars: OHLCBar[],
  dataQuality: "full" | "partial" | "unavailable"
}
```

**Flow:**
1. Normalize date range to day boundaries
2. Check cache for each day
3. Fetch missing days from appropriate provider
4. Store fetched data in cache
5. Return aggregated bars

### tRPC: `trades.calculateMAEMFE`

Calculate and store MAE/MFE for a single trade.

```typescript
// Input
{ tradeId: number }

// Output
Trade // Updated trade with MAE/MFE fields populated
```

**Flow:**
1. Load trade with entry/exit times
2. Fetch OHLC bars for trade duration
3. Calculate MAE (lowest point for longs, highest for shorts)
4. Calculate MFE (highest point for longs, lowest for shorts)
5. Calculate trade efficiency: `actualP&L / MFE * 100`
6. Store results on trade record

### tRPC: `trades.bulkCalculateMAEMFE`

Calculate MAE/MFE for multiple trades (background job).

```typescript
// Input
{ tradeIds: number[] }

// Output
{
  processed: number,
  failed: number,
  errors: string[]
}
```

---

## Cost Analysis

### Problem: API Costs at Scale

```
Without caching:
1,000 users × 5 trades viewed/day = 5,000 trade views
Each trade view needs OHLC data = 5,000+ API calls/day
At $0.001-0.003 per call = $150-450/month
```

### Solution: Cache + Deduplication

**Assumptions:**
- 80% of trades are on popular symbols (already cached)
- 20% are unique symbol/date combinations
- Average trade spans 1-2 days of data

**Daily API calls with caching:**
```
5,000 trade views × 20% unique × 1.5 days = ~1,500 potential API calls

But with cross-user deduplication:
If 100 users trade ES on the same day = 1 API call, not 100

Realistic: ~50-100 unique API calls/day
```

### Monthly Cost Estimates

| Component | Cost |
|-----------|------|
| Twelve Data (forex) | $0-12 (Free or Basic plan) |
| Databento (futures) | $5-20 depending on volume |
| PostgreSQL storage | Included in existing hosting |
| **Total** | **~$5-32/month** |

### Storage Requirements

```
Per day of data:
- 1-minute bars: ~390 bars × 50 bytes = ~20 KB
- 5-minute bars: ~78 bars × 50 bytes = ~4 KB

For 100 symbols × 3 years:
100 × 1,095 days × 20 KB = ~2.2 GB
```

---

## Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/market-data-service.ts` | Cache-first OHLC fetching with dual-provider support |
| `src/lib/symbols.ts` | Symbol mappings for Databento and Twelve Data |
| `src/lib/trade-calculations.ts` | MAE/MFE calculation logic |
| `src/server/db/schema.ts` | `candle_cache` table + trade MAE/MFE fields |
| `src/server/api/routers/marketData.ts` | tRPC endpoints for chart data |
| `src/server/api/routers/trades.ts` | MAE/MFE calculation endpoints |
| `src/components/trade-detail/tradingview-chart.tsx` | Chart component using cached data |
| `src/app/(protected)/journal/[id]/page.tsx` | Lazy MAE/MFE trigger on trade view |

### Provider Routing Logic

```typescript
// In market-data-service.ts
function getProvider(symbol: string): 'databento' | 'twelve_data' {
  // Futures contracts → Databento
  if (isFuturesSymbol(symbol)) {
    return 'databento';
  }
  // Everything else → Twelve Data
  return 'twelve_data';
}

function isFuturesSymbol(symbol: string): boolean {
  const FUTURES = ['ES', 'MES', 'NQ', 'MNQ', 'CL', 'GC', 'ZB', 'ZN', 'RTY', 'YM'];
  return FUTURES.includes(symbol.toUpperCase());
}
```

### Cache Lookup Pattern

```typescript
async function getOHLCBars(symbol: string, interval: string, date: Date) {
  // 1. Check cache
  const cached = await db.query.candleCache.findFirst({
    where: and(
      eq(candleCache.symbol, symbol),
      eq(candleCache.interval, interval),
      eq(candleCache.date, normalizeToMidnight(date))
    )
  });

  if (cached) {
    return JSON.parse(cached.bars);
  }

  // 2. Fetch from provider
  const provider = getProvider(symbol);
  const bars = await fetchFromProvider(provider, symbol, interval, date);

  // 3. Store in cache
  await db.insert(candleCache).values({
    symbol,
    interval,
    date: normalizeToMidnight(date),
    bars: JSON.stringify(bars),
    barCount: bars.length,
    source: provider,
    fetchedAt: new Date()
  });

  return bars;
}
```

---

## Troubleshooting

### "No market data available"

1. **Check symbol support** in `src/lib/symbols.ts`
2. **Verify API keys** in `.env`:
   - `DATABENTO_API_KEY` for futures
   - `TWELVE_DATA_API_KEY` for forex/crypto
3. **Check API rate limits** (especially Twelve Data free tier)

### "Databento API error"

| Error | Solution |
|-------|----------|
| Invalid API key | Verify key is valid and has credits |
| Symbol not found | Check symbol format (should be `ES.v.0`, not `ES`) |
| No data for date | Verify date is a trading day (not weekend/holiday) |
| Rate limited | Implement exponential backoff |

### "Twelve Data API error"

| Error | Solution |
|-------|----------|
| Rate limit exceeded | Free tier: 8 req/min, upgrade or add delays |
| Symbol not found | Verify symbol is forex/crypto, not futures |
| No data for date | Market may have been closed |

### Slow First Load

**Expected behavior** for cache miss. The first user to view a particular symbol/date combination pays the latency cost. All subsequent views are instant.

### Data Quality Issues

| Quality | Cause | Resolution |
|---------|-------|------------|
| `partial` | Trade spans weekend/holiday | Normal, calculations still valid |
| `unavailable` | Symbol not supported | Add to symbols.ts or use TradingView fallback |
| `pending` | Calculation in progress | Wait or refresh page |

---

## Future Roadmap

### Redis Migration (If Needed)

If PostgreSQL latency becomes an issue (unlikely for our scale):

```typescript
// Same interface, different backend
const cached = await redis.get(`ohlc:${symbol}:${interval}:${date}`);
```

**Migration criteria:**
- Cache query latency consistently >50ms
- Database CPU concerns from cache queries

### Background Pre-fetching

For popular symbols, pre-cache recent data:

```typescript
// Daily cron job
const POPULAR_SYMBOLS = ["ES", "NQ", "EUR/USD", "GBP/USD"];

async function prefetchPopularSymbols() {
  for (const symbol of POPULAR_SYMBOLS) {
    await prefetchLastNDays(symbol, 30);
  }
}
```

### Real-time Data for Open Trades

Current architecture is for **closed trades** only. For live P&L on open trades:

| Approach | Pros | Cons |
|----------|------|------|
| WebSocket to provider | Real-time updates | Subscription cost |
| Polling (5-min interval) | Simple implementation | Not truly real-time |
| Redis pub/sub | Scalable | Additional infrastructure |

### AI Analysis Integration

The cached OHLC data can power:

- Pattern recognition (head & shoulders, double tops)
- Trade quality scoring
- Entry/exit timing analysis
- Correlation with market conditions

**Implementation:** Data already cached; add ML pipeline for analysis.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-30 | Added Databento integration for CME futures |
| 2024-12-29 | Initial cache-first architecture with Twelve Data |
