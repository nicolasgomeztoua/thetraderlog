import { z } from "zod";
import { logger } from "@/lib/logger";
import {
	type CacheInterval,
	getCacheStats,
	getExtendedDayBars,
	getFullDayBars,
	getOHLCForChart,
	getOHLCForTimeRange,
} from "@/lib/market-data/service";
import { analyzePostExit, calculateMAEMFE } from "@/lib/trades";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// Valid intervals for chart display
const chartIntervalSchema = z.enum([
	"1min",
	"5min",
	"15min",
	"30min",
	"1h",
]) as z.ZodType<CacheInterval>;

// Valid intervals including 1min for OHLC data
const ohlcIntervalSchema = z.enum([
	"1min",
	"5min",
	"15min",
	"30min",
	"1h",
	"4h",
]) as z.ZodType<CacheInterval>;

export const marketDataRouter = createTRPCRouter({
	/**
	 * Get OHLC data for a symbol with caching
	 *
	 * Uses the cache-first strategy: checks PostgreSQL cache first,
	 * fetches from API on miss, and caches for future use.
	 *
	 * @deprecated Prefer `getChartData` for trade-specific chart display
	 */
	getOHLC: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				interval: ohlcIntervalSchema,
				startDate: z.iso.datetime(),
				endDate: z.iso.datetime(),
			}),
		)
		.query(async ({ input }) => {
			// Use the cached service instead of direct API call
			const { bars, dataQuality } = await getOHLCForTimeRange(
				input.symbol,
				input.interval,
				new Date(input.startDate),
				new Date(input.endDate),
			);

			return {
				bars,
				dataQuality,
			};
		}),

	/**
	 * Analyze price action for a trade
	 * Uses cached market data and shared calculation functions
	 *
	 * Calculates:
	 * - MAE/MFE (Maximum Adverse/Favorable Excursion)
	 * - Whether SL/TP would have been hit
	 * - Post-exit recovery analysis
	 */
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
			try {
				const entryTime = new Date(input.entryTime);
				const exitTime = input.exitTime ? new Date(input.exitTime) : new Date();

				// Build parallel fetch promises — both time ranges are known upfront
				const tradeBarsFetch = getOHLCForTimeRange(
					input.symbol,
					"1h",
					entryTime,
					exitTime,
				);

				const postExitBarsFetch =
					input.exitTime && input.exitPrice
						? (() => {
								const postExitEnd = new Date(input.exitTime);
								postExitEnd.setHours(postExitEnd.getHours() + 24);
								return getOHLCForTimeRange(
									input.symbol,
									"1h",
									new Date(input.exitTime),
									postExitEnd,
								);
							})()
						: null;

				// Fetch trade bars and post-exit bars in parallel
				const [tradeResult, postExitResult] = await Promise.all([
					tradeBarsFetch,
					postExitBarsFetch,
				]);

				const { bars: tradeBars, dataQuality } = tradeResult;

				if (tradeBars.length === 0) {
					return {
						available: false,
						message: "No market data available for this period",
					};
				}

				// Calculate MAE/MFE using shared function
				// Note: We pass 1 for quantity since we only care about points here
				const maemfe = calculateMAEMFE(
					tradeBars,
					input.entryPrice,
					input.exitPrice ?? input.entryPrice,
					input.direction,
					1, // quantity not relevant for point calculations
					input.symbol,
				);

				// Check SL/TP hit
				let stopLossWouldHit = false;
				let takeProfitWouldHit = false;

				for (const bar of tradeBars) {
					if (input.direction === "long") {
						if (input.stopLoss && bar.low <= input.stopLoss) {
							stopLossWouldHit = true;
						}
						if (input.takeProfit && bar.high >= input.takeProfit) {
							takeProfitWouldHit = true;
						}
					} else {
						if (input.stopLoss && bar.high >= input.stopLoss) {
							stopLossWouldHit = true;
						}
						if (input.takeProfit && bar.low <= input.takeProfit) {
							takeProfitWouldHit = true;
						}
					}
				}

				// Process post-exit data for recovery analysis
				let postExitAnalysis = null;
				if (postExitResult && input.exitPrice) {
					const { bars: postExitBars } = postExitResult;
					if (postExitBars.length > 0) {
						postExitAnalysis = analyzePostExit(
							postExitBars,
							input.exitPrice,
							input.entryPrice,
							input.direction,
						);
					}
				}

				return {
					available: true,
					dataQuality,
					analysis: {
						stopLossWouldHit,
						takeProfitWouldHit,
						maxFavorableExcursion: maemfe.mfePoints,
						maxAdverseExcursion: maemfe.maePoints,
						maePrice: maemfe.maePrice,
						mfePrice: maemfe.mfePrice,
						wouldHaveRecovered: postExitAnalysis?.wouldHaveRecovered ?? false,
						priceAfterExit: postExitAnalysis?.priceAtAnalysisEnd ?? null,
						potentialAdditionalProfit:
							postExitAnalysis?.potentialAdditionalProfit ?? 0,
						barsAnalyzed: tradeBars.length,
					},
				};
			} catch (error) {
				logger.error("Market data analysis failed", error, {
					symbol: input.symbol,
				});
				return { available: false, message: "Failed to analyze market data" };
			}
		}),

	/**
	 * Get OHLC data for chart display with caching
	 * Fetches from cache first, falls back to API on miss
	 * Designed for trade detail chart component
	 *
	 * This is the recommended endpoint for chart data as it:
	 * - Uses the cache-first strategy with cross-user deduplication
	 * - Adds context before/after the trade for better visualization
	 * - Uses Databento for futures market data
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
	 * Get extended range of 1-minute bars for a trade
	 * Fetches 3 calendar days before entry through 3 calendar days after exit
	 * (capped at today), giving ~7 trading sessions of context.
	 * Client can then aggregate to 5min/15min/30min/1h instantly.
	 */
	getFullDayChartData: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				entryTime: z.iso.datetime(),
				exitTime: z.iso.datetime().optional(),
			}),
		)
		.query(async ({ input }) => {
			const exitTime = input.exitTime ? new Date(input.exitTime) : null;

			const { bars, source, dataQuality } = await getFullDayBars(
				input.symbol,
				new Date(input.entryTime),
				exitTime,
			);

			// Convert timestamps to lightweight-charts format (seconds, not ms)
			const chartBars = bars.map((bar) => ({
				time: Math.floor(bar.timestamp / 1000),
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
	 * Get extended date range of 1h bars for a trade
	 * Returns ~7 trading sessions: 3 calendar days before entry through
	 * 3 calendar days after exit (capped at today).
	 * Designed for the 1h timeframe chart view.
	 */
	getExtendedChartData: protectedProcedure
		.input(
			z.object({
				symbol: z.string(),
				entryTime: z.iso.datetime(),
				exitTime: z.iso.datetime().optional(),
			}),
		)
		.query(async ({ input }) => {
			const exitTime = input.exitTime ? new Date(input.exitTime) : null;

			const { bars, source, dataQuality } = await getExtendedDayBars(
				input.symbol,
				new Date(input.entryTime),
				exitTime,
			);

			// Convert timestamps to lightweight-charts format (seconds, not ms)
			const chartBars = bars.map((bar) => ({
				time: Math.floor(bar.timestamp / 1000),
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
