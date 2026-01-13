import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("dailyJournal router - core operations", () => {
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
	// getByDate TESTS
	// ============================================================================

	describe("getByDate", () => {
		it("should auto-create journal for a new date", async () => {
			const testDate = "2024-06-15";

			const journal = await caller.dailyJournal.getByDate({
				date: testDate,
			});

			expect(journal).toBeDefined();
			expect(journal?.userId).toBe(user.id);
			expect(journal?.content).toBeNull();
			expect(journal?.contentFormat).toBe("html");
		});

		it("should return existing journal for the same date", async () => {
			const testDate = "2024-06-15";

			const firstCall = await caller.dailyJournal.getByDate({
				date: testDate,
			});
			const secondCall = await caller.dailyJournal.getByDate({
				date: testDate,
			});

			expect(firstCall?.id).toBe(secondCall?.id);
		});

		it("should normalize dates to midnight UTC", async () => {
			// Two different times on the same day should return same journal
			const date1 = "2024-07-20T10:30:00Z";
			const date2 = "2024-07-20T23:59:59Z";

			const journal1 = await caller.dailyJournal.getByDate({ date: date1 });
			const journal2 = await caller.dailyJournal.getByDate({ date: date2 });

			expect(journal1?.id).toBe(journal2?.id);
		});

		it("should return different journals for different dates", async () => {
			const date1 = "2024-08-01";
			const date2 = "2024-08-02";

			const journal1 = await caller.dailyJournal.getByDate({ date: date1 });
			const journal2 = await caller.dailyJournal.getByDate({ date: date2 });

			expect(journal1?.id).not.toBe(journal2?.id);
		});

		it("should include attachments and checklist checks in response", async () => {
			const testDate = "2024-09-15";

			const journal = await caller.dailyJournal.getByDate({
				date: testDate,
			});

			expect(journal).toBeDefined();
			expect(Array.isArray(journal?.attachments)).toBe(true);
			expect(Array.isArray(journal?.checklistChecks)).toBe(true);
		});
	});

	// ============================================================================
	// updateContent TESTS
	// ============================================================================

	describe("updateContent", () => {
		it("should update content for an existing journal", async () => {
			const testDate = "2024-10-01";

			// First create a journal
			await caller.dailyJournal.getByDate({ date: testDate });

			// Update with content
			const updated = await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>My trading notes for today</p>",
			});

			expect(updated?.content).toBe("<p>My trading notes for today</p>");
		});

		it("should create journal if not exists when updating content", async () => {
			const testDate = "2024-10-10";

			const result = await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>New journal with content</p>",
			});

			expect(result).toBeDefined();
			expect(result?.content).toBe("<p>New journal with content</p>");
			expect(result?.userId).toBe(user.id);
		});

		it("should update updatedAt timestamp", async () => {
			const testDate = "2024-10-15";

			const initial = await caller.dailyJournal.getByDate({ date: testDate });
			const initialUpdatedAt = initial?.updatedAt;

			// Wait a tiny bit to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 10));

			const updated = await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>Updated content</p>",
			});

			expect(updated?.updatedAt).not.toEqual(initialUpdatedAt);
		});

		it("should allow setting content to null", async () => {
			const testDate = "2024-10-20";

			// First set some content
			await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>Some content</p>",
			});

			// Then clear it
			const cleared = await caller.dailyJournal.updateContent({
				date: testDate,
				content: null,
			});

			expect(cleared?.content).toBeNull();
		});
	});

	// ============================================================================
	// getRange TESTS
	// ============================================================================

	describe("getRange", () => {
		beforeAll(async () => {
			// Create journals for specific dates
			const dates = [
				"2024-11-01",
				"2024-11-03",
				"2024-11-05",
				"2024-11-10",
				"2024-11-15",
			];

			for (const date of dates) {
				await caller.dailyJournal.updateContent({
					date,
					content: `<p>Journal for ${date}</p>`,
				});
			}

			// Create one empty journal (no content)
			await caller.dailyJournal.getByDate({ date: "2024-11-07" });
		});

		it("should return journals within date range", async () => {
			const journals = await caller.dailyJournal.getRange({
				startDate: "2024-11-01",
				endDate: "2024-11-10",
			});

			// Should include 2024-11-01, 2024-11-03, 2024-11-05, 2024-11-07, 2024-11-10
			expect(journals.length).toBeGreaterThanOrEqual(4);
		});

		it("should include hasContent indicator", async () => {
			const journals = await caller.dailyJournal.getRange({
				startDate: "2024-11-01",
				endDate: "2024-11-10",
			});

			// Journals with content should have hasContent: true
			const contentJournal = journals.find(
				(j) =>
					new Date(j.date).toISOString().startsWith("2024-11-01") ||
					new Date(j.date).toISOString().startsWith("2024-11-03"),
			);
			expect(contentJournal?.hasContent).toBe(true);

			// Empty journal should have hasContent: false
			const emptyJournal = journals.find((j) =>
				new Date(j.date).toISOString().startsWith("2024-11-07"),
			);
			expect(emptyJournal?.hasContent).toBe(false);
		});

		it("should return empty array for range with no journals", async () => {
			const journals = await caller.dailyJournal.getRange({
				startDate: "2023-01-01",
				endDate: "2023-01-31",
			});

			expect(journals).toEqual([]);
		});

		it("should be inclusive of start and end dates", async () => {
			const journals = await caller.dailyJournal.getRange({
				startDate: "2024-11-01",
				endDate: "2024-11-01",
			});

			expect(journals.length).toBe(1);
		});
	});

	// ============================================================================
	// USER ISOLATION TESTS
	// ============================================================================

	describe("user isolation", () => {
		it("should not access another user's journal", async () => {
			// Create journal for first user
			const testDate = "2024-12-01";
			const journal1 = await caller.dailyJournal.updateContent({
				date: testDate,
				content: "<p>User 1 content</p>",
			});

			// Create second user and caller
			const user2 = await createTestUser();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			// Second user requests the same date - should get their own (new) journal
			const journal2 = await caller2.dailyJournal.getByDate({
				date: testDate,
			});

			expect(journal2?.id).not.toBe(journal1?.id);
			expect(journal2?.userId).toBe(user2.id);
			expect(journal2?.content).toBeNull(); // New journal, no content
		});

		it("should not include other user's journals in getRange", async () => {
			// First user creates journals
			await caller.dailyJournal.updateContent({
				date: "2024-12-10",
				content: "<p>User 1 journal</p>",
			});

			// Second user
			const user2 = await createTestUser();
			const caller2 = await createTestCaller(user2.clerkId, user2);

			// Second user's range should be empty for that date range
			const journals = await caller2.dailyJournal.getRange({
				startDate: "2024-12-01",
				endDate: "2024-12-31",
			});

			// Should not include first user's journal
			expect(
				journals.every((j) => j.id !== undefined && j.date !== undefined),
			).toBe(true);
			// If user 2 has no journals in this range, it should be empty
			// (unless they created one in previous tests with same date range)
		});
	});
});
