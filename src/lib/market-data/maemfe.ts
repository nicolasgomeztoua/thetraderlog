/**
 * MAE/MFE Service
 *
 * Shared service for calculating and storing Maximum Adverse Excursion (MAE)
 * and Maximum Favorable Excursion (MFE) metrics for trades.
 *
 * This service is used by:
 * - tRPC trades.calculateMAEMFE mutation (on-demand calculation)
 * - Trigger.dev background tasks (batch processing during imports)
 */

import { eq } from "drizzle-orm";
import {
	type DataQuality,
	getOHLCForTimeRange,
} from "@/lib/market-data/service";
import { calculateMAEMFE, type MAEMFEResult } from "@/lib/trades";
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
	const { skipAlreadyProcessed = true } = options;

	// 1. Fetch the trade
	const trade = await db.query.trades.findFirst({
		where: eq(trades.id, tradeId),
	});

	if (!trade) {
		return {
			success: false,
			dataQuality: "unavailable",
			message: "Trade not found",
		};
	}

	// 2. Validate trade state
	if (trade.status !== "closed" || !trade.exitTime || !trade.exitPrice) {
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

	try {
		// 5. Fetch market data for the trade duration
		const { bars, dataQuality } = await getOHLCForTimeRange(
			trade.symbol,
			"1min", // 1-minute bars for best available precision
			trade.entryTime,
			trade.exitTime,
		);

		// 6. Handle no data case
		if (bars.length === 0) {
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
		const metrics = calculateMAEMFE(
			bars,
			parseFloat(trade.entryPrice),
			parseFloat(trade.exitPrice),
			trade.direction,
			parseFloat(trade.quantity),
			trade.symbol,
		);

		// 8. Store results permanently
		const [updated] = await db
			.update(trades)
			.set({
				maePrice: metrics.maePrice.toString(),
				mfePrice: metrics.mfePrice.toString(),
				maeAmount: metrics.maeAmount.toFixed(2),
				mfeAmount: metrics.mfeAmount.toFixed(2),
				marketDataQuality: dataQuality,
			})
			.where(eq(trades.id, tradeId))
			.returning();

		return {
			success: true,
			dataQuality,
			metrics,
			trade: updated,
		};
	} catch (error) {
		// Mark as unavailable on error
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
