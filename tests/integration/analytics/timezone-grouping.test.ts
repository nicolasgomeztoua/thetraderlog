import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDateStringInTimezone } from "@/lib/shared";
import {
	createTestAccount,
	createTestCaller,
	createTestTrade,
	createTestUser,
	getDateAtLocalTime,
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
 *
 * NOTE: Uses relative dates (days ago) to prevent tests from going stale.
 */
describe("Timezone Date Grouping", () => {
	describe("Trade Grouping by Entry Time", () => {
		let caller: TestCaller;
		let accountId: string;

		// Store expected date strings for assertions
		let day1DateStr: string; // Day with 2 trades
		let day2DateStr: string; // Day with 1 trade

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
			accountId = account.id;

			// Trade 1: Entered at 11 PM EST (04:00 UTC next day), exited next morning
			// Should be grouped by entry date in user's timezone
			const trade1EntryTime = getDateAtLocalTime(8, 23, timezone); // 8 days ago, 11 PM local
			const trade1ExitTime = new Date(
				trade1EntryTime.getTime() + 8 * 60 * 60 * 1000,
			); // +8 hours

			// Store expected date string for Day 1
			day1DateStr = getDateStringInTimezone(trade1EntryTime, timezone);

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

			// Trade 2: Entered at 10 AM EST same day as trade 1
			const trade2EntryTime = getDateAtLocalTime(8, 10, timezone); // 8 days ago, 10 AM local
			const trade2ExitTime = new Date(
				trade2EntryTime.getTime() + 3 * 60 * 60 * 1000,
			); // +3 hours

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

			// Trade 3: Different day - next day at 9 AM EST
			const trade3EntryTime = getDateAtLocalTime(7, 9, timezone); // 7 days ago, 9 AM local
			const trade3ExitTime = new Date(
				trade3EntryTime.getTime() + 3 * 60 * 60 * 1000,
			); // +3 hours

			// Store expected date string for Day 2
			day2DateStr = getDateStringInTimezone(trade3EntryTime, timezone);

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
			// Trade entered at 11 PM EST should appear on that day's calendar
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});

			const day1 = calendarData.find((d) => d.date === day1DateStr);
			const day2 = calendarData.find((d) => d.date === day2DateStr);

			// Day 1 should have 2 trades (11 PM trade + 10 AM trade)
			expect(day1?.trades).toBe(2);

			// Day 2 should have 1 trade (9 AM trade)
			expect(day2?.trades).toBe(1);
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
			const calendarDay1 = calendarData.find((d) => d.date === day1DateStr);
			const calendarDay2 = calendarData.find((d) => d.date === day2DateStr);

			// Verify calendar data
			expect(calendarDay1?.trades).toBe(2);
			expect(calendarDay2?.trades).toBe(1);

			// In overtrading analysis, byTradeCount groups by number of trades per day
			const byTradeCount = overtradingData.byTradeCount;

			const bucketFor2Trades = byTradeCount.find((b) => b.tradeCount === 2);
			const bucketFor1Trade = byTradeCount.find((b) => b.tradeCount === 1);

			// Day 1 has 2 trades, so there should be 1 day with 2 trades
			expect(bucketFor2Trades?.days).toBe(1);
			// Day 2 has 1 trade, so there should be 1 day with 1 trade
			expect(bucketFor1Trade?.days).toBe(1);
		});

		it("should correctly identify trading days in user timezone", async () => {
			const calendarData = await caller.analytics.getCalendarData({
				accountId,
			});

			// Should have exactly 2 trading days
			const tradingDays = calendarData.filter((d) => d.trades > 0);
			expect(tradingDays.length).toBe(2);

			// Verify the dates are correct
			const dates = tradingDays.map((d) => d.date).sort();
			expect(dates).toContain(day1DateStr);
			expect(dates).toContain(day2DateStr);
		});
	});

	describe("Daily Journal Trade Grouping", () => {
		let caller: TestCaller;
		let entryDateStr: string;
		let nextDateStr: string;

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

			// Trade entered at 11 PM EST - should appear in that day's journal
			const tradeEntryTime = getDateAtLocalTime(10, 23, timezone); // 10 days ago, 11 PM
			const tradeExitTime = new Date(
				tradeEntryTime.getTime() + 8 * 60 * 60 * 1000,
			); // +8 hours (next morning)

			// Store expected date strings
			entryDateStr = getDateStringInTimezone(tradeEntryTime, timezone);
			// Next day string (for negative test)
			const nextDay = new Date(tradeEntryTime);
			nextDay.setDate(nextDay.getDate() + 1);
			nextDateStr = getDateStringInTimezone(nextDay, timezone);

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
			// Trade entered at 11 PM EST should be in that day's journal
			const result = await caller.dailyJournal.getWithTrades({
				date: entryDateStr,
			});

			expect(result.trades.length).toBe(1);
			expect(result.trades[0]?.symbol).toBe("ES");
		});

		it("should NOT include trade in next day journal (exit day)", async () => {
			// Trade should NOT appear in next day's journal
			const result = await caller.dailyJournal.getWithTrades({
				date: nextDateStr,
			});

			expect(result.trades.length).toBe(0);
		});
	});

	describe("Consistency Across Different Timezones", () => {
		it("should group correctly for Pacific timezone user", async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			const timezone = "America/Los_Angeles";

			// Set user timezone to America/Los_Angeles (PST, UTC-8)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Trade entered at 11 PM PST
			const tradeEntryTime = getDateAtLocalTime(5, 23, timezone); // 5 days ago, 11 PM
			const tradeExitTime = new Date(
				tradeEntryTime.getTime() + 8 * 60 * 60 * 1000,
			); // +8 hours

			const entryDateStr = getDateStringInTimezone(tradeEntryTime, timezone);
			const nextDay = new Date(tradeEntryTime);
			nextDay.setDate(nextDay.getDate() + 1);
			const nextDateStr = getDateStringInTimezone(nextDay, timezone);

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

			// Trade should appear on entry date in PST, not next day
			const entryDay = calendarData.find((d) => d.date === entryDateStr);
			const nextDayData = calendarData.find((d) => d.date === nextDateStr);

			expect(entryDay?.trades).toBe(1);
			expect(nextDayData?.trades ?? 0).toBe(0);

			await truncateAllTables();
		});

		it("should group correctly for far-ahead timezone (Pacific/Auckland)", async () => {
			await truncateAllTables();
			const db = getTestDb();

			const user = await createTestUser();
			const timezone = "Pacific/Auckland";

			// Set user timezone to Pacific/Auckland (NZDT, UTC+13 in summer)
			await db.insert(schema.userSettings).values({
				userId: user.id,
				timezone,
			});

			const account = await createTestAccount(user.id, { isDefault: true });

			// Trade at 11 AM UTC - which is midnight in Auckland (next day)
			const tradeEntryTime = getDateAtLocalTime(5, 0, timezone); // 5 days ago, midnight Auckland
			const tradeExitTime = new Date(
				tradeEntryTime.getTime() + 4 * 60 * 60 * 1000,
			); // +4 hours

			const entryDateStr = getDateStringInTimezone(tradeEntryTime, timezone);
			// Previous day in Auckland time
			const prevDay = new Date(tradeEntryTime);
			prevDay.setDate(prevDay.getDate() - 1);
			const prevDateStr = getDateStringInTimezone(prevDay, timezone);

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

			// Trade should appear on correct date in Auckland timezone
			const entryDay = calendarData.find((d) => d.date === entryDateStr);
			const prevDayData = calendarData.find((d) => d.date === prevDateStr);

			expect(prevDayData?.trades ?? 0).toBe(0);
			expect(entryDay?.trades).toBe(1);

			await truncateAllTables();
		});
	});

	describe("Calendar and Analytics Date Matching", () => {
		let caller: TestCaller;
		let accountId: string;
		let day1DateStr: string;
		let day2DateStr: string;

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

			// Create several trades across different days to test grouping

			// Day 1: 3 trades (9 AM, 2 PM, 11 PM)
			const day1_9am = getDateAtLocalTime(14, 9, timezone);
			day1DateStr = getDateStringInTimezone(day1_9am, timezone);

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5010",
				quantity: "1",
				entryTime: day1_9am,
				exitTime: new Date(day1_9am.getTime() + 2 * 60 * 60 * 1000),
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			const day1_2pm = getDateAtLocalTime(14, 14, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "short",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "17990",
				quantity: "1",
				entryTime: day1_2pm,
				exitTime: new Date(day1_2pm.getTime() + 1 * 60 * 60 * 1000),
				realizedPnl: "200",
				netPnl: "195",
				fees: "5",
			});

			// 11 PM same day (will be next day in UTC)
			const day1_11pm = getDateAtLocalTime(14, 23, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5020",
				exitPrice: "5030",
				quantity: "1",
				entryTime: day1_11pm,
				exitTime: new Date(day1_11pm.getTime() + 3 * 60 * 60 * 1000),
				realizedPnl: "500",
				netPnl: "495",
				fees: "5",
			});

			// Day 2: 2 trades (10 AM, 3 PM)
			const day2_10am = getDateAtLocalTime(13, 10, timezone);
			day2DateStr = getDateStringInTimezone(day2_10am, timezone);

			await createTestTrade(user.id, account.id, {
				symbol: "ES",
				direction: "short",
				status: "closed",
				entryPrice: "5040",
				exitPrice: "5060",
				quantity: "1",
				entryTime: day2_10am,
				exitTime: new Date(day2_10am.getTime() + 2 * 60 * 60 * 1000),
				realizedPnl: "-1000",
				netPnl: "-1005",
				fees: "5",
			});

			const day2_3pm = getDateAtLocalTime(13, 15, timezone);
			await createTestTrade(user.id, account.id, {
				symbol: "NQ",
				direction: "long",
				status: "closed",
				entryPrice: "18000",
				exitPrice: "18050",
				quantity: "1",
				entryTime: day2_3pm,
				exitTime: new Date(day2_3pm.getTime() + 2 * 60 * 60 * 1000),
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

			// Day 1 should have 3 trades (including 11 PM trade)
			const day1 = calendarData.find((d) => d.date === day1DateStr);
			expect(day1?.trades).toBe(3);

			// Day 2 should have 2 trades
			const day2 = calendarData.find((d) => d.date === day2DateStr);
			expect(day2?.trades).toBe(2);
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
