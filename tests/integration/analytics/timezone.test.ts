import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDateStringInTimezone, getDayBoundsInTimezone } from "@/lib/shared";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
	DayOfWeek,
	getDateAtLocalTime,
	getDateDaysAgo,
	getDayOfWeekAtLocalTime,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

/**
 * Timezone-specific tests for analytics procedures.
 *
 * These tests verify that:
 * 1. Session filtering respects user's timezone setting
 * 2. Date groupings (calendar, day-of-week, month) use entry time consistently
 * 3. Date range filters include the full end day
 *
 * NOTE: Uses relative dates (days ago) to prevent tests from going stale.
 */
describe("Analytics Timezone Handling", () => {
	describe("Session Filtering with User Timezone", () => {
		// Test scenario: User in America/New_York timezone
		// Session hours are stored as UTC, then converted to user's local time for comparison

		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			// Create user with America/New_York timezone
			const user = await createTestUser();
			const timezone = "America/New_York";

			// Set user timezone to America/New_York
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create trades at specific local times to test timezone conversion
			// Trade 1: 09:00 EST (in London session for EST user: 8-16 local)
			const trade1Time = getDateAtLocalTime(10, 9, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: trade1Time,
				exitTime: new Date(trade1Time.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			// Trade 2: 01:00 EST (in Asia session for EST user: 0-8 local)
			const trade2Time = getDateAtLocalTime(10, 1, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17980",
				quantity: "1",
				entryTime: trade2Time,
				exitTime: new Date(trade2Time.getTime() + 45 * 60000),
				realizedPnl: "400",
				netPnl: "395",
				fees: "5",
			});

			// Trade 3: 15:00 EST (in New York session for EST user: 13-21 local)
			const trade3Time = getDateAtLocalTime(10, 15, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "4990",
				quantity: "1",
				entryTime: trade3Time,
				exitTime: new Date(trade3Time.getTime() + 20 * 60000),
				realizedPnl: "-500",
				netPnl: "-505",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should filter by session using user timezone, not UTC", async () => {
			// Filter for London session (8-16 in user's timezone = EST)
			// Trade at 09:00 EST should be included (within 8-16 EST)
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["london"],
				},
			});

			// The 09:00 EST trade should be included
			expect(result.totalTrades).toBeGreaterThanOrEqual(1);
		});

		it("should include trades in Asia session based on user timezone", async () => {
			// Filter for Asia session (0-8 in user's timezone = EST)
			// Trade at 01:00 EST should be included (within 0-8 EST)
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["asia"],
				},
			});

			// The 01:00 EST trade should be included
			expect(result.totalTrades).toBeGreaterThanOrEqual(1);
		});

		it("should include trades in New York session based on user timezone", async () => {
			// Filter for New York session (13-21 in user's timezone = EST)
			// Trade at 15:00 EST should be included (within 13-21 EST)
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["new_york"],
				},
			});

			// The 15:00 EST trade should be included
			expect(result.totalTrades).toBeGreaterThanOrEqual(1);
		});

		it("getPerformanceBySession should use user timezone", async () => {
			const result = await caller.analytics.getPerformanceBySession({
				accountId,
			});

			// All three sessions should have at least one trade
			const londonSession = result.find((s) => s.session === "London");
			const asiaSession = result.find((s) => s.session === "Asia");
			const newYorkSession = result.find((s) => s.session === "New York");

			expect(londonSession?.trades).toBeGreaterThanOrEqual(1);
			expect(asiaSession?.trades).toBeGreaterThanOrEqual(1);
			expect(newYorkSession?.trades).toBeGreaterThanOrEqual(1);
		});
	});

	describe("Entry Time Consistency Across Groupings", () => {
		// Test that calendar, day-of-week, and month groupings all use entry time
		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			const timezone = "America/New_York";

			// Set user timezone to America/New_York
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create a trade that enters on Sunday at 23:00 EST
			// and exits on Monday at 02:00 EST
			// Entry should be grouped as Sunday in EST
			const sundayNightEST = getDayOfWeekAtLocalTime(
				DayOfWeek.Sunday,
				1, // 1 week ago
				23,
				timezone,
			);
			const mondayMorningEST = new Date(
				sundayNightEST.getTime() + 3 * 60 * 60 * 1000,
			); // +3 hours = 02:00 next day

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5010",
				quantity: "1",
				entryTime: sundayNightEST,
				exitTime: mondayMorningEST,
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("getPerformanceByDayOfWeek should group by entry time day", async () => {
			const result = await caller.analytics.getPerformanceByDayOfWeek({
				accountId,
			});

			// The trade entered at 23:00 EST on Sunday should be in Sunday (index 0)
			// NOT Monday (index 1) based on exit time
			const sundayData = result[0]; // Sun = index 0
			const mondayData = result[1]; // Mon = index 1

			expect(sundayData?.trades).toBe(1);
			expect(mondayData?.trades).toBe(0);
		});

		it("getPerformanceByHour should group by entry time hour", async () => {
			const result = await caller.analytics.getPerformanceByHour({
				accountId,
			});

			// The trade entered at 23:00 EST should be in hour 23
			// NOT hour 02 (exit time)
			const hour23 = result[23];
			const hour02 = result[2];

			expect(hour23?.trades).toBe(1);
			expect(hour02?.trades).toBe(0);
		});
	});

	describe("Date Range End Includes Full Day", () => {
		let caller: TestCaller;
		let accountId: string;
		let tradeDateStr: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			const timezone = "UTC";

			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create a trade at 23:30 UTC
			const lateNightTrade = getDateDaysAgo(5, 23, 30);
			tradeDateStr = getDateStringInTimezone(lateNightTrade, timezone);

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: lateNightTrade,
				exitTime: new Date(lateNightTrade.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			// Create another trade at 10:00 UTC same day
			const morningTrade = getDateDaysAgo(5, 10, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17990",
				quantity: "1",
				entryTime: morningTrade,
				exitTime: new Date(morningTrade.getTime() + 45 * 60000),
				realizedPnl: "200",
				netPnl: "195",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should include trades at 23:30 when end date is that day", async () => {
			// Filter with end date should include the 23:30 trade
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					dateRange: {
						start: `${tradeDateStr}T00:00:00Z`,
						end: `${tradeDateStr}T00:00:00Z`, // End date at midnight - should include full day
					},
				},
			});

			// Both trades on that day should be included
			expect(result.totalTrades).toBe(2);
		});

		it("should include trades at end of day in calendar data", async () => {
			const result = await caller.analytics.getCalendarData({
				accountId,
				filters: {
					dateRange: {
						start: `${tradeDateStr}T00:00:00Z`,
						end: `${tradeDateStr}T00:00:00Z`,
					},
				},
			});

			// Should have one entry for that day with 2 trades
			expect(result.length).toBe(1);
			expect(result[0]?.trades).toBe(2);
		});
	});

	describe("UTC User Timezone (Default)", () => {
		// Verify behavior for users with UTC timezone (the default)
		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();

			const user = await createTestUser();
			// No userSettings inserted = default UTC timezone

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create trade at 10:00 UTC (within London session 8-16 UTC)
			const tradeLondon = getDateDaysAgo(7, 10, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: tradeLondon,
				exitTime: new Date(tradeLondon.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should use UTC for session filtering when no timezone is set", async () => {
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["london"],
				},
			});

			// Trade at 10:00 UTC should be in London session (8-16 UTC)
			expect(result.totalTrades).toBe(1);
		});

		it("should group by hour correctly in UTC", async () => {
			const result = await caller.analytics.getPerformanceByHour({
				accountId,
			});

			// Trade at 10:00 UTC should be in hour 10
			expect(result[10]?.trades).toBe(1);
		});
	});

	describe("Custom Session Configuration", () => {
		// Test that session filtering uses user-configured sessions from userSettings.tradingSessions
		// NOT the hardcoded default sessions
		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();

			// Configure custom sessions with different hours than defaults
			// Default: Asia 0-8, London 8-16, New York 13-21
			// Custom: Morning 6-12, Afternoon 12-18, Evening 18-24
			const customSessions = [
				{ name: "Morning", startHour: 6, endHour: 12, color: "#00ff00" },
				{ name: "Afternoon", startHour: 12, endHour: 18, color: "#0000ff" },
				{ name: "Evening", startHour: 18, endHour: 24, color: "#ff0000" },
			];

			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "UTC", // Use UTC for simplicity
				tradingSessions: JSON.stringify(customSessions),
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create trades at specific UTC times to test custom sessions
			// Trade 1: 07:00 UTC (in custom Morning session 6-12)
			const trade1Time = getDateDaysAgo(5, 7, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: trade1Time,
				exitTime: new Date(trade1Time.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			// Trade 2: 14:00 UTC (in custom Afternoon session 12-18)
			const trade2Time = getDateDaysAgo(5, 14, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17980",
				quantity: "1",
				entryTime: trade2Time,
				exitTime: new Date(trade2Time.getTime() + 45 * 60000),
				realizedPnl: "400",
				netPnl: "395",
				fees: "5",
			});

			// Trade 3: 20:00 UTC (in custom Evening session 18-24)
			const trade3Time = getDateDaysAgo(5, 20, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "4990",
				quantity: "1",
				entryTime: trade3Time,
				exitTime: new Date(trade3Time.getTime() + 20 * 60000),
				realizedPnl: "-500",
				netPnl: "-505",
				fees: "5",
			});

			// Trade 4: 03:00 UTC (NOT in any custom session - before Morning starts at 6)
			const trade4Time = getDateDaysAgo(5, 3, 0);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "long",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "18010",
				quantity: "1",
				entryTime: trade4Time,
				exitTime: new Date(trade4Time.getTime() + 20 * 60000),
				realizedPnl: "200",
				netPnl: "195",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should filter by custom Morning session", async () => {
			// Custom Morning session: 6-12 UTC
			// Trade at 07:00 UTC should be included
			// Trade at 03:00 UTC should NOT be included (default Asia would include it)
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["morning"],
				},
			});

			// Only the 07:00 UTC trade should be included
			expect(result.totalTrades).toBe(1);
		});

		it("should filter by custom Afternoon session", async () => {
			// Custom Afternoon session: 12-18 UTC
			// Trade at 14:00 UTC should be included
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["afternoon"],
				},
			});

			expect(result.totalTrades).toBe(1);
		});

		it("should filter by custom Evening session", async () => {
			// Custom Evening session: 18-24 UTC
			// Trade at 20:00 UTC should be included
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["evening"],
				},
			});

			expect(result.totalTrades).toBe(1);
		});

		it("should NOT match default session names when custom sessions configured", async () => {
			// Filter by "asia" (default session name) should NOT match anything
			// because user has custom sessions configured
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["asia"],
				},
			});

			// No trades should match because "asia" is not a configured session
			expect(result.totalTrades).toBe(0);
		});

		it("should filter by multiple custom sessions", async () => {
			// Filter by Morning and Evening
			// Should include trades at 07:00 and 20:00 UTC
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["morning", "evening"],
				},
			});

			expect(result.totalTrades).toBe(2);
		});

		it("should exclude trades outside any custom session", async () => {
			// Trade at 03:00 UTC is before Morning (6-12) starts
			// When filtering for all custom sessions, this trade should be excluded
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					sessions: ["morning", "afternoon", "evening"],
				},
			});

			// 3 trades (07:00, 14:00, 20:00) should be included
			// 1 trade (03:00) should be excluded
			expect(result.totalTrades).toBe(3);
		});
	});

	describe("getDayBoundsInTimezone utility", () => {
		// These tests use hardcoded dates intentionally - testing that specific
		// inputs produce specific outputs for the utility function
		it("should return correct UTC bounds for EST timezone", () => {
			// Jan 6 in EST (UTC-5) should be:
			// Start: Jan 6 00:00 EST = Jan 6 05:00 UTC
			// End: Jan 7 00:00 EST = Jan 7 05:00 UTC
			const { start, end } = getDayBoundsInTimezone(
				"2026-01-06",
				"America/New_York",
			);

			expect(start.toISOString()).toBe("2026-01-06T05:00:00.000Z");
			expect(end.toISOString()).toBe("2026-01-07T05:00:00.000Z");
		});

		it("should return correct UTC bounds for UTC timezone", () => {
			const { start, end } = getDayBoundsInTimezone("2026-01-06", "UTC");

			expect(start.toISOString()).toBe("2026-01-06T00:00:00.000Z");
			expect(end.toISOString()).toBe("2026-01-07T00:00:00.000Z");
		});

		it("should return correct UTC bounds for positive offset timezone", () => {
			// Jan 6 in Europe/Madrid (UTC+1) should be:
			// Start: Jan 6 00:00 CET = Jan 5 23:00 UTC
			// End: Jan 7 00:00 CET = Jan 6 23:00 UTC
			const { start, end } = getDayBoundsInTimezone(
				"2026-01-06",
				"Europe/Madrid",
			);

			expect(start.toISOString()).toBe("2026-01-05T23:00:00.000Z");
			expect(end.toISOString()).toBe("2026-01-06T23:00:00.000Z");
		});
	});

	describe("Daily Journal Trades with User Timezone", () => {
		let caller: TestCaller;
		let tradeDateStr: string;
		let previousDateStr: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			const timezone = "America/New_York";

			// Set user timezone to America/New_York (EST, UTC-5)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Create a trade at 02:00 EST
			// This should appear in the journal for that day (EST)
			const tradeTime = getDateAtLocalTime(12, 2, timezone);
			tradeDateStr = getDateStringInTimezone(tradeTime, timezone);

			// Previous day for negative test
			const previousDay = new Date(tradeTime);
			previousDay.setDate(previousDay.getDate() - 1);
			previousDateStr = getDateStringInTimezone(previousDay, timezone);

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: tradeTime,
				exitTime: new Date(tradeTime.getTime() + 30 * 60000),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should include trade in correct day based on user timezone", async () => {
			// Query for trade date in user's timezone (EST)
			const result = await caller.dailyJournal.getWithTrades({
				date: tradeDateStr,
			});

			expect(result.trades.length).toBe(1);
			expect(result.trades[0]?.symbol).toBe("ES");
		});

		it("should NOT include trade when querying wrong day", async () => {
			// Query for previous day in user's timezone (EST)
			const result = await caller.dailyJournal.getWithTrades({
				date: previousDateStr,
			});

			expect(result.trades.length).toBe(0);
		});
	});
});
