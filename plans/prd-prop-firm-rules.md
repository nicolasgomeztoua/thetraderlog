# PRD: Prop Firm Rules Engine

## Overview
Build a prop firm rules monitoring system for EdgeJournal. Provides pre-built rule templates per prop firm (Topstep, Apex, FTMO, MFF, Custom), calculates real-time rule status from trade data, and shows dashboard widgets with green/yellow/red status indicators.

## Scope Decisions
- All 4 firms + Custom option in v1
- Position size tracking included (calculate max concurrent position from trade entries/exits)
- Visual indicators only for v1 (toast notifications as fast-follow)
- Template pre-fills but editable with "Reset to default" button
- Days remaining countdown with color-coded urgency
- NO new database tables — calculate status on-demand from trades (accounts table already has all needed fields)
- New fields: `propFirmId` and `maxPositionSize` added to accounts table

## Architecture
- **Constants**: `src/lib/constants/prop-firms.ts` — templates with firm rules per account size
- **Calculator**: `src/lib/prop-firm/calculator.ts` — pure functions for rule calculations
- **tRPC Router**: `src/server/api/routers/propFirm.ts` — status calculation endpoints
- **Dashboard Widget**: `src/components/dashboard/widgets/prop-firm-status-widget.tsx`
- **Account Form Enhancement**: Template selector in settings account form
- **Tests**: `tests/integration/prop-firm-calculator.test.ts`

## Prop Firm Templates

### Topstep
- $50K: Max DD $2,000 (trailing), Daily Loss $1,000, PT $3,000, Max 5 contracts
- $100K: Max DD $3,000 (trailing), Daily Loss $2,000, PT $6,000, Max 10 contracts
- $150K: Max DD $4,500 (trailing), Daily Loss $3,000, PT $9,000, Max 15 contracts
- Consistency: No single day > 50% of total profit. Min 5 trading days.

### Apex Trader Funding
- $50K: Trailing DD $2,500 (EOD), PT $3,000, Max 4 contracts
- $100K: Trailing DD $3,000 (EOD), PT $6,000, Max 12 contracts
- $150K: Trailing DD $5,000 (EOD), PT $9,000, Max 14 contracts
- $300K: Trailing DD $7,500 (EOD), PT $20,000, Max 25 contracts
- No daily loss limit, no consistency rule.

### FTMO
- $10K–$200K: Max DD 10% (static), Daily DD 5%, PT 10% (challenge) / 5% (verification)
- Time limit: 30 days challenge, 60 days verification. Min 4 trading days.
- Profit split: 80%.

### MyFundedFutures
- $50K: Max DD $2,000 (EOD trailing), Daily Loss $1,000, No explicit PT
- $100K: Max DD $3,000 (EOD trailing), Daily Loss $2,000, No explicit PT
- Consistency: No single day > 35% of total P&L. Min 3 trading days.

## User Stories

### US-001: Prop Firm Constants & Types
Define TypeScript constants and types for prop firm templates.
- Create `src/lib/constants/prop-firms.ts` with template definitions
- Create types: `PropFirm`, `PropFirmTemplate`, `AccountSize`, `PropFirmRules`
- Include all 4 firms with their account sizes and rules
- Export `PROP_FIRM_TEMPLATES` constant array
- Add `Custom` firm option with empty/default rules
- **AC**: Importing `PROP_FIRM_TEMPLATES` returns array of 5 firms. Each firm has `id`, `name`, `sizes[]` with rules per size.

### US-002: Add maxPositionSize and propFirmId to Schema
Add `maxPositionSize` integer and `propFirmId` text fields to accounts table.
- Add `maxPositionSize` (integer, nullable) to accounts schema
- Add `propFirmId` (text, nullable) to accounts schema — stores which template was used
- Run `db:push` to apply
- Update account type exports
- **AC**: Schema has new fields. `bun run db:push` succeeds.

### US-003: Prop Firm Calculator — Drawdown Functions
Create pure calculation functions for max drawdown (static, trailing, EOD trailing).
- Create `src/lib/prop-firm/calculator.ts`
- `calculateStaticDrawdown(trades, initialBalance)` → { currentEquity, maxDrawdown, drawdownFloor, currentDrawdownPercent }
- `calculateTrailingDrawdown(trades, initialBalance)` → { currentEquity, peakEquity, drawdownFloor, currentDrawdown }
- `calculateEodTrailingDrawdown(trades, initialBalance)` → same but only updates floor at EOD
- All functions accept sorted trades with netPnl, use fees, handle partial exits
- **AC**: Functions return correct values for test scenarios. Pure functions, no DB access.

### US-004: Prop Firm Calculator — Daily Loss, Profit Target, Position Size
Create remaining calculation functions.
- `calculateDailyPnl(trades, date, timezone)` → { dailyPnl, dailyPnlPercent }
- `calculateProfitTarget(trades, initialBalance, targetAmount)` → { totalPnl, progress, isComplete }
- `calculateConsistencyRule(trades, maxDayPercent)` → { bestDayPnl, bestDayPercent, isCompliant, violatingDays }
- `calculateMinTradingDays(trades)` → { uniqueDays, isComplete }
- `calculateMaxPosition(trades)` → { maxConcurrentContracts } — from overlapping entry/exit times
- `calculateDaysRemaining(startDate, endDate)` → { daysTotal, daysRemaining, daysElapsed, urgency }
- **AC**: Functions return correct values. Edge cases: no trades (all green), midnight-spanning trades.

### US-005: Prop Firm Calculator — Status Aggregator
Create a function that aggregates all rule checks into a single status object.
- `calculatePropFirmStatus(account, trades)` → `PropFirmStatus`
- PropFirmStatus has: `rules[]` where each rule has `{ type, label, currentValue, limit, percentage, status: 'safe'|'warning'|'danger'|'violated' }`
- Thresholds: safe (<80%), warning (80-90%), danger (90%+), violated (>=100%)
- Skip rules that don't apply (e.g., no daily loss limit for Apex)
- Include days remaining if challengeEndDate is set
- Include profit target progress
- **AC**: Returns complete status object. Status colors match thresholds.

### US-006: Integration Tests for Calculator
Write integration tests for all calculator functions.
- Create `tests/integration/prop-firm-calculator.test.ts`
- Test each drawdown type with realistic trade sequences
- Test edge cases: no trades, single trade, trades with fees, partial exits
- Test daily loss across midnight boundary
- Test consistency rule with violating day
- Test max position with overlapping trades
- Test status aggregator end-to-end
- Use existing test fixtures (`setupTraderWithTrades`)
- **AC**: All tests pass. Coverage for all calculator functions.

### US-007: Prop Firm tRPC Router
Create tRPC router for prop firm status.
- Create `src/server/api/routers/propFirm.ts`
- `getStatus` procedure: takes accountId, fetches account + trades, runs calculator, returns PropFirmStatus
- `getTemplates` procedure: returns PROP_FIRM_TEMPLATES (could be client-only but server ensures consistency)
- Register router in `src/server/api/root.ts`
- Validate account belongs to user, is prop_challenge or prop_funded
- **AC**: `propFirm.getStatus` returns status for a prop account. `propFirm.getTemplates` returns template list.

### US-008: Account Form — Template Selector
Add prop firm template selection to the account creation/edit form.
- When accountType is `prop_challenge` or `prop_funded`, show "Prop Firm" dropdown
- Selecting a firm shows available account sizes
- Selecting size auto-fills: maxDrawdown, drawdownType, dailyLossLimit, profitTarget, consistencyRule, minTradingDays, maxPositionSize
- Fields remain editable after template fill
- "Reset to Default" button restores template values
- Save `propFirmId` to account for tracking which template was used
- **AC**: Selecting Topstep $50K auto-fills all fields. Fields are editable. Reset works.

### US-009: Prop Firm Status Dashboard Widget
Create dashboard widget showing prop firm rule status.
- Create `src/components/dashboard/widgets/prop-firm-status-widget.tsx`
- Shows each rule as a labeled progress bar with color (green/yellow/red)
- Compact view: shows account name, overall status badge, key metrics
- Expandable: click to see all rules with details
- If no prop accounts, show "No prop firm accounts configured" with link to settings
- Multiple prop accounts: show selector or stack vertically
- Use Terminal design system (monospace, chartreuse accent, dark bg)
- **AC**: Widget renders for prop accounts. Colors match thresholds. Links to settings.

### US-010: Dashboard Integration
Wire prop firm widget into the main dashboard page.
- Add PropFirmStatusWidget to dashboard grid
- Only show if user has at least one prop account
- Position prominently (top area) when visible
- Add to accounts router: `getAll` should return propFirmId and maxPositionSize
- Update updateAccountSchema to include new fields
- **AC**: Widget appears on dashboard for users with prop accounts. Hidden for others.

### US-011: Error Constants and Polish
Add error messages and finalize the feature.
- Add prop firm error messages to `src/lib/constants/errors.ts`
- Add prop firm constants exports to `src/lib/constants/index.ts`
- Ensure all edge cases handled: failed/passed challenges show final status
- challengeStatus 'passed' or 'failed' → show locked status (no more updates)
- **AC**: Error messages follow project conventions. Failed/passed accounts show appropriate final state.
