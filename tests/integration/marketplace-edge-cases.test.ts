/**
 * Integration tests for marketplace edge cases.
 *
 * Tests cover:
 * - Idempotent downloads: downloading same strategy twice returns same copy
 * - Accessing deleted strategy: returns 404
 * - Unpublishing: downloads remain valid after source is unpublished
 * - Deleting: downloads still work, source shows unavailable
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("marketplace edge cases", () => {
	// Author creates and publishes strategies
	let authorCaller: TestCaller;

	// Browser browses and downloads strategies
	let browserCaller: TestCaller;

	// Strategy IDs for testing
	let strategyToDeleteId: string;
	let strategyToUnpublishId: string;
	let downloadedFromDeletedId: string;
	let downloadedFromUnpublishedId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Setup author user
		const { user: authorUser } = await setupTrader({
			user: { clerkId: "edge-author-123", name: "Edge Author" },
		});
		authorCaller = await createTestCaller(authorUser.clerkId, authorUser);

		// Setup browser user
		const { user: browserUser } = await setupTrader({
			user: { clerkId: "edge-browser-456", name: "Edge Browser" },
		});
		browserCaller = await createTestCaller(browserUser.clerkId, browserUser);

		// Create and publish strategy that will be deleted
		const strategyToDelete = await authorCaller.strategies.create({
			name: "Strategy To Delete",
			description: "This strategy will be deleted",
			color: "#ff0000",
		});
		if (!strategyToDelete) throw new Error("Failed to create strategy");
		strategyToDeleteId = strategyToDelete.id;

		await authorCaller.strategies.publish({
			strategyId: strategyToDeleteId,
			instruments: ["ES"],
			categoryTags: ["scalping"],
			isAnonymous: false,
		});

		// Create and publish strategy that will be unpublished
		const strategyToUnpublish = await authorCaller.strategies.create({
			name: "Strategy To Unpublish",
			description: "This strategy will be unpublished",
			color: "#00ff00",
		});
		if (!strategyToUnpublish) throw new Error("Failed to create strategy");
		strategyToUnpublishId = strategyToUnpublish.id;

		await authorCaller.strategies.publish({
			strategyId: strategyToUnpublishId,
			instruments: ["NQ"],
			categoryTags: ["day_trading"],
			isAnonymous: false,
		});

		// Browser downloads both strategies
		const downloaded1 = await browserCaller.strategies.download({
			strategyId: strategyToDeleteId,
		});
		if (!downloaded1) throw new Error("Failed to download strategy");
		downloadedFromDeletedId = downloaded1.id;

		const downloaded2 = await browserCaller.strategies.download({
			strategyId: strategyToUnpublishId,
		});
		if (!downloaded2) throw new Error("Failed to download strategy");
		downloadedFromUnpublishedId = downloaded2.id;
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =============================================================================
	// IDEMPOTENT DOWNLOAD TESTS
	// =============================================================================

	describe("idempotent downloads", () => {
		let testStrategyId: string;
		let firstDownloadId: string;

		beforeAll(async () => {
			// Create a new strategy for this test to avoid conflicts
			const strategy = await authorCaller.strategies.create({
				name: "Idempotent Test Strategy",
				description: "For testing idempotent downloads",
			});
			if (!strategy) throw new Error("Failed to create strategy");
			testStrategyId = strategy.id;

			await authorCaller.strategies.publish({
				strategyId: testStrategyId,
				instruments: ["EURUSD"],
				categoryTags: ["swing_trading"],
				isAnonymous: false,
			});
		});

		it("should return new copy on first download", async () => {
			const downloaded = await browserCaller.strategies.download({
				strategyId: testStrategyId,
			});

			expect(downloaded).not.toBeNull();
			expect(downloaded?.name).toContain("Idempotent Test Strategy");
			expect(downloaded?.name).toContain("(Copy)");
			expect(downloaded?.sourceStrategyId).toBe(testStrategyId);

			firstDownloadId = downloaded?.id ?? "";
		});

		it("should return same copy on second download (idempotent)", async () => {
			const downloaded = await browserCaller.strategies.download({
				strategyId: testStrategyId,
			});

			// Should return the same copy, not create a new one
			expect(downloaded?.id).toBe(firstDownloadId);
		});

		it("should return same copy on third download (idempotent)", async () => {
			const downloaded = await browserCaller.strategies.download({
				strategyId: testStrategyId,
			});

			// Still the same copy
			expect(downloaded?.id).toBe(firstDownloadId);
		});
	});

	// =============================================================================
	// DELETED STRATEGY TESTS
	// =============================================================================

	describe("accessing deleted strategy", () => {
		it("should return 404 for deleted strategy in marketplace", async () => {
			// First delete the strategy
			await authorCaller.strategies.delete({
				id: strategyToDeleteId,
			});

			// Try to access via marketplace endpoint
			await expect(
				browserCaller.strategies.marketplaceGetById({
					strategyId: strategyToDeleteId,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should keep downloaded copy functional after source deletion", async () => {
			// The downloaded copy should still work
			const copy = await browserCaller.strategies.getById({
				id: downloadedFromDeletedId,
			});

			expect(copy).not.toBeNull();
			expect(copy?.name).toContain("Strategy To Delete");
			expect(copy?.name).toContain("(Copy)");

			// The sourceStrategyId will still be set but relation will be null
			// since the source was deleted
			expect(copy?.sourceStrategyId).toBe(strategyToDeleteId);
		});

		it("should show source as unavailable in downloaded strategies list", async () => {
			// Get the browser's downloaded strategies
			const downloaded = await browserCaller.strategies.getDownloaded();

			// Find the copy from deleted source
			const copyFromDeleted = downloaded.find(
				(s) => s.id === downloadedFromDeletedId,
			);

			expect(copyFromDeleted).not.toBeNull();
			// sourceStrategy should be null since the source was deleted
			expect(copyFromDeleted?.sourceStrategy).toBeNull();
		});
	});

	// =============================================================================
	// UNPUBLISHED STRATEGY TESTS
	// =============================================================================

	describe("unpublishing strategy", () => {
		it("should unpublish strategy successfully", async () => {
			const unpublished = await authorCaller.strategies.unpublish({
				strategyId: strategyToUnpublishId,
			});

			expect(unpublished?.isPublic).toBe(false);
			// Other marketplace fields should be preserved for easy re-publishing
			expect(unpublished?.instruments).not.toBeNull();
			expect(unpublished?.categoryTags).not.toBeNull();
		});

		it("should return 404 for unpublished strategy in marketplace", async () => {
			// Try to access via marketplace endpoint - should fail
			await expect(
				browserCaller.strategies.marketplaceGetById({
					strategyId: strategyToUnpublishId,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should keep downloaded copy functional after unpublishing", async () => {
			// The downloaded copy should still work
			const copy = await browserCaller.strategies.getById({
				id: downloadedFromUnpublishedId,
			});

			expect(copy).not.toBeNull();
			expect(copy?.name).toContain("Strategy To Unpublish");
			expect(copy?.name).toContain("(Copy)");
			expect(copy?.sourceStrategyId).toBe(strategyToUnpublishId);
		});

		it("should show source as unavailable (not public) in downloaded list", async () => {
			// Get the browser's downloaded strategies
			const downloaded = await browserCaller.strategies.getDownloaded();

			// Find the copy from unpublished source
			const copyFromUnpublished = downloaded.find(
				(s) => s.id === downloadedFromUnpublishedId,
			);

			expect(copyFromUnpublished).not.toBeNull();
			// sourceStrategy should exist but isPublic should be false
			expect(copyFromUnpublished?.sourceStrategy).not.toBeNull();
			expect(copyFromUnpublished?.sourceStrategy?.isPublic).toBe(false);
		});

		it("should prevent new downloads after unpublishing", async () => {
			// Create a new browser to test download prevention
			const { user: newBrowser } = await setupTrader({
				user: { clerkId: "new-browser-789", name: "New Browser" },
			});
			const newBrowserCaller = await createTestCaller(
				newBrowser.clerkId,
				newBrowser,
			);

			// Should not be able to download unpublished strategy
			await expect(
				newBrowserCaller.strategies.download({
					strategyId: strategyToUnpublishId,
				}),
			).rejects.toThrow("Cannot download a private strategy");
		});
	});
});
