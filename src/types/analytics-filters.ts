// =============================================================================
// ANALYTICS FILTER TYPES
// Shared types for analytics filtering across frontend and backend
// =============================================================================

import type { QueryBuilderState } from "./query-builder";

/**
 * Date range filter for analytics
 */
export interface DateRangeFilter {
	start: Date | null;
	end: Date | null;
}

/**
 * Numeric range filter (for R-multiple, position size, etc.)
 */
export interface NumericRangeFilter {
	min: number | null;
	max: number | null;
}

/**
 * Trade outcome filter options
 */
export type OutcomeFilter = "all" | "win" | "loss" | "breakeven";

/**
 * Trade review status filter options
 */
export type ReviewedFilter = "all" | "reviewed" | "unreviewed";

/**
 * Complete analytics filter state
 * Used for filtering trades across all analytics tabs
 */
export interface AnalyticsFilters {
	/** Filter by specific symbols (e.g., "ES", "NQ", "EURUSD") */
	symbols: string[];

	/** Filter by date range */
	dateRange: DateRangeFilter;

	/** Filter by day of week (0-6, Sunday-Saturday) */
	daysOfWeek: number[];

	/** Filter by entry hour (0-23) */
	hours: number[];

	/** Filter by trading session names (e.g., "Asia", "London", "New York") */
	sessions: string[];

	/** Filter by strategy IDs */
	strategies: string[];

	/** Filter by tag IDs */
	tags: string[];

	/** Filter by R-multiple range */
	rMultipleRange: NumericRangeFilter;

	/** Filter by position size range */
	positionSizeRange: NumericRangeFilter;

	/** Filter by trade outcome */
	outcome: OutcomeFilter;

	/** Filter by review status */
	reviewed: ReviewedFilter;

	/** Advanced query builder state (overrides simple filters when set) */
	advancedQuery: QueryBuilderState | null;
}

/**
 * Default/empty filter state
 * Used to initialize or reset filters
 */
export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
	symbols: [],
	dateRange: { start: null, end: null },
	daysOfWeek: [],
	hours: [],
	sessions: [],
	strategies: [],
	tags: [],
	rMultipleRange: { min: null, max: null },
	positionSizeRange: { min: null, max: null },
	outcome: "all",
	reviewed: "all",
	advancedQuery: null,
};

/**
 * Check if a filter value is "active" (not in default state)
 */
export function isFilterActive(
	key: keyof AnalyticsFilters,
	value: AnalyticsFilters[keyof AnalyticsFilters],
): boolean {
	switch (key) {
		case "symbols":
		case "daysOfWeek":
		case "hours":
		case "sessions":
		case "strategies":
		case "tags":
			return Array.isArray(value) && value.length > 0;

		case "dateRange":
			return (
				(value as DateRangeFilter).start !== null ||
				(value as DateRangeFilter).end !== null
			);

		case "rMultipleRange":
		case "positionSizeRange":
			return (
				(value as NumericRangeFilter).min !== null ||
				(value as NumericRangeFilter).max !== null
			);

		case "outcome":
			return value !== "all";

		case "reviewed":
			return value !== "all";

		case "advancedQuery":
			return value !== null;

		default:
			return false;
	}
}

/**
 * Serialized filter state for URL query params
 * Dates are ISO strings, everything else is JSON-compatible
 */
export interface SerializedAnalyticsFilters {
	symbols?: string[];
	dateStart?: string;
	dateEnd?: string;
	daysOfWeek?: number[];
	hours?: number[];
	sessions?: string[];
	strategies?: string[];
	tags?: string[];
	rMultipleMin?: number;
	rMultipleMax?: number;
	positionSizeMin?: number;
	positionSizeMax?: number;
	outcome?: OutcomeFilter;
	reviewed?: ReviewedFilter;
}
