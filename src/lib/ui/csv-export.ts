/**
 * CSV Export Utility
 * Client-side CSV generation for exporting analytics data
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ExportableTrade {
	exitTime: Date | string | null;
	entryTime: Date | string;
	symbol: string;
	direction: string;
	quantity: string;
	entryPrice: string;
	exitPrice: string | null;
	realizedPnl: string | null;
	netPnl: string | null;
	fees: string | null;
	rMultiple: number | null;
	durationMinutes: number | null;
	strategyName: string | null;
	tags: string[];
	rating: number | null;
	isReviewed: boolean;
	notes: string | null;
}

// =============================================================================
// CSV ESCAPE HELPERS
// =============================================================================

/**
 * Escape a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSVValue(
	value: string | number | boolean | null | undefined,
): string {
	if (value === null || value === undefined) {
		return "";
	}

	const stringValue = String(value);

	// If the value contains special characters, wrap in quotes and escape internal quotes
	if (
		stringValue.includes(",") ||
		stringValue.includes('"') ||
		stringValue.includes("\n") ||
		stringValue.includes("\r")
	) {
		// Escape double quotes by doubling them
		const escaped = stringValue.replace(/"/g, '""');
		return `"${escaped}"`;
	}

	return stringValue;
}

/**
 * Format a date for CSV export
 */
function formatDateForCSV(date: Date | string | null | undefined): string {
	if (!date) return "";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toISOString();
}

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number | null): string {
	if (minutes === null || minutes === undefined) return "";

	if (minutes < 60) {
		return `${Math.round(minutes)}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = Math.round(minutes % 60);

	if (hours < 24) {
		return remainingMinutes > 0
			? `${hours}h ${remainingMinutes}m`
			: `${hours}h`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;
	return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Truncate notes to a reasonable length for CSV
 */
function truncateNotes(notes: string | null, maxLength = 500): string {
	if (!notes) return "";
	if (notes.length <= maxLength) return notes;
	return `${notes.substring(0, maxLength)}...`;
}

// =============================================================================
// CSV GENERATION
// =============================================================================

/**
 * Convert trades data to CSV format
 */
export function tradesToCSV(trades: ExportableTrade[]): string {
	const headers = [
		"Exit Date/Time",
		"Entry Date/Time",
		"Symbol",
		"Direction",
		"Quantity",
		"Entry Price",
		"Exit Price",
		"Gross P&L",
		"Net P&L",
		"Fees",
		"R-Multiple",
		"Duration",
		"Strategy",
		"Tags",
		"Rating",
		"Reviewed",
		"Notes",
	];

	const rows = trades.map((trade) => [
		escapeCSVValue(formatDateForCSV(trade.exitTime)),
		escapeCSVValue(formatDateForCSV(trade.entryTime)),
		escapeCSVValue(trade.symbol),
		escapeCSVValue(trade.direction),
		escapeCSVValue(trade.quantity),
		escapeCSVValue(trade.entryPrice),
		escapeCSVValue(trade.exitPrice),
		escapeCSVValue(trade.realizedPnl),
		escapeCSVValue(trade.netPnl),
		escapeCSVValue(trade.fees),
		escapeCSVValue(trade.rMultiple?.toFixed(2)),
		escapeCSVValue(formatDuration(trade.durationMinutes)),
		escapeCSVValue(trade.strategyName),
		escapeCSVValue(trade.tags.join("; ")),
		escapeCSVValue(trade.rating),
		escapeCSVValue(trade.isReviewed ? "Yes" : "No"),
		escapeCSVValue(truncateNotes(trade.notes)),
	]);

	const csvContent = [
		headers.join(","),
		...rows.map((row) => row.join(",")),
	].join("\n");

	return csvContent;
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(
	prefix = "traderlog_trades",
	hasFilters = false,
): string {
	const date = new Date().toISOString().split("T")[0];
	const suffix = hasFilters ? "_filtered" : "";
	return `${prefix}_${date}${suffix}.csv`;
}

/**
 * Trigger a CSV download in the browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.setAttribute("href", url);
	link.setAttribute("download", filename);
	link.style.visibility = "hidden";

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up the URL object
	URL.revokeObjectURL(url);
}

/**
 * Export trades to CSV and trigger download
 */
export function exportTradesToCSV(
	trades: ExportableTrade[],
	hasFilters = false,
): void {
	const csvContent = tradesToCSV(trades);
	const filename = generateExportFilename("traderlog_trades", hasFilters);
	downloadCSV(csvContent, filename);
}
