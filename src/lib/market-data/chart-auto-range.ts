/**
 * Duration-adaptive timeframe + visible-window logic for the trade-detail chart.
 *
 * Two pure functions, computed per trade:
 *  - `pickInterval` / `resolveAutoInterval` choose the coarsest *readable*
 *    timeframe so the trade body spans ~12–48 candles.
 *  - `computeWindow` frames the trade as a gap-proof *bar count* (a logical
 *    range of bar indices) rather than a timestamp span — lightweight-charts
 *    collapses overnight/weekend gaps internally, so a bar-count window is the
 *    only reliable way to control "how much" is shown.
 *
 * No React here: these are imported by the client chart but stay pure so they
 * are easy to test and safe to tree-shake.
 */

import {
	AUTO_TIER_THRESHOLDS_MIN,
	type ChartInterval,
	STALE_OPEN_CAP_MS,
} from "@/lib/shared/intervals";

// =============================================================================
// INTERVAL SELECTION
// =============================================================================

/**
 * Clamped trade duration (ms) -> the coarsest readable interval. Boundaries
 * belong to the coarser tier. 0 / negative (instant trade, clock skew) -> "1min".
 */
export function pickInterval(durationMs: number): ChartInterval {
	const minutes = Math.max(0, durationMs) / 60_000;
	if (minutes <= AUTO_TIER_THRESHOLDS_MIN.oneMin) return "1min";
	if (minutes <= AUTO_TIER_THRESHOLDS_MIN.fiveMin) return "5min";
	if (minutes <= AUTO_TIER_THRESHOLDS_MIN.fifteenMin) return "15min";
	if (minutes <= AUTO_TIER_THRESHOLDS_MIN.thirtyMin) return "30min";
	return "1h";
}

/**
 * Effective duration used for interval choice. Open trades (no exit) measure to
 * `now` but clamp to STALE_OPEN_CAP_MS so a stale open doesn't force "1h".
 */
export function effectiveDurationMs(
	entry: Date,
	exit: Date | null,
	now: number = Date.now(),
): number {
	return exit
		? exit.getTime() - entry.getTime()
		: Math.min(now - entry.getTime(), STALE_OPEN_CAP_MS);
}

/** Resolve the auto interval for a trade from its entry/exit. */
export function resolveAutoInterval(
	entry: Date,
	exit: Date | null,
	now: number = Date.now(),
): ChartInterval {
	return pickInterval(effectiveDurationMs(entry, exit, now));
}

// =============================================================================
// VISIBLE WINDOW (bar-count based, gap-proof)
// =============================================================================

/** Context grows with the trade, with slightly more *after* exit ("what next?"). */
export const CONTEXT_RATIO_BEFORE = 0.6;
export const CONTEXT_RATIO_AFTER = 1.0;

/**
 * Hard ceiling on the whole window (body + context). Guarantees "too many days"
 * is structurally impossible even when a manual interval override mismatches the
 * trade (e.g. forcing "1min" onto a multi-day trade) — we recentre on the trade
 * midpoint and show exactly this many bars.
 */
export const MAX_TOTAL_BARS = 400;

/**
 * Per-interval context clamps as [MIN_BEFORE, MAX_BEFORE, MIN_AFTER, MAX_AFTER]
 * in *bars*. The "1min" minimums are deliberately generous so a short scalp
 * frames as a ~2.5–3h "morning session" rather than a bare ~50-minute sliver.
 */
export const SIDE_CLAMP: Record<
	ChartInterval,
	[number, number, number, number]
> = {
	"1min": [60, 120, 80, 150], // scalp -> ~2.5–3h window (the AM-session feel)
	"5min": [12, 48, 16, 60], // ~1h lead / ~1.3h follow; cap 4–5h/side
	"15min": [10, 32, 12, 40], // ~2.5h / ~3h; cap 8–10h/side
	"30min": [8, 28, 10, 36], // ~4h / ~5h; cap 14–18h/side
	"1h": [6, 40, 8, 60], // ~6h / ~8h; cap -> ~7 calendar days on a multi-day body
};

const clamp = (n: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, n));

/** First index where bars[i].time >= t (binary search; bars ascending). May == length. */
function lowerBound(bars: ReadonlyArray<{ time: number }>, t: number): number {
	let lo = 0;
	let hi = bars.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		const bar = bars[mid];
		if (bar !== undefined && bar.time < t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/**
 * Snap an event timestamp (epoch SECONDS) to an existing bar index.
 *  - before the first bar   -> 0
 *  - after the last bar      -> length - 1 (e.g. an open trade past the 30-day fetch cap)
 *  - inside a weekend/holiday gap -> the temporally nearest neighbour
 * Returns null only for an empty bar array. Never returns -1.
 */
export function snapIndex(
	bars: ReadonlyArray<{ time: number }>,
	t: number,
): number | null {
	const first = bars[0];
	const last = bars[bars.length - 1];
	if (first === undefined || last === undefined) return null;
	if (t <= first.time) return 0;
	if (t >= last.time) return bars.length - 1;
	const i = lowerBound(bars, t); // guaranteed in (0, length-1] here
	const cur = bars[i];
	const prev = bars[i - 1];
	if (cur === undefined) return bars.length - 1; // defensive; unreachable
	if (prev !== undefined && t - prev.time < cur.time - t) return i - 1;
	return i;
}

export interface WindowResult {
	/** Logical bar indices; may fall outside [0, len-1] -> lightweight-charts renders whitespace. */
	from: number;
	to: number;
}

/**
 * Compute the visible logical range (bar indices) that frames the trade.
 * Returns null when there are no bars (caller should `fitContent()`).
 *
 * Operates on the on-series bars (ascending, epoch seconds), so call it after
 * the candles have been set on the chart.
 */
export function computeWindow(args: {
	bars: ReadonlyArray<{ time: number }>;
	entryTime: Date;
	exitTime: Date | null; // null => open trade
	interval: ChartInterval; // the EFFECTIVE interval (override ?? auto)
	now?: number;
}): WindowResult | null {
	const { bars, entryTime, exitTime, interval, now = Date.now() } = args;
	if (bars.length === 0) return null;

	const entryMs = entryTime.getTime();
	const entrySec = Math.floor(entryMs / 1000);
	// Clamp the open-trade right edge so a stale open doesn't smear the body.
	const exitMs = exitTime
		? exitTime.getTime()
		: Math.min(now, entryMs + STALE_OPEN_CAP_MS);
	const exitSec = Math.floor(exitMs / 1000);

	const entryIdx = snapIndex(bars, entrySec);
	if (entryIdx === null) return null;
	let exitIdx = snapIndex(bars, exitSec) ?? entryIdx;
	if (exitIdx < entryIdx) exitIdx = entryIdx; // inverted/sub-candle guard

	const tradeBars = exitIdx - entryIdx + 1; // structurally >= 1
	const [minB, maxB, minA, maxA] = SIDE_CLAMP[interval];
	const before = clamp(
		Math.round(tradeBars * CONTEXT_RATIO_BEFORE),
		minB,
		maxB,
	);
	const after = clamp(Math.round(tradeBars * CONTEXT_RATIO_AFTER), minA, maxA);

	// Hard total cap: if body + context blows past MAX_TOTAL_BARS (only reachable
	// via a coarse-mismatch manual override), recentre on the trade midpoint.
	const total = before + tradeBars + after;
	if (total > MAX_TOTAL_BARS) {
		const mid = Math.round((entryIdx + exitIdx) / 2);
		const half = Math.floor(MAX_TOTAL_BARS / 2);
		return { from: mid - half, to: mid + half };
	}

	return { from: entryIdx - before, to: exitIdx + after };
}
