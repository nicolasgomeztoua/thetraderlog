import type { CSVParser, ParseError, ParseResult } from "./types";
import {
	buildTradesFromFills,
	getFilledValue,
	hasRequiredHeaders,
	isFilledStatus,
	normalizeFuturesSymbol,
	parseCSVRows,
	parseDate,
	parseNumber,
	parseSide,
} from "./utils";

/**
 * Tradovate CSV Parser
 *
 * Tradovate order reports contain filled and canceled rows.
 * This parser consumes filled rows only and reconstructs round-trip trades.
 */
export const tradovateParser: CSVParser = {
	platform: "tradovate",
	name: "Tradovate",
	description: "Import trades from Tradovate order report CSV",

	getExpectedColumns(): string[] {
		return [
			"orderId",
			"B/S",
			"Contract",
			"Status",
			"filledQty",
			"avgPrice",
			"Fill Time",
		];
	},

	validateHeaders(headers: string[]): boolean {
		const hasCoreHeaders = hasRequiredHeaders(headers, [
			"orderId",
			"B/S",
			"Contract",
			"Status",
		]);
		const hasTimeHeader =
			hasRequiredHeaders(headers, ["Fill Time"]) ||
			hasRequiredHeaders(headers, ["Timestamp"]);

		return hasCoreHeaders && hasTimeHeader;
	},

	async parse(csvContent: string): Promise<ParseResult> {
		const { rows } = parseCSVRows(csvContent);
		const errors: ParseError[] = [];
		const warnings: string[] = [];

		if (rows.length === 0) {
			return {
				success: false,
				trades: [],
				errors: [{ row: 0, message: "CSV must include headers and data rows" }],
				warnings: [],
				totalRows: 0,
				parsedRows: 0,
				skippedRows: 0,
			};
		}

		let skippedRows = 0;
		let skippedUnfilledRows = 0;

		const fills: Array<{
			symbol: string;
			side: "buy" | "sell";
			quantity: number;
			price: string;
			time: Date;
			fees?: number;
			externalId?: string;
		}> = [];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;

			const rowNumber = i + 2;
			if (!isFilledStatus(row.status)) {
				skippedRows++;
				skippedUnfilledRows++;
				continue;
			}

			const symbol = normalizeFuturesSymbol(
				getFilledValue(row, ["Contract", "Product"]),
			);
			const side = parseSide(getFilledValue(row, ["B/S", "Buy/Sell"]));
			const quantity = parseNumber(
				getFilledValue(row, ["filledQty", "Filled Qty", "Quantity"]),
			);
			const priceRaw = getFilledValue(row, [
				"avgPrice",
				"Avg Fill Price",
				"decimalFillAvg",
			]);
			const price = parseNumber(priceRaw);
			const time = parseDate(
				getFilledValue(row, ["Fill Time", "Timestamp", "Date"]),
			);

			if (!symbol) {
				errors.push({
					row: rowNumber,
					field: "Contract",
					message: "Missing symbol",
				});
				skippedRows++;
				continue;
			}
			if (!side) {
				errors.push({
					row: rowNumber,
					field: "B/S",
					message: "B/S must be Buy or Sell",
				});
				skippedRows++;
				continue;
			}
			if (quantity === null || quantity <= 0) {
				errors.push({
					row: rowNumber,
					field: "filledQty",
					message: "filledQty must be a positive number",
				});
				skippedRows++;
				continue;
			}
			if (price === null) {
				errors.push({
					row: rowNumber,
					field: "avgPrice",
					message: "avgPrice must be a valid number",
				});
				skippedRows++;
				continue;
			}
			if (!time) {
				errors.push({
					row: rowNumber,
					field: "Fill Time",
					message: "Fill Time must be a valid date",
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
				fees: parseNumber(row.commission) ?? undefined,
				externalId: row.orderid || undefined,
			});
		}

		const { trades, unmatchedLots, unmatchedQuantity } =
			buildTradesFromFills(fills);
		if (skippedUnfilledRows > 0) {
			warnings.push(
				`${skippedUnfilledRows} unfilled/canceled rows were ignored.`,
			);
		}
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
