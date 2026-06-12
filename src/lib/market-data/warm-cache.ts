/**
 * Candle-cache warming for batch imports.
 *
 * A batch import often contains many trades on the same symbol and session.
 * Fetching market data per trade means concurrent workers all miss the cache
 * at the same moment and each buys + downloads the same Databento day, while
 * Databento queues concurrent requests per key (effective concurrency ~2).
 *
 * Warming inverts this: dedupe the import down to unique (symbol, UTC day)
 * pairs, fetch each exactly once at the provider's effective concurrency,
 * then let the per-trade MAE/MFE pass run as pure cache reads.
 */

import { DATABENTO_MAX_CONCURRENT_FETCHES } from "@/lib/constants/market-data";
import { getOHLCBars } from "./service";
import { isFuturesSymbol } from "./symbols";

export interface SymbolDay {
	symbol: string;
	/** Midnight UTC of the trading day */
	date: Date;
}

export interface WarmCacheSummary {
	requested: number;
	full: number;
	pending: number;
	unavailable: number;
}

/**
 * Collect the unique (symbol, UTC day) pairs covered by a set of trades.
 * Open trades and unsupported (non-futures) symbols are skipped — the
 * provider can't serve them, so there is nothing to warm.
 */
export function collectSymbolDays(
	tradesToWarm: Array<{
		symbol: string;
		entryTime: Date;
		exitTime: Date | null;
	}>,
): SymbolDay[] {
	const seen = new Map<string, SymbolDay>();

	for (const trade of tradesToWarm) {
		if (!trade.exitTime || !isFuturesSymbol(trade.symbol)) continue;

		const current = new Date(trade.entryTime);
		current.setUTCHours(0, 0, 0, 0);
		const end = new Date(trade.exitTime);
		end.setUTCHours(0, 0, 0, 0);

		while (current <= end) {
			const key = `${trade.symbol}|${current.toISOString()}`;
			if (!seen.has(key)) {
				seen.set(key, { symbol: trade.symbol, date: new Date(current) });
			}
			current.setUTCDate(current.getUTCDate() + 1);
		}
	}

	return [...seen.values()];
}

/**
 * Run an async mapper over items with a bounded number of workers.
 * Results are returned in input order.
 */
export async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			const item = items[index];
			if (item === undefined) continue;
			results[index] = await mapper(item);
		}
	}

	const workerCount = Math.max(1, Math.min(concurrency, items.length));
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}

/**
 * Ensure 1-minute candles for every given symbol-day are in the cache,
 * fetching missing days from the provider with bounded concurrency.
 */
export async function warmCandleCache(
	symbolDays: SymbolDay[],
	concurrency: number = DATABENTO_MAX_CONCURRENT_FETCHES,
): Promise<WarmCacheSummary> {
	const results = await mapWithConcurrency(symbolDays, concurrency, (day) =>
		getOHLCBars(day.symbol, "1min", day.date),
	);

	const summary: WarmCacheSummary = {
		requested: symbolDays.length,
		full: 0,
		pending: 0,
		unavailable: 0,
	};
	for (const result of results) {
		if (result.dataQuality === "full") summary.full += 1;
		else if (result.dataQuality === "pending") summary.pending += 1;
		else summary.unavailable += 1;
	}
	return summary;
}
