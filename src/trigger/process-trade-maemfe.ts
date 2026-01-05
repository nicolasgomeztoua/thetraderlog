import { task } from "@trigger.dev/sdk/v3";
import { calculateAndStoreMAEMFE } from "@/lib/market-data/maemfe";

export const processTradeMAEMFE = task({
	id: "process-trade-maemfe",
	// Limit concurrency to avoid API rate limits (Databento, Twelve Data)
	queue: {
		concurrencyLimit: 10,
	},
	retry: {
		maxAttempts: 3,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 10000,
	},
	run: async (payload: { tradeId: string; userId: string }) => {
		const result = await calculateAndStoreMAEMFE(payload.tradeId, {
			skipAlreadyProcessed: true,
		});

		return {
			tradeId: payload.tradeId,
			success: result.success,
			message: result.message,
			dataQuality: result.dataQuality,
		};
	},
});
