import type { OutcomeFilter, ReviewedFilter } from "@/types/analytics-filters";

// =============================================================================
// DATE & TIME CONSTANTS
// =============================================================================

/**
 * Day of week labels for filter UI
 * value: 0-6 (Sunday-Saturday, matches JS Date.getDay())
 */
export const DAY_LABELS = [
	{ value: 0, short: "S", full: "Sun" },
	{ value: 1, short: "M", full: "Mon" },
	{ value: 2, short: "T", full: "Tue" },
	{ value: 3, short: "W", full: "Wed" },
	{ value: 4, short: "T", full: "Thu" },
	{ value: 5, short: "F", full: "Fri" },
	{ value: 6, short: "S", full: "Sat" },
] as const;

/**
 * Quick date presets for filter UI
 * days: positive = subtract from today, -1 = YTD, 0 = ALL (clear)
 */
export const QUICK_DATE_PRESETS = [
	{ label: "7D", days: 7 },
	{ label: "30D", days: 30 },
	{ label: "90D", days: 90 },
	{ label: "YTD", days: -1 },
	{ label: "ALL", days: 0 },
] as const;

/**
 * Hours array for hour grid filter (0-23)
 */
export const HOURS = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
	22, 23,
] as const;

// =============================================================================
// FILTER OPTIONS
// =============================================================================

/**
 * Outcome filter options with display labels and color variants
 */
export const OUTCOME_OPTIONS: {
	value: OutcomeFilter;
	label: string;
	variant: "default" | "profit" | "loss" | "neutral";
}[] = [
	{ value: "all", label: "All", variant: "default" },
	{ value: "win", label: "Winners", variant: "profit" },
	{ value: "loss", label: "Losers", variant: "loss" },
	{ value: "breakeven", label: "Breakeven", variant: "neutral" },
];

/**
 * Quick outcome options for compact filter bar
 */
export const QUICK_OUTCOME_OPTIONS: OutcomeFilter[] = ["all", "win", "loss"];

/**
 * Review status filter options
 */
export const REVIEW_OPTIONS: { value: ReviewedFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "reviewed", label: "Reviewed" },
	{ value: "unreviewed", label: "Unreviewed" },
];

// =============================================================================
// TRADING SESSIONS
// =============================================================================

/**
 * Trading session definitions (UTC hours)
 * Used for filtering trades by market session
 */
export const TRADING_SESSIONS = {
	asia: { start: 0, end: 8, label: "Asia" },
	london: { start: 8, end: 16, label: "London" },
	new_york: { start: 13, end: 21, label: "New York" },
} as const;

/**
 * Default session options for settings/filter UI
 */
export const DEFAULT_SESSIONS = [
	{ id: "asia", name: "Asia" },
	{ id: "london", name: "London" },
	{ id: "new_york", name: "New York" },
] as const;
