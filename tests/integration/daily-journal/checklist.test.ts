import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERR_TEMPLATE_NOT_FOUND } from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("dailyJournal router - checklist operations", () => {
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
	// TEMPLATE CRUD TESTS
	// ============================================================================

	describe("template CRUD", () => {
		it("should create a template", async () => {
			const template = await caller.dailyJournal.createTemplate({
				text: "Review market conditions",
			});

			expect(template).toBeDefined();
			expect(template?.text).toBe("Review market conditions");
			expect(template?.userId).toBe(user.id);
			expect(template?.isActive).toBe(true);
			expect(template?.order).toBe(0);
		});

		it("should auto-calculate order for new templates", async () => {
			const template1 = await caller.dailyJournal.createTemplate({
				text: "Check economic calendar",
			});
			const template2 = await caller.dailyJournal.createTemplate({
				text: "Set stop losses",
			});

			expect(template2.order).toBeGreaterThan(template1.order);
		});

		it("should get all templates ordered by order field", async () => {
			const templates = await caller.dailyJournal.getTemplates();

			expect(templates.length).toBeGreaterThanOrEqual(3);
			// Verify they're ordered
			for (let i = 1; i < templates.length; i++) {
				const current = templates[i];
				const previous = templates[i - 1];
				if (current && previous) {
					expect(current.order).toBeGreaterThanOrEqual(previous.order);
				}
			}
		});

		it("should update template text", async () => {
			const template = await caller.dailyJournal.createTemplate({
				text: "Original text",
			});

			const updated = await caller.dailyJournal.updateTemplate({
				id: template.id,
				text: "Updated text",
			});

			expect(updated?.text).toBe("Updated text");
		});

		it("should update template order", async () => {
			const template = await caller.dailyJournal.createTemplate({
				text: "Order test",
			});

			const updated = await caller.dailyJournal.updateTemplate({
				id: template.id,
				order: 999,
			});

			expect(updated?.order).toBe(999);
		});

		it("should update template isActive", async () => {
			const template = await caller.dailyJournal.createTemplate({
				text: "Active test",
			});

			const updated = await caller.dailyJournal.updateTemplate({
				id: template.id,
				isActive: false,
			});

			expect(updated?.isActive).toBe(false);
		});

		it("should delete a template", async () => {
			const template = await caller.dailyJournal.createTemplate({
				text: "To be deleted",
			});

			const result = await caller.dailyJournal.deleteTemplate({
				id: template.id,
			});

			expect(result.success).toBe(true);

			// Verify it's gone
			const templates = await caller.dailyJournal.getTemplates();
			expect(templates.find((t) => t.id === template.id)).toBeUndefined();
		});

		it("should reject update for non-existent template", async () => {
			await expect(
				caller.dailyJournal.updateTemplate({
					id: "ct-nonexistent",
					text: "Should fail",
				}),
			).rejects.toThrow(ERR_TEMPLATE_NOT_FOUND);
		});

		it("should reject delete for non-existent template", async () => {
			await expect(
				caller.dailyJournal.deleteTemplate({
					id: "ct-nonexistent",
				}),
			).rejects.toThrow(ERR_TEMPLATE_NOT_FOUND);
		});
	});

	// ============================================================================
	// REORDER TEMPLATES TESTS
	// ============================================================================

	describe("reorderTemplates", () => {
		it("should reorder templates in bulk", async () => {
			// Create templates in order
			const t1 = await caller.dailyJournal.createTemplate({
				text: "Reorder A",
				order: 0,
			});
			const t2 = await caller.dailyJournal.createTemplate({
				text: "Reorder B",
				order: 1,
			});
			const t3 = await caller.dailyJournal.createTemplate({
				text: "Reorder C",
				order: 2,
			});

			// Reorder: C, A, B
			const reordered = await caller.dailyJournal.reorderTemplates({
				items: [
					{ id: t3.id, order: 0 },
					{ id: t1.id, order: 1 },
					{ id: t2.id, order: 2 },
				],
			});

			const reorderedC = reordered.find((t) => t.id === t3.id);
			const reorderedA = reordered.find((t) => t.id === t1.id);
			const reorderedB = reordered.find((t) => t.id === t2.id);

			expect(reorderedC?.order).toBe(0);
			expect(reorderedA?.order).toBe(1);
			expect(reorderedB?.order).toBe(2);
		});

		it("should reject reorder with non-owned template", async () => {
			const user2 = await createTestUser();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			const user2Template = await caller2.dailyJournal.createTemplate({
				text: "User 2 template",
			});

			// First user tries to reorder user 2's template
			await expect(
				caller.dailyJournal.reorderTemplates({
					items: [{ id: user2Template.id, order: 0 }],
				}),
			).rejects.toThrow("not found or not owned");
		});
	});

	// ============================================================================
	// CHECK OPERATIONS TESTS
	// ============================================================================

	describe("check operations", () => {
		let templateForChecks: Awaited<
			ReturnType<typeof caller.dailyJournal.createTemplate>
		>;

		beforeAll(async () => {
			templateForChecks = await caller.dailyJournal.createTemplate({
				text: "Daily check test item",
			});
		});

		it("should toggle check (create when not exists)", async () => {
			const testDate = "2024-05-01";

			const result = await caller.dailyJournal.toggleCheck({
				date: testDate,
				templateId: templateForChecks.id,
			});

			expect(result.checked).toBe(true);
			expect(result.templateId).toBe(templateForChecks.id);
			expect(result.checkedAt).toBeDefined();
		});

		it("should toggle check off", async () => {
			const testDate = "2024-05-01";

			// Toggle off (was on from previous test)
			const result = await caller.dailyJournal.toggleCheck({
				date: testDate,
				templateId: templateForChecks.id,
			});

			expect(result.checked).toBe(false);
			expect(result.checkedAt).toBeNull();
		});

		it("should toggle check back on", async () => {
			const testDate = "2024-05-01";

			const result = await caller.dailyJournal.toggleCheck({
				date: testDate,
				templateId: templateForChecks.id,
			});

			expect(result.checked).toBe(true);
		});

		it("should auto-create journal when toggling check", async () => {
			const newDate = "2024-05-15";

			const result = await caller.dailyJournal.toggleCheck({
				date: newDate,
				templateId: templateForChecks.id,
			});

			expect(result.journalId).toBeDefined();
			expect(result.checked).toBe(true);
		});

		it("should get checks for a date", async () => {
			const testDate = "2024-05-01";

			const result = await caller.dailyJournal.getChecks({
				date: testDate,
			});

			expect(result.journalId).toBeDefined();
			expect(Array.isArray(result.checks)).toBe(true);
		});

		it("should bulk update checks", async () => {
			const testDate = "2024-06-01";

			// Create another template for bulk test
			const template2 = await caller.dailyJournal.createTemplate({
				text: "Bulk check item 2",
			});

			const result = await caller.dailyJournal.bulkUpdateChecks({
				date: testDate,
				checks: [
					{ templateId: templateForChecks.id, checked: true },
					{ templateId: template2.id, checked: false },
				],
			});

			expect(result.journalId).toBeDefined();
			expect(result.checks.length).toBe(2);

			const check1 = result.checks.find(
				(c) => c.templateId === templateForChecks.id,
			);
			const check2 = result.checks.find((c) => c.templateId === template2.id);

			expect(check1?.checked).toBe(true);
			expect(check2?.checked).toBe(false);
		});

		it("should reject toggle for non-owned template", async () => {
			const user2 = await createTestUser();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			await expect(
				caller2.dailyJournal.toggleCheck({
					date: "2024-07-01",
					templateId: templateForChecks.id, // User 1's template
				}),
			).rejects.toThrow(ERR_TEMPLATE_NOT_FOUND);
		});

		it("should reject bulk update with non-owned template", async () => {
			const user2 = await createTestUser();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			await expect(
				caller2.dailyJournal.bulkUpdateChecks({
					date: "2024-07-01",
					checks: [{ templateId: templateForChecks.id, checked: true }],
				}),
			).rejects.toThrow("not found or not owned");
		});
	});
});
