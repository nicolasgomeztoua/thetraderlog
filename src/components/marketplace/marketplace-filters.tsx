"use client";

import { Check, ChevronDown, Filter, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	MARKETPLACE_SORT_OPTIONS,
	STRATEGY_CATEGORIES,
	TRADEABLE_INSTRUMENTS,
} from "@/lib/constants";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceFilterValues {
	instruments: string[];
	categories: string[];
	sort: string;
}

interface MarketplaceFiltersProps {
	/** Current filter values */
	values: MarketplaceFilterValues;
	/** Callback when filter values change */
	onChange: (values: MarketplaceFilterValues) => void;
	/** Additional class names */
	className?: string;
}

// =============================================================================
// INSTRUMENTS FILTER
// =============================================================================

function InstrumentsFilter({
	selected,
	onChange,
}: {
	selected: string[];
	onChange: (values: string[]) => void;
}) {
	const toggleInstrument = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	const clearAll = () => onChange([]);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					className="h-10 gap-2 font-mono text-xs"
					data-testid="marketplace-filter-instruments-trigger"
					variant="outline"
				>
					<Filter className="h-3.5 w-3.5" />
					Instruments
					{selected.length > 0 && (
						<Badge
							className="h-5 min-w-5 px-1.5 font-mono text-[10px]"
							variant="default"
						>
							{selected.length}
						</Badge>
					)}
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-72 p-0"
				data-testid="marketplace-filter-instruments-content"
			>
				{/* Header with Clear button */}
				<div className="flex items-center justify-between border-border border-b px-3 py-2">
					<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Instruments
					</span>
					{selected.length > 0 && (
						<Button
							className="h-6 px-2 font-mono text-xs"
							data-testid="marketplace-filter-instruments-clear"
							onClick={clearAll}
							variant="ghost"
						>
							Clear
						</Button>
					)}
				</div>

				{/* Scrollable instrument list */}
				<ScrollArea className="h-[300px]">
					<div className="space-y-4 p-3">
						{/* Futures */}
						<div className="space-y-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Futures
							</span>
							<div className="space-y-1">
								{TRADEABLE_INSTRUMENTS.futures.map((instrument) => (
									<div
										className="flex items-center gap-2"
										key={instrument.value}
									>
										<Checkbox
											checked={selected.includes(instrument.value)}
											data-testid={`marketplace-filter-instrument-${instrument.value}`}
											id={`instrument-${instrument.value}`}
											onCheckedChange={() => toggleInstrument(instrument.value)}
										/>
										<Label
											className="cursor-pointer font-mono text-xs"
											htmlFor={`instrument-${instrument.value}`}
										>
											{instrument.symbol} - {instrument.label}
										</Label>
									</div>
								))}
							</div>
						</div>

						{/* Forex */}
						<div className="space-y-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Forex
							</span>
							<div className="space-y-1">
								{TRADEABLE_INSTRUMENTS.forex.map((instrument) => (
									<div
										className="flex items-center gap-2"
										key={instrument.value}
									>
										<Checkbox
											checked={selected.includes(instrument.value)}
											data-testid={`marketplace-filter-instrument-${instrument.value}`}
											id={`instrument-${instrument.value}`}
											onCheckedChange={() => toggleInstrument(instrument.value)}
										/>
										<Label
											className="cursor-pointer font-mono text-xs"
											htmlFor={`instrument-${instrument.value}`}
										>
											{instrument.symbol}
										</Label>
									</div>
								))}
							</div>
						</div>

						{/* Crypto */}
						<div className="space-y-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Crypto
							</span>
							<div className="space-y-1">
								{TRADEABLE_INSTRUMENTS.crypto.map((instrument) => (
									<div
										className="flex items-center gap-2"
										key={instrument.value}
									>
										<Checkbox
											checked={selected.includes(instrument.value)}
											data-testid={`marketplace-filter-instrument-${instrument.value}`}
											id={`instrument-${instrument.value}`}
											onCheckedChange={() => toggleInstrument(instrument.value)}
										/>
										<Label
											className="cursor-pointer font-mono text-xs"
											htmlFor={`instrument-${instrument.value}`}
										>
											{instrument.symbol}
										</Label>
									</div>
								))}
							</div>
						</div>
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}

// =============================================================================
// CATEGORIES FILTER
// =============================================================================

function CategoriesFilter({
	selected,
	onChange,
}: {
	selected: string[];
	onChange: (values: string[]) => void;
}) {
	const toggleCategory = (value: string) => {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	const clearAll = () => onChange([]);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					className="h-10 gap-2 font-mono text-xs"
					data-testid="marketplace-filter-categories-trigger"
					variant="outline"
				>
					Categories
					{selected.length > 0 && (
						<Badge
							className="h-5 min-w-5 px-1.5 font-mono text-[10px]"
							variant="default"
						>
							{selected.length}
						</Badge>
					)}
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-56 p-0"
				data-testid="marketplace-filter-categories-content"
			>
				{/* Header with Clear button */}
				<div className="flex items-center justify-between border-border border-b px-3 py-2">
					<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Categories
					</span>
					{selected.length > 0 && (
						<Button
							className="h-6 px-2 font-mono text-xs"
							data-testid="marketplace-filter-categories-clear"
							onClick={clearAll}
							variant="ghost"
						>
							Clear
						</Button>
					)}
				</div>

				{/* Category list */}
				<div className="space-y-1 p-3">
					{STRATEGY_CATEGORIES.map((category) => (
						<div className="flex items-center gap-2" key={category.value}>
							<Checkbox
								checked={selected.includes(category.value)}
								data-testid={`marketplace-filter-category-${category.value}`}
								id={`category-${category.value}`}
								onCheckedChange={() => toggleCategory(category.value)}
							/>
							<Label
								className="cursor-pointer font-mono text-xs"
								htmlFor={`category-${category.value}`}
							>
								{category.label}
							</Label>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// =============================================================================
// SORT FILTER
// =============================================================================

function SortFilter({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const currentSort = MARKETPLACE_SORT_OPTIONS.find((o) => o.value === value);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					className="h-10 gap-2 font-mono text-xs"
					data-testid="marketplace-filter-sort-trigger"
					variant="outline"
				>
					Sort: {currentSort?.label ?? "Most Votes"}
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-48 p-0"
				data-testid="marketplace-filter-sort-content"
			>
				{/* Sort options as radio-style buttons */}
				<div className="p-1">
					{MARKETPLACE_SORT_OPTIONS.map((option) => (
						<button
							className={cn(
								"flex w-full items-center gap-2 rounded px-3 py-2 font-mono text-xs transition-colors",
								value === option.value
									? "bg-primary/10 text-primary"
									: "text-foreground hover:bg-muted",
							)}
							data-testid={`marketplace-filter-sort-${option.value}`}
							key={option.value}
							onClick={() => onChange(option.value)}
							type="button"
						>
							{value === option.value && <Check className="h-3 w-3" />}
							<span className={value === option.value ? "" : "pl-5"}>
								{option.label}
							</span>
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Marketplace filter components for narrowing down strategy search.
 *
 * Features:
 * - Instruments multi-select: grouped by category (Futures, Forex, Crypto)
 * - Categories multi-select: checkbox for each strategy category
 * - Sort single-select: radio-style options
 * - 'Clear all filters' button when any filter is active
 * - Terminal design styling
 *
 * Props:
 * - values: Current filter values (instruments[], categories[], sort)
 * - onChange: Callback when filter values change
 * - className: Optional additional CSS classes
 */
export function MarketplaceFilters({
	values,
	onChange,
	className,
}: MarketplaceFiltersProps) {
	const hasActiveFilters =
		values.instruments.length > 0 || values.categories.length > 0;

	const clearAllFilters = () => {
		onChange({
			...values,
			instruments: [],
			categories: [],
		});
	};

	return (
		<div
			className={cn("flex flex-wrap items-center gap-3", className)}
			data-testid="marketplace-filters"
		>
			{/* Instruments filter */}
			<InstrumentsFilter
				onChange={(instruments) => onChange({ ...values, instruments })}
				selected={values.instruments}
			/>

			{/* Categories filter */}
			<CategoriesFilter
				onChange={(categories) => onChange({ ...values, categories })}
				selected={values.categories}
			/>

			{/* Sort filter */}
			<SortFilter
				onChange={(sort) => onChange({ ...values, sort })}
				value={values.sort}
			/>

			{/* Clear all filters button */}
			{hasActiveFilters && (
				<Button
					className="h-10 gap-1 font-mono text-muted-foreground text-xs"
					data-testid="marketplace-filters-clear-all"
					onClick={clearAllFilters}
					variant="ghost"
				>
					<XIcon className="h-3 w-3" />
					Clear filters
				</Button>
			)}
		</div>
	);
}
