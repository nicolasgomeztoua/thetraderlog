import {
	addDays,
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	format,
	getDay,
	isAfter,
	isSameDay,
	isSameMonth,
	isToday,
	startOfDay,
	startOfMonth,
	startOfYear,
	subDays,
	subMonths,
} from "date-fns";
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
 * Format a date for display in the specified timezone.
 *
 * USE THIS FOR: Trade entry/exit times - moments that occurred at a specific instant
 * - Displays the time as it was in the user's preferred timezone
 *
 * DO NOT USE FOR: Calendar dates, journal dates, date pickers
 * - Use formatLocalDate() instead for calendar/date-only values
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
 * Format a date for display WITHOUT timezone conversion.
 *
 * USE THIS FOR: Calendar dates, date pickers, journal day displays
 * - When the Date object already represents a local calendar date
 * - When showing journal dates (stored as UTC midnight = calendar date)
 * - Calendar grid day numbers, month headers, date navigation
 *
 * DO NOT USE FOR: Trade entry/exit times (use formatDateInTimezone instead)
 *
 * WHY THIS EXISTS: Journal dates are stored as UTC midnight (e.g., 2026-01-06T00:00:00Z).
 * If we convert UTC midnight to EST, it becomes 7pm on Jan 5 - the wrong day!
 * This function formats the date as-is without timezone shifting.
 */
export function formatLocalDate(
	date: Date | string | null | undefined,
	formatStr: string,
): string {
	if (!date) return "-";
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, formatStr);
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

// =============================================================================
// DATE ARITHMETIC
// =============================================================================

/**
 * Add days to a date
 */
export function addDaysToDate(date: Date, days: number): Date {
	return addDays(date, days);
}

/**
 * Subtract days from a date
 */
export function subtractDaysFromDate(date: Date, days: number): Date {
	return subDays(date, days);
}

/**
 * Get the start of the year for a date
 */
export function getStartOfYear(date: Date): Date {
	return startOfYear(date);
}

// =============================================================================
// DATE COMPARISON
// =============================================================================

/**
 * Check if two dates are the same calendar day
 */
export function isSameCalendarDay(dateA: Date, dateB: Date): boolean {
	return isSameDay(dateA, dateB);
}

/**
 * Check if two dates are in the same month
 */
export function isSameCalendarMonth(dateA: Date, dateB: Date): boolean {
	return isSameMonth(dateA, dateB);
}

/**
 * Check if a date is today
 */
export function isTodayDate(date: Date): boolean {
	return isToday(date);
}

/**
 * Check if dateA is after dateB
 */
export function isDateAfter(dateA: Date, dateB: Date): boolean {
	return isAfter(dateA, dateB);
}

// =============================================================================
// MONTH ARITHMETIC
// =============================================================================

/**
 * Add months to a date
 */
export function addMonthsToDate(date: Date, months: number): Date {
	return addMonths(date, months);
}

/**
 * Subtract months from a date
 */
export function subtractMonthsFromDate(date: Date, months: number): Date {
	return subMonths(date, months);
}

/**
 * Get the first day of the month
 */
export function getStartOfMonth(date: Date): Date {
	return startOfMonth(date);
}

/**
 * Get the last day of the month
 */
export function getEndOfMonth(date: Date): Date {
	return endOfMonth(date);
}

/**
 * Get the start of the day (midnight)
 */
export function getStartOfDay(date: Date): Date {
	return startOfDay(date);
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: Date): number {
	return getDay(date);
}

/**
 * Get all days in an interval
 */
export function getDaysInInterval(start: Date, end: Date): Date[] {
	return eachDayOfInterval({ start, end });
}
