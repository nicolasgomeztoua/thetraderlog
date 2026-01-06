"use client";

import { format } from "date-fns";
import { CalendarIcon, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	DAYS_OF_WEEK,
	KEY_HOURS,
	OUTCOME_OPTIONS,
	REVIEW_STATUS_OPTIONS,
} from "@/lib/analytics";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import type {
	AnalyticsFilters,
	OutcomeFilter,
	ReviewedFilter,
} from "@/types/analytics-filters";
import { DEFAULT_ANALYTICS_FILTERS } from "@/types/analytics-filters";
import {
	countConditions,
	DEFAULT_QUERY_STATE,
	type QueryBuilderState,
} from "@/types/query-builder";
import { QueryBuilder } from "./query-builder";
import { SavePresetDialog } from "./save-preset-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface FilterPanelProps {
	/** Whether the panel is open */
	open: boolean;
	/** Callback when panel should close */
	onOpenChange: (open: boolean) => void;
	/** Available symbols from user's trades */
	symbols?: string[];
	/** Available strategies */
	strategies?: FilterOption[];
	/** Available tags */
	tags?: FilterOption[];
	/** Available sessions */
	sessions?: FilterOption[];
	/** Whether data is loading */
	isLoading?: boolean;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function FilterSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-3">
			<h4 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
				{title}
			</h4>
			{children}
		</div>
	);
}

function MultiSelectFilter({
	options,
	selected,
	onChange,
	renderOption,
}: {
	options: FilterOption[];
	selected: string[];
	onChange: (selected: string[]) => void;
	renderOption?: (option: FilterOption) => React.ReactNode;
}) {
	const toggleOption = useCallback(
		(id: string) => {
			if (selected.includes(id)) {
				onChange(selected.filter((s) => s !== id));
			} else {
				onChange([...selected, id]);
			}
		},
		[selected, onChange],
	);

	if (options.length === 0) {
		return (
			<p className="font-mono text-muted-foreground text-xs">
				No options available
			</p>
		);
	}

	return (
		<div className="flex flex-wrap gap-2">
			{options.map((option) => {
				const isSelected = selected.includes(option.id);
				return (
					<button
						className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors ${
							isSelected
								? "border-primary bg-primary/10 text-primary"
								: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground"
						}`}
						key={option.id}
						onClick={() => toggleOption(option.id)}
						type="button"
					>
						{renderOption ? renderOption(option) : option.name}
					</button>
				);
			})}
		</div>
	);
}

function CheckboxGroup({
	options,
	selected,
	onChange,
}: {
	options: { value: number | string; label: string }[];
	selected: (number | string)[];
	onChange: (selected: (number | string)[]) => void;
}) {
	const toggleOption = useCallback(
		(value: number | string) => {
			if (selected.includes(value)) {
				onChange(selected.filter((s) => s !== value));
			} else {
				onChange([...selected, value]);
			}
		},
		[selected, onChange],
	);

	return (
		<div className="flex flex-wrap gap-3">
			{options.map((option) => {
				const id = `checkbox-${option.value}`;
				return (
					<div
						className="flex cursor-pointer items-center gap-2"
						key={option.value}
					>
						<Checkbox
							checked={selected.includes(option.value)}
							id={id}
							onCheckedChange={() => toggleOption(option.value)}
						/>
						<label className="cursor-pointer font-mono text-xs" htmlFor={id}>
							{option.label}
						</label>
					</div>
				);
			})}
		</div>
	);
}

function RadioGroup({
	options,
	value,
	onChange,
}: {
	options: { value: string; label: string }[];
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{options.map((option) => (
				<button
					className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors ${
						value === option.value
							? "border-primary bg-primary/10 text-primary"
							: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground"
					}`}
					key={option.value}
					onClick={() => onChange(option.value)}
					type="button"
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function RangeInput({
	minValue,
	maxValue,
	onMinChange,
	onMaxChange,
	placeholder = { min: "Min", max: "Max" },
	step = 1,
}: {
	minValue: number | null;
	maxValue: number | null;
	onMinChange: (value: number | null) => void;
	onMaxChange: (value: number | null) => void;
	placeholder?: { min: string; max: string };
	step?: number;
}) {
	return (
		<div className="flex items-center gap-2">
			<Input
				className="h-8 w-24 font-mono text-xs"
				onChange={(e) =>
					onMinChange(e.target.value ? Number(e.target.value) : null)
				}
				placeholder={placeholder.min}
				step={step}
				type="number"
				value={minValue ?? ""}
			/>
			<span className="text-muted-foreground">to</span>
			<Input
				className="h-8 w-24 font-mono text-xs"
				onChange={(e) =>
					onMaxChange(e.target.value ? Number(e.target.value) : null)
				}
				placeholder={placeholder.max}
				step={step}
				type="number"
				value={maxValue ?? ""}
			/>
		</div>
	);
}

function DateRangeInput({
	startDate,
	endDate,
	onStartChange,
	onEndChange,
}: {
	startDate: Date | null;
	endDate: Date | null;
	onStartChange: (date: Date | null) => void;
	onEndChange: (date: Date | null) => void;
}) {
	const formatForInput = (date: Date | null) => {
		if (!date) return "";
		return format(date, "yyyy-MM-dd");
	};

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
			<div className="relative flex-1">
				<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
				<Input
					className="h-8 pl-9 font-mono text-xs"
					onChange={(e) =>
						onStartChange(e.target.value ? new Date(e.target.value) : null)
					}
					type="date"
					value={formatForInput(startDate)}
				/>
			</div>
			<span className="hidden text-muted-foreground sm:block">to</span>
			<div className="relative flex-1">
				<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
				<Input
					className="h-8 pl-9 font-mono text-xs"
					onChange={(e) =>
						onEndChange(e.target.value ? new Date(e.target.value) : null)
					}
					type="date"
					value={formatForInput(endDate)}
				/>
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FilterPanel({
	open,
	onOpenChange,
	symbols = [],
	strategies = [],
	tags = [],
	sessions = [],
	isLoading = false,
}: FilterPanelProps) {
	const {
		filters,
		setFilters,
		setAdvancedQuery,
		hasAdvancedQuery,
		setActivePresetId,
	} = useAnalyticsFilterStore();

	// Local state for editing (so changes aren't applied until "Apply" is clicked)
	const [localFilters, setLocalFilters] = useState<AnalyticsFilters>(filters);

	// Query builder modal state
	const [queryBuilderOpen, setQueryBuilderOpen] = useState(false);

	// Save preset dialog state
	const [savePresetOpen, setSavePresetOpen] = useState(false);

	// Sync local state when panel opens or filters change externally
	useEffect(() => {
		if (open) {
			setLocalFilters(filters);
		}
	}, [open, filters]);

	// Handle query builder apply
	const handleQueryApply = useCallback(
		(query: QueryBuilderState) => {
			// If query has conditions, set it; otherwise clear it
			if (query.groups.length > 0 && countConditions(query) > 0) {
				setAdvancedQuery(query);
			} else {
				setAdvancedQuery(null);
			}
		},
		[setAdvancedQuery],
	);

	// Clear advanced query
	const handleClearAdvancedQuery = useCallback(() => {
		setAdvancedQuery(null);
	}, [setAdvancedQuery]);

	// Helper to update local filters
	const updateLocal = useCallback(
		<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
			setLocalFilters((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	// Apply filters and close panel
	const handleApply = useCallback(() => {
		setFilters(localFilters);
		onOpenChange(false);
	}, [localFilters, setFilters, onOpenChange]);

	// Reset to defaults
	const handleReset = useCallback(() => {
		setLocalFilters({ ...DEFAULT_ANALYTICS_FILTERS });
	}, []);

	// Handle preset saved
	const handlePresetSaved = useCallback(
		(presetId: string) => {
			setActivePresetId(presetId);
		},
		[setActivePresetId],
	);

	// Convert symbols to FilterOption format
	const symbolOptions: FilterOption[] = symbols.map((s) => ({
		id: s,
		name: s,
	}));

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="flex w-full flex-col sm:max-w-md" side="right">
				<SheetHeader className="border-border border-b pb-4">
					<div className="flex items-center justify-between">
						<SheetTitle className="font-mono text-lg">Filters</SheetTitle>
						<Button
							className="h-7 px-2 font-mono text-muted-foreground text-xs"
							onClick={handleReset}
							size="sm"
							variant="ghost"
						>
							Reset all
						</Button>
					</div>
					<SheetDescription className="font-mono text-xs">
						Filter your analytics data by various criteria
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="-mx-6 flex-1 px-6">
					<div className="space-y-6 py-4">
						{/* Advanced Query Builder Section */}
						<div className="rounded border border-primary/20 bg-primary/5 p-4">
							<div className="mb-3 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Sparkles className="size-4 text-primary" />
									<span className="font-medium font-mono text-sm">
										Advanced Query
									</span>
								</div>
								{hasAdvancedQuery() && (
									<Button
										className="h-6 px-2 font-mono text-muted-foreground text-xs"
										onClick={handleClearAdvancedQuery}
										size="sm"
										variant="ghost"
									>
										Clear
									</Button>
								)}
							</div>

							{hasAdvancedQuery() && filters.advancedQuery ? (
								<div className="mb-3">
									<div className="mb-2 flex items-center gap-2">
										<Badge className="font-mono" variant="default">
											{countConditions(filters.advancedQuery)} condition
											{countConditions(filters.advancedQuery) !== 1 ? "s" : ""}
										</Badge>
										<span className="font-mono text-muted-foreground text-xs">
											{filters.advancedQuery.groups.length} group
											{filters.advancedQuery.groups.length !== 1 ? "s" : ""} (
											{filters.advancedQuery.logic})
										</span>
									</div>
									<p className="font-mono text-muted-foreground text-xs">
										Advanced query is active. Simple filters below are disabled.
									</p>
								</div>
							) : (
								<p className="mb-3 font-mono text-muted-foreground text-xs">
									Build complex filters with AND/OR logic between groups of
									conditions.
								</p>
							)}

							<Button
								className="w-full font-mono text-xs"
								onClick={() => setQueryBuilderOpen(true)}
								size="sm"
								variant={hasAdvancedQuery() ? "default" : "outline"}
							>
								<Sparkles className="mr-2 size-3" />
								{hasAdvancedQuery() ? "Edit Query" : "Open Query Builder"}
							</Button>
						</div>

						<Separator />

						{/* Simple filters - disabled when advanced query is active */}
						<div
							className={
								hasAdvancedQuery() ? "pointer-events-none opacity-50" : ""
							}
						>
							{/* Symbol Filter */}
							<FilterSection title="Symbols">
								{isLoading ? (
									<p className="font-mono text-muted-foreground text-xs">
										Loading...
									</p>
								) : (
									<MultiSelectFilter
										onChange={(s) => updateLocal("symbols", s)}
										options={symbolOptions}
										selected={localFilters.symbols}
									/>
								)}
							</FilterSection>

							<Separator />

							{/* Date Range */}
							<FilterSection title="Date Range">
								<DateRangeInput
									endDate={localFilters.dateRange.end}
									onEndChange={(date) =>
										updateLocal("dateRange", {
											...localFilters.dateRange,
											end: date,
										})
									}
									onStartChange={(date) =>
										updateLocal("dateRange", {
											...localFilters.dateRange,
											start: date,
										})
									}
									startDate={localFilters.dateRange.start}
								/>
							</FilterSection>

							<Separator />

							{/* Day of Week */}
							<FilterSection title="Day of Week">
								<CheckboxGroup
									onChange={(days) =>
										updateLocal("daysOfWeek", days as number[])
									}
									options={[...DAYS_OF_WEEK]}
									selected={localFilters.daysOfWeek}
								/>
							</FilterSection>

							<Separator />

							{/* Hour of Day */}
							<FilterSection title="Hour of Day">
								<CheckboxGroup
									onChange={(hours) => updateLocal("hours", hours as number[])}
									options={[...KEY_HOURS]}
									selected={localFilters.hours}
								/>
							</FilterSection>

							<Separator />

							{/* Sessions */}
							<FilterSection title="Trading Sessions">
								{sessions.length === 0 ? (
									<p className="font-mono text-muted-foreground text-xs">
										No sessions configured
									</p>
								) : (
									<MultiSelectFilter
										onChange={(s) => updateLocal("sessions", s)}
										options={sessions}
										selected={localFilters.sessions}
									/>
								)}
							</FilterSection>

							<Separator />

							{/* Strategies */}
							<FilterSection title="Strategies">
								{isLoading ? (
									<p className="font-mono text-muted-foreground text-xs">
										Loading...
									</p>
								) : strategies.length === 0 ? (
									<p className="font-mono text-muted-foreground text-xs">
										No strategies created
									</p>
								) : (
									<MultiSelectFilter
										onChange={(s) => updateLocal("strategies", s)}
										options={strategies}
										renderOption={(option) => (
											<>
												{option.color && (
													<span
														className="inline-block size-2 rounded-full"
														style={{ backgroundColor: option.color }}
													/>
												)}
												{option.name}
											</>
										)}
										selected={localFilters.strategies}
									/>
								)}
							</FilterSection>

							<Separator />

							{/* Tags */}
							<FilterSection title="Tags">
								{isLoading ? (
									<p className="font-mono text-muted-foreground text-xs">
										Loading...
									</p>
								) : tags.length === 0 ? (
									<p className="font-mono text-muted-foreground text-xs">
										No tags created
									</p>
								) : (
									<MultiSelectFilter
										onChange={(t) => updateLocal("tags", t)}
										options={tags}
										renderOption={(option) => (
											<Badge
												className="border-0 px-0"
												style={{ color: option.color }}
												variant="outline"
											>
												{option.name}
											</Badge>
										)}
										selected={localFilters.tags}
									/>
								)}
							</FilterSection>

							<Separator />

							{/* R-Multiple Range */}
							<FilterSection title="R-Multiple Range">
								<RangeInput
									maxValue={localFilters.rMultipleRange.max}
									minValue={localFilters.rMultipleRange.min}
									onMaxChange={(max) =>
										updateLocal("rMultipleRange", {
											...localFilters.rMultipleRange,
											max,
										})
									}
									onMinChange={(min) =>
										updateLocal("rMultipleRange", {
											...localFilters.rMultipleRange,
											min,
										})
									}
									placeholder={{ min: "Min R", max: "Max R" }}
									step={0.5}
								/>
							</FilterSection>

							<Separator />

							{/* Position Size Range */}
							<FilterSection title="Position Size Range">
								<RangeInput
									maxValue={localFilters.positionSizeRange.max}
									minValue={localFilters.positionSizeRange.min}
									onMaxChange={(max) =>
										updateLocal("positionSizeRange", {
											...localFilters.positionSizeRange,
											max,
										})
									}
									onMinChange={(min) =>
										updateLocal("positionSizeRange", {
											...localFilters.positionSizeRange,
											min,
										})
									}
									placeholder={{ min: "Min size", max: "Max size" }}
									step={1}
								/>
							</FilterSection>

							<Separator />

							{/* Outcome */}
							<FilterSection title="Trade Outcome">
								<RadioGroup
									onChange={(v) => updateLocal("outcome", v as OutcomeFilter)}
									options={[...OUTCOME_OPTIONS]}
									value={localFilters.outcome}
								/>
							</FilterSection>

							<Separator />

							{/* Review Status */}
							<FilterSection title="Review Status">
								<RadioGroup
									onChange={(v) => updateLocal("reviewed", v as ReviewedFilter)}
									options={[...REVIEW_STATUS_OPTIONS]}
									value={localFilters.reviewed}
								/>
							</FilterSection>
						</div>
					</div>
				</ScrollArea>

				<SheetFooter className="border-border border-t pt-4">
					<div className="flex w-full flex-col gap-2">
						{/* Save as preset button */}
						<Button
							className="w-full font-mono text-xs"
							onClick={() => setSavePresetOpen(true)}
							size="sm"
							variant="outline"
						>
							<Save className="mr-2 size-3" />
							Save as preset
						</Button>

						{/* Action buttons */}
						<div className="flex gap-2">
							<Button
								className="flex-1 font-mono"
								onClick={() => onOpenChange(false)}
								variant="outline"
							>
								Cancel
							</Button>
							<Button className="flex-1 font-mono" onClick={handleApply}>
								Apply Filters
							</Button>
						</div>
					</div>
				</SheetFooter>
			</SheetContent>

			{/* Query Builder Modal */}
			<QueryBuilder
				onApply={handleQueryApply}
				onOpenChange={setQueryBuilderOpen}
				open={queryBuilderOpen}
				query={filters.advancedQuery ?? DEFAULT_QUERY_STATE}
				sessions={sessions}
				strategies={strategies}
				symbols={symbols}
				tags={tags}
			/>

			{/* Save Preset Dialog */}
			<SavePresetDialog
				onOpenChange={setSavePresetOpen}
				onSaved={handlePresetSaved}
				open={savePresetOpen}
			/>
		</Sheet>
	);
}
