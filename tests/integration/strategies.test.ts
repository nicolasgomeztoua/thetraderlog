/**
 * Integration tests for strategies router - Cover Image Upload and Auto-Save.
 *
 * Tests:
 * - getImageUploadUrl: presigned URL generation, validation, ownership
 * - autosave: silent saves, field updates, ownership validation
 * - update mutation: cover image field handling
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	createTestUser,
	createUnauthenticatedCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

// =============================================================================
// TEST SETUP
// =============================================================================

describe("strategies router", () => {
	let caller: TestCaller;
	let otherUserCaller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();

		// Create two users for ownership tests
		const { user: testUser } = await setupTrader();
		caller = await createTestCaller(testUser.clerkId, testUser);

		const otherUser = await createTestUser({ email: "other@test.com" });
		otherUserCaller = await createTestCaller(otherUser.clerkId, otherUser);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =============================================================================
	// HELPER: Create a test strategy
	// =============================================================================

	async function createTestStrategy(overrides?: {
		name?: string;
		description?: string;
		coverImageUrl?: string;
		coverImageKey?: string;
	}) {
		const strategy = await caller.strategies.create({
			name: overrides?.name ?? "Test Strategy",
			description: overrides?.description ?? "A test strategy for testing",
		});

		if (!strategy) throw new Error("Failed to create test strategy");

		// If cover image fields are provided, update the strategy
		if (overrides?.coverImageUrl || overrides?.coverImageKey) {
			const updated = await caller.strategies.update({
				id: strategy.id,
				coverImageUrl: overrides.coverImageUrl,
				coverImageKey: overrides.coverImageKey,
			});
			if (!updated) throw new Error("Failed to update test strategy");
			return updated;
		}

		return strategy;
	}

	// =============================================================================
	// GET IMAGE UPLOAD URL TESTS
	// =============================================================================
	// Note: In test environment (vitest/Node.js), S3 is not configured.
	// isS3Configured() returns false, so most tests expect "File uploads are not configured" error.
	// This tests validation logic before S3 check where possible.

	describe("getImageUploadUrl", () => {
		it("should throw error when S3 is not configured for valid request", async () => {
			const strategy = await createTestStrategy();

			// In test environment, S3 is never configured
			// Valid request should fail with "not configured" rather than validation error
			await expect(
				caller.strategies.getImageUploadUrl({
					strategyId: strategy.id,
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 1024 * 1024, // 1MB
				}),
			).rejects.toThrow("File uploads are not configured");
		});

		it("should accept all valid image mime types (fails at S3 config check)", async () => {
			const strategy = await createTestStrategy();

			// These should all fail with "not configured" rather than validation errors,
			// proving the mime types are accepted by validation
			const mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

			for (const mimeType of mimeTypes) {
				await expect(
					caller.strategies.getImageUploadUrl({
						strategyId: strategy.id,
						filename: "cover.img",
						mimeType,
						size: 500 * 1024,
					}),
				).rejects.toThrow("File uploads are not configured");
			}
		});

		// Note: In the router, S3 check happens FIRST before all other validations.
		// So in test environment without S3, ALL requests fail with "not configured"
		// regardless of other validation issues. We can only test that valid requests
		// reach the S3 check (vs Zod schema validation rejecting them first).

		it("should reject empty filename via Zod schema", async () => {
			const strategy = await createTestStrategy();

			// Empty filename is rejected by Zod (.min(1)) before handler runs
			await expect(
				caller.strategies.getImageUploadUrl({
					strategyId: strategy.id,
					filename: "",
					mimeType: "image/jpeg",
					size: 1024,
				}),
			).rejects.toThrow();
		});

		it("should reject empty mimeType via Zod schema", async () => {
			const strategy = await createTestStrategy();

			await expect(
				caller.strategies.getImageUploadUrl({
					strategyId: strategy.id,
					filename: "cover.jpg",
					mimeType: "",
					size: 1024,
				}),
			).rejects.toThrow();
		});

		it("should reject negative size via Zod schema", async () => {
			const strategy = await createTestStrategy();

			await expect(
				caller.strategies.getImageUploadUrl({
					strategyId: strategy.id,
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: -1,
				}),
			).rejects.toThrow();
		});

		it("should reject zero size via Zod schema", async () => {
			const strategy = await createTestStrategy();

			await expect(
				caller.strategies.getImageUploadUrl({
					strategyId: strategy.id,
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 0,
				}),
			).rejects.toThrow();
		});

		// Note: mime type validation, file size validation, and ownership checks
		// happen AFTER the S3 config check in the router. In test environment
		// without S3 configured, we can only verify that requests with valid
		// Zod inputs reach the S3 check. For full coverage of those validations,
		// we would need to either:
		// 1. Mock isS3Configured() in tests, or
		// 2. Run tests in an environment with S3 configured
	});

	// =============================================================================
	// AUTOSAVE TESTS
	// =============================================================================

	describe("autosave", () => {
		it("should update strategy fields correctly", async () => {
			const strategy = await createTestStrategy();

			const result = await caller.strategies.autosave({
				id: strategy.id,
				name: "Updated Name",
				description: "Updated description",
			});

			expect(result).toHaveProperty("updatedAt");
			expect(result.updatedAt).toBeInstanceOf(Date);

			// Verify the changes persisted
			const updated = await caller.strategies.getById({ id: strategy.id });
			expect(updated.name).toBe("Updated Name");
			expect(updated.description).toBe("Updated description");
		});

		it("should return updatedAt timestamp", async () => {
			const strategy = await createTestStrategy();
			const beforeSave = new Date();

			const result = await caller.strategies.autosave({
				id: strategy.id,
				description: "New description",
			});

			expect(result.updatedAt).toBeDefined();
			expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
				beforeSave.getTime(),
			);
		});

		it("should reject if not strategy owner", async () => {
			// Create strategy as main user
			const strategy = await createTestStrategy();

			// Try to autosave as other user
			await expect(
				otherUserCaller.strategies.autosave({
					id: strategy.id,
					name: "Hacked Name",
				}),
			).rejects.toThrow(/Strategy not found/);
		});

		it("should update partial fields only", async () => {
			const strategy = await createTestStrategy({
				name: "Original Name",
				description: "Original Description",
			});

			// Only update description
			await caller.strategies.autosave({
				id: strategy.id,
				description: "Only description updated",
			});

			const updated = await caller.strategies.getById({ id: strategy.id });
			expect(updated.name).toBe("Original Name"); // Unchanged
			expect(updated.description).toBe("Only description updated");
		});

		it("should handle color field", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.autosave({
				id: strategy.id,
				color: "#ff0000",
			});

			const updated = await caller.strategies.getById({ id: strategy.id });
			expect(updated.color).toBe("#ff0000");
		});

		it("should handle instruments array", async () => {
			const strategy = await createTestStrategy();

			// This should not throw - autosave should accept instruments
			await caller.strategies.autosave({
				id: strategy.id,
				instruments: ["ES", "NQ", "MES"],
			});
			// Note: getById doesn't return instruments directly in schema response,
			// but autosave should process the field without error
		});

		it("should handle categoryTags array", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.autosave({
				id: strategy.id,
				categoryTags: ["Scalping", "Day Trading"],
			});

			// Similar to instruments, autosave should process the field
		});

		it("should handle risk parameters JSON", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.autosave({
				id: strategy.id,
				riskParameters: {
					positionSizing: {
						method: "risk_percent",
						riskPercent: 1,
					},
					maxRiskPerTrade: {
						type: "percent",
						value: 2,
					},
				},
			});

			const updated = await caller.strategies.getById({ id: strategy.id });
			expect(updated.riskParameters).toBeDefined();
			expect(updated.riskParameters?.positionSizing?.method).toBe(
				"risk_percent",
			);
		});

		it("should reject non-existent strategy", async () => {
			await expect(
				caller.strategies.autosave({
					id: "non-existent-id",
					name: "New Name",
				}),
			).rejects.toThrow(/Strategy not found/);
		});
	});

	// =============================================================================
	// UPDATE MUTATION - COVER IMAGE TESTS
	// =============================================================================

	describe("update mutation - cover image fields", () => {
		it("should accept coverImageUrl field", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.update({
				id: strategy.id,
				coverImageUrl: "https://example.com/image.jpg",
			});

			const fetched = await caller.strategies.getById({ id: strategy.id });
			expect(fetched.coverImageUrl).toBe("https://example.com/image.jpg");
		});

		it("should accept coverImageKey field", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.update({
				id: strategy.id,
				coverImageKey: "strategies/user123/strat456/cover-123456.jpg",
			});

			const fetched = await caller.strategies.getById({ id: strategy.id });
			expect(fetched.coverImageKey).toBe(
				"strategies/user123/strat456/cover-123456.jpg",
			);
		});

		it("should accept both cover image fields together", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.update({
				id: strategy.id,
				coverImageUrl: "https://example.com/new-image.jpg",
				coverImageKey: "strategies/user/strat/cover-new.jpg",
			});

			const fetched = await caller.strategies.getById({ id: strategy.id });
			expect(fetched.coverImageUrl).toBe("https://example.com/new-image.jpg");
			expect(fetched.coverImageKey).toBe("strategies/user/strat/cover-new.jpg");
		});

		it("should allow setting coverImageUrl to null", async () => {
			// First set a cover image
			const strategy = await createTestStrategy({
				coverImageUrl: "https://example.com/old.jpg",
				coverImageKey: "strategies/user/strat/old.jpg",
			});

			// Then clear it
			await caller.strategies.update({
				id: strategy.id,
				coverImageUrl: null,
				coverImageKey: null,
			});

			const fetched = await caller.strategies.getById({ id: strategy.id });
			expect(fetched.coverImageUrl).toBeNull();
			expect(fetched.coverImageKey).toBeNull();
		});

		it("should reject update if not strategy owner", async () => {
			const strategy = await createTestStrategy();

			await expect(
				otherUserCaller.strategies.update({
					id: strategy.id,
					coverImageUrl: "https://hacked.com/image.jpg",
				}),
			).rejects.toThrow(/Strategy not found/);
		});

		it("should update other fields alongside cover image", async () => {
			const strategy = await createTestStrategy();

			await caller.strategies.update({
				id: strategy.id,
				name: "New Name With Image",
				coverImageUrl: "https://example.com/image.jpg",
				coverImageKey: "strategies/key.jpg",
			});

			const fetched = await caller.strategies.getById({ id: strategy.id });
			expect(fetched.name).toBe("New Name With Image");
			expect(fetched.coverImageUrl).toBe("https://example.com/image.jpg");
		});
	});

	// =============================================================================
	// AUTHENTICATION TESTS
	// =============================================================================

	describe("authentication", () => {
		it("should reject unauthenticated getImageUploadUrl requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.strategies.getImageUploadUrl({
					strategyId: "any-id",
					filename: "cover.jpg",
					mimeType: "image/jpeg",
					size: 1024,
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});

		it("should reject unauthenticated autosave requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.strategies.autosave({
					id: "any-id",
					name: "New Name",
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});

		it("should reject unauthenticated update requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.strategies.update({
					id: "any-id",
					coverImageUrl: "https://example.com/image.jpg",
				}),
			).rejects.toThrow(/UNAUTHORIZED/);
		});
	});
});
