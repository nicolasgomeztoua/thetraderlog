/**
 * Running P&L calculation utilities for trade replay and charts.
 *
 * These functions calculate unrealized + realized P&L at any point in time
 * during a trade, supporting partial exits (scale-outs).
 */

import type { ChartBar } from "@/lib/market-data/candle-aggregation";
import { calculateFuturesPnL } from "@/lib/market-data/symbols";
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
	_instrumentType: "futures" | "forex",
): number {
	if (executions.length === 0) {
		return 0;
	}

	// Find the entry execution
	const entryExec = executions.find((e) => e.executionType === "entry");
	if (!entryExec) return 0;

	const entry = parseFloat(entryExec.price);
	const entryQuantity = parseFloat(entryExec.quantity);

	// Calculate remaining position after scale-outs/exits
	const exitsAndScaleOuts = executions.filter(
		(e) => e.executionType === "exit" || e.executionType === "scale_out",
	);
	const exitedQuantity = exitsAndScaleOuts.reduce(
		(sum, e) => sum + parseFloat(e.quantity),
		0,
	);
	const remainingQuantity = entryQuantity - exitedQuantity;

	// Calculate unrealized P&L using remaining position (not original entry quantity)
	const unrealizedPnl =
		remainingQuantity > 0
			? calculateFuturesPnL(
					symbol,
					entry,
					currentPrice,
					remainingQuantity,
					direction,
				)
			: 0;

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
 * For closed trades (with an exit execution), the series stops at the exit time
 * and uses the exit price for the final P&L calculation.
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

	// Find the exit execution (if trade is closed) to determine when P&L tracking stops
	const exitExec = executions.find((e) => e.executionType === "exit");
	const exitTime = exitExec ? toUnixTimestamp(exitExec.executedAt) : null;
	const exitPrice = exitExec ? parseFloat(exitExec.price) : null;

	// Generate P&L for each bar at or after entry
	const pnlSeries: RunningPnlPoint[] = [];

	for (const bar of bars) {
		// Skip bars before entry
		if (bar.time < entryTime) {
			continue;
		}

		// For closed trades, stop after exit time
		if (exitTime !== null && bar.time > exitTime) {
			break;
		}

		// Get executions visible at this bar's time
		const visibleExecutions = executions.filter((exec) => {
			const execTs = toUnixTimestamp(exec.executedAt);
			return execTs <= bar.time;
		});

		// Determine price to use for P&L calculation:
		// - At or after exit: use exit price for accuracy
		// - Before exit: use bar's close price
		const priceForPnl =
			exitTime !== null && exitPrice !== null && bar.time >= exitTime
				? exitPrice
				: bar.close;

		// Calculate P&L at this point
		const pnl = calculateRunningPnlAtTime(
			visibleExecutions,
			priceForPnl,
			direction,
			symbol,
			instrumentType,
		);

		pnlSeries.push({
			time: bar.time,
			pnl,
		});
	}

	// Add final point at exact exit time with exit price
	// This ensures the series ends at the precise exit moment, not the last bar before exit
	if (exitTime !== null && exitPrice !== null) {
		const lastPoint = pnlSeries[pnlSeries.length - 1];
		// Only add if exit time is different from last point (avoid duplicates)
		if (!lastPoint || lastPoint.time !== exitTime) {
			// Exclude the exit execution - we want P&L "just before exit" at exit price
			// This gives correct P&L since remaining position isn't 0 yet
			const executionsBeforeExit = executions.filter(
				(e) => e.executionType !== "exit",
			);
			const finalPnl = calculateRunningPnlAtTime(
				executionsBeforeExit,
				exitPrice,
				direction,
				symbol,
				instrumentType,
			);
			pnlSeries.push({
				time: exitTime,
				pnl: finalPnl,
			});
		}
	}

	return pnlSeries;
}
