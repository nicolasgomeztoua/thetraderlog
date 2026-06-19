/**
 * Client-side candle aggregation utility
 * Aggregates 1-minute bars to larger timeframes for instant timeframe switching
 */

import type { UTCTimestamp } from "lightweight-charts";

// Chart bar format (lightweight-charts uses seconds, not ms)
export interface ChartBar {
	time: number; // UTCTimestamp in seconds
	open: number;
	high: number;
	low: number;
	close: number;
}

export type ChartInterval = "1min" | "5min" | "15min" | "30min" | "1h";

// Interval durations in seconds
const INTERVAL_SECONDS: Record<ChartInterval, number> = {
	"1min": 60,
	"5min": 5 * 60,
	"15min": 15 * 60,
	"30min": 30 * 60,
	"1h": 60 * 60,
};

/**
 * Aggregate 1-minute bars to a larger timeframe
 * Input bars must be sorted by time ascending
 *
 * @param bars - Array of 1-minute bars in lightweight-charts format (time in seconds)
 * @param targetInterval - Target timeframe to aggregate to
 * @returns Aggregated bars in the same format
 */
export function aggregateBars(
	bars: ChartBar[],
	targetInterval: ChartInterval,
): ChartBar[] {
	// No aggregation needed for 1min
	if (targetInterval === "1min" || bars.length === 0) {
		return bars;
	}

	const intervalSeconds = INTERVAL_SECONDS[targetInterval];
	const aggregated: ChartBar[] = [];

	let currentBucket: ChartBar | null = null;
	let bucketStart = 0;

	for (const bar of bars) {
		// Calculate which bucket this bar belongs to
		const barBucketStart =
			Math.floor(bar.time / intervalSeconds) * intervalSeconds;

		if (currentBucket === null || barBucketStart !== bucketStart) {
			// Start a new bucket - push the completed one first
			if (currentBucket) {
				aggregated.push(currentBucket);
			}

			bucketStart = barBucketStart;
			currentBucket = {
				time: barBucketStart,
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
			};
		} else {
			// Update the current bucket with this bar's data
			currentBucket.high = Math.max(currentBucket.high, bar.high);
			currentBucket.low = Math.min(currentBucket.low, bar.low);
			currentBucket.close = bar.close; // Last close wins
		}
	}

	// Don't forget the last bucket
	if (currentBucket) {
		aggregated.push(currentBucket);
	}

	return aggregated;
}

/**
 * Get the number of seconds per interval
 */
export function getIntervalSeconds(interval: ChartInterval): number {
	return INTERVAL_SECONDS[interval];
}

/**
 * Round a timestamp (in seconds) to the nearest candle bucket
 */
export function roundToCandle(
	timeSeconds: number,
	interval: ChartInterval,
): UTCTimestamp {
	const intervalSecs = INTERVAL_SECONDS[interval];
	const rounded = Math.floor(timeSeconds / intervalSecs) * intervalSecs;
	return rounded as UTCTimestamp;
}
