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

// =============================================================================
// ============================================================================
// EXPANDED PROP RULE MODEL (2026)
// Vocabulary for the full prop-compliance overhaul. See
// docs/PROP_COMPLIANCE_RESEARCH.md for the firm research these encode.
//
// ARCHITECTURAL CONSTRAINT: every compliance calculation runs on REALIZED P&L
// from CLOSED trades only — we have no live equity / open-position feed. Rules
// that depend on intraday/unrealized highs or floating equity can therefore only
// be approximated; results carry a DataConfidence so the UI is honest about it.
// ============================================================================
// =============================================================================

// =============================================================================
// DATA CONFIDENCE & COMPUTABILITY
// =============================================================================

/**
 * How trustworthy a computed compliance metric is.
 */
export const DATA_CONFIDENCE = {
	/** Fully computable from realized closed-trade P&L. */
	EXACT: "exact",
	/**
	 * True value follows intraday/unrealized highs we can't see; our number is a
	 * LOWER BOUND on the real (stricter) drawdown — the firm may have breached
	 * while we still show "safe".
	 */
	APPROXIMATE: "approximate",
	/** Not auto-checkable without live equity / open positions / a news feed. */
	NEEDS_LIVE: "needs_live",
} as const;

export type DataConfidence =
	(typeof DATA_CONFIDENCE)[keyof typeof DATA_CONFIDENCE];

export const DATA_CONFIDENCE_LABELS: Record<DataConfidence, string> = {
	exact: "Exact",
	approximate: "Approximate (realized-only)",
	needs_live: "Needs live data",
};

/**
 * Whether a settings field's rule can be auto-checked from journal data.
 * Drives the badge shown next to each field/section in settings.
 */
export const COMPUTABILITY = {
	/** Checked automatically from your imported (closed) trades. */
	AUTO: "auto",
	/** Stored for reference; not auto-enforced. */
	INFO_ONLY: "info_only",
	/** Requires live account data; surfaced as a manual checklist item. */
	NEEDS_LIVE: "needs_live",
} as const;

export type Computability = (typeof COMPUTABILITY)[keyof typeof COMPUTABILITY];

export const COMPUTABILITY_LABELS: Record<Computability, string> = {
	auto: "Auto",
	info_only: "Info only",
	needs_live: "Needs live data",
};

// =============================================================================
// DRAWDOWN — 4 INDEPENDENT AXES
// The legacy single `drawdownType` (trailing|static|eod) collapsed these.
// =============================================================================

/** Axis 1 — does the loss floor move at all. */
export const DRAWDOWN_ANCHOR = {
	STATIC: "static",
	TRAILING: "trailing",
} as const;
export type DrawdownAnchor =
	(typeof DRAWDOWN_ANCHOR)[keyof typeof DRAWDOWN_ANCHOR];

/** Axis 2 — what the trailing high-water mark follows (trailing only). */
export const DRAWDOWN_HIGH_WATER_SOURCE = {
	/** Open-position peaks push the floor (Apex, TPT PRO, MFFU Rapid). Approximate. */
	INTRADAY_UNREALIZED: "intraday_unrealized",
	/** Only end-of-day closing balances move the floor (Topstep, TPT Test, FTMO). Exact. */
	EOD_REALIZED: "eod_realized",
} as const;
export type DrawdownHighWaterSource =
	(typeof DRAWDOWN_HIGH_WATER_SOURCE)[keyof typeof DRAWDOWN_HIGH_WATER_SOURCE];

/** Axis 3 — where the trailing floor freezes (the lock the legacy code missed). */
export const DRAWDOWN_LOCK = {
	/** Never locks; trails the high-water mark forever (FTMO relative). */
	NONE: "none",
	/** Freezes at the starting balance once profit ≥ drawdown amount. */
	AT_START: "at_start",
	/** Freezes at starting balance + buffer (Apex/MFFU +$100). */
	AT_START_PLUS_BUFFER: "at_start_plus_buffer",
} as const;
export type DrawdownLock = (typeof DRAWDOWN_LOCK)[keyof typeof DRAWDOWN_LOCK];

/** Axis 4 — what the breach check measures against. */
export const DRAWDOWN_BASIS = {
	/** Closed-trade balance (exact for us). */
	BALANCE_REALIZED: "balance_realized",
	/** Floating equity incl. open positions (FTMO/intraday firms; approximate for us). */
	EQUITY_UNREALIZED: "equity_unrealized",
} as const;
export type DrawdownBasis =
	(typeof DRAWDOWN_BASIS)[keyof typeof DRAWDOWN_BASIS];

export const DRAWDOWN_ANCHOR_LABELS: Record<DrawdownAnchor, string> = {
	static: "Static",
	trailing: "Trailing",
};
export const DRAWDOWN_HIGH_WATER_SOURCE_LABELS: Record<
	DrawdownHighWaterSource,
	string
> = {
	intraday_unrealized: "Intraday (unrealized)",
	eod_realized: "End of day (realized)",
};
export const DRAWDOWN_LOCK_LABELS: Record<DrawdownLock, string> = {
	none: "Never locks",
	at_start: "Locks at starting balance",
	at_start_plus_buffer: "Locks at start + buffer",
};
export const DRAWDOWN_BASIS_LABELS: Record<DrawdownBasis, string> = {
	balance_realized: "Balance (realized)",
	equity_unrealized: "Equity (unrealized)",
};

/** Default buffer (USD) for at_start_plus_buffer firms (Apex/MFFU). */
export const DEFAULT_DRAWDOWN_LOCK_BUFFER = 100;

/**
 * Map the legacy `drawdownType` enum onto the 4 axes, preserving the OLD
 * (non-locking) behavior so untouched accounts compute identically until a
 * preset or the user opts into the lock.
 */
export const LEGACY_DRAWDOWN_TYPE_TO_AXES = {
	static: {
		anchor: DRAWDOWN_ANCHOR.STATIC,
		highWaterSource: DRAWDOWN_HIGH_WATER_SOURCE.EOD_REALIZED,
		lock: DRAWDOWN_LOCK.NONE,
		basis: DRAWDOWN_BASIS.BALANCE_REALIZED,
	},
	trailing: {
		anchor: DRAWDOWN_ANCHOR.TRAILING,
		highWaterSource: DRAWDOWN_HIGH_WATER_SOURCE.INTRADAY_UNREALIZED,
		lock: DRAWDOWN_LOCK.NONE,
		basis: DRAWDOWN_BASIS.BALANCE_REALIZED,
	},
	eod: {
		anchor: DRAWDOWN_ANCHOR.TRAILING,
		highWaterSource: DRAWDOWN_HIGH_WATER_SOURCE.EOD_REALIZED,
		lock: DRAWDOWN_LOCK.NONE,
		basis: DRAWDOWN_BASIS.BALANCE_REALIZED,
	},
} satisfies Record<
	string,
	{
		anchor: DrawdownAnchor;
		highWaterSource: DrawdownHighWaterSource;
		lock: DrawdownLock;
		basis: DrawdownBasis;
	}
>;

// =============================================================================
// DAILY LOSS LIMIT
// =============================================================================

/** Reference point a daily-loss limit is measured from. */
export const DAILY_LOSS_ANCHOR = {
	/** Fixed % of the initial balance (Apex EOD, Tradeify). */
	STATIC_FROM_INITIAL: "static_from_initial",
	/** From the balance at the start of the trading day (CFD style). */
	FROM_DAY_START_BALANCE: "from_day_start_balance",
} as const;
export type DailyLossAnchor =
	(typeof DAILY_LOSS_ANCHOR)[keyof typeof DAILY_LOSS_ANCHOR];

export const DAILY_LOSS_ANCHOR_LABELS: Record<DailyLossAnchor, string> = {
	static_from_initial: "% of initial balance",
	from_day_start_balance: "% of day-start balance",
};

// =============================================================================
// CONSISTENCY
// =============================================================================

/**
 * How the best-day concentration rule is expressed.
 * NOTE: the legacy `consistencyRule` field was LABELED "% of target" but the
 * code computed "% of total realized profit" — research confirmed total-profit
 * is the correct denominator for the major firms, so existing rows map to
 * BEST_DAY_PCT_OF_TOTAL and behavior is preserved.
 */
export const CONSISTENCY_RULE_TYPE = {
	OFF: "off",
	/** Best winning day ≤ X% of cumulative realized profit (most firms, Topstep). */
	BEST_DAY_PCT_OF_TOTAL: "best_day_pct_of_total",
	/** Best winning day ≤ X% of the fixed profit target. */
	BEST_DAY_PCT_OF_TARGET: "best_day_pct_of_target",
	/** Single trade ≤ X% of total realized profit (The5ers). */
	PER_TRADE_PCT_OF_TOTAL: "per_trade_pct_of_total",
	/** Highest day vs lowest/average-day ratio. */
	TOP_DAYS_RATIO: "top_days_ratio",
	/** Best winning day ≤ X% of summed positive days. */
	BEST_DAY_PCT_OF_POSITIVE_DAYS: "best_day_pct_of_positive_days",
} as const;
export type ConsistencyRuleType =
	(typeof CONSISTENCY_RULE_TYPE)[keyof typeof CONSISTENCY_RULE_TYPE];

/** Which trades enter the consistency denominator. */
export const CONSISTENCY_WINDOW = {
	FULL_EVALUATION: "full_evaluation",
	SINCE_LAST_PAYOUT: "since_last_payout",
	FIXED_CYCLE: "fixed_cycle",
} as const;
export type ConsistencyWindow =
	(typeof CONSISTENCY_WINDOW)[keyof typeof CONSISTENCY_WINDOW];

/** ≥X fails (lt) vs >X fails (lte). Apex uses "more than X" → lte passes at exactly X. */
export const CONSISTENCY_COMPARATOR = {
	/** Strict: bestDayPct must be < limit (Apex/Alpha). */
	LT: "lt",
	/** Inclusive: bestDayPct must be ≤ limit (most firms). */
	LTE: "lte",
} as const;
export type ConsistencyComparator =
	(typeof CONSISTENCY_COMPARATOR)[keyof typeof CONSISTENCY_COMPARATOR];

/** When the consistency rule applies. */
export const CONSISTENCY_PHASE = {
	EVALUATION_ONLY: "evaluation_only",
	FUNDED_ONLY: "funded_only",
	BOTH: "both",
} as const;
export type ConsistencyPhase =
	(typeof CONSISTENCY_PHASE)[keyof typeof CONSISTENCY_PHASE];

export const CONSISTENCY_RULE_TYPE_LABELS: Record<ConsistencyRuleType, string> =
	{
		off: "Off",
		best_day_pct_of_total: "Best day % of total profit",
		best_day_pct_of_target: "Best day % of profit target",
		per_trade_pct_of_total: "Best trade % of total profit",
		top_days_ratio: "Top-days ratio",
		best_day_pct_of_positive_days: "Best day % of positive days",
	};
export const CONSISTENCY_WINDOW_LABELS: Record<ConsistencyWindow, string> = {
	full_evaluation: "Full evaluation",
	since_last_payout: "Since last payout",
	fixed_cycle: "Per cycle",
};
export const CONSISTENCY_PHASE_LABELS: Record<ConsistencyPhase, string> = {
	evaluation_only: "Evaluation only",
	funded_only: "Funded only",
	both: "Evaluation & funded",
};

// =============================================================================
// QUALIFYING TRADING DAY
// =============================================================================

/**
 * What makes a day "count" — distinct for eval (any-trade) vs payout
 * (winning day ≥ $ threshold).
 */
export const QUALIFYING_DAY_MODE = {
	/** Any day with at least one closed trade. */
	ANY_TRADE: "any_trade",
	/** Any day with net realized P&L > 0. */
	ANY_POSITIVE: "any_positive",
	/** Day with net realized P&L ≥ a fixed $ threshold (futures winning day). */
	MIN_PROFIT_ABS: "min_profit_abs",
	/** Day with net realized P&L ≥ X% of balance (The5ers — needs live equity). */
	MIN_PROFIT_PCT: "min_profit_pct",
} as const;
export type QualifyingDayMode =
	(typeof QUALIFYING_DAY_MODE)[keyof typeof QUALIFYING_DAY_MODE];

export const QUALIFYING_DAY_MODE_LABELS: Record<QualifyingDayMode, string> = {
	any_trade: "Any trade",
	any_positive: "Any profitable day",
	min_profit_abs: "Day ≥ $ threshold",
	min_profit_pct: "Day ≥ % of balance",
};

// =============================================================================
// PAYOUT ELIGIBILITY
// =============================================================================

/** What gates the next payout's timing. */
export const PAYOUT_CYCLE_TYPE = {
	/** N qualifying winning days (futures). */
	WINNING_DAYS: "winning_days",
	/** N calendar days since first trade / last payout (CFD). */
	CALENDAR_DAYS: "calendar_days",
	/** N hours (fast-payout programs). */
	HOURS: "hours",
} as const;
export type PayoutCycleType =
	(typeof PAYOUT_CYCLE_TYPE)[keyof typeof PAYOUT_CYCLE_TYPE];

/** The withdrawable-profit floor model. */
export const BUFFER_TYPE = {
	/** No buffer — full profit withdrawable (CFD). */
	NONE: "none",
	/** Only profit above starting balance + drawdown is withdrawable (futures safety-net). */
	START_PLUS_DRAWDOWN: "start_plus_drawdown",
} as const;
export type BufferType = (typeof BUFFER_TYPE)[keyof typeof BUFFER_TYPE];

export const PAYOUT_CYCLE_TYPE_LABELS: Record<PayoutCycleType, string> = {
	winning_days: "Winning days",
	calendar_days: "Calendar days",
	hours: "Hours",
};
export const BUFFER_TYPE_LABELS: Record<BufferType, string> = {
	none: "No buffer",
	start_plus_drawdown: "Safety-net (start + drawdown)",
};

// =============================================================================
// POSITION SIZING / SCALING
// =============================================================================

/** What the scaling-plan thresholds are measured against. */
export const SCALING_BASIS = {
	EOD_BALANCE: "eod_balance",
	PROFIT_FROM_START: "profit_from_start",
} as const;
export type ScalingBasis = (typeof SCALING_BASIS)[keyof typeof SCALING_BASIS];

/** When a scaling change takes effect. */
export const SCALING_APPLIES_AT = {
	NEXT_SESSION: "next_session",
	NEXT_DAY: "next_day",
	IMMEDIATE: "immediate",
} as const;
export type ScalingAppliesAt =
	(typeof SCALING_APPLIES_AT)[keyof typeof SCALING_APPLIES_AT];

export const SCALING_BASIS_LABELS: Record<ScalingBasis, string> = {
	eod_balance: "End-of-day balance",
	profit_from_start: "Profit from start",
};
export const SCALING_APPLIES_AT_LABELS: Record<ScalingAppliesAt, string> = {
	next_session: "Next session",
	next_day: "Next day",
	immediate: "Immediately",
};

/** Default micro:mini contract ratio (10 micros = 1 mini). */
export const DEFAULT_MICRO_TO_MINI_RATIO = 10;

/** Default funded-account inactivity timeout (calendar days; 0 = none). */
export const DEFAULT_INACTIVITY_LIMIT_DAYS = 30;

// =============================================================================
// JSONB SHAPES (stored as JSON strings on the account row)
// =============================================================================

/** One rung of an escalating consistency ladder (Tradeify Lightning). */
export interface ConsistencyTier {
	/** 0-based payout index this rung applies from. */
	payoutIndex: number;
	/** Allowed best-day percentage at this rung. */
	pct: number;
}

/** One rung of an escalating first-payout cap ladder. */
export interface PayoutCap {
	/** 0-based payout index. */
	payoutIndex: number;
	/** Max withdrawable amount (USD) for that payout. */
	capAmount: number;
}

/** One rung of an escalating profit-split ladder. */
export interface ProfitSplitTier {
	/** 0-based payout index this split applies from. */
	payoutIndex: number;
	/** Trader's split percentage (e.g. 90 for 90%). */
	splitPct: number;
}

/** One rung of a contract scaling plan. */
export interface ScalingTier {
	/** Balance (or profit) threshold at/above which this cap applies. */
	balanceThreshold: number;
	/** Max contracts (mini-equivalents) allowed at this tier. */
	maxContracts: number;
}
