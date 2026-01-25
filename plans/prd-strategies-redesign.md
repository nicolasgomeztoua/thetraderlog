# PRD: Strategies Page Redesign

## Overview

A comprehensive redesign of EdgeJournal's strategies section focusing on three core areas: (1) reimagining the strategies list page with a data-dense, elegant layout, (2) creating a refined creation wizard with step-by-step guidance, and (3) building a spacious, delightful editing experience.

**Critical Focus**: Every input field must either be manually checkable OR auto-validated against trade data. No decorative inputs that store data but do nothing.

## Goals

- Create an elegant, data-dense strategies list page following Terminal design patterns
- Build a guided creation wizard that feels intuitive and professional
- Design a spacious edit page with smooth input interactions
- Fix input handling: allow null values, validate on blur/save, support decimals where appropriate
- Fix placeholder styling to clearly distinguish from actual values
- **Remove non-functional inputs**: Eliminate scaling/trailing rule configs that can't be validated
- **Add auto-compliance**: Risk parameters that CAN be validated get auto-checked against trades

## Conditional Checklist Items (Key Insight)

Some rules can't be auto-VERIFIED but CAN be conditionally SHOWN based on trade performance:

### How It Works
1. User sets rule: "Move to breakeven after 1R"
2. Trade closes at 1.5R (achieved >= 1R threshold)
3. System shows checklist item: "Did you move to breakeven after hitting 1R?"
4. User manually checks yes/no

This is different from auto-compliance (which verifies without user input). These are **conditional manual checklists** - the right questions surface at the right time based on trade performance.

### Rules That Become Conditional Checklists

| Rule Type | Trigger Condition | Checklist Item Shown |
|-----------|-------------------|----------------------|
| Move to Breakeven | Trade achieved >= X R | "Did you move stop to breakeven after hitting {X}R?" |
| Trail Stops | Trade achieved >= X R | "Did you trail your stop after hitting {X}R?" |
| Scale Out | Trade achieved >= X R | "Did you scale out at {X}R?" |

### Data Available to Check Triggers
- `rMultiple`: Calculated from trade's netPnl and initial risk
- `mfePrice` / `mfeAmount`: Max favorable excursion (how far trade went in your favor)

Since we have R-multiple data, we CAN determine if the trigger condition was met. We just can't verify the user's ACTION - that's why it's a manual checklist.

## What Gets Enhanced (Validatable Parameters)

These risk parameters CAN be auto-validated against trade data:

| Parameter | Trade Data Used | Auto-Check Logic |
|-----------|-----------------|------------------|
| Min R:R Ratio | entry, stopLoss, takeProfit | `plannedRR = (TP - entry) / (entry - SL) >= minRR` |
| Max Risk Per Trade ($) | entry, stopLoss, quantity, symbol specs | `risk = (entry - SL) * qty * pointValue <= maxRisk` |
| Max Risk Per Trade (%) | Same + account balance | `riskPercent = risk / accountBalance <= maxRiskPct` |
| Daily Loss Limit | Sum of day's netPnl | `dailyPnl >= -dailyLossLimit` |
| Max Concurrent Positions | Count open trades at entry time | `openPositions <= maxConcurrent` |

## What Becomes Conditional Checklists

These parameters generate checklist items when R-multiple thresholds are met:

| Parameter | Trigger | Generated Checklist |
|-----------|---------|---------------------|
| Move to Breakeven | achievedR >= triggerR | "Did you move SL to breakeven after {triggerR}R?" |
| Trail Stops | achievedR >= triggerR | "Did you trail your stop after {triggerR}R?" |
| Scale Out | achievedR >= triggerR | "Did you scale out {sizePercent}% at {triggerR}R?" |
| Target R Multiples | achievedR >= targetR | Shows which targets were hit (1R, 2R, etc.) |

## User Stories

### Phase 0: Audit & Cleanup

---

### US-000: Audit Existing Form Utilities and Input Patterns

**Description**: As a developer, I want to audit existing input handling utilities before implementing the redesign so that we reuse patterns and avoid duplication.

**Acceptance Criteria**:
- [ ] Search `src/lib/` for existing form/input utilities
- [ ] Search `src/components/ui/` for input component patterns
- [ ] Search `src/hooks/` for form-related hooks (debounce, validation)
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - Existing utilities to reuse (with file:line)
  - Input patterns currently in use
  - Validation approaches
- [ ] Typecheck passes (`bun run check`)

---

### US-001: Add Strategy Constants File

**Description**: As a developer, I want centralized constants for strategy-related values so that they're not hardcoded across the codebase.

**Acceptance Criteria**:
- [ ] Create `src/lib/constants/strategies.ts`
- [ ] Export `POSITION_SIZING_METHODS`: `[{ value: "fixed", label: "Fixed Size" }, { value: "risk_percent", label: "Risk % of Account" }, { value: "kelly", label: "Kelly Criterion" }]`
- [ ] Export `RISK_TYPES`: `[{ value: "dollars", label: "Dollars ($)" }, { value: "percent", label: "Percent (%)" }]`
- [ ] Export `RULE_CATEGORIES`: manual rules `[{ value: "entry", label: "Entry" }, { value: "exit", label: "Exit" }, { value: "risk", label: "Risk" }, { value: "management", label: "Management" }]`
- [ ] Export `CONDITIONAL_RULE_TYPES`: `[{ value: "breakeven", label: "Move to Breakeven" }, { value: "trail", label: "Trail Stop" }, { value: "scale_out", label: "Scale Out" }]`
- [ ] Export `STRATEGY_CREATION_STEPS`: `["basics", "rules", "risk", "review"]`
- [ ] Export `AUTO_CHECKED_PARAMS`: `["minRRRatio", "maxRiskPerTrade", "dailyLossLimit", "maxConcurrentPositions"]`
- [ ] Export `CONDITIONAL_PARAMS`: `["moveToBreakeven", "trailStops", "scaleOut", "targetRMultiples"]`
- [ ] Re-export from `src/lib/constants/index.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### Phase 1: Input Component Enhancement

---

### US-002: Create Enhanced Number Input Component

**Description**: As a user, I want number inputs that allow clearing to empty, support decimals when needed, and validate only on blur so that I can type freely without interruption.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/number-input.tsx`
- [ ] Props: `value: number | null`, `onChange: (value: number | null) => void`, `allowDecimals?: boolean`, `decimalPlaces?: number`, `min?: number`, `max?: number`, `placeholder?: string`, `suffix?: string` (e.g., "R", "%", "$")
- [ ] Input uses `type="text"` with `inputMode="decimal"` (not `type="number"`) to allow free typing
- [ ] Value can be cleared (returns `null` to parent)
- [ ] Validates and formats only on blur, not during typing
- [ ] Shows validation error via `aria-invalid` and error border (border-destructive)
- [ ] Placeholder uses distinct styling: `text-muted-foreground/50` (half opacity of muted)
- [ ] Supports suffix display inline (e.g., "2.5 R")
- [ ] Uses Terminal design: `font-mono`, proper borders, focus states
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: can clear, type freely, validates on blur

---

### US-003: Create Enhanced Text Input Component

**Description**: As a user, I want text inputs with clear placeholder styling and proper validation feedback so that I know when a field is empty versus filled.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/text-input.tsx` (or extend existing Input)
- [ ] Props: `value: string | null`, `onChange: (value: string | null) => void`, `placeholder?: string`, `required?: boolean`, `error?: string`
- [ ] Empty string passed as `null` to parent (not empty string)
- [ ] Validates on blur, shows error state via border and message
- [ ] Placeholder uses distinct styling: `text-muted-foreground/50` (clearly different from value)
- [ ] Error message appears below input in `text-destructive font-mono text-[10px]`
- [ ] Uses Terminal design system styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: placeholder distinct, validation works

---

### US-004: Integration Tests for Input Components

**Description**: As a developer, I want unit tests for the enhanced input components so that we verify the value handling and validation behavior.

**Acceptance Criteria**:
- [ ] Create `src/components/ui/__tests__/number-input.test.tsx`
- [ ] Test: allows clearing to null
- [ ] Test: validates decimals when `allowDecimals=true`
- [ ] Test: rejects decimals when `allowDecimals=false`
- [ ] Test: validates min/max on blur
- [ ] Test: formats value with suffix on blur
- [ ] Create `src/components/ui/__tests__/text-input.test.tsx`
- [ ] Test: returns null for empty string
- [ ] Test: shows error on blur when required and empty
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 2: Auto-Compliance System

---

### US-005: Create Risk Compliance Calculator Utility

**Description**: As a developer, I want a utility that calculates compliance for validatable risk parameters so that we can auto-check trades against strategy rules.

**Acceptance Criteria**:
- [ ] Create `src/lib/strategies/risk-compliance.ts`
- [ ] Function `calculateRiskCompliance(trade: Trade, strategy: Strategy, symbolSpecs: SymbolSpecs): ComplianceResult`
- [ ] Checks:
  - `minRRRatio`: Calculate planned R:R from entry/SL/TP, compare to limit
  - `maxRiskPerTrade`: Calculate dollar risk from entry/SL/qty/specs, compare to limit
  - `targetRMultiples`: Calculate achieved R, check which targets were hit
- [ ] Returns: `{ checks: [{ param: string, passed: boolean, actual: number, limit: number }], overallCompliance: number }`
- [ ] Handles edge cases: missing SL/TP returns "unable to check"
- [ ] Uses existing symbol specs utilities from `src/lib/market-data/symbols.ts`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Add Daily Loss Limit Checker

**Description**: As a developer, I want to check if a trade violated the daily loss limit so that compliance includes intraday risk rules.

**Acceptance Criteria**:
- [ ] Add function `checkDailyLossCompliance(trade: Trade, strategy: Strategy, dailyTrades: Trade[]): ComplianceCheck`
- [ ] Calculates cumulative P&L for trades on same day (before this trade)
- [ ] Checks if taking this trade would violate daily loss limit
- [ ] Returns: `{ param: "dailyLossLimit", passed: boolean, actual: number, limit: number, note: string }`
- [ ] Note explains: "P&L was -$X before this trade, limit is -$Y"
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-007: Add Concurrent Positions Checker

**Description**: As a developer, I want to check if a trade violated max concurrent positions so that position sizing rules are enforced.

**Acceptance Criteria**:
- [ ] Add function `checkConcurrentPositions(trade: Trade, strategy: Strategy, openTrades: Trade[]): ComplianceCheck`
- [ ] Counts how many trades were open at this trade's entry time
- [ ] Compares to `maxConcurrentPositions` limit
- [ ] Returns: `{ param: "maxConcurrentPositions", passed: boolean, actual: number, limit: number }`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Integration Tests for Risk Compliance

**Description**: As a developer, I want tests for the compliance calculator so that we verify the logic is correct.

**Acceptance Criteria**:
- [ ] Create `tests/integration/risk-compliance.test.ts`
- [ ] Test: minRRRatio check with valid/invalid planned R:R
- [ ] Test: maxRiskPerTrade check with futures contract
- [ ] Test: targetRMultiples shows which targets were hit
- [ ] Test: dailyLossLimit check with multiple trades
- [ ] Test: concurrent positions check
- [ ] Test: handles missing SL/TP gracefully
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-009: Add Auto-Compliance to Trade Detail

**Description**: As a user, I want to see auto-calculated compliance on the trade detail page so that I know if I followed my strategy rules.

**Acceptance Criteria**:
- [ ] Create `src/components/trade/auto-compliance-display.tsx`
- [ ] Fetches strategy risk parameters for trade's strategy
- [ ] Runs compliance calculator for each validatable parameter
- [ ] Displays results:
  - Green checkmark + "Min R:R (2.0): Passed (actual 2.5)"
  - Red X + "Max Risk ($100): Failed (actual $150)"
  - Gray dash + "Daily Loss: Unable to check (no limit set)"
- [ ] Shows target R multiples achieved: "Hit 1R, 2R targets"
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: compliance displays on trade detail

---

### US-009b: Generate Conditional Checklists on Trade Detail

**Description**: As a user, I want to see conditional checklist items when my trade hit certain R thresholds so that I can confirm I followed my management rules.

**Acceptance Criteria**:
- [ ] Create `src/lib/strategies/conditional-checklists.ts`
- [ ] Function `generateConditionalChecklists(trade: Trade, strategy: Strategy): ConditionalChecklistItem[]`
- [ ] For Move to Breakeven rule:
  - If `trade.rMultiple >= strategy.trailingRules.moveToBreakeven.triggerR`
  - Generate: `{ type: "moveToBreakeven", text: "Did you move stop to breakeven after hitting {X}R?", triggered: true }`
- [ ] For Trail Stops rules:
  - For each trail rule where `trade.rMultiple >= rule.triggerR`
  - Generate: `{ type: "trailStop", text: "Did you trail your stop after hitting {X}R?", triggered: true }`
- [ ] For Scale Out rules:
  - For each scale rule where `trade.rMultiple >= rule.triggerR`
  - Generate: `{ type: "scaleOut", text: "Did you scale out {Y}% at {X}R?", triggered: true }`
- [ ] Items that weren't triggered (trade didn't hit threshold) marked with `triggered: false`
- [ ] Create `src/components/trade/conditional-checklist-display.tsx`
- [ ] Shows triggered items as checkable (user marks yes/no)
- [ ] Shows non-triggered items as grayed out with "Trade didn't hit {X}R"
- [ ] Saves checks to `tradeRuleChecks` table (reuse existing pattern)
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: conditional checklists appear when thresholds met

---

### Phase 3: Strategies List Page Redesign

---

### US-010: Create Strategy Stats Summary Component

**Description**: As a user, I want to see lightweight performance and compliance stats for each strategy so that I can quickly assess strategy health.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/strategy-stats-summary.tsx`
- [ ] Props: `strategyId: string`, `compact?: boolean`
- [ ] Fetches stats via `strategies.getStats` query
- [ ] Displays in compact mode (for cards): Win Rate, Total P&L, Profit Factor (3 metrics)
- [ ] Displays in full mode (for detail): adds Trades count, Avg R, Compliance %
- [ ] Compliance % calculated from both manual rule checks AND auto-compliance
- [ ] Uses profit/loss color coding: `text-profit` / `text-loss`
- [ ] Shows skeleton during loading
- [ ] Terminal design: `font-mono`, `text-[10px]` labels, `text-sm` values
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: stats display correctly with colors

---

### US-011: Redesign Strategy Card Component

**Description**: As a user, I want strategy cards that show essential info at a glance with elegant Terminal styling so that I can quickly navigate my strategies.

**Acceptance Criteria**:
- [ ] Update `src/components/strategy/strategy-card.tsx`
- [ ] Layout structure:
  - Color bar on left edge (4px wide, full height)
  - Strategy name with `font-medium text-sm`
  - Description truncated to 2 lines
  - Stats row: Win Rate | P&L | Trades (from strategy-stats-summary compact)
  - Rules count badge: "12 Rules" in `font-mono text-[10px]`
  - Active/Inactive indicator (small dot)
- [ ] Hover effect: `hover:border-white/10 hover:-translate-y-0.5 transition-all`
- [ ] Click navigates to strategy detail page
- [ ] Dropdown menu (kebab) for: Edit, Duplicate, Delete
- [ ] Terminal design: `bg-white/1`, `border-white/5`, `rounded` (not rounded-lg)
- [ ] Mobile responsive: stacks appropriately
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: card interactions work, hover effects visible

---

### US-012: Redesign Strategies List Page Layout

**Description**: As a user, I want an elegant strategies list page that shows my strategies with a performance overview so that I can manage my trading systems effectively.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/page.tsx`
- [ ] Layout structure:
  - Header: "Strategies" title with subtitle, "New Strategy" button
  - Performance summary table (existing, keep but style refresh)
  - Strategy grid: 3 columns on desktop, 2 on tablet, 1 on mobile
  - Empty state: terminal-style illustration, clear CTA
- [ ] Grid uses `gap-4` spacing
- [ ] Section headers use: `font-mono text-[11px] text-muted-foreground uppercase tracking-widest`
- [ ] New Strategy button: primary variant with Plus icon
- [ ] Terminal design throughout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: responsive layout works, navigation functional

---

### US-013: E2E Tests for Strategies List Page

**Description**: As a developer, I want E2E tests for the strategies list page so that we verify the UI works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategies-list.spec.ts`
- [ ] Test: page loads with strategies grid
- [ ] Test: empty state shows when no strategies
- [ ] Test: clicking strategy card navigates to detail
- [ ] Test: New Strategy button navigates to creation wizard
- [ ] Test: dropdown menu actions work (duplicate triggers mutation)
- [ ] All UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 4: Strategy Creation Wizard

---

### US-014: Create Multi-Step Wizard Container Component

**Description**: As a user, I want a guided wizard experience for creating strategies so that the process feels manageable and professional.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/creation-wizard/wizard-container.tsx`
- [ ] Props: `steps: WizardStep[]`, `onComplete: (data: StrategyFormData) => void`
- [ ] Step indicator at top showing: step name, step number, progress line between steps
- [ ] Current step highlighted with `text-primary`, completed steps with checkmark
- [ ] Next/Back buttons at bottom: "Back" (ghost), "Continue" or "Create Strategy" (primary)
- [ ] Continue validates current step before proceeding
- [ ] Stores form data across steps (no loss on back/forward)
- [ ] Keyboard navigation: Enter to continue (when valid)
- [ ] Terminal design: monospace step labels, subtle step indicators
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: can navigate steps, data persists

---

### US-015: Create Wizard Step 1 - Basics

**Description**: As a user, I want the first step to capture strategy name, description, and color so that I establish the strategy identity.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/creation-wizard/step-basics.tsx`
- [ ] Fields:
  - Name (required): text-input with "e.g., Trend Continuation" placeholder
  - Description (optional): textarea with 3 rows
  - Color: preset color picker (existing pattern from strategy-form)
- [ ] Validation: name is required, minimum 2 characters
- [ ] Shows validation errors below fields
- [ ] Auto-focuses name input on mount
- [ ] Terminal styling: labels in `font-mono text-[10px] uppercase tracking-wider`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: validation works, color picker works

---

### US-016: Create Wizard Step 2 - Rules

**Description**: As a user, I want the second step to define my entry/exit criteria and checklist rules so that I document my trading approach.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/creation-wizard/step-rules.tsx`
- [ ] Sections:
  - Entry Criteria: textarea for free-form entry rules
  - Exit Rules: textarea for free-form exit rules
  - Checklist Rules: dynamic list of rules with category
- [ ] Checklist rules:
  - Add button per category (Entry, Exit, Risk, Management)
  - Each rule has: category dropdown, text input, delete button
- [ ] All fields optional (can proceed with empty)
- [ ] Explain: "These rules will appear as a checklist when you log trades"
- [ ] Uses enhanced input components from Phase 1
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: can add/edit/remove rules

---

### US-017: Create Wizard Step 3 - Risk Management

**Description**: As a user, I want the third step to configure risk parameters and management rules so that I codify my trading rules.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/creation-wizard/step-risk.tsx`
- [ ] **Auto-validated parameters (checked automatically):**
  - Min R:R Ratio: number input (decimal) + help: "Auto-checked: Planned R:R must be at least X"
  - Max Risk Per Trade: type dropdown (dollars/percent) + value + help: "Auto-checked against trade risk"
  - Daily Loss Limit: type dropdown (dollars/percent) + value + help: "Auto-checked against daily P&L"
  - Max Concurrent Positions: integer + help: "Auto-checked at trade entry"
- [ ] **Conditional checklist parameters (manual check when triggered):**
  - Move to Breakeven: trigger R input + help: "Shows checklist when trade hits this R"
  - Trail Stops: trigger R input + help: "Shows checklist when trade hits this R"
  - Scale Out Rules: list of { triggerR, sizePercent } + help: "Shows checklist for each target hit"
  - Target R Multiples: list of R values + help: "Shows which targets were achieved"
- [ ] Clear distinction between auto-checked (green checkmark icon) and manual checklist (clipboard icon)
- [ ] Each field has help text explaining behavior
- [ ] All fields optional
- [ ] Uses NumberInput with `allowDecimals` where appropriate
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: all inputs work, help text visible

---

### US-018: Create Wizard Step 4 - Review

**Description**: As a user, I want a review step showing all my inputs before creating so that I can verify everything is correct.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/creation-wizard/step-review.tsx`
- [ ] Displays all entered data in read-only format:
  - Basics section: name, description, color swatch
  - Rules section: entry criteria, exit rules, checklist rules count
  - Risk section: configured parameters (only show non-empty)
- [ ] "Edit" link next to each section jumps back to that step
- [ ] Summary styled in terminal-wrapped cards
- [ ] Shows "Create Strategy" as final button label
- [ ] Note: "Risk parameters will be auto-checked against your trades"
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: review shows correct data, edit links work

---

### US-019: Create Strategy Creation Page

**Description**: As a user, I want a dedicated creation page at `/strategies/new` that hosts the wizard so that I have a clean creation experience.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/new/page.tsx`
- [ ] Uses wizard container with all 4 steps
- [ ] On complete: calls `strategies.create` mutation
- [ ] Shows loading state during creation
- [ ] On success: redirects to new strategy detail page with success toast
- [ ] On error: shows error toast, stays on review step
- [ ] Back link to strategies list
- [ ] Page title: "New Strategy"
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: full creation flow works

---

### US-020: E2E Tests for Creation Wizard

**Description**: As a developer, I want E2E tests for the creation wizard so that we verify the multi-step flow works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-creation.spec.ts`
- [ ] Test: can navigate through all steps
- [ ] Test: validation prevents proceeding without required fields
- [ ] Test: data persists when going back and forward
- [ ] Test: complete flow creates strategy and redirects
- [ ] Test: cancel/back link returns to list
- [ ] All UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 5: Strategy Edit Page Redesign

---

### US-021: Create Strategy Edit Page Route

**Description**: As a user, I want to edit strategies on a dedicated spacious page so that I have room to work with all the details.

**Acceptance Criteria**:
- [ ] Create `src/app/(protected)/strategies/[id]/edit/page.tsx`
- [ ] Fetches strategy via `strategies.getById`
- [ ] Shows loading skeleton while fetching
- [ ] Shows 404 if strategy not found
- [ ] Redirects if not owner (shouldn't happen with auth, but safe guard)
- [ ] Layout: spacious max-w-4xl centered container
- [ ] Back link to strategy detail page
- [ ] Page title: strategy name
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: page loads at `/strategies/[id]/edit`

---

### US-022: Create Auto-Save Form Hook

**Description**: As a developer, I want a hook for auto-saving form changes so that the edit page can persist changes automatically.

**Acceptance Criteria**:
- [ ] Create `src/hooks/use-auto-save.ts`
- [ ] Props: `data: T`, `onSave: (data: T) => Promise<void>`, `debounceMs?: number`
- [ ] Debounces save calls (default 800ms)
- [ ] Returns: `{ isSaving, lastSavedAt, error, saveNow }`
- [ ] Tracks save status for UI feedback
- [ ] Handles save errors gracefully
- [ ] Skips save if data unchanged (deep comparison)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-023: Create Save Status Indicator Component

**Description**: As a user, I want to see the auto-save status so that I know my changes are being persisted.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/save-status-indicator.tsx`
- [ ] Props: `isSaving: boolean`, `lastSavedAt: Date | null`, `error: string | null`
- [ ] States:
  - Saving: yellow dot pulsing + "Saving..."
  - Saved: green dot + "All changes saved" + relative time
  - Error: red dot + error message
  - Idle (no saves yet): nothing shown
- [ ] Uses `font-mono text-[10px]` styling
- [ ] Positioned fixed or in header area
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: status transitions work

---

### US-024: Build Strategy Edit Form - Basic Info Section

**Description**: As a user, I want to edit the basic info (name, description, color) with a spacious layout so that editing feels comfortable.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/edit-form/basic-info-section.tsx`
- [ ] Fields: name, description, color picker
- [ ] Uses enhanced input components
- [ ] Active/Inactive toggle switch
- [ ] Spacious layout with `space-y-6` between fields
- [ ] Section wrapped in terminal-style card
- [ ] Auto-saves changes via parent hook
- [ ] Validation: name required, shown on blur
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: edits trigger auto-save

---

### US-025: Build Strategy Edit Form - Rules Section

**Description**: As a user, I want to edit rules in a dedicated section with good affordances so that managing rules is easy.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/edit-form/rules-section.tsx`
- [ ] Sub-sections:
  - Entry Criteria textarea
  - Exit Rules textarea
  - Checklist Rules editor
- [ ] Checklist rules:
  - Grouped by category with headers
  - Add button per category
  - Inline editing with text input
  - Delete button per rule
  - Visual category indicators
- [ ] Uses enhanced input components
- [ ] Auto-saves on change (debounced)
- [ ] Section wrapped in terminal-style card
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: CRUD operations work, auto-save triggers

---

### US-026: Build Strategy Edit Form - Risk Section

**Description**: As a user, I want to edit all risk parameters in a dedicated section so that I can refine my risk and management rules.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/edit-form/risk-section.tsx`
- [ ] **Auto-validated parameters section:**
  - Min R:R Ratio (decimal input) - badge: "Auto-checked"
  - Max Risk Per Trade (type + value) - badge: "Auto-checked"
  - Daily Loss Limit (type + value) - badge: "Auto-checked"
  - Max Concurrent Positions (integer) - badge: "Auto-checked"
- [ ] **Conditional checklist parameters section:**
  - Move to Breakeven: trigger R input - badge: "Shows checklist"
  - Trail Stops: trigger R input - badge: "Shows checklist"
  - Scale Out Rules: add/remove list of {triggerR, sizePercent} - badge: "Shows checklist"
  - Target R Multiples: add/remove R values - badge: "Shows on trade"
- [ ] Visual distinction: auto-checked (checkmark icon), conditional (clipboard icon)
- [ ] Clear button to reset each parameter to null
- [ ] Uses NumberInput with decimals where appropriate
- [ ] Auto-saves on change (debounced)
- [ ] Section wrapped in terminal-style card
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: all inputs work, decimals supported

---

### US-027: Assemble Strategy Edit Page

**Description**: As a user, I want the edit page to combine all sections in a spacious, tabbed layout so that editing is organized and pleasant.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/[id]/edit/page.tsx`
- [ ] Layout:
  - Header: strategy name (large), color indicator, save status indicator
  - Tabs: Overview, Rules, Risk Management
  - Back button to detail page
  - Delete button (with confirmation dialog)
- [ ] Each tab contains relevant section component
- [ ] Form state managed centrally with auto-save hook
- [ ] Validation errors scroll to first error on save attempt
- [ ] Toast feedback for validation errors
- [ ] Responsive: full-width on mobile, max-w-4xl on desktop
- [ ] Terminal styling
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: full edit flow works with auto-save

---

### US-028: E2E Tests for Strategy Edit Page

**Description**: As a developer, I want E2E tests for the strategy edit page so that we verify the edit flow works correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-edit.spec.ts`
- [ ] Test: page loads with strategy data populated
- [ ] Test: editing name triggers auto-save
- [ ] Test: adding a rule triggers auto-save
- [ ] Test: can switch between tabs
- [ ] Test: delete button shows confirmation, deletes on confirm
- [ ] Test: validation prevents saving invalid data
- [ ] All UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 6: Strategy Detail Page Update

---

### US-029: Redesign Strategy Detail Page

**Description**: As a user, I want the strategy detail page to show comprehensive information with auto-compliance stats so that I can view my strategy effectiveness.

**Acceptance Criteria**:
- [ ] Update `src/app/(protected)/strategies/[id]/page.tsx`
- [ ] Layout:
  - Header: strategy name with color, Edit button, actions dropdown (Duplicate, Delete)
  - Stats row: Win Rate, Total P&L, Profit Factor, Trades, Avg R
  - **Auto-Compliance section**: Shows which risk params are set and overall compliance %
  - Manual Compliance section: rule compliance % from checklist
  - Rules display: categorized read-only list
  - Risk parameters display: formatted read-only with "Auto-checked" badges
- [ ] Stats use terminal-style cards (same pattern as analytics)
- [ ] Edit button navigates to `/strategies/[id]/edit`
- [ ] Terminal styling throughout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: detail view looks polished

---

### US-030: Create Combined Compliance Display Component

**Description**: As a user, I want to see both manual and auto-compliance stats so that I understand my overall strategy adherence.

**Acceptance Criteria**:
- [ ] Create `src/components/strategy/compliance-display.tsx`
- [ ] Props: `strategyId: string`
- [ ] Fetches:
  - Manual compliance via `strategies.getRuleCompliance`
  - Auto compliance calculated from trade data + risk params
- [ ] Shows combined view:
  - Overall compliance % (weighted average)
  - Manual rules section: per-rule breakdown
  - Auto-checks section: per-parameter breakdown
- [ ] Color coding: green >80%, yellow 50-80%, red <50%
- [ ] Explains which checks are manual vs automatic
- [ ] Only shows sections that have data
- [ ] Skeleton loading state
- [ ] Terminal design: wrapped in terminal card
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: compliance displays correctly

---

### US-031: E2E Tests for Strategy Detail Page

**Description**: As a developer, I want E2E tests for the strategy detail page so that we verify all elements display correctly.

**Acceptance Criteria**:
- [ ] Create `tests/e2e/strategy-detail.spec.ts`
- [ ] Test: page loads with strategy details
- [ ] Test: stats display with correct values
- [ ] Test: compliance section shows when rules/params exist
- [ ] Test: Edit button navigates to edit page
- [ ] Test: Duplicate action creates copy
- [ ] Test: Delete action with confirmation works
- [ ] All UI elements have `data-testid` attributes
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 7: Backend Enhancements

---

### US-032: Add Strategy Autosave Endpoint

**Description**: As a frontend, I want an autosave endpoint that accepts partial updates so that auto-save can be efficient.

**Acceptance Criteria**:
- [ ] Add `autosave` mutation to `src/server/api/routers/strategies.ts`
- [ ] Input: `{ id: string, ...partialStrategyFields }`
- [ ] Only updates fields that are provided (sparse update)
- [ ] Validates ownership
- [ ] Returns `{ updatedAt: Date }` for UI confirmation
- [ ] Does not invalidate list queries (silent save)
- [ ] Handles rules array: replace all if provided
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-033: Add Auto-Compliance Query Endpoint

**Description**: As a frontend, I want an endpoint that calculates auto-compliance for a strategy so that the detail page can show it.

**Acceptance Criteria**:
- [ ] Add `getAutoCompliance` query to strategies router
- [ ] Input: `{ strategyId: string }`
- [ ] Fetches strategy risk parameters
- [ ] Fetches all closed trades with this strategy
- [ ] Runs compliance calculator for each trade
- [ ] Aggregates results:
  - Per-parameter: compliance %, failing trades count
  - Overall: weighted compliance %
- [ ] Returns structured compliance data
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-034: Integration Tests for Backend Endpoints

**Description**: As a developer, I want integration tests for the new backend endpoints so that we verify correct behavior.

**Acceptance Criteria**:
- [ ] Add tests to `tests/integration/strategies.test.ts`
- [ ] Test: autosave updates only provided fields
- [ ] Test: autosave returns updatedAt
- [ ] Test: autosave rejects if not owner
- [ ] Test: getAutoCompliance returns correct calculations
- [ ] Test: getAutoCompliance handles trades without SL/TP
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### Phase 8: Conditional Checklist Schema

---

### US-035: Add Conditional Checklist Type to Strategy Rules

**Description**: As a developer, I want to store conditional checklist rules alongside manual rules so that they can be checked on trades.

**Acceptance Criteria**:
- [ ] Update `strategyRuleCategoryEnum` to include: "conditional_breakeven", "conditional_trail", "conditional_scale"
- [ ] Or: Add `isConditional` boolean + `triggerR` decimal to `strategyRules` table
- [ ] Decision: Prefer new category values to keep schema simple
- [ ] When strategy has `trailingRules.moveToBreakeven`, generate conditional rule on save
- [ ] When strategy has `scalingRules.scaleOut[]`, generate conditional rules on save
- [ ] Conditional rules stored in `strategyRules` with special category
- [ ] `tradeRuleChecks` table works as-is (links trade to rule, stores checked boolean)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-036: Add Integration Tests for Conditional Checklists

**Description**: As a developer, I want tests for the conditional checklist generation so that we verify correct behavior.

**Acceptance Criteria**:
- [ ] Add tests to `tests/integration/strategies.test.ts`
- [ ] Test: strategy with moveToBreakeven generates conditional rule
- [ ] Test: strategy with scaleOut rules generates multiple conditional rules
- [ ] Test: conditional rules appear in `getTradeRuleChecks` when trade hits threshold
- [ ] Test: conditional rules don't appear when trade doesn't hit threshold
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

## Non-Goals (Out of Scope)

- **Auto-VERIFY trailing/scaling actions** - We show checklist items but can't verify user moved stop (would need stop adjustment log)
- **Position sizing method validation** - Informational only, can't validate against trades
- **Cover image uploads** - Handled in separate marketplace PRD
- **Marketplace publishing** - Separate feature
- **Strategy templates/presets** - Future feature
- **Drag-and-drop rule reordering** - Nice-to-have, not essential

## Technical Considerations

### Input Handling

The key technical challenge is input handling. Current issues:
1. `type="number"` inputs reset to 0 when cleared
2. Placeholders look the same as values
3. Validation happens during typing (jarring)

Solutions implemented:
1. Use `type="text"` with `inputMode="decimal"` for number inputs
2. Style placeholders with half opacity: `placeholder:text-muted-foreground/50`
3. Validate only on blur or explicit save attempt
4. Allow `null` values to represent "not set"

### Auto-Compliance Architecture

```typescript
// src/lib/strategies/risk-compliance.ts

interface ComplianceCheck {
  param: string;
  passed: boolean | null; // null = unable to check
  actual: number | null;
  limit: number;
  note?: string;
}

interface ComplianceResult {
  checks: ComplianceCheck[];
  overallCompliance: number; // 0-100
  checksPerformed: number;
  checksPassed: number;
}

function calculateRiskCompliance(
  trade: Trade,
  strategy: Strategy,
  symbolSpecs: SymbolSpecs
): ComplianceResult {
  const checks: ComplianceCheck[] = [];

  // Min R:R Ratio check
  if (strategy.riskParameters?.minRRRatio) {
    const plannedRR = calculatePlannedRR(trade);
    if (plannedRR !== null) {
      checks.push({
        param: 'minRRRatio',
        passed: plannedRR >= strategy.riskParameters.minRRRatio,
        actual: plannedRR,
        limit: strategy.riskParameters.minRRRatio,
      });
    }
  }

  // ... more checks

  return {
    checks,
    overallCompliance: (checksPassed / checksPerformed) * 100,
    checksPerformed,
    checksPassed,
  };
}
```

### What Can Be Calculated

| Check | Inputs Needed | Formula |
|-------|--------------|---------|
| Planned R:R | entry, SL, TP | `(TP - entry) / (entry - SL)` for long |
| Dollar Risk | entry, SL, qty, pointValue | `abs(entry - SL) * qty * pointValue` |
| Achieved R | netPnl, dollarRisk | `netPnl / dollarRisk` |
| Daily P&L | All trades same day | `sum(netPnl)` |

### Design Reference

All UI must follow `.claude/skills/frontend-engineer/DESIGN_REFERENCE.md`:
- Backgrounds: `bg-white/1`, `bg-white/2`
- Borders: `border-white/5`, hover `border-white/10`
- Text: `font-mono` for all interactive elements
- Labels: `font-mono text-[10px] text-muted-foreground uppercase tracking-wider`
- Values: `font-mono font-bold text-lg`
- Cards: Terminal window chrome where appropriate

## Success Metrics

- Users can create strategies through wizard without errors
- Auto-save prevents data loss
- Auto-compliance shows on 100% of eligible trades
- Input validation catches errors before server round-trip
- All tests pass in CI

## Open Questions

None - proceeding with validated-only approach.

---

*PRD generated: 2026-01-24*
*Key decisions:*
- *Two types of compliance: Auto-checked (verified by system) vs Conditional checklists (manual, triggered by R)*
- *Auto-checked: minRR, maxRisk, dailyLoss, maxConcurrent*
- *Conditional checklists: moveToBreakeven, trailStops, scaleOut (show when trade hits threshold R)*
- *Null-friendly inputs with blur validation*
- *Clear visual distinction between auto-checked and manual checklist rules*
