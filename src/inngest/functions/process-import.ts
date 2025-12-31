import { eq } from "drizzle-orm";
import { getOHLCForTimeRange } from "@/lib/market-data-service";
import { calculateMAEMFE } from "@/lib/trade-calculations";
import { db } from "@/server/db";
import { trades } from "@/server/db/schema";
import { inngest } from "../client";

const LOG_TAG = "[Inngest:ProcessImport]";

/**
 * Calculate and store MAE/MFE for a single trade
 * Extracted logic that can be used by both Inngest and the existing tRPC mutation
 */
async function calculateAndStoreMAEMFE(tradeId: number): Promise<{
	success: boolean;
	dataQuality: "full" | "partial" | "unavailable" | "pending";
}> {
	console.log(`${LOG_TAG} Processing trade ${tradeId}`);

	// Get the trade
	const trade = await db.query.trades.findFirst({
		where: eq(trades.id, tradeId),
	});

	if (!trade) {
		console.error(`${LOG_TAG} Trade ${tradeId} not found`);
		return { success: false, dataQuality: "unavailable" };
	}

	// Skip if not closed or already processed
	if (trade.status !== "closed" || !trade.exitTime || !trade.exitPrice) {
		console.log(`${LOG_TAG} Trade ${tradeId} is not closed, skipping`);
		return { success: false, dataQuality: "unavailable" };
	}

	if (trade.marketDataQuality && trade.marketDataQuality !== "pending") {
		console.log(`${LOG_TAG} Trade ${tradeId} already processed, skipping`);
		return { success: true, dataQuality: trade.marketDataQuality };
	}

	// Mark as pending
	await db
		.update(trades)
		.set({ marketDataQuality: "pending" })
		.where(eq(trades.id, tradeId));

	try {
		// Fetch market data
		console.log(
			`${LOG_TAG} Fetching OHLC for ${trade.symbol} from ${trade.entryTime.toISOString()} to ${trade.exitTime.toISOString()}`,
		);

		const { bars, dataQuality } = await getOHLCForTimeRange(
			trade.symbol,
			"1min",
			trade.entryTime,
			trade.exitTime,
		);

		if (bars.length === 0) {
			console.log(
				`${LOG_TAG} No bars for trade ${tradeId}, marking unavailable`,
			);
			await db
				.update(trades)
				.set({ marketDataQuality: "unavailable" })
				.where(eq(trades.id, tradeId));
			return { success: false, dataQuality: "unavailable" };
		}

		// Calculate MAE/MFE
		const metrics = calculateMAEMFE(
			bars,
			parseFloat(trade.entryPrice),
			parseFloat(trade.exitPrice),
			trade.direction,
			parseFloat(trade.quantity),
			trade.symbol,
			trade.instrumentType,
		);

		// Store results
		await db
			.update(trades)
			.set({
				maePrice: metrics.maePrice.toString(),
				mfePrice: metrics.mfePrice.toString(),
				maeAmount: metrics.maeAmount.toFixed(2),
				mfeAmount: metrics.mfeAmount.toFixed(2),
				tradeEfficiency: metrics.efficiency.toFixed(2),
				marketDataQuality: dataQuality,
			})
			.where(eq(trades.id, tradeId));

		console.log(`${LOG_TAG} Successfully processed trade ${tradeId}`);
		return { success: true, dataQuality };
	} catch (error) {
		console.error(
			`${LOG_TAG} Error processing trade ${tradeId}:`,
			error instanceof Error ? error.message : error,
		);
		await db
			.update(trades)
			.set({ marketDataQuality: "unavailable" })
			.where(eq(trades.id, tradeId));
		return { success: false, dataQuality: "unavailable" };
	}
}

/**
 * Inngest function to process imported trades and calculate MAE/MFE
 * Uses step.run for each trade to enable checkpointing and retries
 */
export const processImport = inngest.createFunction(
	{
		id: "process-import",
		retries: 3,
		// Throttle to avoid rate limiting on market data APIs
		throttle: {
			limit: 10,
			period: "1m",
		},
	},
	{ event: "import/process" },
	async ({ event, step }) => {
		const { tradeIds, userId } = event.data;

		console.log(
			`${LOG_TAG} Starting import processing for user ${userId} with ${tradeIds.length} trades`,
		);

		let successCount = 0;
		let failedCount = 0;

		// Process each trade with step.run for checkpointing
		// This means if the function fails, it can resume from where it left off
		for (const tradeId of tradeIds) {
			const result = await step.run(`process-trade-${tradeId}`, async () => {
				return calculateAndStoreMAEMFE(tradeId);
			});

			if (result.success) {
				successCount++;
			} else {
				failedCount++;
			}
		}

		console.log(
			`${LOG_TAG} Completed: ${successCount} success, ${failedCount} failed`,
		);

		return {
			processed: tradeIds.length,
			success: successCount,
			failed: failedCount,
		};
	},
);
