/**
 * Integration tests for dailyJournal.search endpoint.
 *
 * Tests full-text search across journal entries using PostgreSQL tsvector.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateJournalSearchVector } from "@/lib/journal/search";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	createUnauthenticatedCaller,
	getTestDb,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("dailyJournal.search", () => {
	let user: User;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		const setup = await setupTrader();
		user = setup.user;
		caller = await createTestCaller(user.clerkId, user);

		// Create journal entries with distinct content
		const journal1 = await caller.dailyJournal.updateContent({
			date: "2025-01-10",
			content:
				"<p>Today I had a great trading session with ES futures. My strategy worked perfectly.</p>",
		});
		const journal2 = await caller.dailyJournal.updateContent({
			date: "2025-01-11",
			content:
				"<p>Market was very volatile today. NQ dropped significantly and I took losses on my positions.</p>",
		});
		const journal3 = await caller.dailyJournal.updateContent({
			date: "2025-01-12",
			content:
				"<p>Reviewed my risk management approach. Need to be more disciplined with stop losses.</p>",
		});

		const db = getTestDb();

		// Update search vectors synchronously for testing
		await updateJournalSearchVector(db, {
			journalId: journal1?.id ?? "",
			userId: user.id,
			content: journal1?.content ?? null,
			date: new Date("2025-01-10"),
		});
		await updateJournalSearchVector(db, {
			journalId: journal2?.id ?? "",
			userId: user.id,
			content: journal2?.content ?? null,
			date: new Date("2025-01-11"),
		});
		await updateJournalSearchVector(db, {
			journalId: journal3?.id ?? "",
			userId: user.id,
			content: journal3?.content ?? null,
			date: new Date("2025-01-12"),
		});
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// SEARCH RESULTS
	// ============================================================================

	it("should return matching journal entries for a keyword", async () => {
		const results = await caller.dailyJournal.search({ query: "trading" });

		expect(results.length).toBeGreaterThan(0);
		expect(results[0]).toHaveProperty("journalId");
		expect(results[0]).toHaveProperty("date");
		expect(results[0]).toHaveProperty("snippet");
		expect(results[0]).toHaveProperty("rank");
	});

	it("should return empty array for no matches", async () => {
		const results = await caller.dailyJournal.search({
			query: "cryptocurrency bitcoin",
		});

		expect(results).toEqual([]);
	});

	it("should return results ranked by relevance", async () => {
		const results = await caller.dailyJournal.search({ query: "trading" });

		// Results should be ordered by rank descending
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1]?.rank ?? 0).toBeGreaterThanOrEqual(
				results[i]?.rank ?? 0,
			);
		}
	});

	it("should return snippet with highlighted match text", async () => {
		const results = await caller.dailyJournal.search({ query: "volatile" });

		expect(results.length).toBeGreaterThan(0);
		// ts_headline wraps matches in <mark> tags
		expect(results[0]?.snippet ?? "").toContain("<mark>");
	});

	// ============================================================================
	// INPUT VALIDATION
	// ============================================================================

	it("should reject search with short query (< 2 chars)", async () => {
		await expect(caller.dailyJournal.search({ query: "a" })).rejects.toThrow();
	});

	// ============================================================================
	// USER OWNERSHIP
	// ============================================================================

	it("should not return journals from other users", async () => {
		// Create a second user with a journal
		const otherUser = await createTestUser({
			clerkId: "clerk_search_other",
			email: "search-other@test.com",
		});
		const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

		// Create journal for the other user
		const otherJournal = await otherCaller.dailyJournal.updateContent({
			date: "2025-01-15",
			content: "<p>This is a unique keyword: xyzzyplugh</p>",
		});

		const db = getTestDb();
		await updateJournalSearchVector(db, {
			journalId: otherJournal?.id ?? "",
			userId: otherUser.id,
			content: otherJournal?.content ?? null,
			date: new Date("2025-01-15"),
		});

		// Search as the original user — should NOT find the other user's journal
		const results = await caller.dailyJournal.search({
			query: "xyzzyplugh",
		});
		expect(results).toEqual([]);

		// Search as the other user — should find it
		const otherResults = await otherCaller.dailyJournal.search({
			query: "xyzzyplugh",
		});
		expect(otherResults.length).toBe(1);
	});

	// ============================================================================
	// AUTH
	// ============================================================================

	it("should reject unauthenticated requests", async () => {
		const unauthCaller = await createUnauthenticatedCaller();
		await expect(
			unauthCaller.dailyJournal.search({ query: "trading" }),
		).rejects.toThrow("UNAUTHORIZED");
	});
});
