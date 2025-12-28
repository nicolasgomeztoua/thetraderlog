import { z } from "zod";
import { env } from "@/env";
import {
	type CacheInterval,
	getCacheStats,
	getOHLCForChart,
} from "@/lib/market-data-service";
import { TWELVE_DATA_SYMBOL_MAP } from "@/lib/symbols";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// Use the shared symbol map for Twelve Data API
const SYMBOL_MAP = TWELVE_DATA_SYMBOL_MAP;

// Valid intervals for chart display
const chartIntervalSchema = z.enum([
	"5min",
	"15min",
	"30min",
	"1h",
]) as z.ZodType<CacheInterval>;

interface OHLCBar {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

interface TwelveDataResponse {
	values?: Array<{
		datetime: string;
		open: string;
		high: string;
		low: string;
		close: string;
		volume?: string;
	}>;
	status?: string;
	message?: string;
}

export const marketDataRouter = createTRPCRouter({
	// Get OHLC data for a symbol
	getOHLC: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				interval: z.enum([
					"1min",
					"5min",
					"15min",
					"30min",
					"1h",
					"4h",
					"1day",
				]),
				startDate: z.iso.datetime(),
				endDate: z.iso.datetime(),
			}),
		)
		.query(async ({ input }) => {
			const apiKey = env.TWELVE_DATA_API_KEY;

			if (!apiKey) {
				throw new Error("TWELVE_DATA_API_KEY not configured");
			}

			const mappedSymbol = SYMBOL_MAP[input.symbol] || input.symbol;

			// Convert interval format for Twelve Data
			const intervalMap: Record<string, string> = {
				"1min": "1min",
				"5min": "5min",
				"15min": "15min",
				"30min": "30min",
				"1h": "1h",
				"4h": "4h",
				"1day": "1day",
			};

			const params = new URLSearchParams({
				symbol: mappedSymbol,
				interval: intervalMap[input.interval] || "1h",
				start_date: input.startDate.split("T")[0] ?? "",
				end_date: input.endDate.split("T")[0] ?? "",
				apikey: apiKey,
				format: "JSON",
			});

			const response = await fetch(
				`https://api.twelvedata.com/time_series?${params.toString()}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch market data: ${response.statusText}`);
			}

			const data = (await response.json()) as TwelveDataResponse;

			if (data.status === "error") {
				throw new Error(data.message || "Failed to fetch market data");
			}

			if (!data.values || data.values.length === 0) {
				return { bars: [] };
			}

			// Convert to our format
			const bars: OHLCBar[] = data.values.map((bar) => ({
				timestamp: new Date(bar.datetime).getTime(),
				open: parseFloat(bar.open),
				high: parseFloat(bar.high),
				low: parseFloat(bar.low),
				close: parseFloat(bar.close),
				volume: bar.volume ? parseFloat(bar.volume) : undefined,
			}));

			// Sort by timestamp ascending
			bars.sort((a, b) => a.timestamp - b.timestamp);

			return { bars };
		}),

	// Analyze if price hit a level within a time range
	analyzePriceAction: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				entryTime: z.iso.datetime(),
				exitTime: z.iso.datetime().optional(),
				entryPrice: z.number(),
				exitPrice: z.number().optional(),
				stopLoss: z.number().optional(),
				takeProfit: z.number().optional(),
				direction: z.enum(["long", "short"]),
			}),
		)
		.query(async ({ input }) => {
			const apiKey = env.TWELVE_DATA_API_KEY;

			if (!apiKey) {
				// Return mock analysis if no API key
				return {
					available: false,
					message: "Market data API not configured",
				};
			}

			const mappedSymbol = SYMBOL_MAP[input.symbol] || input.symbol;

			// Fetch 1-hour bars for the trade duration + buffer
			const startDate = new Date(input.entryTime);
			startDate.setHours(startDate.getHours() - 2); // 2 hour buffer before

			const endDate = input.exitTime ? new Date(input.exitTime) : new Date();
			endDate.setHours(endDate.getHours() + 24); // 24 hour buffer after (for post-exit analysis)

			const params = new URLSearchParams({
				symbol: mappedSymbol,
				interval: "1h",
				start_date: startDate.toISOString().split("T")[0] ?? "",
				end_date: endDate.toISOString().split("T")[0] ?? "",
				apikey: apiKey,
				format: "JSON",
			});

			try {
				const response = await fetch(
					`https://api.twelvedata.com/time_series?${params.toString()}`,
				);

				if (!response.ok) {
					return { available: false, message: "Failed to fetch market data" };
				}

				const data = (await response.json()) as TwelveDataResponse;

				if (!data.values || data.values.length === 0) {
					return {
						available: false,
						message: "No market data available for this period",
					};
				}

				const bars = data.values.map((bar) => ({
					timestamp: new Date(bar.datetime).getTime(),
					open: parseFloat(bar.open),
					high: parseFloat(bar.high),
					low: parseFloat(bar.low),
					close: parseFloat(bar.close),
				}));

				// Sort ascending
				bars.sort((a, b) => a.timestamp - b.timestamp);

				const entryTimestamp = new Date(input.entryTime).getTime();
				const exitTimestamp = input.exitTime
					? new Date(input.exitTime).getTime()
					: Date.now();

				// Analyze the trade
				let stopLossWouldHit = false;
				let takeProfitWouldHit = false;
				let maxFavorableExcursion = 0; // Best unrealized profit
				let maxAdverseExcursion = 0; // Worst unrealized loss
				let priceAfterExit: number | null = null;
				let wouldHaveRecovered = false;

				for (const bar of bars) {
					const isBeforeExit = bar.timestamp <= exitTimestamp;
					const isAfterEntry = bar.timestamp >= entryTimestamp;
					const isAfterExit = bar.timestamp > exitTimestamp;

					if (isAfterEntry && isBeforeExit) {
						// During the trade
						if (input.direction === "long") {
							// Check MFE (highest high - entry)
							const favorable = bar.high - input.entryPrice;
							if (favorable > maxFavorableExcursion) {
								maxFavorableExcursion = favorable;
							}
							// Check MAE (entry - lowest low)
							const adverse = input.entryPrice - bar.low;
							if (adverse > maxAdverseExcursion) {
								maxAdverseExcursion = adverse;
							}
							// Check SL hit
							if (input.stopLoss && bar.low <= input.stopLoss) {
								stopLossWouldHit = true;
							}
							// Check TP hit
							if (input.takeProfit && bar.high >= input.takeProfit) {
								takeProfitWouldHit = true;
							}
						} else {
							// Short
							const favorable = input.entryPrice - bar.low;
							if (favorable > maxFavorableExcursion) {
								maxFavorableExcursion = favorable;
							}
							const adverse = bar.high - input.entryPrice;
							if (adverse > maxAdverseExcursion) {
								maxAdverseExcursion = adverse;
							}
							if (input.stopLoss && bar.high >= input.stopLoss) {
								stopLossWouldHit = true;
							}
							if (input.takeProfit && bar.low <= input.takeProfit) {
								takeProfitWouldHit = true;
							}
						}
					}

					// After exit - check if price would have recovered
					if (isAfterExit && input.exitPrice) {
						priceAfterExit = bar.close;

						if (input.direction === "long") {
							// For a losing long that got stopped out, did price go back above entry?
							if (
								input.exitPrice < input.entryPrice &&
								bar.high > input.entryPrice
							) {
								wouldHaveRecovered = true;
							}
						} else {
							// For a losing short, did price go back below entry?
							if (
								input.exitPrice > input.entryPrice &&
								bar.low < input.entryPrice
							) {
								wouldHaveRecovered = true;
							}
						}
					}
				}

				return {
					available: true,
					analysis: {
						stopLossWouldHit,
						takeProfitWouldHit,
						maxFavorableExcursion,
						maxAdverseExcursion,
						wouldHaveRecovered,
						priceAfterExit,
						barsAnalyzed: bars.length,
					},
				};
			} catch (error) {
				console.error("Market data analysis error:", error);
				return { available: false, message: "Failed to analyze market data" };
			}
		}),

	// ============================================================================
	// CACHED DATA ENDPOINTS (uses candle_cache table)
	// ============================================================================

	/**
	 * Get OHLC data for chart display with caching
	 * Fetches from cache first, falls back to API on miss
	 * Designed for trade detail chart component
	 */
	getChartData: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				entryTime: z.iso.datetime(),
				exitTime: z.iso.datetime().optional(),
				interval: chartIntervalSchema.default("15min"),
				contextBefore: z.number().min(0).max(24).default(4), // Hours before entry
				contextAfter: z.number().min(0).max(24).default(2), // Hours after exit
			}),
		)
		.query(async ({ input }) => {
			const exitTime = input.exitTime ? new Date(input.exitTime) : null;

			const { bars, source, dataQuality } = await getOHLCForChart(
				input.symbol,
				input.interval,
				new Date(input.entryTime),
				exitTime,
				input.contextBefore,
				input.contextAfter,
			);

			// Convert timestamps to lightweight-charts format (seconds, not ms)
			const chartBars = bars.map((bar) => ({
				time: Math.floor(bar.timestamp / 1000), // Convert to seconds for lightweight-charts
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
			}));

			return {
				bars: chartBars,
				source,
				dataQuality,
				barCount: chartBars.length,
			};
		}),

	/**
	 * Get cache statistics for monitoring
	 * Useful for admin dashboard or debugging
	 */
	getCacheStats: protectedProcedure.query(async () => {
		const stats = await getCacheStats();
		return stats;
	}),
});
