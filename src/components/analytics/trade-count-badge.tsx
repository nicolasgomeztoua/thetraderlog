import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/shared";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { api } from "@/trpc/react";
import type { AnalyticsFilters } from "@/types/analytics-filters";

// =============================================================================
// TYPES
// =============================================================================

interface TradeCountBadgeProps {
	/** Account ID to filter by */
	accountId?: string | null;
	/** Optional class name */
	className?: string;
	/** Use preview filters instead of applied filters */
	usePreviewFilters?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert store filters to API format
 */
function filtersToApiFormat(filters: AnalyticsFilters) {
	return {
		symbols: filters.symbols.length > 0 ? filters.symbols : undefined,
		dateRange:
			filters.dateRange.start || filters.dateRange.end
				? {
						start: filters.dateRange.start?.toISOString() ?? null,
						end: filters.dateRange.end?.toISOString() ?? null,
					}
				: undefined,
		daysOfWeek: filters.daysOfWeek.length > 0 ? filters.daysOfWeek : undefined,
		hours: filters.hours.length > 0 ? filters.hours : undefined,
		sessions: filters.sessions.length > 0 ? filters.sessions : undefined,
		strategies: filters.strategies.length > 0 ? filters.strategies : undefined,
		tags: filters.tags.length > 0 ? filters.tags : undefined,
		rMultipleRange:
			filters.rMultipleRange.min !== null || filters.rMultipleRange.max !== null
				? filters.rMultipleRange
				: undefined,
		positionSizeRange:
			filters.positionSizeRange.min !== null ||
			filters.positionSizeRange.max !== null
				? filters.positionSizeRange
				: undefined,
		outcome: filters.outcome !== "all" ? filters.outcome : undefined,
		reviewed: filters.reviewed !== "all" ? filters.reviewed : undefined,
	};
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TradeCountBadge({
	accountId,
	className,
	usePreviewFilters = false,
}: TradeCountBadgeProps) {
	const { filters, previewFilters } = useAnalyticsFilterStore();
	const activeFilters = usePreviewFilters ? previewFilters : filters;

	// Debounce the filters to avoid excessive API calls
	const [debouncedFilters, setDebouncedFilters] =
		useState<AnalyticsFilters>(activeFilters);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedFilters(activeFilters);
		}, 300);
		return () => clearTimeout(timer);
	}, [activeFilters]);

	// Convert to API format
	const apiFilters = useMemo(
		() => filtersToApiFormat(debouncedFilters),
		[debouncedFilters],
	);

	// Fetch count
	const { data, isLoading, isFetching } =
		api.analytics.getFilteredTradeCount.useQuery(
			{
				accountId: accountId ?? undefined,
				filters: apiFilters,
			},
			{
				staleTime: 10_000, // Consider data fresh for 10 seconds
				refetchOnWindowFocus: false,
			},
		);

	const count = data?.count ?? 0;
	const isUpdating = isFetching && !isLoading;

	return (
		<div
			className={cn(
				"inline-flex items-center gap-2 rounded border border-primary/20 bg-primary/5 px-3 py-1.5",
				className,
			)}
		>
			{isLoading ? (
				<Loader2 className="size-3.5 animate-spin text-primary" />
			) : (
				<span
					className={cn(
						"font-bold font-mono text-lg text-primary tabular-nums transition-opacity",
						isUpdating && "opacity-50",
					)}
				>
					{count.toLocaleString()}
				</span>
			)}
			<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				{count === 1 ? "trade" : "trades"} match
			</span>
			{isUpdating && (
				<Loader2 className="size-3 animate-spin text-muted-foreground" />
			)}
		</div>
	);
}
