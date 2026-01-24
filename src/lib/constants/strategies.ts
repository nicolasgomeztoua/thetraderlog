// =============================================================================
// STRATEGY CONSTANTS
// =============================================================================

/**
 * Position sizing methods for strategies
 */
export const POSITION_SIZING_METHODS = [
	{ value: "fixed", label: "Fixed Size" },
	{ value: "risk_percent", label: "Risk % of Account" },
	{ value: "kelly", label: "Kelly Criterion" },
] as const;

/**
 * Risk value types (dollars or percentage)
 */
export const RISK_TYPES = [
	{ value: "dollars", label: "Dollars ($)" },
	{ value: "percent", label: "Percent (%)" },
] as const;

/**
 * Rule categories for strategy checklist rules
 */
export const RULE_CATEGORIES = [
	{ value: "entry", label: "Entry" },
	{ value: "exit", label: "Exit" },
	{ value: "risk", label: "Risk" },
	{ value: "management", label: "Management" },
] as const;

/**
 * Conditional rule types (generated based on trade R thresholds)
 */
export const CONDITIONAL_RULE_TYPES = [
	{ value: "breakeven", label: "Move to Breakeven" },
	{ value: "trail", label: "Trail Stop" },
	{ value: "scale_out", label: "Scale Out" },
] as const;

/**
 * Strategy creation wizard steps
 */
export const STRATEGY_CREATION_STEPS = [
	"basics",
	"rules",
	"risk",
	"review",
] as const;

/**
 * Risk parameters that are auto-checked against trades
 * These are validated automatically based on trade data
 */
export const AUTO_CHECKED_PARAMS = [
	"minRRRatio",
	"maxRiskPerTrade",
	"dailyLossLimit",
	"maxConcurrentPositions",
] as const;

/**
 * Risk parameters that generate conditional checklists
 * These show as checklist items when trade R thresholds are hit
 */
export const CONDITIONAL_PARAMS = [
	"moveToBreakeven",
	"trailStops",
	"scaleOut",
	"targetRMultiples",
] as const;
