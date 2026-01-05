import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	type AnalyticsFilters,
	DEFAULT_ANALYTICS_FILTERS,
	isFilterActive,
	type OutcomeFilter,
	type ReviewedFilter,
	type SerializedAnalyticsFilters,
} from "@/types/analytics-filters";
import type { QueryBuilderState } from "@/types/query-builder";

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface AnalyticsFilterStore {
	filters: AnalyticsFilters;
	activePresetId: string | null;

	// Individual setters
	setSymbols: (symbols: string[]) => void;
	setDateRange: (start: Date | null, end: Date | null) => void;
	setDaysOfWeek: (days: number[]) => void;
	setHours: (hours: number[]) => void;
	setSessions: (sessions: string[]) => void;
	setStrategies: (strategies: string[]) => void;
	setTags: (tags: string[]) => void;
	setRMultipleRange: (min: number | null, max: number | null) => void;
	setPositionSizeRange: (min: number | null, max: number | null) => void;
	setOutcome: (outcome: OutcomeFilter) => void;
	setReviewed: (reviewed: ReviewedFilter) => void;
	setAdvancedQuery: (query: QueryBuilderState | null) => void;

	// Preset management
	setActivePresetId: (presetId: string | null) => void;

	// Bulk operations
	setFilters: (filters: Partial<AnalyticsFilters>) => void;
	clearFilters: () => void;
	clearFilter: (key: keyof AnalyticsFilters) => void;

	// Computed helpers
	hasActiveFilters: () => boolean;
	getActiveFilterCount: () => number;
	hasAdvancedQuery: () => boolean;

	// URL serialization
	toQueryParams: () => SerializedAnalyticsFilters;
	fromQueryParams: (params: Record<string, unknown>) => void;
}

// =============================================================================
// PERSISTENCE CONFIGURATION
// Custom serialization for Date objects
// =============================================================================

interface PersistedState {
	filters: {
		symbols: string[];
		dateRange: { start: string | null; end: string | null };
		daysOfWeek: number[];
		hours: number[];
		sessions: string[];
		strategies: string[];
		tags: string[];
		rMultipleRange: { min: number | null; max: number | null };
		positionSizeRange: { min: number | null; max: number | null };
		outcome: OutcomeFilter;
		reviewed: ReviewedFilter;
		advancedQuery: QueryBuilderState | null;
	};
	activePresetId: string | null;
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useAnalyticsFilterStore = create<AnalyticsFilterStore>()(
	persist(
		(set, get) => ({
			filters: { ...DEFAULT_ANALYTICS_FILTERS },
			activePresetId: null,

			// Individual setters
			setSymbols: (symbols) =>
				set((state) => ({
					filters: { ...state.filters, symbols },
				})),

			setDateRange: (start, end) =>
				set((state) => ({
					filters: { ...state.filters, dateRange: { start, end } },
				})),

			setDaysOfWeek: (days) =>
				set((state) => ({
					filters: { ...state.filters, daysOfWeek: days },
				})),

			setHours: (hours) =>
				set((state) => ({
					filters: { ...state.filters, hours },
				})),

			setSessions: (sessions) =>
				set((state) => ({
					filters: { ...state.filters, sessions },
				})),

			setStrategies: (strategies) =>
				set((state) => ({
					filters: { ...state.filters, strategies },
				})),

			setTags: (tags) =>
				set((state) => ({
					filters: { ...state.filters, tags },
				})),

			setRMultipleRange: (min, max) =>
				set((state) => ({
					filters: { ...state.filters, rMultipleRange: { min, max } },
				})),

			setPositionSizeRange: (min, max) =>
				set((state) => ({
					filters: { ...state.filters, positionSizeRange: { min, max } },
				})),

			setOutcome: (outcome) =>
				set((state) => ({
					filters: { ...state.filters, outcome },
				})),

			setReviewed: (reviewed) =>
				set((state) => ({
					filters: { ...state.filters, reviewed },
				})),

			setAdvancedQuery: (advancedQuery) =>
				set((state) => ({
					filters: { ...state.filters, advancedQuery },
				})),

			// Preset management
			setActivePresetId: (presetId) =>
				set({
					activePresetId: presetId,
				}),

			// Bulk operations
			setFilters: (newFilters) =>
				set((state) => ({
					filters: { ...state.filters, ...newFilters },
				})),

			clearFilters: () =>
				set({
					filters: { ...DEFAULT_ANALYTICS_FILTERS },
					activePresetId: null,
				}),

			clearFilter: (key) =>
				set((state) => ({
					filters: {
						...state.filters,
						[key]: DEFAULT_ANALYTICS_FILTERS[key],
					},
					// Clear active preset when any filter is modified
					activePresetId: null,
				})),

			// Computed helpers
			hasActiveFilters: () => {
				const { filters } = get();
				return (Object.keys(filters) as (keyof AnalyticsFilters)[]).some(
					(key) => isFilterActive(key, filters[key]),
				);
			},

			getActiveFilterCount: () => {
				const { filters } = get();
				return (Object.keys(filters) as (keyof AnalyticsFilters)[]).filter(
					(key) => isFilterActive(key, filters[key]),
				).length;
			},

			hasAdvancedQuery: () => {
				const { filters } = get();
				return filters.advancedQuery !== null;
			},

			// URL serialization
			toQueryParams: () => {
				const { filters } = get();
				const params: SerializedAnalyticsFilters = {};

				// Only include non-default values
				if (filters.symbols.length > 0) {
					params.symbols = filters.symbols;
				}

				if (filters.dateRange.start) {
					params.dateStart = filters.dateRange.start.toISOString();
				}
				if (filters.dateRange.end) {
					params.dateEnd = filters.dateRange.end.toISOString();
				}

				if (filters.daysOfWeek.length > 0) {
					params.daysOfWeek = filters.daysOfWeek;
				}

				if (filters.hours.length > 0) {
					params.hours = filters.hours;
				}

				if (filters.sessions.length > 0) {
					params.sessions = filters.sessions;
				}

				if (filters.strategies.length > 0) {
					params.strategies = filters.strategies;
				}

				if (filters.tags.length > 0) {
					params.tags = filters.tags;
				}

				if (filters.rMultipleRange.min !== null) {
					params.rMultipleMin = filters.rMultipleRange.min;
				}
				if (filters.rMultipleRange.max !== null) {
					params.rMultipleMax = filters.rMultipleRange.max;
				}

				if (filters.positionSizeRange.min !== null) {
					params.positionSizeMin = filters.positionSizeRange.min;
				}
				if (filters.positionSizeRange.max !== null) {
					params.positionSizeMax = filters.positionSizeRange.max;
				}

				if (filters.outcome !== "all") {
					params.outcome = filters.outcome;
				}

				if (filters.reviewed !== "all") {
					params.reviewed = filters.reviewed;
				}

				return params;
			},

			fromQueryParams: (params) => {
				const newFilters: Partial<AnalyticsFilters> = {};

				// Parse symbols
				if (Array.isArray(params.symbols)) {
					newFilters.symbols = params.symbols.filter(
						(s): s is string => typeof s === "string",
					);
				}

				// Parse date range
				const dateStart = params.dateStart;
				const dateEnd = params.dateEnd;
				if (dateStart || dateEnd) {
					newFilters.dateRange = {
						start: typeof dateStart === "string" ? new Date(dateStart) : null,
						end: typeof dateEnd === "string" ? new Date(dateEnd) : null,
					};
				}

				// Parse days of week
				if (Array.isArray(params.daysOfWeek)) {
					newFilters.daysOfWeek = params.daysOfWeek.filter(
						(d): d is number => typeof d === "number" && d >= 0 && d <= 6,
					);
				}

				// Parse hours
				if (Array.isArray(params.hours)) {
					newFilters.hours = params.hours.filter(
						(h): h is number => typeof h === "number" && h >= 0 && h <= 23,
					);
				}

				// Parse sessions
				if (Array.isArray(params.sessions)) {
					newFilters.sessions = params.sessions.filter(
						(s): s is string => typeof s === "string",
					);
				}

				// Parse strategies
				if (Array.isArray(params.strategies)) {
					newFilters.strategies = params.strategies.filter(
						(s): s is string => typeof s === "string",
					);
				}

				// Parse tags
				if (Array.isArray(params.tags)) {
					newFilters.tags = params.tags.filter(
						(t): t is string => typeof t === "string",
					);
				}

				// Parse R-multiple range
				const rMultipleMin = params.rMultipleMin;
				const rMultipleMax = params.rMultipleMax;
				if (rMultipleMin !== undefined || rMultipleMax !== undefined) {
					newFilters.rMultipleRange = {
						min: typeof rMultipleMin === "number" ? rMultipleMin : null,
						max: typeof rMultipleMax === "number" ? rMultipleMax : null,
					};
				}

				// Parse position size range
				const positionSizeMin = params.positionSizeMin;
				const positionSizeMax = params.positionSizeMax;
				if (positionSizeMin !== undefined || positionSizeMax !== undefined) {
					newFilters.positionSizeRange = {
						min: typeof positionSizeMin === "number" ? positionSizeMin : null,
						max: typeof positionSizeMax === "number" ? positionSizeMax : null,
					};
				}

				// Parse outcome
				const outcome = params.outcome;
				if (
					outcome === "all" ||
					outcome === "win" ||
					outcome === "loss" ||
					outcome === "breakeven"
				) {
					newFilters.outcome = outcome;
				}

				// Parse reviewed
				const reviewed = params.reviewed;
				if (
					reviewed === "all" ||
					reviewed === "reviewed" ||
					reviewed === "unreviewed"
				) {
					newFilters.reviewed = reviewed;
				}

				// Apply parsed filters
				if (Object.keys(newFilters).length > 0) {
					set((state) => ({
						filters: { ...state.filters, ...newFilters },
					}));
				}
			},
		}),
		{
			name: "analytics-filters",
			// Custom storage configuration for Date serialization
			storage: {
				getItem: (name) => {
					const str = localStorage.getItem(name);
					if (!str) return null;

					try {
						const parsed = JSON.parse(str) as { state: PersistedState };
						const { state } = parsed;

						// Convert date strings back to Date objects
						return {
							...parsed,
							state: {
								...state,
								filters: {
									...state.filters,
									dateRange: {
										start: state.filters.dateRange.start
											? new Date(state.filters.dateRange.start)
											: null,
										end: state.filters.dateRange.end
											? new Date(state.filters.dateRange.end)
											: null,
									},
								},
								activePresetId: state.activePresetId ?? null,
							},
						};
					} catch {
						return null;
					}
				},
				setItem: (name, value) => {
					const state = value.state as AnalyticsFilterStore;

					// Convert Date objects to ISO strings for storage
					const serialized = {
						...value,
						state: {
							filters: {
								...state.filters,
								dateRange: {
									start: state.filters.dateRange.start?.toISOString() ?? null,
									end: state.filters.dateRange.end?.toISOString() ?? null,
								},
							},
							activePresetId: state.activePresetId,
						},
					};

					localStorage.setItem(name, JSON.stringify(serialized));
				},
				removeItem: (name) => localStorage.removeItem(name),
			},
			// Persist both filters and activePresetId
			partialize: (state) => ({
				filters: state.filters,
				activePresetId: state.activePresetId,
			}),
		},
	),
);
