import { create } from "zustand";
import { getTimezoneAbbreviation } from "@/lib/shared";

// Trading session configuration
export interface TradingSession {
	name: string;
	startHour: number;
	endHour: number;
	color: string;
}

// Default trading sessions (UTC hours)
const DEFAULT_SESSIONS: TradingSession[] = [
	{ name: "Asia", startHour: 0, endHour: 8, color: "#00d4ff" },
	{ name: "London", startHour: 8, endHour: 16, color: "#d4ff00" },
	{ name: "New York", startHour: 13, endHour: 21, color: "#00ff88" },
];

// Type for API settings response (from tRPC)
export interface APISettings {
	timezone: string | null;
	currency: string | null;
	breakevenThreshold: string | null;
	tradingSessions: string | null;
	theme: string | null;
}

interface SettingsState {
	// Core settings from DB
	timezone: string;
	timezoneAbbr: string;
	currency: string;
	breakevenThreshold: number;
	tradingSessions: TradingSession[];
	theme: string;

	// Hydration state
	isHydrated: boolean;

	// Actions
	hydrate: (settings: APISettings) => void;
	updateSettings: (
		partial: Partial<
			Omit<SettingsState, "isHydrated" | "hydrate" | "updateSettings">
		>,
	) => void;
}

// Get browser timezone as fallback
const getBrowserTimezone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
};

// Parse trading sessions from JSON string
function parseTradingSessions(json: string | null): TradingSession[] {
	if (!json) return DEFAULT_SESSIONS;
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed;
		}
		return DEFAULT_SESSIONS;
	} catch {
		return DEFAULT_SESSIONS;
	}
}

export const useSettingsStore = create<SettingsState>((set) => ({
	// Default values (used before hydration)
	timezone: getBrowserTimezone(),
	timezoneAbbr: getTimezoneAbbreviation(getBrowserTimezone()),
	currency: "USD",
	breakevenThreshold: 3.0,
	tradingSessions: DEFAULT_SESSIONS,
	theme: "terminal",
	isHydrated: false,

	// Hydrate from API response
	hydrate: (settings) => {
		const timezone = settings.timezone || getBrowserTimezone();
		const timezoneAbbr = getTimezoneAbbreviation(timezone);

		set({
			timezone,
			timezoneAbbr,
			currency: settings.currency || "USD",
			breakevenThreshold: parseFloat(settings.breakevenThreshold || "3.00"),
			tradingSessions: parseTradingSessions(settings.tradingSessions),
			theme: settings.theme || "terminal",
			isHydrated: true,
		});
	},

	// Update specific settings (for optimistic updates from settings page)
	updateSettings: (partial) => {
		set((state) => {
			const newState = { ...state, ...partial };

			// Recompute timezoneAbbr if timezone changed
			if (partial.timezone && partial.timezone !== state.timezone) {
				newState.timezoneAbbr = getTimezoneAbbreviation(partial.timezone);
			}

			return newState;
		});
	},
}));
