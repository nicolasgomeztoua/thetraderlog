/**
 * Integration tests for dailyJournal.getBatchByDates endpoint.
 *
 * Tests batch fetching of journal entries by specific dates,
 * including empty arrays, user ownership isolation, and correct data return.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createUnauthenticatedCaller,
	FULL_ACCESS_AUTH,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("dailyJournal.getBatchByDates", () => {
	let user: User;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		user = setup.user;
		caller = await createTestCaller(user.clerkId, user, FULL_ACCESS_AUTH);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// BASIC FUNCTIONALITY
	// ============================================================================

	describe("basic functionality", () => {
		it("should return empty array for empty dates input", async () => {
			const result = await caller.dailyJournal.getBatchByDates({
				dates: [],
			});

			expect(result).toEqual([]);
		});

		it("should return empty array for dates with no entries", async () => {
			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2020-01-01", "2020-01-02", "2020-01-03"],
			});

			expect(result).toEqual([]);
		});

		it("should return journal entries for dates that have them", async () => {
			// Create journal entries for specific dates
			await caller.dailyJournal.updateContent({
				date: "2024-09-01",
				content: "<p>September first journal entry</p>",
			});
			await caller.dailyJournal.updateContent({
				date: "2024-09-02",
				content: "<p>September second journal entry</p>",
			});

			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-09-01", "2024-09-02"],
			});

			expect(result).toHaveLength(2);

			// Verify both entries are returned with correct content
			const sortedResult = result.sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
			);
			expect(sortedResult[0]?.content).toBe(
				"<p>September first journal entry</p>",
			);
			expect(sortedResult[1]?.content).toBe(
				"<p>September second journal entry</p>",
			);
		});

		it("should only return entries for dates that exist", async () => {
			// Request 3 dates, but only 2 have entries (from previous test)
			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-09-01", "2024-09-02", "2024-09-03"],
			});

			// Only 2 entries exist, the third date has no journal
			expect(result).toHaveLength(2);
		});

		it("should return single entry when only one date matches", async () => {
			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-09-01"],
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.content).toBe("<p>September first journal entry</p>");
		});
	});

	// ============================================================================
	// DATE NORMALIZATION
	// ============================================================================

	describe("date normalization", () => {
		it("should handle full ISO date strings", async () => {
			await caller.dailyJournal.updateContent({
				date: "2024-10-15",
				content: "<p>ISO test entry</p>",
			});

			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-10-15T12:00:00.000Z"],
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.content).toBe("<p>ISO test entry</p>");
		});

		it("should normalize dates to midnight UTC", async () => {
			// Both should resolve to the same date
			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-10-15T00:00:00.000Z", "2024-10-15T23:59:59.999Z"],
			});

			// Both dates normalize to the same midnight UTC, so only 1 entry
			expect(result).toHaveLength(1);
		});
	});

	// ============================================================================
	// USER OWNERSHIP ISOLATION
	// ============================================================================

	describe("user ownership isolation", () => {
		let user2: User;
		let caller2: TestCaller;

		beforeAll(async () => {
			const setup2 = await setupTrader();
			user2 = setup2.user;
			caller2 = await createTestCaller(user2.clerkId, user2, FULL_ACCESS_AUTH);

			// Create journal entries for user2
			await caller2.dailyJournal.updateContent({
				date: "2024-11-01",
				content: "<p>User 2 journal entry</p>",
			});
		});

		it("should not return other users' journal entries", async () => {
			// user1 should not see user2's entries
			const result = await caller.dailyJournal.getBatchByDates({
				dates: ["2024-11-01"],
			});

			expect(result).toEqual([]);
		});

		it("should only return entries belonging to the authenticated user", async () => {
			// user2 should see their own entry
			const result = await caller2.dailyJournal.getBatchByDates({
				dates: ["2024-11-01"],
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.content).toBe("<p>User 2 journal entry</p>");
		});
	});

	// ============================================================================
	// AUTH VALIDATION
	// ============================================================================

	describe("authentication", () => {
		it("should reject unauthenticated requests", async () => {
			const unauthCaller = await createUnauthenticatedCaller();
			await expect(
				unauthCaller.dailyJournal.getBatchByDates({
					dates: ["2024-01-01"],
				}),
			).rejects.toThrow("UNAUTHORIZED");
		});
	});

	// ============================================================================
	// DOES NOT AUTO-CREATE
	// ============================================================================

	describe("read-only behavior", () => {
		it("should not auto-create journals for requested dates", async () => {
			const uniqueDate = "2024-12-25";

			// Fetch batch for a date that has no journal
			const batchResult = await caller.dailyJournal.getBatchByDates({
				dates: [uniqueDate],
			});

			// Should return nothing (not auto-create)
			expect(batchResult).toEqual([]);

			// Verify nothing was created by checking with getByDate (which does auto-create)
			// If getBatchByDates had auto-created, this would return a journal with null content
			// But we can verify via another batch call that it still returns empty
			const secondBatchResult = await caller.dailyJournal.getBatchByDates({
				dates: [uniqueDate],
			});
			expect(secondBatchResult).toEqual([]);
		});
	});
});
