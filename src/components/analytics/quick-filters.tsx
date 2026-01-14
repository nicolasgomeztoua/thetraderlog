import { ChevronDown, X } from "lucide-react";
import { useMemo } from "react";
import { cn, formatDateInTimezone, toDateString } from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";
import type { AnalyticsFilters } from "@/types/analytics-filters";

// =============================================================================
// TYPES
// =============================================================================

interface QuickFiltersProps {
	/** Current filters */
	filters: AnalyticsFilters;
	/** Whether expanded panel is open */
	isExpanded: boolean;
	/** Toggle expanded panel */
	onToggleExpand: () => void;
	/** Clear all filters */
	onClearAll: () => void;
	/** Whether filters are active (different from defaults) */
	hasActiveFilters: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDateRange(
	start: Date | null,
	end: Date | null,
	timezone: string,
): string {
	if (!start && !end) return "All time";

	const formatDate = (d: Date) =>
		formatDateInTimezone(d, timezone, { format: "MMM d" });

	if (start && end) {
		const today = new Date();
		const isEndToday = toDateString(end) === toDateString(today);
		return `${formatDate(start)} → ${isEndToday ? "Today" : formatDate(end)}`;
	}
	if (start) return `From ${formatDate(start)}`;
	if (end) return `Until ${formatDate(end)}`;
	return "All time";
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickFilters({
	filters,
	isExpanded,
	onToggleExpand,
	onClearAll,
	hasActiveFilters,
}: QuickFiltersProps) {
	const { timezone } = useSettingsStore();

	// Format symbol display
	const symbolDisplay = useMemo(() => {
		if (filters.symbols.length === 0) return null;
		if (filters.symbols.length <= 3) return filters.symbols;
		return [...filters.symbols.slice(0, 2), `+${filters.symbols.length - 2}`];
	}, [filters.symbols]);

	const dateDisplay = formatDateRange(
		filters.dateRange.start,
		filters.dateRange.end,
		timezone,
	);

	return (
		<div className="flex items-center gap-3 rounded border border-white/10 bg-white/2 px-4 py-2.5">
			{/* Command prompt */}
			<div className="flex items-center gap-2">
				<span className="font-mono text-muted-foreground text-xs">$</span>
				<span className="font-mono text-[10px] text-primary uppercase tracking-widest">
					QUERY
				</span>
			</div>

			{/* Divider */}
			<div className="h-5 w-px bg-white/10" />

			{/* Symbols */}
			<div className="flex items-center gap-1.5">
				{symbolDisplay ? (
					symbolDisplay.map((symbol) => (
						<span
							className={cn(
								"rounded border px-2 py-0.5 font-mono text-xs",
								symbol.startsWith("+")
									? "border-white/10 bg-white/2 text-muted-foreground"
									: "border-primary/30 bg-primary/10 text-primary",
							)}
							key={symbol}
						>
							{symbol}
						</span>
					))
				) : (
					<span className="font-mono text-muted-foreground text-xs">
						All symbols
					</span>
				)}
			</div>

			{/* Divider */}
			<div className="h-5 w-px bg-white/10" />

			{/* Date Range */}
			<span className="font-mono text-muted-foreground text-xs">
				{dateDisplay}
			</span>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Clear All (if filters active) */}
			{hasActiveFilters && (
				<button
					className="flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:border-white/20 hover:text-foreground"
					onClick={onClearAll}
					type="button"
				>
					<X className="size-3" />
					Clear
				</button>
			)}

			{/* Expand Button */}
			<button
				className={cn(
					"flex items-center gap-1.5 rounded border px-3 py-1 font-mono text-xs uppercase tracking-wider transition-all",
					isExpanded
						? "border-primary/40 bg-primary/10 text-primary"
						: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground",
				)}
				onClick={onToggleExpand}
				type="button"
			>
				<ChevronDown
					className={cn(
						"size-3.5 transition-transform duration-200",
						isExpanded && "rotate-180",
					)}
				/>
				{isExpanded ? "Collapse" : "Expand"}
			</button>
		</div>
	);
}
