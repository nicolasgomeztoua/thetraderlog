/**
 * Market Data Service
 *
 * Provides a cache-first approach to fetching OHLC data.
 * - Checks PostgreSQL cache first (candle_cache table)
 * - Fetches from Twelve Data API on cache miss
 * - Stores fetched data permanently for cross-user reuse
 *
 * Data is cached by symbol + interval + date (normalized to midnight UTC).
 * This allows massive deduplication: if 100 users trade ES on the same day,
 * we only fetch that data once.
 */

import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import { TWELVE_DATA_SYMBOL_MAP } from "@/lib/symbols";
import { db } from "@/server/db";
import { candleCache } from "@/server/db/schema";

// =============================================================================
// TYPES
// =============================================================================

export interface OHLCBar {
	timestamp: number; // Unix timestamp in milliseconds
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

export type DataQuality = "full" | "partial" | "unavailable" | "pending";

export interface CacheResult {
	bars: OHLCBar[];
	source: "cache" | "api";
	dataQuality: DataQuality;
}

export type CacheInterval = "1min" | "5min" | "15min" | "30min" | "1h" | "4h";

interface TwelveDataBar {
	datetime: string;
	open: string;
	high: string;
	low: string;
	close: string;
	volume?: string;
}

interface TwelveDataResponse {
	values?: TwelveDataBar[];
	status?: string;
	message?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize a date to midnight UTC (start of day)
 * This is our cache key granularity
 */
function normalizeDateToUTC(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

/**
 * Format date for Twelve Data API (YYYY-MM-DD)
 */
function formatDateForAPI(date: Date): string {
	return date.toISOString().split("T")[0] ?? "";
}

// =============================================================================
// CORE CACHE FUNCTIONS
// =============================================================================

/**
 * Get OHLC bars for a specific symbol, interval, and date.
 * Uses cache-first strategy: checks DB cache, fetches from API on miss.
 *
 * @param symbol - Trading symbol (e.g., "ES", "MNQ", "EUR/USD")
 * @param interval - Bar interval (e.g., "5min", "15min", "1h")
 * @param date - The date to fetch data for (will be normalized to midnight UTC)
 * @returns CacheResult with bars and metadata
 */
export async function getOHLCBars(
	symbol: string,
	interval: CacheInterval,
	date: Date,
): Promise<CacheResult> {
	const dateKey = normalizeDateToUTC(date);

	// 1. Check cache first
	const cached = await db.query.candleCache.findFirst({
		where: and(
			eq(candleCache.symbol, symbol),
			eq(candleCache.interval, interval),
			eq(candleCache.date, dateKey),
		),
	});

	if (cached) {
		// Cache HIT - parse and return
		try {
			const bars = JSON.parse(cached.bars) as OHLCBar[];
			return { bars, source: "cache", dataQuality: "full" };
		} catch {
			// Corrupted cache entry - delete and re-fetch
			console.warn(
				`Corrupted cache entry for ${symbol}/${interval}/${dateKey.toISOString()}`,
			);
			await db
				.delete(candleCache)
				.where(
					and(
						eq(candleCache.symbol, symbol),
						eq(candleCache.interval, interval),
						eq(candleCache.date, dateKey),
					),
				);
		}
	}

	// 2. Cache MISS - fetch from API
	const apiResult = await fetchFromTwelveData(symbol, interval, dateKey);

	if (!apiResult.success || apiResult.bars.length === 0) {
		return { bars: [], source: "api", dataQuality: "unavailable" };
	}

	// 3. Store in cache for future use
	try {
		await db
			.insert(candleCache)
			.values({
				symbol,
				interval,
				date: dateKey,
				bars: JSON.stringify(apiResult.bars),
				barCount: apiResult.bars.length,
				source: "twelve_data",
				fetchedAt: new Date(),
			})
			.onConflictDoNothing(); // Handle race conditions gracefully
	} catch (error) {
		// Log but don't fail - the bars are still valid
		console.error("Failed to cache OHLC data:", error);
	}

	return {
		bars: apiResult.bars,
		source: "api",
		dataQuality: "full",
	};
}

/**
 * Get OHLC bars for a time range (e.g., trade duration).
 * Handles trades that span multiple days by fetching each day and combining.
 *
 * @param symbol - Trading symbol
 * @param interval - Bar interval
 * @param startTime - Start of time range
 * @param endTime - End of time range
 * @returns Combined bars filtered to the exact time range
 */
export async function getOHLCForTimeRange(
	symbol: string,
	interval: CacheInterval,
	startTime: Date,
	endTime: Date,
): Promise<CacheResult> {
	// Get unique dates in the range
	const dates: Date[] = [];
	const current = new Date(startTime);
	current.setUTCHours(0, 0, 0, 0);

	const endDate = new Date(endTime);
	endDate.setUTCHours(0, 0, 0, 0);

	while (current <= endDate) {
		dates.push(new Date(current));
		current.setUTCDate(current.getUTCDate() + 1);
	}

	// Fetch all days (in parallel for speed)
	const results = await Promise.all(
		dates.map((date) => getOHLCBars(symbol, interval, date)),
	);

	// Combine all bars
	const allBars = results.flatMap((r) => r.bars);

	// Filter to exact time range
	const startMs = startTime.getTime();
	const endMs = endTime.getTime();
	const filteredBars = allBars.filter(
		(bar) => bar.timestamp >= startMs && bar.timestamp <= endMs,
	);

	// Sort by timestamp (parallel fetches might return out of order)
	filteredBars.sort((a, b) => a.timestamp - b.timestamp);

	// Determine overall data quality
	const anyFromApi = results.some((r) => r.source === "api");
	const anyUnavailable = results.some((r) => r.dataQuality === "unavailable");
	const allUnavailable = results.every((r) => r.dataQuality === "unavailable");

	let dataQuality: DataQuality = "full";
	if (allUnavailable) {
		dataQuality = "unavailable";
	} else if (anyUnavailable) {
		dataQuality = "partial";
	}

	return {
		bars: filteredBars,
		source: anyFromApi ? "api" : "cache",
		dataQuality,
	};
}

/**
 * Get OHLC bars for chart display with extended context.
 * Fetches data before entry and after exit for visual context.
 *
 * @param symbol - Trading symbol
 * @param interval - Bar interval (typically "15min" or "1h" for charts)
 * @param entryTime - Trade entry time
 * @param exitTime - Trade exit time (or current time if still open)
 * @param contextBefore - Hours of context before entry (default: 4)
 * @param contextAfter - Hours of context after exit (default: 2)
 */
export async function getOHLCForChart(
	symbol: string,
	interval: CacheInterval,
	entryTime: Date,
	exitTime: Date | null,
	contextBefore = 4,
	contextAfter = 2,
): Promise<CacheResult> {
	const start = new Date(entryTime);
	start.setHours(start.getHours() - contextBefore);

	const end = exitTime ? new Date(exitTime) : new Date();
	end.setHours(end.getHours() + contextAfter);

	return getOHLCForTimeRange(symbol, interval, start, end);
}

// =============================================================================
// TWELVE DATA API
// =============================================================================

interface FetchResult {
	success: boolean;
	bars: OHLCBar[];
	error?: string;
}

/**
 * Fetch OHLC data from Twelve Data API
 */
async function fetchFromTwelveData(
	symbol: string,
	interval: string,
	date: Date,
): Promise<FetchResult> {
	const apiKey = env.TWELVE_DATA_API_KEY;

	if (!apiKey) {
		console.warn("TWELVE_DATA_API_KEY not configured");
		return { success: false, bars: [], error: "API key not configured" };
	}

	// Map symbol to Twelve Data format (e.g., "ES" -> "ES1!")
	const mappedSymbol = TWELVE_DATA_SYMBOL_MAP[symbol] || symbol;
	const dateStr = formatDateForAPI(date);

	const params = new URLSearchParams({
		symbol: mappedSymbol,
		interval,
		start_date: dateStr,
		end_date: dateStr,
		apikey: apiKey,
		format: "JSON",
	});

	try {
		const response = await fetch(
			`https://api.twelvedata.com/time_series?${params.toString()}`,
		);

		if (!response.ok) {
			console.error(`Twelve Data API error: ${response.status}`);
			return {
				success: false,
				bars: [],
				error: `API returned ${response.status}`,
			};
		}

		const data = (await response.json()) as TwelveDataResponse;

		if (data.status === "error") {
			console.error(`Twelve Data API error: ${data.message}`);
			return { success: false, bars: [], error: data.message };
		}

		if (!data.values || data.values.length === 0) {
			// No data for this date (weekend, holiday, etc.)
			return { success: true, bars: [] };
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

		return { success: true, bars };
	} catch (error) {
		console.error("Twelve Data fetch error:", error);
		return {
			success: false,
			bars: [],
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Check if we have cached data for a specific symbol/interval/date
 * Useful for checking availability without fetching
 */
export async function hasCachedData(
	symbol: string,
	interval: CacheInterval,
	date: Date,
): Promise<boolean> {
	const dateKey = normalizeDateToUTC(date);

	const cached = await db.query.candleCache.findFirst({
		columns: { id: true },
		where: and(
			eq(candleCache.symbol, symbol),
			eq(candleCache.interval, interval),
			eq(candleCache.date, dateKey),
		),
	});

	return cached !== undefined;
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
	totalEntries: number;
	uniqueSymbols: number;
	oldestEntry: Date | null;
	newestEntry: Date | null;
}> {
	const result = await db.query.candleCache.findMany({
		columns: { symbol: true, date: true },
	});

	if (result.length === 0) {
		return {
			totalEntries: 0,
			uniqueSymbols: 0,
			oldestEntry: null,
			newestEntry: null,
		};
	}

	const symbols = new Set(result.map((r) => r.symbol));
	const dates = result.map((r) => r.date);
	dates.sort((a, b) => a.getTime() - b.getTime());

	return {
		totalEntries: result.length,
		uniqueSymbols: symbols.size,
		oldestEntry: dates[0] ?? null,
		newestEntry: dates[dates.length - 1] ?? null,
	};
}
