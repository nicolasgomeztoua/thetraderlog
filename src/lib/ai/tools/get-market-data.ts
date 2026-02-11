import type { ToolDefinition } from "@/lib/ai/client";
import {
	type CacheInterval,
	getOHLCForTimeRange,
} from "@/lib/market-data/service";

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const getMarketDataToolDefinition: ToolDefinition = {
	type: "function",
	function: {
		name: "get_market_data",
		description:
			"Fetch OHLC (Open, High, Low, Close) candle data for a specific trading symbol and time range. " +
			"Supports futures symbols (ES, NQ, MNQ, MES, CL, GC, etc.) and forex pairs (EUR/USD, GBP/USD, etc.). " +
			"Data is fetched from Databento (futures) or Twelve Data (forex) with automatic caching. " +
			"Available intervals: 1min, 5min, 15min, 30min, 1h, 4h. " +
			"Use this tool to analyze price action around specific trades or time periods. " +
			"Results are limited to 1000 bars. For large date ranges, use a larger interval (e.g., 1h or 4h).",
		parameters: {
			type: "object",
			properties: {
				symbol: {
					type: "string",
					description:
						'Trading symbol (e.g., "ES", "NQ", "MNQ", "EUR/USD", "GBP/JPY"). ' +
						"Futures symbols use short codes (ES, NQ, CL, GC). " +
						"Forex pairs use slash format (EUR/USD, GBP/JPY).",
				},
				interval: {
					type: "string",
					enum: ["1min", "5min", "15min", "30min", "1h", "4h"],
					description:
						"Bar interval. Use smaller intervals (1min, 5min) for intraday analysis and larger (1h, 4h) for multi-day ranges.",
				},
				startDate: {
					type: "string",
					description:
						'Start date/time in ISO 8601 format (e.g., "2026-01-15T09:30:00Z" or "2026-01-15").',
				},
				endDate: {
					type: "string",
					description:
						'End date/time in ISO 8601 format (e.g., "2026-01-15T16:00:00Z" or "2026-01-15").',
				},
			},
			required: ["symbol", "interval", "startDate", "endDate"],
		},
	},
};

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BARS = 1000;

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
