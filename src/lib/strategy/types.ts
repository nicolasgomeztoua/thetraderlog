/**
 * Strategy Auto-Evaluation Types
 *
 * TypeScript types for the rule evaluation system that enables automatic
 * tracking and evaluation of trading rules based on trade data.
 */

// ============================================================================
// RULE TYPE ENUM
// ============================================================================

/**
 * Defines how a rule is evaluated
 * - manual: User manually checks/unchecks the rule
 * - auto: System automatically evaluates based on trade data
 * - semi_auto: System suggests but user can override (e.g., trailing stops)
 */
export type RuleType = "manual" | "auto" | "semi_auto";

// ============================================================================
// AUTO CONDITION TYPES
// ============================================================================

/**
 * Discriminated union key for auto condition types
 */
export type AutoConditionType =
	| "maxRiskPerTrade"
	| "minRRRatio"
	| "breakevenTrigger"
	| "scaleOutAtR"
	| "dailyLossLimit"
	| "maxConcurrentPositions"
	| "trailingStopTrigger";

/**
 * Condition: Max risk per trade must not exceed limit
 * Evaluates: abs(entry - stop) * pointValue * quantity <= limit
 */
export interface MaxRiskPerTradeCondition {
	type: "maxRiskPerTrade";
	maxRiskType: "dollars" | "percent";
	maxRiskValue: number;
}

/**
 * Condition: Planned R:R ratio must meet minimum
 * Evaluates: plannedRR >= minRatio
 */
export interface MinRRRatioCondition {
	type: "minRRRatio";
	minRatio: number;
}

/**
 * Condition: Move stop to breakeven when MFE reaches trigger
 * Evaluates: If MFE >= triggerR, then trailedStopLoss >= entryPrice (for longs)
 */
export interface BreakevenTriggerCondition {
	type: "breakevenTrigger";
	triggerR: number;
	offsetTicks: number;
}

/**
 * Condition: Scale out at specific R-multiple
 * Evaluates: Find TradeExecution with exit near target price
 */
export interface ScaleOutAtRCondition {
	type: "scaleOutAtR";
	targetR: number;
	sizePercent: number;
}

/**
 * Condition: Daily loss must not exceed limit
 * Evaluates: Sum of day's closed trades P&L > -limit
 */
export interface DailyLossLimitCondition {
	type: "dailyLossLimit";
	limitType: "dollars" | "percent";
	limitValue: number;
}

/**
 * Condition: Maximum concurrent open positions
 * Evaluates: Count open trades at entry time <= max
 */
export interface MaxConcurrentPositionsCondition {
	type: "maxConcurrentPositions";
	maxPositions: number;
}

/**
 * Condition: Trailing stop was applied correctly
 * Evaluates: If MFE >= triggerR, stop was moved according to method
 */
export interface TrailingStopTriggerCondition {
	type: "trailingStopTrigger";
	triggerR: number;
	method: "fixed_ticks" | "atr" | "swing";
	value: number; // ticks for fixed, multiplier for ATR
}

/**
 * Discriminated union of all auto condition types
 */
export type AutoCondition =
	| MaxRiskPerTradeCondition
	| MinRRRatioCondition
	| BreakevenTriggerCondition
	| ScaleOutAtRCondition
	| DailyLossLimitCondition
	| MaxConcurrentPositionsCondition
	| TrailingStopTriggerCondition;

// ============================================================================
// EVALUATION RESULT
// ============================================================================

/**
 * Quality of data used for evaluation
 * - full: All required data was available
 * - partial: Some data missing but evaluation attempted
 * - unavailable: Required data missing, evaluation not possible
 */
export type DataQuality = "full" | "partial" | "unavailable";

/**
 * Result of auto-evaluating a rule against a trade
 */
export interface AutoEvaluationResult {
	/** Whether the rule passed */
	passed: boolean;
	/** The actual value computed from trade data */
	actual: number | string | null;
	/** The expected/threshold value from the condition */
	expected: number | string | null;
	/** Human-readable explanation of the evaluation */
	details: string;
	/** When the evaluation was performed */
	evaluatedAt: string; // ISO date string
	/** Quality of data used for evaluation */
	dataQuality: DataQuality;
}

// ============================================================================
// GENERATED RULE
// ============================================================================

/**
 * A rule generated from strategy configuration
 */
export interface GeneratedRule {
	/** The rule text to display */
	text: string;
	/** Rule category (entry/exit/risk/management) */
	category: "entry" | "exit" | "risk" | "management";
	/** How the rule is evaluated */
	ruleType: RuleType;
	/** Source config path (e.g., 'riskParameters.maxRiskPerTrade') */
	configSource: string;
	/** Auto condition for evaluation (if applicable) */
	autoCondition: AutoCondition | null;
	/** Hash of source config for change detection */
	sourceConfigHash: string;
}
