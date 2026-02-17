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

export type RuleStatus = "safe" | "warning" | "danger" | "violated";

export interface PropFirmRule {
	type: string;
	label: string;
	currentValue: number;
	limit: number;
	percentage: number;
	status: RuleStatus;
}

export interface PropFirmStatus {
	isLocked: boolean;
	lockedReason: string | null;
	rules: PropFirmRule[];
}

/**
 * Account fields needed by the status aggregator.
 * All decimal fields are strings (matching Drizzle's decimal output).
 */
export interface StatusAccount {
	initialBalance: string | null;
	maxDrawdown: string | null;
	drawdownType: "trailing" | "static" | "eod" | null;
	dailyLossLimit: string | null;
	profitTarget: string | null;
	consistencyRule: string | null;
	minTradingDays: number | null;
	maxPositionSize: number | null;
	challengeStartDate: Date | null;
	challengeEndDate: Date | null;
	challengeStatus: "active" | "passed" | "failed" | null;
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

// =============================================================================
// STATUS AGGREGATOR
// =============================================================================

/**
 * Determine rule status from percentage of limit consumed.
 * safe: <80%, warning: 80-90%, danger: 90-100%, violated: >=100%
 */
function getRuleStatus(percentage: number): RuleStatus {
	if (percentage >= 100) return "violated";
	if (percentage >= 90) return "danger";
	if (percentage >= 80) return "warning";
	return "safe";
}

/**
 * Aggregate all prop firm rule checks into a single PropFirmStatus object.
 * Skips rules that don't apply (null values in the account).
 * Returns locked status for passed/failed challenges.
 */
export function calculatePropFirmStatus(
	account: StatusAccount,
	trades: CalcTrade[],
): PropFirmStatus {
	// Handle locked accounts (passed or failed challenges)
	if (account.challengeStatus === "passed") {
		return {
			isLocked: true,
			lockedReason: "Challenge Passed",
			rules: [],
		};
	}
	if (account.challengeStatus === "failed") {
		return {
			isLocked: true,
			lockedReason: "Challenge Failed",
			rules: [],
		};
	}

	const rules: PropFirmRule[] = [];
	const initialBalance = parseFloat(account.initialBalance ?? "0") || 0;

	// --- Max Drawdown ---
	if (account.maxDrawdown != null && account.drawdownType != null) {
		const maxDrawdownLimit = parseFloat(account.maxDrawdown) || 0;
		if (maxDrawdownLimit > 0) {
			let currentDrawdown = 0;

			if (account.drawdownType === "static") {
				const result = calculateStaticDrawdown(
					trades,
					initialBalance,
					maxDrawdownLimit,
				);
				currentDrawdown = initialBalance - result.currentEquity;
			} else if (account.drawdownType === "trailing") {
				const result = calculateTrailingDrawdown(
					trades,
					initialBalance,
					maxDrawdownLimit,
				);
				currentDrawdown = result.currentDrawdown;
			} else {
				// eod
				const result = calculateEodTrailingDrawdown(
					trades,
					initialBalance,
					maxDrawdownLimit,
				);
				currentDrawdown = result.currentDrawdown;
			}

			// Drawdown is negative equity change — use absolute value
			const absDrawdown = Math.max(0, currentDrawdown);
			const percentage =
				maxDrawdownLimit > 0 ? (absDrawdown / maxDrawdownLimit) * 100 : 0;

			rules.push({
				type: "max_drawdown",
				label: "Max Drawdown",
				currentValue: absDrawdown,
				limit: maxDrawdownLimit,
				percentage,
				status: getRuleStatus(percentage),
			});
		}
	}

	// --- Daily Loss Limit ---
	if (account.dailyLossLimit != null) {
		const dailyLossLimit = parseFloat(account.dailyLossLimit) || 0;
		if (dailyLossLimit > 0) {
			const today = new Date().toISOString().slice(0, 10);
			const dailyResult = calculateDailyPnl(trades, today);
			// Daily loss is negative P&L — we want the absolute loss
			const absLoss = Math.max(0, -dailyResult.dailyPnl);
			const percentage =
				dailyLossLimit > 0 ? (absLoss / dailyLossLimit) * 100 : 0;

			rules.push({
				type: "daily_loss",
				label: "Daily Loss Limit",
				currentValue: absLoss,
				limit: dailyLossLimit,
				percentage,
				status: getRuleStatus(percentage),
			});
		}
	}

	// --- Profit Target ---
	if (account.profitTarget != null) {
		const profitTargetAmount = parseFloat(account.profitTarget) || 0;
		if (profitTargetAmount > 0) {
			const ptResult = calculateProfitTarget(trades, profitTargetAmount);
			// Profit target is inverted — higher progress is GOOD
			// Progress 0% = just started (safe-ish), 100% = target met
			// We show progress as-is but status is always "safe" unless completed
			rules.push({
				type: "profit_target",
				label: "Profit Target",
				currentValue: ptResult.totalPnl,
				limit: profitTargetAmount,
				percentage: Math.max(0, ptResult.progress),
				status: ptResult.isComplete ? "safe" : "safe",
			});
		}
	}

	// --- Consistency Rule ---
	if (account.consistencyRule != null) {
		const maxDayPercent = parseFloat(account.consistencyRule) || 0;
		if (maxDayPercent > 0) {
			const consistencyResult = calculateConsistencyRule(trades, maxDayPercent);
			// Percentage is best day's share of total profit
			// Violated if bestDayPercent > maxDayPercent
			const percentage =
				maxDayPercent > 0
					? (consistencyResult.bestDayPercent / maxDayPercent) * 100
					: 0;

			rules.push({
				type: "consistency",
				label: "Consistency Rule",
				currentValue: consistencyResult.bestDayPercent,
				limit: maxDayPercent,
				percentage,
				status: consistencyResult.isCompliant
					? getRuleStatus(percentage)
					: "violated",
			});
		}
	}

	// --- Min Trading Days ---
	if (account.minTradingDays != null && account.minTradingDays > 0) {
		const tradingDays = calculateMinTradingDays(trades);
		// Progress toward requirement — inverted (more days = better)
		const percentage =
			account.minTradingDays > 0
				? (tradingDays / account.minTradingDays) * 100
				: 0;

		rules.push({
			type: "min_trading_days",
			label: "Min Trading Days",
			currentValue: tradingDays,
			limit: account.minTradingDays,
			percentage: Math.min(100, percentage),
			status: tradingDays >= account.minTradingDays ? "safe" : "safe",
		});
	}

	// --- Max Position Size ---
	if (account.maxPositionSize != null && account.maxPositionSize > 0) {
		const positionResult = calculateMaxPosition(trades);
		const percentage =
			account.maxPositionSize > 0
				? (positionResult.maxConcurrentContracts / account.maxPositionSize) *
					100
				: 0;

		rules.push({
			type: "max_position_size",
			label: "Max Position Size",
			currentValue: positionResult.maxConcurrentContracts,
			limit: account.maxPositionSize,
			percentage,
			status: getRuleStatus(percentage),
		});
	}

	// --- Days Remaining ---
	if (account.challengeStartDate != null && account.challengeEndDate != null) {
		const daysResult = calculateDaysRemaining(
			account.challengeStartDate,
			account.challengeEndDate,
		);

		// Percentage elapsed (higher = more time consumed = more urgent)
		const percentage =
			daysResult.daysTotal > 0
				? (daysResult.daysElapsed / daysResult.daysTotal) * 100
				: 0;

		rules.push({
			type: "days_remaining",
			label: "Days Remaining",
			currentValue: daysResult.daysRemaining,
			limit: daysResult.daysTotal,
			percentage,
			status:
				daysResult.urgency === "danger"
					? "danger"
					: daysResult.urgency === "warning"
						? "warning"
						: "safe",
		});
	}

	return {
		isLocked: false,
		lockedReason: null,
		rules,
	};
}
