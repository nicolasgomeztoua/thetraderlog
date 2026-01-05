/**
 * Time-related constants and utilities.
 * Single source of truth for time calculations across the application.
 */

// =============================================================================
// TIME CONSTANTS
// =============================================================================

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// =============================================================================
// QUERY CACHE DURATIONS
// =============================================================================

export const STALE_TIME_SHORT = 30 * MS_PER_SECOND; // 30 seconds
export const STALE_TIME_MEDIUM = 5 * MS_PER_MINUTE; // 5 minutes
export const STALE_TIME_LONG = 30 * MS_PER_MINUTE; // 30 minutes

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert a Date to Unix timestamp (seconds since epoch).
 * Handles Date objects, ISO strings, and numeric timestamps.
 */
export function toUnixTimestamp(date: Date | string | number): number {
	return Math.floor(new Date(date).getTime() / MS_PER_SECOND);
}

/**
 * Round a timestamp to the nearest candle boundary.
 * Used for aligning chart data to interval boundaries.
 *
 * @param time - The time to round (Date object or ISO string)
 * @param intervalMs - The candle interval in milliseconds
 * @returns Unix timestamp (seconds) rounded to the interval boundary
 */
export function roundToCandle(time: Date | string, intervalMs: number): number {
	const timestamp = new Date(time).getTime();
	const rounded = Math.floor(timestamp / intervalMs) * intervalMs;
	return Math.floor(rounded / MS_PER_SECOND);
}
