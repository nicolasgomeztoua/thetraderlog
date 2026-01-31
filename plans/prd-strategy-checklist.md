# PRD: Auto-Trackable Strategy Checklist System

## Overview

Transform strategy form fields (risk parameters, scaling rules, trailing rules) into toggleable checklist items that can be either manually checked or automatically evaluated based on trade data. This enhances the existing rule compliance system with intelligent auto-tracking.

## Goals

- Every strategy config field becomes a potential checklist item via toggle switches
- Auto-evaluate rules where data exists (breakeven at 1R, max risk, min R:R, etc.)
- Manual tracking for complex rules (ATR-based, swing low, custom)
- Integrate with existing compliance scoring on trade detail page

---

## User Stories

### US-001: Schema Changes for Auto-Trackable Rules
**Description**: As a developer, I want to extend the database schema to support auto-trackable rules so that we can store evaluation metadata and rule generation info.

**Acceptance Criteria**:
- [ ] Add to `strategyRules` table:
  - `ruleType` enum (manual/auto/semi_auto) with default 'manual'
  - `configSource` text (e.g., "riskParameters.maxRiskPerTrade")
  - `autoCondition` text for JSON evaluation parameters
  - `isGenerated` boolean (default false)
  - `sourceConfigHash` text for change detection
- [ ] Add to `tradeRuleChecks` table:
  - `evaluationResult` text for JSON evaluation details
  - `wasAutoEvaluated` boolean (default false)
  - `userOverride` boolean (nullable)
- [ ] Create `ruleTypeEnum` pgEnum in schema
- [ ] Run `bun run db:push` successfully
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/server/db/schema.ts`

---

### US-002: Auto-Evaluation Types
**Description**: As a developer, I want TypeScript types for the rule evaluation system so that the codebase is type-safe and self-documenting.

**Acceptance Criteria**:
- [ ] Create `/src/lib/strategy/types.ts` with:
  - `RuleType` = "manual" | "auto" | "semi_auto"
  - `AutoConditionType` union for all condition types
  - Individual condition interfaces:
    - `MaxRiskPerTradeCondition` (limitType, limitValue)
    - `MinRRRatioCondition` (minRatio)
    - `BreakevenTriggerCondition` (triggerR, offsetTicks, tolerance)
    - `ScaleOutAtRCondition` (triggerR, expectedSizePercent, tolerancePercent)
    - `DailyLossLimitCondition` (limitType, limitValue)
    - `MaxConcurrentPositionsCondition` (maxPositions)
    - `TrailingStopTriggerCondition` (triggerR, method, value)
  - `AutoCondition` discriminated union
  - `AutoEvaluationResult` interface (passed, actual, expected, details, evaluatedAt, dataQuality)
  - `GeneratedRule` interface (text, category, ruleType, configSource, autoCondition, sourceConfigHash)
- [ ] Export all types from index
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/lib/strategy/types.ts` (new), `src/lib/strategy/index.ts` (new or update)

---

### US-003: Rule Generation Service
**Description**: As a developer, I want a service that generates rules from strategy configuration so that config fields automatically become checklist items.

**Acceptance Criteria**:
- [ ] Create `/src/lib/strategy/rule-generator.ts`
- [ ] Implement `generateRulesFromConfig(riskParams, scalingRules, trailingRules): GeneratedRule[]`
- [ ] Generate rules for enabled config fields:
  - Max risk per trade → auto rule
  - Min R:R ratio → auto rule
  - Daily loss limit → auto rule
  - Max concurrent positions → auto rule
  - Move to breakeven → auto rule
  - Scale out at XR → auto if R-level parseable from trigger text
  - Scale in rules → manual
  - Trailing stops (fixed ticks) → semi_auto
  - Trailing stops (ATR/swing) → manual
- [ ] Implement `hashConfig(config): string` for change detection (MD5 first 16 chars)
- [ ] Parse R-level from trigger text with regex (e.g., "+1R" → 1.0)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/lib/strategy/rule-generator.ts` (new)

---

### US-004: Unit Tests for Rule Generator
**Description**: As a developer, I want unit tests for the rule generator so that we verify correct rule generation from config.

**Acceptance Criteria**:
- [ ] Create `tests/unit/rule-generator.test.ts`
- [ ] Test: Risk config with all fields enabled generates correct rules
- [ ] Test: Disabled fields do not generate rules
- [ ] Test: Scale out rule with "At +1R take 50%" parses R-level correctly
- [ ] Test: Scale in rules generate as manual type
- [ ] Test: Trailing stop ATR generates as manual, fixed ticks as semi_auto
- [ ] Test: Hash changes when config changes
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

**Files**: `tests/unit/rule-generator.test.ts` (new)

---

### US-005: Update RiskParameters Interface with Enabled Toggles
**Description**: As a developer, I want to add enabled flags to risk parameter fields so that users can toggle which fields become rules.

**Acceptance Criteria**:
- [ ] Update `RiskParameters` interface in `risk-config.tsx`:
  - `positionSizing.enabled?: boolean`
  - `maxRiskPerTrade.enabled?: boolean`
  - `dailyLossLimit.enabled?: boolean`
  - `maxConcurrentPositionsEnabled?: boolean`
  - `minRRRatioEnabled?: boolean`
- [ ] Update Zod schema in strategies router to accept new fields
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/components/strategy/risk-config.tsx`, `src/server/api/routers/strategies.ts`

---

### US-006: Add Toggle Switches to Risk Config UI
**Description**: As a user, I want toggle switches next to each risk config field so that I can choose which become checklist rules.

**Acceptance Criteria**:
- [ ] Add Switch component next to each field group header
- [ ] Toggle label: "Track as rule" in `font-mono text-[9px] text-muted-foreground`
- [ ] Switch follows Terminal design (use existing Switch from shadcn)
- [ ] Toggle state binds to `enabled` field in form data
- [ ] Fields: Position sizing, Max risk per trade, Daily loss limit, Max positions, Min R:R
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: toggles render and persist on save

**Files**: `src/components/strategy/risk-config.tsx`

---

### US-007: Update ScalingRules Interface with Enabled Toggles
**Description**: As a developer, I want enabled flags on scaling rules so that each scale-in/out rule can be toggled.

**Acceptance Criteria**:
- [ ] Update `ScalingRules` interface:
  - `scaleIn[].enabled?: boolean`
  - `scaleOut[].enabled?: boolean`
- [ ] Update Zod schema to accept new fields
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/components/strategy/scaling-config.tsx`, `src/server/api/routers/strategies.ts`

---

### US-008: Add Toggle Switches to Scaling Config UI
**Description**: As a user, I want toggles on each scaling rule so that I can choose which become checklist items.

**Acceptance Criteria**:
- [ ] Each scale-in rule row gets a toggle switch
- [ ] Each scale-out rule row gets a toggle switch
- [ ] Compact toggle design to fit in rule row
- [ ] Toggle state binds to rule's `enabled` field
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

**Files**: `src/components/strategy/scaling-config.tsx`

---

### US-009: Update TrailingRules Interface with Enabled Toggles
**Description**: As a developer, I want enabled flags on trailing rules so that each can be toggled for tracking.

**Acceptance Criteria**:
- [ ] Update `TrailingRules` interface:
  - `moveToBreakeven.enabled?: boolean`
  - `trailStops[].enabled?: boolean`
- [ ] Update Zod schema to accept new fields
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/components/strategy/trailing-config.tsx`, `src/server/api/routers/strategies.ts`

---

### US-010: Add Toggle Switches to Trailing Config UI
**Description**: As a user, I want toggles on trailing stop rules so that I can choose which become checklist items.

**Acceptance Criteria**:
- [ ] Move to breakeven section gets toggle switch
- [ ] Each trailing stop rule row gets toggle switch
- [ ] Compact toggle design consistent with scaling config
- [ ] Toggle state binds to `enabled` field
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

**Files**: `src/components/strategy/trailing-config.tsx`

---

### US-011: Sync Generated Rules Endpoint
**Description**: As a developer, I want a tRPC endpoint to sync auto-generated rules with strategy config so that rules stay in sync with configuration.

**Acceptance Criteria**:
- [ ] Add `syncGeneratedRules` mutation to strategies router
- [ ] Input: `{ strategyId: z.string() }`
- [ ] Fetch strategy with parsed JSON configs
- [ ] Call `generateRulesFromConfig()` to get desired rules
- [ ] Compare with existing `isGenerated: true` rules by `configSource`
- [ ] Add new rules, update changed rules (by hash mismatch), delete orphaned rules
- [ ] Preserve manual rules (isGenerated: false)
- [ ] Return `{ added: number, updated: number, deleted: number }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/server/api/routers/strategies.ts`

---

### US-012: Integrate Rule Sync into Strategy Save
**Description**: As a developer, I want rules to sync automatically when a strategy is saved so that config changes immediately reflect in rules.

**Acceptance Criteria**:
- [ ] After `strategies.create` inserts strategy, call rule sync logic
- [ ] After `strategies.update` updates strategy, call rule sync logic
- [ ] Sync happens in same transaction where possible
- [ ] Generated rules appear immediately in strategy detail
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify: Create strategy with enabled config, rules appear

**Files**: `src/server/api/routers/strategies.ts`

---

### US-013: Integration Tests for Rule Sync
**Description**: As a developer, I want integration tests for rule syncing so that we verify the sync logic works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/integration/strategy-rules-sync.test.ts`
- [ ] Test: Creating strategy with enabled config generates rules
- [ ] Test: Updating config value updates rule text
- [ ] Test: Disabling config deletes generated rule
- [ ] Test: Manual rules are not affected by sync
- [ ] Test: Hash prevents unnecessary updates
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

**Files**: `tests/integration/strategy-rules-sync.test.ts` (new)

---

### US-014: Auto-Evaluation Engine - Core Evaluators
**Description**: As a developer, I want evaluation functions for each auto-trackable condition so that trades can be automatically checked against rules.

**Acceptance Criteria**:
- [ ] Create `/src/lib/strategy/evaluation.ts`
- [ ] Implement `evaluateAutoCondition(condition, trade, context): AutoEvaluationResult` dispatcher
- [ ] Implement evaluators:
  - `evaluateMaxRiskPerTrade` - abs(entry-stop) * pointValue * qty <= limit
  - `evaluateMinRRRatio` - plannedRR >= minRatio
  - `evaluateBreakevenTrigger` - if MFE >= triggerR, check trailedStopLoss >= entry
  - `evaluateScaleOutAtR` - find TradeExecutions near target price
  - `evaluateDailyLossLimit` - sum day's trades P&L > -limit
  - `evaluateMaxConcurrentPositions` - count open trades at entry <= max
- [ ] Define `EvaluationContext` interface (executions, dayTrades, concurrentTrades, mfeR)
- [ ] Handle missing data: return dataQuality: "unavailable" gracefully
- [ ] Reuse existing calculations from `src/lib/trades/calculations.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/lib/strategy/evaluation.ts` (new)

---

### US-015: Build Evaluation Context Helper
**Description**: As a developer, I want a helper to build evaluation context so that endpoints can easily get required data.

**Acceptance Criteria**:
- [ ] Add `buildEvaluationContext(db, trade, userId): Promise<EvaluationContext>` in evaluation.ts
- [ ] Fetch trade executions
- [ ] Fetch other trades on same calendar day (for daily loss limit)
- [ ] Count trades that were open at trade's entry time (for max concurrent)
- [ ] Calculate MFE in R-multiples if stopLoss exists
- [ ] Efficient queries (minimize DB round trips)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/lib/strategy/evaluation.ts`

---

### US-016: Evaluate Trade Rules Endpoint
**Description**: As a developer, I want a tRPC endpoint to auto-evaluate rules for a trade so that the UI can trigger evaluation.

**Acceptance Criteria**:
- [ ] Add `evaluateTradeRules` mutation to strategies router
- [ ] Input: `{ tradeId: z.string() }`
- [ ] Validate trade ownership and has strategy
- [ ] Build evaluation context
- [ ] Loop through strategy rules where ruleType !== 'manual'
- [ ] Call evaluateAutoCondition for each
- [ ] Upsert tradeRuleChecks with:
  - `checked` = result.passed
  - `evaluationResult` = JSON.stringify(result)
  - `wasAutoEvaluated` = true
- [ ] Return `{ evaluated: number, results: AutoEvaluationResult[] }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

**Files**: `src/server/api/routers/strategies.ts`

---

### US-017: Integration Tests for Auto-Evaluation
**Description**: As a developer, I want integration tests for the evaluation engine so that we verify evaluators return correct results.

**Acceptance Criteria**:
- [ ] Create `tests/integration/strategy-evaluation.test.ts`
- [ ] Test max risk evaluator: passing case (risk below limit)
- [ ] Test max risk evaluator: failing case (risk above limit)
- [ ] Test min R:R evaluator: passing and failing
- [ ] Test breakeven evaluator: MFE reached, SL moved
- [ ] Test breakeven evaluator: MFE reached, SL not moved
- [ ] Test breakeven evaluator: MFE not reached (rule N/A)
- [ ] Test scale out evaluator with matching TradeExecution
- [ ] Test daily loss limit with multiple trades
- [ ] Test missing data returns dataQuality: "unavailable"
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

**Files**: `tests/integration/strategy-evaluation.test.ts` (new)

---

### US-018: Update Rules Display with Rule Type Badges
**Description**: As a user, I want to see which rules are auto-tracked vs manual so that I understand how compliance is calculated.

**Acceptance Criteria**:
- [ ] Add rule type badge to each rule in `strategy-rules-display.tsx`
- [ ] Badge styles:
  - AUTO: `bg-profit/20 text-profit` with Zap icon
  - SEMI: `bg-accent/20 text-accent` with Info icon
  - MANUAL: `bg-white/10 text-muted-foreground` with ArrowRight icon
- [ ] Badge text: `font-mono text-[8px]`
- [ ] Shows after category color indicator
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: badges appear correctly

**Files**: `src/components/strategy/strategy-rules-display.tsx`

---

### US-019: Enhanced Trade Checklist with Evaluation Results
**Description**: As a user, I want to see auto-evaluation results in the trade checklist so that I understand why rules passed/failed.

**Acceptance Criteria**:
- [ ] Update `rule-checklist.tsx` to show evaluation results
- [ ] For auto rules with evaluationResult:
  - Show CheckCircle (green) or XCircle (red) based on passed
  - Show "actual / expected" in `font-mono text-[10px] text-muted-foreground`
- [ ] Auto-evaluated checkboxes are disabled (checked state from evaluation)
- [ ] Add "Override" button for auto rules (enables manual check)
- [ ] Parse evaluationResult JSON from tradeRuleChecks
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

**Files**: `src/components/strategy/rule-checklist.tsx`

---

### US-020: User Override for Auto-Evaluated Rules
**Description**: As a user, I want to override auto-evaluation results so that I can correct system mistakes.

**Acceptance Criteria**:
- [ ] "Override" button toggles userOverride state
- [ ] When override active:
  - Checkbox becomes editable
  - Badge shows "OVERRIDDEN" in orange
  - User can check/uncheck
- [ ] Save override via existing `checkRule` mutation (add userOverride field)
- [ ] Update tradeRuleChecks with userOverride boolean
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

**Files**: `src/components/strategy/rule-checklist.tsx`, `src/server/api/routers/strategies.ts`

---

### US-021: Trigger Auto-Evaluation on Trade Close
**Description**: As a developer, I want rules to auto-evaluate when a trade closes so that compliance is calculated automatically.

**Acceptance Criteria**:
- [ ] In trades router, when trade status changes to 'closed':
  - Check if trade has strategyId
  - Call evaluateTradeRules logic inline (not separate endpoint call)
  - Handle errors gracefully (don't fail trade close)
- [ ] Evaluation happens after trade is saved with final data
- [ ] Works for both manual close and stop loss hit
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify: Close trade, check rule evaluations appear

**Files**: `src/server/api/routers/trades.ts`

---

### US-022: E2E Tests for Strategy Checklist Flow
**Description**: As a developer, I want E2E tests for the complete checklist flow so that we verify the feature works end-to-end.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-checklist.spec.ts`
- [ ] Test flow:
  1. Create strategy with max risk enabled toggle
  2. Verify rule appears in strategy detail with AUTO badge
  3. Create trade linked to strategy
  4. Close trade
  5. Navigate to trade detail
  6. Verify auto-evaluation result shows in checklist
  7. Override an auto-evaluated rule
  8. Verify compliance score updates
- [ ] Add data-testid attributes to new UI elements
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

**Files**: `tests/e2e/strategy-checklist.spec.ts` (new), various components for data-testid

---

## Auto-Evaluability Matrix

| Rule | Auto-Evaluable | Data Required | Notes |
|------|---------------|---------------|-------|
| Max risk per trade | YES | entry, stopLoss, quantity, symbol | Uses getPointValue() |
| Min R:R ratio | YES | entry, stopLoss, takeProfit | Uses existing calculation |
| Move to breakeven at XR | YES | MFE, trailedStopLoss, wasTrailed | Check if MFE reached trigger |
| Scale out at XR | YES | TradeExecutions | Match exit price to R-level |
| Daily loss limit | YES | Trades on same day | Sum netPnl |
| Max concurrent positions | YES | Open trades at entry time | Count open trades |
| Trailing stop (fixed ticks) | SEMI | MFE, wasTrailed | Can verify trail triggered |
| Trailing stop (ATR) | NO | ATR data unavailable | Manual only |
| Trailing stop (swing low) | NO | Pattern detection needed | Manual only |
| Scale in rules | NO | Complex triggers | Manual only |
| Custom rules | NO | Free-form text | Manual only |

---

## Technical Considerations

### Database
- New columns on existing tables (no new tables)
- JSON storage for autoCondition and evaluationResult
- Hash-based change detection for efficient syncing
- Indexes already exist on strategyId columns

### Performance
- Evaluation runs on trade close (not real-time)
- Context fetching batches DB queries where possible
- One-time evaluation per trade (cached in tradeRuleChecks)
- Generated rules sync only on strategy save

### UI/UX
- Toggles follow Terminal design system
- Clear visual distinction between rule types
- Override capability respects user agency
- Non-blocking: auto-eval doesn't prevent manual checks
- Graceful handling of missing data (show "N/A" not errors)

### Edge Cases
- Trade without stopLoss: max risk and R:R return "unavailable"
- Trade without strategy: no evaluation attempted
- MFE not calculated yet: breakeven returns "unavailable"
- No TradeExecutions: scale out returns "no exits"

---

## Verification Plan

1. **Unit tests**: Rule generator (US-004)
2. **Integration tests**: Rule sync (US-013), Evaluation (US-017)
3. **E2E tests**: Full flow (US-022)
4. **Manual testing checklist**:
   - Create strategy, enable max risk toggle, save
   - Verify rule appears with AUTO badge
   - Create trade linked to strategy with stop loss
   - Close trade
   - Navigate to trade detail → Strategy tab
   - Verify evaluation result shows (green check or red X with values)
   - Click Override, change checkbox, verify persists
   - Check compliance % reflects auto-evaluation

---

## Non-Goals (Out of Scope)

- Real-time price monitoring during open trades
- ATR-based calculations (requires additional data feed)
- Swing low/high pattern detection (requires complex analysis)
- Blocking trade entry based on rule violations
- Automated trade execution based on rules
- Historical backfill of evaluation for existing trades
