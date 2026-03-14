# PRD: Progressive Market Data Cache

## Overview

The current `candle_cache` system stores a full day's bars as a single JSON blob per `(symbol, interval, date)` with `onConflictDoNothing`. This means **today's cache is permanently stale** — the first fetch locks in whatever bars existed at that moment, and all subsequent users get that snapshot even though new bars have formed since.

Additionally, derived intervals (5min, 15min, 30min, 4h) are cached as separate rows despite being computable from 1-min or 1-hour base data, wasting ~60% of cache storage.

This PRD fixes both issues: smart append for progressive same-day data filling, and elimination of redundant interval storage.

## Goals

- Same-day cache entries grow progressively as users import throughout the day
- Only re-fetch from Databento when the cache doesn't cover the required time range
- Eliminate redundant derived-interval cache rows (only store 1min and 1h)
- Add a `lastBarAt` column to enable smart staleness detection without parsing JSON
- Add basic cache observability (hit/miss logging)
- Maintain existing behavior: historical (past-day) data remains permanently cached

## User Stories

### US-001: Add `lastBarAt` Column to `candle_cache` Schema

**Description**: As a developer, I want a `lastBarAt` timestamp column on the `candle_cache` table so that the cache can quickly determine whether it needs to re-fetch without parsing the JSON bars blob.

**Acceptance Criteria**:
- [ ] Add `lastBarAt` column (`timestamp with timezone`, not null) to `candle_cache` in `schema.ts`
- [ ] `lastBarAt` stores the timestamp of the last bar in the cached JSON array
- [ ] Remove the `// No expiresAt` comment (no longer accurate given progressive model)
- [ ] Run `bun run db:push` to verify schema change applies cleanly
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-002: Implement Smart Append Logic in `getOHLCBars`

**Description**: As a developer, I want `getOHLCBars` to detect when a same-day cache entry is stale (doesn't cover the needed time range) and append newer bars from Databento, so that progressive data filling works correctly.

**Acceptance Criteria**:
- [ ] On cache hit, compare `lastBarAt` against current request needs:
  - If `lastBarAt` >= the end of the trading day (or it's a past date), return cached data as-is (complete day)
  - If it's today's date and the trade's exit time (or now, for open trades) is after `lastBarAt`, re-fetch from Databento for the full day, replace the cache entry
- [ ] Change `onConflictDoNothing()` to `onConflictDoUpdate()` — update `bars`, `barCount`, `lastBarAt`, and `fetchedAt` when re-fetching
- [ ] For historical dates (before today UTC), keep current behavior — cache hit returns immediately, never re-fetches
- [ ] Populate `lastBarAt` from the last bar's timestamp when writing to cache (both new inserts and updates)
- [ ] Backfill logic: if an existing cache row has no `lastBarAt` (from before this change), parse the bars JSON to extract it, then proceed with comparison
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-003: Eliminate Redundant Derived-Interval Cache Storage

**Description**: As a developer, I want to stop caching derived intervals (5min, 15min, 30min, 4h) in `candle_cache` so that we only store base data from Databento (1min, 1h) and compute derived intervals on the fly.

**Acceptance Criteria**:
- [ ] In `getOHLCBars`, when the requested interval is a derived interval (5min, 15min, 30min), fetch/cache the `1min` base data instead, then aggregate before returning
- [ ] When requested interval is `4h`, fetch/cache the `1h` base data, then aggregate before returning
- [ ] Only `1min` and `1h` rows are ever written to `candle_cache`
- [ ] The `aggregateBars` function in `service.ts` handles the conversion (already exists)
- [ ] Existing derived-interval cache rows are harmlessly ignored (no migration needed to delete them, they just won't be read anymore)
- [ ] Update the `CacheInterval` type and any related schemas if needed to distinguish "requestable intervals" from "storable intervals"
- [ ] All three consumer endpoints (`getChartData`, `getFullDayChartData`, `analyzePriceAction`) continue working correctly
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-004: Update `getOHLCForChart` to Use Base Interval + Aggregation

**Description**: As a developer, I want `getOHLCForChart` to always fetch 1-min base data and aggregate to the requested interval, so chart data is consistent with the new cache-only-base-intervals approach.

**Acceptance Criteria**:
- [ ] `getOHLCForChart` fetches `1min` bars internally regardless of requested `interval`
- [ ] Aggregates to the requested interval before returning
- [ ] `getOHLCForTimeRange` similarly updated if it's called with derived intervals
- [ ] `getFullDayBars` already fetches `1min` — verify no changes needed
- [ ] Charts still display correctly (no timestamp or OHLC regressions)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-005: Update `marketData` tRPC Router for New Cache Behavior

**Description**: As a developer, I want the `marketData` tRPC router to work seamlessly with the progressive cache and base-interval-only storage.

**Acceptance Criteria**:
- [ ] `getChartData` endpoint: no schema changes needed (interval is still user-facing), but internally delegates to 1min fetch + aggregation
- [ ] `getFullDayChartData` endpoint: already uses 1min, verify unchanged behavior
- [ ] `analyzePriceAction` endpoint: already uses 1min and 1h — verify 1h still works correctly (1h is a base interval, should be fine)
- [ ] `getOHLC` endpoint (deprecated): update to use base-interval fetch + aggregation
- [ ] Remove `4h` from `CacheInterval` type if it's no longer a cache key (only a requestable display interval)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-006: Add Basic Cache Observability Logging

**Description**: As a developer, I want basic console logging for cache hits, misses, and appends so that I can monitor cache behavior in development and production logs.

**Acceptance Criteria**:
- [ ] Log on cache hit (historical): `[market-data] cache hit: ES 1min 2024-12-15 (387 bars)`
- [ ] Log on cache miss (new fetch): `[market-data] cache miss: ES 1min 2024-12-15 → fetching from Databento`
- [ ] Log on smart append (same-day re-fetch): `[market-data] cache append: ES 1min 2024-03-14 (was 240 bars → now 387 bars)`
- [ ] Log on derived interval aggregation: `[market-data] aggregating: ES 1min → 5min (387 → 78 bars)`
- [ ] Use `console.info` with `[market-data]` prefix (consistent, greppable)
- [ ] No external dependencies (no OpenTelemetry yet — just structured console logs)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-007: Unit Tests for Bar Merging and Aggregation Logic

**Description**: As a developer, I want unit tests for the bar aggregation and smart append logic so that we can verify correctness of derived interval computation and progressive cache behavior.

**Acceptance Criteria**:
- [ ] Test file created: `tests/unit/market-data-aggregation.test.ts`
- [ ] Tests for `aggregateBars` (service.ts version):
  - 1min → 5min aggregation: correct OHLC (first open, max high, min low, last close)
  - 1min → 15min, 30min aggregation
  - 1h → 4h aggregation
  - Empty input returns empty output
  - Single bar returns single bar
- [ ] Tests for `lastBarAt` extraction logic:
  - Correctly identifies last bar timestamp from sorted bar array
  - Handles empty bar array
- [ ] Tests for staleness detection:
  - Historical date: never stale
  - Today's date with `lastBarAt` before trade exit: stale
  - Today's date with `lastBarAt` after trade exit: not stale
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-008: Integration Tests for Progressive Cache Behavior

**Description**: As a developer, I want integration tests verifying the smart append and base-interval-only caching with real database operations.

**Acceptance Criteria**:
- [ ] Test file created: `tests/integration/market-data-cache.test.ts`
- [ ] Tests use Testcontainers PostgreSQL (real DB, not mocks)
- [ ] Test: first fetch for a date creates cache entry with correct `lastBarAt`
- [ ] Test: second fetch for same historical date returns cached data (no re-fetch)
- [ ] Test: fetch for today with stale cache triggers re-fetch and updates `lastBarAt`, `bars`, `barCount`, `fetchedAt`
- [ ] Test: only `1min` and `1h` rows are created in `candle_cache` (no 5min/15min/30min/4h rows)
- [ ] Test: requesting 5min interval returns correctly aggregated bars from 1min cache
- [ ] Test: `onConflictDoUpdate` correctly replaces stale rows
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-009: Cleanup Migration — Delete Redundant Derived-Interval Cache Rows

**Description**: As a developer, I want a one-time cleanup to remove existing derived-interval rows from `candle_cache` to reclaim storage.

**Acceptance Criteria**:
- [ ] Create a script or tRPC admin mutation that deletes all `candle_cache` rows where `interval` is NOT `1min` or `1h`
- [ ] Log how many rows were deleted
- [ ] Script is idempotent (safe to run multiple times)
- [ ] Place in `scripts/cleanup-derived-cache.ts`
- [ ] Document in script header that this is a one-time cleanup
- [ ] Typecheck passes (`bun run check`)

## Functional Requirements

1. **FR-001**: Cache entries for past dates (before today UTC) are immutable — never re-fetched
2. **FR-002**: Cache entries for today's date are progressively updated when a request needs bars beyond `lastBarAt`
3. **FR-003**: Only `1min` and `1h` intervals are stored in `candle_cache` — all other intervals are derived on the fly
4. **FR-004**: `onConflictDoUpdate` replaces the full `bars` blob, `barCount`, `lastBarAt`, and `fetchedAt` on same-day updates
5. **FR-005**: Aggregation from 1min to 5min/15min/30min uses OHLC-correct semantics (first open, max high, min low, last close, sum volume)
6. **FR-006**: All existing consumer endpoints (`getChartData`, `getFullDayChartData`, `analyzePriceAction`, `getOHLC`) continue working with no API contract changes
7. **FR-007**: Cross-user deduplication is preserved — multiple users requesting the same symbol/date still share one cache entry

## Non-Goals (Out of Scope)

- Real-time streaming / WebSocket data feeds
- OpenTelemetry or structured observability platform integration
- Redis or in-memory caching layer
- Pre-fetching popular symbols via cron
- Compressing the JSON bars blob
- Client-side (browser) caching of market data
- Changing the Databento API contract or switching providers

## Technical Considerations

- **Schema change**: Adding `lastBarAt` column requires `bun run db:push`. Existing rows will have `null` — the backfill logic in US-002 handles this gracefully.
- **`onConflictDoUpdate` atomicity**: PostgreSQL upsert is atomic, so concurrent requests for the same symbol/date won't corrupt data.
- **Aggregation performance**: Aggregating 1,440 1-min bars to 5min is trivial (~1ms). No performance concern.
- **Storage savings**: Eliminating 4 derived intervals per base interval reduces `candle_cache` rows by ~67% for symbols that had all intervals cached.

## Design Considerations

- No UI changes required — this is entirely backend/infrastructure
- Charts continue to receive the same data shape from tRPC endpoints
- Client-side `candle-aggregation.ts` already handles timeframe switching — this change aligns the server-side caching to match

## Success Metrics

- Same-day cache entries progressively grow as users import throughout the day
- No stale data served when a user's trade exit time is beyond what's cached
- `candle_cache` row count drops ~67% after cleanup script
- Zero regression in chart display, MAE/MFE calculations, or replay functionality

## Open Questions

- Should `lastBarAt` be nullable (for backward compat) or should we backfill all existing rows in a migration? → **Decision: nullable with backfill-on-read in US-002**
- Should we re-fetch the entire day or only from `lastBarAt` onward? → **Decision: re-fetch entire day. Databento charges by request not by time range, and merging partial bar arrays adds complexity for no cost savings. Full replace is simpler and correct.**
