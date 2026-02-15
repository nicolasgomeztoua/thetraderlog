import { MAX_MARKET_DATA_BARS } from "@/lib/constants/ai";
import {
	type CacheInterval,
	getOHLCForTimeRange,
} from "@/lib/market-data/service";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BARS = MAX_MARKET_DATA_BARS;

const VALID_INTERVALS = new Set<string>([
	"1min",
	"5min",
	"15min",
	"30min",
	"1h",
	"4h",
]);

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeGetMarketData(
	symbol: string,
	interval: string,
	startDate: string,
	endDate: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	// Validate interval
	if (!VALID_INTERVALS.has(interval)) {
		return {
			success: false,
			error: `Invalid interval "${interval}". Must be one of: 1min, 5min, 15min, 30min, 1h, 4h.`,
		};
	}

	// Parse dates
	const start = new Date(startDate);
	const end = new Date(endDate);

	if (Number.isNaN(start.getTime())) {
		return {
			success: false,
			error: `Invalid startDate "${startDate}". Use ISO 8601 format (e.g., "2026-01-15T09:30:00Z").`,
		};
	}

	if (Number.isNaN(end.getTime())) {
		return {
			success: false,
			error: `Invalid endDate "${endDate}". Use ISO 8601 format (e.g., "2026-01-15T16:00:00Z").`,
		};
	}

	if (end <= start) {
		return {
			success: false,
			error: "endDate must be after startDate.",
		};
	}

	try {
		const result = await getOHLCForTimeRange(
			symbol,
			interval as CacheInterval,
			start,
			end,
		);

		// Limit to MAX_BARS
		const bars = result.bars.slice(0, MAX_BARS);

		return {
			success: true,
			data: {
				symbol,
				interval,
				startDate,
				endDate,
				barCount: bars.length,
				dataQuality: result.dataQuality,
				bars: bars.map((bar) => ({
					timestamp: new Date(bar.timestamp).toISOString(),
					open: bar.open,
					high: bar.high,
					low: bar.low,
					close: bar.close,
					volume: bar.volume,
				})),
			},
		};
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Unknown error fetching market data";
		return {
			success: false,
			error: `Market data error: ${message}`,
		};
	}
}
