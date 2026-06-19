import { describe, expect, it } from "vitest";
import { barsCoverTradeEntry } from "@/lib/market-data/chart-coverage";

// Candle with `time` as epoch seconds, matching lightweight-charts bars.
const bar = (iso: string) => ({
	time: Math.floor(new Date(iso).getTime() / 1000),
});

describe("barsCoverTradeEntry", () => {
	it("returns false when every candle ends before the trade entry (unpublished session)", () => {
		// Context days present (Jun 10–11) but the trade is Jun 12 — provider
		// hasn't released Jun 12 yet, so no candle reaches the entry.
		const bars = [bar("2026-06-10T00:00:00Z"), bar("2026-06-11T23:59:00Z")];
		expect(barsCoverTradeEntry(bars, "2026-06-12T14:00:00Z")).toBe(false);
	});

	it("returns true when candles reach or pass the trade entry", () => {
		const bars = [bar("2026-06-10T00:00:00Z"), bar("2026-06-10T15:40:00Z")];
		expect(barsCoverTradeEntry(bars, "2026-06-10T15:26:00Z")).toBe(true);
	});

	it("treats the last candle start vs entry as an inclusive boundary", () => {
		const bars = [bar("2026-06-10T15:26:00Z")];
		// last bar starts exactly at entry → covered
		expect(barsCoverTradeEntry(bars, "2026-06-10T15:26:00Z")).toBe(true);
		// last bar starts a minute before entry → not covered
		expect(barsCoverTradeEntry(bars, "2026-06-10T15:27:00Z")).toBe(false);
	});

	it("returns false when there are no bars", () => {
		expect(barsCoverTradeEntry([], "2026-06-10T15:26:00Z")).toBe(false);
	});

	it("returns true when there is no entry constraint", () => {
		expect(barsCoverTradeEntry([bar("2026-06-10T00:00:00Z")], null)).toBe(true);
		expect(barsCoverTradeEntry([bar("2026-06-10T00:00:00Z")], undefined)).toBe(
			true,
		);
	});

	it("accepts Date and epoch-millis entry values", () => {
		const bars = [bar("2026-06-10T15:40:00Z")];
		expect(barsCoverTradeEntry(bars, new Date("2026-06-10T15:26:00Z"))).toBe(
			true,
		);
		expect(
			barsCoverTradeEntry(bars, new Date("2026-06-10T15:26:00Z").getTime()),
		).toBe(true);
	});
});
