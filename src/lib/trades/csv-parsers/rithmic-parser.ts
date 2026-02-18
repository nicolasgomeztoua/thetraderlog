import type { CSVParser, ParseError, ParseResult } from "./types";
import {
	buildTradesFromFills,
	getFilledValue,
	hasRequiredHeaders,
	isFilledStatus,
	isLikelyDataRow,
	normalizeFuturesSymbol,
	normalizeHeader,
	normalizeHeaders,
	parseCSVLine,
	parseDate,
	parseNumber,
	parseSide,
	splitCSVLines,
} from "./utils";

function isCompletedOrdersHeader(headers: string[]): boolean {
	const normalized = new Set(normalizeHeaders(headers));
	const required = [
		"account",
		"status",
		"remarks",
		"buysell",
		"symbol",
		"avgfillprice",
	];

	return required.every((header) => normalized.has(header));
}

function parseCompletedOrdersSection(csvContent: string): {
	headers: string[];
	rows: Record<string, string>[];
} {
	const lines = splitCSVLines(csvContent);
	let headerIndex = -1;
	let headers: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line || !isLikelyDataRow(line)) continue;

		const parsedHeaders = parseCSVLine(line);
		if (isCompletedOrdersHeader(parsedHeaders)) {
			headerIndex = i;
			headers = parsedHeaders;
			break;
		}
	}

	if (headerIndex < 0 || headers.length === 0) {
		return { headers: [], rows: [] };
	}

	const rows: Record<string, string>[] = [];
	for (let i = headerIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim().length === 0) continue;

		// Stop if we hit a different section title in mixed exports.
		if (!line.includes(",")) {
			break;
		}

		const values = parseCSVLine(line);
		const row: Record<string, string> = {};

		for (let col = 0; col < headers.length; col++) {
			const header = headers[col];
			if (!header) continue;
			const normalizedHeader = normalizeHeader(header);
			if (!normalizedHeader) continue;

			const value = values[col]?.trim() ?? "";
			if (row[normalizedHeader] && !value) {
				continue;
			}
			row[normalizedHeader] = value;
		}

		rows.push(row);
	}

	return { headers, rows };
}

/**
 * Rithmic (R | Trader) CSV Parser
 *
 * Parses mixed section exports and only consumes the Completed Orders section.
 */
export const rithmicParser: CSVParser = {
	platform: "rithmic",
	name: "Rithmic (R | Trader)",
	description: "Import trades from Rithmic Completed Orders CSV",

	getExpectedColumns(): string[] {
		return [
			"Account",
			"Status",
			"Remarks",
			"Buy/Sell",
			"Qty Filled",
			"Symbol",
			"Avg Fill Price",
			"Update Time (EDT)",
			"Commission",
		];
	},

	validateHeaders(headers: string[]): boolean {
		return (
			hasRequiredHeaders(headers, [
				"Account",
				"Status",
				"Remarks",
				"Buy/Sell",
				"Symbol",
				"Avg Fill Price",
			]) && hasRequiredHeaders(headers, ["Qty Filled"])
		);
	},

	async parse(csvContent: string): Promise<ParseResult> {
		const { rows } = parseCompletedOrdersSection(csvContent);
		const errors: ParseError[] = [];
		const warnings: string[] = [];

		if (rows.length === 0) {
			return {
				success: false,
				trades: [],
				errors: [
					{
						row: 0,
						message:
							"Could not find a Completed Orders section in this Rithmic export.",
					},
				],
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

			const symbol = normalizeFuturesSymbol(row.symbol ?? "");
			const side = parseSide(row.buysell);
			const quantity = parseNumber(
				getFilledValue(row, ["Qty Filled", "Qty To Fill"]),
			);
			const priceRaw = row.avgfillprice?.trim() ?? "";
			const price = parseNumber(priceRaw);
			const time = parseDate(
				getFilledValue(row, ["Update Time (EDT)", "Create Time (EDT)"]),
			);
			const commission = parseNumber(row.commission);
			const commissionFillRate = parseNumber(row.commissionfillrate);
			const fees =
				commission ??
				(commissionFillRate !== null && quantity !== null
					? commissionFillRate * quantity
					: undefined);

			if (!symbol) {
				errors.push({
					row: rowNumber,
					field: "Symbol",
					message: "Missing symbol",
				});
				skippedRows++;
				continue;
			}
			if (!side) {
				errors.push({
					row: rowNumber,
					field: "Buy/Sell",
					message: "Buy/Sell must be B/S or Buy/Sell",
				});
				skippedRows++;
				continue;
			}
			if (quantity === null || quantity <= 0) {
				errors.push({
					row: rowNumber,
					field: "Qty Filled",
					message: "Qty Filled must be a positive number",
				});
				skippedRows++;
				continue;
			}
			if (price === null) {
				errors.push({
					row: rowNumber,
					field: "Avg Fill Price",
					message: "Avg Fill Price must be a valid number",
				});
				skippedRows++;
				continue;
			}
			if (!time) {
				errors.push({
					row: rowNumber,
					field: "Update Time (EDT)",
					message: "Update Time must be a valid date",
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
				fees,
				externalId:
					row.ordernumber ||
					row.currentsequencenumber ||
					row.originalsequencenumber ||
					undefined,
			});
		}

		const { trades, unmatchedLots, unmatchedQuantity } =
			buildTradesFromFills(fills);
		if (skippedUnfilledRows > 0) {
			warnings.push(`${skippedUnfilledRows} non-filled rows were ignored.`);
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
