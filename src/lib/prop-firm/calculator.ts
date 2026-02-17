// =============================================================================
// PROP FIRM CALCULATOR — Pure calculation functions for prop firm rule checks
// No DB access — operates on sorted trade arrays
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

/** Minimal trade shape needed by calculator functions */
export interface CalcTrade {
	netPnl: string | null;
	fees: string | null;
	entryTime: Date;
	exitTime: Date | null;
}

export interface StaticDrawdownResult {
	currentEquity: number;
	maxDrawdownAmount: number;
	drawdownFloor: number;
	currentDrawdownPercent: number;
}

export interface TrailingDrawdownResult {
	currentEquity: number;
	peakEquity: number;
	drawdownFloor: number;
	currentDrawdown: number;
}

export interface EodTrailingDrawdownResult {
	currentEquity: number;
	peakEodEquity: number;
	drawdownFloor: number;
	currentDrawdown: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function parsePnl(trade: CalcTrade): number {
	return parseFloat(trade.netPnl ?? "0") || 0;
}

/**
 * Get the trading day key for a trade's exit time (YYYY-MM-DD in UTC).
 * Uses exitTime if available, otherwise entryTime.
 */
function getTradingDay(trade: CalcTrade): string {
	const date = trade.exitTime ?? trade.entryTime;
	return date.toISOString().slice(0, 10);
}

// =============================================================================
// DRAWDOWN CALCULATIONS
// =============================================================================

/**
 * Static drawdown — measured from initial balance only.
 * The drawdown floor is fixed at (initialBalance - maxDrawdownLimit).
 * If equity drops to or below the floor, the account is violated.
 */
export function calculateStaticDrawdown(
	trades: CalcTrade[],
	initialBalance: number,
	maxDrawdownLimit: number,
): StaticDrawdownResult {
	if (trades.length === 0) {
		return {
			currentEquity: initialBalance,
			maxDrawdownAmount: 0,
			drawdownFloor: initialBalance - maxDrawdownLimit,
			currentDrawdownPercent: 0,
		};
	}

	let equity = initialBalance;
	let maxDrawdownFromInitial = 0;

	for (const trade of trades) {
		equity += parsePnl(trade);
		const drawdownFromInitial = initialBalance - equity;
		if (drawdownFromInitial > maxDrawdownFromInitial) {
			maxDrawdownFromInitial = drawdownFromInitial;
		}
	}

	return {
		currentEquity: equity,
		maxDrawdownAmount: maxDrawdownFromInitial,
		drawdownFloor: initialBalance - maxDrawdownLimit,
		currentDrawdownPercent:
			maxDrawdownLimit > 0
				? (maxDrawdownFromInitial / maxDrawdownLimit) * 100
				: 0,
	};
}

/**
 * Trailing drawdown — floor trails up from peak equity.
 * When equity hits a new high, the drawdown floor moves up.
 * Floor = peakEquity - maxDrawdownLimit.
 */
export function calculateTrailingDrawdown(
	trades: CalcTrade[],
	initialBalance: number,
	maxDrawdownLimit: number,
): TrailingDrawdownResult {
	if (trades.length === 0) {
		return {
			currentEquity: initialBalance,
			peakEquity: initialBalance,
			drawdownFloor: initialBalance - maxDrawdownLimit,
			currentDrawdown: 0,
		};
	}

	let equity = initialBalance;
	let peakEquity = initialBalance;

	for (const trade of trades) {
		equity += parsePnl(trade);
		if (equity > peakEquity) {
			peakEquity = equity;
		}
	}

	const drawdownFloor = peakEquity - maxDrawdownLimit;
	const currentDrawdown = peakEquity - equity;

	return {
		currentEquity: equity,
		peakEquity,
		drawdownFloor,
		currentDrawdown,
	};
}

/**
 * EOD (End-of-Day) trailing drawdown — floor only updates at end of day.
 * Intraday equity peaks do NOT move the floor.
 * Groups trades by day, computes EOD equity, and trails from EOD peaks.
 */
export function calculateEodTrailingDrawdown(
	trades: CalcTrade[],
	initialBalance: number,
	maxDrawdownLimit: number,
): EodTrailingDrawdownResult {
	if (trades.length === 0) {
		return {
			currentEquity: initialBalance,
			peakEodEquity: initialBalance,
			drawdownFloor: initialBalance - maxDrawdownLimit,
			currentDrawdown: 0,
		};
	}

	// Group trades by trading day (based on exit time)
	const dayMap = new Map<string, CalcTrade[]>();
	for (const trade of trades) {
		const day = getTradingDay(trade);
		const existing = dayMap.get(day);
		if (existing) {
			existing.push(trade);
		} else {
			dayMap.set(day, [trade]);
		}
	}

	// Sort days chronologically
	const sortedDays = [...dayMap.keys()].sort();

	let runningEquity = initialBalance;
	let peakEodEquity = initialBalance;

	for (const day of sortedDays) {
		const dayTrades = dayMap.get(day) ?? [];
		for (const trade of dayTrades) {
			runningEquity += parsePnl(trade);
		}
		// Only update peak at end of day
		if (runningEquity > peakEodEquity) {
			peakEodEquity = runningEquity;
		}
	}

	const drawdownFloor = peakEodEquity - maxDrawdownLimit;
	const currentDrawdown = peakEodEquity - runningEquity;

	return {
		currentEquity: runningEquity,
		peakEodEquity,
		drawdownFloor,
		currentDrawdown,
	};
}
