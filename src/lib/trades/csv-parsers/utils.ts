import type { ParsedTrade } from "./types";

const EPSILON = 1e-8;

export interface ParsedCSVTable {
	headers: string[];
	rows: Record<string, string>[];
}

export interface NormalizedFill {
	symbol: string;
	side: "buy" | "sell";
	quantity: number;
	price: string;
	time: Date;
	fees?: number;
	externalId?: string;
}

interface OpenLot {
	direction: "long" | "short";
	quantity: number;
	entryPrice: string;
	entryTime: Date;
	feePerUnit: number;
	externalId?: string;
}

export function normalizeHeader(header: string): string {
	return header
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]/g, "");
}

export function normalizeHeaders(headers: string[]): string[] {
	return headers.map((header) => normalizeHeader(header));
}

export function hasRequiredHeaders(
	headers: string[],
	requiredHeaders: string[],
): boolean {
	const normalizedHeaders = new Set(normalizeHeaders(headers));
	return requiredHeaders.every((header) =>
		normalizedHeaders.has(normalizeHeader(header)),
	);
}

export function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			const nextChar = line[i + 1];
			if (inQuotes && nextChar === '"') {
				current += '"';
				i++;
				continue;
			}
			inQuotes = !inQuotes;
			continue;
		}

		if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
			continue;
		}

		current += char;
	}

	result.push(current.trim());
	return result;
}

export function splitCSVLines(csvContent: string): string[] {
	return csvContent
		.replace(/\uFEFF/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n");
}

export function parseCSVRows(
	csvContent: string,
	options?: { headerLineIndex?: number },
): ParsedCSVTable {
	const lines = splitCSVLines(csvContent);
	const headerLineIndex =
		options?.headerLineIndex ??
		lines.findIndex((line) => line.trim().length > 0);

	if (headerLineIndex < 0) {
		return { headers: [], rows: [] };
	}

	const headerLine = lines[headerLineIndex];
	if (!headerLine) {
		return { headers: [], rows: [] };
	}

	const headers = parseCSVLine(headerLine);
	const rows: Record<string, string>[] = [];

	for (let i = headerLineIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim().length === 0) {
			continue;
		}

		const values = parseCSVLine(line);
		const row: Record<string, string> = {};

		for (let col = 0; col < headers.length; col++) {
			const header = headers[col];
			if (!header) continue;

			const normalizedHeader = normalizeHeader(header);
			if (!normalizedHeader) continue;

			const nextValue = values[col]?.trim() ?? "";
			if (row[normalizedHeader] && !nextValue) {
				continue;
			}
			row[normalizedHeader] = nextValue;
		}

		rows.push(row);
	}

	return { headers, rows };
}

export function parseNumber(value: string | undefined | null): number | null {
	if (!value) return null;

	const normalized = value.trim().replace(/[$,%]/g, "").replace(/,/g, "");
	if (!normalized) return null;

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(value: string | undefined | null): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	const direct = new Date(trimmed);
	if (!Number.isNaN(direct.getTime())) {
		return direct;
	}

	const isoNoTimezone = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
	);
	if (isoNoTimezone) {
		const [, year, month, day, hour, minute, second] = isoNoTimezone;
		const parsed = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second ?? "0"),
		);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	const usDateTime = trimmed.match(
		/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
	);
	if (usDateTime) {
		const [
			,
			monthRaw,
			dayRaw,
			yearRaw,
			hourRaw,
			minuteRaw,
			secondRaw,
			meridiem,
		] = usDateTime;
		const month = Number(monthRaw ?? "0");
		const day = Number(dayRaw ?? "0");
		const yearValue = yearRaw ?? "";
		const yearNumber = Number(yearValue);
		const year = yearValue.length === 2 ? 2000 + yearNumber : yearNumber;

		let hour = Number(hourRaw ?? "0");
		if (meridiem) {
			const normalizedMeridiem = meridiem.toUpperCase();
			if (normalizedMeridiem === "PM" && hour < 12) hour += 12;
			if (normalizedMeridiem === "AM" && hour === 12) hour = 0;
		}

		const parsed = new Date(
			year,
			month - 1,
			day,
			hour,
			Number(minuteRaw),
			Number(secondRaw ?? "0"),
		);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return null;
}

export function normalizeFuturesSymbol(symbol: string): string {
	const trimmed = symbol.trim().toUpperCase();
	if (!trimmed) return "";

	const firstToken = trimmed.split(/\s+/)[0] ?? trimmed;
	const compact = firstToken.replace(/[^A-Z0-9]/g, "");
	const expirationMatch = compact.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/i);

	return expirationMatch?.[1]?.toUpperCase() ?? compact;
}

function toDecimalString(value: number, decimals = 8): string {
	const rounded = Number(value.toFixed(decimals));
	return Number.isInteger(rounded) ? rounded.toString() : rounded.toString();
}

function isSameDirection(
	fillSide: "buy" | "sell",
	direction: "long" | "short",
): boolean {
	return (
		(fillSide === "buy" && direction === "long") ||
		(fillSide === "sell" && direction === "short")
	);
}

export function buildTradesFromFills(fills: NormalizedFill[]): {
	trades: ParsedTrade[];
	unmatchedLots: number;
	unmatchedQuantity: number;
} {
	const trades: ParsedTrade[] = [];
	const openLotsBySymbol = new Map<string, OpenLot[]>();

	const orderedFills = fills
		.map((fill, index) => ({ ...fill, index }))
		.sort((a, b) => {
			const timeDiff = a.time.getTime() - b.time.getTime();
			if (timeDiff !== 0) return timeDiff;
			return a.index - b.index;
		});

	for (const fill of orderedFills) {
		const normalizedSymbol = normalizeFuturesSymbol(fill.symbol);
		if (!normalizedSymbol) continue;

		let remainingQuantity = fill.quantity;
		if (remainingQuantity <= EPSILON) {
			continue;
		}

		const fillFeePerUnit =
			fill.fees !== undefined && fill.quantity > EPSILON
				? fill.fees / fill.quantity
				: 0;

		const openLots = openLotsBySymbol.get(normalizedSymbol) ?? [];
		const oppositeDirection = fill.side === "buy" ? "short" : "long";

		let lotIndex = 0;
		while (remainingQuantity > EPSILON && lotIndex < openLots.length) {
			const openLot = openLots[lotIndex];
			if (!openLot || openLot.direction !== oppositeDirection) {
				lotIndex++;
				continue;
			}

			const closedQuantity = Math.min(openLot.quantity, remainingQuantity);
			const combinedFees =
				(openLot.feePerUnit + fillFeePerUnit) * closedQuantity;
			const roundedFees = Number(combinedFees.toFixed(2));

			const externalId =
				openLot.externalId && fill.externalId
					? `${openLot.externalId}:${fill.externalId}`
					: (openLot.externalId ?? fill.externalId);

			trades.push({
				symbol: normalizedSymbol,
				instrumentType: "futures",
				direction: openLot.direction,
				entryPrice: openLot.entryPrice,
				entryTime: openLot.entryTime,
				exitPrice: fill.price,
				exitTime: fill.time,
				quantity: toDecimalString(closedQuantity),
				fees:
					Math.abs(roundedFees) > EPSILON ? roundedFees.toFixed(2) : undefined,
				externalId,
			});

			openLot.quantity -= closedQuantity;
			remainingQuantity -= closedQuantity;

			if (openLot.quantity <= EPSILON) {
				openLots.splice(lotIndex, 1);
			}
		}

		if (remainingQuantity > EPSILON) {
			openLots.push({
				direction: fill.side === "buy" ? "long" : "short",
				quantity: remainingQuantity,
				entryPrice: fill.price,
				entryTime: fill.time,
				feePerUnit: fillFeePerUnit,
				externalId: fill.externalId,
			});
		}

		openLotsBySymbol.set(normalizedSymbol, openLots);
	}

	let unmatchedLots = 0;
	let unmatchedQuantity = 0;
	for (const lots of openLotsBySymbol.values()) {
		for (const lot of lots) {
			if (Math.abs(lot.quantity) <= EPSILON) continue;
			unmatchedLots += 1;
			unmatchedQuantity += lot.quantity;
		}
	}

	return { trades, unmatchedLots, unmatchedQuantity };
}

export function parseSide(value: string | undefined): "buy" | "sell" | null {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return null;
	if (normalized === "b" || normalized === "buy") return "buy";
	if (normalized === "s" || normalized === "sell") return "sell";
	return null;
}

export function isEntryExitValue(value: string | undefined): boolean {
	const normalized = value?.trim().toLowerCase();
	return normalized === "entry" || normalized === "exit";
}

export function isFilledStatus(status: string | undefined): boolean {
	const normalized = status?.trim().toLowerCase();
	return normalized === "filled" || normalized === "fill";
}

export function getFilledValue(
	row: Record<string, string>,
	candidates: string[],
): string {
	for (const candidate of candidates) {
		const key = normalizeHeader(candidate);
		const value = row[key];
		if (value && value.trim().length > 0) {
			return value.trim();
		}
	}
	return "";
}

export function isLikelyDataRow(line: string): boolean {
	return line.trim().length > 0 && line.includes(",");
}

export function isOppositeFill(
	fillSide: "buy" | "sell",
	openDirection: "long" | "short",
): boolean {
	return !isSameDirection(fillSide, openDirection);
}
