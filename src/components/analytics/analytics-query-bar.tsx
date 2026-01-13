"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { HowFilters } from "./how-filters";
import { ManagePresetsDialog } from "./manage-presets-dialog";
import { PresetSelector } from "./preset-selector";
import { QuickFilters } from "./quick-filters";
import { ResultFilters } from "./result-filters";
import { TradeCountBadge } from "./trade-count-badge";
import { WhatFilters } from "./what-filters";
import { WhenFilters } from "./when-filters";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface AnalyticsQueryBarProps {
	/** Available symbols from user's trades */
	symbols: string[];
	/** Available strategies */
	strategies: FilterOption[];
	/** Available tags */
	tags: FilterOption[];
	/** Available sessions */
	sessions: FilterOption[];
	/** Account ID for filtering */
	accountId?: string | null;
	/** Whether data is loading */
	isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AnalyticsQueryBar({
	symbols,
	strategies,
	tags,
	sessions,
	accountId,
	isLoading = false,
}: AnalyticsQueryBarProps) {
	const {
		filters,
		previewFilters,
		isPreviewMode,
		enterPreviewMode,
		setPreviewFilter,
		applyPreviewFilters,
		discardPreviewFilters,
		resetPreviewFilters,
		hasActiveFilters,
		clearFilters,
		activePresetId,
		setActivePresetId,
	} = useAnalyticsFilterStore();

	// Expanded panel state
	const [isExpanded, setIsExpanded] = useState(false);

	// Hydration state - prevents mismatch between server (default filters) and client (persisted filters)
	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => {
		setHasMounted(true);
	}, []);

	// Manage presets dialog state
	const [managePresetsOpen, setManagePresetsOpen] = useState(false);

	// Enter preview mode when expanding
	const handleToggleExpand = useCallback(() => {
		if (!isExpanded) {
			enterPreviewMode();
			setIsExpanded(true);
		} else {
			// Discard preview changes when collapsing without applying
			discardPreviewFilters();
			setIsExpanded(false);
		}
	}, [isExpanded, enterPreviewMode, discardPreviewFilters]);

	// Apply preview filters and collapse
	const handleApply = useCallback(() => {
		applyPreviewFilters();
		setIsExpanded(false);
	}, [applyPreviewFilters]);

	// Reset preview filters to defaults
	const handleReset = useCallback(() => {
		resetPreviewFilters();
	}, [resetPreviewFilters]);

	// Clear all filters
	const handleClearAll = useCallback(() => {
		clearFilters();
	}, [clearFilters]);

	// Sync isExpanded with preview mode on external changes
	useEffect(() => {
		if (!isPreviewMode && isExpanded) {
			setIsExpanded(false);
		}
	}, [isPreviewMode, isExpanded]);

	// The filters to display in the expanded panel
	const displayFilters = isExpanded ? previewFilters : filters;

	return (
		<div className="space-y-0">
			{/* Quick Filters Bar (Always Visible) */}
			<QuickFilters
				filters={filters}
				hasActiveFilters={hasMounted && hasActiveFilters()}
				isExpanded={isExpanded}
				onClearAll={handleClearAll}
				onToggleExpand={handleToggleExpand}
			/>

			{/* Expanded Panel */}
			<div
				className={cn(
					"overflow-hidden transition-all duration-300 ease-out",
					isExpanded ? "mt-0 max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
				)}
			>
				<div className="rounded-b border border-white/10 border-t-0 bg-white/1">
					{/* Terminal Header */}
					<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-3">
						<div className="flex items-center gap-3">
							{/* Traffic light dots */}
							<div className="flex gap-1.5">
								<div className="size-2.5 rounded-full bg-[#ff5f57]" />
								<div className="size-2.5 rounded-full bg-[#febc2e]" />
								<div className="size-2.5 rounded-full bg-[#28c840]" />
							</div>
							<span className="font-mono text-[10px] text-muted-foreground">
								edgejournal — analytics query terminal
							</span>
						</div>

						<div className="flex items-center gap-3">
							{/* Trade Count */}
							<TradeCountBadge
								accountId={accountId}
								usePreviewFilters={isExpanded}
							/>

							{/* Action Buttons */}
							<div className="flex items-center gap-2">
								<Button
									className="h-7 gap-1.5 px-2.5 font-mono text-xs"
									onClick={handleReset}
									size="sm"
									variant="ghost"
								>
									<RotateCcw className="size-3" />
									Reset
								</Button>
								<Button
									className="h-7 px-4 font-mono text-xs"
									onClick={handleApply}
									size="sm"
								>
									Apply Filters
								</Button>
							</div>
						</div>
					</div>

					{/* Filter Sections */}
					<div className="space-y-4 p-4">
						{/* WHAT */}
						<WhatFilters
							isLoading={isLoading}
							onStrategiesChange={(s) => setPreviewFilter("strategies", s)}
							onSymbolsChange={(s) => setPreviewFilter("symbols", s)}
							onTagsChange={(t) => setPreviewFilter("tags", t)}
							selectedStrategies={displayFilters.strategies}
							selectedSymbols={displayFilters.symbols}
							selectedTags={displayFilters.tags}
							strategies={strategies}
							symbols={symbols}
							tags={tags}
						/>

						{/* WHEN */}
						<WhenFilters
							dateRange={displayFilters.dateRange}
							onDateRangeChange={(range) =>
								setPreviewFilter("dateRange", range)
							}
							onDaysChange={(days) => setPreviewFilter("daysOfWeek", days)}
							onHoursChange={(hours) => setPreviewFilter("hours", hours)}
							onSessionsChange={(s) => setPreviewFilter("sessions", s)}
							selectedDays={displayFilters.daysOfWeek}
							selectedHours={displayFilters.hours}
							selectedSessions={displayFilters.sessions}
							sessions={sessions}
						/>

						{/* HOW */}
						<HowFilters
							onPositionSizeChange={(range) =>
								setPreviewFilter("positionSizeRange", range)
							}
							onRMultipleChange={(range) =>
								setPreviewFilter("rMultipleRange", range)
							}
							positionSizeRange={displayFilters.positionSizeRange}
							rMultipleRange={displayFilters.rMultipleRange}
						/>

						{/* RESULT */}
						<ResultFilters
							onOutcomeChange={(o) => setPreviewFilter("outcome", o)}
							onReviewedChange={(r) => setPreviewFilter("reviewed", r)}
							outcome={displayFilters.outcome}
							reviewed={displayFilters.reviewed}
						/>

						{/* Presets */}
						<div className="flex items-center justify-end border-white/5 border-t pt-4">
							<PresetSelector
								activePresetId={activePresetId}
								onManageClick={() => setManagePresetsOpen(true)}
								onPresetSelect={setActivePresetId}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Manage Presets Dialog */}
			<ManagePresetsDialog
				activePresetId={activePresetId}
				onOpenChange={setManagePresetsOpen}
				onPresetDeleted={(presetId) => {
					if (activePresetId === presetId) {
						setActivePresetId(null);
					}
				}}
				open={managePresetsOpen}
			/>
		</div>
	);
}
