import type { CSVParser, ParsedTrade, ParseError, ParseResult } from "./types";

/**
 * ProjectX CSV Parser
 *
 * Parses the Trades CSV export from ProjectX platform.
 * Users manually input stop loss values after import.
 *
 * Trades CSV columns:
 * - Id, ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size, Type, etc.
 */

// Futures contract month codes
const _MONTH_CODES: Record<string, string> = {
	F: "January",
	G: "February",
	H: "March",
	J: "April",
	K: "May",
	M: "June",
	N: "July",
	Q: "August",
	U: "September",
	V: "October",
	X: "November",
	Z: "December",
};

/**
 * Strip expiration suffix from contract name
 * MNQZ5 -> MNQ, ESZ5 -> ES, 6EZ5 -> 6E
 */
function stripExpiration(contractName: string): string {
	const match = contractName.match(/^(.+?)[FGHJKMNQUVXZ]\d{1,2}$/i);
	if (match?.[1]) {
		return match[1];
	}
	return contractName;
}

/**
 * Parse ProjectX date format: "11/14/2025 16:14:10 +01:00"
 */
function parseProjectXDate(dateStr: string): Date {
	if (!dateStr || dateStr.trim() === "") {
		return new Date();
	}

	const trimmed = dateStr.trim();
	const date = new Date(trimmed);
	if (!Number.isNaN(date.getTime())) {
		return date;
	}

	const match = trimmed.match(
		/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([+-]\d{2}:\d{2})?/,
	);
	if (match) {
		const [, month, day, year, hour, min, sec, tz] = match;
		const isoString = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}T${hour?.padStart(2, "0")}:${min}:${sec}${tz || "+00:00"}`;
		const parsed = new Date(isoString);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return new Date();
}

/**
 * Parse CSV content handling quoted fields and commas
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current.trim());

	return result;
}

/**
 * Parse a full CSV into rows with header mapping
 */
function parseCSV(csvContent: string): {
	headers: string[];
	rows: Record<string, string>[];
} {
	const lines = csvContent
		.trim()
		.split("\n")
		.filter((line) => line.trim() !== "");

	if (lines.length < 1) {
		return { headers: [], rows: [] };
	}

	const firstLine = lines[0];
	if (!firstLine) {
		return { headers: [], rows: [] };
	}
	const headers = parseCSVLine(firstLine);
	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const lineContent = lines[i];
		if (!lineContent) continue;
		const values = parseCSVLine(lineContent);
		const row: Record<string, string> = {};
		headers.forEach((header, index) => {
			row[header.toLowerCase().trim()] = values[index] || "";
		});
		rows.push(row);
	}

	return { headers, rows };
}

export const projectxParser: CSVParser = {
	platform: "projectx",
	name: "ProjectX",
	description: "Import trades from ProjectX platform",

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
		];
	},

	validateHeaders(headers: string[]): boolean {
		const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
		const requiredColumns = [
			"id",
			"contractname",
			"enteredat",
			"exitedat",
			"entryprice",
			"exitprice",
			"size",
			"type",
		];

		return requiredColumns.every((col) =>
			normalizedHeaders.some((h) => h === col || h.replace(/\s+/g, "") === col),
		);
	},

	async parse(csvContent: string): Promise<ParseResult> {
		return parseProjectXTrades(csvContent);
	},
};

/**
 * Parse ProjectX Trades CSV
 */
function parseProjectXTrades(tradesCSV: string): ParseResult {
	const trades: ParsedTrade[] = [];
	const errors: ParseError[] = [];
	const warnings: string[] = [];

	// Parse trades CSV
	const { rows: tradeRows } = parseCSV(tradesCSV);

	if (tradeRows.length === 0) {
		return {
			success: false,
			trades: [],
			errors: [
				{
					row: 0,
					message: "CSV must have headers and at least one data row",
				},
			],
			warnings: [],
			totalRows: 0,
			parsedRows: 0,
			skippedRows: 0,
		};
	}

	let parsedRows = 0;
	let skippedRows = 0;

	for (let i = 0; i < tradeRows.length; i++) {
		const row = tradeRows[i];
		if (!row) continue;

		try {
			const contractName = row.contractname || "";
			const enteredAt = row.enteredat || "";
			const exitedAt = row.exitedat || "";
			const entryPrice = row.entryprice || "";
			const exitPrice = row.exitprice || "";
			const fees = row.fees || "";
			const pnl = row.pnl || "";
			const size = row.size || "";
			const type = row.type || "";
			const externalId = row.id || "";
			const commissions = row.commissions || "";

			// Validate required fields
			if (!contractName || !entryPrice || !size || !type) {
				errors.push({
					row: i + 2,
					message: `Missing required fields`,
					rawData: JSON.stringify(row),
				});
				skippedRows++;
				continue;
			}

			// Parse direction
			const direction = type.toLowerCase() === "long" ? "long" : "short";

			// Parse dates
			const entryTime = parseProjectXDate(enteredAt);
			const exitTime = parseProjectXDate(exitedAt);

			// Strip expiration from symbol
			const symbol = stripExpiration(contractName);

			// Calculate total fees
			let totalFees = parseFloat(fees) || 0;
			if (commissions && parseFloat(commissions)) {
				totalFees += parseFloat(commissions);
			}

			const trade: ParsedTrade = {
				symbol: symbol.toUpperCase(),
				instrumentType: "futures",
				direction,
				entryPrice: entryPrice,
				entryTime,
				exitPrice: exitPrice,
				exitTime,
				quantity: size,
				fees: totalFees > 0 ? totalFees.toFixed(2) : undefined,
				profit: pnl || undefined,
				externalId: externalId || undefined,
			};

			trades.push(trade);
			parsedRows++;
		} catch (err) {
			errors.push({
				row: i + 2,
				message: `Parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
			});
			skippedRows++;
		}
	}

	if (parsedRows > 0 && skippedRows > 0) {
		warnings.push(
			`${skippedRows} row(s) were skipped due to missing or invalid data.`,
		);
	}

	return {
		success: parsedRows > 0,
		trades,
		errors,
		warnings,
		totalRows: tradeRows.length,
		parsedRows,
		skippedRows,
	};
}
