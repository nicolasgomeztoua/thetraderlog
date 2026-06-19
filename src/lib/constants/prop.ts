// =============================================================================
// PROP COMPLIANCE CONSTANTS
// Shared thresholds, labels, and mappings for prop firm compliance tracking
// =============================================================================

// =============================================================================
// COMPLIANCE STATUS
// =============================================================================

/**
 * Compliance status levels used across all prop compliance metrics.
 * Determines color-coding and urgency of UI indicators.
 */
export const COMPLIANCE_STATUS = {
	SAFE: "safe",
	CAUTION: "caution",
	DANGER: "danger",
} as const;

export type ComplianceStatus =
	(typeof COMPLIANCE_STATUS)[keyof typeof COMPLIANCE_STATUS];

// =============================================================================
// COMPLIANCE THRESHOLDS
// =============================================================================

/**
 * Buffer percentage thresholds for determining compliance status.
 * "Buffer" = remaining % of a limit before breach.
 *
 * - safe: >30% buffer remaining
 * - caution: 10–30% buffer remaining
 * - danger: <10% buffer remaining
 */
export const COMPLIANCE_THRESHOLDS = {
	/** Above this buffer → safe */
	SAFE_MIN: 0.3,
	/** Above this buffer → caution (below → danger) */
	CAUTION_MIN: 0.1,
} as const;

// =============================================================================
// COMPLIANCE STATUS COLORS
// =============================================================================

/**
 * Terminal design system color classes for each compliance status.
 * Maps to Tailwind classes defined in the design system.
 */
export const COMPLIANCE_STATUS_COLORS: Record<ComplianceStatus, string> = {
	safe: "text-profit",
	caution: "text-primary",
	danger: "text-loss",
};

/**
 * Background color variants for badges and indicators.
 */
export const COMPLIANCE_STATUS_BG_COLORS: Record<ComplianceStatus, string> = {
	safe: "bg-profit/10",
	caution: "bg-primary/10",
	danger: "bg-loss/10",
};

/**
 * Solid background Tailwind classes for compliance status (progress bars, dots).
 */
export const COMPLIANCE_STATUS_BG: Record<ComplianceStatus, string> = {
	safe: "bg-profit",
	caution: "bg-primary",
	danger: "bg-loss",
};

/**
 * Stroke Tailwind classes for compliance status (SVG gauges).
 */
export const COMPLIANCE_STATUS_STROKE: Record<ComplianceStatus, string> = {
	safe: "stroke-profit",
	caution: "stroke-primary",
	danger: "stroke-loss",
};

// =============================================================================
// LABEL MAPPINGS
// =============================================================================

/**
 * Human-readable labels for challenge status values.
 */
export const CHALLENGE_STATUS_LABELS: Record<string, string> = {
	active: "Active",
	passed: "Passed",
	failed: "Failed",
};

/**
 * Human-readable labels for drawdown type values.
 */
export const DRAWDOWN_TYPE_LABELS: Record<string, string> = {
	trailing: "Trailing",
	static: "Static",
	eod: "End of Day",
};

// =============================================================================
// PROP ACCOUNT TYPES
// =============================================================================

/**
 * Account types that are considered prop accounts.
 * Used for conditional rendering and filtering.
 */
export const PROP_ACCOUNT_TYPES = ["prop_challenge", "prop_funded"] as const;

export type PropAccountType = (typeof PROP_ACCOUNT_TYPES)[number];

// =============================================================================
// CHALLENGE SIMULATOR
// =============================================================================

/**
 * Monte Carlo challenge simulator configuration.
 */
export const SIMULATOR = {
	/** Minimum closed trades required to run a simulation */
	MIN_TRADES: 10,
	/** Number of Monte Carlo iterations */
	ITERATIONS: 10000,
	/** Max trades per simulated run before declaring a fail */
	MAX_TRADES_PER_SIM: 500,
} as const;

/**
 * Pass-rate percentage thresholds for color-coding the simulation result.
 */
export const PASS_RATE_THRESHOLDS = {
	/** >= this value → profit (green) */
	GOOD: 70,
	/** >= this value → breakeven (yellow); below → loss (red) */
	FAIR: 40,
} as const;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if an account type is a prop account type.
 */
export function isPropAccountType(
	accountType: string | null | undefined,
): accountType is PropAccountType {
	return PROP_ACCOUNT_TYPES.includes(accountType as PropAccountType);
}
