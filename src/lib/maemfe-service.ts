/**
 * MAE/MFE Service
 *
 * Shared service for calculating and storing Maximum Adverse Excursion (MAE)
 * and Maximum Favorable Excursion (MFE) metrics for trades.
 *
 * This service is used by:
 * - tRPC trades.calculateMAEMFE mutation (on-demand calculation)
 * - Queue process endpoint (background batch processing via Upstash QStash)
 */

import { eq } from "drizzle-orm";
import {
	type DataQuality,
	getOHLCForTimeRange,
} from "@/lib/market-data-service";
import { calculateMAEMFE, type MAEMFEResult } from "@/lib/trade-calculations";
import { db } from "@/server/db";
import { type Trade, trades } from "@/server/db/schema";

// =============================================================================
// TYPES
// =============================================================================

export interface MAEMFEServiceResult {
	success: boolean;
	dataQuality: DataQuality;
	metrics?: MAEMFEResult;
	trade?: Trade;
	message?: string;
}

export interface CalculateAndStoreOptions {
	/**
	 * If true, skip calculation for trades that already have MAE/MFE data
	 * (marketDataQuality is not null or 'pending')
	 * Default: true for batch processing, false for explicit user requests
	 */
	skipAlreadyProcessed?: boolean;

	/**
	 * Log prefix for identifying the caller in logs
	 * Default: "[MAE/MFE]"
	 */
	logTag?: string;
}

// =============================================================================
// CORE SERVICE FUNCTION
// =============================================================================

/**
 * Calculate and store MAE/MFE for a single trade.
 *
 * This is the unified function used by both:
 * - tRPC mutation for on-demand calculation
 * - Queue endpoint for batch background processing
 *
 * @param tradeId - The trade ID to process
 * @param options - Configuration options
 * @returns Result with success status, data quality, and optional metrics
 */
export async function calculateAndStoreMAEMFE(
	tradeId: string,
	options: CalculateAndStoreOptions = {},
): Promise<MAEMFEServiceResult> {
	const { skipAlreadyProcessed = true, logTag = "[MAE/MFE]" } = options;

	console.log(`${logTag} Processing trade ${tradeId}`);

	// 1. Fetch the trade
	const trade = await db.query.trades.findFirst({
		where: eq(trades.id, tradeId),
	});

	if (!trade) {
		console.error(`${logTag} Trade ${tradeId} not found`);
		return {
			success: false,
			dataQuality: "unavailable",
			message: "Trade not found",
		};
	}

	// 2. Validate trade state
	if (trade.status !== "closed" || !trade.exitTime || !trade.exitPrice) {
		console.log(`${logTag} Trade ${tradeId} is not closed, skipping`);
		return {
			success: false,
			dataQuality: "unavailable",
			message: "Trade must be closed to calculate MAE/MFE",
		};
	}

	// 3. Skip if already processed (optional)
	if (
		skipAlreadyProcessed &&
		trade.marketDataQuality &&
		trade.marketDataQuality !== "pending"
	) {
		console.log(`${logTag} Trade ${tradeId} already processed, skipping`);
		return {
			success: true,
			dataQuality: trade.marketDataQuality,
			message: "Already processed",
		};
	}

	// 4. Mark as pending while we calculate
	await db
		.update(trades)
		.set({ marketDataQuality: "pending" })
		.where(eq(trades.id, tradeId));

	console.log(`${logTag} Marked trade ${tradeId} as pending`);

	try {
		// 5. Fetch market data for the trade duration
		console.log(
			`${logTag} Fetching OHLC for ${trade.symbol} from ${trade.entryTime.toISOString()} to ${trade.exitTime.toISOString()}`,
		);

		const { bars, dataQuality } = await getOHLCForTimeRange(
			trade.symbol,
			"1min", // 1-minute bars for best available precision
			trade.entryTime,
			trade.exitTime,
		);

		const lastBar = bars.at(-1);
		console.log(
			`${logTag} OHLC fetch result:`,
			JSON.stringify({
				barCount: bars.length,
				dataQuality,
				firstBar: bars[0]
					? { time: new Date(bars[0].timestamp).toISOString() }
					: null,
				lastBar: lastBar
					? { time: new Date(lastBar.timestamp).toISOString() }
					: null,
			}),
		);

		// 6. Handle no data case
		if (bars.length === 0) {
			console.log(
				`${logTag} No bars for trade ${tradeId}, marking unavailable`,
			);
			await db
				.update(trades)
				.set({ marketDataQuality: "unavailable" })
				.where(eq(trades.id, tradeId));

			return {
				success: false,
				dataQuality: "unavailable",
				message: "No market data available for this trade period",
			};
		}

		// 7. Calculate MAE/MFE
		console.log(`${logTag} Calculating MAE/MFE metrics...`);
		const metrics = calculateMAEMFE(
			bars,
			parseFloat(trade.entryPrice),
			parseFloat(trade.exitPrice),
			trade.direction,
			parseFloat(trade.quantity),
			trade.symbol,
			trade.instrumentType,
		);

		console.log(
			`${logTag} Calculated metrics:`,
			JSON.stringify({
				maePrice: metrics.maePrice,
				mfePrice: metrics.mfePrice,
				maeAmount: metrics.maeAmount,
				mfeAmount: metrics.mfeAmount,
				efficiency: metrics.efficiency,
			}),
		);

		// 8. Store results permanently
		const [updated] = await db
			.update(trades)
			.set({
				maePrice: metrics.maePrice.toString(),
				mfePrice: metrics.mfePrice.toString(),
				maeAmount: metrics.maeAmount.toFixed(2),
				mfeAmount: metrics.mfeAmount.toFixed(2),
				tradeEfficiency: metrics.efficiency.toFixed(2),
				marketDataQuality: dataQuality,
			})
			.where(eq(trades.id, tradeId))
			.returning();

		console.log(`${logTag} SUCCESS: Stored MAE/MFE for trade ${tradeId}`);

		return {
			success: true,
			dataQuality,
			metrics,
			trade: updated,
		};
	} catch (error) {
		// Mark as unavailable on error
		console.error(
			`${logTag} ERROR for trade ${tradeId}:`,
			error instanceof Error ? error.message : error,
		);

		await db
			.update(trades)
			.set({ marketDataQuality: "unavailable" })
			.where(eq(trades.id, tradeId));

		return {
			success: false,
			dataQuality: "unavailable",
			message:
				error instanceof Error ? error.message : "Failed to calculate MAE/MFE",
		};
	}
}
