import { getFuturesSpec, getPointValue } from "@/lib/market-data";
import type { OHLCBar } from "@/lib/market-data/service";

// =============================================================================
// TRADE CALCULATIONS
// Display metrics for trade detail page
// =============================================================================

/**
 * Calculate points (price movement)
 * LONG: exit - entry (positive = profit)
 * SHORT: entry - exit (positive = profit)
 */
export function calculatePoints(
	entryPrice: number,
	exitPrice: number | null,
	direction: "long" | "short",
): number | null {
	if (exitPrice === null) return null;
	return direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
}

/**
 * Calculate ticks from points for futures
 */
export function calculateTicks(
	points: number | null,
	symbol: string,
): number | null {
	if (points === null) return null;
	const spec = getFuturesSpec(symbol);
	if (!spec) return null;
	return points / spec.tickSize;
}

/**
 * Calculate ticks per contract
 */
export function calculateTicksPerContract(
	ticks: number | null,
	quantity: number,
): number | null {
	if (ticks === null || quantity === 0) return null;
	return ticks / quantity;
}

/**
 * Calculate actual R-Multiple using real P&L and proper risk calculation
 * Formula: netPnl / (riskPerUnit * pointValue * quantity)
 *
 * This accounts for:
 * - Actual dollar P&L (including fees/commissions)
 * - Instrument point values (ES = $50/point, NQ = $20/point, etc.)
 * - Position size (quantity)
 */
export function calculateActualRMultiple(
	netPnl: number | null,
	entryPrice: number,
	stopLoss: number | null,
	quantity: number,
	symbol: string,
): number | null {
	if (netPnl === null || stopLoss === null || quantity === 0) return null;

	const riskPerUnit = Math.abs(entryPrice - stopLoss);
	if (riskPerUnit === 0) return null;

	const pointValue = getPointValue(symbol);
	const plannedRisk = riskPerUnit * pointValue * quantity;

	if (plannedRisk === 0) return null;

	return netPnl / plannedRisk;
}

/**
 * Calculate planned Risk:Reward ratio
 */
export function calculatePlannedRR(
	entryPrice: number,
	stopLoss: number | null,
	takeProfit: number | null,
): number | null {
	if (stopLoss === null || takeProfit === null) return null;

	const risk = Math.abs(entryPrice - stopLoss);
	const reward = Math.abs(takeProfit - entryPrice);

	if (risk === 0) return null;
	return reward / risk;
}

/**
 * Calculate the dollar amount risked on a trade (1R in dollars).
 * Formula: |entry - stopLoss| * pointValue * quantity
 *
 * This is the natural complement to the realized R-Multiple, which is measured
 * in multiples of this risk.
 */
export function calculateRisk(
	entryPrice: number,
	stopLoss: number | null,
	quantity: number,
	symbol: string,
): number | null {
	if (stopLoss === null || quantity === 0) return null;

	const riskPerUnit = Math.abs(entryPrice - stopLoss);
	if (riskPerUnit === 0) return null;

	const risk = riskPerUnit * getPointValue(symbol) * quantity;
	return risk === 0 ? null : risk;
}

/**
 * Calculate trade duration as human-readable string
 */
export function calculateDuration(
	entryTime: Date | string,
	exitTime: Date | string | null,
): string | null {
	if (!exitTime) return null;

	const ms = new Date(exitTime).getTime() - new Date(entryTime).getTime();
	const minutes = Math.floor(ms / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	return `${minutes}m`;
}

/**
 * Calculate gross P&L (before fees)
 */
export function calculateGrossPnl(
	netPnl: number | null,
	fees: number | null,
): number | null {
	if (netPnl === null) return null;
	return netPnl + (fees ?? 0);
}

/**
 * Calculate Net ROI percentage
 * For futures: netPnl / (quantity * pointValue * entryPrice) * 100
 * Simplified: just netPnl as % of notional value
 */
export function calculateROI(
	netPnl: number | null,
	entryPrice: number,
	quantity: number,
	symbol: string,
): number | null {
	if (netPnl === null) return null;

	const spec = getFuturesSpec(symbol);
	if (!spec) return null;
	const notionalValue = entryPrice * quantity * spec.pointValue;

	if (notionalValue === 0) return null;
	return (netPnl / notionalValue) * 100;
}

// =============================================================================
// ALL STATS INTERFACE
// =============================================================================

export interface TradeStats {
	points: number | null;
	ticks: number | null;
	ticksPerContract: number | null;
	grossPnl: number | null;
	roi: number | null;
	duration: string | null;
	rMultiple: number | null;
	risk: number | null;
}

/**
 * Calculate all display stats for a trade
 */
export function calculateAllStats(trade: {
	entryPrice: string;
	exitPrice: string | null;
	direction: "long" | "short";
	quantity: string;
	netPnl: string | null;
	fees: string | null;
	stopLoss: string | null;
	takeProfit: string | null;
	entryTime: Date | string;
	exitTime: Date | string | null;
	symbol: string;
}): TradeStats {
	const entry = parseFloat(trade.entryPrice);
	const exit = trade.exitPrice ? parseFloat(trade.exitPrice) : null;
	const qty = parseFloat(trade.quantity);
	const netPnl = trade.netPnl ? parseFloat(trade.netPnl) : null;
	const fees = trade.fees ? parseFloat(trade.fees) : null;
	const sl = trade.stopLoss ? parseFloat(trade.stopLoss) : null;

	const points = calculatePoints(entry, exit, trade.direction);
	const ticks = calculateTicks(points, trade.symbol);

	return {
		points,
		ticks,
		ticksPerContract: calculateTicksPerContract(ticks, qty),
		grossPnl: calculateGrossPnl(netPnl, fees),
		roi: calculateROI(netPnl, entry, qty, trade.symbol),
		duration: calculateDuration(trade.entryTime, trade.exitTime),
		rMultiple: calculateActualRMultiple(netPnl, entry, sl, qty, trade.symbol),
		risk: calculateRisk(entry, sl, qty, trade.symbol),
	};
}

// =============================================================================
// MAE/MFE CALCULATIONS
// Maximum Adverse Excursion / Maximum Favorable Excursion
// =============================================================================

export interface MAEMFEResult {
	maePrice: number; // Price at maximum adverse excursion
	mfePrice: number; // Price at maximum favorable excursion
	maeAmount: number; // $ value of MAE
	mfeAmount: number; // $ value of MFE
	maePoints: number; // Points of adverse movement
	mfePoints: number; // Points of favorable movement
}

/**
 * Calculate MAE/MFE from OHLC bars during a trade
 *
 * MAE (Maximum Adverse Excursion): The worst unrealized loss during the trade
 * MFE (Maximum Favorable Excursion): The best unrealized profit during the trade
 * Trade Efficiency: % of the MFE that was actually captured
 *
 * @param bars - OHLC bars during the trade (filtered to trade duration)
 * @param entryPrice - Trade entry price
 * @param exitPrice - Trade exit price
 * @param direction - "long" or "short"
 * @param quantity - Number of contracts
 * @param symbol - Trading symbol (for point value calculation)
 * @returns MAE/MFE metrics
 */
export function calculateMAEMFE(
	bars: OHLCBar[],
	entryPrice: number,
	_exitPrice: number,
	direction: "long" | "short",
	quantity: number,
	symbol: string,
): MAEMFEResult {
	if (bars.length === 0) {
		// No data - return zeros
		return {
			maePrice: entryPrice,
			mfePrice: entryPrice,
			maeAmount: 0,
			mfeAmount: 0,
			maePoints: 0,
			mfePoints: 0,
		};
	}

	let maxAdverseExcursion = 0; // Points
	let maxFavorableExcursion = 0; // Points
	let maePrice = entryPrice;
	let mfePrice = entryPrice;

	for (const bar of bars) {
		if (direction === "long") {
			// For LONG trades:
			// - Favorable = price going UP (bar.high - entry)
			// - Adverse = price going DOWN (entry - bar.low)
			const favorable = bar.high - entryPrice;
			const adverse = entryPrice - bar.low;

			if (favorable > maxFavorableExcursion) {
				maxFavorableExcursion = favorable;
				mfePrice = bar.high;
			}
			if (adverse > maxAdverseExcursion) {
				maxAdverseExcursion = adverse;
				maePrice = bar.low;
			}
		} else {
			// For SHORT trades:
			// - Favorable = price going DOWN (entry - bar.low)
			// - Adverse = price going UP (bar.high - entry)
			const favorable = entryPrice - bar.low;
			const adverse = bar.high - entryPrice;

			if (favorable > maxFavorableExcursion) {
				maxFavorableExcursion = favorable;
				mfePrice = bar.low;
			}
			if (adverse > maxAdverseExcursion) {
				maxAdverseExcursion = adverse;
				maePrice = bar.high;
			}
		}
	}

	// Calculate dollar amounts
	const pointValue = getPointValue(symbol);
	const maeAmount = maxAdverseExcursion * pointValue * quantity;
	const mfeAmount = maxFavorableExcursion * pointValue * quantity;

	return {
		maePrice,
		mfePrice,
		maeAmount,
		mfeAmount,
		maePoints: maxAdverseExcursion,
		mfePoints: maxFavorableExcursion,
	};
}

/**
 * Analyze price action after trade exit
 * Useful for "what if" analysis
 */
export interface PostExitAnalysis {
	wouldHaveRecovered: boolean; // Did price return to profit after a losing exit?
	maxPriceAfterExit: number; // Highest price after exit (for longs) or lowest (for shorts)
	priceAtAnalysisEnd: number; // Final price in the data
	potentialAdditionalProfit: number; // How much more could have been made (points)
}

export function analyzePostExit(
	bars: OHLCBar[],
	exitPrice: number,
	entryPrice: number,
	direction: "long" | "short",
): PostExitAnalysis {
	if (bars.length === 0) {
		return {
			wouldHaveRecovered: false,
			maxPriceAfterExit: exitPrice,
			priceAtAnalysisEnd: exitPrice,
			potentialAdditionalProfit: 0,
		};
	}

	const wasLoss =
		direction === "long" ? exitPrice < entryPrice : exitPrice > entryPrice;

	let wouldHaveRecovered = false;
	let maxPrice = exitPrice;
	let minPrice = exitPrice;

	for (const bar of bars) {
		maxPrice = Math.max(maxPrice, bar.high);
		minPrice = Math.min(minPrice, bar.low);

		// Check if would have recovered
		if (wasLoss) {
			if (direction === "long" && bar.high > entryPrice) {
				wouldHaveRecovered = true;
			}
			if (direction === "short" && bar.low < entryPrice) {
				wouldHaveRecovered = true;
			}
		}
	}

	const lastBar = bars[bars.length - 1];
	const priceAtAnalysisEnd = lastBar?.close ?? exitPrice;

	// Calculate how much more profit could have been made
	const bestExitPrice = direction === "long" ? maxPrice : minPrice;
	const potentialAdditionalProfit =
		direction === "long"
			? bestExitPrice - exitPrice
			: exitPrice - bestExitPrice;

	return {
		wouldHaveRecovered,
		maxPriceAfterExit: direction === "long" ? maxPrice : minPrice,
		priceAtAnalysisEnd,
		potentialAdditionalProfit: Math.max(0, potentialAdditionalProfit),
	};
}
