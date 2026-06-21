// =============================================================================
// PROP COMPLIANCE CALCULATIONS
// Pure utility functions for computing prop firm compliance metrics.
// No database calls — all inputs are plain data.
// =============================================================================

import {
	BUFFER_TYPE,
	type BufferType,
	COMPLIANCE_STATUS,
	COMPLIANCE_THRESHOLDS,
	CONSISTENCY_COMPARATOR,
	CONSISTENCY_RULE_TYPE,
	type ComplianceStatus,
	type ConsistencyComparator,
	type ConsistencyRuleType,
	DATA_CONFIDENCE,
	type DataConfidence,
	DRAWDOWN_BASIS,
	DRAWDOWN_HIGH_WATER_SOURCE,
	DRAWDOWN_LOCK,
	type DrawdownBasis,
	type DrawdownHighWaterSource,
	type DrawdownLock,
	PAYOUT_CYCLE_TYPE,
	type PayoutCap,
	type PayoutCycleType,
	type ProfitSplitTier,
	QUALIFYING_DAY_MODE,
	type QualifyingDayMode,
} from "@/lib/constants/prop";
import { getDateStringInTimezone } from "@/lib/shared/timezone";
import type { EquityPoint } from "./risk";

// =============================================================================
// TYPES
// =============================================================================

export interface DrawdownStatusResult {
	/** Current drawdown as percentage of initial balance */
	percent: number;
	/** Max allowed drawdown percentage */
	limit: number;
	/** Fraction of limit used (0–1) */
	used: number;
	/** Fraction of limit remaining (0–1) */
	remaining: number;
	/** Compliance status */
	status: ComplianceStatus;
}

export interface DailyLossStatusResult {
	/** Today's P&L in dollars */
	current: number;
	/** Daily loss limit in dollars */
	limit: number;
	/** Fraction of limit used (0–1), 0 when profitable */
	used: number;
	/** Fraction of limit remaining (0–1) */
	remaining: number;
	/** Compliance status */
	status: ComplianceStatus;
}

export interface ProfitTargetResult {
	/** Current total P&L in dollars */
	current: number;
	/** Profit target in dollars */
	target: number;
	/** Progress toward target (0–1, can exceed 1) */
	progress: number;
	/** Compliance status based on progress */
	status: ComplianceStatus;
}

export interface ConsistencyResult {
	/** Largest single-day P&L as percentage of total profit */
	maxDayPercent: number;
	/** Consistency rule limit as percentage */
	limit: number;
	/** Whether the trader is compliant */
	isCompliant: boolean;
}

export interface TradingDaysResult {
	/** Number of distinct days traded */
	daysTraded: number;
	/** Minimum required trading days */
	minRequired: number;
	/** Days still needed (0 if met) */
	remaining: number;
}

export interface TrailingDrawdownResult {
	/** Maximum trailing drawdown in dollars */
	maxDrawdown: number;
	/** Maximum trailing drawdown as percentage of initial balance */
	maxDrawdownPercent: number;
	/** Current trailing drawdown in dollars */
	currentDrawdown: number;
	/** Current trailing drawdown as percentage of initial balance */
	currentDrawdownPercent: number;
}

// =============================================================================
// HELPER
// =============================================================================

/**
 * Determine compliance status from the remaining buffer fraction.
 * remaining = 1 means fully safe, 0 means at the limit.
 */
function statusFromBuffer(remaining: number): ComplianceStatus {
	if (remaining > COMPLIANCE_THRESHOLDS.SAFE_MIN) return COMPLIANCE_STATUS.SAFE;
	if (remaining > COMPLIANCE_THRESHOLDS.CAUTION_MIN)
		return COMPLIANCE_STATUS.CAUTION;
	return COMPLIANCE_STATUS.DANGER;
}

// =============================================================================
// DRAWDOWN STATUS
// =============================================================================

/**
 * Calculate drawdown compliance status.
 *
 * @param currentDrawdownPercent - Current drawdown as a percentage (e.g. 4 for 4%)
 * @param maxDrawdownPercent - Maximum allowed drawdown percentage (e.g. 6 for 6%)
 */
export function calculateDrawdownStatus(
	currentDrawdownPercent: number,
	maxDrawdownPercent: number,
): DrawdownStatusResult {
	if (maxDrawdownPercent <= 0) {
		return {
			percent: currentDrawdownPercent,
			limit: 0,
			used: 1,
			remaining: 0,
			status: COMPLIANCE_STATUS.DANGER,
		};
	}

	const used = Math.min(currentDrawdownPercent / maxDrawdownPercent, 1);
	const remaining = 1 - used;

	return {
		percent: currentDrawdownPercent,
		limit: maxDrawdownPercent,
		used,
		remaining,
		status: statusFromBuffer(remaining),
	};
}

// =============================================================================
// DAILY P&L
// =============================================================================

/**
 * Sum net P&L for trades on a given date.
 *
 * @param trades - Array of trades with netPnl (string) and exitTime (Date)
 * @param date - The date to filter by (defaults to today)
 * @param timezone - IANA timezone string for date grouping (defaults to "UTC")
 */
export function calculateDailyPnl(
	trades: { netPnl: string | null; exitTime: Date | null }[],
	date?: Date,
	timezone = "UTC",
): number {
	const target = date ?? new Date();
	const targetDate = getDateStringInTimezone(target, timezone);

	let total = 0;
	for (const trade of trades) {
		if (!trade.exitTime) continue;
		const tradeDate = getDateStringInTimezone(trade.exitTime, timezone);
		if (tradeDate === targetDate) {
			const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
			if (!Number.isNaN(pnl)) {
				total += pnl;
			}
		}
	}
	return total;
}

// =============================================================================
// DAILY LOSS STATUS
// =============================================================================

/**
 * Calculate daily loss compliance status.
 *
 * @param dailyPnl - Today's P&L in dollars (negative = loss)
 * @param dailyLossLimitPercent - Daily loss limit as percentage (e.g. 3 for 3%)
 * @param initialBalance - Account initial balance in dollars
 */
export function calculateDailyLossStatus(
	dailyPnl: number,
	dailyLossLimitPercent: number,
	initialBalance: number,
): DailyLossStatusResult {
	const limitDollars = (dailyLossLimitPercent / 100) * initialBalance;

	if (limitDollars <= 0) {
		return {
			current: dailyPnl,
			limit: 0,
			used: 1,
			remaining: 0,
			status: COMPLIANCE_STATUS.DANGER,
		};
	}

	// Only count losses toward the limit (positive P&L = no usage)
	const lossAmount = Math.max(0, -dailyPnl);
	const used = Math.min(lossAmount / limitDollars, 1);
	const remaining = 1 - used;

	return {
		current: dailyPnl,
		limit: limitDollars,
		used,
		remaining,
		status: statusFromBuffer(remaining),
	};
}

// =============================================================================
// PROFIT TARGET PROGRESS
// =============================================================================

/**
 * Calculate progress toward the profit target.
 *
 * @param totalPnl - Current total P&L in dollars
 * @param profitTargetPercent - Profit target as percentage (e.g. 8 for 8%)
 * @param initialBalance - Account initial balance in dollars
 */
export function calculateProfitTargetProgress(
	totalPnl: number,
	profitTargetPercent: number,
	initialBalance: number,
): ProfitTargetResult {
	const targetDollars = (profitTargetPercent / 100) * initialBalance;

	if (targetDollars <= 0) {
		return {
			current: totalPnl,
			target: 0,
			progress: totalPnl > 0 ? 1 : 0,
			status: COMPLIANCE_STATUS.SAFE,
		};
	}

	const progress = Math.max(0, totalPnl / targetDollars);

	// For profit target, status is based on progress (inverted: more is better)
	let status: ComplianceStatus;
	if (progress >= 1) {
		status = COMPLIANCE_STATUS.SAFE;
	} else if (progress >= 0.5) {
		status = COMPLIANCE_STATUS.CAUTION;
	} else {
		status = COMPLIANCE_STATUS.DANGER;
	}

	return {
		current: totalPnl,
		target: targetDollars,
		progress,
		status,
	};
}

// =============================================================================
// CONSISTENCY METRIC
// =============================================================================

/**
 * Check whether the trader's largest single-day P&L exceeds the consistency rule.
 *
 * @param dailyPnls - Array of daily P&L values in dollars
 * @param consistencyRulePercent - Max allowed % of total profit from a single day (e.g. 30 for 30%)
 */
export function calculateConsistencyMetric(
	dailyPnls: number[],
	consistencyRulePercent: number,
): ConsistencyResult {
	if (dailyPnls.length === 0 || consistencyRulePercent <= 0) {
		return {
			maxDayPercent: 0,
			limit: consistencyRulePercent,
			isCompliant: true,
		};
	}

	const totalProfit = dailyPnls
		.filter((p) => p > 0)
		.reduce((sum, p) => sum + p, 0);

	if (totalProfit <= 0) {
		return {
			maxDayPercent: 0,
			limit: consistencyRulePercent,
			isCompliant: true,
		};
	}

	const maxDayProfit = Math.max(...dailyPnls.filter((p) => p > 0), 0);
	const maxDayPercent = (maxDayProfit / totalProfit) * 100;

	return {
		maxDayPercent,
		limit: consistencyRulePercent,
		isCompliant: maxDayPercent <= consistencyRulePercent,
	};
}

// =============================================================================
// TRADING DAYS
// =============================================================================

/**
 * Count distinct trading days from trades.
 *
 * @param trades - Array of trades with exitTime
 * @param minRequired - Minimum number of trading days required
 * @param timezone - IANA timezone string for date grouping (defaults to "UTC")
 */
export function calculateTradingDays(
	trades: { exitTime: Date | null }[],
	minRequired: number,
	timezone = "UTC",
): TradingDaysResult {
	const uniqueDates = new Set<string>();

	for (const trade of trades) {
		if (trade.exitTime) {
			uniqueDates.add(getDateStringInTimezone(trade.exitTime, timezone));
		}
	}

	const daysTraded = uniqueDates.size;
	const remaining = Math.max(0, minRequired - daysTraded);

	return {
		daysTraded,
		minRequired,
		remaining,
	};
}

// =============================================================================
// TRAILING DRAWDOWN
// =============================================================================

/**
 * Compute trailing (high-water-mark) drawdown from an equity curve.
 * The equity curve should start from initial balance.
 *
 * @param equityCurve - Equity curve points from buildEquityCurve()
 * @param initialBalance - Account initial balance in dollars
 */
export function calculateTrailingDrawdown(
	equityCurve: EquityPoint[],
	initialBalance: number,
): TrailingDrawdownResult {
	if (equityCurve.length === 0 || initialBalance <= 0) {
		return {
			maxDrawdown: 0,
			maxDrawdownPercent: 0,
			currentDrawdown: 0,
			currentDrawdownPercent: 0,
		};
	}

	// buildEquityCurve tracks cumulative P&L from $0.
	// For trailing drawdown relative to account balance:
	// highWaterMark = initialBalance + peak cumulative P&L
	// current equity = initialBalance + cumulative P&L
	let highWaterMark = initialBalance;
	let maxDrawdownDollars = 0;
	let currentDrawdownDollars = 0;

	for (const point of equityCurve) {
		const equity = initialBalance + point.equity;
		highWaterMark = Math.max(highWaterMark, equity);
		const dd = highWaterMark - equity;
		maxDrawdownDollars = Math.max(maxDrawdownDollars, dd);
		currentDrawdownDollars = dd;
	}

	return {
		maxDrawdown: maxDrawdownDollars,
		maxDrawdownPercent: (maxDrawdownDollars / initialBalance) * 100,
		currentDrawdown: currentDrawdownDollars,
		currentDrawdownPercent: (currentDrawdownDollars / initialBalance) * 100,
	};
}

// =============================================================================
// EOD TRAILING DRAWDOWN
// =============================================================================

/**
 * Compute end-of-day trailing drawdown from an equity curve.
 * Like trailing drawdown, but the high-water mark only ratchets up at end of
 * each trading day (last trade of the day), not intraday.
 *
 * @param equityCurve - Equity curve points from buildEquityCurve()
 * @param initialBalance - Account initial balance in dollars
 * @param timezone - IANA timezone for day grouping (defaults to "UTC")
 */
export function calculateEodTrailingDrawdown(
	equityCurve: EquityPoint[],
	initialBalance: number,
	timezone = "UTC",
): TrailingDrawdownResult {
	if (equityCurve.length === 0 || initialBalance <= 0) {
		return {
			maxDrawdown: 0,
			maxDrawdownPercent: 0,
			currentDrawdown: 0,
			currentDrawdownPercent: 0,
		};
	}

	// Group points by trading day, keeping only the last point per day
	const eodByDay = new Map<string, EquityPoint>();
	for (const point of equityCurve) {
		const dayKey = getDateStringInTimezone(point.date, timezone);
		eodByDay.set(dayKey, point);
	}

	// Walk EOD points in chronological order to build the HWM
	const eodPoints = [...eodByDay.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, point]) => point);

	let highWaterMark = initialBalance;
	let maxDrawdownDollars = 0;

	for (const point of eodPoints) {
		const eodEquity = initialBalance + point.equity;
		highWaterMark = Math.max(highWaterMark, eodEquity);
		const dd = highWaterMark - eodEquity;
		maxDrawdownDollars = Math.max(maxDrawdownDollars, dd);
	}

	// Current drawdown: use the latest equity point against the EOD HWM
	const lastPoint = equityCurve[equityCurve.length - 1];
	const currentEquity = initialBalance + (lastPoint?.equity ?? 0);
	const currentDrawdownDollars = Math.max(0, highWaterMark - currentEquity);

	return {
		maxDrawdown: maxDrawdownDollars,
		maxDrawdownPercent: (maxDrawdownDollars / initialBalance) * 100,
		currentDrawdown: currentDrawdownDollars,
		currentDrawdownPercent: (currentDrawdownDollars / initialBalance) * 100,
	};
}

// =============================================================================
// STATIC DRAWDOWN
// =============================================================================

/**
 * Calculate static drawdown (simple formula from initial balance).
 *
 * @param initialBalance - Account initial balance in dollars
 * @param currentBalance - Current account balance in dollars
 */
export function calculateStaticDrawdown(
	initialBalance: number,
	currentBalance: number,
): { drawdown: number; drawdownPercent: number } {
	if (initialBalance <= 0) {
		return { drawdown: 0, drawdownPercent: 0 };
	}

	const drawdown = Math.max(0, initialBalance - currentBalance);
	const drawdownPercent = (drawdown / initialBalance) * 100;

	return { drawdown, drawdownPercent };
}

// =============================================================================
// MONTE CARLO CHALLENGE SIMULATOR
// =============================================================================

export interface SimulatePropChallengeInput {
	/** Win rate as a fraction (e.g. 0.55 for 55%) */
	winRate: number;
	/** Average winning trade in dollars */
	avgWin: number;
	/** Average losing trade in dollars (positive number, e.g. 200) */
	avgLoss: number;
	/** Profit target in dollars */
	profitTarget: number;
	/** Max drawdown in dollars */
	maxDrawdown: number;
	/** Starting balance in dollars */
	initialBalance: number;
	/** Maximum trades per simulation before giving up */
	maxTrades: number;
	/** Number of simulations to run (default 10000) */
	iterations?: number;
}

export interface SimulatePropChallengeResult {
	/** Fraction of simulations that passed (0–1) */
	passRate: number;
	/** Fraction of simulations that failed (0–1) */
	failRate: number;
	/** Average number of trades to reach profit target (among passes only) */
	avgTradesToPass: number;
	/** Median final P&L across all simulations */
	medianOutcome: number;
	/** Percentile outcomes (p10, p25, p50, p75, p90) */
	percentiles: {
		p10: number;
		p25: number;
		p50: number;
		p75: number;
		p90: number;
	};
	/** Total number of simulations run */
	simulations: number;
}

/**
 * Run a Monte Carlo simulation to estimate the probability of passing a prop challenge.
 *
 * Each simulation runs random trades using the given win rate and avg win/loss
 * until one of three conditions is met:
 * - Profit target reached (pass)
 * - Max drawdown breached (fail)
 * - Max trades exceeded without reaching target (fail)
 */
export function simulatePropChallenge(
	input: SimulatePropChallengeInput,
): SimulatePropChallengeResult {
	const {
		winRate,
		avgWin,
		avgLoss,
		profitTarget,
		maxDrawdown,
		initialBalance,
		maxTrades,
		iterations = 10000,
	} = input;

	// Edge case: impossible to pass with 0 profit target
	if (profitTarget <= 0) {
		return {
			passRate: 1,
			failRate: 0,
			avgTradesToPass: 0,
			medianOutcome: 0,
			percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
			simulations: iterations,
		};
	}

	// Edge case: impossible drawdown constraint
	if (maxDrawdown <= 0) {
		return {
			passRate: 0,
			failRate: 1,
			avgTradesToPass: 0,
			medianOutcome: 0,
			percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
			simulations: iterations,
		};
	}

	let passes = 0;
	let totalTradesToPass = 0;
	const finalPnls: number[] = [];

	// Simple seeded PRNG for reproducibility is not required here.
	// Using Math.random() since this is a client/server utility.
	for (let i = 0; i < iterations; i++) {
		let equity = initialBalance;
		let highWaterMark = initialBalance;
		let pnl = 0;
		let passed = false;
		let tradeCount = 0;

		for (let t = 0; t < maxTrades; t++) {
			tradeCount++;

			// Determine trade outcome
			const isWin = Math.random() < winRate;
			const tradeResult = isWin ? avgWin : -avgLoss;

			pnl += tradeResult;
			equity = initialBalance + pnl;
			highWaterMark = Math.max(highWaterMark, equity);

			// Check profit target
			if (pnl >= profitTarget) {
				passed = true;
				break;
			}

			// Check max drawdown (from high water mark)
			const drawdown = highWaterMark - equity;
			if (drawdown >= maxDrawdown) {
				break;
			}
		}

		finalPnls.push(pnl);

		if (passed) {
			passes++;
			totalTradesToPass += tradeCount;
		}
	}

	// Sort for percentile calculation
	finalPnls.sort((a, b) => a - b);

	const passRate = passes / iterations;
	const failRate = 1 - passRate;
	const avgTradesToPass = passes > 0 ? totalTradesToPass / passes : 0;

	return {
		passRate,
		failRate,
		avgTradesToPass,
		medianOutcome: percentile(finalPnls, 0.5),
		percentiles: {
			p10: percentile(finalPnls, 0.1),
			p25: percentile(finalPnls, 0.25),
			p50: percentile(finalPnls, 0.5),
			p75: percentile(finalPnls, 0.75),
			p90: percentile(finalPnls, 0.9),
		},
		simulations: iterations,
	};
}

/** Compute a percentile value from a sorted array using linear interpolation. */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const index = p * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	if (lower === upper) return sorted[lower] ?? 0;
	const lowerVal = sorted[lower] ?? 0;
	const upperVal = sorted[upper] ?? 0;
	return lowerVal + (upperVal - lowerVal) * (index - lower);
}

// =============================================================================
// OVERALL COMPLIANCE STATUS
// =============================================================================

/**
 * Return the worst compliance status from an array of statuses.
 * danger > caution > safe
 */
export function getOverallComplianceStatus(
	statuses: ComplianceStatus[],
): ComplianceStatus {
	if (statuses.length === 0) return COMPLIANCE_STATUS.SAFE;
	if (statuses.includes(COMPLIANCE_STATUS.DANGER))
		return COMPLIANCE_STATUS.DANGER;
	if (statuses.includes(COMPLIANCE_STATUS.CAUTION))
		return COMPLIANCE_STATUS.CAUTION;
	return COMPLIANCE_STATUS.SAFE;
}

// =============================================================================
// =============================================================================
// EXPANDED 2026 MODEL — pure calculations for the prop-compliance overhaul.
// All inputs are plain data; everything is computed from REALIZED closed-trade
// P&L, so results carry a DataConfidence (see constants/prop.ts).
// =============================================================================
// =============================================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// =============================================================================
// TRAILING FLOOR (drawdown with lock-at-start, the mechanic the legacy
// calculateTrailingDrawdown / calculateEodTrailingDrawdown both omitted)
// =============================================================================

export interface TrailingFloorOptions {
	/** Account starting balance in dollars. */
	initialBalance: number;
	/** Max drawdown / max-loss-limit in DOLLARS. */
	drawdownAbsolute: number;
	/** Whether the high-water mark follows intraday or end-of-day equity. */
	highWaterSource: DrawdownHighWaterSource;
	/** Where the trailing floor freezes. */
	lock: DrawdownLock;
	/** Buffer above start when lock === at_start_plus_buffer (USD, e.g. 100 for Apex). */
	lockBuffer?: number;
	/** What the breach check measures against (affects confidence only). */
	basis?: DrawdownBasis;
	/** IANA timezone for end-of-day grouping. */
	timezone?: string;
}

export interface TrailingFloorResult {
	/** Current loss floor in dollars — equity at/below this is a breach. */
	floor: number;
	/** Whether the floor is currently frozen at its lock point. */
	lockEngaged: boolean;
	/** Current account equity (initialBalance + cumulative realized P&L). */
	currentEquity: number;
	/** Dollars of room before breaching the floor (currentEquity − floor). */
	roomToFloor: number;
	/** Current drawdown used, in dollars (0…drawdownAbsolute; may exceed if breached). */
	currentDrawdown: number;
	/** Current drawdown used as % of initial balance (feed to calculateDrawdownStatus). */
	currentDrawdownPercent: number;
	/** Worst drawdown used over the path, in dollars. */
	maxDrawdown: number;
	/** Worst drawdown used as % of initial balance. */
	maxDrawdownPercent: number;
	/** Confidence given our realized-only data. */
	dataConfidence: DataConfidence;
}

/**
 * Compute the trailing loss floor and current drawdown for a prop account,
 * applying the lock-at-start (or start+buffer) mechanic used by nearly every
 * futures firm. Generalizes the legacy trailing-drawdown formula:
 *
 *   floor(t)        = min(runningHighWater(t) − DD, lockPoint)   (lockPoint = ∞ when lock=none)
 *   drawdownUsed(t) = DD − (equity(t) − floor(t))                (= highWater − equity when unlocked)
 *
 * With lock=none this reproduces `calculateTrailingDrawdown` exactly; with
 * lock=at_start the floor freezes at the starting balance once the trader has
 * banked DD of profit, so a fully-built buffer correctly shows full downside room.
 */
export function computeTrailingFloor(
	equityCurve: EquityPoint[],
	opts: TrailingFloorOptions,
): TrailingFloorResult {
	const {
		initialBalance,
		drawdownAbsolute,
		highWaterSource,
		lock,
		lockBuffer = 0,
		basis = DRAWDOWN_BASIS.BALANCE_REALIZED,
		timezone = "UTC",
	} = opts;

	const dataConfidence =
		highWaterSource === DRAWDOWN_HIGH_WATER_SOURCE.INTRADAY_UNREALIZED ||
		basis === DRAWDOWN_BASIS.EQUITY_UNREALIZED
			? DATA_CONFIDENCE.APPROXIMATE
			: DATA_CONFIDENCE.EXACT;

	const lockPoint =
		lock === DRAWDOWN_LOCK.AT_START
			? initialBalance
			: lock === DRAWDOWN_LOCK.AT_START_PLUS_BUFFER
				? initialBalance + lockBuffer
				: Number.POSITIVE_INFINITY;

	if (initialBalance <= 0 || drawdownAbsolute <= 0) {
		const pct =
			initialBalance > 0 ? (drawdownAbsolute / initialBalance) * 100 : 0;
		return {
			floor: initialBalance,
			lockEngaged: false,
			currentEquity: initialBalance,
			roomToFloor: 0,
			currentDrawdown: Math.max(0, drawdownAbsolute),
			currentDrawdownPercent: pct,
			maxDrawdown: Math.max(0, drawdownAbsolute),
			maxDrawdownPercent: pct,
			dataConfidence,
		};
	}

	// Select the points the high-water mark walks.
	let points = equityCurve;
	if (highWaterSource === DRAWDOWN_HIGH_WATER_SOURCE.EOD_REALIZED) {
		const eodByDay = new Map<string, EquityPoint>();
		for (const p of equityCurve) {
			eodByDay.set(getDateStringInTimezone(p.date, timezone), p);
		}
		points = [...eodByDay.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, p]) => p);
	}

	let runningHwm = initialBalance;
	let currentFloor = Math.min(initialBalance - drawdownAbsolute, lockPoint);
	let currentEquity = initialBalance;
	let currentDrawdown = 0;
	let maxDrawdown = 0;

	for (const p of points) {
		const equity = initialBalance + p.equity;
		runningHwm = Math.max(runningHwm, equity);
		const rawFloor = runningHwm - drawdownAbsolute;
		const floor =
			lock === DRAWDOWN_LOCK.NONE ? rawFloor : Math.min(rawFloor, lockPoint);
		const used = drawdownAbsolute - (equity - floor);
		maxDrawdown = Math.max(maxDrawdown, used);
		currentDrawdown = used;
		currentFloor = floor;
		currentEquity = equity;
	}

	const clampedCurrent = Math.max(0, currentDrawdown);
	const clampedMax = Math.max(0, maxDrawdown);
	const lockEngaged =
		lock !== DRAWDOWN_LOCK.NONE && runningHwm - drawdownAbsolute >= lockPoint;

	return {
		floor: currentFloor,
		lockEngaged,
		currentEquity,
		roomToFloor: currentEquity - currentFloor,
		currentDrawdown: clampedCurrent,
		currentDrawdownPercent: (clampedCurrent / initialBalance) * 100,
		maxDrawdown: clampedMax,
		maxDrawdownPercent: (clampedMax / initialBalance) * 100,
		dataConfidence,
	};
}

// =============================================================================
// TYPED / WINDOWED CONSISTENCY
// =============================================================================

export interface ConsistencyCheckOptions {
	type: ConsistencyRuleType;
	/** The X% threshold. */
	pct: number;
	/** ≤ (default) vs strict <. */
	comparator?: ConsistencyComparator;
	/** Profit target in dollars, for best_day_pct_of_target. */
	profitTarget?: number;
}

export interface ConsistencyCheckResult {
	type: ConsistencyRuleType;
	compliant: boolean;
	/** Best day (or trade) as a percentage of the denominator. */
	currentRatio: number;
	/** Configured threshold percentage. */
	threshold: number;
	/** Best single day P&L in dollars (or best trade for per-trade rules). */
	bestDay: number;
	/** Denominator used (total/target/positive days). */
	denominator: number;
	/** Extra total profit (USD) needed to satisfy the rule, 0 if compliant or N/A. */
	extraProfitNeeded: number;
}

/**
 * Typed consistency check. Unlike the legacy `calculateConsistencyMetric`
 * (which always used the sum of positive days), the total-profit variants here
 * use NET realized profit as the denominator — matching Topstep's documented
 * "Best Day / Total Profit" where losses reduce the denominator.
 */
export function checkConsistency(
	input: { dailyPnls: number[]; tradePnls?: number[] },
	opts: ConsistencyCheckOptions,
): ConsistencyCheckResult {
	const { type, pct } = opts;
	const comparator = opts.comparator ?? CONSISTENCY_COMPARATOR.LTE;
	const profitTarget = opts.profitTarget ?? 0;

	const base: ConsistencyCheckResult = {
		type,
		compliant: true,
		currentRatio: 0,
		threshold: pct,
		bestDay: 0,
		denominator: 0,
		extraProfitNeeded: 0,
	};

	if (type === CONSISTENCY_RULE_TYPE.OFF || pct <= 0) return base;

	const dailyPnls = input.dailyPnls ?? [];
	const usePerTrade = type === CONSISTENCY_RULE_TYPE.PER_TRADE_PCT_OF_TOTAL;
	const series = usePerTrade ? (input.tradePnls ?? []) : dailyPnls;
	const positives = series.filter((v) => v > 0);
	const bestDay = positives.length > 0 ? Math.max(...positives) : 0;

	let denominator: number;
	if (type === CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_TARGET) {
		denominator = profitTarget;
	} else if (type === CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_POSITIVE_DAYS) {
		denominator = dailyPnls.filter((v) => v > 0).reduce((s, v) => s + v, 0);
	} else {
		// total net realized profit (Topstep: losses reduce it)
		denominator = dailyPnls.reduce((s, v) => s + v, 0);
	}

	if (denominator <= 0 || bestDay <= 0) return base;

	const currentRatio = (bestDay / denominator) * 100;
	const compliant =
		comparator === CONSISTENCY_COMPARATOR.LT
			? currentRatio < pct
			: currentRatio <= pct;

	// Only profit-distribution rules (not fixed-target) can be fixed by earning more.
	const totalBased = type !== CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_TARGET;
	const requiredTotal = bestDay / (pct / 100);
	const extraProfitNeeded =
		totalBased && !compliant ? Math.max(0, requiredTotal - denominator) : 0;

	return {
		type,
		compliant,
		currentRatio,
		threshold: pct,
		bestDay,
		denominator,
		extraProfitNeeded,
	};
}

// =============================================================================
// QUALIFYING TRADING DAYS
// =============================================================================

export interface QualifyingDaysResult {
	count: number;
	dates: string[];
}

/**
 * Count days that "qualify" under a given mode — distinct from the eval
 * any-trade counter. min_profit_pct is treated like min_profit_abs with a
 * pre-resolved dollar threshold (true %-of-equity needs live data).
 */
export function countQualifyingDays(
	trades: { netPnl: string | null; exitTime: Date | null }[],
	opts: { mode: QualifyingDayMode; minProfit?: number; timezone?: string },
): QualifyingDaysResult {
	const { mode, minProfit = 0, timezone = "UTC" } = opts;

	const byDay = new Map<string, number>();
	for (const t of trades) {
		if (!t.exitTime) continue;
		const key = getDateStringInTimezone(t.exitTime, timezone);
		const pnl = t.netPnl ? parseFloat(t.netPnl) : 0;
		byDay.set(key, (byDay.get(key) ?? 0) + (Number.isNaN(pnl) ? 0 : pnl));
	}

	const dates: string[] = [];
	for (const [day, pnl] of byDay.entries()) {
		let qualifies = false;
		switch (mode) {
			case QUALIFYING_DAY_MODE.ANY_TRADE:
				qualifies = true;
				break;
			case QUALIFYING_DAY_MODE.ANY_POSITIVE:
				qualifies = pnl > 0;
				break;
			default:
				// min_profit_abs and min_profit_pct (pre-resolved $ threshold)
				qualifies = pnl >= minProfit && pnl > 0;
				break;
		}
		if (qualifies) dates.push(day);
	}

	dates.sort();
	return { count: dates.length, dates };
}

// =============================================================================
// INACTIVITY & EVAL TIME LIMIT
// =============================================================================

export interface InactivityResult {
	idleDays: number;
	limitDays: number;
	breached: boolean;
	/** Days left before the inactivity limit; null when no limit configured. */
	daysUntilBreach: number | null;
	lastTradeDate: Date | null;
}

/** Check inactivity-timeout exposure from the last trade date. */
export function checkInactivity(
	lastTradeDate: Date | null,
	limitDays: number,
	now: Date,
): InactivityResult {
	if (!limitDays || limitDays <= 0) {
		return {
			idleDays: 0,
			limitDays: 0,
			breached: false,
			daysUntilBreach: null,
			lastTradeDate,
		};
	}
	if (!lastTradeDate) {
		return {
			idleDays: 0,
			limitDays,
			breached: false,
			daysUntilBreach: limitDays,
			lastTradeDate: null,
		};
	}
	const idleDays = Math.floor(
		(now.getTime() - lastTradeDate.getTime()) / MS_PER_DAY,
	);
	const breached = idleDays >= limitDays;
	return {
		idleDays,
		limitDays,
		breached,
		daysUntilBreach: breached ? 0 : limitDays - idleDays,
		lastTradeDate,
	};
}

export interface EvalTimeLimitResult {
	daysElapsed: number | null;
	maxDays: number | null;
	daysRemaining: number | null;
	expired: boolean;
}

/** Check evaluation time-limit exposure (null maxDays = unlimited). */
export function checkEvalTimeLimit(
	challengeStartDate: Date | null,
	maxDays: number | null,
	now: Date,
): EvalTimeLimitResult {
	if (!challengeStartDate) {
		return {
			daysElapsed: null,
			maxDays: maxDays && maxDays > 0 ? maxDays : null,
			daysRemaining: null,
			expired: false,
		};
	}
	const daysElapsed = Math.floor(
		(now.getTime() - challengeStartDate.getTime()) / MS_PER_DAY,
	);
	if (!maxDays || maxDays <= 0) {
		return { daysElapsed, maxDays: null, daysRemaining: null, expired: false };
	}
	return {
		daysElapsed,
		maxDays,
		daysRemaining: Math.max(0, maxDays - daysElapsed),
		expired: daysElapsed >= maxDays,
	};
}

// =============================================================================
// PAYOUT ELIGIBILITY (the marquee new model)
// =============================================================================

export interface PayoutRecord {
	date: Date;
	paidAmount: number;
}

export interface PayoutEligibilityConfig {
	initialBalance: number;
	/** Sum of all realized closed-trade P&L (account-wide). */
	totalRealizedPnl: number;
	/** Drawdown amount in dollars, for the safety-net buffer floor. */
	drawdownAbsolute: number;
	/** Per-winning-day profit threshold in dollars. */
	winningDayThreshold: number;
	/** Winning days required this cycle. */
	winningDaysRequired: number;
	payoutCycleType: PayoutCycleType;
	/** Cycle length: days (calendar), hours, or winning-days fallback. */
	payoutCycleLength: number;
	/** Calendar/hours wait before the FIRST payout (from first trade). */
	firstPayoutWaitDays?: number;
	firstTradeDate?: Date | null;
	bufferType: BufferType;
	minWithdrawal?: number;
	firstPayoutCaps?: PayoutCap[];
	maxLifetimePayouts?: number;
	/** Cycle-windowed best-day consistency cap at payout (%). */
	payoutConsistencyPct?: number;
	consistencyComparator?: ConsistencyComparator;
	profitSplitTiers?: ProfitSplitTier[];
	/** Flat split fallback (%). */
	profitSplit?: number;
	timezone?: string;
}

export interface PayoutEligibilityResult {
	eligible: boolean;
	payoutIndex: number;
	winningDays: { count: number; required: number; qualifyingDates: string[] };
	buffer: { floor: number; withdrawableProfit: number; cleared: boolean };
	cycle: {
		type: PayoutCycleType;
		ready: boolean;
		elapsed: number;
		required: number;
		nextEligibleAt: Date | null;
	};
	consistency: ConsistencyCheckResult | null;
	cap: { capAmount: number | null; lifetimeReached: boolean };
	splitPct: number;
	minWithdrawal: number;
	minWithdrawalMet: boolean;
	estimatedGross: number;
	estimatedNet: number;
	blockers: string[];
	manualChecks: string[];
}

/** Resolve the value of a ladder rung that applies at the given payout index. */
function resolveLadder<T extends { payoutIndex: number }>(
	ladder: T[] | undefined,
	payoutIndex: number,
): T | null {
	if (!ladder || ladder.length === 0) return null;
	const sorted = [...ladder].sort((a, b) => a.payoutIndex - b.payoutIndex);
	let match: T | null = null;
	for (const rung of sorted) {
		if (rung.payoutIndex <= payoutIndex) match = rung;
	}
	return match ?? sorted[0] ?? null;
}

/**
 * Compute funded-account payout readiness from realized closed-trade P&L plus a
 * user-maintained payout log. Everything is computable except "no open
 * positions" and an equity-locked buffer, returned as manualChecks.
 */
export function computePayoutEligibility(
	trades: { netPnl: string | null; exitTime: Date | null }[],
	payouts: PayoutRecord[],
	config: PayoutEligibilityConfig,
	now: Date,
): PayoutEligibilityResult {
	const {
		initialBalance,
		totalRealizedPnl,
		drawdownAbsolute,
		winningDayThreshold,
		winningDaysRequired,
		payoutCycleType,
		payoutCycleLength,
		firstPayoutWaitDays,
		firstTradeDate = null,
		bufferType,
		minWithdrawal = 0,
		firstPayoutCaps,
		maxLifetimePayouts,
		payoutConsistencyPct = 0,
		consistencyComparator = CONSISTENCY_COMPARATOR.LTE,
		profitSplitTiers,
		profitSplit = 100,
		timezone = "UTC",
	} = config;

	const blockers: string[] = [];
	const manualChecks = [
		"Confirm all positions are flat before requesting a payout",
	];

	const payoutIndex = payouts.length;
	const lastPayout = payouts.reduce<PayoutRecord | null>(
		(latest, p) => (!latest || p.date > latest.date ? p : latest),
		null,
	);

	// Current cycle = trades since the last payout (or all if none yet).
	const cycleStart = lastPayout?.date ?? null;
	const cycleTrades = cycleStart
		? trades.filter((t) => t.exitTime && t.exitTime > cycleStart)
		: trades;

	// --- Winning days ---
	const winning = countQualifyingDays(cycleTrades, {
		mode: QUALIFYING_DAY_MODE.MIN_PROFIT_ABS,
		minProfit: winningDayThreshold,
		timezone,
	});
	const winningDaysOk =
		winningDaysRequired <= 0 || winning.count >= winningDaysRequired;
	if (!winningDaysOk) {
		blockers.push(
			`${winning.count}/${winningDaysRequired} qualifying winning days`,
		);
	}

	// --- Buffer / withdrawable profit ---
	const currentBalance = initialBalance + totalRealizedPnl;
	const bufferFloor =
		bufferType === BUFFER_TYPE.START_PLUS_DRAWDOWN
			? initialBalance + drawdownAbsolute
			: initialBalance;
	const withdrawableProfit = Math.max(0, currentBalance - bufferFloor);
	const bufferCleared = currentBalance >= bufferFloor && withdrawableProfit > 0;
	if (!bufferCleared) {
		blockers.push("Balance below the withdrawable buffer floor");
	}
	if (bufferType === BUFFER_TYPE.START_PLUS_DRAWDOWN) {
		manualChecks.push(
			"Buffer uses realized balance — verify against your live trailing threshold",
		);
	}

	// --- Cycle timing ---
	let cycleReady = true;
	let cycleElapsed = 0;
	let cycleRequired = payoutCycleLength;
	let nextEligibleAt: Date | null = null;
	if (payoutCycleType === PAYOUT_CYCLE_TYPE.WINNING_DAYS) {
		cycleElapsed = winning.count;
		cycleRequired = winningDaysRequired || payoutCycleLength;
		cycleReady = winningDaysOk;
	} else {
		const anchor =
			lastPayout?.date ??
			(payoutIndex === 0 ? firstTradeDate : null) ??
			firstTradeDate;
		cycleRequired =
			payoutIndex === 0 && firstPayoutWaitDays
				? firstPayoutWaitDays
				: payoutCycleLength;
		if (anchor) {
			const unitMs =
				payoutCycleType === PAYOUT_CYCLE_TYPE.HOURS
					? 1000 * 60 * 60
					: MS_PER_DAY;
			cycleElapsed = Math.floor((now.getTime() - anchor.getTime()) / unitMs);
			cycleReady = cycleElapsed >= cycleRequired;
			if (!cycleReady) {
				nextEligibleAt = new Date(anchor.getTime() + cycleRequired * unitMs);
			}
		} else {
			// No anchor yet (no trades / no first-trade date): not ready.
			cycleReady = false;
		}
		if (!cycleReady) {
			blockers.push(
				`${cycleElapsed}/${cycleRequired} ${payoutCycleType === PAYOUT_CYCLE_TYPE.HOURS ? "hours" : "days"} in payout cycle`,
			);
		}
	}

	// --- Cycle-windowed consistency ---
	let consistency: ConsistencyCheckResult | null = null;
	if (payoutConsistencyPct > 0) {
		const dailyMap = new Map<string, number>();
		for (const t of cycleTrades) {
			if (!t.exitTime) continue;
			const key = getDateStringInTimezone(t.exitTime, timezone);
			const pnl = t.netPnl ? parseFloat(t.netPnl) : 0;
			dailyMap.set(
				key,
				(dailyMap.get(key) ?? 0) + (Number.isNaN(pnl) ? 0 : pnl),
			);
		}
		consistency = checkConsistency(
			{ dailyPnls: [...dailyMap.values()] },
			{
				type: CONSISTENCY_RULE_TYPE.BEST_DAY_PCT_OF_TOTAL,
				pct: payoutConsistencyPct,
				comparator: consistencyComparator,
			},
		);
		if (!consistency.compliant) {
			blockers.push("Best day exceeds the payout consistency cap");
		}
	}

	// --- Cap + lifetime ---
	const capRung = resolveLadder(firstPayoutCaps, payoutIndex);
	const capAmount = capRung?.capAmount ?? null;
	const lifetimeReached =
		typeof maxLifetimePayouts === "number" &&
		maxLifetimePayouts > 0 &&
		payoutIndex >= maxLifetimePayouts;
	if (lifetimeReached) {
		blockers.push("Lifetime payout count reached");
	}

	// --- Split ---
	const splitRung = resolveLadder(profitSplitTiers, payoutIndex);
	const splitPct = splitRung?.splitPct ?? profitSplit;

	// --- Estimate ---
	const estimatedGross =
		capAmount != null
			? Math.min(withdrawableProfit, capAmount)
			: withdrawableProfit;
	const estimatedNet = estimatedGross * (splitPct / 100);

	const minWithdrawalMet = withdrawableProfit >= minWithdrawal;
	if (!minWithdrawalMet) {
		blockers.push(
			`Withdrawable profit below $${minWithdrawal.toLocaleString("en-US")} minimum`,
		);
	}

	return {
		eligible: blockers.length === 0,
		payoutIndex,
		winningDays: {
			count: winning.count,
			required: winningDaysRequired,
			qualifyingDates: winning.dates,
		},
		buffer: {
			floor: bufferFloor,
			withdrawableProfit,
			cleared: bufferCleared,
		},
		cycle: {
			type: payoutCycleType,
			ready: cycleReady,
			elapsed: cycleElapsed,
			required: cycleRequired,
			nextEligibleAt,
		},
		consistency,
		cap: { capAmount, lifetimeReached },
		splitPct,
		minWithdrawal,
		minWithdrawalMet,
		estimatedGross,
		estimatedNet,
		blockers,
		manualChecks,
	};
}
