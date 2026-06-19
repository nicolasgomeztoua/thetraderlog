import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERR_S3_NOT_CONFIGURED } from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createUnauthenticatedCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("storage router", () => {
	let user: User;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		user = setup.user;
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// getImageUploadUrl TESTS
	// ============================================================================

	describe("getImageUploadUrl", () => {
		it("should reject unauthenticated requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();

			await expect(
				unauthCaller.storage.getImageUploadUrl({
					filename: "test.png",
					mimeType: "image/png",
					size: 1024,
					context: "trade-notes",
				}),
			).rejects.toThrow("UNAUTHORIZED");
		});

		it("should validate required fields", async () => {
			// Empty filename should be rejected by zod validation
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "",
					mimeType: "image/png",
					size: 1024,
					context: "trade-notes",
				}),
			).rejects.toThrow();

			// Empty mimeType should be rejected
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "test.png",
					mimeType: "",
					size: 1024,
					context: "trade-notes",
				}),
			).rejects.toThrow();

			// Empty context should be rejected
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "test.png",
					mimeType: "image/png",
					size: 1024,
					context: "",
				}),
			).rejects.toThrow();

			// Negative size should be rejected
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "test.png",
					mimeType: "image/png",
					size: -1,
					context: "trade-notes",
				}),
			).rejects.toThrow();

			// Zero size should be rejected
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "test.png",
					mimeType: "image/png",
					size: 0,
					context: "trade-notes",
				}),
			).rejects.toThrow();
		});

		it("should throw error when S3 is not configured", async () => {
			// In test environment (vitest/Node.js), S3 is never configured
			// because isS3Configured() returns false in non-Bun runtime
			await expect(
				caller.storage.getImageUploadUrl({
					filename: "test-image.png",
					mimeType: "image/png",
					size: 1024,
					context: "trade-notes",
				}),
			).rejects.toThrow(ERR_S3_NOT_CONFIGURED);
		});

		it("should accept various valid contexts", async () => {
			// These all should fail with "not configured" rather than validation errors,
			// proving the context values are accepted by validation
			const contexts = ["trade-notes", "journal-preview", "screenshots"];

			for (const context of contexts) {
				await expect(
					caller.storage.getImageUploadUrl({
						filename: "image.png",
						mimeType: "image/png",
						size: 500,
						context,
					}),
				).rejects.toThrow(ERR_S3_NOT_CONFIGURED);
			}
		});

		it("should accept various image mime types", async () => {
			// These should fail with "not configured" rather than validation errors
			const mimeTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

			for (const mimeType of mimeTypes) {
				await expect(
					caller.storage.getImageUploadUrl({
						filename: "test.img",
						mimeType,
						size: 1024,
						context: "trade-notes",
					}),
				).rejects.toThrow(ERR_S3_NOT_CONFIGURED);
			}
		});
	});
});
