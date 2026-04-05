import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 */
export function formatCurrency(
	value: number | string | null | undefined,
	currency = "USD",
): string {
	if (value === null || value === undefined) return "-";
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (Number.isNaN(num)) return "-";

	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(num);
}

/**
 * Format a number with sign (+ or -)
 */
export function formatPnL(
	value: number | string | null | undefined,
	currency = "USD",
): string {
	if (value === null || value === undefined) return "-";
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (Number.isNaN(num)) return "-";

	const formatted = formatCurrency(Math.abs(num), currency);
	if (num > 0) return `+${formatted}`;
	if (num < 0) return `-${formatted.replace("-", "")}`;
	return formatted;
}

/**
 * Format a percentage
 */
export function formatPercent(
	value: number | string | null | undefined,
	decimals = 1,
): string {
	if (value === null || value === undefined) return "-";
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (Number.isNaN(num)) return "-";

	return `${num >= 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

/**
 * Format a number with appropriate precision
 */
export function formatNumber(
	value: number | string | null | undefined,
	decimals = 2,
): string {
	if (value === null || value === undefined) return "-";
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (Number.isNaN(num)) return "-";

	return num.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

/**
 * Format a date for display
 * If timezone is provided, displays the date in that timezone
 */
export function formatDate(
	date: Date | string | null | undefined,
	options: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	},
	timezone?: string,
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	const opts = timezone ? { ...options, timeZone: timezone } : options;
	return d.toLocaleDateString("en-US", opts);
}

/**
 * Format a time for display
 * If timezone is provided, displays the time in that timezone
 */
export function formatTime(
	date: Date | string | null | undefined,
	options: Intl.DateTimeFormatOptions = {
		hour: "2-digit",
		minute: "2-digit",
	},
	timezone?: string,
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	const opts = timezone ? { ...options, timeZone: timezone } : options;
	return d.toLocaleTimeString("en-US", opts);
}

/**
 * Format date and time together
 * If timezone is provided, displays in that timezone
 */
export function formatDateTime(
	date: Date | string | null | undefined,
	timezone?: string,
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	return `${formatDate(d, undefined, timezone)} ${formatTime(d, undefined, timezone)}`;
}

/**
 * Get PnL color class based on value
 */
export function getPnLColorClass(
	value: number | string | null | undefined,
): string {
	if (value === null || value === undefined) return "text-muted-foreground";
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (Number.isNaN(num)) return "text-muted-foreground";

	if (num > 0) return "text-profit";
	if (num < 0) return "text-loss";
	return "text-breakeven";
}

/**
 * Safely extract an error message from an unknown catch value.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return fallback;
}

/**
 * Decode common HTML entities produced by PostgreSQL's ts_headline.
 */
function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

/**
 * Parse a ts_headline snippet (containing <mark> tags) into safe segments.
 * Use this instead of dangerouslySetInnerHTML to render search highlights.
 */
export function parseHighlightedSnippet(
	snippet: string,
): Array<{ text: string; highlighted: boolean }> {
	const segments: Array<{ text: string; highlighted: boolean }> = [];
	const regex = /<mark>(.*?)<\/mark>/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null = regex.exec(snippet);

	while (match !== null) {
		if (match.index > lastIndex) {
			segments.push({
				text: decodeHtmlEntities(snippet.slice(lastIndex, match.index)),
				highlighted: false,
			});
		}
		segments.push({
			text: decodeHtmlEntities(match[1] ?? ""),
			highlighted: true,
		});
		lastIndex = regex.lastIndex;
		match = regex.exec(snippet);
	}

	if (lastIndex < snippet.length) {
		segments.push({
			text: decodeHtmlEntities(snippet.slice(lastIndex)),
			highlighted: false,
		});
	}

	return segments;
}

// NOTE: calculateWinRate and calculateProfitFactor have been moved to
// @/lib/stats-calculations.ts for consistency with aggregate stats
