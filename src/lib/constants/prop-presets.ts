// =============================================================================
// PROP FIRM PRESETS (2026)
// Firm × plan × account-size presets that pre-fill the prop-compliance fields.
// Futures-first. Numbers are verified against firm sources as of each entry's
// `asOf` — PROP RULES CHANGE OFTEN, re-verify before relying on a value.
// See docs/PROP_COMPLIANCE_RESEARCH.md for the underlying research.
//
// Field value conventions (the settings form stringifies as needed on save):
//   percentages + dollar amounts → numbers; enums → their string literals;
//   counts/days → numbers; booleans → booleans.
// =============================================================================

import type {
	BufferType,
	ConsistencyComparator,
	ConsistencyPhase,
	ConsistencyRuleType,
	DailyLossAnchor,
	DrawdownAnchor,
	DrawdownBasis,
	DrawdownHighWaterSource,
	DrawdownLock,
	PayoutCycleType,
	QualifyingDayMode,
} from "@/lib/constants/prop";

/** The subset of account prop fields a preset can set. */
export interface PropPresetFields {
	// Drawdown
	drawdownAnchor?: DrawdownAnchor;
	drawdownHighWaterSource?: DrawdownHighWaterSource;
	drawdownLock?: DrawdownLock;
	drawdownLockBuffer?: number;
	drawdownBasis?: DrawdownBasis;
	maxDrawdown?: number; // %
	maxDrawdownAbsolute?: number; // $
	/** Legacy mirror, kept so old UI bits and back-compat reads still work. */
	drawdownType?: "trailing" | "static" | "eod";

	// Daily loss
	dailyLossLimit?: number; // % (omit when the firm has none)
	dailyLossAnchor?: DailyLossAnchor;
	dailyLossBasis?: DrawdownBasis;
	dailyLossFailsAccount?: boolean;

	// Eval target / timeline
	profitTarget?: number; // %
	profitTargetAbsolute?: number; // $
	evalMaxDays?: number | null; // null = unlimited
	minTradingDays?: number;

	// Qualifying day / activity
	qualifyingDayMode?: QualifyingDayMode;
	qualifyingDayMinProfit?: number; // $
	inactivityLimitDays?: number;

	// Consistency
	consistencyRuleType?: ConsistencyRuleType;
	consistencyRule?: number; // % value
	consistencyComparator?: ConsistencyComparator;
	consistencyPhase?: ConsistencyPhase;

	// Payout eligibility (funded)
	winningDayThreshold?: number; // $
	winningDaysRequired?: number;
	payoutCycleType?: PayoutCycleType;
	payoutCycleLength?: number;
	firstPayoutWaitDays?: number;
	bufferType?: BufferType;
	minWithdrawal?: number; // $
	maxLifetimePayouts?: number;
	payoutConsistencyPct?: number; // %
	profitSplit?: number; // %
	activationFee?: number; // $

	// Position / scaling
	maxContracts?: number; // mini-equivalents
	microToMiniRatio?: number;
	stopLossRequired?: boolean;

	// Conduct / time
	sessionFlatTime?: string; // "HH:MM"
	sessionFlatTimezone?: string;
	weekendHoldingAllowed?: boolean;
}

export interface PropPreset {
	/** Stable id, e.g. "topstep-combine-50k". */
	id: string;
	firm: string;
	plan: string;
	phase: "evaluation" | "funded";
	/** Account size in dollars (e.g. 50000). */
	accountSize: number;
	category: "futures" | "cfd_forex";
	/** Display label, e.g. "Topstep 50K Combine". */
	label: string;
	/** One-line human summary of the key rules. */
	summary: string;
	/** Recency tag, e.g. "2026-06". */
	asOf: string;
	/** True for equity-based (CFD) firms where realized-only checks approximate. */
	approximate?: boolean;
	fields: PropPresetFields;
}

// =============================================================================
// TRADEIFY (futures) — verified 2026-06 against help.tradeify.co + reviews.
// Lineup: Growth (1-phase eval → funded), Select (formerly "Advanced";
// 1-phase eval, 3-day min, 40% consistency in eval only), Lightning (instant
// funding, no eval). All accounts use an EOD trailing max drawdown that locks
// once EOD balance ≥ start + DD + $100. Funded payout = 5 winning days, 90/10
// split (first $15k retained 100%). EOD flat ~16:59 ET.
// =============================================================================
const TRADEIFY: PropPreset[] = [
	// --- Growth Evaluation (no consistency in eval, no time limit) ---------
	{
		id: "tradeify-growth-eval-50k",
		firm: "Tradeify",
		plan: "Growth Evaluation",
		phase: "evaluation",
		accountSize: 50000,
		category: "futures",
		label: "Tradeify 50K Growth (Eval)",
		summary:
			"$3,000 target, $2,000 EOD trailing DD, $1,250 daily-loss soft pause, no consistency, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 2000,
			maxDrawdown: 4,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTarget: 6,
			profitTargetAbsolute: 3000,
			minTradingDays: 1,
			maxContracts: 4,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-growth-eval-100k",
		firm: "Tradeify",
		plan: "Growth Evaluation",
		phase: "evaluation",
		accountSize: 100000,
		category: "futures",
		label: "Tradeify 100K Growth (Eval)",
		summary:
			"$6,000 target, $3,500 EOD trailing DD, $2,500 daily-loss soft pause, no consistency, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 3500,
			maxDrawdown: 3.5,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTarget: 6,
			profitTargetAbsolute: 6000,
			minTradingDays: 1,
			maxContracts: 8,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-growth-eval-150k",
		firm: "Tradeify",
		plan: "Growth Evaluation",
		phase: "evaluation",
		accountSize: 150000,
		category: "futures",
		label: "Tradeify 150K Growth (Eval)",
		summary:
			"$9,000 target, $5,000 EOD trailing DD, $3,750 daily-loss soft pause, no consistency, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 5000,
			maxDrawdown: 3.333,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTarget: 6,
			profitTargetAbsolute: 9000,
			minTradingDays: 1,
			maxContracts: 12,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},

	// --- Growth Funded (35% consistency, 5 winning days for payout) --------
	{
		id: "tradeify-growth-funded-50k",
		firm: "Tradeify",
		plan: "Growth Funded",
		phase: "funded",
		accountSize: 50000,
		category: "futures",
		label: "Tradeify 50K Growth (Funded)",
		summary:
			"$2,000 EOD trailing DD, 35% consistency, payout after 5 winning days ($150+), 90/10 split, $500 min withdrawal.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 2000,
			maxDrawdown: 4,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 35,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 150,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 500,
			profitSplit: 90,
			maxContracts: 4,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-growth-funded-100k",
		firm: "Tradeify",
		plan: "Growth Funded",
		phase: "funded",
		accountSize: 100000,
		category: "futures",
		label: "Tradeify 100K Growth (Funded)",
		summary:
			"$3,500 EOD trailing DD, 35% consistency, payout after 5 winning days ($200+), 90/10 split, $1,000 min withdrawal.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 3500,
			maxDrawdown: 3.5,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 35,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 200,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1000,
			profitSplit: 90,
			maxContracts: 8,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-growth-funded-150k",
		firm: "Tradeify",
		plan: "Growth Funded",
		phase: "funded",
		accountSize: 150000,
		category: "futures",
		label: "Tradeify 150K Growth (Funded)",
		summary:
			"$5,000 EOD trailing DD, 35% consistency, payout after 5 winning days ($250+), 90/10 split, $1,500 min withdrawal.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 5000,
			maxDrawdown: 3.333,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 35,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 250,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1500,
			profitSplit: 90,
			maxContracts: 12,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},

	// --- Select Evaluation (formerly "Advanced"; 40% consistency, 3-day min,
	//     NO daily loss limit during eval) ----------------------------------
	{
		id: "tradeify-select-eval-50k",
		firm: "Tradeify",
		plan: "Select Evaluation",
		phase: "evaluation",
		accountSize: 50000,
		category: "futures",
		label: "Tradeify 50K Select (Eval)",
		summary:
			"$2,000 target, $2,000 EOD trailing DD, 40% consistency, min 3 days, no daily loss limit, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 2000,
			maxDrawdown: 4,
			dailyLossFailsAccount: false,
			profitTarget: 4,
			profitTargetAbsolute: 2000,
			minTradingDays: 3,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 40,
			consistencyComparator: "lte",
			consistencyPhase: "evaluation_only",
			maxContracts: 4,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-select-eval-100k",
		firm: "Tradeify",
		plan: "Select Evaluation",
		phase: "evaluation",
		accountSize: 100000,
		category: "futures",
		label: "Tradeify 100K Select (Eval)",
		summary:
			"$3,000 target, $3,000 EOD trailing DD, 40% consistency, min 3 days, no daily loss limit, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 3000,
			maxDrawdown: 3,
			dailyLossFailsAccount: false,
			profitTarget: 3,
			profitTargetAbsolute: 3000,
			minTradingDays: 3,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 40,
			consistencyComparator: "lte",
			consistencyPhase: "evaluation_only",
			maxContracts: 8,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-select-eval-150k",
		firm: "Tradeify",
		plan: "Select Evaluation",
		phase: "evaluation",
		accountSize: 150000,
		category: "futures",
		label: "Tradeify 150K Select (Eval)",
		summary:
			"$4,500 target, $4,500 EOD trailing DD, 40% consistency, min 3 days, no daily loss limit, no time limit.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 4500,
			maxDrawdown: 3,
			dailyLossFailsAccount: false,
			profitTarget: 3,
			profitTargetAbsolute: 4500,
			minTradingDays: 3,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 40,
			consistencyComparator: "lte",
			consistencyPhase: "evaluation_only",
			maxContracts: 12,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},

	// --- Select Funded (Flex payout: 5 winning days; consistency drops off
	//     when funded; no daily loss limit on Flex) -------------------------
	{
		id: "tradeify-select-funded-50k",
		firm: "Tradeify",
		plan: "Select Funded",
		phase: "funded",
		accountSize: 50000,
		category: "futures",
		label: "Tradeify 50K Select (Funded)",
		summary:
			"$2,000 EOD trailing DD, no consistency rule when funded, Flex payout after 5 winning days ($150+), 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 2000,
			maxDrawdown: 4,
			dailyLossFailsAccount: false,
			winningDayThreshold: 150,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 500,
			profitSplit: 90,
			maxContracts: 4,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-select-funded-100k",
		firm: "Tradeify",
		plan: "Select Funded",
		phase: "funded",
		accountSize: 100000,
		category: "futures",
		label: "Tradeify 100K Select (Funded)",
		summary:
			"$3,000 EOD trailing DD, no consistency rule when funded, Flex payout after 5 winning days ($200+), 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 3000,
			maxDrawdown: 3,
			dailyLossFailsAccount: false,
			winningDayThreshold: 200,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1000,
			profitSplit: 90,
			maxContracts: 8,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-select-funded-150k",
		firm: "Tradeify",
		plan: "Select Funded",
		phase: "funded",
		accountSize: 150000,
		category: "futures",
		label: "Tradeify 150K Select (Funded)",
		summary:
			"$4,500 EOD trailing DD, no consistency rule when funded, Flex payout after 5 winning days ($250+), 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 4500,
			maxDrawdown: 3,
			dailyLossFailsAccount: false,
			winningDayThreshold: 250,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1500,
			profitSplit: 90,
			maxContracts: 12,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},

	// --- Lightning Funded (instant funding, no eval; escalating consistency
	//     20%→25%→30% — first-payout 20% encoded; 7-day wait, $1k min) ------
	{
		id: "tradeify-lightning-funded-50k",
		firm: "Tradeify",
		plan: "Lightning Funded",
		phase: "funded",
		accountSize: 50000,
		category: "futures",
		label: "Tradeify 50K Lightning (Funded)",
		summary:
			"Instant funding, $2,500 EOD trailing DD, $1,250 daily-loss soft pause, 20% consistency (first payout), 5 winning days, 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 2500,
			maxDrawdown: 5,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTargetAbsolute: 3000,
			profitTarget: 6,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 20,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 150,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			firstPayoutWaitDays: 7,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1000,
			profitSplit: 90,
			maxContracts: 4,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-lightning-funded-100k",
		firm: "Tradeify",
		plan: "Lightning Funded",
		phase: "funded",
		accountSize: 100000,
		category: "futures",
		label: "Tradeify 100K Lightning (Funded)",
		summary:
			"Instant funding, $4,000 EOD trailing DD, $2,500 daily-loss soft pause, 20% consistency (first payout), 5 winning days, 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 4000,
			maxDrawdown: 4,
			dailyLossLimit: 2.5,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTargetAbsolute: 6000,
			profitTarget: 6,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 20,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 200,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			firstPayoutWaitDays: 7,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1000,
			profitSplit: 90,
			maxContracts: 8,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
	{
		id: "tradeify-lightning-funded-150k",
		firm: "Tradeify",
		plan: "Lightning Funded",
		phase: "funded",
		accountSize: 150000,
		category: "futures",
		label: "Tradeify 150K Lightning (Funded)",
		summary:
			"Instant funding, $5,250 EOD trailing DD, $3,000 daily-loss soft pause, 20% consistency (first payout), 5 winning days, 90/10 split.",
		asOf: "2026-06",
		fields: {
			drawdownAnchor: "trailing",
			drawdownHighWaterSource: "eod_realized",
			drawdownLock: "at_start_plus_buffer",
			drawdownLockBuffer: 100,
			drawdownBasis: "balance_realized",
			drawdownType: "eod",
			maxDrawdownAbsolute: 5250,
			maxDrawdown: 3.5,
			dailyLossLimit: 2,
			dailyLossAnchor: "from_day_start_balance",
			dailyLossBasis: "balance_realized",
			dailyLossFailsAccount: false,
			profitTargetAbsolute: 9000,
			profitTarget: 6,
			consistencyRuleType: "best_day_pct_of_total",
			consistencyRule: 20,
			consistencyComparator: "lte",
			consistencyPhase: "funded_only",
			winningDayThreshold: 250,
			winningDaysRequired: 5,
			payoutCycleType: "winning_days",
			payoutCycleLength: 5,
			firstPayoutWaitDays: 7,
			bufferType: "start_plus_drawdown",
			minWithdrawal: 1000,
			profitSplit: 90,
			maxContracts: 12,
			microToMiniRatio: 10,
			sessionFlatTime: "16:59",
			sessionFlatTimezone: "America/New_York",
		},
	},
];

export const PROP_PRESETS: PropPreset[] = [...TRADEIFY];

/** All distinct firms that have presets, in registry order. */
export function getPresetFirms(): string[] {
	const seen = new Set<string>();
	const firms: string[] = [];
	for (const p of PROP_PRESETS) {
		if (!seen.has(p.firm)) {
			seen.add(p.firm);
			firms.push(p.firm);
		}
	}
	return firms;
}

/** Presets for a given firm. */
export function getPresetsByFirm(firm: string): PropPreset[] {
	return PROP_PRESETS.filter((p) => p.firm === firm);
}

/** Look up a preset by id. */
export function getPresetById(id: string): PropPreset | undefined {
	return PROP_PRESETS.find((p) => p.id === id);
}
