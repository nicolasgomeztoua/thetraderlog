import { ninjatraderParser } from "./ninjatrader-parser";
import { projectxParser } from "./projectx-parser";
import { rithmicParser } from "./rithmic-parser";
import { topstepxParser } from "./topstepx-parser";
import { tradovateParser } from "./tradovate-parser";
import type { CSVParser, ParseResult } from "./types";
import { parseCSVLine, splitCSVLines } from "./utils";

function detectUnderlyingParser(csvContent: string): CSVParser | null {
	// Apex exports commonly come through Rithmic mixed files.
	if (
		csvContent.toLowerCase().includes("completed orders") &&
		csvContent.toLowerCase().includes("buy/sell")
	) {
		return rithmicParser;
	}

	const candidateParsers: CSVParser[] = [
		rithmicParser,
		tradovateParser,
		topstepxParser,
		projectxParser,
		ninjatraderParser,
	];

	const lines = splitCSVLines(csvContent).slice(0, 40);
	for (const line of lines) {
		if (!line || !line.includes(",")) continue;

		const headers = parseCSVLine(line);
		for (const parser of candidateParsers) {
			if (parser.validateHeaders(headers)) {
				return parser;
			}
		}
	}

	return null;
}

/**
 * Apex CSV Parser (Adapter)
 *
 * Apex does not have a stable unique export schema. This adapter auto-detects
 * the underlying format and delegates to the corresponding parser.
 */
export const apexParser: CSVParser = {
	platform: "apex",
	name: "Apex (Auto-detect)",
	description:
		"Detect and parse Apex exports via Rithmic/Tradovate/ProjectX-compatible formats",

	getExpectedColumns(): string[] {
		return [
			"Apex export varies by platform. Supported underlying formats: Rithmic, Tradovate, TopstepX/ProjectX, NinjaTrader",
		];
	},

	validateHeaders(headers: string[]): boolean {
		return (
			rithmicParser.validateHeaders(headers) ||
			tradovateParser.validateHeaders(headers) ||
			topstepxParser.validateHeaders(headers) ||
			projectxParser.validateHeaders(headers) ||
			ninjatraderParser.validateHeaders(headers)
		);
	},

	async parse(csvContent: string): Promise<ParseResult> {
		const parser = detectUnderlyingParser(csvContent);
		if (!parser) {
			return {
				success: false,
				trades: [],
				errors: [
					{
						row: 0,
						message:
							"Could not detect underlying Apex CSV format (expected Rithmic, Tradovate, TopstepX/ProjectX, or NinjaTrader-style headers).",
					},
				],
				warnings: [],
				totalRows: 0,
				parsedRows: 0,
				skippedRows: 0,
			};
		}

		const result = await parser.parse(csvContent);
		return {
			...result,
			warnings: [
				`Detected underlying format: ${parser.name}`,
				...result.warnings,
			],
		};
	},
};
