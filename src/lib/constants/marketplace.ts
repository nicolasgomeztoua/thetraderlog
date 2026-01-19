/**
 * Marketplace constants
 * Centralized constants for strategy marketplace, categories, instruments, and sorting
 */

// =============================================================================
// STRATEGY CATEGORIES
// =============================================================================

/**
 * Strategy category definitions
 * value: stored in DB, label: displayed in UI
 */
export const STRATEGY_CATEGORIES = [
	{ value: "scalping", label: "Scalping" },
	{ value: "day_trading", label: "Day Trading" },
	{ value: "swing_trading", label: "Swing Trading" },
	{ value: "position_trading", label: "Position Trading" },
	{ value: "news_trading", label: "News Trading" },
	{ value: "breakout", label: "Breakout" },
	{ value: "mean_reversion", label: "Mean Reversion" },
	{ value: "trend_following", label: "Trend Following" },
	{ value: "range_trading", label: "Range Trading" },
	{ value: "other", label: "Other" },
] as const;

export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number]["value"];

// =============================================================================
// TRADEABLE INSTRUMENTS
// =============================================================================

/**
 * Tradeable instruments grouped by asset class
 * Each instrument has: value (stored), label (displayed), symbol (ticker)
 */
export const TRADEABLE_INSTRUMENTS = {
	futures: [
		{ value: "es", label: "E-mini S&P 500", symbol: "ES" },
		{ value: "nq", label: "E-mini Nasdaq 100", symbol: "NQ" },
		{ value: "ym", label: "E-mini Dow", symbol: "YM" },
		{ value: "rty", label: "E-mini Russell 2000", symbol: "RTY" },
		{ value: "cl", label: "Crude Oil", symbol: "CL" },
		{ value: "gc", label: "Gold", symbol: "GC" },
		{ value: "si", label: "Silver", symbol: "SI" },
		{ value: "ng", label: "Natural Gas", symbol: "NG" },
		{ value: "zb", label: "30-Year Treasury", symbol: "ZB" },
		{ value: "zn", label: "10-Year Treasury", symbol: "ZN" },
		{ value: "6e", label: "Euro FX", symbol: "6E" },
		{ value: "6j", label: "Japanese Yen", symbol: "6J" },
		{ value: "6b", label: "British Pound", symbol: "6B" },
		{ value: "mes", label: "Micro E-mini S&P 500", symbol: "MES" },
		{ value: "mnq", label: "Micro E-mini Nasdaq", symbol: "MNQ" },
	],
	forex: [
		{ value: "eurusd", label: "EUR/USD", symbol: "EUR/USD" },
		{ value: "gbpusd", label: "GBP/USD", symbol: "GBP/USD" },
		{ value: "usdjpy", label: "USD/JPY", symbol: "USD/JPY" },
		{ value: "usdchf", label: "USD/CHF", symbol: "USD/CHF" },
		{ value: "audusd", label: "AUD/USD", symbol: "AUD/USD" },
		{ value: "usdcad", label: "USD/CAD", symbol: "USD/CAD" },
		{ value: "nzdusd", label: "NZD/USD", symbol: "NZD/USD" },
		{ value: "eurgbp", label: "EUR/GBP", symbol: "EUR/GBP" },
		{ value: "eurjpy", label: "EUR/JPY", symbol: "EUR/JPY" },
		{ value: "gbpjpy", label: "GBP/JPY", symbol: "GBP/JPY" },
		{ value: "xauusd", label: "Gold Spot", symbol: "XAU/USD" },
	],
	crypto: [
		{ value: "btcusd", label: "Bitcoin", symbol: "BTC/USD" },
		{ value: "ethusd", label: "Ethereum", symbol: "ETH/USD" },
		{ value: "solusd", label: "Solana", symbol: "SOL/USD" },
		{ value: "xrpusd", label: "XRP", symbol: "XRP/USD" },
		{ value: "adausd", label: "Cardano", symbol: "ADA/USD" },
		{ value: "dogeusd", label: "Dogecoin", symbol: "DOGE/USD" },
		{ value: "bnbusd", label: "BNB", symbol: "BNB/USD" },
		{ value: "avaxusd", label: "Avalanche", symbol: "AVAX/USD" },
	],
} as const;

export type InstrumentAssetClass = keyof typeof TRADEABLE_INSTRUMENTS;
export type TradeableInstrument =
	(typeof TRADEABLE_INSTRUMENTS)[InstrumentAssetClass][number]["value"];

/**
 * Flat list of all instruments for validation
 */
export const ALL_INSTRUMENTS = [
	...TRADEABLE_INSTRUMENTS.futures,
	...TRADEABLE_INSTRUMENTS.forex,
	...TRADEABLE_INSTRUMENTS.crypto,
] as const;

/**
 * Get all instrument values as a flat array for validation
 */
export const ALL_INSTRUMENT_VALUES = ALL_INSTRUMENTS.map((i) => i.value);

// =============================================================================
// MARKETPLACE SORT OPTIONS
// =============================================================================

/**
 * Sort options for marketplace listing
 * value: query param, label: displayed in dropdown, field/direction: used for DB query
 */
export const MARKETPLACE_SORT_OPTIONS = [
	{ value: "votes", label: "Most Votes", field: "netVotes", direction: "desc" },
	{
		value: "downloads",
		label: "Most Downloads",
		field: "downloadCount",
		direction: "desc",
	},
	{
		value: "newest",
		label: "Newest",
		field: "publishedAt",
		direction: "desc",
	},
	{
		value: "updated",
		label: "Recently Updated",
		field: "updatedAt",
		direction: "desc",
	},
] as const;

export type MarketplaceSortOption =
	(typeof MARKETPLACE_SORT_OPTIONS)[number]["value"];

// =============================================================================
// COVER IMAGE CONSTRAINTS
// =============================================================================

/**
 * Cover image aspect ratio (16:9)
 */
export const COVER_IMAGE_ASPECT_RATIO = 16 / 9;

/**
 * Maximum cover image file size in megabytes
 */
export const COVER_IMAGE_MAX_SIZE_MB = 5;

/**
 * Maximum cover image file size in bytes
 */
export const COVER_IMAGE_MAX_SIZE_BYTES = COVER_IMAGE_MAX_SIZE_MB * 1024 * 1024;

/**
 * Accepted MIME types for cover images
 */
export const COVER_IMAGE_ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
] as const;

export type CoverImageMimeType = (typeof COVER_IMAGE_ACCEPTED_TYPES)[number];

/**
 * File extensions for accepted cover image types
 */
export const COVER_IMAGE_EXTENSIONS = [
	".jpg",
	".jpeg",
	".png",
	".webp",
	".gif",
] as const;
