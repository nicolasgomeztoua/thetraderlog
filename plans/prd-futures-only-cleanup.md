# PRD: Futures-Only Product Cleanup

## Overview

Strip all forex, crypto, and non-futures code from EdgeJournal to launch as a **futures-only** trading journal. This removes the Twelve Data API integration, forex P&L calculations, pip-based math, MT4/MT5 parsers, instrument type toggles, and all forex UI/marketing references. Databento becomes the sole market data provider. Currency futures (6E, 6B, etc.) are **kept** — they're CME futures contracts.

## Goals

- Remove all forex symbols, specs, and calculations from the codebase
- Remove the entire Twelve Data API integration (Databento is sole provider)
- Remove MT4/MT5 CSV parsers (forex trading platforms)
- Drop the `instrumentType` column and enum from the database schema
- Remove the `defaultInstrumentType` user setting entirely
- Simplify all functions that branched on instrument type
- Update marketing copy and AI prompts to reflect futures-only positioning
- Ensure typecheck (`bun run check`) and build (`bun run build`) pass after every story

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB column strategy | **Remove entirely** | Clean slate. Drop `instrument_type` column + enum. |
| Twelve Data | **Remove completely** | Databento handles all futures. No fallback needed. |
| Currency futures (6E, 6B, etc.) | **Keep** | They're CME futures contracts, not spot forex. |
| `defaultInstrumentType` setting | **Remove entirely** | Only one instrument type — nothing to choose. |

## User Stories

### US-001: Audit All Forex and Non-Futures References

**Description**: As a developer, I want to audit every forex reference before removing anything so that we have a complete removal checklist and don't miss anything.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for all forex/pip/twelve-data references with file:line
- [ ] Search `src/server/` for all `instrumentType` usages with file:line
- [ ] Search `src/components/` and `src/app/` for forex UI references with file:line
- [ ] Document findings in `scripts/ralph/progress.txt`
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
grep -rn "forex\|FOREX\|Forex" src/
grep -rn "pip\|Pip\|PIP" src/lib/ src/server/
grep -rn "twelve.data\|TWELVE_DATA\|twelveData\|TwelveData" src/
grep -rn "instrumentType\|instrument_type\|instrument.type" src/
grep -rn "mt4\|mt5\|MT4\|MT5\|metatrader\|MetaTrader" src/
grep -rn "EUR/USD\|GBP/USD\|USD/JPY\|AUD/USD" src/
```

---

### US-002: Remove Forex References from Marketing Pages

**Description**: As a visitor, I want the landing page to clearly communicate this is a futures trading journal so that expectations are set correctly.

**Acceptance Criteria**:
- [ ] `src/app/(marketing)/_components/hero.tsx` — Remove "and forex" from tagline, remove forex example trades (EUR/USD, pips), replace with futures examples
- [ ] `src/app/(marketing)/_components/features.tsx` — Change "Futures & Forex" to "Futures", remove forex pairs from feature descriptions
- [ ] `src/app/(marketing)/layout.tsx` — Update meta description to "futures traders" only
- [ ] Any other marketing pages referencing forex
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-003: Remove Forex References from AI Prompts and Tool Definitions

**Description**: As a developer, I want AI prompts and tools to only reference futures so that AI responses are accurate for a futures-only product.

**Acceptance Criteria**:
- [ ] `src/lib/ai/tools/definitions.ts` — Remove forex pairs from tool descriptions, remove Twelve Data references
- [ ] `src/lib/ai/schema-context.ts` — Remove `instrument_type` from schema docs, remove `twelve_data` source reference
- [ ] `src/lib/ai/prompts/trading-analyst.ts` — Change persona to "futures trading journal", remove forex pair references
- [ ] `src/lib/ai/report-pipeline/planner.ts` — Remove forex from market data tool description
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-004: Remove MT4 and MT5 CSV Parsers

**Description**: As a developer, I want to remove MetaTrader parsers since they're forex-only platforms not relevant to futures traders.

**Acceptance Criteria**:
- [ ] Delete or gut `src/lib/trades/csv-parsers/mt4-parser.ts` (remove forex parser, keep file if needed for module resolution)
- [ ] Delete or gut `src/lib/trades/csv-parsers/mt5-parser.ts`
- [ ] Remove MT4/MT5 from parser registry in `src/lib/trades/csv-parsers/index.ts`
- [ ] Remove `"mt4"` and `"mt5"` from `tradingPlatformEnum` in `src/server/db/schema.ts` if no existing data depends on them
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-005: Remove Twelve Data Service Integration

**Description**: As a developer, I want to remove the Twelve Data API integration so that Databento is the sole market data provider.

**Acceptance Criteria**:
- [ ] `src/lib/market-data/service.ts` — Remove `TwelveDataBar`, `TwelveDataResponse` interfaces
- [ ] Remove `fetchFromTwelveData()` function entirely
- [ ] Simplify `fetchFromProvider()` to only call Databento (remove forex/crypto routing)
- [ ] Remove `TWELVE_DATA_API_KEY` from `src/env.js` or env schema if present
- [ ] Remove the `TWELVE_DATA_SYMBOL_MAP` from `src/lib/market-data/symbols.ts`
- [ ] Update any comments referencing "Twelve Data" in the service file
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Remove Forex Specs, Symbols, and Helper Functions from symbols.ts

**Description**: As a developer, I want to remove all forex-specific data structures and functions from the symbols module so that only futures remain.

**Acceptance Criteria**:
- [ ] Remove `ForexSpec` interface
- [ ] Remove `FOREX_SPECS` constant (all 27 forex pair specifications)
- [ ] Remove `FOREX_SYMBOLS` array (all 27 forex symbol definitions)
- [ ] Remove `getForexSpec()` function
- [ ] Remove `getForexPipSize()` function
- [ ] Remove `calculateForexPnL()` function
- [ ] Simplify `getSymbolsByType()` — either remove or just return futures symbols
- [ ] Simplify `getPointValue()`, `getTickSize()` — remove forex branches
- [ ] Remove any forex-related exports from `src/lib/market-data/index.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Remove Forex P&L Calculations and Pip Functions

**Description**: As a developer, I want to remove forex-specific calculation functions so that only futures tick-based math remains.

**Acceptance Criteria**:
- [ ] `src/lib/trades/calculations.ts` — Remove `calculatePips()`, `getPipValue()`, `getTickOrPipSize()` (or simplify to tick-only)
- [ ] Remove `getForexPipSize` import
- [ ] Simplify any functions that branch on `instrumentType` to only handle futures
- [ ] `src/lib/trades/running-pnl.ts` — Remove forex branches, remove `calculateForexPnL` references, remove `instrumentType` parameter if it only existed for forex
- [ ] `src/lib/analytics/stats.ts` — Remove `instrumentType` parameter if present
- [ ] `src/lib/strategy/evaluation.ts` — Remove `instrumentType` parameter if present
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Remove Instrument Type UI from Trade Entry and Import Pages

**Description**: As a trader, I should not see instrument type toggles since the product is futures-only.

**Acceptance Criteria**:
- [ ] `src/app/(protected)/trade/new/page.tsx` — Remove `instrumentType` state, remove futures/forex tabs, remove `FOREX_SYMBOLS` import, always use `FUTURES_SYMBOLS`
- [ ] `src/app/(protected)/import/page.tsx` — Remove instrument type toggle, remove `setInstrumentType`, hardcode to futures behavior
- [ ] Remove any instrument type selection UI patterns
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser — new trade and import pages work without instrument type toggle

---

### US-009: Remove defaultInstrumentType from Settings

**Description**: As a developer, I want to remove the instrument type preference from settings since there's only one option now.

**Acceptance Criteria**:
- [ ] `src/app/(protected)/settings/_components/settings-content.tsx` — Remove instrument type dropdown/selector
- [ ] `src/stores/settings-store.ts` — Remove `defaultInstrumentType` from store state
- [ ] `src/server/api/routers/settings.ts` — Remove `defaultInstrumentType` from settings input/output schemas
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser — settings page renders without instrument type option

---

### US-010: Remove instrumentType from Trade Detail Components

**Description**: As a developer, I want to simplify trade detail components by removing the `instrumentType` parameter since all trades are futures.

**Acceptance Criteria**:
- [ ] `src/components/trade-detail/stats-panel.tsx` — Remove pip display logic, remove `instrumentType` prop/parameter
- [ ] `src/components/trade-detail/running-pnl-tab.tsx` — Remove `instrumentType` parameter
- [ ] `src/components/trade-detail/trade-replay.tsx` — Remove `instrumentType` parameter
- [ ] `src/components/trade-detail/tradingview-chart.tsx` — Remove `instrumentType` optional parameter
- [ ] `src/components/trade-detail/replay/time-sales-panel.tsx` — Remove `instrumentType` parameter
- [ ] Update all parent components passing `instrumentType` to these children
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: Remove instrumentType from tRPC Routers

**Description**: As a developer, I want to remove `instrumentType` from all tRPC router inputs and queries so the API is futures-only.

**Acceptance Criteria**:
- [ ] `src/server/api/routers/trades.ts` — Remove `instrumentType` from create/update inputs, remove from queries/filters
- [ ] `src/server/api/routers/analytics.ts` — Remove `instrumentType` casting and filtering
- [ ] `src/server/api/routers/marketData.ts` — Simplify to Databento-only, remove instrument type routing comments
- [ ] Remove `instrumentType` from any other routers that reference it
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-012: Remove instrumentType from Shared Types and Schemas

**Description**: As a developer, I want to remove the instrument type from all shared Zod schemas and TypeScript types.

**Acceptance Criteria**:
- [ ] `src/lib/shared/schemas.ts` — Remove `instrumentTypeEnum` Zod schema
- [ ] `src/lib/trades/csv-parsers/types.ts` — Remove `instrumentType` from `ParsedTrade` type
- [ ] Search for and remove any remaining `"futures" | "forex"` union types across the codebase
- [ ] Remove any remaining imports of `instrumentTypeEnum` from shared schemas
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-013: Drop instrumentType Column and Enum from Database Schema

**Description**: As a developer, I want to remove the `instrument_type` column and enum from the database so the schema reflects the futures-only product.

**Acceptance Criteria**:
- [ ] `src/server/db/schema.ts` — Remove `instrumentTypeEnum` pgEnum definition
- [ ] Remove `instrumentType` column from `trades` table
- [ ] Remove `defaultInstrumentType` column from `userSettings` table
- [ ] Remove `source` column from `candleCache` if it was only used to distinguish Twelve Data vs Databento (or simplify)
- [ ] Run `bun run db:push` to apply schema changes
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Note**: This story must run AFTER all code references to `instrumentType` are removed (US-008 through US-012). Existing data must all be futures trades.

---

### US-014: Clean Up Environment Variables and Documentation

**Description**: As a developer, I want to remove Twelve Data env var references and update project documentation.

**Acceptance Criteria**:
- [ ] Remove `TWELVE_DATA_API_KEY` from `.env.example` (if it exists)
- [ ] Remove Twelve Data references from `CLAUDE.md` environment variables section
- [ ] Update `CLAUDE.md` description — "futures traders" not "futures and forex traders"
- [ ] Remove "forex" from any remaining documentation files
- [ ] Update any `README.md` references if they mention forex
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-015: Integration Tests — Verify Forex Removal

**Description**: As a developer, I want integration tests to verify that the forex removal is complete and existing futures flows still work.

**Acceptance Criteria**:
- [ ] Verify existing trade tests pass with futures-only schema
- [ ] Verify existing analytics tests pass without `instrumentType` filtering
- [ ] Verify CSV import tests pass without MT4/MT5 parsers
- [ ] Run `grep -rn "forex\|FOREX\|Forex" src/` — zero results (excluding comments explaining removal)
- [ ] Run `grep -rn "twelve.data\|TWELVE_DATA" src/` — zero results
- [ ] Run `grep -rn "\"pip\"\|pipSize\|pipValue\|calculatePips\|getForexPipSize" src/` — zero results
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-016: Final Build Verification and Smoke Test

**Description**: As a developer, I want a clean build and runtime verification to confirm the futures-only product works end-to-end.

**Acceptance Criteria**:
- [ ] `bun run check` passes with zero errors
- [ ] `bun run build` passes with zero errors
- [ ] `bun run test` passes — all integration tests green
- [ ] Verify no dead imports or unused variables from removal
- [ ] Verify no remaining `instrumentType` references in compiled output
- [ ] Dev server starts without errors (`bun run dev`)

---

## Functional Requirements

1. **FR-001**: All market data fetching uses Databento exclusively
2. **FR-002**: All P&L calculations use futures tick/point math only
3. **FR-003**: All CSV parsers are for futures platforms only (no MT4/MT5)
4. **FR-004**: No instrument type selection exists in the UI anywhere
5. **FR-005**: Currency futures (6E, 6B, 6J, etc.) remain fully supported as CME futures
6. **FR-006**: All marketing positions EdgeJournal as futures-only
7. **FR-007**: AI assistant only references futures instruments

## Non-Goals (Out of Scope)

- Adding new futures features (this is purely removal/cleanup)
- Changing the futures calculation logic
- Modifying Databento integration
- Redesigning any UI layouts
- Adding new CSV parsers
- Performance optimizations

## Technical Considerations

- **Schema migration**: Dropping `instrument_type` column requires `bun run db:push`. Existing trades must all be futures.
- **Enum removal**: PostgreSQL enums can't be easily modified. Dropping the column and enum is cleanest via `db:push`.
- **Type cascade**: Removing `instrumentType` from the schema will cascade TypeScript errors. Stories are ordered leaf-to-root to minimize breakage per story.
- **MT4/MT5 platform enum**: If any existing data uses these platform values, the enum values may need to stay in the DB but be removed from the UI.

## Files Affected (Complete List)

### Remove / Major Edit
| File | Changes |
|------|---------|
| `src/server/db/schema.ts` | Drop `instrumentTypeEnum`, `instrumentType` column, `defaultInstrumentType` column, MT4/MT5 from platform enum |
| `src/lib/market-data/symbols.ts` | Remove `ForexSpec`, `FOREX_SPECS`, `FOREX_SYMBOLS`, `TWELVE_DATA_SYMBOL_MAP`, forex helpers |
| `src/lib/market-data/service.ts` | Remove Twelve Data integration entirely |
| `src/lib/trades/calculations.ts` | Remove pip calculations, simplify to futures-only |
| `src/lib/trades/running-pnl.ts` | Remove forex branches |
| `src/lib/trades/csv-parsers/mt4-parser.ts` | Delete or empty |
| `src/lib/trades/csv-parsers/mt5-parser.ts` | Delete or empty |
| `src/lib/trades/csv-parsers/index.ts` | Remove MT4/MT5 from registry |
| `src/lib/trades/csv-parsers/types.ts` | Remove `instrumentType` |
| `src/lib/shared/schemas.ts` | Remove `instrumentTypeEnum` Zod schema |
| `src/lib/analytics/stats.ts` | Remove `instrumentType` parameter |
| `src/lib/strategy/evaluation.ts` | Remove `instrumentType` parameter |

### UI Updates
| File | Changes |
|------|---------|
| `src/app/(protected)/trade/new/page.tsx` | Remove forex tabs, always futures |
| `src/app/(protected)/import/page.tsx` | Remove instrument type toggle |
| `src/app/(protected)/settings/_components/settings-content.tsx` | Remove instrument type setting |
| `src/stores/settings-store.ts` | Remove `defaultInstrumentType` |
| `src/components/trade-detail/stats-panel.tsx` | Remove pip display |
| `src/components/trade-detail/running-pnl-tab.tsx` | Remove `instrumentType` param |
| `src/components/trade-detail/trade-replay.tsx` | Remove `instrumentType` param |
| `src/components/trade-detail/tradingview-chart.tsx` | Remove `instrumentType` param |
| `src/components/trade-detail/replay/time-sales-panel.tsx` | Remove `instrumentType` param |

### Marketing
| File | Changes |
|------|---------|
| `src/app/(marketing)/_components/hero.tsx` | Futures-only copy |
| `src/app/(marketing)/_components/features.tsx` | Futures-only copy |
| `src/app/(marketing)/layout.tsx` | Update meta description |

### AI
| File | Changes |
|------|---------|
| `src/lib/ai/tools/definitions.ts` | Remove forex tool descriptions |
| `src/lib/ai/schema-context.ts` | Remove instrument_type docs |
| `src/lib/ai/prompts/trading-analyst.ts` | Futures-only persona |
| `src/lib/ai/report-pipeline/planner.ts` | Remove forex from tool descriptions |

### API
| File | Changes |
|------|---------|
| `src/server/api/routers/trades.ts` | Remove `instrumentType` from inputs |
| `src/server/api/routers/analytics.ts` | Remove `instrumentType` casting |
| `src/server/api/routers/marketData.ts` | Simplify to Databento-only |
| `src/server/api/routers/settings.ts` | Remove `defaultInstrumentType` |

### Config / Docs
| File | Changes |
|------|---------|
| `CLAUDE.md` | Remove forex/Twelve Data references |
| `.env` / `.env.example` | Remove `TWELVE_DATA_API_KEY` |

## Success Metrics

- Zero grep results for `forex`, `FOREX`, `Forex` in `src/`
- Zero grep results for `twelve.data`, `TWELVE_DATA` in `src/`
- Zero grep results for `pipSize`, `pipValue`, `calculatePips` in `src/`
- `bun run check` — zero errors
- `bun run build` — zero errors
- `bun run test` — all tests pass
- No instrument type UI visible anywhere in the app

## Open Questions

- None — all decisions resolved in clarifying questions.
