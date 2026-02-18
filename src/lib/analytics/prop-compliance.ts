// =============================================================================
// PROP COMPLIANCE CALCULATIONS
// Pure utility functions for computing prop firm compliance metrics.
// No database calls — all inputs are plain data.
// =============================================================================

import {
	COMPLIANCE_STATUS,
	COMPLIANCE_THRESHOLDS,
	type ComplianceStatus,
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
