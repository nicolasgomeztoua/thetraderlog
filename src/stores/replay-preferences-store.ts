import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// REPLAY PREFERENCES STORE
// Persists user preferences for the Trade Replay feature
// =============================================================================

export type ReplaySpeed = "1x" | "2x" | "5x" | "10x";

interface ReplayPreferencesState {
	defaultSpeed: ReplaySpeed;
	showTimeSales: boolean;
	setDefaultSpeed: (speed: ReplaySpeed) => void;
	setShowTimeSales: (show: boolean) => void;
}

export const useReplayPreferencesStore = create<ReplayPreferencesState>()(
	persist(
		(set) => ({
			defaultSpeed: "1x",
			showTimeSales: true,
			setDefaultSpeed: (defaultSpeed) => set({ defaultSpeed }),
			setShowTimeSales: (showTimeSales) => set({ showTimeSales }),
		}),
		{
			name: "replay-preferences",
		},
	),
);
