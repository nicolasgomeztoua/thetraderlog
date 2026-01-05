"use client";

import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";

// =============================================================================
// TYPES
// =============================================================================

interface FilterToggleProps {
	/** Callback when the button is clicked */
	onClick: () => void;
	/** Optional additional className */
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilterToggle({ onClick, className }: FilterToggleProps) {
	const { hasActiveFilters, getActiveFilterCount } = useAnalyticsFilterStore();

	const activeFilters = hasActiveFilters();
	const filterCount = getActiveFilterCount();

	return (
		<Button
			className={`relative font-mono ${className ?? ""}`}
			onClick={onClick}
			size="sm"
			variant="outline"
		>
			<Filter className="size-4" />
			<span>Filters</span>
			{activeFilters && (
				<Badge
					className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 font-mono text-[10px]"
					variant="default"
				>
					{filterCount}
				</Badge>
			)}
		</Button>
	);
}
