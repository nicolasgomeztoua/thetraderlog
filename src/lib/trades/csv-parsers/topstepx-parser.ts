import { projectxParser } from "./projectx-parser";
import type { CSVParser, ParseResult } from "./types";
import { hasRequiredHeaders } from "./utils";

/**
 * TopstepX CSV Parser
 *
 * TopstepX exports are ProjectX-compatible with an extra TradeDay column.
 * We delegate parsing to the ProjectX parser and keep a distinct platform adapter.
 */
export const topstepxParser: CSVParser = {
	platform: "topstepx",
	name: "TopstepX",
	description: "Import trades from TopstepX Trades export",

	getExpectedColumns(): string[] {
		return [
			"Id",
			"ContractName",
			"EnteredAt",
			"ExitedAt",
			"EntryPrice",
			"ExitPrice",
			"Fees",
			"PnL",
			"Size",
			"Type",
			"TradeDay",
		];
	},

	validateHeaders(headers: string[]): boolean {
		const requiredColumns = [
			"id",
			"contractname",
			"enteredat",
			"exitedat",
			"entryprice",
			"exitprice",
			"size",
			"type",
			"tradeday",
		];

		return hasRequiredHeaders(headers, requiredColumns);
	},

	async parse(csvContent: string): Promise<ParseResult> {
		return projectxParser.parse(csvContent);
	},
};
