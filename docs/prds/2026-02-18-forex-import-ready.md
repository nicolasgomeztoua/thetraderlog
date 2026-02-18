# PRD: Forex Import Ready

**Date:** 2026-02-18
**Author:** EdgeCEO
**Status:** Draft
**Priority:** High — Launch blocker
**Category:** 🔧 Feature

---

## Problem

EdgeJournal's calculation layer, schema, UI, and analytics already support forex trades end-to-end. But forex traders can't actually get their trades into the app. Every working CSV parser (ProjectX, TopstepX, NinjaTrader, Tradovate, Rithmic, Apex) is futures-only. The MT4/MT5 parsers — the primary import path for forex traders — are stubs that return `success: false`.

ICT/SMC methodology originated in forex. Excluding forex import at launch cuts out ~50% of the addressable market.

## Goal

A forex trader using MT4 or MT5 can import their trade history via CSV and have everything work: correct symbols, pip calculations, P&L, analytics, AI reports, and charting.

## Scope

### P0 — Launch Blockers

#### 1. Implement MT4 CSV Parser (`src/lib/trades/csv-parsers/mt4-parser.ts`)

The stub already has the right structure. MT4 exports with these columns:

| Column | Maps To | Notes |
|--------|---------|-------|
| Ticket | `externalId` | Unique trade ID |
| Open Time | `entryTime` | Format: `YYYY.MM.DD HH:MM:SS` |
| Type | `direction` | `buy` → `long`, `sell` → `short`. Skip `balance`, `credit`, `deposit`, `withdrawal` rows |
| Size | `quantity` | Lot size (e.g., `0.01`, `0.10`, `1.00`) |
| Item / Symbol | `symbol` | Needs normalization (see below) |
| Price | `entryPrice` | |
| S/L | `stopLoss` | `0.00000` means not set |
| T/P | `takeProfit` | `0.00000` means not set |
| Close Time | `exitTime` | |
| Close Price / Price (2nd) | `exitPrice` | |
| Commission | → sum into `fees` | |
| Swap | → sum into `fees` | Overnight swap charges |
| Profit | `profit` | Broker-reported P&L for verification |
| Magic Number | `magicNumber` | EA identifier (optional) |
| Comment | `comment` | |

**Symbol normalization:**
- MT4 uses broker-specific suffixes: `EURUSDm`, `EURUSD.pro`, `EURUSD_SB`, `GBPUSDz`
- Strip known suffixes, then format as `EUR/USD` (with slash) to match our `FOREX_SYMBOLS`
- Common pattern: 6-char string → split at 3 → `XXX/YYY`
- For futures on MT4 (less common): detect by known futures symbols and set `instrumentType: "futures"`
- Precious metals: `XAUUSD` → `GC` (gold), `XAGUSD` → `SI` (silver) — map to futures equivalents

**Edge cases to handle:**
- Partial closes: MT4 creates new tickets for partials. Group by original ticket or matching open time + symbol
- Pending orders that were never filled (Type: `buy limit`, `sell stop`, etc.) — skip these
- Balance/credit/deposit rows mixed in with trades — skip non-trade rows
- Different broker date formats and decimal separators (EU brokers may use commas)

#### 2. Implement MT5 CSV Parser (`src/lib/trades/csv-parsers/mt4-parser.ts` — `mt5Parser`)

MT5 has a different export format. Two main export types:

**Deals export (preferred):**
| Column | Maps To | Notes |
|--------|---------|-------|
| Position | `externalId` | Position ID (groups related deals) |
| Time | `entryTime` / `exitTime` | Based on deal type |
| Type | `direction` | `buy` / `sell` — but MT5 deals are entry/exit pairs, not single rows |
| Volume | `quantity` | Lot size |
| Symbol | `symbol` | Same normalization as MT4 |
| Price | Price for this deal | |
| Commission | fees | |
| Swap | fees | On closing deal only |
| Profit | P&L | On closing deal only |
| Comment | `comment` | |

**Key difference from MT4:** MT5 exports deals, not trades. A round-trip trade = an entry deal + exit deal sharing the same Position ID. The parser needs to:
1. Group deals by Position ID
2. Match entry deal (first `buy`/`sell`) with exit deal (opposite direction or matching close)
3. Combine into a single `ParsedTrade`

**Orders/History export (fallback):**
Similar to MT4 format but with Position ID instead of Ticket. Simpler to parse — each row is closer to a complete trade.

#### 3. Import Page: Inherit `instrumentType` from Account

Currently hardcoded to `"futures"`. Change:

```
// Before
const [instrumentType, setInstrumentType] = useState<"futures" | "forex">("futures");

// After  
const accountInstrumentType = selectedImportAccount?.defaultInstrumentType ?? "futures";
// Reset when account changes
useEffect(() => {
  setInstrumentType(accountInstrumentType);
}, [accountInstrumentType]);
```

This way, if someone selects an MT5 forex account, the import page defaults to forex automatically.

#### 4. Symbol Normalization Utility

Create `src/lib/trades/csv-parsers/symbol-normalizer.ts`:

```ts
/**
 * Normalize broker-specific forex symbols to our standard format
 * "EURUSDm" → "EUR/USD"
 * "GBPUSD.pro" → "GBP/USD"
 * "XAUUSD" → "GC" (gold futures equivalent)
 * "USTEC" / "NAS100" → "NQ" (Nasdaq futures)
 */
export function normalizeForexSymbol(raw: string): { symbol: string; instrumentType: "futures" | "forex" }
```

Known broker symbol patterns:
- Suffix stripping: `.pro`, `.raw`, `_SB`, `m`, `z`, `.e`, `.i`
- CFD index mapping: `US30` → `YM`, `US500`/`SPX500` → `ES`, `USTEC`/`NAS100` → `NQ`
- Metals: `XAUUSD` → `GC`, `XAGUSD` → `SI`
- Oil: `USOIL`/`WTI` → `CL`, `UKOIL`/`BRENT` → (not supported yet)
- Crypto CFDs: `BTCUSD` → flag as unsupported or add crypto type later

### P1 — Should Fix Before Launch

#### 5. Fix `pipValuePerLot` for Non-USD Quote Pairs

Currently `FOREX_SPECS` has static `pipValuePerLot` values. This works for USD-quoted pairs (EUR/USD, GBP/USD) where pip value is always $10/lot. But for cross pairs (EUR/GBP, AUD/NZD), pip value depends on the quote currency exchange rate.

**Quick fix:** When calculating P&L for non-USD quote pairs, use the broker-reported `profit` value if available (which is already in the correct account currency). Only fall back to our calculation if broker profit isn't provided.

**Better fix (post-launch):** Fetch current exchange rates to convert pip values. Not critical for launch since most ICT traders focus on USD pairs.

#### 6. Auto-Detect Forex in Manual CSV Mapping

When user uploads a generic CSV and maps columns manually:
- After mapping the `symbol` column, scan the values
- If symbols match known forex patterns (6-char currency pairs, pairs with `/`), auto-switch `instrumentType` to `"forex"`
- Show a toast: "Detected forex symbols — switched to forex mode"

### P2 — Nice to Have Post-Launch

#### 7. cTrader CSV Parser

Growing platform for forex prop firms (FTMO uses it). Format is well-structured with clear position IDs. Lower priority than MT4/MT5 but next in line.

#### 8. FTMO CSV Import

FTMO is the biggest forex prop firm. They export via MT4/MT5 or cTrader, so MT4/MT5 parsers cover most FTMO users. A dedicated FTMO format parser is nice-to-have.

#### 9. DXtrade / TradeLocker Parsers

Newer prop firm platforms gaining traction. Can follow later based on user demand.

## Technical Notes

### What Already Works for Forex (no changes needed)

- **Schema:** `instrumentTypeEnum` on trades table, `defaultInstrumentType` on accounts
- **Calculations:** `calculatePips()`, `calculateAllStats()` with forex branch, `calculateMAEMFE()` with forex point values, R-multiple with forex
- **Symbols:** 28 forex pairs in `FOREX_SYMBOLS`, pip specs in `FOREX_SPECS`, `getForexPipSize()`, `calculateForexPnL()`
- **Market data:** Twelve Data supports all forex pairs. TradingView mapping works (`FX:EURUSD`)
- **UI — Trade detail:** Stats panel shows pips for forex. Execution timeline shows "lots". Running P&L, replay — all forex-aware
- **UI — Manual trade entry:** Futures/Forex toggle, symbol picker, lot size labels
- **Analytics router:** All 25+ endpoints select and pass `instrumentType`
- **Settings:** `defaultInstrumentType` configurable per user

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/trades/csv-parsers/mt4-parser.ts` | Implement (replace stub) |
| `src/lib/trades/csv-parsers/symbol-normalizer.ts` | Create new |
| `src/app/(protected)/import/page.tsx` | Inherit instrumentType from account |

### Testing

- Test with real MT4 CSV exports from at least 2 different brokers (suffix variations)
- Test with MT5 deals export (the grouping logic is the tricky part)
- Test partial closes, swaps, pending orders being skipped
- Test cross-pair P&L accuracy against broker-reported values
- Test mixed account: futures trades + forex trades on same account (should both work)

## Success Metrics

- Forex trader can import 100+ trades from MT4/MT5 CSV with zero manual fixes
- P&L matches broker-reported values within 1% for USD-quoted pairs
- Symbol normalization handles top 5 broker suffix patterns without config
- Import-to-analytics flow works end-to-end for forex trades

## What This Unlocks

- ~50% more addressable market (forex ICT/SMC traders)
- Foundation for MT4/MT5 auto-sync later (same symbol normalization, same parsing logic)
- FTMO and other forex prop firm users can evaluate EdgeJournal
- Marketing can truthfully say "supports forex and futures" at launch
