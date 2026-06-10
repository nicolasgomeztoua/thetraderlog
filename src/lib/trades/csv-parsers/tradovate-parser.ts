import type { CSVParser, ParsedTrade, ParseError, ParseResult } from "./types";
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
 * Handles two Tradovate exports:
 * 1. "Orders" report — filled/canceled order rows; trades are reconstructed
 *    from fills. This export does NOT include realized P&L.
 * 2. "Position History" — one row per closed position WITH realized P&L (the
 *    "P/L" column) plus buy/sell prices and timestamps. Preferred, because it
 *    carries accurate broker P&L instead of reconstructing dollars from prices.
 */

/** Detect the Position History export by its distinctive headers. */
function isTradovatePositionHistory(headers: string[]): boolean {
	return hasRequiredHeaders(headers, [
		"Position ID",
		"Buy Price",
		"Sell Price",
		"P/L",
	]);
}

/**
 * Parse the Tradovate "Position History" export. Each row is a closed, paired
 * position: the trader both bought and sold, so direction is inferred from
 * which leg executed first, and realized P&L comes straight from the P/L column.
 */
function parsePositionHistory(rows: Record<string, string>[]): ParseResult {
	const errors: ParseError[] = [];
	const warnings: string[] = [];
	const trades: ParsedTrade[] = [];
	let skippedRows = 0;
	let skippedOpenRows = 0;

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (!row) continue;
		const rowNumber = i + 2;

		const symbol = normalizeFuturesSymbol(
			getFilledValue(row, ["Product", "Contract"]),
		);
		const buyPrice = parseNumber(
			getFilledValue(row, ["Buy Price", "Avg. Buy"]),
		);
		const sellPrice = parseNumber(
			getFilledValue(row, ["Sell Price", "Avg. Sell"]),
		);
		const quantity = parseNumber(
			getFilledValue(row, ["Paired Qty", "Bought", "Sold"]),
		);
		const pnl = parseNumber(getFilledValue(row, ["P/L"]));
		const boughtTime = parseDate(getFilledValue(row, ["Bought Timestamp"]));
		const soldTime = parseDate(getFilledValue(row, ["Sold Timestamp"]));

		if (!symbol) {
			errors.push({
				row: rowNumber,
				field: "Product",
				message: "Missing symbol",
			});
			skippedRows++;
			continue;
		}
		// An open position lacks one of the paired legs — skip it (not an error).
		if (buyPrice === null || sellPrice === null || !boughtTime || !soldTime) {
			skippedRows++;
			skippedOpenRows++;
			continue;
		}
		if (quantity === null || quantity <= 0) {
			errors.push({
				row: rowNumber,
				field: "Paired Qty",
				message: "Quantity must be a positive number",
			});
			skippedRows++;
			continue;
		}

		// Whichever leg executed first opened the position.
		const isLong = boughtTime.getTime() <= soldTime.getTime();
		trades.push({
			symbol,
			direction: isLong ? "long" : "short",
			entryPrice: (isLong ? buyPrice : sellPrice).toString(),
			entryTime: isLong ? boughtTime : soldTime,
			exitPrice: (isLong ? sellPrice : buyPrice).toString(),
			exitTime: isLong ? soldTime : boughtTime,
			quantity: quantity.toString(),
			profit: pnl !== null ? pnl.toString() : undefined,
			externalId: getFilledValue(row, ["Position ID"]) || undefined,
		});
	}

	if (skippedOpenRows > 0) {
		warnings.push(`${skippedOpenRows} open position(s) were skipped.`);
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
}

export const tradovateParser: CSVParser = {
	platform: "tradovate",
	name: "Tradovate",
	description:
		"Import from Tradovate — Orders report, or Position History (includes P&L)",

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
		if (isTradovatePositionHistory(headers)) return true;

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
		const { headers, rows } = parseCSVRows(csvContent);
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

		// The Position History export carries realized P&L — use it directly.
		if (isTradovatePositionHistory(headers)) {
			return parsePositionHistory(rows);
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
