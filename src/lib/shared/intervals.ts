/**
 * Chart interval constants used across trading components.
 * Single source of truth for timeframe-related values.
 */

import { MS_PER_HOUR, MS_PER_MINUTE } from "./time";

// =============================================================================
// CHART INTERVAL TYPE
// =============================================================================

export type ChartInterval = "1min" | "5min" | "15min" | "30min" | "1h";

// =============================================================================
// INTERVAL CONSTANTS
// =============================================================================

/**
 * Interval durations in milliseconds.
 * Use for client-side time calculations.
 */
export const INTERVAL_MS: Record<ChartInterval, number> = {
	"1min": MS_PER_MINUTE,
	"5min": 5 * MS_PER_MINUTE,
	"15min": 15 * MS_PER_MINUTE,
	"30min": 30 * MS_PER_MINUTE,
	"1h": MS_PER_HOUR,
} as const;

/**
 * Interval durations in seconds.
 * Use for chart libraries (lightweight-charts uses seconds).
 */
export const INTERVAL_SECONDS: Record<ChartInterval, number> = {
	"1min": 60,
	"5min": 300,
	"15min": 900,
	"30min": 1800,
	"1h": 3600,
} as const;

/**
 * Human-readable interval labels for UI display.
 */
export const INTERVAL_LABELS: Record<ChartInterval, string> = {
	"1min": "1m",
	"5min": "5m",
	"15min": "15m",
	"30min": "30m",
	"1h": "1h",
} as const;

/**
 * Available intervals for selection components.
 */
export const CHART_INTERVALS: ChartInterval[] = [
	"1min",
	"5min",
	"15min",
	"30min",
	"1h",
] as const;
