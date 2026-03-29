"use client";

import { Filter, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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

	// Mobile detection
	const isMobile = useIsMobile();

	// Expanded panel state (desktop) / Sheet state (mobile)
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	// Hydration state - prevents mismatch between server (default filters) and client (persisted filters)
	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => {
		setHasMounted(true);
	}, []);

	// Manage presets dialog state
	const [managePresetsOpen, setManagePresetsOpen] = useState(false);

	// Enter preview mode when expanding (desktop)
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

	// Handle mobile sheet open/close
	const handleSheetOpenChange = useCallback(
		(open: boolean) => {
			if (open) {
				enterPreviewMode();
			} else {
				discardPreviewFilters();
			}
			setIsSheetOpen(open);
		},
		[enterPreviewMode, discardPreviewFilters],
	);

	// Apply preview filters and collapse (desktop) or close sheet (mobile)
	const handleApply = useCallback(() => {
		applyPreviewFilters();
		setIsExpanded(false);
		setIsSheetOpen(false);
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

	// The filters to display in the expanded panel or sheet
	const displayFilters = isExpanded || isSheetOpen ? previewFilters : filters;

	// Shared filter content (used in both desktop panel and mobile sheet)
	const filterContent = (
		<div className="space-y-4">
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
				onDateRangeChange={(range) => setPreviewFilter("dateRange", range)}
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
				onRMultipleChange={(range) => setPreviewFilter("rMultipleRange", range)}
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
			<div className="flex items-center justify-end border-border/50 border-t pt-4">
				<PresetSelector
					activePresetId={activePresetId}
					onManageClick={() => setManagePresetsOpen(true)}
					onPresetSelect={setActivePresetId}
				/>
			</div>
		</div>
	);

	return (
		<div className="space-y-0">
			{/* Mobile: Filter button + Sheet */}
			{isMobile ? (
				<div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2">
					{/* Quick summary */}
					<div className="flex flex-1 items-center gap-2 overflow-hidden">
						<span className="font-mono text-muted-foreground text-xs">$</span>
						<span className="font-mono text-[10px] text-primary uppercase tracking-widest">
							QUERY
						</span>
						<div className="h-4 w-px bg-border" />
						<span className="truncate font-mono text-muted-foreground text-xs">
							{hasMounted && hasActiveFilters()
								? "Filters active"
								: "All trades"}
						</span>
					</div>

					{/* Clear button (if filters active) */}
					{hasMounted && hasActiveFilters() && (
						<button
							className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-border font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:border-border hover:text-foreground"
							onClick={handleClearAll}
							type="button"
						>
							Clear
						</button>
					)}

					{/* Filter Sheet Trigger */}
					<Sheet onOpenChange={handleSheetOpenChange} open={isSheetOpen}>
						<SheetTrigger asChild>
							<button
								className={cn(
									"flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded border px-3 font-mono text-xs uppercase tracking-wider transition-all",
									isSheetOpen
										? "border-primary/40 bg-primary/10 text-primary"
										: "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground",
								)}
								type="button"
							>
								<Filter className="size-4" />
								<span className="xs:inline hidden">Filters</span>
							</button>
						</SheetTrigger>
						<SheetContent
							className="flex w-full flex-col overflow-y-auto sm:max-w-md"
							side="right"
						>
							<SheetHeader className="border-border/50 border-b pb-4">
								<div className="flex items-center justify-between">
									<SheetTitle className="font-mono text-sm">
										Filter Trades
									</SheetTitle>
									<TradeCountBadge
										accountId={accountId}
										usePreviewFilters={isSheetOpen}
									/>
								</div>
							</SheetHeader>

							{/* Filter content */}
							<div className="flex-1 overflow-y-auto py-4">{filterContent}</div>

							{/* Action buttons - sticky at bottom */}
							<div className="flex items-center gap-2 border-border/50 border-t pt-4">
								<Button
									className="min-h-[44px] flex-1 gap-1.5 font-mono text-xs"
									onClick={handleReset}
									size="sm"
									variant="ghost"
								>
									<RotateCcw className="size-3" />
									Reset
								</Button>
								<Button
									className="min-h-[44px] flex-1 font-mono text-xs"
									onClick={handleApply}
									size="sm"
								>
									Apply Filters
								</Button>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			) : (
				/* Desktop: Original QuickFilters + Expandable Panel */
				<>
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
							isExpanded
								? "mt-0 max-h-[2000px] opacity-100"
								: "max-h-0 opacity-0",
						)}
					>
						<div className="rounded-b border border-border border-t-0 bg-card">
							{/* Terminal Header */}
							<div className="flex items-center justify-between border-border/50 border-b bg-muted/50 px-4 py-3">
								<div className="flex items-center gap-3">
									{/* Traffic light dots */}
									<div className="flex gap-1.5">
										<div className="size-2.5 rounded-full bg-[#ff5f57]" />
										<div className="size-2.5 rounded-full bg-[#febc2e]" />
										<div className="size-2.5 rounded-full bg-[#28c840]" />
									</div>
									<span className="font-mono text-[10px] text-muted-foreground">
										traderlog — analytics query terminal
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
							<div className="p-4">{filterContent}</div>
						</div>
					</div>
				</>
			)}

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
