import { schedules } from "@trigger.dev/sdk/v3";
import { prefetchMarketDataForAllSymbols } from "@/lib/market-data/prefetch";

/**
 * Daily Market Data Pre-Fetch
 *
 * Runs at 1:00 AM UTC every day. Discovers all distinct symbols from the trades
 * table and pre-fetches the previous day's 1min and 1h OHLC bars so chart data
 * is always available — even before anyone opens a trade detail page.
 */
export const dailyMarketDataPrefetch = schedules.task({
	id: "daily-market-data-prefetch",
	cron: "0 1 * * *",
	// Limit concurrency to avoid Databento API rate limits
	queue: {
		concurrencyLimit: 10,
	},
	run: async () => {
		const result = await prefetchMarketDataForAllSymbols();

		console.info(
			`[daily-prefetch] Complete: ${result.total} symbols — ${result.successes} cached, ${result.skipped} skipped, ${result.failures} failed`,
		);

		return result;
	},
});
