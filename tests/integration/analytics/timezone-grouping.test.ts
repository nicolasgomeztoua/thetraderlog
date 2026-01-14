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
 * Timezone Date Grouping Tests
 *
 * These tests verify the core timezone unification principle:
 * "All trades are grouped by ENTRY TIME in the user's timezone"
 *
 * Key scenarios tested:
 * 1. Trade entered 11 PM EST closed next day UTC → appears on entry date in EST
 * 2. getCalendarData returns correct dates for user timezone
 * 3. getOvertradingAnalysis matches calendar data for same days
 * 4. Daily journal trade grouping respects user timezone
 */
describe("Timezone Date Grouping", () => {
	describe("Trade Grouping by Entry Time", () => {
		let caller: TestCaller;
		let accountId: string;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();

			// Set user timezone to America/New_York (EST, UTC-5)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "America/New_York",
			});

			const account = await createTestAccount(user.id, { isDefault: true });
			accountId = account.id;

			// Trade 1: Entered at 11 PM EST (04:00 UTC next day), exited next morning
			// Date in EST: Jan 15, 2025
			// Date in UTC: Jan 16, 2025
			// Should be grouped as Jan 15 (entry date in user's timezone)
			const trade1EntryTime = new Date("2025-01-16T04:00:00Z"); // 11 PM EST Jan 15
			const trade1ExitTime = new Date("2025-01-16T12:00:00Z"); // 7 AM EST Jan 16
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: trade1EntryTime,
				exitTime: trade1ExitTime,
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			// Trade 2: Entered at 10 AM EST (15:00 UTC same day), exited same day
			// Date in EST: Jan 15, 2025
			// Date in UTC: Jan 15, 2025
			// Should be grouped as Jan 15
			const trade2EntryTime = new Date("2025-01-15T15:00:00Z"); // 10 AM EST Jan 15
			const trade2ExitTime = new Date("2025-01-15T18:00:00Z"); // 1 PM EST Jan 15
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17980",
				quantity: "1",
				entryTime: trade2EntryTime,
				exitTime: trade2ExitTime,
				realizedPnl: "400",
				netPnl: "395",
				fees: "5",
			});

			// Trade 3: Different day - Jan 16 in EST
			// Entered at 9 AM EST (14:00 UTC)
			const trade3EntryTime = new Date("2025-01-16T14:00:00Z"); // 9 AM EST Jan 16
			const trade3ExitTime = new Date("2025-01-16T17:00:00Z"); // 12 PM EST Jan 16
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "4990",
				quantity: "1",
				entryTime: trade3EntryTime,
				exitTime: trade3ExitTime,
				realizedPnl: "-500",
				netPnl: "-505",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should group trade entered at 11 PM EST on entry date, not exit date", async () => {
			// Trade entered at 11 PM EST Jan 15 (04:00 UTC Jan 16)
			// Should appear in Jan 15 calendar, not Jan 16
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});

			// Find Jan 15 entry
			const jan15 = calendarData.find((d) => d.date === "2025-01-15");
			const jan16 = calendarData.find((d) => d.date === "2025-01-16");

			// Jan 15 should have 2 trades (11 PM trade + 10 AM trade)
			expect(jan15?.trades).toBe(2);

			// Jan 16 should have 1 trade (9 AM trade)
			expect(jan16?.trades).toBe(1);
		});

		it("should match getCalendarData grouping with getOvertradingAnalysis", async () => {
			// Both procedures should use entry time for date grouping
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});
			const overtradingData = await caller.analytics.getOvertradingAnalysis({
				accountId,
			});

			// Get trade counts per day from each
			const calendarJan15 = calendarData.find((d) => d.date === "2025-01-15");
			const calendarJan16 = calendarData.find((d) => d.date === "2025-01-16");

			// Verify calendar data
			// Jan 15 has 2 trades in calendar
			// Jan 16 has 1 trade in calendar
			expect(calendarJan15?.trades).toBe(2);
			expect(calendarJan16?.trades).toBe(1);

			// In overtrading analysis, byTradeCount groups by number of trades per day
			// Since Jan 15 has 2 trades and Jan 16 has 1 trade:
			// - There should be a bucket for tradeCount=2 with 1 day
			// - There should be a bucket for tradeCount=1 with 1 day
			const byTradeCount = overtradingData.byTradeCount;

			const bucketFor2Trades = byTradeCount.find((b) => b.tradeCount === 2);
			const bucketFor1Trade = byTradeCount.find((b) => b.tradeCount === 1);

			// Jan 15 has 2 trades, so there should be 1 day with 2 trades
			expect(bucketFor2Trades?.days).toBe(1);
			// Jan 16 has 1 trade, so there should be 1 day with 1 trade
			expect(bucketFor1Trade?.days).toBe(1);
		});

		it("should correctly identify trading days in user timezone", async () => {
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});

			// Should have exactly 2 trading days: Jan 15 and Jan 16 (in EST)
			const tradingDays = calendarData.filter((d) => d.trades > 0);
			expect(tradingDays.length).toBe(2);

			// Verify the dates are correct
			const dates = tradingDays.map((d) => d.date).sort();
			expect(dates).toContain("2025-01-15");
			expect(dates).toContain("2025-01-16");
		});
	});

	describe("Daily Journal Trade Grouping", () => {
		let caller: TestCaller;

		beforeAll(async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();

			// Set user timezone to America/New_York (EST, UTC-5)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "America/New_York",
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Trade entered at 11 PM EST Jan 6 = 04:00 UTC Jan 7
			// Should appear in journal for Jan 6, NOT Jan 7
			const tradeEntryTime = new Date("2026-01-07T04:00:00Z"); // 11 PM EST Jan 6
			const tradeExitTime = new Date("2026-01-07T12:00:00Z"); // 7 AM EST Jan 7

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: tradeEntryTime,
				exitTime: tradeExitTime,
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should include 11 PM EST trade in the entry day journal", async () => {
			// Query for Jan 6 in user's timezone (EST)
			// Trade entered at 11 PM EST Jan 6 should be included
			const result = await caller.dailyJournal.getWithTrades({
				date: "2026-01-06",
			});

			expect(result.trades.length).toBe(1);
			expect(result.trades[0]?.symbol).toBe("ES");
		});

		it("should NOT include trade in next day journal (exit day)", async () => {
			// Query for Jan 7 in user's timezone (EST)
			// Trade was entered Jan 6 EST, so it should NOT appear in Jan 7
			const result = await caller.dailyJournal.getWithTrades({
				date: "2026-01-07",
			});

			expect(result.trades.length).toBe(0);
		});
	});

	describe("Consistency Across Different Timezones", () => {
		it("should group correctly for Pacific timezone user", async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();

			// Set user timezone to America/Los_Angeles (PST, UTC-8)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "America/Los_Angeles",
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Trade entered at 11 PM PST Jan 15 = 07:00 UTC Jan 16
			const tradeEntryTime = new Date("2025-01-16T07:00:00Z"); // 11 PM PST Jan 15
			const tradeExitTime = new Date("2025-01-16T15:00:00Z"); // 7 AM PST Jan 16

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: tradeEntryTime,
				exitTime: tradeExitTime,
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			const caller = await createTestCaller(user.clerkId, user);

			const calendarData = await caller.analytics.getCalendarData({
				accountId: account.id,
			});

			// Trade should appear on Jan 15 (entry date in PST), not Jan 16
			const jan15 = calendarData.find((d) => d.date === "2025-01-15");
			const jan16 = calendarData.find((d) => d.date === "2025-01-16");

			expect(jan15?.trades).toBe(1);
			expect(jan16?.trades ?? 0).toBe(0);

			await truncateAllTables();
		});

		it("should group correctly for far-ahead timezone (Pacific/Auckland)", async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();

			// Set user timezone to Pacific/Auckland (NZDT, UTC+13 in summer)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone: "Pacific/Auckland",
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Trade entered at 11 AM UTC = midnight NZDT next day (Jan 16)
			// In Auckland, 11:00 UTC on Jan 15 = 00:00 NZDT on Jan 16
			const tradeEntryTime = new Date("2025-01-15T11:00:00Z");
			const tradeExitTime = new Date("2025-01-15T15:00:00Z");

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: tradeEntryTime,
				exitTime: tradeExitTime,
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			const caller = await createTestCaller(user.clerkId, user);

			const calendarData = await caller.analytics.getCalendarData({
				accountId: account.id,
			});

			// Trade should appear on Jan 16 in NZDT (ahead of UTC)
			const jan15 = calendarData.find((d) => d.date === "2025-01-15");
			const jan16 = calendarData.find((d) => d.date === "2025-01-16");

			expect(jan15?.trades ?? 0).toBe(0);
			expect(jan16?.trades).toBe(1);

			await truncateAllTables();
		});
	});

	describe("Calendar and Analytics Date Matching", () => {
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

			// Create several trades across different days to test grouping
			// All entry times are in UTC, but should be grouped by EST

			// Day 1: Jan 15, 2025 (EST) - 3 trades
			// 9 AM EST = 14:00 UTC
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5010",
				quantity: "1",
				entryTime: new Date("2025-01-15T14:00:00Z"),
				exitTime: new Date("2025-01-15T16:00:00Z"),
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			// 2 PM EST = 19:00 UTC
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17990",
				quantity: "1",
				entryTime: new Date("2025-01-15T19:00:00Z"),
				exitTime: new Date("2025-01-15T20:00:00Z"),
				realizedPnl: "200",
				netPnl: "195",
				fees: "5",
			});

			// 11 PM EST = 04:00 UTC next day
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5020",
				exitPrice: "5030",
				quantity: "1",
				entryTime: new Date("2025-01-16T04:00:00Z"), // 11 PM EST Jan 15
				exitTime: new Date("2025-01-16T07:00:00Z"),
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			// Day 2: Jan 16, 2025 (EST) - 2 trades
			// 10 AM EST = 15:00 UTC
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "short",
				status: "closed",
				entryPrice: "5040",
				exitPrice: "5060",
				quantity: "1",
				entryTime: new Date("2025-01-16T15:00:00Z"),
				exitTime: new Date("2025-01-16T17:00:00Z"),
				realizedPnl: "-1000",
				netPnl: "-1005",
				fees: "5",
			});

			// 3 PM EST = 20:00 UTC
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "long",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "18050",
				quantity: "1",
				entryTime: new Date("2025-01-16T20:00:00Z"),
				exitTime: new Date("2025-01-16T22:00:00Z"),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			caller = await createTestCaller(user.clerkId, user);
		});

		afterAll(async () => {
			await truncateAllTables();
		});

		it("should have correct trade counts in getCalendarData", async () => {
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});

			// Jan 15 should have 3 trades (including 11 PM trade)
			const jan15 = calendarData.find((d) => d.date === "2025-01-15");
			expect(jan15?.trades).toBe(3);

			// Jan 16 should have 2 trades
			const jan16 = calendarData.find((d) => d.date === "2025-01-16");
			expect(jan16?.trades).toBe(2);
		});

		it("should have total trades match across procedures", async () => {
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});
			const overtradingData = await caller.analytics.getOvertradingAnalysis({
				accountId,
			});

			// Sum up trades from calendar
			const calendarTotal = calendarData.reduce(
				(sum, d) => sum + (d.trades ?? 0),
				0,
			);

			// Calculate total trades from overtrading analysis
			// byTradeCount has buckets, each with tradeCount (trades per day) and days (number of days)
			// Total trades = sum of (tradeCount * days) for each bucket
			const overtradingTotal = overtradingData.byTradeCount.reduce(
				(sum, bucket) => sum + bucket.tradeCount * bucket.days,
				0,
			);

			// Both should equal 5
			expect(calendarTotal).toBe(5);
			expect(overtradingTotal).toBe(5);
		});

		it("should have consistent daily trade distribution between procedures", async () => {
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});
			const overtradingData = await caller.analytics.getOvertradingAnalysis({
				accountId,
			});

			// Get the trading day count from calendar (days with trades > 0)
			const calendarTradingDays = calendarData.filter(
				(d) => d.trades > 0,
			).length;

			// Get total days traded from overtrading analysis
			// byTradeCount has buckets, each with a "days" count
			const overtradingDays = overtradingData.byTradeCount.reduce(
				(sum, bucket) => sum + bucket.days,
				0,
			);

			// Both should show 2 trading days
			expect(calendarTradingDays).toBe(2);
			expect(overtradingDays).toBe(2);
		});
	});
});
