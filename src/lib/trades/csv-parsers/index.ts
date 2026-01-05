// ============================================
// CSV Parsers - Platform-specific trade importers
// ============================================

export { mt4Parser, mt5Parser } from "./mt4-parser";
export { projectxParser } from "./projectx-parser";
export * from "./types";

import { mt4Parser, mt5Parser } from "./mt4-parser";
import { projectxParser } from "./projectx-parser";
import type { CSVParser, TradingPlatform } from "./types";

// Registry of all available parsers
const parsers: Record<TradingPlatform, CSVParser | null> = {
	mt4: mt4Parser,
	mt5: mt5Parser,
	projectx: projectxParser,
	ninjatrader: null, // TODO: Implement
	other: null, // No parser for "other" - requires manual entry
};

/**
 * Get the CSV parser for a specific platform
 */
export function getParser(platform: TradingPlatform): CSVParser | null {
	return parsers[platform] ?? null;
}

/**
 * Get list of platforms that support CSV import
 */
export function getSupportedPlatforms(): {
	value: TradingPlatform;
	label: string;
	description: string;
}[] {
	return [
		{ value: "mt4", label: "MetaTrader 4", description: "MT4 history export" },
		{ value: "mt5", label: "MetaTrader 5", description: "MT5 history export" },
		{
			value: "projectx",
			label: "ProjectX",
			description: "ProjectX platform export",
		},
		// { value: "ninjatrader", label: "NinjaTrader", description: "Coming soon" },
	];
}

/**
 * All available trading platforms (for account creation)
 */
export const TRADING_PLATFORMS = [
	{ value: "mt4" as const, label: "MetaTrader 4" },
	{ value: "mt5" as const, label: "MetaTrader 5" },
	{ value: "projectx" as const, label: "ProjectX" },
	{ value: "ninjatrader" as const, label: "NinjaTrader" },
	{ value: "other" as const, label: "Other / Manual" },
];

/**
 * Auto-detect platform from CSV headers
 */
export function detectPlatform(headers: string[]): TradingPlatform | null {
	for (const [platform, parser] of Object.entries(parsers)) {
		if (parser?.validateHeaders(headers)) {
			return platform as TradingPlatform;
		}
	}
	return null;
}
