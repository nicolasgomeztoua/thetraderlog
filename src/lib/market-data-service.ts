/**
 * Market Data Service
 *
 * Provides a cache-first approach to fetching OHLC data.
 * - Checks PostgreSQL cache first (candle_cache table)
 * - Fetches from appropriate API on cache miss:
 *   - Databento for futures (CME, NYMEX, COMEX, CBOT)
 *   - Twelve Data for forex, crypto, commodities
 * - Stores fetched data permanently for cross-user reuse
 *
 * Data is cached by symbol + interval + date (normalized to midnight UTC).
 * This allows massive deduplication: if 100 users trade ES on the same day,
 * we only fetch that data once.
 */

import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import {
	getDatabentSymbol,
	isFuturesSymbol,
	TWELVE_DATA_SYMBOL_MAP,
} from "@/lib/symbols";
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
	const LOG_TAG = "[MarketData]";

	console.log(
		`${LOG_TAG} getOHLCBars:`,
		JSON.stringify({
			symbol,
			interval,
			date: dateKey.toISOString(),
		}),
	);

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
		console.log(`${LOG_TAG} CACHE HIT for ${symbol}/${interval}`);
		try {
			const bars = JSON.parse(cached.bars) as OHLCBar[];
			return { bars, source: "cache", dataQuality: "full" };
		} catch {
			// Corrupted cache entry - delete and re-fetch
			console.warn(
				`${LOG_TAG} Corrupted cache entry for ${symbol}/${interval}/${dateKey.toISOString()}`,
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
	} else {
		console.log(`${LOG_TAG} CACHE MISS for ${symbol}/${interval}`);
	}

	// 2. Cache MISS - fetch from appropriate API based on symbol type
	const apiResult = await fetchFromProvider(symbol, interval, dateKey);

	console.log(
		`${LOG_TAG} API fetch result:`,
		JSON.stringify({
			success: apiResult.success,
			barCount: apiResult.bars.length,
			provider: apiResult.provider,
			error: apiResult.error,
		}),
	);

	if (!apiResult.success || apiResult.bars.length === 0) {
		console.log(`${LOG_TAG} Returning unavailable for ${symbol}`);
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
				source: apiResult.provider ?? "unknown",
				fetchedAt: new Date(),
			})
			.onConflictDoNothing(); // Handle race conditions gracefully
		console.log(
			`${LOG_TAG} Cached ${apiResult.bars.length} bars for ${symbol} (source: ${apiResult.provider})`,
		);
	} catch (error) {
		// Log but don't fail - the bars are still valid
		console.error(`${LOG_TAG} Failed to cache OHLC data:`, error);
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
/**
 * Get interval duration in milliseconds
 */
function getIntervalMs(interval: CacheInterval): number {
	const intervalMap: Record<CacheInterval, number> = {
		"1min": 60 * 1000,
		"5min": 5 * 60 * 1000,
		"15min": 15 * 60 * 1000,
		"30min": 30 * 60 * 1000,
		"1h": 60 * 60 * 1000,
		"4h": 4 * 60 * 60 * 1000,
	};
	return intervalMap[interval];
}

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

	// Filter to bars that OVERLAP with the time range
	// A bar overlaps if: barStart < rangeEnd AND barEnd > rangeStart
	const startMs = startTime.getTime();
	const endMs = endTime.getTime();
	const intervalMs = getIntervalMs(interval);

	const filteredBars = allBars.filter((bar) => {
		const barStart = bar.timestamp;
		const barEnd = bar.timestamp + intervalMs;
		// Bar overlaps with range if it starts before range ends AND ends after range starts
		return barStart < endMs && barEnd > startMs;
	});

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
	provider?: "twelve_data" | "databento";
	error?: string;
}

// Log prefix for easy filtering
const LOG_TAG = "[MarketData]";

// =============================================================================
// PROVIDER ROUTING
// =============================================================================

/**
 * Route to the appropriate data provider based on symbol type
 * - Futures → Databento
 * - Forex/Crypto/Commodities → Twelve Data
 */
async function fetchFromProvider(
	symbol: string,
	interval: string,
	date: Date,
): Promise<FetchResult> {
	// Check if this is a futures symbol that Databento supports
	const databentoSymbol = getDatabentSymbol(symbol);

	if (databentoSymbol && isFuturesSymbol(symbol)) {
		console.log(`${LOG_TAG} Routing ${symbol} to Databento (futures)`);
		return fetchFromDatabento(symbol, databentoSymbol, interval, date);
	}

	// Fallback to Twelve Data for forex/crypto/commodities
	console.log(`${LOG_TAG} Routing ${symbol} to Twelve Data (forex/crypto)`);
	return fetchFromTwelveData(symbol, interval, date);
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
	const dateStr = formatDateForAPI(date);

	console.log(
		`${LOG_TAG} fetchFromTwelveData called:`,
		JSON.stringify({ symbol, interval, date: dateStr }),
	);

	if (!apiKey) {
		console.warn(`${LOG_TAG} TWELVE_DATA_API_KEY not configured`);
		return {
			success: false,
			bars: [],
			provider: "twelve_data",
			error: "API key not configured",
		};
	}

	// Map symbol to Twelve Data format
	// Returns null for unsupported symbols (most CME futures)
	const mappedSymbol = TWELVE_DATA_SYMBOL_MAP[symbol];

	console.log(
		`${LOG_TAG} Symbol mapping:`,
		JSON.stringify({
			input: symbol,
			mapped: mappedSymbol,
			isSupported: mappedSymbol !== null,
			isExplicitlyMapped: mappedSymbol !== undefined,
		}),
	);

	if (mappedSymbol === null) {
		// Symbol explicitly not supported by Twelve Data
		console.info(
			`${LOG_TAG} Symbol ${symbol} is NOT SUPPORTED by Twelve Data API (CME futures not available)`,
		);
		return {
			success: false,
			bars: [],
			provider: "twelve_data",
			error: `Symbol ${symbol} not supported by Twelve Data`,
		};
	}

	// Use mapped symbol or fall back to original (for unmapped symbols)
	const apiSymbol = mappedSymbol ?? symbol;

	const params = new URLSearchParams({
		symbol: apiSymbol,
		interval,
		start_date: dateStr,
		end_date: dateStr,
		apikey: apiKey,
		format: "JSON",
	});

	const url = `https://api.twelvedata.com/time_series?${params.toString().replace(apiKey, "***")}`;
	console.log(`${LOG_TAG} API Request:`, url);

	try {
		const response = await fetch(
			`https://api.twelvedata.com/time_series?${params.toString()}`,
		);

		console.log(
			`${LOG_TAG} API Response status:`,
			response.status,
			response.statusText,
		);

		if (!response.ok) {
			console.error(
				`${LOG_TAG} Twelve Data API HTTP error: ${response.status}`,
			);
			return {
				success: false,
				bars: [],
				provider: "twelve_data",
				error: `API returned ${response.status}`,
			};
		}

		const data = (await response.json()) as TwelveDataResponse;

		console.log(
			`${LOG_TAG} API Response:`,
			JSON.stringify({
				status: data.status,
				message: data.message,
				valueCount: data.values?.length ?? 0,
			}),
		);

		if (data.status === "error") {
			console.error(
				`${LOG_TAG} Twelve Data API Error Response: ${data.message}`,
			);
			return {
				success: false,
				bars: [],
				provider: "twelve_data",
				error: data.message,
			};
		}

		if (!data.values || data.values.length === 0) {
			console.log(
				`${LOG_TAG} No data returned from Twelve Data for ${apiSymbol} on ${dateStr} (weekend/holiday?)`,
			);
			return { success: true, bars: [], provider: "twelve_data" };
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

		console.log(
			`${LOG_TAG} SUCCESS: Fetched ${bars.length} bars from Twelve Data for ${apiSymbol}`,
		);
		return { success: true, bars, provider: "twelve_data" };
	} catch (error) {
		console.error(`${LOG_TAG} Twelve Data fetch exception:`, error);
		return {
			success: false,
			bars: [],
			provider: "twelve_data",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// =============================================================================
// DATABENTO API (Futures)
// =============================================================================

/**
 * Map our interval format to Databento schema
 * Databento uses ohlcv-1m, ohlcv-5m, etc.
 */
function mapIntervalToDatabento(interval: string): string {
	const mapping: Record<string, string> = {
		"1min": "ohlcv-1m",
		"5min": "ohlcv-1m", // Databento doesn't have 5min, we'll aggregate from 1min
		"15min": "ohlcv-1m", // Same - aggregate from 1min
		"30min": "ohlcv-1m", // Same
		"1h": "ohlcv-1h",
		"4h": "ohlcv-1h", // Aggregate from 1h
	};
	return mapping[interval] ?? "ohlcv-1m";
}

/**
 * Aggregate 1-minute bars to larger intervals
 */
function aggregateBars(bars: OHLCBar[], targetInterval: string): OHLCBar[] {
	if (targetInterval === "1min") return bars;

	const intervalMinutes: Record<string, number> = {
		"5min": 5,
		"15min": 15,
		"30min": 30,
		"1h": 60,
		"4h": 240,
	};

	const minutes = intervalMinutes[targetInterval];
	if (!minutes || bars.length === 0) return bars;

	const aggregated: OHLCBar[] = [];
	const msPerInterval = minutes * 60 * 1000;

	let currentBucket: OHLCBar | null = null;
	let bucketStart = 0;

	for (const bar of bars) {
		const barBucketStart =
			Math.floor(bar.timestamp / msPerInterval) * msPerInterval;

		if (currentBucket === null || barBucketStart !== bucketStart) {
			// Start new bucket
			if (currentBucket) {
				aggregated.push(currentBucket);
			}
			bucketStart = barBucketStart;
			currentBucket = {
				timestamp: barBucketStart,
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
				volume: bar.volume,
			};
		} else {
			// Update current bucket
			currentBucket.high = Math.max(currentBucket.high, bar.high);
			currentBucket.low = Math.min(currentBucket.low, bar.low);
			currentBucket.close = bar.close;
			if (bar.volume !== undefined && currentBucket.volume !== undefined) {
				currentBucket.volume += bar.volume;
			}
		}
	}

	if (currentBucket) {
		aggregated.push(currentBucket);
	}

	return aggregated;
}

/**
 * Fetch OHLC data from Databento API for futures
 */
async function fetchFromDatabento(
	originalSymbol: string,
	databentoSymbol: string,
	interval: string,
	date: Date,
): Promise<FetchResult> {
	const apiKey = env.DATABENTO_API_KEY;
	const dateStr = formatDateForAPI(date);

	console.log(
		`${LOG_TAG} fetchFromDatabento called:`,
		JSON.stringify({
			originalSymbol,
			databentoSymbol,
			interval,
			date: dateStr,
		}),
	);

	if (!apiKey) {
		console.warn(`${LOG_TAG} DATABENTO_API_KEY not configured`);
		return {
			success: false,
			bars: [],
			provider: "databento",
			error: "Databento API key not configured",
		};
	}

	// Calculate start and end times for the full trading day
	// CME Globex trading hours are roughly 17:00 CT to 16:00 CT next day
	const startTime = new Date(date);
	startTime.setUTCHours(0, 0, 0, 0);

	const endTime = new Date(date);
	endTime.setUTCHours(23, 59, 59, 999);

	const schema = mapIntervalToDatabento(interval);

	// Databento Historical API endpoint
	// stype_in=continuous for continuous contract symbols like ES.v.0
	const params = new URLSearchParams({
		dataset: "GLBX.MDP3",
		symbols: databentoSymbol,
		schema: schema,
		start: startTime.toISOString(),
		end: endTime.toISOString(),
		encoding: "json",
		stype_in: "continuous",
	});

	const url = `https://hist.databento.com/v0/timeseries.get_range?${params.toString()}`;
	console.log(`${LOG_TAG} Databento API Request:`, url.replace(apiKey, "***"));

	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
			},
		});

		console.log(
			`${LOG_TAG} Databento API Response status:`,
			response.status,
			response.statusText,
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`${LOG_TAG} Databento API HTTP error: ${response.status}`,
				errorText,
			);
			return {
				success: false,
				bars: [],
				provider: "databento",
				error: `Databento API returned ${response.status}: ${errorText}`,
			};
		}

		// Databento returns newline-delimited JSON (NDJSON)
		const text = await response.text();

		// Debug: Log first 500 chars of response to see format
		console.log(
			`${LOG_TAG} Databento response preview (first 500 chars):`,
			text.substring(0, 500),
		);
		console.log(`${LOG_TAG} Response length: ${text.length} bytes`);

		if (!text.trim()) {
			console.log(
				`${LOG_TAG} No data returned from Databento for ${databentoSymbol} on ${dateStr} (weekend/holiday?)`,
			);
			return { success: true, bars: [], provider: "databento" };
		}

		// Parse NDJSON - each line is a separate JSON object
		const lines = text.trim().split("\n");
		console.log(`${LOG_TAG} Number of lines in response: ${lines.length}`);

		const bars: OHLCBar[] = [];

		// Log first record to understand structure
		if (lines.length > 0 && lines[0]?.trim()) {
			console.log(
				`${LOG_TAG} First record sample:`,
				lines[0].substring(0, 500),
			);
		}

		for (const line of lines) {
			if (!line.trim()) continue;

			try {
				const record = JSON.parse(line) as Record<string, unknown>;

				// Databento OHLCV records have timestamp in the "hd" (header) object
				// Structure: { hd: { ts_event: nanoseconds }, open, high, low, close, volume }
				const hd = record.hd as { ts_event?: number } | undefined;
				const ts_event = hd?.ts_event;
				const open = record.open as number | undefined;
				const high = record.high as number | undefined;
				const low = record.low as number | undefined;
				const close = record.close as number | undefined;
				const volume = record.volume as number | undefined;

				if (ts_event && open !== undefined) {
					// Databento uses fixed-point prices with 9 decimal places (divide by 1 billion)
					// Timestamps are in nanoseconds (divide by 1 million to get milliseconds)
					bars.push({
						timestamp: Math.floor(ts_event / 1_000_000),
						open: open / 1_000_000_000,
						high:
							high !== undefined ? high / 1_000_000_000 : open / 1_000_000_000,
						low: low !== undefined ? low / 1_000_000_000 : open / 1_000_000_000,
						close:
							close !== undefined
								? close / 1_000_000_000
								: open / 1_000_000_000,
						volume: volume,
					});
				}
			} catch {
				console.warn(
					`${LOG_TAG} Failed to parse Databento record:`,
					line.substring(0, 200),
				);
			}
		}

		// Debug: Log sample bar if we have any
		if (bars.length > 0) {
			console.log(`${LOG_TAG} Sample parsed bar:`, JSON.stringify(bars[0]));
		}

		// Sort by timestamp ascending
		bars.sort((a, b) => a.timestamp - b.timestamp);

		// Aggregate to target interval if needed
		const aggregatedBars = aggregateBars(bars, interval);

		console.log(
			`${LOG_TAG} SUCCESS: Fetched ${bars.length} raw bars, aggregated to ${aggregatedBars.length} ${interval} bars for ${databentoSymbol}`,
		);

		return { success: true, bars: aggregatedBars, provider: "databento" };
	} catch (error) {
		console.error(`${LOG_TAG} Databento fetch exception:`, error);
		return {
			success: false,
			bars: [],
			provider: "databento",
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
