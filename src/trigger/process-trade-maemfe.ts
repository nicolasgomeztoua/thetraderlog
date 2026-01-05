import { task } from "@trigger.dev/sdk/v3";
import { calculateAndStoreMAEMFE } from "@/lib/market-data/maemfe";

const LOG_TAG = "[Trigger:MAE/MFE]";

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
		console.log(
			`${LOG_TAG} Processing trade ${payload.tradeId} for user ${payload.userId}`,
		);

		const result = await calculateAndStoreMAEMFE(payload.tradeId, {
			skipAlreadyProcessed: true,
			logTag: LOG_TAG,
		});

		if (result.success) {
			console.log(
				`${LOG_TAG} SUCCESS: Stored MAE/MFE for trade ${payload.tradeId}`,
			);
		} else {
			console.log(
				`${LOG_TAG} SKIPPED: Trade ${payload.tradeId} - ${result.message}`,
			);
		}

		return {
			tradeId: payload.tradeId,
			success: result.success,
			message: result.message,
			dataQuality: result.dataQuality,
		};
	},
});
