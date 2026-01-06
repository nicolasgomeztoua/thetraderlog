import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tags, tradeTags } from "@/server/db/schema";
import {
	createTestCaller,
	createTestTrade,
	getTestDb,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics getFilteredTradeCount", () => {
	let caller: TestCaller;
	let userId: string;
	let accountId: string;
	let tagId1: string;
	let tagId2: string;

	beforeAll(async () => {
		await truncateAllTables();
		const { user, account } = await setupTrader();
		userId = user.id;
		accountId = account.id;
		caller = await createTestCaller(user.clerkId, user);

		const db = getTestDb();

		// Create tags
		const [tag1] = await db
			.insert(tags)
			.values({
				userId,
				name: "momentum",
				color: "#ff0000",
			})
			.returning();
		const [tag2] = await db
			.insert(tags)
			.values({
				userId,
				name: "reversal",
				color: "#00ff00",
			})
			.returning();

		tagId1 = tag1?.id ?? "";
		tagId2 = tag2?.id ?? "";

		// Create trades with different characteristics
		const mondayMorning = new Date("2024-01-08T09:30:00Z");
		const tuesdayMorning = new Date("2024-01-09T10:00:00Z");
		const wednesdayMorning = new Date("2024-01-10T09:00:00Z");

		// Trade 1: ES, win, tag1
		const trade1 = await createTestTrade(userId, accountId, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5000",
			exitPrice: "5020",
			quantity: "1",
			entryTime: mondayMorning,
			exitTime: new Date(mondayMorning.getTime() + 30 * 60000),
			realizedPnl: "1000",
			netPnl: "995",
			fees: "5",
		});

		// Trade 2: NQ, loss, tag2
		const trade2 = await createTestTrade(userId, accountId, {
			symbol: "NQ",
			direction: "short",
			status: "closed",
			entryPrice: "17500",
			exitPrice: "17550",
			quantity: "1",
			entryTime: tuesdayMorning,
			exitTime: new Date(tuesdayMorning.getTime() + 60 * 60000),
			realizedPnl: "-1000",
			netPnl: "-1005",
			fees: "5",
		});

		// Trade 3: ES, win, both tags
		const trade3 = await createTestTrade(userId, accountId, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5050",
			exitPrice: "5070",
			quantity: "1",
			entryTime: wednesdayMorning,
			exitTime: new Date(wednesdayMorning.getTime() + 45 * 60000),
			realizedPnl: "1000",
			netPnl: "990",
			fees: "10",
		});

		// Trade 4: ES, win, no tags
		await createTestTrade(userId, accountId, {
			symbol: "ES",
			direction: "long",
			status: "closed",
			entryPrice: "5100",
			exitPrice: "5120",
			quantity: "1",
			entryTime: new Date(wednesdayMorning.getTime() + 2 * 60 * 60000),
			exitTime: new Date(wednesdayMorning.getTime() + 3 * 60 * 60000),
			realizedPnl: "1000",
			netPnl: "995",
			fees: "5",
		});

		// Assign tags to trades
		await db.insert(tradeTags).values([
			{ tradeId: trade1.id, tagId: tagId1 },
			{ tradeId: trade2.id, tagId: tagId2 },
			{ tradeId: trade3.id, tagId: tagId1 },
			{ tradeId: trade3.id, tagId: tagId2 },
		]);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// BASIC COUNT
	// ============================================================================

	describe("Basic Count", () => {
		it("should return all closed trades when no filters applied", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
			});

			expect(result.count).toBe(4);
		});

		it("should return 0 for empty account", async () => {
			const { user: user2, account: account2 } = await setupTrader();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			const result = await caller2.analytics.getFilteredTradeCount({
				accountId: account2.id,
			});

			expect(result.count).toBe(0);
		});
	});

	// ============================================================================
	// SYMBOL FILTER
	// ============================================================================

	describe("Symbol Filter", () => {
		it("should filter by single symbol", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { symbols: ["ES"] },
			});

			expect(result.count).toBe(3); // 3 ES trades
		});

		it("should filter by multiple symbols", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { symbols: ["ES", "NQ"] },
			});

			expect(result.count).toBe(4); // All trades
		});

		it("should return 0 for non-existent symbol", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { symbols: ["AAPL"] },
			});

			expect(result.count).toBe(0);
		});
	});

	// ============================================================================
	// OUTCOME FILTER
	// ============================================================================

	describe("Outcome Filter", () => {
		it("should filter wins only", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { outcome: "win" },
			});

			expect(result.count).toBe(3); // 3 winning trades
		});

		it("should filter losses only", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { outcome: "loss" },
			});

			expect(result.count).toBe(1); // 1 losing trade
		});

		it("should return all when outcome is 'all'", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { outcome: "all" },
			});

			expect(result.count).toBe(4);
		});
	});

	// ============================================================================
	// DATE RANGE FILTER
	// ============================================================================

	describe("Date Range Filter", () => {
		it("should filter by start date", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: {
					dateRange: {
						start: "2024-01-09T00:00:00Z",
						end: null,
					},
				},
			});

			// Tuesday and Wednesday trades
			expect(result.count).toBe(3);
		});

		it("should filter by date range", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: {
					dateRange: {
						start: "2024-01-08T00:00:00Z",
						end: "2024-01-08T23:59:59Z",
					},
				},
			});

			// Only Monday trade
			expect(result.count).toBe(1);
		});
	});

	// ============================================================================
	// TAGS FILTER
	// ============================================================================

	describe("Tags Filter", () => {
		it("should filter by single tag", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { tags: [tagId1] },
			});

			// Trade 1 and Trade 3 have tag1
			expect(result.count).toBe(2);
		});

		it("should filter by another tag", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { tags: [tagId2] },
			});

			// Trade 2 and Trade 3 have tag2
			expect(result.count).toBe(2);
		});

		it("should filter by multiple tags (OR logic)", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { tags: [tagId1, tagId2] },
			});

			// Trade 1 (tag1), Trade 2 (tag2), Trade 3 (both) - 3 unique trades
			expect(result.count).toBe(3);
		});

		it("should return 0 for non-existent tag", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: { tags: ["non-existent-tag-id"] },
			});

			expect(result.count).toBe(0);
		});
	});

	// ============================================================================
	// COMBINED FILTERS
	// ============================================================================

	describe("Combined Filters", () => {
		it("should combine symbol and outcome filters", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: {
					symbols: ["ES"],
					outcome: "win",
				},
			});

			// 3 ES trades, all are wins
			expect(result.count).toBe(3);
		});

		it("should combine tags and outcome filters", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: {
					tags: [tagId1],
					outcome: "win",
				},
			});

			// Tag1 trades: Trade 1 (win), Trade 3 (win) - both wins
			expect(result.count).toBe(2);
		});

		it("should combine symbol, tags, and outcome filters", async () => {
			const result = await caller.analytics.getFilteredTradeCount({
				accountId,
				filters: {
					symbols: ["ES"],
					tags: [tagId1],
					outcome: "win",
				},
			});

			// ES trades with tag1 that are wins: Trade 1, Trade 3
			expect(result.count).toBe(2);
		});
	});

	// ============================================================================
	// USER ISOLATION
	// ============================================================================

	describe("User Isolation", () => {
		it("should not count other users trades", async () => {
			const { user: user2, account: account2 } = await setupTrader();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			// Create a trade for user2
			await createTestTrade(user2.id, account2.id, {
				symbol: "ES",
				direction: "long",
				status: "closed",
				entryPrice: "5000",
				exitPrice: "5020",
				quantity: "1",
				entryTime: new Date("2024-01-08T09:30:00Z"),
				exitTime: new Date("2024-01-08T10:00:00Z"),
				realizedPnl: "1000",
				netPnl: "995",
				fees: "5",
			});

			// User 1 should still see only their 4 trades
			const result1 = await caller.analytics.getFilteredTradeCount({
				accountId,
			});
			expect(result1.count).toBe(4);

			// User 2 should only see their 1 trade
			const result2 = await caller2.analytics.getFilteredTradeCount({
				accountId: account2.id,
			});
			expect(result2.count).toBe(1);
		});
	});
});
