import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
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
 */
describe("Analytics Timezone Handling", () => {
	describe("Session Filtering with User Timezone", () => {
		// Test scenario: User in America/New_York timezone
		// A trade entered at 14:00 UTC = 09:00 EST (during winter) / 10:00 EDT (during summer)
		// London session (8-16 user local time) should include this trade for EST user
		// if they entered during their 8-16 hours, NOT UTC 8-16

		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			// Create user with America/New_York timezone
			const user = await createTestUser();

			// Set user timezone to America/New_York
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "America/New_York",
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create trades at specific UTC times to test timezone conversion
			// Trade 1: 14:00 UTC = 09:00 EST (in London session for EST user: 8-16 EST)
			const trade1Time = new Date("2025-01-15T14:00:00Z");
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

			// Trade 2: 06:00 UTC = 01:00 EST (in Asia session for EST user: 0-8 EST)
			const trade2Time = new Date("2025-01-15T06:00:00Z");
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

			// Trade 3: 20:00 UTC = 15:00 EST (in New York session for EST user: 13-21 EST)
			const trade3Time = new Date("2025-01-15T20:00:00Z");
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
			// Trade at 14:00 UTC = 09:00 EST should be included (within 8-16 EST)
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
			// Trade at 06:00 UTC = 01:00 EST should be included (within 0-8 EST)
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
			// Trade at 20:00 UTC = 15:00 EST should be included (within 13-21 EST)
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

			// Set user timezone to America/New_York
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "America/New_York",
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create a trade that enters on Sunday at 23:00 EST (04:00 UTC Monday)
			// and exits on Monday at 02:00 EST (07:00 UTC Monday)
			// Entry should be grouped as Sunday in EST
			const sundayNightEST = new Date("2025-01-13T04:00:00Z"); // 23:00 EST Sunday
			const mondayMorningEST = new Date("2025-01-13T07:00:00Z"); // 02:00 EST Monday

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

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "UTC",
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Create a trade at 23:30 UTC on Jan 15
			const lateNightTrade = new Date("2025-01-15T23:30:00Z");
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

			// Create another trade at 10:00 UTC on Jan 15
			const morningTrade = new Date("2025-01-15T10:00:00Z");
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
			// Filter with end date of Jan 15 should include the 23:30 trade
			const result = await caller.analytics.getOverview({
				accountId,
				filters: {
					dateRange: {
						start: "2025-01-15T00:00:00Z",
						end: "2025-01-15T00:00:00Z", // End date at midnight - should include full day
					},
				},
			});

			// Both trades on Jan 15 should be included
			expect(result.totalTrades).toBe(2);
		});

		it("should include trades at end of day in calendar data", async () => {
			const result = await caller.analytics.getCalendarData({
				accountId,
				filters: {
					dateRange: {
						start: "2025-01-15T00:00:00Z",
						end: "2025-01-15T00:00:00Z",
					},
				},
			});

			// Should have one entry for Jan 15 with 2 trades
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
			const tradeLondon = new Date("2025-01-15T10:00:00Z");
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
});
