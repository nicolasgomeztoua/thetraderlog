// =============================================================================
// AGGREGATE TRADE STATISTICS CALCULATIONS
// Shared module for calculating win rate, profit factor, avg win/loss, etc.
// =============================================================================

/**
 * Minimal trade interface for stats calculations
 */
export interface TradeForStats {
	netPnl: string | null;
	entryPrice?: string;
	stopLoss?: string | null;
	quantity?: string;
}

/**
 * Aggregate statistics result
 */
export interface AggregateStats {
	totalTrades: number;
	wins: number;
	losses: number;
	breakevens: number;
	winRate: number;
	totalPnl: number;
	avgPnl: number;
	grossProfit: number;
	grossLoss: number;
	profitFactor: number;
	avgWin: number;
	avgLoss: number;
	avgRMultiple: number | null;
}

/**
 * Trade classification result
 */
export type TradeResult = "win" | "loss" | "breakeven";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely parse a PnL string to number
 */
export function parsePnl(netPnl: string | null): number {
	if (netPnl === null) return 0;
	const parsed = parseFloat(netPnl);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Classify a trade as win, loss, or breakeven based on PnL and threshold
 *
 * @param pnl - The net P&L of the trade
 * @param beThreshold - Breakeven threshold (trades within ±threshold are breakeven)
 */
export function classifyTrade(pnl: number, beThreshold: number): TradeResult {
	if (pnl > beThreshold) return "win";
	if (pnl < -beThreshold) return "breakeven";
	return "loss";
}

/**
 * Calculate win rate from wins and losses (excludes breakevens)
 */
export function calculateWinRate(wins: number, losses: number): number {
	const decisiveTrades = wins + losses;
	if (decisiveTrades === 0) return 0;
	return (wins / decisiveTrades) * 100;
}

/**
 * Calculate profit factor (gross profit / gross loss)
 */
export function calculateProfitFactor(
	grossProfit: number,
	grossLoss: number,
): number {
	if (grossLoss === 0) {
		return grossProfit > 0 ? Infinity : 0;
	}
	return grossProfit / grossLoss;
}

/**
 * Calculate R-Multiple for a single trade
 * R = PnL / Risk, where Risk = |entry - stopLoss| * quantity
 */
export function calculateRMultipleFromTrade(
	netPnl: number,
	entryPrice: number,
	stopLoss: number,
	quantity: number,
): number | null {
	const riskPerUnit = Math.abs(entryPrice - stopLoss);
	if (riskPerUnit === 0 || quantity === 0) return null;
	return netPnl / (riskPerUnit * quantity);
}

// =============================================================================
// ADVANCED METRICS
// =============================================================================

/**
 * Calculate standard deviation of an array of numbers
 * Uses sample standard deviation (n-1 denominator)
 *
 * @param values - Array of numbers
 * @returns Standard deviation, or 0 if fewer than 2 values
 */
export function calculateStdDev(values: number[]): number {
	if (values.length < 2) return 0;

	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	const squaredDiffs = values.map((v) => (v - mean) ** 2);
	const variance =
		squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

	return Math.sqrt(variance);
}

/**
 * Calculate expectancy (expected value per trade)
 * Formula: (winRate * avgWin) - (lossRate * avgLoss)
 *
 * @param winRate - Win rate as a percentage (0-100)
 * @param avgWin - Average winning trade in dollars
 * @param avgLoss - Average losing trade in dollars (as positive number)
 * @returns Expected profit per trade in dollars
 */
export function calculateExpectancy(
	winRate: number,
	avgWin: number,
	avgLoss: number,
): number {
	const winRateDecimal = winRate / 100;
	const lossRateDecimal = 1 - winRateDecimal;
	return winRateDecimal * avgWin - lossRateDecimal * avgLoss;
}

/**
 * Calculate payoff ratio (reward-to-risk ratio)
 * Formula: avgWin / avgLoss
 *
 * @param avgWin - Average winning trade in dollars
 * @param avgLoss - Average losing trade in dollars (as positive number)
 * @returns Payoff ratio, or 0 if avgLoss is 0
 */
export function calculatePayoffRatio(avgWin: number, avgLoss: number): number {
	if (avgLoss === 0) return avgWin > 0 ? Infinity : 0;
	return avgWin / avgLoss;
}

/**
 * Calculate Sharpe ratio (risk-adjusted return)
 * Formula: (mean return - risk-free rate) / standard deviation
 *
 * For trading, we typically use 0 as the risk-free rate since we're
 * measuring the edge of the trading system itself.
 *
 * @param pnls - Array of P&L values for each trade
 * @param riskFreeRate - Risk-free rate per period (default 0)
 * @returns Sharpe ratio, or 0 if insufficient data
 */
export function calculateSharpeRatio(pnls: number[], riskFreeRate = 0): number {
	if (pnls.length < 2) return 0;

	const mean = pnls.reduce((sum, v) => sum + v, 0) / pnls.length;
	const stdDev = calculateStdDev(pnls);

	if (stdDev === 0) return 0;

	return (mean - riskFreeRate) / stdDev;
}

/**
 * Calculate Sortino ratio (downside risk-adjusted return)
 * Similar to Sharpe but only considers downside volatility
 *
 * @param pnls - Array of P&L values for each trade
 * @param riskFreeRate - Risk-free rate per period (default 0)
 * @returns Sortino ratio, or 0 if insufficient data
 */
export function calculateSortinoRatio(
	pnls: number[],
	riskFreeRate = 0,
): number {
	if (pnls.length < 2) return 0;

	const mean = pnls.reduce((sum, v) => sum + v, 0) / pnls.length;

	// Only consider negative returns for downside deviation
	const negativeReturns = pnls.filter((p) => p < 0);
	if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;

	const downsideVariance =
		negativeReturns.reduce((sum, v) => sum + v ** 2, 0) /
		negativeReturns.length;
	const downsideDeviation = Math.sqrt(downsideVariance);

	if (downsideDeviation === 0) return 0;

	return (mean - riskFreeRate) / downsideDeviation;
}

// =============================================================================
// MAIN AGGREGATE CALCULATOR
// =============================================================================

/**
 * Calculate all aggregate statistics for a set of trades
 *
 * @param trades - Array of trades with at least netPnl field
 * @param beThreshold - Breakeven threshold for classifying trades
 * @returns Complete aggregate statistics
 */
export function calculateAggregateStats(
	trades: TradeForStats[],
	beThreshold: number,
): AggregateStats {
	const totalTrades = trades.length;

	// Empty trades - return zeroed stats
	if (totalTrades === 0) {
		return {
			totalTrades: 0,
			wins: 0,
			losses: 0,
			breakevens: 0,
			winRate: 0,
			totalPnl: 0,
			avgPnl: 0,
			grossProfit: 0,
			grossLoss: 0,
			profitFactor: 0,
			avgWin: 0,
			avgLoss: 0,
			avgRMultiple: null,
		};
	}

	// Parse all PnLs once
	const pnls = trades.map((t) => parsePnl(t.netPnl));

	// Classify trades
	let wins = 0;
	let losses = 0;
	let breakevens = 0;
	let totalPnl = 0;
	let grossProfit = 0;
	let grossLoss = 0;

	for (const pnl of pnls) {
		totalPnl += pnl;

		if (pnl > beThreshold) {
			wins++;
			grossProfit += pnl;
		} else if (pnl < -beThreshold) {
			losses++;
			grossLoss += Math.abs(pnl);
		} else {
			breakevens++;
		}
	}

	// Calculate derived stats
	const winRate = calculateWinRate(wins, losses);
	const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
	const avgWin = wins > 0 ? grossProfit / wins : 0;
	const avgLoss = losses > 0 ? grossLoss / losses : 0;
	const avgPnl = totalPnl / totalTrades;

	// Calculate average R-Multiple for trades with stop losses
	let avgRMultiple: number | null = null;
	const tradesWithSL = trades.filter(
		(t): t is TradeForStats & { stopLoss: string; entryPrice: string } =>
			t.stopLoss !== null &&
			t.stopLoss !== undefined &&
			t.entryPrice !== undefined &&
			t.netPnl !== null,
	);

	if (tradesWithSL.length > 0) {
		const rMultiples: number[] = [];
		for (const t of tradesWithSL) {
			const entry = parseFloat(t.entryPrice);
			const sl = parseFloat(t.stopLoss);
			const qty = t.quantity ? parseFloat(t.quantity) : 1;
			const pnl = parsePnl(t.netPnl);

			const rMultiple = calculateRMultipleFromTrade(pnl, entry, sl, qty);
			if (rMultiple !== null) {
				rMultiples.push(rMultiple);
			}
		}

		if (rMultiples.length > 0) {
			avgRMultiple =
				rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length;
		}
	}

	return {
		totalTrades,
		wins,
		losses,
		breakevens,
		winRate,
		totalPnl,
		avgPnl,
		grossProfit,
		grossLoss,
		profitFactor,
		avgWin,
		avgLoss,
		avgRMultiple,
	};
}

/**
 * Calculate stats for multiple groups of trades (e.g., by strategy)
 * More efficient than calling calculateAggregateStats multiple times
 * when you need to group trades
 */
export function calculateGroupedStats<T extends TradeForStats>(
	trades: T[],
	beThreshold: number,
	groupBy: (trade: T) => string | number | null,
): Map<string | number, AggregateStats> {
	// Group trades
	const groups = new Map<string | number, T[]>();

	for (const trade of trades) {
		const key = groupBy(trade);
		if (key === null) continue;

		const group = groups.get(key) ?? [];
		group.push(trade);
		groups.set(key, group);
	}

	// Calculate stats for each group
	const results = new Map<string | number, AggregateStats>();
	for (const [key, groupTrades] of groups) {
		results.set(key, calculateAggregateStats(groupTrades, beThreshold));
	}

	return results;
}
