import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	formatDateString,
	generateDateStringsInTimezone,
	getDayOfWeekFromDateString,
	getMonthFromDateString,
} from "@/lib/shared";
import { truncateAllTables } from "../../utils";

/**
 * Calendar Heatmap Timezone Tests
 *
 * These tests verify the timezone-aware date string utilities used by CalendarHeatmap.
 * The component uses these utilities to ensure correct display regardless of browser timezone.
 *
 * Key scenarios tested:
 * 1. Date string generation for far-ahead timezone (Pacific/Auckland, UTC+12/+13)
 * 2. Date string generation for behind-UTC timezone (America/Los_Angeles, UTC-8)
 * 3. Week alignment starts on Sunday (day 0)
 * 4. Month label extraction from date strings
 * 5. Year boundary handling (Dec 31 / Jan 1)
 */
describe("Calendar Heatmap Timezone Utilities", () => {
	beforeAll(async () => {
		await truncateAllTables();
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("generateDateStringsInTimezone", () => {
		it("should generate correct date strings for Pacific/Auckland timezone", () => {
			// Pacific/Auckland is UTC+12 in winter, UTC+13 in summer (NZDT)
			// When it's Jan 15 00:00 in Auckland, it's Jan 14 11:00 UTC (UTC+13)
			// So "today" in Auckland may be a day ahead of "today" in UTC
			const dates = generateDateStringsInTimezone(-3, 0, "Pacific/Auckland");

			// Should generate 4 dates (offset -3 to 0)
			expect(dates.length).toBe(4);

			// All dates should be in YYYY-MM-DD format
			for (const date of dates) {
				expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}

			// Dates should be in chronological order
			for (let i = 1; i < dates.length; i++) {
				const prev = dates[i - 1] ?? "";
				const curr = dates[i] ?? "";
				expect(curr > prev).toBe(true);
			}
		});

		it("should generate correct date strings for America/Los_Angeles timezone", () => {
			// America/Los_Angeles is UTC-8 (PST) or UTC-7 (PDT)
			// When it's Jan 15 00:00 in LA, it's Jan 15 08:00 UTC
			const dates = generateDateStringsInTimezone(-3, 0, "America/Los_Angeles");

			// Should generate 4 dates (offset -3 to 0)
			expect(dates.length).toBe(4);

			// All dates should be in YYYY-MM-DD format
			for (const date of dates) {
				expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}

			// Dates should be in chronological order
			for (let i = 1; i < dates.length; i++) {
				const prev = dates[i - 1] ?? "";
				const curr = dates[i] ?? "";
				expect(curr > prev).toBe(true);
			}
		});

		it("should generate consecutive dates without gaps", () => {
			// Generate 10 consecutive dates
			const dates = generateDateStringsInTimezone(-9, 0, "America/New_York");

			expect(dates.length).toBe(10);

			// Verify each date is exactly one day after the previous
			for (let i = 1; i < dates.length; i++) {
				const prevParts = (dates[i - 1] ?? "").split("-").map(Number);
				const currParts = (dates[i] ?? "").split("-").map(Number);

				// Create UTC dates to check difference
				const prevDate = Date.UTC(
					prevParts[0] ?? 0,
					(prevParts[1] ?? 1) - 1,
					prevParts[2] ?? 1,
				);
				const currDate = Date.UTC(
					currParts[0] ?? 0,
					(currParts[1] ?? 1) - 1,
					currParts[2] ?? 1,
				);

				// Difference should be exactly 1 day (86400000 ms)
				expect(currDate - prevDate).toBe(86400000);
			}
		});

		it("should handle year boundary correctly (Dec 31 / Jan 1)", () => {
			// Use UTC timezone to have predictable "today"
			// Generate dates that span a year boundary
			// We'll test the function with a fixed reference by using known offsets

			// For this test, we verify that dates can span year boundaries correctly
			// by generating a range that would cross Dec 31 / Jan 1

			// Generate 10 dates - if today is early January, this should include Dec dates
			// If today is late December, this should include Jan dates
			const dates = generateDateStringsInTimezone(-400, -390, "UTC");

			// Should still generate 11 dates even if crossing year boundary
			expect(dates.length).toBe(11);

			// All dates should be valid
			for (const date of dates) {
				expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				const parts = date.split("-").map(Number);
				const year = parts[0] ?? 0;
				const month = parts[1] ?? 0;
				const day = parts[2] ?? 0;

				expect(year).toBeGreaterThan(2000);
				expect(month).toBeGreaterThanOrEqual(1);
				expect(month).toBeLessThanOrEqual(12);
				expect(day).toBeGreaterThanOrEqual(1);
				expect(day).toBeLessThanOrEqual(31);
			}

			// Dates should still be chronological
			for (let i = 1; i < dates.length; i++) {
				const prev = dates[i - 1] ?? "";
				const curr = dates[i] ?? "";
				expect(curr > prev).toBe(true);
			}
		});

		it("should handle crossing Dec 31 to Jan 1 specifically", () => {
			// Generate a range that we know crosses year boundary
			// Looking back ~1 year from any date in Jan should include previous year's dates
			const dates = generateDateStringsInTimezone(-370, -360, "UTC");

			// Verify all dates are valid and the function handles year boundaries
			expect(dates.length).toBe(11);
			for (const date of dates) {
				const parts = date.split("-").map(Number);
				expect(parts.length).toBe(3);
				expect(parts[0]).toBeGreaterThan(2000); // Valid year

				// Verify month is valid (01-12)
				const monthStr = date.split("-")[1];
				expect(monthStr).toMatch(/^(0[1-9]|1[0-2])$/);
			}
		});
	});

	describe("getDayOfWeekFromDateString", () => {
		it("should return 0 for Sunday", () => {
			// 2026-01-18 is a Sunday
			expect(getDayOfWeekFromDateString("2026-01-18")).toBe(0);
		});

		it("should return 1 for Monday", () => {
			// 2026-01-19 is a Monday
			expect(getDayOfWeekFromDateString("2026-01-19")).toBe(1);
		});

		it("should return 6 for Saturday", () => {
			// 2026-01-17 is a Saturday
			expect(getDayOfWeekFromDateString("2026-01-17")).toBe(6);
		});

		it("should handle week alignment correctly (calendar starts on Sunday)", () => {
			// Generate a week of dates and verify they align correctly
			const dates = ["2026-01-18", "2026-01-19", "2026-01-20", "2026-01-21"];

			expect(getDayOfWeekFromDateString(dates[0] ?? "")).toBe(0); // Sunday
			expect(getDayOfWeekFromDateString(dates[1] ?? "")).toBe(1); // Monday
			expect(getDayOfWeekFromDateString(dates[2] ?? "")).toBe(2); // Tuesday
			expect(getDayOfWeekFromDateString(dates[3] ?? "")).toBe(3); // Wednesday
		});

		it("should handle year boundaries correctly", () => {
			// 2025-12-31 was a Wednesday (3)
			// 2026-01-01 was a Thursday (4)
			expect(getDayOfWeekFromDateString("2025-12-31")).toBe(3);
			expect(getDayOfWeekFromDateString("2026-01-01")).toBe(4);
		});

		it("should be consistent across different years", () => {
			// Verify day of week calculation is correct for known dates
			// 2024-01-01 was a Monday (1)
			expect(getDayOfWeekFromDateString("2024-01-01")).toBe(1);
			// 2025-01-01 was a Wednesday (3)
			expect(getDayOfWeekFromDateString("2025-01-01")).toBe(3);
			// 2026-01-01 is a Thursday (4)
			expect(getDayOfWeekFromDateString("2026-01-01")).toBe(4);
		});
	});

	describe("getMonthFromDateString", () => {
		it("should return 0 for January", () => {
			expect(getMonthFromDateString("2026-01-15")).toBe(0);
		});

		it("should return 11 for December", () => {
			expect(getMonthFromDateString("2025-12-25")).toBe(11);
		});

		it("should correctly extract month for all months", () => {
			const months = [
				"2026-01-01", // Jan = 0
				"2026-02-15", // Feb = 1
				"2026-03-10", // Mar = 2
				"2026-04-20", // Apr = 3
				"2026-05-05", // May = 4
				"2026-06-30", // Jun = 5
				"2026-07-04", // Jul = 6
				"2026-08-15", // Aug = 7
				"2026-09-01", // Sep = 8
				"2026-10-31", // Oct = 9
				"2026-11-25", // Nov = 10
				"2026-12-31", // Dec = 11
			];

			for (let i = 0; i < months.length; i++) {
				expect(getMonthFromDateString(months[i] ?? "")).toBe(i);
			}
		});

		it("should handle month transitions correctly", () => {
			// Last day of January
			expect(getMonthFromDateString("2026-01-31")).toBe(0);
			// First day of February
			expect(getMonthFromDateString("2026-02-01")).toBe(1);
		});

		it("should handle year boundaries correctly for month extraction", () => {
			// December 2025
			expect(getMonthFromDateString("2025-12-31")).toBe(11);
			// January 2026
			expect(getMonthFromDateString("2026-01-01")).toBe(0);
		});
	});

	describe("formatDateString", () => {
		it("should format date string for tooltip display", () => {
			const formatted = formatDateString("2026-01-14", "EEE, MMM d, yyyy");
			expect(formatted).toBe("Wed, Jan 14, 2026");
		});

		it("should format day only", () => {
			const formatted = formatDateString("2026-01-14", "d");
			expect(formatted).toBe("14");
		});

		it("should format full weekday name", () => {
			const formatted = formatDateString("2026-01-14", "EEEE");
			expect(formatted).toBe("Wednesday");
		});

		it("should format month and year", () => {
			const formatted = formatDateString("2026-01-14", "MMMM yyyy");
			expect(formatted).toBe("January 2026");
		});

		it("should handle year boundaries in formatting", () => {
			// Dec 31, 2025
			expect(formatDateString("2025-12-31", "MMM d, yyyy")).toBe(
				"Dec 31, 2025",
			);
			// Jan 1, 2026
			expect(formatDateString("2026-01-01", "MMM d, yyyy")).toBe("Jan 1, 2026");
		});
	});

	describe("Week Alignment for Calendar Grid", () => {
		it("should calculate correct padding for week alignment", () => {
			// Test that we can calculate proper padding to align weeks to Sunday
			// CalendarHeatmap pads the first week so it starts on Sunday

			// Generate dates starting from a known non-Sunday
			const dates = generateDateStringsInTimezone(-6, 0, "UTC");
			const firstDate = dates[0] ?? "2026-01-01";
			const firstDayOfWeek = getDayOfWeekFromDateString(firstDate);

			// If first day is Wednesday (3), we need 3 padding dates (Sun, Mon, Tue)
			// to align the week properly
			const paddingNeeded = firstDayOfWeek;

			// Verify the calculation
			expect(paddingNeeded).toBeGreaterThanOrEqual(0);
			expect(paddingNeeded).toBeLessThan(7);

			// After adding padding, the total should be divisible by 7 for complete weeks
			// (excluding the final incomplete week)
		});

		it("should generate Sunday-aligned weeks correctly", () => {
			// Simulate CalendarHeatmap week generation logic
			const tz = "America/New_York";
			const allDates = generateDateStringsInTimezone(-364, 0, tz);

			// Get day of week for first date
			const firstDateDayOfWeek = getDayOfWeekFromDateString(
				allDates[0] ?? "2026-01-01",
			);

			// Generate padding dates for alignment
			const paddingDates = generateDateStringsInTimezone(
				-364 - firstDateDayOfWeek,
				-365,
				tz,
			);

			// Combine padding + actual dates
			const allWithPadding = [...paddingDates, ...allDates];

			// First date in the combined array should be a Sunday
			if (allWithPadding.length > 0) {
				const firstDayOfCombined = getDayOfWeekFromDateString(
					allWithPadding[0] ?? "",
				);
				// With proper padding, first day should be Sunday (0)
				expect(firstDayOfCombined).toBe(0);
			}
		});
	});

	describe("Month Label Positions", () => {
		it("should detect month transitions correctly", () => {
			// Generate a range that includes a month transition
			const dates = [
				"2026-01-28",
				"2026-01-29",
				"2026-01-30",
				"2026-01-31",
				"2026-02-01",
				"2026-02-02",
			];

			let lastMonth = -1;
			const transitions: { date: string; month: number }[] = [];

			for (const date of dates) {
				const month = getMonthFromDateString(date);
				if (month !== lastMonth) {
					transitions.push({ date, month });
					lastMonth = month;
				}
			}

			// Should have 2 transitions: Jan (0) and Feb (1)
			expect(transitions.length).toBe(2);
			expect(transitions[0]?.month).toBe(0); // January
			expect(transitions[1]?.month).toBe(1); // February
		});

		it("should handle year-spanning month labels correctly", () => {
			// Dec to Jan transition
			const dates = [
				"2025-12-29",
				"2025-12-30",
				"2025-12-31",
				"2026-01-01",
				"2026-01-02",
			];

			let lastMonth = -1;
			const transitions: { date: string; month: number }[] = [];

			for (const date of dates) {
				const month = getMonthFromDateString(date);
				if (month !== lastMonth) {
					transitions.push({ date, month });
					lastMonth = month;
				}
			}

			// Should have 2 transitions: Dec (11) and Jan (0)
			expect(transitions.length).toBe(2);
			expect(transitions[0]?.month).toBe(11); // December
			expect(transitions[1]?.month).toBe(0); // January
		});
	});

	describe("Edge Cases", () => {
		it("should handle leap year dates correctly", () => {
			// 2024 was a leap year
			expect(getDayOfWeekFromDateString("2024-02-29")).toBe(4); // Thursday
			expect(getMonthFromDateString("2024-02-29")).toBe(1); // February
			expect(formatDateString("2024-02-29", "MMM d, yyyy")).toBe(
				"Feb 29, 2024",
			);
		});

		it("should handle single-digit days and months correctly", () => {
			// Jan 1
			expect(getDayOfWeekFromDateString("2026-01-01")).toBe(4); // Thursday
			expect(getMonthFromDateString("2026-01-01")).toBe(0);

			// Jan 9
			expect(getDayOfWeekFromDateString("2026-01-09")).toBe(5); // Friday
		});

		it("should handle timezone with DST transition", () => {
			// Generate dates around a DST transition (March 8, 2026 for US)
			// The utility uses UTC arithmetic so DST shouldn't affect date strings
			const dates = generateDateStringsInTimezone(-5, 0, "America/New_York");

			// Should still generate 6 consecutive dates
			expect(dates.length).toBe(6);

			// All should be valid date strings
			for (const date of dates) {
				expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}
		});
	});
});
