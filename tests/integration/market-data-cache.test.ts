import { and, eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { getTestDb, schema, truncateAllTables } from "../utils";

// Mock @/server/db to use test database
vi.mock("@/server/db", () => {
	// Lazy-load so the mock resolves after global setup sets TEST_DATABASE_URL
	return {
		get db() {
			return getTestDb();
		},
	};
});

// Mock @/env to provide required env vars
vi.mock("@/env", () => ({
	env: {
		DATABENTO_API_KEY: "test-api-key",
	},
}));

// ============================================================================
// HELPERS
// ============================================================================

/** Generate mock 1min OHLC bars for a given date */
function generateMockBars(
	date: Date,
	count: number,
	startHourUTC = 14,
): Array<{
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}> {
	const bars = [];
	const baseTimestamp = new Date(date);
	baseTimestamp.setUTCHours(startHourUTC, 0, 0, 0);

	for (let i = 0; i < count; i++) {
		const ts = baseTimestamp.getTime() + i * 60_000; // 1 minute apart
		const price = 5000 + i * 0.5;
		bars.push({
			timestamp: ts,
			open: price,
			high: price + 1,
			low: price - 0.5,
			close: price + 0.25,
			volume: 100 + i,
		});
	}
	return bars;
}

/** Create a Databento NDJSON response from bars */
function createDabentoNDJSON(
	bars: Array<{
		timestamp: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	}>,
): string {
	return bars
		.map((bar) =>
			JSON.stringify({
				hd: { ts_event: bar.timestamp * 1_000_000 }, // Convert ms to ns
				open: bar.open * 1_000_000_000, // Convert to fixed-point
				high: bar.high * 1_000_000_000,
				low: bar.low * 1_000_000_000,
				close: bar.close * 1_000_000_000,
				volume: bar.volume,
			}),
		)
		.join("\n");
}

// ============================================================================
// TESTS
// ============================================================================

describe("market-data-cache integration", () => {
	let db: ReturnType<typeof getTestDb>;

	beforeAll(async () => {
		await truncateAllTables();
		db = getTestDb();
	});

	afterAll(async () => {
		await truncateAllTables();
		vi.restoreAllMocks();
	});

	beforeEach(async () => {
		// Clear candle_cache between tests
		await db.delete(schema.candleCache);
		vi.restoreAllMocks();
	});

	it("should create cache entry with correct lastBarAt on first insert", async () => {
		const historicalDate = new Date("2024-12-15T00:00:00Z");
		const mockBars = generateMockBars(historicalDate, 100);
		const ndjson = createDabentoNDJSON(mockBars);

		// Mock global fetch to return our bars
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(ndjson, { status: 200 }));

		// Import and call getOHLCBars (lazy import after mocks)
		const { getOHLCBars } = await import("@/lib/market-data/service");
		const result = await getOHLCBars("ES", "1min", historicalDate);

		expect(result.bars).toHaveLength(100);
		expect(result.source).toBe("api");
		expect(result.dataQuality).toBe("full");

		// Verify cache entry was created
		const cacheRow = await db.query.candleCache.findFirst({
			where: and(
				eq(schema.candleCache.symbol, "ES"),
				eq(schema.candleCache.interval, "1min"),
			),
		});

		expect(cacheRow).toBeDefined();
		expect(cacheRow?.barCount).toBe(100);
		expect(cacheRow?.lastBarAt).toBeDefined();

		// lastBarAt should match the last bar's timestamp
		const lastBar = mockBars[mockBars.length - 1];
		expect(cacheRow?.lastBarAt?.getTime()).toBe(lastBar?.timestamp);

		fetchSpy.mockRestore();
	});

	it("should return cached data for historical date without re-fetching", async () => {
		const historicalDate = new Date("2024-11-20T00:00:00Z");
		const mockBars = generateMockBars(historicalDate, 50);

		// Pre-populate cache
		const lastBarTs = mockBars[mockBars.length - 1];
		await db.insert(schema.candleCache).values({
			symbol: "ES",
			interval: "1min",
			date: new Date("2024-11-20T00:00:00Z"),
			bars: JSON.stringify(mockBars),
			barCount: 50,
			source: "databento",
			fetchedAt: new Date(),
			lastBarAt: lastBarTs ? new Date(lastBarTs.timestamp) : null,
		});

		// Spy on fetch — it should NOT be called
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const { getOHLCBars } = await import("@/lib/market-data/service");
		const result = await getOHLCBars("ES", "1min", historicalDate);

		expect(result.bars).toHaveLength(50);
		expect(result.source).toBe("cache");
		expect(fetchSpy).not.toHaveBeenCalled();

		fetchSpy.mockRestore();
	});

	it("should update cache via onConflictDoUpdate when re-fetching", async () => {
		const historicalDate = new Date("2024-10-10T00:00:00Z");
		const oldBars = generateMockBars(historicalDate, 30);
		const oldLastBar = oldBars[oldBars.length - 1];

		// Pre-populate cache with old data
		await db.insert(schema.candleCache).values({
			symbol: "NQ",
			interval: "1min",
			date: new Date("2024-10-10T00:00:00Z"),
			bars: JSON.stringify(oldBars),
			barCount: 30,
			source: "databento",
			fetchedAt: new Date("2024-10-10T10:00:00Z"),
			lastBarAt: oldLastBar ? new Date(oldLastBar.timestamp) : null,
		});

		// Now simulate a new fetch with more bars (e.g., via direct DB upsert)
		const newBars = generateMockBars(historicalDate, 60);
		const newLastBar = newBars[newBars.length - 1];
		const newLastBarAt = newLastBar ? new Date(newLastBar.timestamp) : null;

		await db
			.insert(schema.candleCache)
			.values({
				symbol: "NQ",
				interval: "1min",
				date: new Date("2024-10-10T00:00:00Z"),
				bars: JSON.stringify(newBars),
				barCount: 60,
				source: "databento",
				fetchedAt: new Date(),
				lastBarAt: newLastBarAt,
			})
			.onConflictDoUpdate({
				target: [
					schema.candleCache.symbol,
					schema.candleCache.interval,
					schema.candleCache.date,
				],
				set: {
					bars: JSON.stringify(newBars),
					barCount: 60,
					lastBarAt: newLastBarAt,
					fetchedAt: new Date(),
				},
			});

		// Verify the row was updated, not duplicated
		const rows = await db.query.candleCache.findMany({
			where: and(
				eq(schema.candleCache.symbol, "NQ"),
				eq(schema.candleCache.interval, "1min"),
			),
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]?.barCount).toBe(60);
		expect(rows[0]?.lastBarAt?.getTime()).toBe(newLastBarAt?.getTime());
	});

	it("should only write 1min and 1h intervals to candle_cache", async () => {
		const historicalDate = new Date("2024-09-05T00:00:00Z");
		const mockBars = generateMockBars(historicalDate, 60);
		const ndjson = createDabentoNDJSON(mockBars);

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(ndjson, { status: 200 }));

		const { getOHLCBars } = await import("@/lib/market-data/service");

		// Request 5min interval — should cache as 1min internally
		await getOHLCBars("ES", "5min", historicalDate);

		// Check what intervals are in the DB
		const allRows = await db.query.candleCache.findMany();
		const intervals = allRows.map((r) => r.interval);

		// Only base intervals should be stored
		expect(intervals).not.toContain("5min");
		expect(intervals).not.toContain("15min");
		expect(intervals).not.toContain("30min");
		expect(intervals).not.toContain("4h");

		// Should have stored as 1min
		expect(intervals).toContain("1min");

		fetchSpy.mockRestore();
	});

	it("should return correctly aggregated 5min bars from 1min cache data", async () => {
		const historicalDate = new Date("2024-08-20T00:00:00Z");
		// Generate 10 1min bars (should produce 2 complete 5min bars)
		const mockBars = generateMockBars(historicalDate, 10);
		const lastBar = mockBars[mockBars.length - 1];

		// Pre-populate cache with 1min bars
		await db.insert(schema.candleCache).values({
			symbol: "ES",
			interval: "1min",
			date: new Date("2024-08-20T00:00:00Z"),
			bars: JSON.stringify(mockBars),
			barCount: 10,
			source: "databento",
			fetchedAt: new Date(),
			lastBarAt: lastBar ? new Date(lastBar.timestamp) : null,
		});

		// Spy on fetch — should NOT be called (data comes from cache)
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const { getOHLCBars } = await import("@/lib/market-data/service");
		const result = await getOHLCBars("ES", "5min", historicalDate);

		// 10 1min bars → 2 5min bars
		expect(result.bars).toHaveLength(2);
		expect(result.source).toBe("cache");
		expect(fetchSpy).not.toHaveBeenCalled();

		// Verify OHLC aggregation correctness for first 5min bar
		const firstBucket = result.bars[0];
		expect(firstBucket).toBeDefined();

		// First 5min bar should have:
		// open = first 1min bar's open
		expect(firstBucket?.open).toBe(mockBars[0]?.open);
		// high = max high of first 5 bars
		const first5 = mockBars.slice(0, 5);
		const expectedHigh = Math.max(...first5.map((b) => b.high));
		expect(firstBucket?.high).toBe(expectedHigh);
		// low = min low of first 5 bars
		const expectedLow = Math.min(...first5.map((b) => b.low));
		expect(firstBucket?.low).toBe(expectedLow);
		// close = last 1min bar's close in bucket
		expect(firstBucket?.close).toBe(mockBars[4]?.close);

		fetchSpy.mockRestore();
	});

	it("should aggregate 1h bars to 4h when 4h interval is requested", async () => {
		const historicalDate = new Date("2024-07-15T00:00:00Z");
		// Generate 8 1h bars (should produce 2 4h bars)
		const bars = [];
		const baseTimestamp = new Date(historicalDate);
		baseTimestamp.setUTCHours(0, 0, 0, 0);

		for (let i = 0; i < 8; i++) {
			const ts = baseTimestamp.getTime() + i * 3_600_000; // 1 hour apart
			const price = 5000 + i * 10;
			bars.push({
				timestamp: ts,
				open: price,
				high: price + 5,
				low: price - 3,
				close: price + 2,
				volume: 1000 + i * 100,
			});
		}

		const lastBar = bars[bars.length - 1];

		// Pre-populate cache with 1h bars
		await db.insert(schema.candleCache).values({
			symbol: "ES",
			interval: "1h",
			date: new Date("2024-07-15T00:00:00Z"),
			bars: JSON.stringify(bars),
			barCount: 8,
			source: "databento",
			fetchedAt: new Date(),
			lastBarAt: lastBar ? new Date(lastBar.timestamp) : null,
		});

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const { getOHLCBars } = await import("@/lib/market-data/service");
		const result = await getOHLCBars("ES", "4h", historicalDate);

		// 8 1h bars → 2 4h bars
		expect(result.bars).toHaveLength(2);
		expect(result.source).toBe("cache");
		expect(fetchSpy).not.toHaveBeenCalled();

		fetchSpy.mockRestore();
	});
});
