"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import type { AnalyticsFilters } from "@/types/analytics-filters";
import { isFilterActive } from "@/types/analytics-filters";

// =============================================================================
// CONSTANTS
// =============================================================================

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDateRange(start: Date | null, end: Date | null): string | null {
	if (!start && !end) return null;

	const formatDate = (d: Date) => {
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	if (start && end) {
		return `${formatDate(start)} - ${formatDate(end)}`;
	}
	if (start) {
		return `From ${formatDate(start)}`;
	}
	if (end) {
		return `Until ${formatDate(end)}`;
	}
	return null;
}

function formatDaysOfWeek(days: number[]): string | null {
	if (days.length === 0) return null;
	if (days.length === 7) return "All days";
	return days.map((d) => DAY_NAMES[d]).join(", ");
}

function formatHours(hours: number[]): string | null {
	if (hours.length === 0) return null;
	if (hours.length === 24) return "All hours";
	if (hours.length <= 3) {
		return hours.map((h) => `${h}:00`).join(", ");
	}
	const min = Math.min(...hours);
	const max = Math.max(...hours);
	return `${min}:00 - ${max}:00`;
}

function formatNumericRange(
	min: number | null,
	max: number | null,
	prefix = "",
): string | null {
	if (min === null && max === null) return null;
	if (min !== null && max !== null) {
		return `${prefix}${min} - ${max}`;
	}
	if (min !== null) {
		return `${prefix}${min}+`;
	}
	if (max !== null) {
		return `${prefix}up to ${max}`;
	}
	return null;
}

function formatOutcome(outcome: string): string | null {
	if (outcome === "all") return null;
	const labels: Record<string, string> = {
		win: "Winners",
		loss: "Losers",
		breakeven: "Breakeven",
	};
	return labels[outcome] ?? null;
}

function formatReviewed(reviewed: string): string | null {
	if (reviewed === "all") return null;
	return reviewed === "reviewed" ? "Reviewed" : "Unreviewed";
}

// =============================================================================
// TYPES
// =============================================================================

interface FilterChip {
	key: keyof AnalyticsFilters;
	label: string;
	value: string;
}

// =============================================================================
// PROPS
// =============================================================================

interface FilterChipsProps {
	/** Map of strategy IDs to names */
	strategyNames?: Map<string, string>;
	/** Map of tag IDs to names */
	tagNames?: Map<string, string>;
	/** Map of session IDs to names */
	sessionNames?: Map<string, string>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilterChips({
	strategyNames = new Map(),
	tagNames = new Map(),
	sessionNames = new Map(),
}: FilterChipsProps) {
	const filters = useAnalyticsFilterStore((s) => s.filters);
	const clearFilter = useAnalyticsFilterStore((s) => s.clearFilter);
	const clearFilters = useAnalyticsFilterStore((s) => s.clearFilters);
	// Invoke the computed selectors so the component subscribes to the derived
	// value (selecting the bare function would never re-render on filter changes).
	const hasActiveFilters = useAnalyticsFilterStore((s) => s.hasActiveFilters());
	const filterCount = useAnalyticsFilterStore((s) => s.getActiveFilterCount());

	// Build list of active filter chips
	const chips: FilterChip[] = [];

	// Symbols
	if (isFilterActive("symbols", filters.symbols)) {
		chips.push({
			key: "symbols",
			label: "Symbols",
			value: filters.symbols.join(", "),
		});
	}

	// Date Range
	const dateLabel = formatDateRange(
		filters.dateRange.start,
		filters.dateRange.end,
	);
	if (dateLabel) {
		chips.push({
			key: "dateRange",
			label: "Date",
			value: dateLabel,
		});
	}

	// Days of Week
	const daysLabel = formatDaysOfWeek(filters.daysOfWeek);
	if (daysLabel) {
		chips.push({
			key: "daysOfWeek",
			label: "Days",
			value: daysLabel,
		});
	}

	// Hours
	const hoursLabel = formatHours(filters.hours);
	if (hoursLabel) {
		chips.push({
			key: "hours",
			label: "Hours",
			value: hoursLabel,
		});
	}

	// Sessions
	if (isFilterActive("sessions", filters.sessions)) {
		const names = filters.sessions
			.map((id) => sessionNames.get(id) ?? id)
			.join(", ");
		chips.push({
			key: "sessions",
			label: "Sessions",
			value: names,
		});
	}

	// Strategies
	if (isFilterActive("strategies", filters.strategies)) {
		const names = filters.strategies
			.map((id) => strategyNames.get(id) ?? id)
			.join(", ");
		chips.push({
			key: "strategies",
			label: "Strategies",
			value: names,
		});
	}

	// Tags
	if (isFilterActive("tags", filters.tags)) {
		const names = filters.tags.map((id) => tagNames.get(id) ?? id).join(", ");
		chips.push({
			key: "tags",
			label: "Tags",
			value: names,
		});
	}

	// R-Multiple Range
	const rLabel = formatNumericRange(
		filters.rMultipleRange.min,
		filters.rMultipleRange.max,
		"R: ",
	);
	if (rLabel) {
		chips.push({
			key: "rMultipleRange",
			label: "R-Multiple",
			value: rLabel,
		});
	}

	// Position Size Range
	const sizeLabel = formatNumericRange(
		filters.positionSizeRange.min,
		filters.positionSizeRange.max,
	);
	if (sizeLabel) {
		chips.push({
			key: "positionSizeRange",
			label: "Size",
			value: sizeLabel,
		});
	}

	// Outcome
	const outcomeLabel = formatOutcome(filters.outcome);
	if (outcomeLabel) {
		chips.push({
			key: "outcome",
			label: "Outcome",
			value: outcomeLabel,
		});
	}

	// Reviewed
	const reviewedLabel = formatReviewed(filters.reviewed);
	if (reviewedLabel) {
		chips.push({
			key: "reviewed",
			label: "Status",
			value: reviewedLabel,
		});
	}

	// Don't render if no active filters
	if (!hasActiveFilters) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Filter count badge */}
			<Badge className="font-mono" variant="outline">
				{filterCount} filter{filterCount !== 1 ? "s" : ""} active
			</Badge>

			{/* Filter chips */}
			{chips.map((chip) => (
				<Badge
					className="flex items-center gap-1.5 pr-1 font-mono"
					key={chip.key}
					variant="secondary"
				>
					<span className="text-muted-foreground">{chip.label}:</span>
					<span className="max-w-[150px] truncate">{chip.value}</span>
					<button
						aria-label={`Remove ${chip.label} filter`}
						className="ml-1 rounded-sm p-0.5 hover:bg-muted/300 focus:outline-none focus:ring-1 focus:ring-primary"
						onClick={() => clearFilter(chip.key)}
						type="button"
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}

			{/* Clear all button */}
			<Button
				className="h-6 px-2 font-mono text-muted-foreground text-xs hover:text-foreground"
				onClick={clearFilters}
				size="sm"
				variant="ghost"
			>
				Clear all
			</Button>
		</div>
	);
}
