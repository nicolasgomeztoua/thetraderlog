import { afterEach, describe, expect, it, vi } from "vitest";

// Mock modules that require env vars / DB connection
vi.mock("@/env", () => ({
	env: { DATABENTO_API_KEY: "test" },
}));
vi.mock("@/server/db", () => ({
	db: {},
}));
vi.mock("@/server/db/schema", () => ({
	candleCache: {},
}));
vi.mock("drizzle-orm", () => ({
	and: vi.fn(),
	eq: vi.fn(),
}));

import {
	aggregateBars,
	extractLastBarAt,
	isCacheStale,
	isToday,
	type OHLCBar,
	STALENESS_THRESHOLD_MS,
} from "@/lib/market-data/service";

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a bar at a given timestamp (ms) with simple OHLCV values */
function makeBar(
	timestampMs: number,
	open: number,
	high: number,
	low: number,
	close: number,
	volume = 100,
): OHLCBar {
	return { timestamp: timestampMs, open, high, low, close, volume };
}

/** Create N consecutive 1-minute bars starting at a given timestamp */
function make1MinBars(startMs: number, count: number): OHLCBar[] {
	const bars: OHLCBar[] = [];
	const oneMinute = 60 * 1000;
	for (let i = 0; i < count; i++) {
		const ts = startMs + i * oneMinute;
		bars.push(makeBar(ts, 100 + i, 105 + i, 95 + i, 102 + i, 50 + i));
	}
	return bars;
}

/** Create N consecutive 1-hour bars starting at a given timestamp */
function make1HBars(startMs: number, count: number): OHLCBar[] {
	const bars: OHLCBar[] = [];
	const oneHour = 60 * 60 * 1000;
	for (let i = 0; i < count; i++) {
		const ts = startMs + i * oneHour;
		bars.push(makeBar(ts, 100 + i, 105 + i, 95 + i, 102 + i, 500 + i));
	}
	return bars;
}

// =============================================================================
// aggregateBars
// =============================================================================

describe("aggregateBars", () => {
	it("should return bars unchanged for 1min target interval", () => {
		const bars = make1MinBars(0, 10);
		const result = aggregateBars(bars, "1min");
		expect(result).toBe(bars); // Same reference — short-circuit
	});

	it("should return bars unchanged for 1h target interval", () => {
		const bars = make1HBars(0, 4);
		const result = aggregateBars(bars, "1h");
		expect(result).toBe(bars);
	});

	it("should aggregate 1min → 5min with correct OHLC", () => {
		// 5 bars starting at a 5min boundary
		const fiveMinBoundary = 5 * 60 * 1000; // 5 minutes in ms
		const bars: OHLCBar[] = [
			makeBar(fiveMinBoundary + 0 * 60000, 100, 110, 90, 105, 10),
			makeBar(fiveMinBoundary + 1 * 60000, 105, 115, 92, 108, 20),
			makeBar(fiveMinBoundary + 2 * 60000, 108, 120, 88, 112, 30),
			makeBar(fiveMinBoundary + 3 * 60000, 112, 118, 95, 110, 15),
			makeBar(fiveMinBoundary + 4 * 60000, 110, 116, 91, 107, 25),
		];

		const result = aggregateBars(bars, "5min");
		expect(result).toHaveLength(1);
		expect(result[0]?.open).toBe(100); // First bar's open
		expect(result[0]?.high).toBe(120); // Max high across all bars
		expect(result[0]?.low).toBe(88); // Min low across all bars
		expect(result[0]?.close).toBe(107); // Last bar's close
		expect(result[0]?.volume).toBe(100); // Sum of all volumes
	});

	it("should aggregate 1min → 15min", () => {
		// 15 consecutive 1min bars starting at 0
		const bars = make1MinBars(0, 15);
		const result = aggregateBars(bars, "15min");
		expect(result).toHaveLength(1);

		const bucket = result[0];
		expect(bucket?.open).toBe(100); // First bar open
		expect(bucket?.close).toBe(116); // Last bar close (102 + 14)
		expect(bucket?.high).toBe(119); // Max high (105 + 14)
		expect(bucket?.low).toBe(95); // Min low (95 + 0)
	});

	it("should aggregate 1min → 30min", () => {
		// 30 consecutive 1min bars starting at 0
		const bars = make1MinBars(0, 30);
		const result = aggregateBars(bars, "30min");
		expect(result).toHaveLength(1);

		const bucket = result[0];
		expect(bucket?.open).toBe(100);
		expect(bucket?.close).toBe(131); // 102 + 29
		expect(bucket?.high).toBe(134); // 105 + 29
		expect(bucket?.low).toBe(95);
	});

	it("should aggregate 1h → 4h", () => {
		// 4 consecutive 1h bars starting at 0
		const bars = make1HBars(0, 4);
		const result = aggregateBars(bars, "4h");
		expect(result).toHaveLength(1);

		const bucket = result[0];
		expect(bucket?.open).toBe(100);
		expect(bucket?.close).toBe(105); // 102 + 3
		expect(bucket?.high).toBe(108); // 105 + 3
		expect(bucket?.low).toBe(95);
	});

	it("should produce multiple buckets when bars span multiple intervals", () => {
		// 10 bars at 1min → should produce 2 buckets of 5min
		const bars = make1MinBars(0, 10);
		const result = aggregateBars(bars, "5min");
		expect(result).toHaveLength(2);

		// First bucket: bars 0-4
		expect(result[0]?.open).toBe(100);
		expect(result[0]?.close).toBe(106); // 102 + 4

		// Second bucket: bars 5-9
		expect(result[1]?.open).toBe(105);
		expect(result[1]?.close).toBe(111); // 102 + 9
	});

	it("should return empty array for empty input", () => {
		const result = aggregateBars([], "5min");
		expect(result).toEqual([]);
	});

	it("should return single bar for single bar input", () => {
		const bars = [makeBar(0, 100, 110, 90, 105, 50)];
		const result = aggregateBars(bars, "5min");
		expect(result).toHaveLength(1);
		expect(result[0]?.open).toBe(100);
		expect(result[0]?.high).toBe(110);
		expect(result[0]?.low).toBe(90);
		expect(result[0]?.close).toBe(105);
	});

	it("should sum volumes across aggregated bars", () => {
		const bars: OHLCBar[] = [
			makeBar(0, 100, 110, 90, 105, 10),
			makeBar(60000, 105, 115, 92, 108, 20),
			makeBar(120000, 108, 120, 88, 112, 30),
			makeBar(180000, 112, 118, 95, 110, 40),
			makeBar(240000, 110, 116, 91, 107, 50),
		];
		const result = aggregateBars(bars, "5min");
		expect(result[0]?.volume).toBe(150);
	});
});

// =============================================================================
// extractLastBarAt
// =============================================================================

describe("extractLastBarAt", () => {
	it("should return the timestamp of the last bar as a Date", () => {
		const ts = Date.UTC(2024, 11, 15, 14, 30, 0); // 2024-12-15 14:30 UTC
		const bars: OHLCBar[] = [
			makeBar(ts - 60000, 100, 110, 90, 105),
			makeBar(ts, 105, 115, 92, 108),
		];
		const result = extractLastBarAt(bars);
		expect(result).toBeInstanceOf(Date);
		expect(result?.getTime()).toBe(ts);
	});

	it("should return null for empty bar array", () => {
		const result = extractLastBarAt([]);
		expect(result).toBeNull();
	});

	it("should handle single bar array", () => {
		const ts = Date.UTC(2024, 5, 1, 9, 30, 0);
		const bars = [makeBar(ts, 100, 110, 90, 105)];
		const result = extractLastBarAt(bars);
		expect(result?.getTime()).toBe(ts);
	});
});

// =============================================================================
// isToday
// =============================================================================

describe("isToday", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("should return true for today's date in UTC", () => {
		const now = new Date();
		const todayUTC = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		expect(isToday(todayUTC)).toBe(true);
	});

	it("should return false for yesterday", () => {
		const now = new Date();
		const yesterday = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
		);
		expect(isToday(yesterday)).toBe(false);
	});

	it("should return false for a historical date", () => {
		const historical = new Date(Date.UTC(2024, 0, 1));
		expect(isToday(historical)).toBe(false);
	});
});

// =============================================================================
// isCacheStale
// =============================================================================

describe("isCacheStale", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("should return false for a historical date (never stale)", () => {
		const historicalDate = new Date(Date.UTC(2024, 0, 15));
		const recentLastBarAt = new Date(); // Even with a recent lastBarAt
		expect(isCacheStale(historicalDate, recentLastBarAt)).toBe(false);
	});

	it("should return false for a historical date with null lastBarAt", () => {
		const historicalDate = new Date(Date.UTC(2024, 0, 15));
		expect(isCacheStale(historicalDate, null)).toBe(false);
	});

	it("should return true for today with null lastBarAt", () => {
		const now = new Date();
		const todayUTC = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		expect(isCacheStale(todayUTC, null)).toBe(true);
	});

	it("should return true for today with old lastBarAt (> 5 min)", () => {
		vi.useFakeTimers();
		const fixedNow = new Date(Date.UTC(2026, 2, 14, 15, 0, 0)); // 2026-03-14 15:00 UTC
		vi.setSystemTime(fixedNow);

		const todayUTC = new Date(Date.UTC(2026, 2, 14));
		const oldLastBarAt = new Date(
			fixedNow.getTime() - STALENESS_THRESHOLD_MS - 1000,
		); // 6 min ago

		expect(isCacheStale(todayUTC, oldLastBarAt)).toBe(true);
	});

	it("should return false for today with recent lastBarAt (< 5 min)", () => {
		vi.useFakeTimers();
		const fixedNow = new Date(Date.UTC(2026, 2, 14, 15, 0, 0));
		vi.setSystemTime(fixedNow);

		const todayUTC = new Date(Date.UTC(2026, 2, 14));
		const recentLastBarAt = new Date(fixedNow.getTime() - 60 * 1000); // 1 min ago

		expect(isCacheStale(todayUTC, recentLastBarAt)).toBe(false);
	});

	it("should return false for today with lastBarAt exactly at threshold", () => {
		vi.useFakeTimers();
		const fixedNow = new Date(Date.UTC(2026, 2, 14, 15, 0, 0));
		vi.setSystemTime(fixedNow);

		const todayUTC = new Date(Date.UTC(2026, 2, 14));
		const atThreshold = new Date(fixedNow.getTime() - STALENESS_THRESHOLD_MS); // Exactly 5 min ago

		// now - lastBarAt === STALENESS_THRESHOLD_MS, not > so not stale
		expect(isCacheStale(todayUTC, atThreshold)).toBe(false);
	});

	it("should return false for today with old lastBarAt but recent fetchedAt (post-market)", () => {
		vi.useFakeTimers();
		// Simulate 6 PM ET (22:00 UTC) — well after market close
		const fixedNow = new Date(Date.UTC(2026, 2, 14, 22, 0, 0));
		vi.setSystemTime(fixedNow);

		const todayUTC = new Date(Date.UTC(2026, 2, 14));
		// lastBarAt is from market close at 4 PM ET (20:00 UTC) — 2 hours ago
		const oldLastBarAt = new Date(Date.UTC(2026, 2, 14, 20, 0, 0));
		// But we fetched just 2 minutes ago
		const recentFetchedAt = new Date(fixedNow.getTime() - 2 * 60 * 1000);

		expect(isCacheStale(todayUTC, oldLastBarAt, recentFetchedAt)).toBe(false);
	});

	it("should return true for today with old lastBarAt and old fetchedAt", () => {
		vi.useFakeTimers();
		const fixedNow = new Date(Date.UTC(2026, 2, 14, 22, 0, 0));
		vi.setSystemTime(fixedNow);

		const todayUTC = new Date(Date.UTC(2026, 2, 14));
		const oldLastBarAt = new Date(Date.UTC(2026, 2, 14, 20, 0, 0));
		// fetchedAt is also old (> 5 min ago)
		const oldFetchedAt = new Date(
			fixedNow.getTime() - STALENESS_THRESHOLD_MS - 1000,
		);

		expect(isCacheStale(todayUTC, oldLastBarAt, oldFetchedAt)).toBe(true);
	});

	it("should return true for today with null lastBarAt even with no fetchedAt", () => {
		const now = new Date();
		const todayUTC = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		// No fetchedAt provided, null lastBarAt — should still be stale
		expect(isCacheStale(todayUTC, null, null)).toBe(true);
	});
});
