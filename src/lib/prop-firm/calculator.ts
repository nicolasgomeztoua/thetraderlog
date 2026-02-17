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
	quantity?: string | null;
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

export interface DailyPnlResult {
	dailyPnl: number;
	dailyPnlPercent: number;
}

export interface ProfitTargetResult {
	totalPnl: number;
	progress: number;
	isComplete: boolean;
}

export interface ConsistencyRuleResult {
	bestDayPnl: number;
	bestDayPercent: number;
	isCompliant: boolean;
	violatingDays: string[];
}

export interface MaxPositionResult {
	maxConcurrentContracts: number;
}

export type DaysUrgency = "safe" | "warning" | "danger";

export interface DaysRemainingResult {
	daysTotal: number;
	daysRemaining: number;
	daysElapsed: number;
	urgency: DaysUrgency;
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

// =============================================================================
// DAILY P&L, PROFIT TARGET, CONSISTENCY, POSITION SIZE, DAYS REMAINING
// =============================================================================

/**
 * Get the trading day key for a date in a specific timezone (YYYY-MM-DD).
 * If no timezone is provided, uses UTC.
 */
function getTradingDayInTimezone(date: Date, timezone?: string): string {
	if (!timezone) {
		return date.toISOString().slice(0, 10);
	}
	// Format date in the given timezone to get the local YYYY-MM-DD
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	const year = parts.find((p) => p.type === "year")?.value ?? "0000";
	const month = parts.find((p) => p.type === "month")?.value ?? "01";
	const day = parts.find((p) => p.type === "day")?.value ?? "01";
	return `${year}-${month}-${day}`;
}

/**
 * Calculate daily P&L — sum of netPnl for trades closed on a given date.
 * Uses exitTime (or entryTime) to determine which day a trade belongs to.
 */
export function calculateDailyPnl(
	trades: CalcTrade[],
	date: string,
	timezone?: string,
): DailyPnlResult {
	let dailyPnl = 0;

	for (const trade of trades) {
		const tradeDate = trade.exitTime ?? trade.entryTime;
		const tradeDay = getTradingDayInTimezone(tradeDate, timezone);
		if (tradeDay === date) {
			dailyPnl += parsePnl(trade);
		}
	}

	return {
		dailyPnl,
		dailyPnlPercent: 0, // Percent requires initialBalance context — set by caller
	};
}

/**
 * Calculate profit target progress.
 * Returns total P&L, percentage progress toward target, and whether target is met.
 */
export function calculateProfitTarget(
	trades: CalcTrade[],
	targetAmount: number,
): ProfitTargetResult {
	let totalPnl = 0;
	for (const trade of trades) {
		totalPnl += parsePnl(trade);
	}

	const progress = targetAmount > 0 ? (totalPnl / targetAmount) * 100 : 0;

	return {
		totalPnl,
		progress,
		isComplete: totalPnl >= targetAmount,
	};
}

/**
 * Calculate consistency rule compliance.
 * Groups trades by day, finds the best single day's P&L as a percentage of total profit.
 * A day violates the rule if its P&L exceeds maxDayPercent of total profit.
 */
export function calculateConsistencyRule(
	trades: CalcTrade[],
	maxDayPercent: number,
): ConsistencyRuleResult {
	if (trades.length === 0) {
		return {
			bestDayPnl: 0,
			bestDayPercent: 0,
			isCompliant: true,
			violatingDays: [],
		};
	}

	// Group trades by day and sum P&L per day
	const dayPnlMap = new Map<string, number>();
	let totalProfit = 0;

	for (const trade of trades) {
		const day = getTradingDay(trade);
		const pnl = parsePnl(trade);
		dayPnlMap.set(day, (dayPnlMap.get(day) ?? 0) + pnl);
		totalProfit += pnl;
	}

	// Find best day and violating days
	let bestDayPnl = 0;
	const violatingDays: string[] = [];

	for (const [day, dayPnl] of dayPnlMap) {
		if (dayPnl > bestDayPnl) {
			bestDayPnl = dayPnl;
		}
		// A day violates if its profit exceeds maxDayPercent of total profit
		if (totalProfit > 0 && (dayPnl / totalProfit) * 100 > maxDayPercent) {
			violatingDays.push(day);
		}
	}

	const bestDayPercent = totalProfit > 0 ? (bestDayPnl / totalProfit) * 100 : 0;
	const isCompliant = violatingDays.length === 0;

	return {
		bestDayPnl,
		bestDayPercent,
		isCompliant,
		violatingDays,
	};
}

/**
 * Count unique trading days from trade entry times.
 */
export function calculateMinTradingDays(trades: CalcTrade[]): number {
	const days = new Set<string>();
	for (const trade of trades) {
		days.add(trade.entryTime.toISOString().slice(0, 10));
	}
	return days.size;
}

/**
 * Find maximum concurrent contracts at any point from overlapping trades.
 * Uses an event-based sweep line algorithm over entry/exit times.
 */
export function calculateMaxPosition(trades: CalcTrade[]): MaxPositionResult {
	if (trades.length === 0) {
		return { maxConcurrentContracts: 0 };
	}

	// Create events: +quantity at entry, -quantity at exit
	const events: { time: number; delta: number }[] = [];

	for (const trade of trades) {
		const qty = parseFloat(trade.quantity ?? "1") || 1;
		events.push({ time: trade.entryTime.getTime(), delta: qty });
		if (trade.exitTime) {
			events.push({ time: trade.exitTime.getTime(), delta: -qty });
		}
	}

	// Sort by time, with exits before entries at same timestamp
	events.sort((a, b) => {
		if (a.time !== b.time) return a.time - b.time;
		// Process exits (negative delta) before entries (positive delta) at same time
		return a.delta - b.delta;
	});

	let current = 0;
	let max = 0;

	for (const event of events) {
		current += event.delta;
		if (current > max) {
			max = current;
		}
	}

	return { maxConcurrentContracts: max };
}

/**
 * Calculate days remaining in a challenge period.
 * Returns total days, elapsed, remaining, and urgency level.
 */
export function calculateDaysRemaining(
	startDate: Date,
	endDate: Date,
): DaysRemainingResult {
	const now = new Date();
	const msPerDay = 86400000;

	const daysTotal = Math.ceil(
		(endDate.getTime() - startDate.getTime()) / msPerDay,
	);
	const daysElapsed = Math.max(
		0,
		Math.ceil((now.getTime() - startDate.getTime()) / msPerDay),
	);
	const daysRemaining = Math.max(0, daysTotal - daysElapsed);

	let urgency: DaysUrgency = "safe";
	if (daysTotal > 0) {
		const percentElapsed = (daysElapsed / daysTotal) * 100;
		if (percentElapsed >= 90 || daysRemaining <= 3) {
			urgency = "danger";
		} else if (percentElapsed >= 75 || daysRemaining <= 7) {
			urgency = "warning";
		}
	}

	return {
		daysTotal,
		daysRemaining,
		daysElapsed,
		urgency,
	};
}
