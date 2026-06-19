/**
 * Integration tests for dailyJournal.getJournalAdjacency endpoint.
 *
 * Tests the journal adjacency data returned for the streak calendar widget,
 * including trade counts, P&L, journal presence, word counts, and checklist completion.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Account, User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestTrade,
	FULL_ACCESS_AUTH,
	setupTrader,
	setupTraderWithMultipleAccounts,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("dailyJournal.getJournalAdjacency", () => {
	let user: User;
	let account: Account;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		user = setup.user;
		account = setup.account;
		caller = await createTestCaller(user.clerkId, user, FULL_ACCESS_AUTH);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// BASIC FUNCTIONALITY TESTS
	// ============================================================================

	describe("basic functionality", () => {
		it("should return results for date range with no pre-existing data", async () => {
			// Use date range that definitely has no data
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: "2020-01-01",
				endDate: "2020-01-03",
			});

			expect(result).toHaveLength(3); // 3 days in range
			for (const day of result) {
				expect(day.hasTrades).toBe(false);
				expect(day.tradeCount).toBe(0);
				expect(day.pnl).toBe(0);
				// hasJournal can be true/false depending on whether journal was auto-created
				// but these fields should be 0 when no explicit content/trades
				expect(day.journalWordCount).toBe(0);
			}
		});

		it("should return correct date strings for each day in range", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: "2020-02-01",
				endDate: "2020-02-05",
			});

			expect(result).toHaveLength(5);
			expect(result[0]?.date).toBe("2020-02-01");
			expect(result[1]?.date).toBe("2020-02-02");
			expect(result[2]?.date).toBe("2020-02-03");
			expect(result[3]?.date).toBe("2020-02-04");
			expect(result[4]?.date).toBe("2020-02-05");
		});

		it("should handle single-day range", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: "2020-03-15",
				endDate: "2020-03-15",
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.date).toBe("2020-03-15");
		});
	});

	// ============================================================================
	// TRADES + JOURNAL TESTS
	// ============================================================================

	describe("dates with trades + journal", () => {
		const testDate = "2024-05-01";

		beforeAll(async () => {
			// Create trades for this date
			await createTestTrade(user.id, account.id, {
				entryTime: new Date(`${testDate}T10:00:00Z`),
				exitTime: new Date(`${testDate}T11:00:00Z`),
				entryPrice: "5000.00",
				exitPrice: "5020.00", // +$1000 for ES
				stopLoss: "4980.00",
				status: "closed",
			});

			await createTestTrade(user.id, account.id, {
				entryTime: new Date(`${testDate}T14:00:00Z`),
				exitTime: new Date(`${testDate}T15:00:00Z`),
				entryPrice: "5010.00",
				exitPrice: "5000.00", // -$500 for ES
				stopLoss: "5030.00",
				status: "closed",
			});

			// Create journal with content for this date
			await caller.dailyJournal.updateContent({
				date: testDate,
				content:
					"<p>Today was a good trading day. I followed my plan and stayed disciplined.</p>",
			});

			// Start the day to enable checklist
			await caller.dailyJournal.startDay({ date: testDate });
		});

		it("should return correct trade count", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.hasTrades).toBe(true);
			expect(result[0]?.tradeCount).toBe(2);
		});

		it("should calculate correct P&L from trades", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			// Trade 1: +$1000 - $2.50 fees = $997.50
			// Trade 2: -$500 - $2.50 fees = -$502.50
			// Net P&L = $497.50 - $502.50 = $495 (approximately)
			// Using netPnl which includes fees
			expect(result[0]?.pnl).toBeCloseTo(495, 0);
		});

		it("should detect journal presence", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.hasJournal).toBe(true);
		});

		it("should calculate journal word count", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			// "Today was a good trading day. I followed my plan and stayed disciplined."
			// = 13 words (Today, was, a, good, trading, day, I, followed, my, plan, and, stayed, disciplined)
			expect(result[0]?.journalWordCount).toBe(13);
		});
	});

	// ============================================================================
	// TRADES + NO JOURNAL TESTS
	// ============================================================================

	describe("dates with trades + no journal", () => {
		const testDate = "2024-05-10";

		beforeAll(async () => {
			// Create trades for this date
			await createTestTrade(user.id, account.id, {
				entryTime: new Date(`${testDate}T09:30:00Z`),
				exitTime: new Date(`${testDate}T10:30:00Z`),
				entryPrice: "5050.00",
				exitPrice: "5070.00", // +$1000 for ES
				stopLoss: "5030.00",
				status: "closed",
			});

			// Don't create a journal for this date
		});

		it("should return trade data with no journal content", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.hasTrades).toBe(true);
			expect(result[0]?.tradeCount).toBe(1);
			// No journal was explicitly created - hasJournal should be false
			expect(result[0]?.hasJournal).toBe(false);
			expect(result[0]?.journalWordCount).toBe(0);
		});

		it("should calculate P&L even without journal", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			// +$1000 - $2.50 fees = $997.50
			expect(result[0]?.pnl).toBeCloseTo(997.5, 1);
		});
	});

	// ============================================================================
	// NO TRADES TESTS
	// ============================================================================

	describe("dates with no trades", () => {
		const testDate = "2024-05-15";

		beforeAll(async () => {
			// Create journal with content but no trades
			await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>No trades today. Market was choppy.</p>",
			});
		});

		it("should return journal data but no trades", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.hasTrades).toBe(false);
			expect(result[0]?.tradeCount).toBe(0);
			expect(result[0]?.pnl).toBe(0);
			expect(result[0]?.hasJournal).toBe(true);
			// "No trades today. Market was choppy." = 6 words
			expect(result[0]?.journalWordCount).toBe(6);
		});

		it("should detect journal from content even without day started", async () => {
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			// hasJournal should be true because content is present
			expect(result[0]?.hasJournal).toBe(true);
		});
	});

	// ============================================================================
	// ACCOUNT FILTERING TESTS
	// ============================================================================

	describe("account filtering", () => {
		let user2: User;
		let accounts: Account[];
		let caller2: TestCaller;
		const testDate = "2024-06-01";

		beforeAll(async () => {
			// Create a new user with multiple accounts
			const setup = await setupTraderWithMultipleAccounts(2);
			user2 = setup.user;
			accounts = setup.accounts;
			caller2 = await createTestCaller(user2.clerkId, user2);

			// Create trades in first account
			await createTestTrade(user2.id, accounts[0]?.id ?? "", {
				entryTime: new Date(`${testDate}T10:00:00Z`),
				exitTime: new Date(`${testDate}T11:00:00Z`),
				entryPrice: "5000.00",
				exitPrice: "5010.00", // +$500
				stopLoss: "4990.00",
				status: "closed",
			});

			// Create trades in second account
			await createTestTrade(user2.id, accounts[1]?.id ?? "", {
				entryTime: new Date(`${testDate}T12:00:00Z`),
				exitTime: new Date(`${testDate}T13:00:00Z`),
				entryPrice: "5020.00",
				exitPrice: "5040.00", // +$1000
				stopLoss: "5000.00",
				status: "closed",
			});

			await createTestTrade(user2.id, accounts[1]?.id ?? "", {
				entryTime: new Date(`${testDate}T14:00:00Z`),
				exitTime: new Date(`${testDate}T15:00:00Z`),
				entryPrice: "5030.00",
				exitPrice: "5050.00", // +$1000
				stopLoss: "5010.00",
				status: "closed",
			});
		});

		it("should return all trades when no account filter", async () => {
			const result = await caller2.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.tradeCount).toBe(3);
		});

		it("should filter to first account only", async () => {
			const result = await caller2.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
				accountId: accounts[0]?.id,
			});

			expect(result[0]?.tradeCount).toBe(1);
			// +$500 - $2.50 fees = $497.50
			expect(result[0]?.pnl).toBeCloseTo(497.5, 1);
		});

		it("should filter to second account only", async () => {
			const result = await caller2.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
				accountId: accounts[1]?.id,
			});

			expect(result[0]?.tradeCount).toBe(2);
			// Trade 1: +$1000 - $2.50 = $997.50
			// Trade 2: +$1000 - $2.50 = $997.50
			// Total = $1995
			expect(result[0]?.pnl).toBeCloseTo(1995, 0);
		});
	});

	// ============================================================================
	// MULTI-DAY RANGE TESTS
	// ============================================================================

	describe("multi-day range", () => {
		let user3: User;
		let account3: Account;
		let caller3: TestCaller;

		beforeAll(async () => {
			const setup = await setupTrader();
			user3 = setup.user;
			account3 = setup.account;
			caller3 = await createTestCaller(user3.clerkId, user3, FULL_ACCESS_AUTH);

			// Day 1: Trades + Journal
			await createTestTrade(user3.id, account3.id, {
				entryTime: new Date("2024-07-01T10:00:00Z"),
				exitTime: new Date("2024-07-01T11:00:00Z"),
				entryPrice: "5000.00",
				exitPrice: "5020.00",
				stopLoss: "4980.00",
				status: "closed",
			});
			await caller3.dailyJournal.updateContent({
				date: "2024-07-01",
				content: "<p>Great day!</p>",
			});

			// Day 2: No trades, no journal (empty day)

			// Day 3: Trades only, no journal
			await createTestTrade(user3.id, account3.id, {
				entryTime: new Date("2024-07-03T10:00:00Z"),
				exitTime: new Date("2024-07-03T11:00:00Z"),
				entryPrice: "5010.00",
				exitPrice: "5000.00",
				stopLoss: "5020.00",
				status: "closed",
			});

			// Day 4: Journal only, no trades
			await caller3.dailyJournal.updateContent({
				date: "2024-07-04",
				content: "<p>Market was closed today.</p>",
			});

			// Day 5: Multiple trades
			await createTestTrade(user3.id, account3.id, {
				entryTime: new Date("2024-07-05T09:00:00Z"),
				exitTime: new Date("2024-07-05T10:00:00Z"),
				entryPrice: "5020.00",
				exitPrice: "5030.00",
				stopLoss: "5010.00",
				status: "closed",
			});
			await createTestTrade(user3.id, account3.id, {
				entryTime: new Date("2024-07-05T11:00:00Z"),
				exitTime: new Date("2024-07-05T12:00:00Z"),
				entryPrice: "5030.00",
				exitPrice: "5050.00",
				stopLoss: "5020.00",
				status: "closed",
			});
		});

		it("should return correct data for multi-day range", async () => {
			const result = await caller3.dailyJournal.getJournalAdjacency({
				startDate: "2024-07-01",
				endDate: "2024-07-05",
			});

			expect(result).toHaveLength(5);

			// Day 1: Trades + Journal
			expect(result[0]?.date).toBe("2024-07-01");
			expect(result[0]?.hasTrades).toBe(true);
			expect(result[0]?.tradeCount).toBe(1);
			expect(result[0]?.hasJournal).toBe(true);
			expect(result[0]?.journalWordCount).toBe(2); // "Great day!"

			// Day 2: Empty day
			expect(result[1]?.date).toBe("2024-07-02");
			expect(result[1]?.hasTrades).toBe(false);
			expect(result[1]?.tradeCount).toBe(0);
			expect(result[1]?.hasJournal).toBe(false);

			// Day 3: Trades only
			expect(result[2]?.date).toBe("2024-07-03");
			expect(result[2]?.hasTrades).toBe(true);
			expect(result[2]?.tradeCount).toBe(1);
			expect(result[2]?.hasJournal).toBe(false);

			// Day 4: Journal only
			expect(result[3]?.date).toBe("2024-07-04");
			expect(result[3]?.hasTrades).toBe(false);
			expect(result[3]?.tradeCount).toBe(0);
			expect(result[3]?.hasJournal).toBe(true);
			expect(result[3]?.journalWordCount).toBe(4); // "Market was closed today."

			// Day 5: Multiple trades
			expect(result[4]?.date).toBe("2024-07-05");
			expect(result[4]?.hasTrades).toBe(true);
			expect(result[4]?.tradeCount).toBe(2);
		});
	});

	// ============================================================================
	// USER ISOLATION TESTS
	// ============================================================================

	describe("user isolation", () => {
		let user4: User;
		let account4: Account;
		let caller4: TestCaller;
		const testDate = "2024-08-01";

		beforeAll(async () => {
			// Create another user with trades
			const setup = await setupTrader();
			user4 = setup.user;
			account4 = setup.account;
			caller4 = await createTestCaller(user4.clerkId, user4);

			// Create trades for user4
			await createTestTrade(user4.id, account4.id, {
				entryTime: new Date(`${testDate}T10:00:00Z`),
				exitTime: new Date(`${testDate}T11:00:00Z`),
				status: "closed",
			});
		});

		it("should not see other user's trades", async () => {
			// Original user should not see user4's trades
			const result = await caller.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			// Original user has no trades on this date
			expect(result[0]?.hasTrades).toBe(false);
			expect(result[0]?.tradeCount).toBe(0);
		});

		it("should only see own user's trades", async () => {
			// user4 should see their own trade
			const result = await caller4.dailyJournal.getJournalAdjacency({
				startDate: testDate,
				endDate: testDate,
			});

			expect(result[0]?.hasTrades).toBe(true);
			expect(result[0]?.tradeCount).toBe(1);
		});
	});
});
