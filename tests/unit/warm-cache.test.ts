import { describe, expect, it, vi } from "vitest";

// Mock the service module so importing warm-cache doesn't pull in env/DB
vi.mock("@/lib/market-data/service", () => ({
	getOHLCBars: vi.fn(),
}));

import { getOHLCBars } from "@/lib/market-data/service";
import {
	collectSymbolDays,
	mapWithConcurrency,
	warmCandleCache,
} from "@/lib/market-data/warm-cache";

const getOHLCBarsMock = vi.mocked(getOHLCBars);

describe("collectSymbolDays", () => {
	it("dedupes trades on the same symbol and day to one entry", () => {
		const day = new Date("2024-03-04T14:30:00Z");
		const trades = [
			{
				symbol: "ES",
				entryTime: day,
				exitTime: new Date("2024-03-04T15:00:00Z"),
			},
			{
				symbol: "ES",
				entryTime: new Date("2024-03-04T16:00:00Z"),
				exitTime: new Date("2024-03-04T17:00:00Z"),
			},
			{
				symbol: "ES",
				entryTime: new Date("2024-03-04T19:00:00Z"),
				exitTime: new Date("2024-03-04T19:30:00Z"),
			},
		];

		const result = collectSymbolDays(trades);

		expect(result).toHaveLength(1);
		expect(result[0]?.symbol).toBe("ES");
		expect(result[0]?.date.toISOString()).toBe("2024-03-04T00:00:00.000Z");
	});

	it("expands a multi-day trade into one entry per UTC day", () => {
		const trades = [
			{
				symbol: "NQ",
				entryTime: new Date("2024-03-04T20:00:00Z"),
				exitTime: new Date("2024-03-06T03:00:00Z"),
			},
		];

		const result = collectSymbolDays(trades);

		expect(result.map((d) => d.date.toISOString())).toEqual([
			"2024-03-04T00:00:00.000Z",
			"2024-03-05T00:00:00.000Z",
			"2024-03-06T00:00:00.000Z",
		]);
	});

	it("tracks different symbols on the same day separately", () => {
		const entryTime = new Date("2024-03-04T14:30:00Z");
		const exitTime = new Date("2024-03-04T15:00:00Z");
		const trades = [
			{ symbol: "ES", entryTime, exitTime },
			{ symbol: "NQ", entryTime, exitTime },
		];

		const result = collectSymbolDays(trades);

		expect(result).toHaveLength(2);
		expect(result.map((d) => d.symbol).sort()).toEqual(["ES", "NQ"]);
	});

	it("skips open trades and unsupported symbols", () => {
		const trades = [
			{
				symbol: "ES",
				entryTime: new Date("2024-03-04T14:30:00Z"),
				exitTime: null,
			},
			{
				symbol: "NOT_A_FUTURE",
				entryTime: new Date("2024-03-04T14:30:00Z"),
				exitTime: new Date("2024-03-04T15:00:00Z"),
			},
		];

		expect(collectSymbolDays(trades)).toHaveLength(0);
	});
});

describe("mapWithConcurrency", () => {
	it("preserves input order in results", async () => {
		const items = [30, 10, 20];
		const results = await mapWithConcurrency(items, 3, async (ms) => {
			await new Promise((resolve) => setTimeout(resolve, ms));
			return ms;
		});

		expect(results).toEqual([30, 10, 20]);
	});

	it("never runs more than the requested number of workers", async () => {
		let inFlight = 0;
		let maxInFlight = 0;

		await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 5));
			inFlight -= 1;
		});

		expect(maxInFlight).toBe(2);
	});
});

describe("warmCandleCache", () => {
	it("fetches each symbol-day once and summarizes data quality", async () => {
		getOHLCBarsMock.mockReset();
		getOHLCBarsMock
			.mockResolvedValueOnce({ bars: [], source: "api", dataQuality: "full" })
			.mockResolvedValueOnce({
				bars: [],
				source: "api",
				dataQuality: "unavailable",
			})
			.mockResolvedValueOnce({
				bars: [],
				source: "api",
				dataQuality: "pending",
			});

		const summary = await warmCandleCache([
			{ symbol: "ES", date: new Date("2024-03-04T00:00:00Z") },
			{ symbol: "ES", date: new Date("2024-03-05T00:00:00Z") },
			{ symbol: "NQ", date: new Date("2024-03-04T00:00:00Z") },
		]);

		expect(getOHLCBarsMock).toHaveBeenCalledTimes(3);
		expect(getOHLCBarsMock).toHaveBeenCalledWith(
			"ES",
			"1min",
			new Date("2024-03-04T00:00:00Z"),
		);
		expect(summary).toEqual({
			requested: 3,
			full: 1,
			pending: 1,
			unavailable: 1,
		});
	});
});
