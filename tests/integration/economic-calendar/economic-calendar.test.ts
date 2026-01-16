/**
 * Integration tests for economic calendar router.
 *
 * These tests verify that the economic calendar endpoints correctly
 * filter and return economic events based on date ranges, currency, and impact.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("economicCalendar router", () => {
	let user: User;
	let caller: TestCaller;
	const db = getTestDb();

	// Helper to get today's UTC bounds (same logic as router)
	function getTodayBoundsUTC(): { start: Date; end: Date } {
		const now = new Date();
		const start = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		const end = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
		);
		return { start, end };
	}

	beforeAll(async () => {
		await truncateAllTables();
		user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// getTodayEvents
	// ============================================================================

	describe("getTodayEvents", () => {
		beforeAll(async () => {
			const { start, end } = getTodayBoundsUTC();

			// Create events for today
			await db.insert(schema.economicEvents).values([
				{
					name: "Non-Farm Payrolls",
					currency: "USD",
					category: "Employment",
					eventTime: new Date(start.getTime() + 3 * 60 * 60 * 1000), // 3 hours into today
					impact: "high",
					source: "forex_factory",
				},
				{
					name: "CPI Data",
					currency: "USD",
					category: "Inflation",
					eventTime: new Date(start.getTime() + 5 * 60 * 60 * 1000), // 5 hours into today
					impact: "high",
					source: "forex_factory",
				},
				{
					name: "ECB Interest Rate Decision",
					currency: "EUR",
					category: "Central Bank",
					eventTime: new Date(start.getTime() + 8 * 60 * 60 * 1000), // 8 hours into today
					impact: "high",
					source: "forex_factory",
				},
				{
					name: "German Manufacturing PMI",
					currency: "EUR",
					category: "Manufacturing",
					eventTime: new Date(start.getTime() + 4 * 60 * 60 * 1000), // 4 hours into today
					impact: "medium",
					source: "forex_factory",
				},
				{
					name: "UK Retail Sales",
					currency: "GBP",
					category: "Retail",
					eventTime: new Date(start.getTime() + 6 * 60 * 60 * 1000), // 6 hours into today
					impact: "low",
					source: "forex_factory",
				},
				// Event outside today (yesterday)
				{
					name: "Yesterday Event",
					currency: "USD",
					category: "Employment",
					eventTime: new Date(start.getTime() - 24 * 60 * 60 * 1000), // 24 hours before today start
					impact: "high",
					source: "forex_factory",
				},
				// Event outside today (tomorrow)
				{
					name: "Tomorrow Event",
					currency: "USD",
					category: "Employment",
					eventTime: new Date(end.getTime() + 1 * 60 * 60 * 1000), // 1 hour after today ends
					impact: "high",
					source: "forex_factory",
				},
			]);
		});

		it("should return events within today's date range", async () => {
			const events = await caller.economicCalendar.getTodayEvents();

			expect(events.length).toBe(5);
			// Should not include yesterday or tomorrow events
			expect(events.some((e) => e.name === "Yesterday Event")).toBe(false);
			expect(events.some((e) => e.name === "Tomorrow Event")).toBe(false);
			// Should include today's events
			expect(events.some((e) => e.name === "Non-Farm Payrolls")).toBe(true);
			expect(events.some((e) => e.name === "CPI Data")).toBe(true);
			expect(events.some((e) => e.name === "ECB Interest Rate Decision")).toBe(
				true,
			);
		});

		it("should return events ordered by eventTime ascending", async () => {
			const events = await caller.economicCalendar.getTodayEvents();

			// Verify ascending order
			for (let i = 1; i < events.length; i++) {
				const prevTime = new Date(events[i - 1]?.eventTime ?? 0).getTime();
				const currTime = new Date(events[i]?.eventTime ?? 0).getTime();
				expect(currTime).toBeGreaterThanOrEqual(prevTime);
			}
		});

		it("should filter by currency when provided", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				currency: "USD",
			});

			expect(events.length).toBe(2);
			expect(events.every((e) => e.currency === "USD")).toBe(true);
			expect(events.some((e) => e.name === "Non-Farm Payrolls")).toBe(true);
			expect(events.some((e) => e.name === "CPI Data")).toBe(true);
		});

		it("should filter by EUR currency", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				currency: "EUR",
			});

			expect(events.length).toBe(2);
			expect(events.every((e) => e.currency === "EUR")).toBe(true);
			expect(events.some((e) => e.name === "ECB Interest Rate Decision")).toBe(
				true,
			);
			expect(events.some((e) => e.name === "German Manufacturing PMI")).toBe(
				true,
			);
		});

		it("should filter by impact when provided", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				impact: "high",
			});

			expect(events.length).toBe(3);
			expect(events.every((e) => e.impact === "high")).toBe(true);
			expect(events.some((e) => e.name === "Non-Farm Payrolls")).toBe(true);
			expect(events.some((e) => e.name === "CPI Data")).toBe(true);
			expect(events.some((e) => e.name === "ECB Interest Rate Decision")).toBe(
				true,
			);
		});

		it("should filter by medium impact", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				impact: "medium",
			});

			expect(events.length).toBe(1);
			expect(events[0]?.name).toBe("German Manufacturing PMI");
			expect(events[0]?.impact).toBe("medium");
		});

		it("should filter by low impact", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				impact: "low",
			});

			expect(events.length).toBe(1);
			expect(events[0]?.name).toBe("UK Retail Sales");
			expect(events[0]?.impact).toBe("low");
		});

		it("should filter by both currency and impact", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				currency: "USD",
				impact: "high",
			});

			expect(events.length).toBe(2);
			expect(events.every((e) => e.currency === "USD")).toBe(true);
			expect(events.every((e) => e.impact === "high")).toBe(true);
		});

		it("should return empty array when no events match filters", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				currency: "JPY",
			});

			expect(events).toEqual([]);
		});
	});

	// ============================================================================
	// getUpcoming
	// ============================================================================

	describe("getUpcoming", () => {
		beforeAll(async () => {
			// Clear events and create fresh ones for upcoming tests
			await db.delete(schema.economicEvents);

			const now = new Date();

			// Events at various future times
			await db.insert(schema.economicEvents).values([
				{
					name: "Event in 1 hour",
					currency: "USD",
					category: "Employment",
					eventTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
					impact: "high",
					source: "forex_factory",
				},
				{
					name: "Event in 2 hours",
					currency: "EUR",
					category: "Central Bank",
					eventTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
					impact: "medium",
					source: "forex_factory",
				},
				{
					name: "Event in 3 hours",
					currency: "GBP",
					category: "Retail",
					eventTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
					impact: "low",
					source: "forex_factory",
				},
				{
					name: "Event in 12 hours",
					currency: "USD",
					category: "Inflation",
					eventTime: new Date(now.getTime() + 12 * 60 * 60 * 1000),
					impact: "high",
					source: "forex_factory",
				},
				{
					name: "Event in 30 hours",
					currency: "JPY",
					category: "GDP",
					eventTime: new Date(now.getTime() + 30 * 60 * 60 * 1000),
					impact: "high",
					source: "forex_factory",
				},
				// Past event (should not be included)
				{
					name: "Past Event",
					currency: "USD",
					category: "Employment",
					eventTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
					impact: "high",
					source: "forex_factory",
				},
			]);
		});

		it("should return upcoming events within default 24 hours", async () => {
			const events = await caller.economicCalendar.getUpcoming();

			// Should include events in 1, 2, 3, 12 hours but not 30 hours or past
			expect(events.length).toBe(4);
			expect(events.some((e) => e.name === "Event in 1 hour")).toBe(true);
			expect(events.some((e) => e.name === "Event in 2 hours")).toBe(true);
			expect(events.some((e) => e.name === "Event in 3 hours")).toBe(true);
			expect(events.some((e) => e.name === "Event in 12 hours")).toBe(true);
			expect(events.some((e) => e.name === "Event in 30 hours")).toBe(false);
			expect(events.some((e) => e.name === "Past Event")).toBe(false);
		});

		it("should return events ordered by eventTime ascending", async () => {
			const events = await caller.economicCalendar.getUpcoming();

			// Verify ascending order
			for (let i = 1; i < events.length; i++) {
				const prevTime = new Date(events[i - 1]?.eventTime ?? 0).getTime();
				const currTime = new Date(events[i]?.eventTime ?? 0).getTime();
				expect(currTime).toBeGreaterThanOrEqual(prevTime);
			}
		});

		it("should respect limit parameter", async () => {
			const events = await caller.economicCalendar.getUpcoming({ limit: 2 });

			expect(events.length).toBe(2);
			// Should be the first 2 events by time
			expect(events[0]?.name).toBe("Event in 1 hour");
			expect(events[1]?.name).toBe("Event in 2 hours");
		});

		it("should respect limit of 1", async () => {
			const events = await caller.economicCalendar.getUpcoming({ limit: 1 });

			expect(events.length).toBe(1);
			expect(events[0]?.name).toBe("Event in 1 hour");
		});

		it("should respect hoursAhead parameter", async () => {
			// Only get events in next 2.5 hours
			const events = await caller.economicCalendar.getUpcoming({
				hoursAhead: 3,
			});

			// Should include events in 1, 2 hours but not 3 hours (edge case - <= comparison)
			expect(events.some((e) => e.name === "Event in 1 hour")).toBe(true);
			expect(events.some((e) => e.name === "Event in 2 hours")).toBe(true);
			// Event exactly at 3 hours should be included due to <= comparison
			expect(events.some((e) => e.name === "Event in 3 hours")).toBe(true);
			expect(events.some((e) => e.name === "Event in 12 hours")).toBe(false);
		});

		it("should combine hoursAhead and limit parameters", async () => {
			const events = await caller.economicCalendar.getUpcoming({
				hoursAhead: 48,
				limit: 3,
			});

			// 48 hours would include all 5 upcoming events, but limit to 3
			expect(events.length).toBe(3);
		});

		it("should return empty array when no upcoming events", async () => {
			// Look for events only in next 30 minutes (none exist)
			// Note: hoursAhead has minimum of 1, so we test with very short window
			// after clearing events
			await db.delete(schema.economicEvents);

			const events = await caller.economicCalendar.getUpcoming({
				hoursAhead: 1,
			});

			expect(events).toEqual([]);
		});
	});

	// ============================================================================
	// Empty results handling
	// ============================================================================

	describe("empty results", () => {
		beforeAll(async () => {
			// Clear all events
			await db.delete(schema.economicEvents);
		});

		it("should return empty array for getTodayEvents when no events exist", async () => {
			const events = await caller.economicCalendar.getTodayEvents();

			expect(events).toEqual([]);
		});

		it("should return empty array for getUpcoming when no events exist", async () => {
			const events = await caller.economicCalendar.getUpcoming();

			expect(events).toEqual([]);
		});

		it("should return empty array for getTodayEvents with filters when no events match", async () => {
			const events = await caller.economicCalendar.getTodayEvents({
				currency: "USD",
				impact: "high",
			});

			expect(events).toEqual([]);
		});
	});
});
