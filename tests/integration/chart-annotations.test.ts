import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTraderWithTrades,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("chartAnnotations router", () => {
	let caller: TestCaller;
	let otherCaller: TestCaller;
	let tradeId: string;
	let otherTradeId: string;

	beforeAll(async () => {
		await truncateAllTables();

		// Setup first trader with a trade
		const setup1 = await setupTraderWithTrades(1);
		caller = await createTestCaller(setup1.user.clerkId, setup1.user);
		tradeId = setup1.trades[0]?.id ?? "";

		// Setup second trader with a trade (for ownership tests)
		const setup2 = await setupTraderWithTrades(1, {
			user: { clerkId: "other-user-clerk-id" },
		});
		otherCaller = await createTestCaller(setup2.user.clerkId, setup2.user);
		otherTradeId = setup2.trades[0]?.id ?? "";
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// =========================================================================
	// CREATE
	// =========================================================================

	describe("create", () => {
		it("should create a horizontal annotation", async () => {
			const annotation = await caller.chartAnnotations.create({
				tradeId,
				type: "horizontal",
				value: "5025.50000000",
				lineStyle: "solid",
				color: "#d4ff00",
			});

			expect(annotation).toBeDefined();
			expect(annotation.tradeId).toBe(tradeId);
			expect(annotation.type).toBe("horizontal");
			expect(parseFloat(annotation.value)).toBe(5025.5);
			expect(annotation.lineStyle).toBe("solid");
			expect(annotation.color).toBe("#d4ff00");
		});

		it("should create a vertical annotation", async () => {
			const annotation = await caller.chartAnnotations.create({
				tradeId,
				type: "vertical",
				value: "1710432000.00000000",
				lineStyle: "dashed",
				color: "#00d4ff",
			});

			expect(annotation).toBeDefined();
			expect(annotation.type).toBe("vertical");
			expect(annotation.lineStyle).toBe("dashed");
			expect(annotation.color).toBe("#00d4ff");
		});

		it("should use default lineStyle and color when not provided", async () => {
			const annotation = await caller.chartAnnotations.create({
				tradeId,
				type: "horizontal",
				value: "5000.00000000",
			});

			expect(annotation.lineStyle).toBe("solid");
			expect(annotation.color).toBe("#d4ff00");
		});

		it("should reject create when user does not own the trade", async () => {
			await expect(
				caller.chartAnnotations.create({
					tradeId: otherTradeId,
					type: "horizontal",
					value: "5000.00000000",
				}),
			).rejects.toThrow("Trade not found");
		});
	});

	// =========================================================================
	// LIST
	// =========================================================================

	describe("list", () => {
		it("should return annotations for a trade", async () => {
			const annotations = await caller.chartAnnotations.list({ tradeId });

			// We created 3 annotations in the create tests above
			expect(annotations.length).toBe(3);
			expect(annotations.every((a) => a.tradeId === tradeId)).toBe(true);
		});

		it("should return empty array for trade with no annotations", async () => {
			// Create a new trader with a trade that has no annotations
			const fresh = await setupTraderWithTrades(1, {
				user: { clerkId: "fresh-user-clerk-id" },
			});
			const freshCaller = await createTestCaller(
				fresh.user.clerkId,
				fresh.user,
			);
			const freshTradeId = fresh.trades[0]?.id ?? "";

			const annotations = await freshCaller.chartAnnotations.list({
				tradeId: freshTradeId,
			});
			expect(annotations).toEqual([]);
		});

		it("should reject list when user does not own the trade", async () => {
			await expect(
				caller.chartAnnotations.list({ tradeId: otherTradeId }),
			).rejects.toThrow("Trade not found");
		});
	});

	// =========================================================================
	// DELETE
	// =========================================================================

	describe("delete", () => {
		it("should delete a single annotation by ID", async () => {
			const annotations = await caller.chartAnnotations.list({ tradeId });
			const annotationToDelete = annotations[0];
			const countBefore = annotations.length;

			await caller.chartAnnotations.delete({
				id: annotationToDelete?.id ?? "",
			});

			const remaining = await caller.chartAnnotations.list({ tradeId });
			expect(remaining.length).toBe(countBefore - 1);
			expect(
				remaining.find((a) => a.id === annotationToDelete?.id),
			).toBeUndefined();
		});

		it("should reject delete when user does not own the annotation", async () => {
			// Create annotation on other user's trade
			const otherAnnotation = await otherCaller.chartAnnotations.create({
				tradeId: otherTradeId,
				type: "horizontal",
				value: "5000.00000000",
			});

			await expect(
				caller.chartAnnotations.delete({ id: otherAnnotation.id }),
			).rejects.toThrow("Annotation not found");
		});

		it("should reject delete for non-existent annotation", async () => {
			await expect(
				caller.chartAnnotations.delete({ id: "nonexistent-id" }),
			).rejects.toThrow("Annotation not found");
		});
	});

	// =========================================================================
	// CLEAR ALL
	// =========================================================================

	describe("clearAll", () => {
		it("should remove all annotations for a trade", async () => {
			// Verify we have annotations first
			const before = await caller.chartAnnotations.list({ tradeId });
			expect(before.length).toBeGreaterThan(0);

			const result = await caller.chartAnnotations.clearAll({ tradeId });
			expect(result.success).toBe(true);

			const after = await caller.chartAnnotations.list({ tradeId });
			expect(after.length).toBe(0);
		});

		it("should not affect other users' annotations", async () => {
			// Other user's annotations should still exist
			const otherAnnotations = await otherCaller.chartAnnotations.list({
				tradeId: otherTradeId,
			});
			expect(otherAnnotations.length).toBeGreaterThan(0);
		});

		it("should succeed even when trade has no annotations", async () => {
			// Trade was already cleared above
			const result = await caller.chartAnnotations.clearAll({ tradeId });
			expect(result.success).toBe(true);
		});

		it("should reject clearAll when user does not own the trade", async () => {
			await expect(
				caller.chartAnnotations.clearAll({ tradeId: otherTradeId }),
			).rejects.toThrow("Trade not found");
		});
	});
});
