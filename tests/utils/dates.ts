/**
 * Test date utilities for generating relative dates.
 * These ensure tests don't go stale due to hardcoded dates.
 */

/**
 * Get a date N days ago at a specific UTC hour.
 * @param daysAgo - Number of days in the past (0 = today)
 * @param utcHour - Hour in UTC (0-23)
 * @param utcMinute - Minute (0-59)
 */
export function getDateDaysAgo(
	daysAgo: number,
	utcHour = 0,
	utcMinute = 0,
): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - daysAgo);
	d.setUTCHours(utcHour, utcMinute, 0, 0);
	return d;
}

/**
 * Get the most recent occurrence of a specific day of week.
 * If today is that day, returns today.
 * @param dayOfWeek - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param utcHour - Hour in UTC (0-23)
 * @param utcMinute - Minute (0-59)
 */
export function getMostRecentDayOfWeek(
	dayOfWeek: number,
	utcHour = 12,
	utcMinute = 0,
): Date {
	const d = new Date();
	const currentDay = d.getUTCDay();
	const daysToSubtract = (currentDay - dayOfWeek + 7) % 7;
	d.setUTCDate(d.getUTCDate() - daysToSubtract);
	d.setUTCHours(utcHour, utcMinute, 0, 0);
	return d;
}

/**
 * Get a date at a specific local time in a timezone, returned as UTC.
 * Useful for creating trades at "11 PM EST" regardless of current date.
 *
 * @param daysAgo - Number of days in the past
 * @param localHour - Hour in local timezone (0-23)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @param localMinute - Minute (0-59)
 */
export function getDateAtLocalTime(
	daysAgo: number,
	localHour: number,
	timezone: string,
	localMinute = 0,
): Date {
	// Get the date N days ago
	const targetDate = new Date();
	targetDate.setUTCDate(targetDate.getUTCDate() - daysAgo);

	// Format as YYYY-MM-DD
	const year = targetDate.getUTCFullYear();
	const month = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
	const day = String(targetDate.getUTCDate()).padStart(2, "0");
	const dateStr = `${year}-${month}-${day}`;

	// Create a date string in the target timezone and convert to UTC
	const localTimeStr = `${dateStr}T${String(localHour).padStart(2, "0")}:${String(localMinute).padStart(2, "0")}:00`;

	// Use Intl to figure out the offset for this timezone at this date
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	// Create a temporary date to get the timezone offset
	const tempDate = new Date(`${dateStr}T12:00:00Z`);
	const parts = formatter.formatToParts(tempDate);
	const tzHour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
	const utcHour = tempDate.getUTCHours();
	const offset = tzHour - utcHour; // Rough offset calculation

	// Adjust for the actual offset
	const result = new Date(`${localTimeStr}Z`);
	result.setUTCHours(result.getUTCHours() - offset);

	return result;
}

/**
 * Get a specific day of week N weeks ago at a local time.
 * Useful for tests that need "last Sunday at 11 PM EST".
 *
 * @param dayOfWeek - 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param weeksAgo - Number of weeks back (0 = this week, 1 = last week)
 * @param localHour - Hour in local timezone (0-23)
 * @param timezone - IANA timezone string
 */
export function getDayOfWeekAtLocalTime(
	dayOfWeek: number,
	weeksAgo: number,
	localHour: number,
	timezone: string,
	localMinute = 0,
): Date {
	const now = new Date();
	const currentDay = now.getUTCDay();
	let daysToSubtract = (currentDay - dayOfWeek + 7) % 7;
	if (daysToSubtract === 0 && weeksAgo > 0) {
		daysToSubtract = 7;
	}
	daysToSubtract += weeksAgo * 7;

	return getDateAtLocalTime(daysToSubtract, localHour, timezone, localMinute);
}

/** Day of week constants for readability */
export const DayOfWeek = {
	Sunday: 0,
	Monday: 1,
	Tuesday: 2,
	Wednesday: 3,
	Thursday: 4,
	Friday: 5,
	Saturday: 6,
} as const;
