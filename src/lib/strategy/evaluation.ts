/**
 * Strategy Auto-Evaluation Engine
 *
 * Provides automatic evaluation of trading rules against trade data.
 * Each evaluator checks a specific condition and returns a standardized result.
 */

import { and, eq, gt, gte, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { getPointValue } from "@/lib/market-data";
import { getDateStringInTimezone, getDayBoundsInTimezone } from "@/lib/shared";
import { calculatePlannedRR } from "@/lib/trades/calculations";
import { getUserTimezone, type UserSettingsCache } from "@/server/api/helpers";
import type { db as DbType } from "@/server/db";
import type { TradeExecution } from "@/server/db/schema";
import { accounts, tradeExecutions, trades } from "@/server/db/schema";
import type {
	AutoCondition,
	AutoEvaluationResult,
	BreakevenTriggerCondition,
	DailyLossLimitCondition,
	MaxConcurrentPositionsCondition,
	MaxRiskPerTradeCondition,
	MinRRRatioCondition,
	ScaleOutAtRCondition,
} from "./types";

// Database type - same pattern as helpers.ts
type Db = typeof DbType;

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Context required for evaluating auto-conditions against a trade
 */
export interface EvaluationContext {
	/** Trade executions for this trade (scale-in/out events) */
	executions: TradeExecution[];
	/** Other trades closed on the same calendar day (for daily loss limit) */
	dayTrades: Array<{
		id: string;
		netPnl: string | null;
		status: "open" | "closed";
		exitTime: Date | null;
	}>;
	/** Number of trades that were open at this trade's entry time */
	concurrentTradesAtEntry: number;
	/** Maximum favorable excursion in R-multiples (requires MFE data) */
	mfeR: number | null;
	/** Account balance at start of day (for percent-based limits) */
	accountBalance: number | null;
}

/**
 * Trade data needed for evaluation (subset of full Trade type)
 */
export interface TradeForEvaluation {
	id: string;
	symbol: string;
	direction: "long" | "short";
	entryPrice: string;
	exitPrice: string | null;
	quantity: string;
	stopLoss: string | null;
	takeProfit: string | null;
	trailedStopLoss: string | null;
	wasTrailed: boolean | null;
	netPnl: string | null;
	mfePrice: string | null;
	mfeAmount: string | null;
}

// ============================================================================
// EVALUATION RESULT HELPERS
// ============================================================================

/**
 * Create a successful (passed) evaluation result
 */
function passedResult(
	actual: number | string,
	expected: number | string,
	details: string,
): AutoEvaluationResult {
	return {
		passed: true,
		actual,
		expected,
		details,
		evaluatedAt: new Date().toISOString(),
		dataQuality: "full",
	};
}

/**
 * Create a failed evaluation result
 */
function failedResult(
	actual: number | string,
	expected: number | string,
	details: string,
): AutoEvaluationResult {
	return {
		passed: false,
		actual,
		expected,
		details,
		evaluatedAt: new Date().toISOString(),
		dataQuality: "full",
	};
}

/**
 * Create an unavailable result when data is missing
 */
function unavailableResult(details: string): AutoEvaluationResult {
	return {
		passed: false,
		actual: null,
		expected: null,
		details,
		evaluatedAt: new Date().toISOString(),
		dataQuality: "unavailable",
	};
}

// ============================================================================
// RULE RELEVANCE CHECK
// ============================================================================

/**
 * Determines if a rule was relevant to a specific trade based on MFE.
 *
 * Some rules are always relevant (risk parameters, position sizing).
 * MFE-triggered rules (breakeven, scale out, trailing) are only relevant
 * if the trade's MFE reached the trigger threshold.
 *
 * @param condition - The auto condition to check
 * @param mfeR - Maximum favorable excursion in R-multiples (null if unavailable)
 * @returns true if the rule should be shown for this trade
 */
export function isRuleRelevant(
	condition: AutoCondition,
	mfeR: number | null,
): boolean {
	switch (condition.type) {
		// Always-relevant rules: these apply regardless of how the trade moved
		case "maxRiskPerTrade":
		case "minRRRatio":
		case "dailyLossLimit":
		case "maxConcurrentPositions":
			return true;

		// MFE-triggered rules: only relevant if MFE reached the trigger
		case "breakevenTrigger":
			// If no MFE data, consider irrelevant (can't have triggered)
			if (mfeR === null) return false;
			return mfeR >= condition.triggerR;

		case "scaleOutAtR":
			// If no MFE data, consider irrelevant (can't have reached target)
			if (mfeR === null) return false;
			return mfeR >= condition.targetR;

		case "trailingStopTrigger":
			// If no MFE data, consider irrelevant (can't have triggered)
			if (mfeR === null) return false;
			return mfeR >= condition.triggerR;

		default:
			// Safe default: show unknown rules
			return true;
	}
}

// ============================================================================
// CORE EVALUATORS
// ============================================================================

/**
 * Evaluate max risk per trade condition
 * Formula: abs(entry - stop) * pointValue * quantity <= limit
 */
export function evaluateMaxRiskPerTrade(
	condition: MaxRiskPerTradeCondition,
	trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	const entry = parseFloat(trade.entryPrice);
	const stop = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
	const quantity = parseFloat(trade.quantity);

	// Need stop loss to calculate risk
	if (stop === null) {
		return unavailableResult("No stop loss set - cannot calculate risk");
	}

	const pointValue = getPointValue(trade.symbol);
	const riskPerUnit = Math.abs(entry - stop);
	const actualRisk = riskPerUnit * pointValue * quantity;

	let expectedLimit: number;
	let expectedDisplay: string;

	if (condition.maxRiskType === "dollars") {
		expectedLimit = condition.maxRiskValue;
		expectedDisplay = `$${condition.maxRiskValue.toFixed(2)}`;
	} else {
		// Percent-based risk
		if (context.accountBalance === null) {
			return unavailableResult(
				"Account balance unavailable for percent-based risk calculation",
			);
		}
		expectedLimit = (condition.maxRiskValue / 100) * context.accountBalance;
		expectedDisplay = `${condition.maxRiskValue}% ($${expectedLimit.toFixed(2)})`;
	}

	const actualDisplay = `$${actualRisk.toFixed(2)}`;

	if (actualRisk <= expectedLimit) {
		return passedResult(
			actualDisplay,
			expectedDisplay,
			`Risk of ${actualDisplay} is within limit of ${expectedDisplay}`,
		);
	}

	return failedResult(
		actualDisplay,
		expectedDisplay,
		`Risk of ${actualDisplay} exceeds limit of ${expectedDisplay}`,
	);
}

/**
 * Evaluate minimum R:R ratio condition
 * Formula: plannedRR >= minRatio
 */
export function evaluateMinRRRatio(
	condition: MinRRRatioCondition,
	trade: TradeForEvaluation,
): AutoEvaluationResult {
	const entry = parseFloat(trade.entryPrice);
	const stop = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
	const tp = trade.takeProfit ? parseFloat(trade.takeProfit) : null;

	// Need both stop and take profit to calculate R:R
	if (stop === null) {
		return unavailableResult("No stop loss set - cannot calculate R:R ratio");
	}
	if (tp === null) {
		return unavailableResult("No take profit set - cannot calculate R:R ratio");
	}

	const plannedRR = calculatePlannedRR(entry, stop, tp);
	if (plannedRR === null) {
		return unavailableResult("Could not calculate R:R ratio (risk is zero)");
	}

	const actualDisplay = `${plannedRR.toFixed(2)}R`;
	const expectedDisplay = `${condition.minRatio.toFixed(2)}R`;

	if (plannedRR >= condition.minRatio) {
		return passedResult(
			actualDisplay,
			expectedDisplay,
			`Planned R:R of ${actualDisplay} meets minimum of ${expectedDisplay}`,
		);
	}

	return failedResult(
		actualDisplay,
		expectedDisplay,
		`Planned R:R of ${actualDisplay} below minimum of ${expectedDisplay}`,
	);
}

/**
 * Evaluate breakeven trigger condition
 * If MFE >= triggerR, check that stop was moved to breakeven (or better)
 */
export function evaluateBreakevenTrigger(
	condition: BreakevenTriggerCondition,
	trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	// Need MFE data to evaluate
	if (context.mfeR === null) {
		return unavailableResult(
			"MFE data unavailable - cannot evaluate breakeven trigger",
		);
	}

	const triggerR = condition.triggerR;
	const expectedDisplay = `Move to BE at ${triggerR}R`;

	// If MFE didn't reach trigger, rule is N/A (passes by default)
	if (context.mfeR < triggerR) {
		return {
			passed: true,
			actual: `MFE: ${context.mfeR.toFixed(2)}R`,
			expected: expectedDisplay,
			details: `MFE of ${context.mfeR.toFixed(2)}R did not reach trigger of ${triggerR}R - rule not applicable`,
			evaluatedAt: new Date().toISOString(),
			dataQuality: "full",
		};
	}

	// MFE reached trigger - check if stop was moved
	if (!trade.wasTrailed && !trade.trailedStopLoss) {
		return failedResult(
			"Stop not moved",
			expectedDisplay,
			`MFE reached ${context.mfeR.toFixed(2)}R but stop was not moved to breakeven`,
		);
	}

	const entry = parseFloat(trade.entryPrice);
	const trailedStop = trade.trailedStopLoss
		? parseFloat(trade.trailedStopLoss)
		: null;

	if (trailedStop === null) {
		return failedResult(
			"No trailed stop",
			expectedDisplay,
			`MFE reached ${context.mfeR.toFixed(2)}R but no trailed stop loss recorded`,
		);
	}

	// For longs: trailed stop should be >= entry (at or above breakeven)
	// For shorts: trailed stop should be <= entry (at or below breakeven)
	const isAtBreakeven =
		trade.direction === "long" ? trailedStop >= entry : trailedStop <= entry;

	if (isAtBreakeven) {
		const actualDisplay =
			trade.direction === "long"
				? `Stop moved to ${trailedStop.toFixed(2)} (≥ entry ${entry.toFixed(2)})`
				: `Stop moved to ${trailedStop.toFixed(2)} (≤ entry ${entry.toFixed(2)})`;
		return passedResult(
			actualDisplay,
			expectedDisplay,
			`Stop correctly moved to breakeven after MFE reached ${context.mfeR.toFixed(2)}R`,
		);
	}

	return failedResult(
		`Stop at ${trailedStop.toFixed(2)}`,
		expectedDisplay,
		`MFE reached ${context.mfeR.toFixed(2)}R but stop (${trailedStop.toFixed(2)}) not at breakeven (entry: ${entry.toFixed(2)})`,
	);
}

/**
 * Evaluate scale out at R condition
 * Check if a partial exit was taken near the target R-multiple price
 */
export function evaluateScaleOutAtR(
	condition: ScaleOutAtRCondition,
	trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	const entry = parseFloat(trade.entryPrice);
	const stop = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
	const quantity = parseFloat(trade.quantity);

	if (stop === null) {
		return unavailableResult(
			"No stop loss set - cannot calculate target price",
		);
	}

	const riskPerUnit = Math.abs(entry - stop);
	if (riskPerUnit === 0) {
		return unavailableResult("Risk is zero - cannot calculate target price");
	}

	// Calculate target price for the R-multiple
	const targetPrice =
		trade.direction === "long"
			? entry + riskPerUnit * condition.targetR
			: entry - riskPerUnit * condition.targetR;

	const expectedSizePercent = condition.sizePercent;
	const expectedQuantity = quantity * (expectedSizePercent / 100);
	const expectedDisplay = `Take ${expectedSizePercent}% at ${condition.targetR}R ($${targetPrice.toFixed(2)})`;

	// Look for scale_out executions near the target price
	const scaleOuts = context.executions.filter(
		(e) => e.executionType === "scale_out",
	);

	if (scaleOuts.length === 0) {
		return failedResult(
			"No scale outs",
			expectedDisplay,
			`No partial exits found - expected ${expectedSizePercent}% at ${condition.targetR}R`,
		);
	}

	// Allow 10% tolerance on price (or 0.1R)
	const priceTolerance = riskPerUnit * 0.1;

	for (const execution of scaleOuts) {
		const execPrice = parseFloat(execution.price);
		const execQuantity = parseFloat(execution.quantity);

		// Check if execution is near target price
		if (Math.abs(execPrice - targetPrice) <= priceTolerance) {
			// Check if quantity is approximately correct (within 20%)
			const quantityMatch =
				Math.abs(execQuantity - expectedQuantity) / expectedQuantity <= 0.2;

			if (quantityMatch) {
				return passedResult(
					`${((execQuantity / quantity) * 100).toFixed(0)}% at $${execPrice.toFixed(2)}`,
					expectedDisplay,
					`Scaled out ${((execQuantity / quantity) * 100).toFixed(0)}% at $${execPrice.toFixed(2)} (target: $${targetPrice.toFixed(2)})`,
				);
			}
		}
	}

	// Found scale outs but none matched the criteria
	const closestScaleOut = scaleOuts.reduce((closest, current) => {
		const currentDist = Math.abs(parseFloat(current.price) - targetPrice);
		const closestDist = Math.abs(parseFloat(closest.price) - targetPrice);
		return currentDist < closestDist ? current : closest;
	});

	return failedResult(
		`${((parseFloat(closestScaleOut.quantity) / quantity) * 100).toFixed(0)}% at $${parseFloat(closestScaleOut.price).toFixed(2)}`,
		expectedDisplay,
		`No scale out at target ${condition.targetR}R ($${targetPrice.toFixed(2)}). Closest was at $${parseFloat(closestScaleOut.price).toFixed(2)}`,
	);
}

/**
 * Evaluate daily loss limit condition
 * Sum of day's closed trades P&L must not exceed -limit
 */
export function evaluateDailyLossLimit(
	condition: DailyLossLimitCondition,
	trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	// Calculate total P&L for the day (including this trade)
	let dayPnl = 0;
	for (const dayTrade of context.dayTrades) {
		if (dayTrade.netPnl !== null) {
			dayPnl += parseFloat(dayTrade.netPnl);
		}
	}

	// Add this trade's P&L if closed
	if (trade.netPnl !== null) {
		dayPnl += parseFloat(trade.netPnl);
	}

	let limitValue: number;
	let expectedDisplay: string;

	if (condition.limitType === "dollars") {
		limitValue = condition.limitValue;
		expectedDisplay = `-$${condition.limitValue.toFixed(2)}`;
	} else {
		// Percent-based limit
		if (context.accountBalance === null) {
			return unavailableResult(
				"Account balance unavailable for percent-based limit calculation",
			);
		}
		limitValue = (condition.limitValue / 100) * context.accountBalance;
		expectedDisplay = `-${condition.limitValue}% (-$${limitValue.toFixed(2)})`;
	}

	const actualDisplay =
		dayPnl >= 0 ? `+$${dayPnl.toFixed(2)}` : `-$${Math.abs(dayPnl).toFixed(2)}`;

	// Pass if daily P&L is not below the negative limit
	// i.e., dayPnl > -limitValue (loss less than limit)
	if (dayPnl > -limitValue) {
		return passedResult(
			actualDisplay,
			expectedDisplay,
			`Daily P&L of ${actualDisplay} is within limit of ${expectedDisplay}`,
		);
	}

	return failedResult(
		actualDisplay,
		expectedDisplay,
		`Daily loss of ${actualDisplay} exceeds limit of ${expectedDisplay}`,
	);
}

/**
 * Evaluate max concurrent positions condition
 * Number of open trades at entry time must not exceed max
 */
export function evaluateMaxConcurrentPositions(
	condition: MaxConcurrentPositionsCondition,
	_trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	const concurrent = context.concurrentTradesAtEntry;
	const maxPositions = condition.maxPositions;

	// The count includes this trade, so compare with max
	// If entering this trade made us at exactly max, that's allowed
	// If entering this trade put us over max, that's a violation
	const actualDisplay = `${concurrent} positions`;
	const expectedDisplay = `Max ${maxPositions}`;

	if (concurrent <= maxPositions) {
		return passedResult(
			actualDisplay,
			expectedDisplay,
			`Had ${concurrent} concurrent position(s) at entry (limit: ${maxPositions})`,
		);
	}

	return failedResult(
		actualDisplay,
		expectedDisplay,
		`Had ${concurrent} concurrent positions at entry, exceeding limit of ${maxPositions}`,
	);
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Evaluate an auto condition against a trade
 * Dispatches to the appropriate evaluator based on condition type
 */
export function evaluateAutoCondition(
	condition: AutoCondition,
	trade: TradeForEvaluation,
	context: EvaluationContext,
): AutoEvaluationResult {
	switch (condition.type) {
		case "maxRiskPerTrade":
			return evaluateMaxRiskPerTrade(condition, trade, context);

		case "minRRRatio":
			return evaluateMinRRRatio(condition, trade);

		case "breakevenTrigger":
			return evaluateBreakevenTrigger(condition, trade, context);

		case "scaleOutAtR":
			return evaluateScaleOutAtR(condition, trade, context);

		case "dailyLossLimit":
			return evaluateDailyLossLimit(condition, trade, context);

		case "maxConcurrentPositions":
			return evaluateMaxConcurrentPositions(condition, trade, context);

		case "trailingStopTrigger":
			// Trailing stop trigger is semi_auto - currently returns unavailable
			// Full implementation would check if trailing was applied correctly
			return unavailableResult(
				"Trailing stop evaluation requires manual verification",
			);

		default: {
			// Exhaustive check
			const _exhaustive: never = condition;
			return unavailableResult(`Unknown condition type: ${_exhaustive}`);
		}
	}
}

/**
 * Calculate MFE in R-multiples from trade data
 * Reusable helper for building evaluation context
 */
export function calculateMfeInR(trade: TradeForEvaluation): number | null {
	const entry = parseFloat(trade.entryPrice);
	const stop = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
	const mfePrice = trade.mfePrice ? parseFloat(trade.mfePrice) : null;

	if (stop === null || mfePrice === null) {
		return null;
	}

	const riskPerUnit = Math.abs(entry - stop);
	if (riskPerUnit === 0) {
		return null;
	}

	// MFE in R = how far price moved favorably / risk per unit
	const mfePoints =
		trade.direction === "long" ? mfePrice - entry : entry - mfePrice;

	return mfePoints / riskPerUnit;
}

// ============================================================================
// BUILD EVALUATION CONTEXT HELPER
// ============================================================================

/**
 * Full trade record with account info needed for building context
 */
export interface TradeWithAccount {
	id: string;
	userId: string;
	accountId: string | null;
	symbol: string;
	direction: "long" | "short";
	entryPrice: string;
	exitPrice: string | null;
	entryTime: Date;
	exitTime: Date | null;
	quantity: string;
	stopLoss: string | null;
	takeProfit: string | null;
	trailedStopLoss: string | null;
	wasTrailed: boolean | null;
	netPnl: string | null;
	mfePrice: string | null;
	mfeAmount: string | null;
	status: "open" | "closed";
}

/**
 * Build evaluation context for a trade
 * Fetches all data required to evaluate auto-conditions
 *
 * @param db - Drizzle database instance
 * @param trade - The trade to build context for
 * @param userId - The user's ID (for fetching related data)
 */
export async function buildEvaluationContext(
	db: Db,
	trade: TradeWithAccount,
	userId: string,
	cache?: UserSettingsCache,
): Promise<EvaluationContext> {
	// Get user timezone for date comparisons
	const userTimezone = await getUserTimezone(db, userId, cache);

	// Run queries in parallel for efficiency
	const [executionsResult, dayTradesResult, concurrentCount, accountBalance] =
		await Promise.all([
			// 1. Fetch trade executions for this trade
			fetchTradeExecutions(db, trade.id),

			// 2. Fetch same-day trades for daily loss limit
			fetchSameDayTrades(db, trade, userId, userTimezone),

			// 3. Count concurrent trades at entry time
			countConcurrentTrades(db, trade, userId),

			// 4. Get account balance if trade has an account
			fetchAccountBalance(db, trade.accountId),
		]);

	// Calculate MFE in R-multiples
	const mfeR = calculateMfeInR({
		id: trade.id,
		symbol: trade.symbol,
		direction: trade.direction,
		entryPrice: trade.entryPrice,
		exitPrice: trade.exitPrice,
		quantity: trade.quantity,
		stopLoss: trade.stopLoss,
		takeProfit: trade.takeProfit,
		trailedStopLoss: trade.trailedStopLoss,
		wasTrailed: trade.wasTrailed,
		netPnl: trade.netPnl,
		mfePrice: trade.mfePrice,
		mfeAmount: trade.mfeAmount,
	});

	return {
		executions: executionsResult,
		dayTrades: dayTradesResult,
		concurrentTradesAtEntry: concurrentCount,
		mfeR,
		accountBalance,
	};
}

/**
 * Fetch trade executions for a trade
 */
async function fetchTradeExecutions(
	db: Db,
	tradeId: string,
): Promise<TradeExecution[]> {
	const results = await db.query.tradeExecutions.findMany({
		where: eq(tradeExecutions.tradeId, tradeId),
	});
	return results;
}

/**
 * Fetch trades closed on the same calendar day as the given trade
 * Uses the trade's exit time (or entry time if still open) to determine the day
 */
async function fetchSameDayTrades(
	db: Db,
	trade: TradeWithAccount,
	userId: string,
	userTimezone: string,
): Promise<EvaluationContext["dayTrades"]> {
	// Use exit time for closed trades, entry time for open trades
	const referenceTime = trade.exitTime ?? trade.entryTime;

	// Get date string in user's timezone
	const dateString = getDateStringInTimezone(referenceTime, userTimezone);

	// Get day bounds in UTC for querying
	const { start, end } = getDayBoundsInTimezone(dateString, userTimezone);

	// Query closed trades on the same day (excluding this trade)
	const results = await db.query.trades.findMany({
		where: and(
			eq(trades.userId, userId),
			eq(trades.status, "closed"),
			ne(trades.id, trade.id),
			isNull(trades.deletedAt),
			// Exit time within the day bounds
			gte(trades.exitTime, start),
			lt(trades.exitTime, end),
		),
		columns: {
			id: true,
			netPnl: true,
			status: true,
			exitTime: true,
		},
	});

	return results;
}

/**
 * Count trades that were open at this trade's entry time
 * A trade is considered "concurrent" if:
 * - It was opened before or at this trade's entry time
 * - It was still open (not closed) at this trade's entry time
 */
async function countConcurrentTrades(
	db: Db,
	trade: TradeWithAccount,
	userId: string,
): Promise<number> {
	const entryTime = trade.entryTime;

	// Count trades that were open at this trade's entry time:
	// 1. Entered before or at this trade's entry time
	// 2. Either still open OR exited after this trade's entry time
	// 3. Not this trade itself
	// 4. Not soft-deleted
	// The open-at-entry predicate is pushed into SQL so we COUNT rather than
	// fetching every prior trade and filtering in memory. (gt is NULL-false, so
	// open trades with a null exitTime are matched by the status="open" branch.)
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(trades)
		.where(
			and(
				eq(trades.userId, userId),
				ne(trades.id, trade.id),
				isNull(trades.deletedAt),
				lte(trades.entryTime, entryTime),
				or(eq(trades.status, "open"), gt(trades.exitTime, entryTime)),
			),
		);

	// +1 to include this trade itself
	return (row?.count ?? 0) + 1;
}

/**
 * Fetch account balance for percent-based risk calculations
 */
async function fetchAccountBalance(
	db: Db,
	accountId: string | null,
): Promise<number | null> {
	if (!accountId) return null;

	const account = await db.query.accounts.findFirst({
		where: eq(accounts.id, accountId),
		columns: {
			initialBalance: true,
		},
	});

	if (!account?.initialBalance) return null;

	return parseFloat(account.initialBalance);
}
