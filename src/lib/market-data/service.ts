/**
 * Market Data Service
 *
 * Provides a cache-first approach to fetching OHLC data.
 * - Checks PostgreSQL cache first (candle_cache table)
 * - Fetches from Databento on cache miss (CME, NYMEX, COMEX, CBOT)
 * - Stores fetched data permanently for cross-user reuse
 *
 * Data is cached by symbol + interval + date (normalized to midnight UTC).
 * This allows massive deduplication: if 100 users trade ES on the same day,
 * we only fetch that data once.
 */

import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import {
	DATABENTO_RELEASE_BUFFER_HOURS,
	DATABENTO_RELEASE_HOUR_UTC,
} from "@/lib/constants/market-data";
import { db } from "@/server/db";
import { candleCache } from "@/server/db/schema";
import { getDatabentSymbol, isFuturesSymbol } from "./symbols";

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

/** Intervals that are actually stored in candle_cache (fetched from Databento) */
export type BaseInterval = "1min" | "1h";

/**
 * Map a requested interval to its base interval for cache storage.
 * 5min/15min/30min derive from 1min; 4h derives from 1h.
 */
function getBaseInterval(interval: CacheInterval): BaseInterval {
	if (interval === "1h" || interval === "4h") return "1h";
	return "1min";
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

// =============================================================================
// CORE CACHE FUNCTIONS
// =============================================================================

/**
 * Check if a date is today in UTC
 */
export function isToday(date: Date): boolean {
	const now = new Date();
	return (
		date.getUTCFullYear() === now.getUTCFullYear() &&
		date.getUTCMonth() === now.getUTCMonth() &&
		date.getUTCDate() === now.getUTCDate()
	);
}

/**
 * Whether Databento has likely not yet published the session for `dateKey`.
 *
 * Databento releases each CME session's historical data at ~09:00 UTC the
 * following day, so until then the Historical API returns empty for that date.
 * An empty result for a not-yet-released date means "data is still coming"
 * (pending), not "this symbol/date has no data" (unavailable). A buffer past
 * the release hour absorbs pipeline variance before we give up on a date.
 */
export function isAwaitingRelease(dateKey: Date): boolean {
	const releaseTime = new Date(dateKey);
	releaseTime.setUTCDate(releaseTime.getUTCDate() + 1);
	releaseTime.setUTCHours(
		DATABENTO_RELEASE_HOUR_UTC + DATABENTO_RELEASE_BUFFER_HOURS,
		0,
		0,
		0,
	);
	return Date.now() < releaseTime.getTime();
}

/**
 * Staleness threshold for same-day cache entries (5 minutes)
 */
export const STALENESS_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Check if a same-day cache entry is stale and needs re-fetching.
 * Historical dates are never stale. Today's data is stale if both
 * lastBarAt and fetchedAt are older than the staleness threshold.
 * This prevents infinite re-fetches after market close: once trading
 * stops, lastBarAt stays old but fetchedAt reflects the last write,
 * so a recent fetch keeps the cache fresh.
 */
export function isCacheStale(
	dateKey: Date,
	lastBarAt: Date | null,
	fetchedAt?: Date | null,
): boolean {
	if (!isToday(dateKey)) return false;

	const now = Date.now();

	// If we fetched recently, treat as fresh even after market close
	if (fetchedAt && now - fetchedAt.getTime() < STALENESS_THRESHOLD_MS)
		return false;

	if (!lastBarAt) {
		// Null lastBarAt on a today-entry means we can't determine freshness — re-fetch
		return true;
	}
	return now - lastBarAt.getTime() > STALENESS_THRESHOLD_MS;
}

/**
 * Extract the lastBarAt timestamp from a bars array.
 * Returns the timestamp of the last bar, or null if empty.
 */
export function extractLastBarAt(bars: OHLCBar[]): Date | null {
	if (bars.length === 0) return null;
	const lastBar = bars[bars.length - 1];
	if (!lastBar) return null;
	return new Date(lastBar.timestamp);
}

export async function getOHLCBars(
	symbol: string,
	interval: CacheInterval,
	date: Date,
): Promise<CacheResult> {
	const dateKey = normalizeDateToUTC(date);

	// Map to base interval — only 1min and 1h are stored in cache
	const baseInterval = getBaseInterval(interval);

	// 1. Check cache first (always using base interval)
	const cached = await db.query.candleCache.findFirst({
		where: and(
			eq(candleCache.symbol, symbol),
			eq(candleCache.interval, baseInterval),
			eq(candleCache.date, dateKey),
		),
	});

	if (cached) {
		try {
			const bars = JSON.parse(cached.bars) as OHLCBar[];

			// Backfill lastBarAt if null (pre-migration rows)
			let lastBarAt = cached.lastBarAt;
			if (!lastBarAt) {
				lastBarAt = extractLastBarAt(bars);
			}

			// For historical dates, return cached data immediately
			// For today's date, check staleness
			if (!isCacheStale(dateKey, lastBarAt, cached.fetchedAt)) {
				const dateStr = dateKey.toISOString().split("T")[0];
				console.info(
					`[market-data] cache hit: ${symbol} ${baseInterval} ${dateStr} (${bars.length} bars)`,
				);
				const aggregatedBars = aggregateBars(bars, interval);
				if (interval !== baseInterval) {
					console.info(
						`[market-data] aggregating: ${symbol} ${baseInterval} → ${interval} (${bars.length} → ${aggregatedBars.length} bars)`,
					);
				}
				return { bars: aggregatedBars, source: "cache", dataQuality: "full" };
			}
			// Same-day stale entry — fall through to re-fetch
		} catch {
			// Corrupted cache entry - delete and re-fetch
			await db
				.delete(candleCache)
				.where(
					and(
						eq(candleCache.symbol, symbol),
						eq(candleCache.interval, baseInterval),
						eq(candleCache.date, dateKey),
					),
				);
		}
	}

	// 2. Cache MISS or stale — fetch base interval from API
	const dateStr = dateKey.toISOString().split("T")[0];
	if (!cached) {
		console.info(
			`[market-data] cache miss: ${symbol} ${baseInterval} ${dateStr} → fetching from Databento`,
		);
	}
	const apiResult = await fetchFromProvider(symbol, baseInterval, dateKey);

	if (!apiResult.success || apiResult.bars.length === 0) {
		// A not-yet-released session (e.g. today, or yesterday before the ~09:00
		// UTC release) is "pending" — data is coming — rather than "unavailable".
		const dataQuality: DataQuality = isAwaitingRelease(dateKey)
			? "pending"
			: "unavailable";
		return { bars: [], source: "api", dataQuality };
	}

	// 3. Store base interval in cache (insert or update on conflict)
	const lastBarAt = extractLastBarAt(apiResult.bars);
	try {
		await db
			.insert(candleCache)
			.values({
				symbol,
				interval: baseInterval,
				date: dateKey,
				bars: JSON.stringify(apiResult.bars),
				barCount: apiResult.bars.length,
				source: apiResult.provider ?? "databento",
				fetchedAt: new Date(),
				lastBarAt,
			})
			.onConflictDoUpdate({
				target: [candleCache.symbol, candleCache.interval, candleCache.date],
				set: {
					bars: JSON.stringify(apiResult.bars),
					barCount: apiResult.bars.length,
					lastBarAt,
					fetchedAt: new Date(),
				},
			});
	} catch {
		// Cache write failed - continue with API results
	}

	// Log refresh result with bar count comparison
	if (cached) {
		console.info(
			`[market-data] cache refresh: ${symbol} ${baseInterval} ${dateStr} (was ${cached.barCount} bars → now ${apiResult.bars.length} bars)`,
		);
	}

	// 4. Aggregate base interval bars to requested interval
	const aggregatedBars = aggregateBars(apiResult.bars, interval);
	if (interval !== baseInterval) {
		console.info(
			`[market-data] aggregating: ${symbol} ${baseInterval} → ${interval} (${apiResult.bars.length} → ${aggregatedBars.length} bars)`,
		);
	}

	return {
		bars: aggregatedBars,
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

	// Determine overall data quality across all days in the range
	const anyFromApi = results.some((r) => r.source === "api");
	const dataQuality = combineDayQuality(results.map((r) => r.dataQuality));

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
// PROVIDER ROUTING
// =============================================================================

interface FetchResult {
	success: boolean;
	bars: OHLCBar[];
	provider?: "databento";
	error?: string;
}

/**
 * Fetch data from Databento for futures symbols
 */
async function fetchFromProvider(
	symbol: string,
	interval: string,
	date: Date,
): Promise<FetchResult> {
	const databentoSymbol = getDatabentSymbol(symbol);

	if (!databentoSymbol || !isFuturesSymbol(symbol)) {
		return {
			success: false,
			bars: [],
			error: `Symbol ${symbol} is not a supported futures symbol`,
		};
	}

	return fetchFromDatabento(symbol, databentoSymbol, interval, date);
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
export function aggregateBars(
	bars: OHLCBar[],
	targetInterval: string,
): OHLCBar[] {
	if (targetInterval === "1min" || targetInterval === "1h") return bars;

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
	_originalSymbol: string,
	databentoSymbol: string,
	interval: string,
	date: Date,
): Promise<FetchResult> {
	const apiKey = env.DATABENTO_API_KEY;

	if (!apiKey) {
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

	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				bars: [],
				provider: "databento",
				error: `Databento API returned ${response.status}: ${errorText}`,
			};
		}

		// Databento returns newline-delimited JSON (NDJSON)
		const text = await response.text();

		if (!text.trim()) {
			return { success: true, bars: [], provider: "databento" };
		}

		// Parse NDJSON - each line is a separate JSON object
		const lines = text.trim().split("\n");
		const bars: OHLCBar[] = [];

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
				// Skip malformed records
			}
		}

		// Sort by timestamp ascending
		bars.sort((a, b) => a.timestamp - b.timestamp);

		return { success: true, bars, provider: "databento" };
	} catch (error) {
		return {
			success: false,
			bars: [],
			provider: "databento",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// =============================================================================
// FULL DAY DATA FOR CLIENT-SIDE AGGREGATION
// =============================================================================

/**
 * Combine per-day data qualities into one overall quality for a multi-day range.
 * Per-day results from getOHLCBars are only "full" | "pending" | "unavailable".
 * - every day full → "full"
 * - some real data + some missing/pending → "partial" (render what we have)
 * - no real data yet, but a day is still awaiting release → "pending"
 * - nothing, and nothing pending → "unavailable"
 */
function combineDayQuality(qualities: DataQuality[]): DataQuality {
	if (qualities.length === 0) return "unavailable";
	if (qualities.every((q) => q === "full")) return "full";
	if (qualities.some((q) => q === "full")) return "partial";
	if (qualities.some((q) => q === "pending")) return "pending";
	return "unavailable";
}

/**
 * Get extended range of 1-minute bars for a trade.
 * Fetches 3 calendar days before entry through 3 calendar days after exit
 * (capped at today), giving ~7 trading sessions of context.
 * Optimized for client-side timeframe aggregation.
 *
 * @param symbol - Trading symbol
 * @param entryTime - Trade entry time
 * @param exitTime - Trade exit time (or null for open trades)
 * @returns Extended range of 1-minute bars
 */
export async function getFullDayBars(
	symbol: string,
	entryTime: Date,
	exitTime: Date | null,
): Promise<CacheResult> {
	const effectiveExitTime = exitTime ?? new Date();

	// 3 calendar days before entry
	const rangeStart = new Date(entryTime);
	rangeStart.setUTCDate(rangeStart.getUTCDate() - 3);
	rangeStart.setUTCHours(0, 0, 0, 0);

	// 3 calendar days after exit, capped at today
	const rangeEnd = new Date(effectiveExitTime);
	rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 3);
	const today = new Date();
	today.setUTCHours(23, 59, 59, 999);
	if (rangeEnd > today) {
		rangeEnd.setTime(today.getTime());
	}
	rangeEnd.setUTCHours(0, 0, 0, 0);

	// Build list of dates, capped at 30 days to prevent unbounded ranges
	const MAX_CHART_DAYS = 30;
	const dates: Date[] = [];
	const currentDate = new Date(rangeStart);
	while (currentDate <= rangeEnd && dates.length < MAX_CHART_DAYS) {
		dates.push(new Date(currentDate));
		currentDate.setUTCDate(currentDate.getUTCDate() + 1);
	}

	// Fetch all days in parallel (always 1min for client-side aggregation)
	const results = await Promise.all(
		dates.map((date) => getOHLCBars(symbol, "1min", date)),
	);

	// Combine all bars from all days (no filtering - return full days)
	const allBars: OHLCBar[] = [];
	for (const result of results) {
		allBars.push(...result.bars);
	}

	// Sort by timestamp
	allBars.sort((a, b) => a.timestamp - b.timestamp);

	// Determine data quality across all days in the range
	const dataQuality = combineDayQuality(results.map((r) => r.dataQuality));

	// Determine source (cache if all from cache)
	const allFromCache = results.every((r) => r.source === "cache");
	const source = allFromCache ? "cache" : "api";

	return { bars: allBars, source, dataQuality };
}

// =============================================================================
// EXTENDED DATE RANGE FOR 1H CHARTS
// =============================================================================

/**
 * Get extended date range of 1h bars for a trade.
 * Fetches 3 calendar days before entry through 3 calendar days after exit
 * (or up to today), giving ~7 trading sessions of context.
 *
 * Uses getOHLCBars(symbol, "1h", date) for each day — same cache-first logic.
 *
 * @param symbol - Trading symbol
 * @param entryTime - Trade entry time
 * @param exitTime - Trade exit time (or null for open trades)
 * @returns Extended range of 1h bars
 */
export async function getExtendedDayBars(
	symbol: string,
	entryTime: Date,
	exitTime: Date | null,
): Promise<CacheResult> {
	const effectiveExitTime = exitTime ?? new Date();

	// 3 calendar days before entry
	const rangeStart = new Date(entryTime);
	rangeStart.setUTCDate(rangeStart.getUTCDate() - 3);
	rangeStart.setUTCHours(0, 0, 0, 0);

	// 3 calendar days after exit, capped at today
	const rangeEnd = new Date(effectiveExitTime);
	rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 3);
	const today = new Date();
	today.setUTCHours(23, 59, 59, 999);
	if (rangeEnd > today) {
		rangeEnd.setTime(today.getTime());
	}
	rangeEnd.setUTCHours(0, 0, 0, 0);

	// Build list of dates, capped at 30 days to prevent unbounded ranges for old open trades
	const MAX_CHART_DAYS = 30;
	const dates: Date[] = [];
	const currentDate = new Date(rangeStart);
	while (currentDate <= rangeEnd && dates.length < MAX_CHART_DAYS) {
		dates.push(new Date(currentDate));
		currentDate.setUTCDate(currentDate.getUTCDate() + 1);
	}

	// Fetch all days in parallel (always 1h for extended view)
	const results = await Promise.all(
		dates.map((date) => getOHLCBars(symbol, "1h", date)),
	);

	// Combine all bars from all days
	const allBars: OHLCBar[] = [];
	for (const result of results) {
		allBars.push(...result.bars);
	}

	// Sort by timestamp
	allBars.sort((a, b) => a.timestamp - b.timestamp);

	// Determine data quality across all days in the range
	const dataQuality = combineDayQuality(results.map((r) => r.dataQuality));

	// Determine source
	const allFromCache = results.every((r) => r.source === "cache");
	const source = allFromCache ? "cache" : "api";

	return { bars: allBars, source, dataQuality };
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
	const baseInterval = getBaseInterval(interval);

	const cached = await db.query.candleCache.findFirst({
		columns: { id: true },
		where: and(
			eq(candleCache.symbol, symbol),
			eq(candleCache.interval, baseInterval),
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
