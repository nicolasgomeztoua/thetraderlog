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

// =============================================================================
// DURATION-ADAPTIVE TIMEFRAME (AUTO MODE)
// =============================================================================

/**
 * Upper duration bounds (in MINUTES) for each auto-selected timeframe tier.
 * A trade whose duration is `<=` a bound picks that tier (boundaries belong to
 * the coarser side, so a trade exactly on the line is deterministic). The goal
 * is for the trade body to span a readable ~12–48 candles at the chosen tf.
 *
 *   <= 40 min  -> "1min"   (10-min trade  -> 10 candles)
 *   <= 3 h     -> "5min"   (90-min trade  -> 18 candles)
 *   <= 8 h     -> "15min"  (4-h trade     -> 16 candles)
 *   <= 18 h    -> "30min"  (14-h overnight-> 28 candles)
 *   >  18 h    -> "1h"     (2-day swing   -> ~46 candles)
 */
export const AUTO_TIER_THRESHOLDS_MIN = {
	oneMin: 40,
	fiveMin: 180,
	fifteenMin: 480,
	thirtyMin: 1080,
} as const;

/**
 * Open trades have no exit, so duration is measured to "now". Clamp that span
 * (for both interval choice and the visible window) so a stale open position
 * doesn't force the coarsest tf and a 10-day-wide chart.
 */
export const STALE_OPEN_CAP_MS = 24 * MS_PER_HOUR;
