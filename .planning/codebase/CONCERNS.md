# Codebase Concerns

**Analysis Date:** 2026-01-17

## Tech Debt

**Unimplemented CSV Parsers (MT4/MT5/NinjaTrader):**
- Issue: MT4 and MT5 parsers exist as stubs returning `success: false` with hardcoded error messages. NinjaTrader parser is `null`.
- Files: `src/lib/trades/csv-parsers/mt4-parser.ts`, `src/lib/trades/csv-parsers/index.ts:18`
- Impact: Users cannot import trades from MetaTrader 4, MetaTrader 5, or NinjaTrader platforms - three of the most popular trading platforms
- Fix approach: Implement actual parsing logic following the ProjectX parser pattern at `src/lib/trades/csv-parsers/projectx-parser.ts`

**Unimplemented "Add Execution" Feature:**
- Issue: TODO comment indicates add execution button is not wired up
- Files: `src/components/trade-detail/stats-panel.tsx:692`
- Impact: Users may click UI element that does nothing, breaking partial exit workflow
- Fix approach: Wire up onClick handler to open execution modal, following pattern in existing execution handling

**Large Analytics Router (3830 lines):**
- Issue: Single router file contains all analytics endpoints with significant code duplication
- Files: `src/server/api/routers/analytics.ts`
- Impact: Difficult to maintain, repeated `Promise.all` pattern for fetching user settings (23 occurrences), hard to test individual endpoints
- Fix approach: Split into multiple routers by concern (overview, time-analysis, symbol-analysis, etc.) or extract shared logic into helper functions

**Large Analytics Page (1382 lines):**
- Issue: Single page component handles all analytics tabs and visualizations
- Files: `src/app/(protected)/analytics/page.tsx`
- Impact: Long initial load, difficult to navigate and maintain
- Fix approach: Extract each tab into separate component files, lazy load non-default tabs

**Repeated User Settings Fetch Pattern:**
- Issue: Same `Promise.all` with `getUserBreakevenThreshold`, `getUserTimezone`, `getUserTradingSessions` appears 23+ times in analytics router
- Files: `src/server/api/routers/analytics.ts:358,521,618,712,805,984,1127,...`
- Impact: Code duplication, easy to forget one setting, harder to add new settings
- Fix approach: Create `getUserSettings()` helper that returns all settings in one call, use across all analytics endpoints

**Deprecated Function Warning:**
- Issue: `getHoursForSymbol` marked as deprecated but may still be used
- Files: `src/server/api/routers/marketData.ts:38`
- Impact: Inconsistent API, developers may use deprecated endpoint
- Fix approach: Add deprecation notice in docs, migrate callers to `getChartData`, remove after migration

## Known Bugs

**Timezone Function Warning in Server Context:**
- Issue: `getDateStringInLocalTimezone` has deprecation warning for backend use
- Files: `src/lib/shared/timezone.ts:29`
- Trigger: Server-side code calling this function
- Workaround: Use UTC-based alternatives for server code

## Security Considerations

**Error Messages Expose Internal State:**
- Risk: Generic `throw new Error("Trade not found")` and similar messages could leak existence of resources to unauthorized users
- Files: `src/server/api/routers/trades.ts:413,670,705,...`, `src/server/api/routers/tags.ts:49,70,100,...`
- Current mitigation: User ownership validated before throwing errors
- Recommendations: Consider using consistent `NOT_FOUND` TRPCError for all resource-not-found cases

**Console Error Logging May Leak Sensitive Data:**
- Risk: Some error handlers log to console which may expose data in production logs
- Files: `src/app/api/webhooks/clerk/route.ts:47`, `src/server/api/routers/dailyJournal.ts:1162`, `src/app/api/trpc/[trpc]/route.ts:27`
- Current mitigation: Most are in non-production paths
- Recommendations: Implement structured logging with PII filtering for production

**No Rate Limiting on API Routes:**
- Risk: API endpoints vulnerable to abuse, especially expensive analytics queries
- Files: `src/server/api/routers/analytics.ts` (all endpoints), `src/server/api/routers/trades.ts` (batch operations)
- Current mitigation: Only `trades.ts:1398` mentions rate limiting for external API calls
- Recommendations: Add rate limiting middleware to tRPC context, especially for compute-intensive analytics endpoints

**S3 Operations Runtime-Dependent:**
- Risk: S3 operations only work in Bun runtime, silently fail in other environments
- Files: `src/lib/storage/s3.ts:59-60`
- Current mitigation: `isBunRuntime()` check throws descriptive error
- Recommendations: Add fallback for non-Bun environments or fail-fast at app startup

## Performance Bottlenecks

**Post-Query Filtering for Analytics:**
- Problem: Many analytics queries fetch all trades then filter in JavaScript
- Files: `src/server/api/routers/analytics.ts:89-91` (comment documents this limitation)
- Cause: Filters on computed values (daysOfWeek, hours, sessions, outcome, rMultiple, positionSize) cannot be expressed in SQL
- Improvement path: Pre-compute and store frequently filtered values (like day-of-week, hour) in trades table, add indexes

**Large Trade Queries Without Pagination:**
- Problem: Some analytics endpoints fetch all matching trades into memory
- Files: `src/server/api/routers/analytics.ts:353-355`
- Cause: Need all trades for aggregate calculations
- Improvement path: Implement cursor-based aggregation or materialized views for frequently accessed metrics

**No Caching for Analytics Results:**
- Problem: Same expensive analytics queries re-run on every page load
- Files: `src/server/api/routers/analytics.ts` (all endpoints)
- Cause: No server-side caching layer
- Improvement path: Add Redis/in-memory cache for expensive aggregations, invalidate on trade changes

## Fragile Areas

**Trade Hash Calculation:**
- Files: `src/lib/trades/hash.ts`
- Why fragile: Hash changes affect duplicate detection during CSV import; any field changes break existing hashes
- Safe modification: Never change hash algorithm or included fields without migration plan
- Test coverage: Integration tests exist for batch import, but no unit tests for hash stability

**MAE/MFE Calculation Pipeline:**
- Files: `src/lib/market-data/maemfe.ts`, `src/trigger/process-trade-maemfe.ts`
- Why fragile: Depends on external market data APIs (Databento, Twelve Data), multiple async steps
- Safe modification: Always test with mock API responses, handle partial data gracefully
- Test coverage: Some integration tests, external API calls not fully mocked

**Analytics Filter Builder:**
- Files: `src/server/api/routers/analytics.ts:92-122`
- Why fragile: Filter logic must stay in sync with frontend filter UI and store
- Safe modification: Update frontend, backend, and types together
- Test coverage: Good coverage in `tests/integration/analytics/filters.test.ts`

## Scaling Limits

**Single Database Connection Pool:**
- Current capacity: Default Drizzle/pg pool settings
- Limit: High concurrent analytics queries could exhaust connections
- Scaling path: Configure explicit pool limits, consider read replicas for analytics

**Market Data API Rate Limits:**
- Current capacity: Databento and Twelve Data have per-account limits
- Limit: Multiple users requesting MAE/MFE simultaneously can hit rate limits
- Scaling path: Already have sequential processing (`trades.ts:1398`), consider background job queue with rate limiting

## Dependencies at Risk

**Tailwind CSS v4:**
- Risk: v4 is relatively new, may have breaking changes or ecosystem compatibility issues
- Impact: Styling could break with updates
- Migration plan: Pin version, test thoroughly before upgrading

**tRPC v11:**
- Risk: v11 introduced significant changes from v10
- Impact: Many examples/docs online are for v10
- Migration plan: Current implementation is stable, monitor for security patches

## Missing Critical Features

**No Audit Log:**
- Problem: No tracking of who modified what and when
- Blocks: Compliance requirements, debugging data issues, undo functionality

**No Soft Delete Consistency:**
- Problem: Trades have `deletedAt` soft delete, but related entities (executions, tags, screenshots) may not
- Files: `src/server/db/schema.ts:299` (trades.deletedAt)
- Blocks: Clean restoration of deleted trades

**No Webhook Retry Logic:**
- Problem: Clerk webhook handler has no retry mechanism for failed syncs
- Files: `src/app/api/webhooks/clerk/route.ts`
- Blocks: Reliable user provisioning after transient failures

## Test Coverage Gaps

**Frontend Components Untested:**
- What's not tested: All React components in `src/components/`, `src/app/`
- Files: Entire `src/components/` directory, `src/app/(protected)/` pages
- Risk: UI regressions, broken user interactions go unnoticed
- Priority: High - consider adding Playwright or React Testing Library

**CSV Parser Stubs:**
- What's not tested: MT4, MT5, NinjaTrader parsers (because they're unimplemented)
- Files: `src/lib/trades/csv-parsers/mt4-parser.ts`
- Risk: When implemented, no tests exist
- Priority: Medium - implement parsers with tests simultaneously

**S3 Storage Operations:**
- What's not tested: S3 upload/download in actual Bun runtime
- Files: `src/lib/storage/s3.ts`
- Risk: Storage failures in production
- Priority: Medium - storage tests exist (`tests/integration/storage/`) but rely on Bun

**Market Data Service Edge Cases:**
- What's not tested: API failures, partial data, rate limiting scenarios
- Files: `src/lib/market-data/service.ts`, `src/lib/market-data/maemfe.ts`
- Risk: Ungraceful failures when external APIs are unavailable
- Priority: High - external dependency failures affect user experience

**Strategies Router:**
- What's not tested: No integration tests for strategies CRUD
- Files: `src/server/api/routers/strategies.ts`
- Risk: Strategy management bugs go undetected
- Priority: Medium - strategies is a complete feature

---

*Concerns audit: 2026-01-17*
