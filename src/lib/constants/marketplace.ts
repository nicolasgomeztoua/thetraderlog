// =============================================================================
// STRATEGY MARKETPLACE CONSTANTS
// =============================================================================

/**
 * Available instruments for strategies
 * Covers major futures contracts and forex pairs
 */
export const STRATEGY_INSTRUMENTS = [
	"ES",
	"NQ",
	"MES",
	"MNQ",
	"YM",
	"RTY",
	"CL",
	"GC",
	"EUR/USD",
	"GBP/USD",
	"USD/JPY",
	"Other",
] as const;

export type StrategyInstrument = (typeof STRATEGY_INSTRUMENTS)[number];

/**
 * Strategy category tags for marketplace filtering
 */
export const STRATEGY_CATEGORIES = [
	"Scalping",
	"Day Trading",
	"Swing Trading",
	"Breakout",
	"Reversal",
	"Trend Following",
	"Mean Reversion",
	"News Trading",
	"ICT/SMC",
	"Other",
] as const;

export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number];

/**
 * Sort options for marketplace listings
 */
export const MARKETPLACE_SORT_OPTIONS = [
	"votes",
	"downloads",
	"recent",
] as const;

export type MarketplaceSortOption = (typeof MARKETPLACE_SORT_OPTIONS)[number];

/**
 * Default page size for marketplace pagination
 */
export const MARKETPLACE_PAGE_SIZE = 20;

/**
 * Minimum number of closed trades required to publish a strategy
 */
export const MIN_TRADES_TO_PUBLISH = 20;

/**
 * Number of trades for "verified track record" status badge
 */
export const VERIFIED_TRACK_RECORD_THRESHOLD = 100;

/**
 * Number of trades below which strategy shows "limited data" warning
 */
export const LIMITED_DATA_THRESHOLD = 30;

/**
 * Reasons for reporting a strategy
 */
export const STRATEGY_REPORT_REASONS = [
	"misleading_stats",
	"inappropriate_content",
	"spam",
	"other",
] as const;

export type StrategyReportReason = (typeof STRATEGY_REPORT_REASONS)[number];

/**
 * Maximum number of votes a user can cast per hour
 * Used by Upstash rate limiter
 */
export const MAX_VOTES_PER_HOUR = 20;
