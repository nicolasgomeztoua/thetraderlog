# Consistency Audit Report

**Generated**: 2026-01-07
**Branch**: `audit/consistency-consolidation`

## Executive Summary

Parallel audit of backend calculations, frontend display logic, and shared utilities revealed **23 duplicate/inconsistent implementations** that could cause bugs similar to the R-multiple issue we just fixed.

### Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 2 | R-Multiple (9 implementations), Stats R-Multiple missing point values |
| HIGH | 5 | P&L parsing, breakeven threshold, date formatting, formatCurrency/Percent duplication, TRADING_SESSIONS constants |
| MEDIUM | 10 | Color logic, number formatting, filter transformations, etc. |
| LOW | 6 | Minor inconsistencies |

---

## FIXES APPLIED IN THIS PR

### Critical Fixes

1. **Fixed `calculateRMultipleFromTrade()` in stats.ts** - Added point value multiplier for accurate R-multiple calculation
2. **Replaced inline R-multiple in trades.ts** - Now uses `calculateActualRMultiple()` utility
3. **Fixed breakeven threshold hardcoding** - trades.ts now uses `getUserBreakevenThreshold()`
4. **Replaced inline R-multiple in analytics.ts** - 4 locations now use `calculateActualRMultiple()`
5. **Removed deprecated `calculateRMultiple()`** - Deleted unused function from calculations.ts
6. **Documented sort.ts R-multiple** - Added comment explaining why simplified version is acceptable for sorting

---

## REMAINING ISSUES (Future PRs)

### High Priority

#### Date Formatting: 3 Independent Implementations
| Location | Format | Library |
|----------|--------|---------|
| `src/lib/shared/utils.ts:79` | `month: "short", day: "numeric", year: "numeric"` | Intl |
| `src/components/analytics/drawdown-table.tsx:26-32` | `month: "short", day: "numeric", year: "2-digit"` | Intl |
| `src/components/analytics/filter-chips.tsx:23-28` | `month: "short", day: "numeric"` (no year) | Intl |
| `src/components/analytics/quick-filters.tsx:37` | `format(d, "MMM d")` | **date-fns** |

**Recommendation**: Remove local implementations, use shared `formatDate()`

#### formatCurrency/Percent: 2 Different Implementations
- **Shared** (`src/lib/shared/utils.ts`): `formatCurrency(value, currency="USD")`
- **Analytics** (`src/lib/analytics/calculations.ts`): `formatCurrency(value, {showSign, decimals})`

**Recommendation**: Enhance shared versions with optional `showSign` parameter

#### TRADING_SESSIONS: 2 Different Formats
| File | Format |
|------|--------|
| `src/lib/constants/analytics.ts:81` | Object: `{asia: {start, end, label}, ...}` |
| `src/lib/analytics/constants.ts:74` | Array: `[{id, label, startHour, endHour}, ...]` |

**Recommendation**: Consolidate to single source

### Medium Priority

#### Hardcoded Color Hex Values (15+ locations)
`"#00ff88"` and `"#ff3b3b"` should use `COLORS.profit`/`COLORS.loss` from `src/lib/shared/colors.ts`

#### Win Rate Formatting Inconsistent
Mix of `.toFixed(0)` and `.toFixed(1)` across 20+ files

#### Currency vs toLocaleString Inconsistency
Some files use `formatCurrency()`, others use `.toLocaleString()` (no $ symbol)

### Low Priority
- Filter type coercion on frontend instead of tRPC schemas
- Missing `formatCompactNumber()` export from shared utils
- Timezone formatter duplication (utils.ts vs timezone.ts)
- Efficiency/ROI formatting precision varies

---

## Files Modified in This PR

| File | Change |
|------|--------|
| `src/lib/analytics/stats.ts` | Fixed R-multiple calculation with point values |
| `src/lib/trades/calculations.ts` | Removed deprecated `calculateRMultiple()` |
| `src/lib/trades/sort.ts` | Renamed function, added documentation |
| `src/server/api/routers/trades.ts` | Use `calculateActualRMultiple()`, fix breakeven |
| `src/server/api/routers/analytics.ts` | Replace 4 inline R-multiple calculations |

---

## Prevention Recommendations

1. **Lint Rules**: Consider adding lint rules to detect inline calculations
2. **Code Review Focus**: Flag any new `Math.abs(entry - stop)` patterns
3. **Documentation**: Update CLAUDE.md with anti-patterns section
4. **Single Source of Truth**: Always use utilities from `@/lib/trades/calculations`

---

## R-Multiple Calculation Reference

**Canonical Implementation**: `src/lib/trades/calculations.ts:calculateActualRMultiple()`

```typescript
// CORRECT: Actual R-multiple with point values
const rMultiple = calculateActualRMultiple(
  netPnl,
  entryPrice,
  stopLoss,
  quantity,
  symbol,
  instrumentType
);
// Formula: netPnl / (|entry - stop| * pointValue * quantity)
```

**Acceptable Simplified Versions**:
- `src/lib/trades/sort.ts` - For sorting only (documented)
- `src/server/api/helpers/sort-builder.ts` - SQL version for database sorting
- `src/server/api/helpers/cursor.ts` - For cursor pagination
