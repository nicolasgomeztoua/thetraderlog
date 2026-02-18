import type { CSVParser, ParseError, ParseResult } from "./types";
import {
	buildTradesFromFills,
	hasRequiredHeaders,
	isEntryExitValue,
	normalizeFuturesSymbol,
	parseCSVRows,
	parseDate,
	parseNumber,
	parseSide,
} from "./utils";

/**
 * NinjaTrader CSV Parser
 *
 * Parses execution-level exports and reconstructs round-trip trades by matching
 * opposing fills per symbol in chronological order.
 */
export const ninjatraderParser: CSVParser = {
	platform: "ninjatrader",
	name: "NinjaTrader",
	description: "Import trades from NinjaTrader execution export",

	getExpectedColumns(): string[] {
		return [
			"Instrument",
			"Action",
			"Quantity",
			"Price",
			"Time",
			"ID",
			"E/X",
			"Commission",
		];
	},

	validateHeaders(headers: string[]): boolean {
		return hasRequiredHeaders(headers, [
			"Instrument",
			"Action",
			"Quantity",
			"Price",
			"Time",
			"ID",
			"E/X",
		]);
	},

	async parse(csvContent: string): Promise<ParseResult> {
		const { rows } = parseCSVRows(csvContent);
		const errors: ParseError[] = [];
		const warnings: string[] = [];

		if (rows.length === 0) {
			return {
				success: false,
				trades: [],
				errors: [
					{
						row: 0,
						message: "CSV must include headers and at least one data row",
					},
				],
				warnings: [],
				totalRows: 0,
				parsedRows: 0,
				skippedRows: 0,
			};
		}

		const fills: Array<{
			symbol: string;
			side: "buy" | "sell";
			quantity: number;
			price: string;
			time: Date;
			fees?: number;
			externalId?: string;
		}> = [];
		let skippedRows = 0;

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;

			const rowNumber = i + 2;
			const symbol = normalizeFuturesSymbol(row.instrument ?? "");
			const side = parseSide(row.action);
			const quantity = parseNumber(row.quantity);
			const priceRaw = row.price?.trim() ?? "";
			const price = parseNumber(priceRaw);
			const time = parseDate(row.time);
			const entryExit = row.ex;
			const commission = parseNumber(row.commission);

			if (!symbol) {
				errors.push({
					row: rowNumber,
					field: "Instrument",
					message: "Missing symbol",
				});
				skippedRows++;
				continue;
			}
			if (!side) {
				errors.push({
					row: rowNumber,
					field: "Action",
					message: "Action must be buy/sell",
				});
				skippedRows++;
				continue;
			}
			if (!isEntryExitValue(entryExit)) {
				errors.push({
					row: rowNumber,
					field: "E/X",
					message: "E/X must be Entry or Exit",
				});
				skippedRows++;
				continue;
			}
			if (quantity === null || quantity <= 0) {
				errors.push({
					row: rowNumber,
					field: "Quantity",
					message: "Quantity must be a positive number",
				});
				skippedRows++;
				continue;
			}
			if (price === null) {
				errors.push({
					row: rowNumber,
					field: "Price",
					message: "Price must be a valid number",
				});
				skippedRows++;
				continue;
			}
			if (!time) {
				errors.push({
					row: rowNumber,
					field: "Time",
					message: "Time must be a valid date",
				});
				skippedRows++;
				continue;
			}

			fills.push({
				symbol,
				side,
				quantity,
				price: priceRaw || price.toString(),
				time,
				fees: commission ?? undefined,
				externalId: row.id || row.orderid || undefined,
			});
		}

		const { trades, unmatchedLots, unmatchedQuantity } =
			buildTradesFromFills(fills);
		if (unmatchedLots > 0) {
			warnings.push(
				`${unmatchedLots} open position lot(s) (${unmatchedQuantity.toFixed(2)} total quantity) were left unmatched and skipped.`,
			);
		}

		return {
			success: trades.length > 0,
			trades,
			errors,
			warnings,
			totalRows: rows.length,
			parsedRows: trades.length,
			skippedRows,
		};
	},
};
