import { logger, task } from "@trigger.dev/sdk/v3";
import { and, eq, inArray } from "drizzle-orm";
import { MAEMFE_COMPUTE_CONCURRENCY } from "@/lib/constants/market-data";
import { calculateAndStoreMAEMFE } from "@/lib/market-data/maemfe";
import {
	collectSymbolDays,
	mapWithConcurrency,
	warmCandleCache,
} from "@/lib/market-data/warm-cache";
import { db } from "@/server/db";
import { trades } from "@/server/db/schema";

/**
 * Per-import MAE/MFE orchestrator.
 *
 * One run per batch import (instead of one run per trade): it dedupes the
 * import down to unique symbol-days, warms the candle cache at Databento's
 * effective concurrency, then computes MAE/MFE for each trade as cheap cache
 * reads. Re-runs are safe — warmed days are cache hits and already-processed
 * trades are skipped via skipAlreadyProcessed.
 */
export const processImportMAEMFE = task({
	id: "process-import-maemfe",
	// One import at a time: Databento serves ~2 concurrent historical requests
	// per key and queues the rest server-side, so parallel imports would only
	// wait on each other inside the provider's queue.
	queue: {
		concurrencyLimit: 1,
	},
	// Each unique symbol-day costs one provider fetch (~5-10s); large imports
	// need well beyond the 300s project default.
	maxDuration: 1800,
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 10000,
	},
	run: async (payload: { tradeIds: string[]; userId: string }) => {
		if (payload.tradeIds.length === 0) {
			return { processed: 0, succeeded: 0, failed: 0 };
		}

		const importTrades = await db.query.trades.findMany({
			columns: { id: true, symbol: true, entryTime: true, exitTime: true },
			where: and(
				inArray(trades.id, payload.tradeIds),
				eq(trades.status, "closed"),
			),
		});

		const symbolDays = collectSymbolDays(importTrades);
		logger.info("Warming candle cache", {
			trades: importTrades.length,
			uniqueSymbolDays: symbolDays.length,
		});

		const warmSummary = await warmCandleCache(symbolDays);
		logger.info("Candle cache warmed", { ...warmSummary });

		const results = await mapWithConcurrency(
			importTrades,
			MAEMFE_COMPUTE_CONCURRENCY,
			(trade) =>
				calculateAndStoreMAEMFE(trade.id, { skipAlreadyProcessed: true }),
		);

		const succeeded = results.filter((r) => r.success).length;
		return {
			processed: results.length,
			succeeded,
			failed: results.length - succeeded,
			cacheWarming: warmSummary,
		};
	},
});
