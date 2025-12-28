// =============================================================================
// PROFESSIONAL RISK CALCULATIONS
// Institutional-grade risk metrics: Drawdowns, Calmar, Risk of Ruin, Kelly, etc.
// =============================================================================

/**
 * Trade data needed for risk calculations
 */
export interface TradeForRisk {
	netPnl: string | null;
	exitTime: Date | null;
}

/**
 * A single drawdown period with all metrics
 */
export interface DrawdownPeriod {
	/** Start date of the drawdown */
	startDate: Date;
	/** Date when maximum drawdown was reached */
	troughDate: Date;
	/** Date when equity recovered (null if still in drawdown) */
	recoveryDate: Date | null;
	/** Peak equity value before drawdown */
	peakEquity: number;
	/** Trough equity value at worst point */
	troughEquity: number;
	/** Drawdown amount in dollars */
	drawdownAmount: number;
	/** Drawdown as percentage of peak */
	drawdownPercent: number;
	/** Number of trades during drawdown */
	tradesInDrawdown: number;
	/** Days from start to trough */
	daysToTrough: number;
	/** Days from trough to recovery (null if not recovered) */
	daysToRecover: number | null;
	/** Total duration in days (null if not recovered) */
	totalDays: number | null;
}

/**
 * Equity curve point
 */
export interface EquityPoint {
	/** Date of this point */
	date: Date;
	/** Cumulative equity at this point */
	equity: number;
	/** Running peak equity */
	peak: number;
	/** Current drawdown amount (0 if at peak) */
	drawdown: number;
	/** Current drawdown percentage */
	drawdownPercent: number;
	/** P&L for this trade */
	pnl: number;
	/** Trade index */
	tradeIndex: number;
}

/**
 * Complete risk metrics result
 */
export interface RiskMetrics {
	// Cumulative P&L metrics (starts at $0)
	totalPnl: number; // Final cumulative P&L
	peakPnl: number; // Highest cumulative P&L reached

	// Drawdown metrics (from peak P&L)
	maxDrawdown: number;
	maxDrawdownPercent: number;
	currentDrawdown: number;
	currentDrawdownPercent: number;
	avgDrawdown: number;
	avgDrawdownPercent: number;
	numberOfDrawdowns: number;

	// Time in drawdown
	maxDrawdownDays: number;
	avgRecoveryDays: number;
	percentTimeInDrawdown: number;

	// Risk-adjusted returns
	calmarRatio: number;
	recoveryFactor: number;
	ulcerIndex: number;

	// Position sizing
	kellyPercent: number;
	halfKellyPercent: number;
	riskOfRuin: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely parse a PnL string to number
 */
function parsePnl(netPnl: string | null): number {
	if (netPnl === null) return 0;
	const parsed = parseFloat(netPnl);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate days between two dates
 */
function daysBetween(start: Date, end: Date): number {
	const msPerDay = 1000 * 60 * 60 * 24;
	return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

// =============================================================================
// CUMULATIVE P&L CURVE CALCULATIONS
// =============================================================================

/**
 * Build cumulative P&L curve from trades
 * Starts at $0 and tracks running profit/loss with drawdown from peak
 *
 * @param trades - Array of trades sorted by exit time
 * @returns Array of P&L points with drawdown info
 */
export function buildEquityCurve(trades: TradeForRisk[]): EquityPoint[] {
	if (trades.length === 0) return [];

	const curve: EquityPoint[] = [];
	let cumulativePnl = 0;
	let peak = 0;

	for (let i = 0; i < trades.length; i++) {
		const trade = trades[i];
		if (!trade) continue;

		const pnl = parsePnl(trade.netPnl);
		cumulativePnl += pnl;
		peak = Math.max(peak, cumulativePnl);

		// Drawdown is the drop from peak (in dollars)
		const drawdown = peak - cumulativePnl;
		// Drawdown % only makes sense when peak > 0, otherwise we're below starting point
		const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

		curve.push({
			date: trade.exitTime ?? new Date(),
			equity: cumulativePnl, // "equity" is now cumulative P&L
			peak,
			drawdown,
			drawdownPercent,
			pnl,
			tradeIndex: i + 1,
		});
	}

	return curve;
}

/**
 * Find all drawdown periods from equity curve
 *
 * @param curve - Equity curve from buildEquityCurve
 * @param minDrawdownAmount - Minimum drawdown $ to count as a period (default $1)
 * @returns Array of drawdown periods sorted by depth (largest first)
 */
export function findDrawdownPeriods(
	curve: EquityPoint[],
	minDrawdownAmount = 1,
): DrawdownPeriod[] {
	if (curve.length === 0) return [];

	const periods: DrawdownPeriod[] = [];
	let inDrawdown = false;
	let currentPeriod: Partial<DrawdownPeriod> | null = null;

	for (let i = 0; i < curve.length; i++) {
		const point = curve[i];
		if (!point) continue;

		// Use dollar amount to detect drawdown (works when starting from $0)
		const isInDrawdown = point.drawdown > 0;

		if (isInDrawdown && !inDrawdown) {
			// Start of new drawdown
			inDrawdown = true;
			const prevPoint = i > 0 ? curve[i - 1] : null;
			currentPeriod = {
				startDate: prevPoint?.date ?? point.date,
				peakEquity: point.peak,
				troughDate: point.date,
				troughEquity: point.equity,
				drawdownAmount: point.drawdown,
				drawdownPercent: point.drawdownPercent,
				tradesInDrawdown: 1,
			};
		} else if (isInDrawdown && inDrawdown && currentPeriod) {
			// Still in drawdown - update trough if deeper
			currentPeriod.tradesInDrawdown =
				(currentPeriod.tradesInDrawdown ?? 0) + 1;

			if (point.drawdown > (currentPeriod.drawdownAmount ?? 0)) {
				currentPeriod.troughDate = point.date;
				currentPeriod.troughEquity = point.equity;
				currentPeriod.drawdownAmount = point.drawdown;
				currentPeriod.drawdownPercent = point.drawdownPercent;
			}
		} else if (!isInDrawdown && inDrawdown && currentPeriod) {
			// Recovered from drawdown
			inDrawdown = false;

			// Only record if above minimum threshold (using $ amount)
			if ((currentPeriod.drawdownAmount ?? 0) >= minDrawdownAmount) {
				const startDate = currentPeriod.startDate ?? point.date;
				const troughDate = currentPeriod.troughDate ?? point.date;

				periods.push({
					startDate,
					troughDate,
					recoveryDate: point.date,
					peakEquity: currentPeriod.peakEquity ?? 0,
					troughEquity: currentPeriod.troughEquity ?? 0,
					drawdownAmount: currentPeriod.drawdownAmount ?? 0,
					drawdownPercent: currentPeriod.drawdownPercent ?? 0,
					tradesInDrawdown: currentPeriod.tradesInDrawdown ?? 0,
					daysToTrough: daysBetween(startDate, troughDate),
					daysToRecover: daysBetween(troughDate, point.date),
					totalDays: daysBetween(startDate, point.date),
				});
			}

			currentPeriod = null;
		}
	}

	// Handle ongoing drawdown
	if (inDrawdown && currentPeriod) {
		const lastPoint = curve[curve.length - 1];
		if (lastPoint && (currentPeriod.drawdownAmount ?? 0) >= minDrawdownAmount) {
			const startDate = currentPeriod.startDate ?? lastPoint.date;
			const troughDate = currentPeriod.troughDate ?? lastPoint.date;

			periods.push({
				startDate,
				troughDate,
				recoveryDate: null, // Still in drawdown
				peakEquity: currentPeriod.peakEquity ?? 0,
				troughEquity: currentPeriod.troughEquity ?? 0,
				drawdownAmount: currentPeriod.drawdownAmount ?? 0,
				drawdownPercent: currentPeriod.drawdownPercent ?? 0,
				tradesInDrawdown: currentPeriod.tradesInDrawdown ?? 0,
				daysToTrough: daysBetween(startDate, troughDate),
				daysToRecover: null,
				totalDays: null,
			});
		}
	}

	// Sort by drawdown depth (largest first, using $ amount)
	return periods.sort((a, b) => b.drawdownAmount - a.drawdownAmount);
}

// =============================================================================
// RISK-ADJUSTED RETURN METRICS
// =============================================================================

/**
 * Calculate Calmar Ratio
 * Formula: Annualized Return / Max Drawdown
 *
 * @param totalReturnPercent - Total return as percentage
 * @param maxDrawdownPercent - Maximum drawdown as percentage
 * @param tradingDays - Number of trading days in the period
 * @returns Calmar ratio (higher is better)
 */
export function calculateCalmarRatio(
	totalReturnPercent: number,
	maxDrawdownPercent: number,
	tradingDays: number,
): number {
	if (maxDrawdownPercent === 0) {
		return totalReturnPercent > 0 ? Infinity : 0;
	}

	// Annualize the return (assume 252 trading days/year)
	const annualizationFactor = tradingDays > 0 ? 252 / tradingDays : 1;
	const annualizedReturn = totalReturnPercent * annualizationFactor;

	return annualizedReturn / maxDrawdownPercent;
}

/**
 * Calculate Recovery Factor
 * Formula: Net Profit / Max Drawdown
 *
 * @param netProfit - Total net profit in dollars
 * @param maxDrawdown - Maximum drawdown in dollars
 * @returns Recovery factor (higher is better, >1 means recovered from worst DD)
 */
export function calculateRecoveryFactor(
	netProfit: number,
	maxDrawdown: number,
): number {
	if (maxDrawdown === 0) {
		return netProfit > 0 ? Infinity : 0;
	}
	return netProfit / maxDrawdown;
}

/**
 * Calculate Ulcer Index
 * Measures both depth and duration of drawdowns
 * Formula: RMS of all drawdown percentages
 *
 * @param curve - Equity curve with drawdown data
 * @returns Ulcer Index (lower is better, 0 = no drawdowns)
 */
export function calculateUlcerIndex(curve: EquityPoint[]): number {
	if (curve.length === 0) return 0;

	const sumSquaredDrawdowns = curve.reduce((sum, point) => {
		return sum + point.drawdownPercent ** 2;
	}, 0);

	return Math.sqrt(sumSquaredDrawdowns / curve.length);
}

// =============================================================================
// POSITION SIZING METRICS
// =============================================================================

/**
 * Calculate Kelly Criterion
 * Optimal position size for maximum geometric growth
 * Formula: (WinRate * PayoffRatio - LossRate) / PayoffRatio
 *
 * Note: Kelly is aggressive - most traders use Half Kelly or Quarter Kelly
 *
 * @param winRate - Win rate as decimal (e.g., 0.55 for 55%)
 * @param avgWin - Average winning trade
 * @param avgLoss - Average losing trade (positive number)
 * @returns Kelly percentage (0-100, can be negative if no edge)
 */
export function calculateKellyPercent(
	winRate: number,
	avgWin: number,
	avgLoss: number,
): number {
	if (avgLoss === 0 || avgWin === 0) return 0;

	const payoffRatio = avgWin / avgLoss;
	const lossRate = 1 - winRate;

	// Kelly formula: (W * B - L) / B where B = payoff ratio
	const kelly = (winRate * payoffRatio - lossRate) / payoffRatio;

	// Return as percentage, capped at 0-100%
	return Math.max(0, Math.min(100, kelly * 100));
}

/**
 * Calculate Risk of Ruin
 * Probability of hitting a specified drawdown threshold
 *
 * Formula: ((1 - Edge) / (1 + Edge))^Units
 * Where Edge = (WinRate * PayoffRatio - LossRate) / PayoffRatio
 * Units = Ruin threshold / Risk per trade
 *
 * @param winRate - Win rate as decimal (e.g., 0.55)
 * @param payoffRatio - Average win / average loss
 * @param riskPerTrade - Risk per trade as decimal (e.g., 0.02 for 2%)
 * @param ruinThreshold - Drawdown % that constitutes ruin (e.g., 0.5 for 50%)
 * @returns Probability of ruin as percentage (0-100)
 */
export function calculateRiskOfRuin(
	winRate: number,
	payoffRatio: number,
	riskPerTrade: number,
	ruinThreshold: number,
): number {
	if (payoffRatio === 0 || riskPerTrade === 0) return 100;

	// Calculate edge
	const lossRate = 1 - winRate;
	const edge = (winRate * payoffRatio - lossRate) / payoffRatio;

	// If no edge or negative edge, ruin is certain (or very high)
	if (edge <= 0) return 100;

	// Calculate number of "units" to ruin
	const units = ruinThreshold / riskPerTrade;

	// Risk of ruin formula
	const ratio = (1 - edge) / (1 + edge);
	const ror = ratio ** units;

	return Math.min(100, ror * 100);
}

// =============================================================================
// MAIN RISK METRICS CALCULATOR
// =============================================================================

/**
 * Calculate all risk metrics for a set of trades
 * Uses cumulative P&L starting at $0, not fake equity
 *
 * @param trades - Array of trades sorted by exit time
 * @param winRate - Win rate as percentage (0-100)
 * @param avgWin - Average winning trade
 * @param avgLoss - Average losing trade (positive number)
 * @param riskPerTrade - Assumed risk per trade as decimal (default 2%)
 * @param ruinThreshold - Drawdown % that constitutes ruin (default 0.5 = 50%, or use account's maxDrawdown)
 * @returns Complete risk metrics
 */
export function calculateRiskMetrics(
	trades: TradeForRisk[],
	winRate: number,
	avgWin: number,
	avgLoss: number,
	riskPerTrade = 0.02,
	ruinThreshold = 0.5,
): RiskMetrics {
	// Build cumulative P&L curve (starts at $0)
	const curve = buildEquityCurve(trades);

	// Handle empty trades
	if (curve.length === 0) {
		return {
			totalPnl: 0,
			peakPnl: 0,
			maxDrawdown: 0,
			maxDrawdownPercent: 0,
			currentDrawdown: 0,
			currentDrawdownPercent: 0,
			avgDrawdown: 0,
			avgDrawdownPercent: 0,
			numberOfDrawdowns: 0,
			maxDrawdownDays: 0,
			avgRecoveryDays: 0,
			percentTimeInDrawdown: 0,
			calmarRatio: 0,
			recoveryFactor: 0,
			ulcerIndex: 0,
			kellyPercent: 0,
			halfKellyPercent: 0,
			riskOfRuin: 100,
		};
	}

	// Get P&L values (equity field is now cumulative P&L)
	const firstPoint = curve[0];
	const lastPoint = curve[curve.length - 1];
	const totalPnl = lastPoint?.equity ?? 0; // cumulative P&L
	const peakPnl = lastPoint?.peak ?? 0; // peak cumulative P&L
	const currentDrawdown = lastPoint?.drawdown ?? 0;
	const currentDrawdownPercent = lastPoint?.drawdownPercent ?? 0;

	// Find drawdown periods
	const periods = findDrawdownPeriods(curve, 1);

	// Max drawdown
	const maxDD = periods.length > 0 ? periods[0] : null;
	const maxDrawdown = maxDD?.drawdownAmount ?? 0;
	const maxDrawdownPercent = maxDD?.drawdownPercent ?? 0;

	// Average drawdown
	const avgDrawdown =
		periods.length > 0
			? periods.reduce((sum, p) => sum + p.drawdownAmount, 0) / periods.length
			: 0;
	const avgDrawdownPercent =
		periods.length > 0
			? periods.reduce((sum, p) => sum + p.drawdownPercent, 0) / periods.length
			: 0;

	// Drawdown time metrics
	const maxDrawdownDays = maxDD?.totalDays ?? maxDD?.daysToTrough ?? 0;
	const recoveredPeriods = periods.filter((p) => p.daysToRecover !== null);
	const avgRecoveryDays =
		recoveredPeriods.length > 0
			? recoveredPeriods.reduce((sum, p) => sum + (p.daysToRecover ?? 0), 0) /
				recoveredPeriods.length
			: 0;

	// Percent time in drawdown (use $ amount, works from $0 start)
	const pointsInDrawdown = curve.filter((p) => p.drawdown > 0).length;
	const percentTimeInDrawdown = (pointsInDrawdown / curve.length) * 100;

	// Calculate trading days for annualization
	const firstDate = firstPoint?.date ?? new Date();
	const lastDate = lastPoint?.date ?? new Date();
	const tradingDays = Math.max(1, daysBetween(firstDate, lastDate));

	// Risk-adjusted metrics
	// For Calmar, use maxDrawdownPercent if we have a peak, otherwise 0
	const calmarRatio = calculateCalmarRatio(
		maxDrawdownPercent > 0
			? (totalPnl / peakPnl) * 100
			: totalPnl > 0
				? 100
				: 0,
		maxDrawdownPercent,
		tradingDays,
	);
	const recoveryFactor = calculateRecoveryFactor(totalPnl, maxDrawdown);
	const ulcerIndex = calculateUlcerIndex(curve);

	// Position sizing metrics
	const winRateDecimal = winRate / 100;
	const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
	const kellyPercent = calculateKellyPercent(winRateDecimal, avgWin, avgLoss);
	const halfKellyPercent = kellyPercent / 2;
	const riskOfRuin = calculateRiskOfRuin(
		winRateDecimal,
		payoffRatio,
		riskPerTrade,
		ruinThreshold, // Use account's drawdown limit (or default 50%)
	);

	return {
		totalPnl,
		peakPnl,
		maxDrawdown,
		maxDrawdownPercent,
		currentDrawdown,
		currentDrawdownPercent,
		avgDrawdown,
		avgDrawdownPercent,
		numberOfDrawdowns: periods.length,
		maxDrawdownDays,
		avgRecoveryDays,
		percentTimeInDrawdown,
		calmarRatio,
		recoveryFactor,
		ulcerIndex,
		kellyPercent,
		halfKellyPercent,
		riskOfRuin,
	};
}
