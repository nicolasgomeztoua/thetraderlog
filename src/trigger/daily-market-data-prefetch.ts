import { schedules } from "@trigger.dev/sdk/v3";
import { MARKET_DATA_BACKFILL_CRON } from "@/lib/constants/market-data";
import { prefetchMarketDataForAllSymbols } from "@/lib/market-data/prefetch";

/**
 * Daily Market Data Pre-Fetch
 *
 * Runs at 11:00 UTC every day. Discovers all distinct symbols from the trades
 * table and pre-fetches the previous day's 1min and 1h OHLC bars so chart data
 * is always available — even before anyone opens a trade detail page.
 *
 * IMPORTANT: this must run AFTER Databento's ~09:00 UTC daily release of the
 * prior session (see MARKET_DATA_BACKFILL_CRON). The previous 01:00 UTC schedule
 * fetched "yesterday" before Databento had published it, so the backfill
 * silently warmed nothing.
 */
export const dailyMarketDataPrefetch = schedules.task({
	id: "daily-market-data-prefetch",
	cron: MARKET_DATA_BACKFILL_CRON,
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
