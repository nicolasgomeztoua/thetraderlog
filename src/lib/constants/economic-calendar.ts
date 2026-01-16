// =============================================================================
// ECONOMIC CALENDAR CONSTANTS
// =============================================================================

/**
 * Impact level color styling for economic events
 * Uses Terminal design system colors
 */
export const EVENT_IMPACT_COLORS = {
	high: {
		bg: "bg-loss/20",
		text: "text-loss",
		border: "border-loss/40",
	},
	medium: {
		bg: "bg-yellow-500/20",
		text: "text-yellow-500",
		border: "border-yellow-500/40",
	},
	low: {
		bg: "bg-muted/20",
		text: "text-muted-foreground",
		border: "border-muted",
	},
} as const;

/**
 * Major forex currencies for calendar filtering
 */
export const MAJOR_CURRENCIES = [
	"USD",
	"EUR",
	"GBP",
	"JPY",
	"CHF",
	"AUD",
	"CAD",
	"NZD",
] as const;

/**
 * Keywords that indicate high-impact economic events
 * Used for impact classification when parsing calendar data
 */
export const HIGH_IMPACT_KEYWORDS = [
	"NFP",
	"Non-Farm",
	"FOMC",
	"Interest Rate",
	"CPI",
	"GDP",
	"Retail Sales",
	"Unemployment",
	"PMI",
	"Central Bank",
	"Fed Chair",
	"ECB President",
	"BOE Governor",
	"BOJ Governor",
	"Employment Change",
	"Trade Balance",
	"Core Inflation",
] as const;

export type EventImpact = keyof typeof EVENT_IMPACT_COLORS;
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number];
