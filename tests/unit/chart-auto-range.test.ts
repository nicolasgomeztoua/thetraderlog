import { describe, expect, it } from "vitest";
import {
	CONTEXT_RATIO_AFTER,
	CONTEXT_RATIO_BEFORE,
	computeWindow,
	effectiveDurationMs,
	MAX_TOTAL_BARS,
	pickInterval,
	resolveAutoInterval,
	SIDE_CLAMP,
	snapIndex,
} from "@/lib/market-data/chart-auto-range";
import type { ChartInterval } from "@/lib/shared/intervals";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Build `count` contiguous bars (epoch-seconds `time`) stepping by `stepSec`. */
const bars = (startSec: number, count: number, stepSec: number) =>
	Array.from({ length: count }, (_, i) => ({ time: startSec + i * stepSec }));

const clamp = (n: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, n));

/** Re-derive the expected window from the exported constants (tuning-proof). */
function expectedWindow(
	entryIdx: number,
	exitIdx: number,
	interval: ChartInterval,
) {
	const [minB, maxB, minA, maxA] = SIDE_CLAMP[interval];
	const tradeBars = exitIdx - entryIdx + 1;
	const before = clamp(
		Math.round(tradeBars * CONTEXT_RATIO_BEFORE),
		minB,
		maxB,
	);
	const after = clamp(Math.round(tradeBars * CONTEXT_RATIO_AFTER), minA, maxA);
	return { from: entryIdx - before, to: exitIdx + after };
}

describe("pickInterval", () => {
	it("maps each duration tier to the coarsest readable timeframe", () => {
		expect(pickInterval(90_000)).toBe("1min"); // 90s scalp
		expect(pickInterval(10 * MIN)).toBe("1min"); // user's 10-min example
		expect(pickInterval(40 * MIN)).toBe("1min"); // boundary -> coarser tier's edge
		expect(pickInterval(41 * MIN)).toBe("5min");
		expect(pickInterval(3 * HOUR)).toBe("5min"); // boundary
		expect(pickInterval(3 * HOUR + MIN)).toBe("15min");
		expect(pickInterval(8 * HOUR)).toBe("15min"); // boundary
		expect(pickInterval(8 * HOUR + MIN)).toBe("30min");
		expect(pickInterval(18 * HOUR)).toBe("30min"); // boundary
		expect(pickInterval(18 * HOUR + MIN)).toBe("1h");
		expect(pickInterval(2 * 24 * HOUR)).toBe("1h"); // multi-day swing
	});

	it("treats instant / negative durations as 1min", () => {
		expect(pickInterval(0)).toBe("1min");
		expect(pickInterval(-5000)).toBe("1min");
	});
});

describe("effectiveDurationMs / resolveAutoInterval", () => {
	const entry = new Date("2026-06-10T13:30:00Z");

	it("uses exit - entry for closed trades", () => {
		const exit = new Date(entry.getTime() + 10 * MIN);
		expect(effectiveDurationMs(entry, exit)).toBe(10 * MIN);
		expect(resolveAutoInterval(entry, exit)).toBe("1min");
	});

	it("clamps open trades to 24h so a stale open doesn't force 1h", () => {
		const now = entry.getTime() + 10 * 24 * HOUR; // 10 days open
		expect(effectiveDurationMs(entry, null, now)).toBe(24 * HOUR);
		expect(resolveAutoInterval(entry, null, now)).toBe("1h");
	});

	it("keeps a short open trade on a fine timeframe", () => {
		const now = entry.getTime() + 8 * MIN;
		expect(resolveAutoInterval(entry, null, now)).toBe("1min");
	});
});

describe("snapIndex", () => {
	const b = bars(1000, 5, 60); // times: 1000,1060,1120,1180,1240

	it("clamps before the first bar to index 0", () => {
		expect(snapIndex(b, 0)).toBe(0);
		expect(snapIndex(b, 1000)).toBe(0);
	});

	it("clamps past the last bar to the final index", () => {
		expect(snapIndex(b, 1240)).toBe(4);
		expect(snapIndex(b, 99_999)).toBe(4);
	});

	it("snaps a timestamp inside a gap to the nearest neighbour", () => {
		expect(snapIndex(b, 1080)).toBe(1); // closer to 1060 than 1120
		expect(snapIndex(b, 1100)).toBe(2); // closer to 1120
	});

	it("returns null for empty bars", () => {
		expect(snapIndex([], 1000)).toBeNull();
	});
});

describe("computeWindow", () => {
	it("returns null when there are no bars", () => {
		expect(
			computeWindow({
				bars: [],
				entryTime: new Date(),
				exitTime: null,
				interval: "1min",
			}),
		).toBeNull();
	});

	it("frames a 10-min scalp as a ~2.5–3h morning-session window (1min)", () => {
		// 1-min bars across a full session; entry at idx 100, exit 10 min later.
		const t0 = Math.floor(new Date("2026-06-10T13:00:00Z").getTime() / 1000);
		const series = bars(t0, 600, 60);
		const entryTime = new Date((t0 + 100 * 60) * 1000);
		const exitTime = new Date((t0 + 110 * 60) * 1000);

		const win = computeWindow({
			bars: series,
			entryTime,
			exitTime,
			interval: "1min",
		});
		expect(win).toEqual(expectedWindow(100, 110, "1min"));
		expect(win).not.toBeNull();

		// Anchor: the visible span reads as a morning session (~2–3.3h), not a
		// bare ~50-minute sliver. (1 logical unit == 1 minute here.)
		const w = win as { from: number; to: number };
		const span = w.to - w.from;
		expect(span).toBeGreaterThanOrEqual(120);
		expect(span).toBeLessThanOrEqual(200);
	});

	it("frames a 2-day swing with multi-session context (1h)", () => {
		// Contiguous 1h bars; entry idx 40, exit 48h later (idx 88).
		const t0 = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
		const series = bars(t0, 240, 3600);
		const entryTime = new Date((t0 + 40 * 3600) * 1000);
		const exitTime = new Date((t0 + 88 * 3600) * 1000);

		const win = computeWindow({
			bars: series,
			entryTime,
			exitTime,
			interval: "1h",
		});
		expect(win).toEqual(expectedWindow(40, 88, "1h"));
	});

	it("clamps an open trade's right edge to 24h (no 10-day smear)", () => {
		// 1h bars; entry idx 40; open trade, 'now' is 10 days out.
		const t0 = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
		const series = bars(t0, 400, 3600);
		const entryTime = new Date((t0 + 40 * 3600) * 1000);
		const now = entryTime.getTime() + 10 * 24 * HOUR;

		const win = computeWindow({
			bars: series,
			entryTime,
			exitTime: null,
			interval: "1h",
			now,
		});
		// Exit snaps to entry + 24h => index 64, not entry + 10 days (index 280).
		expect(win).toEqual(expectedWindow(40, 64, "1h"));
		expect((win as { to: number }).to).toBeLessThan(120);
	});

	it("caps a coarse-mismatch override at MAX_TOTAL_BARS, recentred on the trade", () => {
		// Forcing 1min onto a 2-day trade would otherwise show ~3000 bars.
		const t0 = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
		const series = bars(t0, 3200, 60);
		const entryIdx = 100;
		const exitIdx = 100 + 2 * 24 * 60; // 2 days of 1-min bars later => 2980
		const entryTime = new Date((t0 + entryIdx * 60) * 1000);
		const exitTime = new Date((t0 + exitIdx * 60) * 1000);

		const win = computeWindow({
			bars: series,
			entryTime,
			exitTime,
			interval: "1min",
		});
		const w = win as { from: number; to: number };
		expect(w.to - w.from).toBe(MAX_TOTAL_BARS);
		const mid = Math.round((entryIdx + exitIdx) / 2);
		expect(w.from).toBe(mid - Math.floor(MAX_TOTAL_BARS / 2));
	});

	it("guards against an inverted (exit-before-entry) range", () => {
		const t0 = Math.floor(new Date("2026-06-10T13:00:00Z").getTime() / 1000);
		const series = bars(t0, 300, 60);
		const entryTime = new Date((t0 + 150 * 60) * 1000);
		const exitTime = new Date((t0 + 140 * 60) * 1000); // before entry

		const win = computeWindow({
			bars: series,
			entryTime,
			exitTime,
			interval: "1min",
		});
		// exitIdx is pinned up to entryIdx => a valid single-bar trade window.
		expect(win).toEqual(expectedWindow(150, 150, "1min"));
	});
});
