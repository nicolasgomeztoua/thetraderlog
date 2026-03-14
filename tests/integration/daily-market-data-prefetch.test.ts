import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { CacheResult } from "@/lib/market-data/service";
import { getTestDb, schema, truncateAllTables } from "../utils";
import { createTestAccount } from "../utils/fixtures/accounts";
import { createTestTrade } from "../utils/fixtures/trades";
import { createTestUser } from "../utils/fixtures/users";

// Mock @/server/db to use test database
vi.mock("@/server/db", () => ({
	get db() {
		return getTestDb();
	},
}));

// Mock @/env to provide required env vars
vi.mock("@/env", () => ({
	env: {
		DATABENTO_API_KEY: "test-api-key",
	},
}));

// Track calls to service functions for assertions
const getOHLCBarsMock =
	vi.fn<
		(symbol: string, interval: string, date: Date) => Promise<CacheResult>
	>();
const hasCachedDataMock =
	vi.fn<(symbol: string, interval: string, date: Date) => Promise<boolean>>();

// Mock the market data service to control behavior per-symbol
vi.mock("@/lib/market-data/service", () => ({
	get getOHLCBars() {
		return getOHLCBarsMock;
	},
	get hasCachedData() {
		return hasCachedDataMock;
	},
}));

// ============================================================================
// HELPERS
// ============================================================================

const successResult: CacheResult = {
	bars: [
		{
			timestamp: 1700000000000,
			open: 5000,
			high: 5001,
			low: 4999,
			close: 5000.5,
		},
	],
	source: "api",
	dataQuality: "full",
};

// ============================================================================
// TESTS
// ============================================================================

describe("daily-market-data-prefetch", () => {
	let userId: string;
	let accountId: string;

	beforeAll(async () => {
		await truncateAllTables();

		const user = await createTestUser();
		userId = user.id;

		const account = await createTestAccount(userId);
		accountId = account.id;
	});

	afterAll(async () => {
		await truncateAllTables();
		vi.restoreAllMocks();
	});

	beforeEach(async () => {
		// Clear trades between tests
		const db = getTestDb();
		await db.delete(schema.trades);
		getOHLCBarsMock.mockReset();
		hasCachedDataMock.mockReset();
		// Default: no cached data, successful fetch
		hasCachedDataMock.mockResolvedValue(false);
		getOHLCBarsMock.mockResolvedValue(successResult);
	});

	describe("discoverSymbols", () => {
		it("should return distinct symbols from trades table", async () => {
			// Create trades with various symbols, including duplicates
			await createTestTrade(userId, accountId, { symbol: "ES" });
			await createTestTrade(userId, accountId, { symbol: "NQ" });
			await createTestTrade(userId, accountId, { symbol: "ES" }); // duplicate
			await createTestTrade(userId, accountId, { symbol: "YM" });

			const { discoverSymbols } = await import("@/lib/market-data/prefetch");
			const symbols = await discoverSymbols();

			expect(symbols).toHaveLength(3);
			expect(symbols).toContain("ES");
			expect(symbols).toContain("NQ");
			expect(symbols).toContain("YM");
		});

		it("should return empty array when no trades exist", async () => {
			const { discoverSymbols } = await import("@/lib/market-data/prefetch");
			const symbols = await discoverSymbols();

			expect(symbols).toHaveLength(0);
		});
	});

	describe("prefetchMarketDataForAllSymbols", () => {
		it("should handle empty symbol list gracefully", async () => {
			const { prefetchMarketDataForAllSymbols } = await import(
				"@/lib/market-data/prefetch"
			);
			const result = await prefetchMarketDataForAllSymbols();

			expect(result.total).toBe(0);
			expect(result.successes).toBe(0);
			expect(result.failures).toBe(0);
			expect(result.skipped).toBe(0);
			expect(result.failedSymbols).toHaveLength(0);
		});

		it("should fetch both 1min and 1h intervals per symbol", async () => {
			await createTestTrade(userId, accountId, { symbol: "ES" });

			const { prefetchMarketDataForAllSymbols } = await import(
				"@/lib/market-data/prefetch"
			);
			const result = await prefetchMarketDataForAllSymbols();

			expect(result.total).toBe(1);
			expect(result.successes).toBe(1);
			expect(result.failures).toBe(0);

			// Verify getOHLCBars was called for both intervals
			const intervals = getOHLCBarsMock.mock.calls.map((call) => call[1]);
			expect(intervals).toContain("1min");
			expect(intervals).toContain("1h");
		});

		it("should continue with remaining symbols when one fails", async () => {
			await createTestTrade(userId, accountId, { symbol: "ES" });
			await createTestTrade(userId, accountId, { symbol: "NQ" });

			// Make getOHLCBars throw for ES, succeed for NQ
			getOHLCBarsMock.mockImplementation(async (symbol) => {
				if (symbol === "ES") {
					throw new Error("API rate limited");
				}
				return successResult;
			});

			const { prefetchMarketDataForAllSymbols } = await import(
				"@/lib/market-data/prefetch"
			);
			const result = await prefetchMarketDataForAllSymbols();

			expect(result.total).toBe(2);
			// NQ should succeed, ES should fail
			expect(result.successes).toBe(1);
			expect(result.failures).toBe(1);
			expect(result.failedSymbols).toHaveLength(1);
		});

		it("should skip symbols that are already cached for both intervals", async () => {
			await createTestTrade(userId, accountId, { symbol: "ES" });

			// Both intervals already cached
			hasCachedDataMock.mockResolvedValue(true);

			const { prefetchMarketDataForAllSymbols } = await import(
				"@/lib/market-data/prefetch"
			);
			const result = await prefetchMarketDataForAllSymbols();

			expect(result.total).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.successes).toBe(0);
			expect(result.failures).toBe(0);
			// getOHLCBars should not have been called since both intervals are cached
			expect(getOHLCBarsMock).not.toHaveBeenCalled();
		});

		it("should report failures in failedSymbols array", async () => {
			await createTestTrade(userId, accountId, { symbol: "ES" });
			await createTestTrade(userId, accountId, { symbol: "NQ" });
			await createTestTrade(userId, accountId, { symbol: "YM" });

			// Fail NQ fetches
			getOHLCBarsMock.mockImplementation(async (symbol) => {
				if (symbol === "NQ") {
					throw new Error("Service unavailable");
				}
				return successResult;
			});

			const { prefetchMarketDataForAllSymbols } = await import(
				"@/lib/market-data/prefetch"
			);
			const result = await prefetchMarketDataForAllSymbols();

			expect(result.total).toBe(3);
			expect(result.successes).toBe(2);
			expect(result.failures).toBe(1);
			expect(result.failedSymbols).toContain("NQ");
		});
	});
});
