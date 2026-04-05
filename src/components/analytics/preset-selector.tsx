"use client";

import { Check, ChevronDown, Settings2, Star } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { api } from "@/trpc/react";
import type { AnalyticsFilters } from "@/types/analytics-filters";

// =============================================================================
// TYPES
// =============================================================================

interface PresetSelectorProps {
	/** ID of the currently active preset (if any) */
	activePresetId: string | null;
	/** Callback when a preset is selected */
	onPresetSelect: (presetId: string | null) => void;
	/** Callback to open manage presets dialog */
	onManageClick: () => void;
}

// =============================================================================
// HELPER
// =============================================================================

function parseFiltersFromJson(filtersJson: string): Partial<AnalyticsFilters> {
	try {
		const parsed = JSON.parse(filtersJson);
		return {
			symbols: parsed.symbols ?? [],
			dateRange: {
				start: parsed.dateRange?.start
					? new Date(parsed.dateRange.start)
					: null,
				end: parsed.dateRange?.end ? new Date(parsed.dateRange.end) : null,
			},
			daysOfWeek: parsed.daysOfWeek ?? [],
			hours: parsed.hours ?? [],
			sessions: parsed.sessions ?? [],
			strategies: parsed.strategies ?? [],
			tags: parsed.tags ?? [],
			rMultipleRange: parsed.rMultipleRange ?? { min: null, max: null },
			positionSizeRange: parsed.positionSizeRange ?? { min: null, max: null },
			outcome: parsed.outcome ?? "all",
			reviewed: parsed.reviewed ?? "all",
		};
	} catch {
		return {};
	}
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PresetSelector({
	activePresetId,
	onPresetSelect,
	onManageClick,
}: PresetSelectorProps) {
	const { setFilters, clearFilters } = useAnalyticsFilterStore();

	// Fetch presets
	const { data: presets, isLoading } =
		api.analytics.getFilterPresets.useQuery();

	// Get the active preset name
	const activePreset = useMemo(() => {
		if (!activePresetId || !presets) return null;
		return presets.find((p) => p.id === activePresetId) ?? null;
	}, [activePresetId, presets]);

	// Handle preset selection
	const handlePresetSelect = useCallback(
		(presetId: string) => {
			const preset = presets?.find((p) => p.id === presetId);
			if (!preset) return;

			// Parse and apply filters
			const filters = parseFiltersFromJson(preset.filters);
			setFilters(filters);

			// Notify parent
			onPresetSelect(presetId);
		},
		[presets, setFilters, onPresetSelect],
	);

	// Handle clear preset
	const handleClearPreset = useCallback(() => {
		clearFilters();
		onPresetSelect(null);
	}, [clearFilters, onPresetSelect]);

	// Don't render if no presets
	if (!presets || presets.length === 0) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className="h-8 gap-1.5 font-mono text-xs"
					size="sm"
					variant={activePreset ? "default" : "outline"}
				>
					{activePreset ? (
						<>
							<Check className="size-3" />
							<span className="max-w-30 truncate">{activePreset.name}</span>
						</>
					) : (
						<span>Presets</span>
					)}
					<ChevronDown className="size-3 opacity-50" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel className="font-mono text-muted-foreground text-xs">
					Filter Presets
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				{isLoading ? (
					<div className="px-2 py-3 text-center">
						<span className="font-mono text-muted-foreground text-xs">
							Loading...
						</span>
					</div>
				) : (
					presets.map((preset) => (
						<DropdownMenuItem
							className="cursor-pointer gap-2 font-mono text-xs"
							key={preset.id}
							onClick={() => handlePresetSelect(preset.id)}
						>
							<div className="flex flex-1 items-center gap-2">
								{preset.isDefault && (
									<Star className="size-3 fill-primary text-primary" />
								)}
								<span className="flex-1 truncate">{preset.name}</span>
							</div>
							{activePresetId === preset.id && (
								<Check className="size-3 text-primary" />
							)}
						</DropdownMenuItem>
					))
				)}

				{activePreset && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="cursor-pointer font-mono text-muted-foreground text-xs"
							onClick={handleClearPreset}
						>
							Clear preset
						</DropdownMenuItem>
					</>
				)}

				<DropdownMenuSeparator />

				<DropdownMenuItem
					className="cursor-pointer gap-2 font-mono text-xs"
					onClick={onManageClick}
				>
					<Settings2 className="size-3" />
					Manage presets
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
