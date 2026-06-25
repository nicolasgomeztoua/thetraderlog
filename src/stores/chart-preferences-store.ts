import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChartInterval } from "@/lib/market-data";

interface ChartPreferencesState {
	/**
	 * Manual timeframe override for the trade-detail chart.
	 * `null` = AUTO: the timeframe is derived per trade from its duration.
	 * A non-null value is sticky across trades (a scalper who wants 1m everywhere),
	 * but the visible window still re-frames per trade.
	 */
	intervalOverride: ChartInterval | null;
	setIntervalOverride: (interval: ChartInterval | null) => void;
}

export const useChartPreferencesStore = create<ChartPreferencesState>()(
	persist(
		(set) => ({
			intervalOverride: null,
			setIntervalOverride: (intervalOverride) => set({ intervalOverride }),
		}),
		{
			name: "chart-preferences",
			version: 2,
			// v1 stored a global `interval` + a leaky `visibleBarsCount` (one trade's
			// zoom re-applied to every other trade). Drop the zoom blob; preserve a
			// deliberately-chosen interval as the new override.
			migrate: (persisted, version) => {
				if (version < 2) {
					const prev = persisted as { interval?: ChartInterval } | undefined;
					return { intervalOverride: prev?.interval ?? null };
				}
				return persisted as ChartPreferencesState;
			},
		},
	),
);
