/**
 * Integration tests for strategy visual identity and auto-save endpoints.
 *
 * Tests cover:
 * - getCoverImageUploadUrl: presigned URL generation with validation
 * - confirmCoverImage: cover image confirmation and old image deletion
 * - deleteCoverImage: cover image removal
 * - autosave: auto-save with conflict detection
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	COVER_IMAGE_ACCEPTED_TYPES,
	COVER_IMAGE_MAX_SIZE_BYTES,
} from "@/lib/constants/marketplace";
import {
	createTestCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("strategies - visual identity & auto-save", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let strategyId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Setup main test user
		const { user } = await setupTrader();
		caller = await createTestCaller(user.clerkId, user);

		// Setup another user for cross-user tests
		const { user: otherUser } = await setupTrader({
			user: { clerkId: "other-user-123" },
		});
		otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

		// Create a test strategy for main user
		const strategy = await caller.strategies.create({
			name: "Test Strategy",
			description: "A test strategy for image upload tests",
			color: "#d4ff00",
		});
		if (!strategy) throw new Error("Failed to create test strategy");
		strategyId = strategy.id;

		// Create a strategy for other user
		const otherStrategy = await otherCaller.strategies.create({
			name: "Other User Strategy",
			color: "#00d4ff",
		});
		if (!otherStrategy) throw new Error("Failed to create other user strategy");
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =============================================================================
	// getCoverImageUploadUrl TESTS
	// =============================================================================

	describe("getCoverImageUploadUrl", () => {
		it("should return presigned URL for valid request", async () => {
			// Note: In test environment, S3 is not configured so this will throw
			// We test that the validation passes and the right error is thrown
			await expect(
				caller.strategies.getCoverImageUploadUrl({
					strategyId,
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 1024 * 1024, // 1MB
				}),
			).rejects.toThrow("File uploads are not configured");
		});

		it("should reject invalid mime types", async () => {
			await expect(
				caller.strategies.getCoverImageUploadUrl({
					strategyId,
					filename: "cover.pdf",
					mimeType: "application/pdf",
					size: 1024 * 1024,
				}),
			).rejects.toThrow(
				`Invalid file type. Accepted types: ${COVER_IMAGE_ACCEPTED_TYPES.join(", ")}`,
			);
		});

		it("should reject file size over limit", async () => {
			await expect(
				caller.strategies.getCoverImageUploadUrl({
					strategyId,
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: COVER_IMAGE_MAX_SIZE_BYTES + 1,
				}),
			).rejects.toThrow("File too large. Maximum size is 5MB");
		});

		it("should reject non-owner access", async () => {
			// Other user trying to upload to main user's strategy
			await expect(
				otherCaller.strategies.getCoverImageUploadUrl({
					strategyId, // Main user's strategy
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 1024 * 1024,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should reject non-existent strategy", async () => {
			await expect(
				caller.strategies.getCoverImageUploadUrl({
					strategyId: "non-existent-id",
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 1024 * 1024,
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should accept all valid image mime types", async () => {
			for (const mimeType of COVER_IMAGE_ACCEPTED_TYPES) {
				// All should fail with S3 not configured, not validation error
				await expect(
					caller.strategies.getCoverImageUploadUrl({
						strategyId,
						filename: `cover.${mimeType.split("/")[1]}`,
						mimeType,
						size: 1024 * 1024,
					}),
				).rejects.toThrow("File uploads are not configured");
			}
		});
	});

	// =============================================================================
	// confirmCoverImage TESTS
	// =============================================================================

	describe("confirmCoverImage", () => {
		it("should update strategy with image URL", async () => {
			const testKey = "images/test/strategy-covers/test-key.jpg";
			const testUrl = "https://cdn.example.com/test-key.jpg";

			const updated = await caller.strategies.confirmCoverImage({
				strategyId,
				key: testKey,
				url: testUrl,
			});

			expect(updated?.coverImageUrl).toBe(testUrl);
			expect(updated?.coverImageKey).toBe(testKey);
		});

		it("should reject non-owner", async () => {
			await expect(
				otherCaller.strategies.confirmCoverImage({
					strategyId, // Main user's strategy
					key: "test-key",
					url: "https://cdn.example.com/test.jpg",
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should handle updating existing image", async () => {
			// First, set an image
			await caller.strategies.confirmCoverImage({
				strategyId,
				key: "old-key.jpg",
				url: "https://cdn.example.com/old.jpg",
			});

			// Then update to a new image (old image S3 deletion will fail gracefully in test env)
			const updated = await caller.strategies.confirmCoverImage({
				strategyId,
				key: "new-key.jpg",
				url: "https://cdn.example.com/new.jpg",
			});

			expect(updated?.coverImageUrl).toBe("https://cdn.example.com/new.jpg");
			expect(updated?.coverImageKey).toBe("new-key.jpg");
		});
	});

	// =============================================================================
	// deleteCoverImage TESTS
	// =============================================================================

	describe("deleteCoverImage", () => {
		it("should clear image fields", async () => {
			// First, ensure the strategy has an image
			await caller.strategies.confirmCoverImage({
				strategyId,
				key: "to-delete.jpg",
				url: "https://cdn.example.com/to-delete.jpg",
			});

			// Verify it's set
			const before = await caller.strategies.getById({ id: strategyId });
			expect(before?.coverImageUrl).toBe(
				"https://cdn.example.com/to-delete.jpg",
			);

			// Delete the image
			const updated = await caller.strategies.deleteCoverImage({ strategyId });

			expect(updated?.coverImageUrl).toBeNull();
			expect(updated?.coverImageKey).toBeNull();
		});

		it("should reject non-owner", async () => {
			await expect(
				otherCaller.strategies.deleteCoverImage({
					strategyId, // Main user's strategy
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should handle strategy without image", async () => {
			// Create a new strategy without an image
			const newStrategy = await caller.strategies.create({
				name: "No Image Strategy",
			});
			if (!newStrategy) throw new Error("Failed to create strategy");

			// Should succeed even with no image to delete
			const updated = await caller.strategies.deleteCoverImage({
				strategyId: newStrategy.id,
			});

			expect(updated?.coverImageUrl).toBeNull();
			expect(updated?.coverImageKey).toBeNull();
		});
	});

	// =============================================================================
	// autosave TESTS
	// =============================================================================

	describe("autosave", () => {
		let autosaveStrategyId: string;

		beforeAll(async () => {
			// Create a fresh strategy for autosave tests
			const strategy = await caller.strategies.create({
				name: "Autosave Test Strategy",
				description: "Initial description",
			});
			if (!strategy) throw new Error("Failed to create autosave test strategy");
			autosaveStrategyId = strategy.id;
		});

		it("should save changes with current timestamp", async () => {
			const now = new Date().toISOString();

			const result = await caller.strategies.autosave({
				id: autosaveStrategyId,
				clientUpdatedAt: now,
				name: "Updated Name",
				description: "Updated description",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.strategy?.name).toBe("Updated Name");
				expect(result.strategy?.description).toBe("Updated description");
				expect(result.savedAt).toBeDefined();
			}
		});

		it("should return conflict when server version is newer", async () => {
			// First, get the current strategy to know its updatedAt
			const current = await caller.strategies.getById({
				id: autosaveStrategyId,
			});
			if (!current) throw new Error("Strategy not found");

			// Update the strategy directly to simulate another update
			await caller.strategies.update({
				id: autosaveStrategyId,
				name: "Server Updated Name",
			});

			// Try to autosave with an old timestamp (before the server update)
			const oldTimestamp = new Date(
				new Date(current.updatedAt ?? Date.now()).getTime() - 10000,
			).toISOString();

			const result = await caller.strategies.autosave({
				id: autosaveStrategyId,
				clientUpdatedAt: oldTimestamp,
				name: "Client Updated Name",
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.conflict).toBe(true);
				expect(result.serverVersion).toBeDefined();
				expect(result.serverVersion?.name).toBe("Server Updated Name");
			}
		});

		it("should reject non-owner", async () => {
			await expect(
				otherCaller.strategies.autosave({
					id: autosaveStrategyId,
					clientUpdatedAt: new Date().toISOString(),
					name: "Hacker Name",
				}),
			).rejects.toThrow("Strategy not found");
		});

		it("should handle rules update in autosave", async () => {
			const now = new Date().toISOString();

			const result = await caller.strategies.autosave({
				id: autosaveStrategyId,
				clientUpdatedAt: now,
				rules: [
					{ text: "Rule 1", category: "entry", order: 0 },
					{ text: "Rule 2", category: "exit", order: 1 },
				],
			});

			expect(result.success).toBe(true);

			// Verify rules were saved
			const strategy = await caller.strategies.getById({
				id: autosaveStrategyId,
			});
			expect(strategy?.rules).toHaveLength(2);
			expect(strategy?.rules?.[0]?.text).toBe("Rule 1");
			expect(strategy?.rules?.[1]?.text).toBe("Rule 2");
		});

		it("should handle complex config objects in autosave", async () => {
			const now = new Date().toISOString();

			const result = await caller.strategies.autosave({
				id: autosaveStrategyId,
				clientUpdatedAt: now,
				riskParameters: {
					positionSizing: {
						method: "risk_percent",
						riskPercent: 2,
					},
					maxRiskPerTrade: {
						type: "dollars",
						value: 500,
					},
				},
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.strategy?.riskParameters?.positionSizing?.method).toBe(
					"risk_percent",
				);
				expect(result.strategy?.riskParameters?.maxRiskPerTrade?.value).toBe(
					500,
				);
			}
		});
	});
});
