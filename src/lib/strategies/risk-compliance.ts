/**
 * Risk Compliance Calculator
 *
 * Calculates auto-compliance for validatable risk parameters against trade data.
 * Used to check if trades followed strategy rules (R:R ratio, max risk, etc.)
 */

import { getForexSpec, getFuturesSpec } from "@/lib/market-data/symbols";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Trade data needed for compliance calculations
 */
export interface TradeForCompliance {
	id: string;
	symbol: string;
	instrumentType: "futures" | "forex";
	direction: "long" | "short";
	entryPrice: number;
	exitPrice: number | null;
	stopLoss: number | null;
	takeProfit: number | null;
	quantity: number;
	realizedPnl: number | null;
	entryTime?: Date | string;
	exitTime?: Date | string | null;
}

/**
 * Risk parameters from strategy
 */
export interface RiskParameters {
	minRRRatio: number | null;
	maxRiskPerTrade: { type: "dollars" | "percent"; value: number } | null;
	dailyLossLimit: { type: "dollars" | "percent"; value: number } | null;
	maxConcurrentPositions: number | null;
	targetRMultiples: number[] | null;
}

/**
 * Result of a single compliance check
 */
export interface ComplianceCheck {
	param: string;
	passed: boolean | null; // null = unable to check
	actual: number | null;
	limit: number | null;
	note?: string;
}

/**
 * Overall compliance result
 */
export interface ComplianceResult {
	checks: ComplianceCheck[];
	targetsHit: number[];
	overallCompliance: number; // 0-100 percentage
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate dollar risk for a trade based on entry, stop loss, and position size
 */
export function calculateDollarRisk(trade: TradeForCompliance): number | null {
	if (trade.stopLoss === null) return null;

	const priceDiff = Math.abs(trade.entryPrice - trade.stopLoss);

	if (trade.instrumentType === "futures") {
		const spec = getFuturesSpec(trade.symbol);
		if (!spec) return null;
		return priceDiff * spec.pointValue * trade.quantity;
	}

	// Forex - use pip value
	const forexSpec = getForexSpec(trade.symbol);
	if (!forexSpec) {
		// Fallback calculation for unknown forex pairs
		return priceDiff * 100000 * trade.quantity; // Assume standard lot
	}
	const pips = priceDiff / forexSpec.pipSize;
	return pips * forexSpec.pipValuePerLot * trade.quantity;
}

/**
 * Calculate planned R:R ratio from entry, stop loss, and take profit
 */
export function calculatePlannedRR(trade: TradeForCompliance): number | null {
	if (trade.stopLoss === null || trade.takeProfit === null) return null;

	const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss);
	const rewardDistance = Math.abs(trade.takeProfit - trade.entryPrice);

	if (riskDistance === 0) return null;

	return rewardDistance / riskDistance;
}

/**
 * Calculate achieved R-multiple based on actual P&L vs planned risk
 */
export function calculateAchievedR(trade: TradeForCompliance): number | null {
	if (trade.stopLoss === null || trade.realizedPnl === null) return null;

	const dollarRisk = calculateDollarRisk(trade);
	if (!dollarRisk || dollarRisk === 0) return null;

	return trade.realizedPnl / dollarRisk;
}

// ============================================================================
// COMPLIANCE CHECK FUNCTIONS
// ============================================================================

/**
 * Check if trade met minimum R:R ratio requirement
 */
export function checkMinRRRatio(
	trade: TradeForCompliance,
	minRRRatio: number,
): ComplianceCheck {
	const plannedRR = calculatePlannedRR(trade);

	if (plannedRR === null) {
		return {
			param: "minRRRatio",
			passed: null,
			actual: null,
			limit: minRRRatio,
			note: "Unable to check: missing stop loss or take profit",
		};
	}

	return {
		param: "minRRRatio",
		passed: plannedRR >= minRRRatio,
		actual: Math.round(plannedRR * 100) / 100,
		limit: minRRRatio,
		note:
			plannedRR >= minRRRatio
				? `Planned R:R of ${plannedRR.toFixed(2)} met minimum`
				: `Planned R:R of ${plannedRR.toFixed(2)} below minimum`,
	};
}

/**
 * Check if trade risk was within max risk per trade limit
 */
export function checkMaxRiskPerTrade(
	trade: TradeForCompliance,
	maxRisk: { type: "dollars" | "percent"; value: number },
	accountBalance?: number,
): ComplianceCheck {
	const dollarRisk = calculateDollarRisk(trade);

	if (dollarRisk === null) {
		return {
			param: "maxRiskPerTrade",
			passed: null,
			actual: null,
			limit: maxRisk.value,
			note: "Unable to check: missing stop loss",
		};
	}

	if (maxRisk.type === "dollars") {
		return {
			param: "maxRiskPerTrade",
			passed: dollarRisk <= maxRisk.value,
			actual: Math.round(dollarRisk * 100) / 100,
			limit: maxRisk.value,
			note:
				dollarRisk <= maxRisk.value
					? `Risk of $${dollarRisk.toFixed(2)} within limit`
					: `Risk of $${dollarRisk.toFixed(2)} exceeded $${maxRisk.value} limit`,
		};
	}

	// Percent-based risk requires account balance
	if (!accountBalance) {
		return {
			param: "maxRiskPerTrade",
			passed: null,
			actual: null,
			limit: maxRisk.value,
			note: "Unable to check: account balance required for percent-based limit",
		};
	}

	const riskPercent = (dollarRisk / accountBalance) * 100;
	return {
		param: "maxRiskPerTrade",
		passed: riskPercent <= maxRisk.value,
		actual: Math.round(riskPercent * 100) / 100,
		limit: maxRisk.value,
		note:
			riskPercent <= maxRisk.value
				? `Risk of ${riskPercent.toFixed(2)}% within limit`
				: `Risk of ${riskPercent.toFixed(2)}% exceeded ${maxRisk.value}% limit`,
	};
}

/**
 * Check which target R-multiples were hit
 */
export function checkTargetRMultiples(
	trade: TradeForCompliance,
	targets: number[],
): { check: ComplianceCheck; targetsHit: number[] } {
	const achievedR = calculateAchievedR(trade);

	if (achievedR === null) {
		return {
			check: {
				param: "targetRMultiples",
				passed: null,
				actual: null,
				limit: null,
				note: "Unable to check: missing stop loss or realized P&L",
			},
			targetsHit: [],
		};
	}

	const sortedTargets = [...targets].sort((a, b) => a - b);
	const targetsHit = sortedTargets.filter((t) => achievedR >= t);
	const highestTarget = sortedTargets[sortedTargets.length - 1] ?? 0;

	return {
		check: {
			param: "targetRMultiples",
			passed: targetsHit.length > 0,
			actual: Math.round(achievedR * 100) / 100,
			limit: highestTarget,
			note:
				targetsHit.length > 0
					? `Hit ${targetsHit.length} target(s): ${targetsHit.map((t) => `${t}R`).join(", ")}`
					: `Did not hit any targets (achieved ${achievedR.toFixed(2)}R)`,
		},
		targetsHit,
	};
}

/**
 * Check if a trade violated the daily loss limit
 *
 * Calculates cumulative P&L for trades on the same day (before this trade)
 * and checks if the limit was already breached when this trade was taken.
 */
export function checkDailyLossCompliance(
	trade: TradeForCompliance,
	dailyLossLimit: { type: "dollars" | "percent"; value: number },
	dailyTrades: TradeForCompliance[],
	accountBalance?: number,
): ComplianceCheck {
	// Filter out the current trade and trades without P&L
	const priorTrades = dailyTrades.filter(
		(t) => t.id !== trade.id && t.realizedPnl !== null,
	);

	// Calculate cumulative P&L before this trade
	const cumulativePnl = priorTrades.reduce(
		(sum, t) => sum + (t.realizedPnl ?? 0),
		0,
	);

	if (dailyLossLimit.type === "dollars") {
		// For dollar-based limit, check if cumulative loss exceeded limit
		// Note: loss limit is typically a positive number representing max loss allowed
		// A P&L of -$500 with a limit of $400 means the limit was breached
		const limitDollars = dailyLossLimit.value;
		const passed = cumulativePnl >= -limitDollars;

		return {
			param: "dailyLossLimit",
			passed,
			actual: Math.round(cumulativePnl * 100) / 100,
			limit: limitDollars,
			note: passed
				? `P&L was $${cumulativePnl.toFixed(2)} before this trade, within -$${limitDollars} limit`
				: `P&L was $${cumulativePnl.toFixed(2)} before this trade, exceeded -$${limitDollars} limit`,
		};
	}

	// Percent-based limit requires account balance
	if (!accountBalance) {
		return {
			param: "dailyLossLimit",
			passed: null,
			actual: null,
			limit: dailyLossLimit.value,
			note: "Unable to check: account balance required for percent-based limit",
		};
	}

	// Calculate percent loss
	const limitDollars = (dailyLossLimit.value / 100) * accountBalance;
	const passed = cumulativePnl >= -limitDollars;
	const actualPercent = (cumulativePnl / accountBalance) * 100;

	return {
		param: "dailyLossLimit",
		passed,
		actual: Math.round(actualPercent * 100) / 100,
		limit: dailyLossLimit.value,
		note: passed
			? `P&L was ${actualPercent.toFixed(2)}% before this trade, within -${dailyLossLimit.value}% limit`
			: `P&L was ${actualPercent.toFixed(2)}% before this trade, exceeded -${dailyLossLimit.value}% limit`,
	};
}

/**
 * Check if a trade violated the max concurrent positions limit
 *
 * Counts how many trades were open at this trade's entry time
 * and compares to the maxConcurrentPositions limit.
 */
export function checkConcurrentPositions(
	trade: TradeForCompliance,
	maxConcurrentPositions: number,
	allTrades: TradeForCompliance[],
): ComplianceCheck {
	// Need entry time to check concurrent positions
	if (!trade.entryTime) {
		return {
			param: "maxConcurrentPositions",
			passed: null,
			actual: null,
			limit: maxConcurrentPositions,
			note: "Unable to check: missing entry time",
		};
	}

	const tradeEntryTime = new Date(trade.entryTime);

	// Count trades that were open at this trade's entry time
	// A trade is "open" if:
	// 1. It's not the current trade
	// 2. Its entry time is before or at the current trade's entry time
	// 3. Its exit time is null (still open) OR after the current trade's entry time
	const concurrentCount = allTrades.filter((t) => {
		// Skip the current trade
		if (t.id === trade.id) return false;

		// Need entry time to determine if trade was open
		if (!t.entryTime) return false;

		const otherEntryTime = new Date(t.entryTime);
		const otherExitTime = t.exitTime ? new Date(t.exitTime) : null;

		// Trade must have started before or at the current trade's entry
		if (otherEntryTime > tradeEntryTime) return false;

		// Trade must still be open (no exit) OR exited after current trade's entry
		if (otherExitTime === null) return true;
		if (otherExitTime > tradeEntryTime) return true;

		return false;
	}).length;

	// The current trade being opened adds 1 to the count
	const totalConcurrent = concurrentCount + 1;
	const passed = totalConcurrent <= maxConcurrentPositions;

	return {
		param: "maxConcurrentPositions",
		passed,
		actual: totalConcurrent,
		limit: maxConcurrentPositions,
		note: passed
			? `${totalConcurrent} concurrent position(s) at entry, within ${maxConcurrentPositions} limit`
			: `${totalConcurrent} concurrent position(s) at entry, exceeded ${maxConcurrentPositions} limit`,
	};
}

// ============================================================================
// MAIN COMPLIANCE CALCULATOR
// ============================================================================

/**
 * Calculate compliance for all validatable risk parameters
 */
export function calculateRiskCompliance(
	trade: TradeForCompliance,
	riskParams: RiskParameters,
	accountBalance?: number,
): ComplianceResult {
	const checks: ComplianceCheck[] = [];
	let targetsHit: number[] = [];

	// Check minRRRatio
	if (riskParams.minRRRatio !== null) {
		checks.push(checkMinRRRatio(trade, riskParams.minRRRatio));
	}

	// Check maxRiskPerTrade
	if (riskParams.maxRiskPerTrade !== null) {
		checks.push(
			checkMaxRiskPerTrade(trade, riskParams.maxRiskPerTrade, accountBalance),
		);
	}

	// Check targetRMultiples
	if (
		riskParams.targetRMultiples !== null &&
		riskParams.targetRMultiples.length > 0
	) {
		const targetResult = checkTargetRMultiples(
			trade,
			riskParams.targetRMultiples,
		);
		checks.push(targetResult.check);
		targetsHit = targetResult.targetsHit;
	}

	// Calculate overall compliance (percentage of passed checks)
	const validChecks = checks.filter((c) => c.passed !== null);
	const passedChecks = validChecks.filter((c) => c.passed === true);
	const overallCompliance =
		validChecks.length > 0
			? Math.round((passedChecks.length / validChecks.length) * 100)
			: 100; // If no valid checks, assume compliant

	return {
		checks,
		targetsHit,
		overallCompliance,
	};
}
