import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChartInterval } from "@/lib/market-data";

interface ChartPreferencesState {
	interval: ChartInterval;
	visibleBarsCount: number | null; // null = auto-fit to trade window
	setInterval: (interval: ChartInterval) => void;
	setVisibleBarsCount: (count: number | null) => void;
}

export const useChartPreferencesStore = create<ChartPreferencesState>()(
	persist(
		(set) => ({
			interval: "15min",
			visibleBarsCount: null,
			setInterval: (interval) => set({ interval }),
			setVisibleBarsCount: (visibleBarsCount) => set({ visibleBarsCount }),
		}),
		{
			name: "chart-preferences",
		},
	),
);
