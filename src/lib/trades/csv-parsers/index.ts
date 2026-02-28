// ============================================
// CSV Parsers - Platform-specific trade importers
// ============================================

export { apexParser } from "./apex-parser";
export { ninjatraderParser } from "./ninjatrader-parser";
export { projectxParser } from "./projectx-parser";
export { rithmicParser } from "./rithmic-parser";
export { topstepxParser } from "./topstepx-parser";
export { tradovateParser } from "./tradovate-parser";
export * from "./types";

import { apexParser } from "./apex-parser";
import { ninjatraderParser } from "./ninjatrader-parser";
import { projectxParser } from "./projectx-parser";
import { rithmicParser } from "./rithmic-parser";
import { topstepxParser } from "./topstepx-parser";
import { tradovateParser } from "./tradovate-parser";
import type { CSVParser, TradingPlatform } from "./types";

// Registry of all available parsers
const parsers: Record<TradingPlatform, CSVParser | null> = {
	topstepx: topstepxParser,
	projectx: projectxParser,
	ninjatrader: ninjatraderParser,
	tradovate: tradovateParser,
	rithmic: rithmicParser,
	apex: apexParser,
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
		{
			value: "projectx",
			label: "ProjectX",
			description: "ProjectX platform export",
		},
		{
			value: "topstepx",
			label: "TopstepX",
			description: "TopstepX trades export",
		},
		{
			value: "ninjatrader",
			label: "NinjaTrader",
			description: "NinjaTrader executions export",
		},
		{
			value: "tradovate",
			label: "Tradovate",
			description: "Tradovate order report export",
		},
		{
			value: "rithmic",
			label: "Rithmic (R | Trader)",
			description: "Rithmic completed orders export",
		},
		{
			value: "apex",
			label: "Apex (Adapter)",
			description: "Auto-detect Apex underlying format",
		},
	];
}

/**
 * All available trading platforms (for account creation)
 */
export const TRADING_PLATFORMS = [
	{ value: "projectx" as const, label: "ProjectX" },
	{ value: "topstepx" as const, label: "TopstepX" },
	{ value: "ninjatrader" as const, label: "NinjaTrader" },
	{ value: "tradovate" as const, label: "Tradovate" },
	{ value: "rithmic" as const, label: "Rithmic (R | Trader)" },
	{ value: "apex" as const, label: "Apex" },
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
