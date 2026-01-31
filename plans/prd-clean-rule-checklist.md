# PRD: Clean Up Trade Rule Checklist

## Overview

Remove visual noise from the trade rule checklist by eliminating AUTO/SEMI/MANUAL badges and hiding rules that weren't relevant to the trade's outcome (e.g., "Breakeven at 1R" when trade never reached 1R).

## Goals

- Remove meaningless AUTO/SEMI/MANUAL badges from both checklist and strategy display
- Only show rules where the trigger condition was actually met during the trade
- Cleaner, more focused checklist that shows actionable items only

## User Stories

### US-001: Add isRuleRelevant Function
**Description**: As a developer, I want a utility function that determines if a rule was relevant to a specific trade based on MFE, so that irrelevant rules can be filtered out.

**Acceptance Criteria**:
- [ ] Add `isRuleRelevant(condition: AutoCondition, mfeR: number | null): boolean` to `src/lib/strategy/evaluation.ts`
- [ ] Returns `true` for always-relevant rules: maxRiskPerTrade, minRRRatio, dailyLossLimit, maxConcurrentPositions
- [ ] Returns `mfeR >= triggerR` for breakevenTrigger
- [ ] Returns `mfeR >= targetR` for scaleOutAtR
- [ ] Returns `mfeR >= triggerR` for trailingStopTrigger
- [ ] Returns `true` for unknown condition types (safe default)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-002: Update getTradeRuleChecks to Return Relevance Data
**Description**: As a frontend, I want the getTradeRuleChecks endpoint to include relevance information so that I can filter which rules to display.

**Acceptance Criteria**:
- [ ] Modify `getTradeRuleChecks` in `src/server/api/routers/strategies.ts`
- [ ] Calculate MFE in R for the trade using existing `calculateMfeInR()`
- [ ] For each rule with `autoCondition`, call `isRuleRelevant()`
- [ ] Add `relevantRuleIds: string[]` to the response object
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

### US-003: Integration Tests for Relevance Logic
**Description**: As a developer, I want integration tests for the rule relevance logic to verify correct filtering behavior.

**Acceptance Criteria**:
- [ ] Add tests to `tests/integration/strategies.test.ts` (or create new file if needed)
- [ ] Test: Rule with `breakevenTrigger` at 1R is relevant when MFE >= 1R
- [ ] Test: Rule with `breakevenTrigger` at 1R is NOT relevant when MFE < 1R
- [ ] Test: Risk rules (maxRiskPerTrade, etc.) are always relevant
- [ ] Test: Trade with no MFE data still returns risk rules as relevant
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

### US-004: Remove Badges from RuleChecklist Component
**Description**: As a user, I want the trade checklist to not show AUTO/SEMI/MANUAL badges so that I see a cleaner interface.

**Acceptance Criteria**:
- [ ] Remove `RuleTypeBadge` component definition (lines 85-135) from `src/components/strategy/rule-checklist.tsx`
- [ ] Remove `RuleTypeBadge` usage (lines 370-377)
- [ ] Remove unused imports: `Zap`, `Info`, `RotateCcw` from lucide-react
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: Trade checklist no longer shows badges

### US-005: Filter Irrelevant Rules in RuleChecklist
**Description**: As a user, I want the trade checklist to only show rules that were relevant to my trade so that I focus on what matters.

**Acceptance Criteria**:
- [ ] Update `RuleChecklist` component to accept `relevantRuleIds` prop
- [ ] Filter rules before rendering to only include those in `relevantRuleIds`
- [ ] Update the component's query call to use the new response field
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: Rules that weren't triggered don't appear

### US-006: Remove Badges from StrategyRulesDisplay Component
**Description**: As a user, I want the strategy rules display to not show AUTO/SEMI/MANUAL badges.

**Acceptance Criteria**:
- [ ] Remove `RULE_TYPE_CONFIG` constant (lines 54-77) from `src/components/strategy/strategy-rules-display.tsx`
- [ ] Remove `RuleTypeBadge` component (lines 78-94)
- [ ] Remove badge rendering usage (around line 220)
- [ ] Remove unused imports: `Zap`, `Info` from lucide-react
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: Strategy display no longer shows badges

## Functional Requirements

1. **FR-001**: Rules with R-based triggers (breakeven, scale-out, trailing) only appear when trade MFE reached that R-level
2. **FR-002**: Risk management rules (max risk, min R:R, daily loss, concurrent positions) always appear
3. **FR-003**: No AUTO/SEMI/MANUAL badges displayed anywhere in the UI
4. **FR-004**: Rules without autoCondition (pure manual rules) always appear

## Non-Goals (Out of Scope)

- Changing the underlying rule evaluation logic
- Modifying how rules are stored or generated
- Changing the rule checking/saving behavior
- Adding new rule types

## Technical Considerations

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/strategy/evaluation.ts` | Add `isRuleRelevant()` function |
| `src/server/api/routers/strategies.ts` | Return `relevantRuleIds` from `getTradeRuleChecks` |
| `src/components/strategy/rule-checklist.tsx` | Remove badges, filter by relevance |
| `src/components/strategy/strategy-rules-display.tsx` | Remove badges |

### Relevance Logic

```typescript
export function isRuleRelevant(
  condition: AutoCondition,
  mfeR: number | null,
): boolean {
  switch (condition.type) {
    case "breakevenTrigger":
      return mfeR !== null && mfeR >= condition.triggerR;
    case "scaleOutAtR":
      return mfeR !== null && mfeR >= condition.targetR;
    case "trailingStopTrigger":
      return mfeR !== null && mfeR >= condition.triggerR;
    // Always relevant:
    case "maxRiskPerTrade":
    case "minRRRatio":
    case "dailyLossLimit":
    case "maxConcurrentPositions":
      return true;
    default:
      return true;
  }
}
```

## Success Metrics

- No AUTO/SEMI/MANUAL badges visible in trade checklist
- Irrelevant rules (R-triggers not met) hidden from checklist
- All tests pass
- No regressions in rule checking/saving functionality

## Open Questions

None - requirements are clear from the user specification.
