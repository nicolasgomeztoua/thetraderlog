import type { CSVParser, ParseResult } from "./types";

/**
 * MetaTrader 4 CSV Parser
 *
 * MT4 exports trade history in a specific format. Common columns include:
 * - Ticket: Trade ID
 * - Open Time: Entry timestamp
 * - Type: buy/sell (for direction)
 * - Size: Lot size
 * - Item: Symbol
 * - Price: Entry price
 * - S/L: Stop Loss
 * - T/P: Take Profit
 * - Close Time: Exit timestamp
 * - Close Price: Exit price
 * - Commission: Trading commission
 * - Swap: Overnight swap fees
 * - Profit: Realized profit
 *
 * TODO: Implement based on actual MT4 CSV export format
 */
export const mt4Parser: CSVParser = {
	platform: "mt4",
	name: "MetaTrader 4",
	description: "Import trades from MetaTrader 4 history export",

	getExpectedColumns(): string[] {
		return [
			"Ticket",
			"Open Time",
			"Type",
			"Size",
			"Item",
			"Price",
			"S/L",
			"T/P",
			"Close Time",
			"Close Price",
			"Commission",
			"Swap",
			"Profit",
		];
	},

	validateHeaders(headers: string[]): boolean {
		// TODO: Implement header validation
		// Check if required columns exist (case-insensitive)
		const requiredColumns = [
			"ticket",
			"open time",
			"type",
			"size",
			"item",
			"price",
		];
		const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

		return requiredColumns.every((col) =>
			normalizedHeaders.some((h) => h.includes(col)),
		);
	},

	async parse(_csvContent: string): Promise<ParseResult> {
		// TODO: Implement actual parsing logic
		// PSEUDO CODE:
		// 1. Split CSV into rows
		// 2. Parse headers from first row
		// 3. For each data row:
		//    a. Map columns to ParsedTrade fields
		//    b. Convert "buy" -> "long", "sell" -> "short"
		//    c. Parse dates (MT4 format: YYYY.MM.DD HH:MM)
		//    d. Determine instrumentType from symbol
		//    e. Handle commission + swap as fees
		// 4. Return ParseResult with trades array

		console.log("[MT4 Parser] Parsing not yet implemented");

		return {
			success: false,
			trades: [],
			errors: [
				{
					row: 0,
					message:
						"MT4 parser not yet implemented. Awaiting CSV format specification.",
				},
			],
			warnings: [],
			totalRows: 0,
			parsedRows: 0,
			skippedRows: 0,
		};
	},
};

/**
 * MetaTrader 5 CSV Parser
 *
 * MT5 has a similar but slightly different format than MT4.
 * Main differences:
 * - Additional fields like "Profit in pips"
 * - Different date format options
 * - Position ID instead of just Ticket
 *
 * TODO: Implement based on actual MT5 CSV export format
 */
export const mt5Parser: CSVParser = {
	platform: "mt5",
	name: "MetaTrader 5",
	description: "Import trades from MetaTrader 5 history export",

	getExpectedColumns(): string[] {
		return [
			"Position",
			"Time",
			"Type",
			"Volume",
			"Symbol",
			"Price",
			"S/L",
			"T/P",
			"Time.1", // Close time
			"Price.1", // Close price
			"Commission",
			"Swap",
			"Profit",
		];
	},

	validateHeaders(headers: string[]): boolean {
		// TODO: Implement header validation
		const requiredColumns = [
			"position",
			"time",
			"type",
			"volume",
			"symbol",
			"price",
		];
		const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

		return requiredColumns.every((col) =>
			normalizedHeaders.some((h) => h.includes(col)),
		);
	},

	async parse(_csvContent: string): Promise<ParseResult> {
		// TODO: Implement actual parsing logic
		// Similar to MT4 but with MT5-specific field mappings

		console.log("[MT5 Parser] Parsing not yet implemented");

		return {
			success: false,
			trades: [],
			errors: [
				{
					row: 0,
					message:
						"MT5 parser not yet implemented. Awaiting CSV format specification.",
				},
			],
			warnings: [],
			totalRows: 0,
			parsedRows: 0,
			skippedRows: 0,
		};
	},
};
