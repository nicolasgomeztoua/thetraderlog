import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

// =============================================================================
// FRONTEND DATE UTILITIES
// =============================================================================

/**
 * Convert a Date to a YYYY-MM-DD string, preserving the local calendar date.
 *
 * USE THIS for frontend → backend API calls when the user clicks a date in the calendar.
 * The backend will handle timezone conversion using the user's preferred timezone.
 *
 * DO NOT USE getDateStringInTimezone() for this purpose - that causes double conversion
 * when the user's browser timezone differs from their preferred timezone.
 *
 * @example
 * // User clicks "Jan 6" in calendar → Date object is Jan 6 00:00 local time
 * const dateString = toDateString(selectedDate); // "2026-01-06"
 * // Backend uses getDayBoundsInTimezone("2026-01-06", userTimezone) to query
 */
export function toDateString(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

// =============================================================================
// TIMEZONE CONVERSION UTILITIES
// =============================================================================

/**
 * Convert a UTC Date to the user's timezone
 * Returns a Date object representing the same instant in the target timezone
 */
export function toUserTimezone(date: Date | string, timezone: string): Date {
	const d = typeof date === "string" ? new Date(date) : date;
	return toZonedTime(d, timezone);
}

/**
 * Get the hour (0-23) of a date in the specified timezone
 */
export function getHourInTimezone(
	date: Date | string,
	timezone: string,
): number {
	const zonedDate = toUserTimezone(date, timezone);
	return zonedDate.getHours();
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday) in the specified timezone
 */
export function getDayOfWeekInTimezone(
	date: Date | string,
	timezone: string,
): number {
	const zonedDate = toUserTimezone(date, timezone);
	return zonedDate.getDay();
}

/**
 * Get a date string (YYYY-MM-DD) in the specified timezone
 * Useful for grouping trades by day in user's local time
 */
export function getDateStringInTimezone(
	date: Date | string,
	timezone: string,
): string {
	return formatInTimeZone(
		typeof date === "string" ? new Date(date) : date,
		timezone,
		"yyyy-MM-dd",
	);
}

/**
 * Get a month string (YYYY-MM) in the specified timezone
 * Useful for grouping trades by month in user's local time
 */
export function getMonthStringInTimezone(
	date: Date | string,
	timezone: string,
): string {
	return formatInTimeZone(
		typeof date === "string" ? new Date(date) : date,
		timezone,
		"yyyy-MM",
	);
}

/**
 * Format a date for display in the specified timezone
 */
export function formatDateInTimezone(
	date: Date | string | null | undefined,
	timezone: string,
	options: {
		format?: string;
		includeYear?: boolean;
	} = {},
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;

	const formatStr =
		options.format ?? (options.includeYear !== false ? "MMM d, yyyy" : "MMM d");
	return formatInTimeZone(d, timezone, formatStr);
}

/**
 * Format a time for display in the specified timezone
 */
export function formatTimeInTimezone(
	date: Date | string | null | undefined,
	timezone: string,
	options: {
		format?: string;
		includeSeconds?: boolean;
	} = {},
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;

	const formatStr =
		options.format ?? (options.includeSeconds ? "HH:mm:ss" : "HH:mm");
	return formatInTimeZone(d, timezone, formatStr);
}

/**
 * Format date and time together in the specified timezone
 */
export function formatDateTimeInTimezone(
	date: Date | string | null | undefined,
	timezone: string,
	options: {
		dateFormat?: string;
		timeFormat?: string;
	} = {},
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;

	const dateStr = options.dateFormat ?? "MMM d, yyyy";
	const timeStr = options.timeFormat ?? "HH:mm";
	return formatInTimeZone(d, timezone, `${dateStr} ${timeStr}`);
}

/**
 * Get a short timezone abbreviation for display
 * e.g., "America/New_York" -> "EST" or "EDT"
 */
export function getTimezoneAbbreviation(timezone: string, date?: Date): string {
	const d = date ?? new Date();
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		timeZoneName: "short",
	});
	const parts = formatter.formatToParts(d);
	const tzPart = parts.find((p) => p.type === "timeZoneName");
	return tzPart?.value ?? timezone;
}

/**
 * Get the UTC offset in hours for a timezone at a given date
 * e.g., "America/New_York" -> -5 or -4 depending on DST
 */
export function getTimezoneOffset(timezone: string, date?: Date): number {
	const d = date ?? new Date();
	const utcDate = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
	const tzDate = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
	return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
}

/**
 * Get the UTC start and end of a day in a specific timezone
 * Useful for querying trades that fall within a specific calendar day
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns { start: Date, end: Date } - UTC dates representing the day boundaries
 *
 * @example
 * // Get Jan 6 in EST (UTC-5)
 * getDayBoundsInTimezone("2026-01-06", "America/New_York")
 * // Returns: { start: 2026-01-06T05:00:00Z, end: 2026-01-07T05:00:00Z }
 */
export function getDayBoundsInTimezone(
	dateString: string,
	timezone: string,
): { start: Date; end: Date } {
	// Parse date components to avoid local timezone issues
	const parts = dateString.split("-").map(Number);
	const year = parts[0] ?? 0;
	const month = parts[1] ?? 1;
	const day = parts[2] ?? 1;

	// Create next day for end boundary
	const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
	const nextDateString = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;

	// Convert midnight in the target timezone to UTC
	// fromZonedTime interprets the string as being in the specified timezone
	const start = fromZonedTime(`${dateString} 00:00:00`, timezone);
	const end = fromZonedTime(`${nextDateString} 00:00:00`, timezone);

	return { start, end };
}
