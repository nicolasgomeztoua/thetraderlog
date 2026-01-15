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
 * **FRONTEND ONLY** - This function is intended for sending calendar dates to the backend.
 *
 * @deprecated FOR BACKEND USE - Do not use in server-side code (src/server/).
 * For grouping trades or timestamps by date on the backend, use:
 * - `getDateStringInTimezone(trade.entryTime, userTimezone)` for trade timestamps
 * - Backend receives the date string from frontend and uses `getDayBoundsInTimezone()`
 *
 * WHY: This function uses the browser's local timezone, which may differ from the user's
 * preferred timezone setting. Backend date grouping must respect the user's configured
 * timezone, not the browser's timezone.
 *
 * FRONTEND USAGE (valid):
 * - User clicks a calendar date → send to backend as a date string
 * - Backend handles timezone conversion using the user's preferred timezone
 *
 * @example
 * // FRONTEND: User clicks "Jan 6" in calendar → Date object is Jan 6 00:00 local time
 * const dateString = toDateString(selectedDate); // "2026-01-06"
 * // Backend uses getDayBoundsInTimezone("2026-01-06", userTimezone) to query
 *
 * @example
 * // BACKEND: DO NOT DO THIS - use getDateStringInTimezone instead
 * // ❌ toDateString(new Date(trade.entryTime))
 * // ✅ getDateStringInTimezone(trade.entryTime, userTimezone)
 */
export function toDateString(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

/**
 * Extract the YYYY-MM-DD date string from a UTC midnight timestamp.
 *
 * USE THIS for dates stored as UTC midnight (e.g., journal dates, calendar dates).
 * These dates represent a specific calendar day, not a moment in time.
 *
 * DO NOT USE for trade timestamps - use getDateStringInTimezone() instead.
 *
 * WHY THIS EXISTS:
 * Journal dates are stored as UTC midnight (e.g., 2026-01-15T00:00:00.000Z).
 * Using toDateString() would convert to local time first, causing the date to shift
 * when the browser is behind UTC (e.g., UTC midnight becomes "Jan 14" in PST).
 * This function extracts the intended date directly from UTC.
 *
 * @example
 * // Journal date stored as 2026-01-15T00:00:00.000Z
 * // Browser is in PST (UTC-8)
 * toDateString(journalDate); // WRONG: "2026-01-14" (local time)
 * getUTCDateString(journalDate); // CORRECT: "2026-01-15" (UTC date)
 */
export function getUTCDateString(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toISOString().split("T")[0] ?? "";
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
 * Convert a UTC hour (0-23) to a local hour in the specified timezone.
 * Useful for converting session definitions stored as UTC to local hours.
 *
 * @example
 * // UTC hour 14 in EST (UTC-5) should be hour 9
 * utcHourToLocalHour(14, "America/New_York") // Returns 9
 *
 * // UTC hour 0 in PST (UTC-8) should be hour 16 (previous day)
 * utcHourToLocalHour(0, "America/Los_Angeles") // Returns 16
 */
export function utcHourToLocalHour(utcHour: number, timezone: string): number {
	const offset = getTimezoneOffset(timezone);
	let localHour = (utcHour + offset) % 24;
	if (localHour < 0) localHour += 24;
	return Math.floor(localHour);
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

// =============================================================================
// DATE STRING GENERATION (Timezone-Safe)
// =============================================================================

/**
 * Get the day of week (0 = Sunday, 6 = Saturday) from a YYYY-MM-DD date string.
 *
 * This function works directly with date strings, avoiding Date object timezone issues.
 * It uses the Zeller-like algorithm to calculate the day of week from year/month/day.
 *
 * USE THIS FOR: Calendar grid alignment, week calculations on date strings
 * - When you already have YYYY-MM-DD strings and need day of week
 * - When browser timezone may differ from display timezone
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 *
 * @example
 * getDayOfWeekFromDateString("2026-01-14") // Wednesday = 3
 * getDayOfWeekFromDateString("2026-01-18") // Sunday = 0
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
	const [yearStr, monthStr, dayStr] = dateStr.split("-");
	const year = Number.parseInt(yearStr ?? "0", 10);
	const month = Number.parseInt(monthStr ?? "1", 10);
	const day = Number.parseInt(dayStr ?? "1", 10);

	// Use UTC to avoid timezone interference
	const utcDate = new Date(Date.UTC(year, month - 1, day));
	return utcDate.getUTCDay();
}

/**
 * Get the month (0 = January, 11 = December) from a YYYY-MM-DD date string.
 *
 * This function extracts the month directly from the string without Date object conversion.
 *
 * USE THIS FOR: Month label display, grouping by month on date strings
 * - Calendar month headers
 * - Month boundary detection in date arrays
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Month: 0 = January, 1 = February, ..., 11 = December
 *
 * @example
 * getMonthFromDateString("2026-01-14") // 0 (January)
 * getMonthFromDateString("2026-12-25") // 11 (December)
 */
export function getMonthFromDateString(dateStr: string): number {
	const monthStr = dateStr.split("-")[1];
	return Number.parseInt(monthStr ?? "1", 10) - 1;
}

/**
 * Format a YYYY-MM-DD date string for display without timezone conversion.
 *
 * This function parses the date string and formats it using date-fns format patterns.
 * It interprets the date as UTC to avoid any timezone shifting.
 *
 * USE THIS FOR: Displaying date strings from generateDateStringsInTimezone()
 * - Tooltip text on calendar heatmaps
 * - Date display in UI where the source is already a date string
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param formatStr - date-fns format pattern (e.g., "MMM d, yyyy", "EEEE", "d")
 * @returns Formatted date string
 *
 * @example
 * formatDateString("2026-01-14", "MMM d, yyyy") // "Jan 14, 2026"
 * formatDateString("2026-01-14", "EEEE") // "Wednesday"
 * formatDateString("2026-01-14", "d") // "14"
 */
export function formatDateString(dateStr: string, formatStr: string): string {
	const [yearStr, monthStr, dayStr] = dateStr.split("-");
	const year = Number.parseInt(yearStr ?? "0", 10);
	const month = Number.parseInt(monthStr ?? "1", 10);
	const day = Number.parseInt(dayStr ?? "1", 10);

	// Create UTC date and format it
	// Using UTC ensures the date displays as the string intended, not shifted
	const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

	// Format in UTC timezone to avoid local timezone interference
	return formatInTimeZone(utcDate, "UTC", formatStr);
}

/**
 * Generate an array of YYYY-MM-DD date strings relative to "today" in the user's timezone.
 *
 * This function avoids Date object timezone ambiguity by:
 * 1. Determining "today" in the user's timezone using formatInTimeZone
 * 2. Performing date arithmetic on YYYY-MM-DD strings directly
 * 3. Never creating intermediate Date objects that could shift days
 *
 * USE THIS FOR: Calendar grid generation, date range selections, heatmaps
 * - When you need an array of date strings for display
 * - When the browser timezone may differ from user's preferred timezone
 *
 * @param startOffset - Days before today (negative) or after today (positive) to start
 * @param endOffset - Days before today (negative) or after today (positive) to end
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Array of YYYY-MM-DD strings from startOffset to endOffset inclusive
 *
 * @example
 * // Generate dates for a week centered on today
 * generateDateStringsInTimezone(-3, 3, "America/New_York")
 * // Returns: ["2026-01-11", "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16", "2026-01-17"]
 *
 * @example
 * // Generate last 365 days for a heatmap
 * generateDateStringsInTimezone(-364, 0, "Pacific/Auckland")
 */
export function generateDateStringsInTimezone(
	startOffset: number,
	endOffset: number,
	timezone: string,
): string[] {
	// Get "today" in the user's timezone as a YYYY-MM-DD string
	const todayString = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

	// Parse the date string components
	const [yearStr, monthStr, dayStr] = todayString.split("-");
	const year = Number.parseInt(yearStr ?? "0", 10);
	const month = Number.parseInt(monthStr ?? "1", 10) - 1; // 0-indexed
	const day = Number.parseInt(dayStr ?? "1", 10);

	// Create a UTC date for "today" to perform arithmetic
	// Using UTC avoids any local timezone interference
	const todayUTC = Date.UTC(year, month, day);

	const result: string[] = [];
	for (let offset = startOffset; offset <= endOffset; offset++) {
		// Add offset days in milliseconds
		const targetMs = todayUTC + offset * 24 * 60 * 60 * 1000;
		const targetDate = new Date(targetMs);

		// Extract UTC components (safe since we started with UTC)
		const y = targetDate.getUTCFullYear();
		const m = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
		const d = String(targetDate.getUTCDate()).padStart(2, "0");

		result.push(`${y}-${m}-${d}`);
	}

	return result;
}
