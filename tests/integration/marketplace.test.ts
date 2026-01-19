/**
 * Integration tests for marketplace endpoints.
 *
 * Tests cover:
 * - publish: publishing strategies with validation
 * - unpublish: unpublishing strategies
 * - vote: voting on strategies (create, toggle, change, remove, restrictions)
 * - download: downloading/copying strategies with attribution and idempotency
 * - marketplaceList: listing with filters and pagination
 * - marketplaceGetById: getting strategy details
 * - getDownloaded: getting user's downloaded strategies
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("marketplace endpoints", () => {
	// Author creates and publishes strategies
	let authorCaller: TestCaller;

	// Browser browses and downloads strategies
	let browserCaller: TestCaller;
	let browserUserId: string;

	// Strategy IDs for testing
	let publishedStrategyId: string;
	let unpublishedStrategyId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Setup author user
		const { user: authorUser } = await setupTrader({
			user: { clerkId: "author-clerk-123", name: "Strategy Author" },
		});
		authorCaller = await createTestCaller(authorUser.clerkId, authorUser);

		// Setup browser user
		const { user: browserUser } = await setupTrader({
			user: { clerkId: "browser-clerk-456", name: "Strategy Browser" },
		});
		browserCaller = await createTestCaller(browserUser.clerkId, browserUser);
		browserUserId = browserUser.id;

		// Create test strategies for author
		const strategy1 = await authorCaller.strategies.create({
			name: "Scalping Strategy",
			description: "A quick scalping strategy for ES futures",
			color: "#d4ff00",
			entryCriteria: "Wait for VWAP cross",
			exitRules: "Exit at 1R or on reversal signal",
			rules: [
				{ text: "Check VWAP direction", category: "entry", order: 0 },
				{ text: "Confirm volume", category: "entry", order: 1 },
			],
		});
		if (!strategy1) throw new Error("Failed to create strategy 1");
		unpublishedStrategyId = strategy1.id;

		const strategy2 = await authorCaller.strategies.create({
			name: "Swing Trading Strategy",
			description: "A swing trading approach for forex pairs",
			color: "#00d4ff",
		});
		if (!strategy2) throw new Error("Failed to create strategy 2");
		publishedStrategyId = strategy2.id;
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =============================================================================
	// PUBLISH TESTS
	// =============================================================================

	describe("publish", () => {
		it("should publish a strategy with valid data", async () => {
			const published = await authorCaller.strategies.publish({
				strategyId: publishedStrategyId,
				instruments: ["ES", "NQ"],
				categoryTags: ["scalping", "day_trading"],
				isAnonymous: false,
			});

			expect(published?.isPublic).toBe(true);
			expect(published?.isAnonymous).toBe(false);
			expect(published?.instruments).not.toBeNull();
			expect(published?.categoryTags).not.toBeNull();
			expect(published?.publishedAt).not.toBeNull();

			// Parse JSON to verify content
			const instruments = JSON.parse(published?.instruments ?? "[]");
			const categories = JSON.parse(published?.categoryTags ?? "[]");
			expect(instruments).toContain("ES");
			expect(instruments).toContain("NQ");
			expect(categories).toContain("scalping");
			expect(categories).toContain("day_trading");
		});

		it("should reject invalid instruments", async () => {
			await expect(
				authorCaller.strategies.publish({
					strategyId: unpublishedStrategyId,
					instruments: ["INVALID_INSTRUMENT"],
					categoryTags: ["scalping"],
					isAnonymous: false,
				}),
			).rejects.toThrow("Invalid instrument(s): INVALID_INSTRUMENT");
		});

		it("should reject invalid categories", async () => {
			await expect(
				authorCaller.strategies.publish({
					strategyId: unpublishedStrategyId,
					instruments: ["ES"],
					categoryTags: ["invalid_category"],
					isAnonymous: false,
				}),
			).rejects.toThrow("Invalid category(s): invalid_category");
		});

		it("should require at least one instrument", async () => {
			await expect(
				authorCaller.strategies.publish({
					strategyId: unpublishedStrategyId,
					instruments: [],
					categoryTags: ["scalping"],
					isAnonymous: false,
				}),
			).rejects.toThrow();
		});

		it("should require at least one category", async () => {
			await expect(
				authorCaller.strategies.publish({
					strategyId: unpublishedStrategyId,
					instruments: ["ES"],
					categoryTags: [],
					isAnonymous: false,
				}),
			).rejects.toThrow();
		});

		it("should reject non-owner trying to publish", async () => {
			await expect(
				browserCaller.strategies.publish({
					strategyId: publishedStrategyId,
					instruments: ["ES"],
					categoryTags: ["scalping"],
					isAnonymous: false,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should support anonymous publishing", async () => {
			// Publish the second strategy anonymously
			const published = await authorCaller.strategies.publish({
				strategyId: unpublishedStrategyId,
				instruments: ["EUR/USD"],
				categoryTags: ["swing_trading"],
				isAnonymous: true,
			});

			expect(published?.isPublic).toBe(true);
			expect(published?.isAnonymous).toBe(true);
		});
	});

	// =============================================================================
	// UNPUBLISH TESTS
	// =============================================================================

	describe("unpublish", () => {
		let strategyToUnpublish: string;

		beforeAll(async () => {
			// Create and publish a strategy for unpublish tests
			const strategy = await authorCaller.strategies.create({
				name: "Strategy to Unpublish",
				color: "#ff0000",
			});
			if (!strategy) throw new Error("Failed to create strategy");
			strategyToUnpublish = strategy.id;

			await authorCaller.strategies.publish({
				strategyId: strategyToUnpublish,
				instruments: ["ES"],
				categoryTags: ["scalping"],
				isAnonymous: false,
			});
		});

		it("should unpublish a strategy", async () => {
			const unpublished = await authorCaller.strategies.unpublish({
				strategyId: strategyToUnpublish,
			});

			expect(unpublished?.isPublic).toBe(false);
			// Metadata should be preserved for easy re-publishing
			expect(unpublished?.instruments).not.toBeNull();
			expect(unpublished?.categoryTags).not.toBeNull();
			expect(unpublished?.publishedAt).not.toBeNull();
		});

		it("should reject non-owner trying to unpublish", async () => {
			await expect(
				browserCaller.strategies.unpublish({
					strategyId: publishedStrategyId,
				}),
			).rejects.toThrow("Strategy not found");
		});
	});

	// =============================================================================
	// VOTE TESTS
	// =============================================================================

	describe("vote", () => {
		it("should allow upvoting a public strategy", async () => {
			const result = await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: "up",
			});

			expect(result.upvotes).toBe(1);
			expect(result.downvotes).toBe(0);
			expect(result.netVotes).toBe(1);
			expect(result.userVote).toBe("up");
		});

		it("should toggle off when voting same type", async () => {
			// Vote up again to toggle off
			const result = await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: "up",
			});

			expect(result.upvotes).toBe(0);
			expect(result.downvotes).toBe(0);
			expect(result.netVotes).toBe(0);
			expect(result.userVote).toBeNull();
		});

		it("should allow downvoting", async () => {
			const result = await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: "down",
			});

			expect(result.upvotes).toBe(0);
			expect(result.downvotes).toBe(1);
			expect(result.netVotes).toBe(-1);
			expect(result.userVote).toBe("down");
		});

		it("should change vote type from down to up", async () => {
			const result = await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: "up",
			});

			expect(result.upvotes).toBe(1);
			expect(result.downvotes).toBe(0);
			expect(result.netVotes).toBe(1);
			expect(result.userVote).toBe("up");
		});

		it("should remove vote with null", async () => {
			const result = await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: null,
			});

			expect(result.upvotes).toBe(0);
			expect(result.downvotes).toBe(0);
			expect(result.netVotes).toBe(0);
			expect(result.userVote).toBeNull();
		});

		it("should prevent voting on own strategy", async () => {
			await expect(
				authorCaller.strategies.vote({
					strategyId: publishedStrategyId,
					voteType: "up",
				}),
			).rejects.toThrow("Cannot vote on your own strategy");
		});

		it("should prevent voting on private strategy", async () => {
			// Create a private strategy
			const privateStrategy = await authorCaller.strategies.create({
				name: "Private Strategy",
			});
			if (!privateStrategy) throw new Error("Failed to create strategy");

			await expect(
				browserCaller.strategies.vote({
					strategyId: privateStrategy.id,
					voteType: "up",
				}),
			).rejects.toThrow("Cannot vote on a private strategy");
		});

		it("should prevent voting on non-existent strategy", async () => {
			await expect(
				browserCaller.strategies.vote({
					strategyId: "non-existent-id",
					voteType: "up",
				}),
			).rejects.toThrow("Strategy not found");
		});
	});

	// =============================================================================
	// DOWNLOAD TESTS
	// =============================================================================

	describe("download", () => {
		let downloadedStrategyId: string;

		it("should download a public strategy", async () => {
			const downloaded = await browserCaller.strategies.download({
				strategyId: publishedStrategyId,
			});

			expect(downloaded).not.toBeNull();
			expect(downloaded?.name).toBe("Swing Trading Strategy (Copy)");
			expect(downloaded?.sourceStrategyId).toBe(publishedStrategyId);
			expect(downloaded?.isPublic).toBe(false);
			expect(downloaded?.userId).toBe(browserUserId);
			downloadedStrategyId = downloaded?.id ?? "";
		});

		it("should be idempotent - return existing copy", async () => {
			const downloaded = await browserCaller.strategies.download({
				strategyId: publishedStrategyId,
			});

			// Should return the same copy, not create a new one
			expect(downloaded?.id).toBe(downloadedStrategyId);
		});

		it("should prevent downloading own strategy", async () => {
			await expect(
				authorCaller.strategies.download({
					strategyId: publishedStrategyId,
				}),
			).rejects.toThrow("You already own this strategy");
		});

		it("should prevent downloading private strategy", async () => {
			const privateStrategy = await authorCaller.strategies.create({
				name: "Another Private Strategy",
			});
			if (!privateStrategy) throw new Error("Failed to create strategy");

			await expect(
				browserCaller.strategies.download({
					strategyId: privateStrategy.id,
				}),
			).rejects.toThrow("Cannot download a private strategy");
		});

		it("should copy rules when downloading", async () => {
			// Download the unpublished strategy which has rules
			// (it was published earlier in the publish tests)
			const downloaded = await browserCaller.strategies.download({
				strategyId: unpublishedStrategyId,
			});

			expect(downloaded).not.toBeNull();

			// Get the full strategy with rules to verify
			const fullStrategy = await browserCaller.strategies.getById({
				id: downloaded?.id ?? "",
			});

			expect(fullStrategy?.rules).toHaveLength(2);
			expect(fullStrategy?.rules?.[0]?.text).toBe("Check VWAP direction");
			expect(fullStrategy?.rules?.[1]?.text).toBe("Confirm volume");
		});
	});

	// =============================================================================
	// MARKETPLACE LIST TESTS
	// =============================================================================

	describe("marketplaceList", () => {
		it("should list public strategies", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				limit: 10,
			});

			expect(result.strategies).toBeDefined();
			expect(result.strategies.length).toBeGreaterThan(0);

			// All returned strategies should be public
			for (const strategy of result.strategies) {
				expect(strategy.authorId).not.toBe(browserUserId);
				// browserUser's downloaded copies are private, so shouldn't appear
			}
		});

		it("should filter by search term", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				search: "Swing",
				limit: 10,
			});

			expect(result.strategies.length).toBeGreaterThan(0);
			expect(result.strategies[0]?.name).toContain("Swing");
		});

		it("should filter by instruments", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				instruments: ["ES"],
				limit: 10,
			});

			// Should return strategies with ES instrument
			for (const strategy of result.strategies) {
				expect(strategy.instruments).toContain("ES");
			}
		});

		it("should filter by categories", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				categories: ["swing_trading"],
				limit: 10,
			});

			// Should return strategies with swing_trading category
			for (const strategy of result.strategies) {
				expect(strategy.categoryTags).toContain("swing_trading");
			}
		});

		it("should sort by votes", async () => {
			// First, add some votes to make the sort meaningful
			await browserCaller.strategies.vote({
				strategyId: publishedStrategyId,
				voteType: "up",
			});

			const result = await browserCaller.strategies.marketplaceList({
				sortBy: "votes",
				limit: 10,
			});

			// Verify strategies are sorted by net votes descending
			for (let i = 1; i < result.strategies.length; i++) {
				expect(result.strategies[i - 1]?.netVotes).toBeGreaterThanOrEqual(
					result.strategies[i]?.netVotes ?? 0,
				);
			}
		});

		it("should sort by downloads", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				sortBy: "downloads",
				limit: 10,
			});

			// Verify strategies are sorted by download count descending
			for (let i = 1; i < result.strategies.length; i++) {
				expect(result.strategies[i - 1]?.downloadCount).toBeGreaterThanOrEqual(
					result.strategies[i]?.downloadCount ?? 0,
				);
			}
		});

		it("should paginate results", async () => {
			// Create more strategies to test pagination
			for (let i = 0; i < 5; i++) {
				const strategy = await authorCaller.strategies.create({
					name: `Pagination Test Strategy ${i}`,
				});
				if (strategy) {
					await authorCaller.strategies.publish({
						strategyId: strategy.id,
						instruments: ["ES"],
						categoryTags: ["scalping"],
						isAnonymous: false,
					});
				}
			}

			// Get first page
			const page1 = await browserCaller.strategies.marketplaceList({
				limit: 3,
			});

			expect(page1.strategies.length).toBe(3);
			expect(page1.nextCursor).toBeDefined();

			// Get second page
			const page2 = await browserCaller.strategies.marketplaceList({
				limit: 3,
				cursor: page1.nextCursor,
			});

			expect(page2.strategies.length).toBeGreaterThan(0);

			// Ensure no overlap between pages
			const page1Ids = page1.strategies.map((s) => s.id);
			const page2Ids = page2.strategies.map((s) => s.id);
			const overlap = page1Ids.filter((id) => page2Ids.includes(id));
			expect(overlap.length).toBe(0);
		});

		it("should include current user vote", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				limit: 10,
			});

			// Find the strategy we voted on
			const votedStrategy = result.strategies.find(
				(s) => s.id === publishedStrategyId,
			);
			expect(votedStrategy?.currentUserVote).toBe("up");
		});

		it("should show anonymous author name", async () => {
			const result = await browserCaller.strategies.marketplaceList({
				limit: 20,
			});

			// Find the anonymously published strategy
			const anonStrategy = result.strategies.find(
				(s) => s.id === unpublishedStrategyId,
			);
			expect(anonStrategy?.authorName).toBe("Anonymous");
			expect(anonStrategy?.isAnonymous).toBe(true);
		});
	});

	// =============================================================================
	// MARKETPLACE GET BY ID TESTS
	// =============================================================================

	describe("marketplaceGetById", () => {
		it("should get strategy details", async () => {
			const strategy = await browserCaller.strategies.marketplaceGetById({
				strategyId: publishedStrategyId,
			});

			expect(strategy.id).toBe(publishedStrategyId);
			expect(strategy.name).toBe("Swing Trading Strategy");
			expect(strategy.authorName).toBe("Strategy Author");
			expect(strategy.upvotes).toBeGreaterThanOrEqual(0);
			expect(strategy.downvotes).toBeGreaterThanOrEqual(0);
			expect(strategy.downloadCount).toBeGreaterThanOrEqual(0);
			expect(strategy.copiesCount).toBeGreaterThanOrEqual(0);
		});

		it("should include rules", async () => {
			const strategy = await browserCaller.strategies.marketplaceGetById({
				strategyId: unpublishedStrategyId,
			});

			expect(strategy.rules).toHaveLength(2);
		});

		it("should show current user has downloaded", async () => {
			const strategy = await browserCaller.strategies.marketplaceGetById({
				strategyId: publishedStrategyId,
			});

			expect(strategy.currentUserHasDownloaded).toBe(true);
		});

		it("should throw for private strategy", async () => {
			const privateStrategy = await authorCaller.strategies.create({
				name: "Very Private Strategy",
			});
			if (!privateStrategy) throw new Error("Failed to create strategy");

			await expect(
				browserCaller.strategies.marketplaceGetById({
					strategyId: privateStrategy.id,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should throw for non-existent strategy", async () => {
			await expect(
				browserCaller.strategies.marketplaceGetById({
					strategyId: "non-existent-id",
				}),
			).rejects.toThrow("Strategy not found");
		});
	});

	// =============================================================================
	// GET DOWNLOADED TESTS
	// =============================================================================

	describe("getDownloaded", () => {
		it("should return downloaded strategies", async () => {
			const downloaded = await browserCaller.strategies.getDownloaded();

			expect(downloaded.length).toBeGreaterThan(0);

			// All returned strategies should have sourceStrategyId
			for (const strategy of downloaded) {
				expect(strategy.sourceStrategy).not.toBeNull();
			}
		});

		it("should include source strategy info", async () => {
			const downloaded = await browserCaller.strategies.getDownloaded();

			const strategy = downloaded.find(
				(s) => s.sourceStrategy?.id === publishedStrategyId,
			);
			expect(strategy).toBeDefined();
			expect(strategy?.sourceStrategy?.name).toBe("Swing Trading Strategy");
			expect(strategy?.sourceStrategy?.authorName).toBe("Strategy Author");
		});

		it("should return empty array for user with no downloads", async () => {
			// Create a new user with no downloads
			const { user: newUser } = await setupTrader({
				user: { clerkId: "new-user-789", name: "New User" },
			});
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			const downloaded = await newCaller.strategies.getDownloaded();

			expect(downloaded).toHaveLength(0);
		});
	});
});
