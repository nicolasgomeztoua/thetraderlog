# PRD: Futures CSV Parser Expansion (Ralph Loop Ready)

**Author:** TheTraderLog
**Date:** 2026-02-18
**Status:** Draft
**Priority:** High

## Overview
Build production-grade CSV parser support for the futures platforms in scope from recent research and roadmap planning, and wire them into the existing import flow so users can auto-import without manual column mapping.

## Scope
In scope (futures-focused):
- ProjectX (already implemented; keep as reference baseline)
- TopstepX
- NinjaTrader
- Tradovate
- Rithmic (R | Trader)
- Apex (adapter to underlying export format, not a unique native schema)

Out of scope for this PRD:
- cTrader HTML parser
- TradingView parser
- MT4/MT5 full parser implementation
- Direct broker APIs / OAuth sync

## Source Inputs (Research Pack)
- `docs/research/futures-platform-csvs/deep-research.md`
- `docs/research/futures-platform-csvs/platform-research.csv`
- `docs/research/futures-platform-csvs/platforms/ninjatrader.csv`
- `docs/research/futures-platform-csvs/platforms/tradovate.csv`
- `docs/research/futures-platform-csvs/platforms/rithmic-rtrader-full.csv`
- `docs/research/futures-platform-csvs/platforms/topstepx.csv`
- `docs/research/futures-platform-csvs/platforms/projectx.csv`
- `docs/research/futures-platform-csvs/platforms/apex-via-rithmic-completed-orders.csv`

## Goals
- Add parser coverage for all futures platforms in scope.
- Ensure parser output is normalized to `ParsedTrade` with reliable direction, timestamps, prices, and quantity.
- Reduce manual mapping usage for supported platforms.
- Ship tests that prevent parser regressions.

## Non-Goals
- Perfect reconstruction of every order event (focus on correct trade import output).
- Live streaming/import sync.
- New analytics or UI redesign beyond import support needs.

## Technical Approach
- Keep parser modules in `src/lib/trades/csv-parsers/`.
- Extend platform enums/types to include futures platform values needed for account-level parser routing.
- Add parser fixtures from research samples into tests.
- Implement one parser per platform with isolated tests.
- Add Apex adapter parser that delegates by detected schema (Rithmic/Tradovate/ProjectX-like), since Apex has no stable unique CSV format.
- Improve import flow to attempt `detectPlatform` fallback when account platform parser is unavailable.

## Parser-Specific Requirements

### NinjaTrader
- Parse execution-level rows from `Instrument,Action,Quantity,Price,Time,ID,E/X,...`.
- Build closed trades from entry/exit execution groups.
- Preserve commissions as fees when available.

### Tradovate
- Parse order export schema (`orderId, Account, Order ID, B/S, Contract, ...`).
- Ignore canceled/unfilled rows.
- Build filled trade records with symbol normalization.
- Handle missing commissions gracefully.

### Rithmic
- Parse mixed-section files and only consume `Completed Orders` section.
- Ignore `Working Orders` block.
- Build trades from filled completed rows.

### TopstepX
- Parse ProjectX-like schema plus optional `TradeDay`.
- Reuse existing ProjectX parser logic where possible.

### Apex
- No unique Apex CSV parser contract.
- Implement adapter parser that routes based on headers to Rithmic/Tradovate/ProjectX-family parser behavior.

## Acceptance (Release-Level)
- Supported futures platforms in scope parse without manual mapping for standard export files.
- Import preview displays parsed trades with correct symbol/direction/entry/exit/qty for each platform sample.
- Unit tests cover parser success and core edge cases.
- Integration tests validate batch import with parsed outputs.
- `bun run check`, `bun run test`, and `bun run build` pass.

## Ralph Story Breakdown
The Ralph execution manifest for this PRD is at:
- `scripts/ralph/prd.futures-parser-expansion.json`

Stories are sized for one-iteration completion and follow priority order.

