import { schedules } from "@trigger.dev/sdk/v3";
import { sql } from "drizzle-orm";
import { HIGH_IMPACT_KEYWORDS } from "@/lib/constants/economic-calendar";
import { db } from "@/server/db";
import { economicEvents } from "@/server/db/schema";

/**
 * JBlanked API response structure for forex factory calendar events
 */
interface JBlankedEvent {
	title: string;
	country: string;
	date: string; // e.g., "Fri Jan 17"
	time: string; // e.g., "8:30am" or "Tentative" or "All Day"
	impact: string; // "High", "Medium", "Low", or "Holiday"
	forecast: string;
	previous: string;
}

/**
 * Currency mapping from country codes to currency codes
 */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
	USD: "USD",
	EUR: "EUR",
	GBP: "GBP",
	JPY: "JPY",
	CHF: "CHF",
	AUD: "AUD",
	CAD: "CAD",
	NZD: "NZD",
	CNY: "CNY",
};

/**
 * Determine impact level based on API response and keyword matching
 */
function classifyImpact(
	apiImpact: string,
	eventTitle: string,
): "high" | "medium" | "low" {
	// API provides impact directly - use it if valid
	const normalizedImpact = apiImpact.toLowerCase();
	if (normalizedImpact === "high") return "high";
	if (normalizedImpact === "medium") return "medium";
	if (normalizedImpact === "low") return "low";

	// Holiday or unknown - check keywords as fallback
	const titleLower = eventTitle.toLowerCase();
	const hasHighImpactKeyword = HIGH_IMPACT_KEYWORDS.some((keyword) =>
		titleLower.includes(keyword.toLowerCase()),
	);

	return hasHighImpactKeyword ? "high" : "low";
}

/**
 * Parse time string from JBlanked API into hours and minutes
 * Returns null for non-specific times like "Tentative" or "All Day"
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
	if (!timeStr || timeStr === "Tentative" || timeStr === "All Day") {
		return null;
	}

	// Parse format like "8:30am" or "2:00pm"
	const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
	if (!match || !match[1] || !match[2] || !match[3]) return null;

	let hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	const period = match[3].toLowerCase();

	// Convert to 24-hour format
	if (period === "pm" && hours !== 12) {
		hours += 12;
	} else if (period === "am" && hours === 12) {
		hours = 0;
	}

	return { hours, minutes };
}

/**
 * Parse date string from JBlanked API into a Date object
 * Format: "Fri Jan 17" - assumes current year
 */
function parseEventDate(dateStr: string, timeStr: string): Date | null {
	// Parse the date part (e.g., "Fri Jan 17")
	const dateParts = dateStr.split(" ");
	if (dateParts.length < 3) return null;

	const monthStr = dateParts[1];
	const dayStr = dateParts[2];
	if (!monthStr || !dayStr) return null;

	const day = Number.parseInt(dayStr, 10);
	if (Number.isNaN(day)) return null;

	const monthMap: Record<string, number> = {
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
	};

	const month = monthMap[monthStr];
	if (month === undefined) return null;

	// Use current year, but handle year boundary (Dec -> Jan)
	const now = new Date();
	let year = now.getUTCFullYear();

	// If the event month is January and current month is December,
	// the event is likely next year
	if (month === 0 && now.getUTCMonth() === 11) {
		year += 1;
	}

	// Parse time
	const time = parseTime(timeStr);
	const hours = time?.hours ?? 12; // Default to noon for events without specific time
	const minutes = time?.minutes ?? 0;

	// Events are in ET (Eastern Time) - convert to UTC
	// This is a simplification; for precise handling, use a timezone library
	// Forex Factory times are in ET, and ET is UTC-5 (EST) or UTC-4 (EDT)
	// For simplicity, assume UTC-5 (most conservative)
	const utcHours = hours + 5;

	return new Date(Date.UTC(year, month, day, utcHours, minutes, 0, 0));
}

/**
 * Sync Economic Calendar - Scheduled Task
 *
 * Fetches economic calendar data from JBlanked API (Forex Factory) hourly
 * and upserts events to the database.
 */
export const syncEconomicCalendar = schedules.task({
	id: "sync-economic-calendar",
	// Run every hour at minute 0
	cron: "0 * * * *",
	run: async () => {
		const apiKey = process.env.JBLANKED_API_KEY;

		// Handle missing API key gracefully
		if (!apiKey) {
			console.warn(
				"[sync-economic-calendar] JBLANKED_API_KEY not set - skipping sync",
			);
			return {
				success: false,
				message: "JBLANKED_API_KEY environment variable not configured",
				synced: 0,
			};
		}

		console.log("[sync-economic-calendar] Starting economic calendar sync...");

		try {
			// Fetch this week's calendar from JBlanked API
			const response = await fetch(
				"https://www.jblanked.com/api/forex-factory/calendar/week/",
				{
					headers: {
						Authorization: `Api-Key ${apiKey}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`[sync-economic-calendar] API error: ${response.status} - ${errorText}`,
				);
				return {
					success: false,
					message: `JBlanked API returned ${response.status}`,
					synced: 0,
				};
			}

			const events: JBlankedEvent[] = await response.json();
			console.log(
				`[sync-economic-calendar] Fetched ${events.length} events from API`,
			);

			// Filter out holidays and events we can't parse
			const validEvents = events.filter(
				(event) =>
					event.impact?.toLowerCase() !== "holiday" &&
					COUNTRY_TO_CURRENCY[event.country],
			);

			console.log(
				`[sync-economic-calendar] Processing ${validEvents.length} valid events`,
			);

			let synced = 0;
			let errors = 0;

			// Process each event
			for (const event of validEvents) {
				try {
					const eventTime = parseEventDate(event.date, event.time);
					if (!eventTime) {
						console.warn(
							`[sync-economic-calendar] Could not parse date/time for event: ${event.title}`,
						);
						errors++;
						continue;
					}

					const currency = COUNTRY_TO_CURRENCY[event.country] ?? event.country;
					const impact = classifyImpact(event.impact, event.title);

					// Upsert using ON CONFLICT
					await db
						.insert(economicEvents)
						.values({
							name: event.title,
							currency,
							eventTime,
							impact,
							forecast: event.forecast || null,
							previous: event.previous || null,
							source: "forex_factory",
						})
						.onConflictDoUpdate({
							target: [
								economicEvents.name,
								economicEvents.currency,
								economicEvents.eventTime,
							],
							set: {
								forecast: sql`EXCLUDED.forecast`,
								previous: sql`EXCLUDED.previous`,
								impact: sql`EXCLUDED.impact`,
								fetchedAt: sql`NOW()`,
							},
						});

					synced++;
				} catch (eventError) {
					console.error(
						`[sync-economic-calendar] Error processing event "${event.title}":`,
						eventError,
					);
					errors++;
				}
			}

			console.log(
				`[sync-economic-calendar] Sync complete: ${synced} synced, ${errors} errors`,
			);

			return {
				success: true,
				message: `Synced ${synced} events (${errors} errors)`,
				synced,
				errors,
			};
		} catch (error) {
			console.error("[sync-economic-calendar] Sync failed:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error",
				synced: 0,
			};
		}
	},
});
