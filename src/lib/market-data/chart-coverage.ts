/**
 * Whether the fetched candles actually cover the trade itself.
 *
 * The trade chart fetches several days of context around a trade, so for a
 * recent trade whose session the data provider hasn't published yet we can
 * receive context candles from prior days while the trade window has none.
 * Rendering those would float the entry/exit markers past the last candle at
 * the right edge and look broken — so callers treat "no candle at or after the
 * entry" as having no data for this trade, and show the pending/empty state.
 *
 * @param bars - chart candles sorted ascending by `time` (epoch SECONDS)
 * @param entryTime - trade entry; null/undefined means no specific window
 */
export function barsCoverTradeEntry(
	bars: ReadonlyArray<{ time: number }>,
	entryTime: Date | string | number | null | undefined,
): boolean {
	if (entryTime == null) return true;
	if (bars.length === 0) return false;
	const entrySec = Math.floor(new Date(entryTime).getTime() / 1000);
	const lastBar = bars[bars.length - 1];
	return lastBar != null && lastBar.time >= entrySec;
}
