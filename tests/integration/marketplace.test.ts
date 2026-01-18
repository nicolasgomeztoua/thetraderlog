/**
 * Integration tests for marketplace backend endpoints.
 *
 * Tests:
 * - strategies.publish / strategies.unpublish: Marketplace visibility
 * - marketplace.list: Paginated public strategy listing
 * - marketplace.vote / marketplace.removeVote: Voting system
 * - marketplace.download: Strategy copy/download
 * - marketplace.getById: Public strategy detail view
 * - marketplace.report: Content reporting
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIN_TRADES_TO_PUBLISH } from "@/lib/constants";
import {
	createTestCaller,
	createTestTrades,
	createTestUser,
	createUnauthenticatedCaller,
	getTestDb,
	schema,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// TEST SETUP
// =============================================================================

describe("marketplace backend", () => {
	let caller: TestCaller;
	let otherUserCaller: TestCaller;
	let thirdUserCaller: TestCaller;
	let testUser: Awaited<ReturnType<typeof setupTrader>>["user"];
	let otherUser: Awaited<ReturnType<typeof createTestUser>>;
	let thirdUser: Awaited<ReturnType<typeof createTestUser>>;
	let testAccount: Awaited<ReturnType<typeof setupTrader>>["account"];
	let db: ReturnType<typeof getTestDb>;

	beforeAll(async () => {
		await truncateAllTables();
		db = getTestDb();

		// Create three users for ownership/permission tests
		const setup = await setupTrader();
		testUser = setup.user;
		testAccount = setup.account;
		caller = await createTestCaller(testUser.clerkId, testUser);

		otherUser = await createTestUser({ email: "other@test.com" });
		otherUserCaller = await createTestCaller(otherUser.clerkId, otherUser);

		thirdUser = await createTestUser({ email: "third@test.com" });
		thirdUserCaller = await createTestCaller(thirdUser.clerkId, thirdUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =============================================================================
	// HELPER: Create a test strategy with trades
	// =============================================================================

	async function createStrategyWithTrades(
		tradeCount: number,
		overrides?: {
			name?: string;
			description?: string;
			color?: string;
		},
	) {
		const strategy = await caller.strategies.create({
			name: overrides?.name ?? "Test Strategy",
			description: overrides?.description ?? "A test strategy for marketplace",
			color: overrides?.color ?? "#d4ff00",
		});

		// Create closed trades linked to this strategy
		if (tradeCount > 0) {
			await createTestTrades(testUser.id, testAccount.id, tradeCount, {
				status: "closed",
			});

			// Link trades to the strategy
			const trades = await db.query.trades.findMany({
				where: eq(schema.trades.userId, testUser.id),
				orderBy: [schema.trades.createdAt],
				limit: tradeCount,
			});

			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: strategy.id })
					.where(eq(schema.trades.id, trade.id));
			}
		}

		return strategy;
	}

	// =============================================================================
	// PUBLISH MUTATION TESTS
	// =============================================================================

	describe("strategies.publish", () => {
		it("should publish a strategy with valid data and sufficient trades", async () => {
			const strategy = await createStrategyWithTrades(MIN_TRADES_TO_PUBLISH, {
				name: "Publishable Strategy",
				description: "Has enough trades to publish",
			});

			const result = await caller.strategies.publish({
				id: strategy.id,
				isAnonymous: false,
				instruments: ["ES", "NQ"],
				categoryTags: ["Scalping", "Day Trading"],
			});

			expect(result.isPublic).toBe(true);
			expect(result.isAnonymous).toBe(false);
			expect(result.instruments).toEqual(["ES", "NQ"]);
			expect(result.categoryTags).toEqual(["Scalping", "Day Trading"]);
			expect(result.cachedStats).toBeDefined();
			expect(result.cachedStats.totalTrades).toBe(MIN_TRADES_TO_PUBLISH);
		});

		it("should compute and cache stats on publish", async () => {
			const strategy = await createStrategyWithTrades(25, {
				name: "Stats Strategy",
				description: "For stats testing",
			});

			const result = await caller.strategies.publish({
				id: strategy.id,
			});

			expect(result.cachedStats).toBeDefined();
			expect(result.cachedStats.totalTrades).toBe(25);
			expect(result.cachedStats.wins).toBeDefined();
			expect(result.cachedStats.losses).toBeDefined();
			expect(result.cachedStats.winRate).toBeDefined();
			expect(result.cachedStats.profitFactor).toBeDefined();
			expect(result.cachedStats.computedAt).toBeDefined();
		});

		it("should reject strategies without a name", async () => {
			// Create strategy with empty name
			const strategy = await caller.strategies.create({
				name: "Temp",
				description: "Test description",
			});

			// Clear the name
			await db
				.update(schema.strategies)
				.set({ name: "" })
				.where(eq(schema.strategies.id, strategy.id));

			// Create enough trades
			await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			const trades = await db.query.trades.findMany({
				where: eq(schema.trades.userId, testUser.id),
				orderBy: [schema.trades.createdAt],
				limit: MIN_TRADES_TO_PUBLISH,
			});
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: strategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await expect(
				caller.strategies.publish({ id: strategy.id }),
			).rejects.toThrow(/must have a name/);
		});

		it("should reject strategies without a description", async () => {
			const strategy = await caller.strategies.create({
				name: "No Description Strategy",
			});

			// Create enough trades
			await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			const trades = await db.query.trades.findMany({
				where: eq(schema.trades.userId, testUser.id),
				orderBy: [schema.trades.createdAt],
				limit: MIN_TRADES_TO_PUBLISH,
			});
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: strategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await expect(
				caller.strategies.publish({ id: strategy.id }),
			).rejects.toThrow(/must have a description/);
		});

		it("should reject strategies with fewer than 20 trades", async () => {
			const strategy = await createStrategyWithTrades(5, {
				name: "Few Trades Strategy",
				description: "Not enough trades",
			});

			await expect(
				caller.strategies.publish({ id: strategy.id }),
			).rejects.toThrow(/at least 20 closed trades/);
		});

		it("should reject if not strategy owner", async () => {
			const strategy = await createStrategyWithTrades(MIN_TRADES_TO_PUBLISH, {
				name: "Owner Test",
				description: "Testing ownership",
			});

			await expect(
				otherUserCaller.strategies.publish({ id: strategy.id }),
			).rejects.toThrow(/Strategy not found/);
		});

		it("should support anonymous publishing", async () => {
			const strategy = await createStrategyWithTrades(MIN_TRADES_TO_PUBLISH, {
				name: "Anonymous Strategy",
				description: "Hidden identity",
			});

			const result = await caller.strategies.publish({
				id: strategy.id,
				isAnonymous: true,
			});

			expect(result.isAnonymous).toBe(true);
		});
	});

	// =============================================================================
	// UNPUBLISH MUTATION TESTS
	// =============================================================================

	describe("strategies.unpublish", () => {
		it("should unpublish a published strategy", async () => {
			const strategy = await createStrategyWithTrades(MIN_TRADES_TO_PUBLISH, {
				name: "To Unpublish",
				description: "Will be unpublished",
			});

			// First publish
			await caller.strategies.publish({ id: strategy.id });

			// Then unpublish
			const result = await caller.strategies.unpublish({ id: strategy.id });

			expect(result.isPublic).toBe(false);
		});

		it("should reject if not strategy owner", async () => {
			const strategy = await createStrategyWithTrades(MIN_TRADES_TO_PUBLISH, {
				name: "Other Owner Unpublish",
				description: "Testing ownership",
			});

			await caller.strategies.publish({ id: strategy.id });

			await expect(
				otherUserCaller.strategies.unpublish({ id: strategy.id }),
			).rejects.toThrow(/Strategy not found/);
		});
	});

	// =============================================================================
	// MARKETPLACE LIST QUERY TESTS
	// =============================================================================

	describe("marketplace.list", () => {
		beforeAll(async () => {
			// Clean up and create fresh public strategies for list tests
			await truncateAllTables();

			// Re-setup users
			const setup = await setupTrader();
			testUser = setup.user;
			testAccount = setup.account;
			caller = await createTestCaller(testUser.clerkId, testUser);

			otherUser = await createTestUser({ email: "other@test.com" });
			otherUserCaller = await createTestCaller(otherUser.clerkId, otherUser);

			// Create and publish a few strategies
			for (let i = 0; i < 3; i++) {
				const strategy = await caller.strategies.create({
					name: `Public Strategy ${i + 1}`,
					description: `Description for strategy ${i + 1}`,
					color: `#${(i + 1).toString().repeat(6).slice(0, 6)}`,
				});

				// Create trades for this strategy
				const trades = await createTestTrades(
					testUser.id,
					testAccount.id,
					MIN_TRADES_TO_PUBLISH,
				);
				for (const trade of trades) {
					await db
						.update(schema.trades)
						.set({ strategyId: strategy.id })
						.where(eq(schema.trades.id, trade.id));
				}

				await caller.strategies.publish({
					id: strategy.id,
					instruments: ["ES"],
					categoryTags: ["Scalping"],
				});
			}
		});

		it("should return paginated public strategies", async () => {
			const result = await caller.marketplace.list({ limit: 10 });

			expect(result.items).toBeDefined();
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.length).toBeLessThanOrEqual(10);
		});

		it("should include strategy fields in response", async () => {
			const result = await caller.marketplace.list({ limit: 1 });
			const strategy = result.items[0];

			expect(strategy).toBeDefined();
			expect(strategy?.id).toBeDefined();
			expect(strategy?.name).toBeDefined();
			expect(strategy?.description).toBeDefined();
			expect(strategy?.stats).toBeDefined();
			expect(strategy?.engagement).toBeDefined();
			expect(strategy?.trackRecordStatus).toBeDefined();
		});

		it("should include engagement data", async () => {
			const result = await caller.marketplace.list({ limit: 1 });
			const strategy = result.items[0];

			expect(strategy?.engagement.voteScore).toBeDefined();
			expect(strategy?.engagement.downloadCount).toBeDefined();
		});

		it("should include track record status", async () => {
			const result = await caller.marketplace.list({ limit: 1 });
			const strategy = result.items[0];

			// With 20 trades, should be "limited" (< 30)
			expect(["limited", "normal", "verified"]).toContain(
				strategy?.trackRecordStatus,
			);
		});

		it("should support search filter", async () => {
			const result = await caller.marketplace.list({
				search: "Strategy 1",
				limit: 10,
			});

			// Should find the strategy with "Strategy 1" in name
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.some((s) => s.name.includes("Strategy 1"))).toBe(
				true,
			);
		});

		it("should support instrument filter", async () => {
			const result = await caller.marketplace.list({
				instruments: ["ES"],
				limit: 10,
			});

			// All strategies were published with ES instrument
			expect(result.items.length).toBeGreaterThan(0);
		});

		it("should support category filter", async () => {
			const result = await caller.marketplace.list({
				categories: ["Scalping"],
				limit: 10,
			});

			// All strategies were published with Scalping category
			expect(result.items.length).toBeGreaterThan(0);
		});

		it("should not require authentication", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			const result = await unauthCaller.marketplace.list({ limit: 10 });

			expect(result.items).toBeDefined();
			expect(result.items.length).toBeGreaterThan(0);
		});
	});

	// =============================================================================
	// MARKETPLACE GET BY ID QUERY TESTS
	// =============================================================================

	describe("marketplace.getById", () => {
		let publicStrategy: Awaited<ReturnType<typeof caller.strategies.create>>;
		let privateStrategy: Awaited<ReturnType<typeof caller.strategies.create>>;

		beforeAll(async () => {
			// Create a public strategy
			publicStrategy = await caller.strategies.create({
				name: "Public Detail Strategy",
				description: "For getById testing",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: publicStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: publicStrategy.id });

			// Create a private strategy
			privateStrategy = await caller.strategies.create({
				name: "Private Strategy",
				description: "Should not be accessible",
			});
		});

		it("should return public strategy details", async () => {
			const result = await caller.marketplace.getById({
				id: publicStrategy.id,
			});

			expect(result.id).toBe(publicStrategy.id);
			expect(result.name).toBe("Public Detail Strategy");
			expect(result.stats).toBeDefined();
			expect(result.engagement).toBeDefined();
		});

		it("should include creator info when not anonymous", async () => {
			const result = await caller.marketplace.getById({
				id: publicStrategy.id,
			});

			expect(result.creator).toBeDefined();
			expect(result.creator?.id).toBe(testUser.id);
		});

		it("should hide creator info when anonymous", async () => {
			// Create and publish anonymous strategy
			const anonStrategy = await caller.strategies.create({
				name: "Anonymous Strategy Detail",
				description: "Testing anonymous",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: anonStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({
				id: anonStrategy.id,
				isAnonymous: true,
			});

			const result = await caller.marketplace.getById({ id: anonStrategy.id });
			expect(result.creator).toBeNull();
		});

		it("should reject private strategies", async () => {
			await expect(
				caller.marketplace.getById({ id: privateStrategy.id }),
			).rejects.toThrow(/not found or is not public/);
		});

		it("should not require authentication", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			const result = await unauthCaller.marketplace.getById({
				id: publicStrategy.id,
			});

			expect(result.id).toBe(publicStrategy.id);
		});
	});

	// =============================================================================
	// VOTING TESTS
	// =============================================================================

	describe("marketplace.vote and marketplace.removeVote", () => {
		let votableStrategy: Awaited<ReturnType<typeof caller.strategies.create>>;

		beforeAll(async () => {
			// Create a public strategy owned by testUser
			votableStrategy = await caller.strategies.create({
				name: "Votable Strategy",
				description: "For voting tests",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: votableStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: votableStrategy.id });
		});

		it("should allow upvoting a public strategy", async () => {
			const result = await otherUserCaller.marketplace.vote({
				strategyId: votableStrategy.id,
				vote: 1,
			});

			expect(result.voteScore).toBe(1);
		});

		it("should allow downvoting a public strategy", async () => {
			// Create fresh strategy for this test
			const downvoteStrategy = await caller.strategies.create({
				name: "Downvote Strategy",
				description: "For downvote test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: downvoteStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: downvoteStrategy.id });

			const result = await otherUserCaller.marketplace.vote({
				strategyId: downvoteStrategy.id,
				vote: -1,
			});

			expect(result.voteScore).toBe(-1);
		});

		it("should replace existing vote with new vote", async () => {
			// Create fresh strategy
			const replaceStrategy = await caller.strategies.create({
				name: "Replace Vote Strategy",
				description: "For replace test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: replaceStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: replaceStrategy.id });

			// First vote up
			await otherUserCaller.marketplace.vote({
				strategyId: replaceStrategy.id,
				vote: 1,
			});

			// Then vote down (should replace)
			const result = await otherUserCaller.marketplace.vote({
				strategyId: replaceStrategy.id,
				vote: -1,
			});

			expect(result.voteScore).toBe(-1);
		});

		it("should prevent voting on own strategy", async () => {
			await expect(
				caller.marketplace.vote({
					strategyId: votableStrategy.id,
					vote: 1,
				}),
			).rejects.toThrow(/Cannot vote on your own strategy/);
		});

		it("should remove vote successfully", async () => {
			// Create fresh strategy and vote
			const removeStrategy = await caller.strategies.create({
				name: "Remove Vote Strategy",
				description: "For remove test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: removeStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: removeStrategy.id });

			// Vote
			await otherUserCaller.marketplace.vote({
				strategyId: removeStrategy.id,
				vote: 1,
			});

			// Remove vote
			const result = await otherUserCaller.marketplace.removeVote({
				strategyId: removeStrategy.id,
			});

			expect(result.voteScore).toBe(0);
		});

		it("should return updated score after remove", async () => {
			// Create strategy with multiple votes
			const multiVoteStrategy = await caller.strategies.create({
				name: "Multi Vote Strategy",
				description: "For multi vote test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: multiVoteStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: multiVoteStrategy.id });

			// Two users vote
			await otherUserCaller.marketplace.vote({
				strategyId: multiVoteStrategy.id,
				vote: 1,
			});
			await thirdUserCaller.marketplace.vote({
				strategyId: multiVoteStrategy.id,
				vote: 1,
			});

			// One removes vote
			const result = await otherUserCaller.marketplace.removeVote({
				strategyId: multiVoteStrategy.id,
			});

			expect(result.voteScore).toBe(1); // Only thirdUser's vote remains
		});

		it("should reject voting on private strategies", async () => {
			const privateStrategy = await caller.strategies.create({
				name: "Private No Vote",
				description: "Cannot vote",
			});

			await expect(
				otherUserCaller.marketplace.vote({
					strategyId: privateStrategy.id,
					vote: 1,
				}),
			).rejects.toThrow(/not found or is not public/);
		});

		it("should require authentication for voting", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.marketplace.vote({
					strategyId: votableStrategy.id,
					vote: 1,
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});
	});

	// =============================================================================
	// DOWNLOAD TESTS
	// =============================================================================

	describe("marketplace.download", () => {
		let downloadableStrategy: Awaited<
			ReturnType<typeof caller.strategies.create>
		>;

		beforeAll(async () => {
			// Create a public strategy owned by testUser
			downloadableStrategy = await caller.strategies.create({
				name: "Downloadable Strategy",
				description: "For download tests",
				entryCriteria: "Entry criteria text",
				exitRules: "Exit rules text",
				riskParameters: {
					positionSizing: { method: "risk_percent", riskPercent: 1 },
				},
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: downloadableStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: downloadableStrategy.id });
		});

		it("should create a copy of the strategy", async () => {
			const result = await otherUserCaller.marketplace.download({
				strategyId: downloadableStrategy.id,
			});

			expect(result.id).not.toBe(downloadableStrategy.id);
			expect(result.name).toBe("Downloadable Strategy (Copy)");
			expect(result.description).toBe("For download tests");
			expect(result.sourceStrategyId).toBe(downloadableStrategy.id);
		});

		it("should copy strategy content but not publish status", async () => {
			// Create fresh downloadable
			const contentStrategy = await caller.strategies.create({
				name: "Content Strategy",
				description: "With content",
				entryCriteria: "Entry criteria",
				exitRules: "Exit rules",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: contentStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: contentStrategy.id });

			const result = await thirdUserCaller.marketplace.download({
				strategyId: contentStrategy.id,
			});

			expect(result.entryCriteria).toBe("Entry criteria");
			expect(result.exitRules).toBe("Exit rules");
			expect(result.isPublic).toBe(false); // Copy starts as private
		});

		it("should record the download in strategyDownloads", async () => {
			// Create fresh for clean test
			const recordStrategy = await caller.strategies.create({
				name: "Record Strategy",
				description: "For record test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: recordStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: recordStrategy.id });

			await otherUserCaller.marketplace.download({
				strategyId: recordStrategy.id,
			});

			// Check download record exists
			const download = await db.query.strategyDownloads.findFirst({
				where: eq(
					schema.strategyDownloads.originalStrategyId,
					recordStrategy.id,
				),
			});

			expect(download).toBeDefined();
			expect(download?.userId).toBe(otherUser.id);
		});

		it("should prevent downloading own strategy", async () => {
			await expect(
				caller.marketplace.download({
					strategyId: downloadableStrategy.id,
				}),
			).rejects.toThrow(/Cannot download your own strategy/);
		});

		it("should prevent downloading same strategy twice", async () => {
			// Create fresh for this test
			const duplicateStrategy = await caller.strategies.create({
				name: "Duplicate Strategy",
				description: "For duplicate test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: duplicateStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: duplicateStrategy.id });

			// First download succeeds
			await thirdUserCaller.marketplace.download({
				strategyId: duplicateStrategy.id,
			});

			// Second download fails
			await expect(
				thirdUserCaller.marketplace.download({
					strategyId: duplicateStrategy.id,
				}),
			).rejects.toThrow(/already downloaded/);
		});

		it("should require authentication", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.marketplace.download({
					strategyId: downloadableStrategy.id,
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});
	});

	// =============================================================================
	// REPORT TESTS
	// =============================================================================

	describe("marketplace.report", () => {
		let reportableStrategy: Awaited<
			ReturnType<typeof caller.strategies.create>
		>;

		beforeAll(async () => {
			// Create a public strategy owned by testUser
			reportableStrategy = await caller.strategies.create({
				name: "Reportable Strategy",
				description: "For report tests",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: reportableStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: reportableStrategy.id });
		});

		it("should create a report with valid reason", async () => {
			const result = await otherUserCaller.marketplace.report({
				strategyId: reportableStrategy.id,
				reason: "misleading_stats",
				details: "The win rate seems fabricated",
			});

			expect(result.success).toBe(true);
		});

		it("should create report with status pending", async () => {
			// Create fresh for clean test
			const pendingStrategy = await caller.strategies.create({
				name: "Pending Report Strategy",
				description: "For pending test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: pendingStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: pendingStrategy.id });

			await otherUserCaller.marketplace.report({
				strategyId: pendingStrategy.id,
				reason: "spam",
			});

			const report = await db.query.strategyReports.findFirst({
				where: eq(schema.strategyReports.strategyId, pendingStrategy.id),
			});

			expect(report?.status).toBe("pending");
		});

		it("should prevent reporting own strategy", async () => {
			await expect(
				caller.marketplace.report({
					strategyId: reportableStrategy.id,
					reason: "spam",
				}),
			).rejects.toThrow(/Cannot report your own strategy/);
		});

		it("should prevent reporting same strategy twice", async () => {
			// Create fresh for this test
			const doubleReportStrategy = await caller.strategies.create({
				name: "Double Report Strategy",
				description: "For double report test",
			});

			const trades = await createTestTrades(
				testUser.id,
				testAccount.id,
				MIN_TRADES_TO_PUBLISH,
			);
			for (const trade of trades) {
				await db
					.update(schema.trades)
					.set({ strategyId: doubleReportStrategy.id })
					.where(eq(schema.trades.id, trade.id));
			}

			await caller.strategies.publish({ id: doubleReportStrategy.id });

			// First report succeeds
			await thirdUserCaller.marketplace.report({
				strategyId: doubleReportStrategy.id,
				reason: "inappropriate_content",
			});

			// Second report fails
			await expect(
				thirdUserCaller.marketplace.report({
					strategyId: doubleReportStrategy.id,
					reason: "spam",
				}),
			).rejects.toThrow(/already reported/);
		});

		it("should reject reporting private strategies", async () => {
			const privateStrategy = await caller.strategies.create({
				name: "Private No Report",
				description: "Cannot report",
			});

			await expect(
				otherUserCaller.marketplace.report({
					strategyId: privateStrategy.id,
					reason: "spam",
				}),
			).rejects.toThrow(/not found or is not public/);
		});

		it("should require authentication", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.marketplace.report({
					strategyId: reportableStrategy.id,
					reason: "spam",
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});

		it("should accept all valid report reasons", async () => {
			const reasons = [
				"misleading_stats",
				"inappropriate_content",
				"spam",
				"other",
			] as const;

			for (const reason of reasons) {
				const strategy = await caller.strategies.create({
					name: `Report Reason ${reason}`,
					description: `Testing ${reason}`,
				});

				const trades = await createTestTrades(
					testUser.id,
					testAccount.id,
					MIN_TRADES_TO_PUBLISH,
				);
				for (const trade of trades) {
					await db
						.update(schema.trades)
						.set({ strategyId: strategy.id })
						.where(eq(schema.trades.id, trade.id));
				}

				await caller.strategies.publish({ id: strategy.id });

				const result = await otherUserCaller.marketplace.report({
					strategyId: strategy.id,
					reason,
				});

				expect(result.success).toBe(true);
			}
		});
	});
});
