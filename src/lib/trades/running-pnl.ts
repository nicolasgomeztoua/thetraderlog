/**
 * Running P&L calculation utilities for trade replay and charts.
 *
 * These functions calculate unrealized + realized P&L at any point in time
 * during a trade, supporting partial exits (scale-outs) and both futures and forex.
 */

import type { ChartBar } from "@/lib/market-data/candle-aggregation";
import {
	calculateForexPnL,
	calculateFuturesPnL,
} from "@/lib/market-data/symbols";
import { toUnixTimestamp } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface Execution {
	id: string;
	executionType: "entry" | "exit" | "scale_in" | "scale_out";
	price: string;
	quantity: string;
	executedAt: Date | string;
	realizedPnl?: string | null;
}

export interface RunningPnlPoint {
	time: number; // Unix timestamp in seconds
	pnl: number; // P&L in dollars
}

export interface RunningPnlOptions {
	bars: ChartBar[];
	executions: Execution[];
	direction: "long" | "short";
	symbol: string;
	instrumentType: "futures" | "forex";
}

// =============================================================================
// CORE CALCULATION
// =============================================================================

/**
 * Calculate running P&L at a specific point in time.
 *
 * Running P&L = Unrealized P&L (current position at current price)
 *             + Realized P&L (from exits/scale-outs up to this time)
 *
 * @param executions - All executions up to the target time
 * @param currentPrice - Current market price (close of current bar)
 * @param direction - Trade direction (long/short)
 * @param symbol - Trading symbol (e.g., "ES", "EUR/USD")
 * @param instrumentType - "futures" or "forex"
 * @returns P&L in dollars
 */
export function calculateRunningPnlAtTime(
	executions: Execution[],
	currentPrice: number,
	direction: "long" | "short",
	symbol: string,
	instrumentType: "futures" | "forex",
): number {
	if (executions.length === 0) {
		return 0;
	}

	// Find the entry execution
	const entryExec = executions.find((e) => e.executionType === "entry");
	if (!entryExec) return 0;

	const entry = parseFloat(entryExec.price);
	const quantity = parseFloat(entryExec.quantity);

	// Calculate unrealized P&L using proper point/pip values
	const unrealizedPnl =
		instrumentType === "futures"
			? calculateFuturesPnL(symbol, entry, currentPrice, quantity, direction)
			: calculateForexPnL(symbol, entry, currentPrice, quantity, direction);

	// Sum realized P&L from scale-outs and exits
	const realizedPnl = executions
		.filter(
			(e) => e.executionType === "exit" || e.executionType === "scale_out",
		)
		.reduce((sum, e) => sum + (parseFloat(e.realizedPnl ?? "0") || 0), 0);

	return unrealizedPnl + realizedPnl;
}

// =============================================================================
// SERIES GENERATION
// =============================================================================

/**
 * Generate a time series of running P&L values for charting.
 *
 * Returns one P&L point per bar, calculating the unrealized + realized P&L
 * at each bar's close price.
 *
 * @param options - Bars, executions, and trade parameters
 * @returns Array of { time, pnl } points for charting
 */
export function generateRunningPnlSeries(
	options: RunningPnlOptions,
): RunningPnlPoint[] {
	const { bars, executions, direction, symbol, instrumentType } = options;

	if (bars.length === 0 || executions.length === 0) {
		return [];
	}

	// Find the entry execution to determine when P&L tracking starts
	const entryExec = executions.find((e) => e.executionType === "entry");
	if (!entryExec) return [];

	const entryTime = toUnixTimestamp(entryExec.executedAt);

	// Generate P&L for each bar at or after entry
	const pnlSeries: RunningPnlPoint[] = [];

	for (const bar of bars) {
		// Skip bars before entry
		if (bar.time < entryTime) {
			continue;
		}

		// Get executions visible at this bar's time
		const visibleExecutions = executions.filter((exec) => {
			const execTs = toUnixTimestamp(exec.executedAt);
			return execTs <= bar.time;
		});

		// Calculate P&L at this point
		const pnl = calculateRunningPnlAtTime(
			visibleExecutions,
			bar.close,
			direction,
			symbol,
			instrumentType,
		);

		pnlSeries.push({
			time: bar.time,
			pnl,
		});
	}

	return pnlSeries;
}
