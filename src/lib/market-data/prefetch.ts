/**
 * Daily Market Data Pre-Fetch
 *
 * Core logic for discovering traded symbols and pre-fetching their market data.
 * Extracted from the Trigger.dev task wrapper for testability.
 */

import { and, isNotNull, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { trades } from "@/server/db/schema";
import type { BaseInterval } from "./service";
import { getOHLCBars, hasCachedData } from "./service";

const BASE_INTERVALS: BaseInterval[] = ["1min", "1h"];
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface PrefetchResult {
	total: number;
	successes: number;
	failures: number;
	skipped: number;
	failedSymbols: string[];
}

/**
 * Discover all distinct symbols that exist in the trades table.
 */
export async function discoverSymbols(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ symbol: trades.symbol })
		.from(trades)
		.where(and(isNotNull(trades.symbol), isNull(trades.deletedAt)));

	return rows.map((r) => r.symbol);
}

/**
 * Fetch market data for a single symbol + interval with exponential backoff.
 * Returns true on success, false on failure after all retries.
 */
async function fetchWithRetry(
	symbol: string,
	interval: BaseInterval,
	date: Date,
): Promise<boolean> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			await getOHLCBars(symbol, interval, date);
			// Even "unavailable" (weekend/holiday) is a valid result — not a failure
			return true;
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error";
			logger.warn("Prefetch attempt failed", {
				symbol,
				interval,
				attempt,
				maxRetries: MAX_RETRIES,
				error: msg,
			});

			if (attempt < MAX_RETRIES) {
				const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, backoff));
			}
		}
	}
	return false;
}

/**
 * Pre-fetch market data for all symbols found in the trades table.
 * Fetches the previous day's (UTC) data for both 1min and 1h base intervals.
 *
 * Processes symbols with limited concurrency (10 at a time) to avoid
 * overwhelming the Databento API.
 */
export async function prefetchMarketDataForAllSymbols(): Promise<PrefetchResult> {
	const symbols = await discoverSymbols();

	if (symbols.length === 0) {
		logger.info("No symbols found in trades table");
		return {
			total: 0,
			successes: 0,
			failures: 0,
			skipped: 0,
			failedSymbols: [],
		};
	}

	// Previous day in UTC
	const yesterday = new Date();
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	yesterday.setUTCHours(0, 0, 0, 0);

	logger.info("Starting market data prefetch", {
		symbolCount: symbols.length,
		symbols: symbols.join(", "),
	});

	let successes = 0;
	let failures = 0;
	let skipped = 0;
	const failedSymbols: string[] = [];

	// Process with concurrency limit of 10
	const CONCURRENCY = 10;
	for (let i = 0; i < symbols.length; i += CONCURRENCY) {
		const batch = symbols.slice(i, i + CONCURRENCY);
		const results = await Promise.all(
			batch.map(async (symbol) => {
				// Check if both intervals are already cached
				const [has1min, has1h] = await Promise.all([
					hasCachedData(symbol, "1min", yesterday),
					hasCachedData(symbol, "1h", yesterday),
				]);

				if (has1min && has1h) {
					logger.debug("Symbol already cached, skipping", { symbol });
					return "skipped" as const;
				}

				// Fetch missing intervals
				let allSucceeded = true;
				for (const interval of BASE_INTERVALS) {
					const isCached = interval === "1min" ? has1min : has1h;
					if (isCached) continue;

					const ok = await fetchWithRetry(symbol, interval, yesterday);
					if (!ok) {
						allSucceeded = false;
						logger.error("Prefetch exhausted all retries", undefined, {
							symbol,
							interval,
							maxRetries: MAX_RETRIES,
						});
					}
				}

				return allSucceeded ? ("success" as const) : ("failure" as const);
			}),
		);

		for (let j = 0; j < results.length; j++) {
			const status = results[j];
			if (status === "skipped") {
				skipped++;
			} else if (status === "success") {
				successes++;
			} else {
				failures++;
				failedSymbols.push(batch[j] ?? "unknown");
			}
		}
	}

	return {
		total: symbols.length,
		successes,
		failures,
		skipped,
		failedSymbols,
	};
}
