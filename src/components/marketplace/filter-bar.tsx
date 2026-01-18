"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	MARKETPLACE_SORT_OPTIONS,
	type MarketplaceSortOption,
	STRATEGY_CATEGORIES,
	STRATEGY_INSTRUMENTS,
} from "@/lib/constants";
import { cn } from "@/lib/shared";

// Sort option display labels
const SORT_LABELS: Record<MarketplaceSortOption, string> = {
	votes: "Most Voted",
	downloads: "Most Downloaded",
	recent: "Most Recent",
};

export interface MarketplaceFilters {
	search: string;
	instruments: string[];
	categories: string[];
	sort: MarketplaceSortOption;
}

export const DEFAULT_MARKETPLACE_FILTERS: MarketplaceFilters = {
	search: "",
	instruments: [],
	categories: [],
	sort: "votes",
};

interface FilterBarProps {
	filters: MarketplaceFilters;
	onChange: (filters: MarketplaceFilters) => void;
	totalCount?: number;
}

export function FilterBar({ filters, onChange, totalCount }: FilterBarProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Local state for debounced search
	const [searchInput, setSearchInput] = useState(filters.search);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const initializedRef = useRef(false);

	// Popover state
	const [instrumentsOpen, setInstrumentsOpen] = useState(false);
	const [categoriesOpen, setCategoriesOpen] = useState(false);

	// Sync URL params to filter state on mount (once)
	useEffect(() => {
		// Skip if already initialized
		if (initializedRef.current) return;
		initializedRef.current = true;

		const search = searchParams.get("search") ?? "";
		const instruments =
			searchParams.get("instruments")?.split(",").filter(Boolean) ?? [];
		const categories =
			searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
		const sortParam = searchParams.get("sort") as MarketplaceSortOption | null;
		const sort =
			sortParam && MARKETPLACE_SORT_OPTIONS.includes(sortParam)
				? sortParam
				: "votes";

		// Only update if URL has filter params
		if (
			search ||
			instruments.length > 0 ||
			categories.length > 0 ||
			sortParam
		) {
			onChange({
				search,
				instruments,
				categories,
				sort,
			});
			setSearchInput(search);
		}
	}, [searchParams, onChange]);

	// Update URL when filters change
	const updateURL = useCallback(
		(newFilters: MarketplaceFilters) => {
			const params = new URLSearchParams();

			if (newFilters.search) {
				params.set("search", newFilters.search);
			}
			if (newFilters.instruments.length > 0) {
				params.set("instruments", newFilters.instruments.join(","));
			}
			if (newFilters.categories.length > 0) {
				params.set("categories", newFilters.categories.join(","));
			}
			if (newFilters.sort !== "votes") {
				params.set("sort", newFilters.sort);
			}

			const queryString = params.toString();
			router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
				scroll: false,
			});
		},
		[pathname, router],
	);

	// Debounced search handler
	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchInput(value);

			// Clear existing timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Debounce the actual filter update
			debounceTimerRef.current = setTimeout(() => {
				const newFilters = { ...filters, search: value };
				onChange(newFilters);
				updateURL(newFilters);
			}, 300);
		},
		[filters, onChange, updateURL],
	);

	// Cleanup debounce timer on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	// Handle filter changes (immediate, no debounce)
	const handleFilterChange = useCallback(
		(newFilters: MarketplaceFilters) => {
			onChange(newFilters);
			updateURL(newFilters);
		},
		[onChange, updateURL],
	);

	// Toggle selection in array
	const toggleSelection = (
		item: string,
		current: string[],
		key: "instruments" | "categories",
	) => {
		const newSelection = current.includes(item)
			? current.filter((i) => i !== item)
			: [...current, item];
		handleFilterChange({ ...filters, [key]: newSelection });
	};

	// Calculate active filter count
	const activeFilterCount =
		(filters.search ? 1 : 0) +
		(filters.instruments.length > 0 ? 1 : 0) +
		(filters.categories.length > 0 ? 1 : 0);

	// Clear all filters
	const handleClearFilters = useCallback(() => {
		const clearedFilters = {
			...DEFAULT_MARKETPLACE_FILTERS,
			sort: filters.sort, // Keep sort preference
		};
		setSearchInput("");
		onChange(clearedFilters);
		router.replace(pathname, { scroll: false });
	}, [filters.sort, onChange, pathname, router]);

	return (
		<div
			className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
			data-testid="marketplace-filter-bar"
		>
			{/* Left side: Search and Filters */}
			<div className="flex flex-1 flex-wrap items-center gap-2">
				{/* Search Input */}
				<div className="relative w-full sm:w-64">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						className="h-9 pr-8 pl-9 font-mono text-sm"
						data-testid="marketplace-filter-search"
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder="Search strategies..."
						value={searchInput}
					/>
					{searchInput && (
						<button
							className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
							data-testid="marketplace-filter-search-clear"
							onClick={() => handleSearchChange("")}
							type="button"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Instruments Filter */}
				<Popover onOpenChange={setInstrumentsOpen} open={instrumentsOpen}>
					<PopoverTrigger asChild>
						<Button
							className={cn(
								"h-9 gap-1.5 font-mono text-xs transition-colors",
								filters.instruments.length > 0 &&
									"border-primary/30 bg-primary/5",
							)}
							data-testid="marketplace-filter-instruments"
							variant="outline"
						>
							<SlidersHorizontal className="h-3.5 w-3.5" />
							Instruments
							{filters.instruments.length > 0 && (
								<span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
									{filters.instruments.length}
								</span>
							)}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-56 p-2">
						<div className="mb-2 border-border border-b pb-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Filter by Instrument
							</span>
						</div>
						<div className="grid max-h-64 gap-0.5 overflow-y-auto">
							{STRATEGY_INSTRUMENTS.map((inst) => (
								<button
									className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
									data-testid={`marketplace-filter-instrument-${inst.replace("/", "-")}`}
									key={inst}
									onClick={() =>
										toggleSelection(inst, filters.instruments, "instruments")
									}
									type="button"
								>
									<Checkbox
										checked={filters.instruments.includes(inst)}
										className="pointer-events-none"
									/>
									<span>{inst}</span>
								</button>
							))}
						</div>
						{filters.instruments.length > 0 && (
							<div className="mt-2 border-border border-t pt-2">
								<Button
									className="h-7 w-full font-mono text-xs"
									onClick={() =>
										handleFilterChange({ ...filters, instruments: [] })
									}
									size="sm"
									variant="ghost"
								>
									Clear Selection
								</Button>
							</div>
						)}
					</PopoverContent>
				</Popover>

				{/* Categories Filter */}
				<Popover onOpenChange={setCategoriesOpen} open={categoriesOpen}>
					<PopoverTrigger asChild>
						<Button
							className={cn(
								"h-9 gap-1.5 font-mono text-xs transition-colors",
								filters.categories.length > 0 &&
									"border-primary/30 bg-primary/5",
							)}
							data-testid="marketplace-filter-categories"
							variant="outline"
						>
							Categories
							{filters.categories.length > 0 && (
								<span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
									{filters.categories.length}
								</span>
							)}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-56 p-2">
						<div className="mb-2 border-border border-b pb-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Filter by Category
							</span>
						</div>
						<div className="grid max-h-64 gap-0.5 overflow-y-auto">
							{STRATEGY_CATEGORIES.map((cat) => (
								<button
									className="flex items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm hover:bg-white/5"
									data-testid={`marketplace-filter-category-${cat.replace(/ /g, "-").replace("/", "-")}`}
									key={cat}
									onClick={() =>
										toggleSelection(cat, filters.categories, "categories")
									}
									type="button"
								>
									<Checkbox
										checked={filters.categories.includes(cat)}
										className="pointer-events-none"
									/>
									<span>{cat}</span>
								</button>
							))}
						</div>
						{filters.categories.length > 0 && (
							<div className="mt-2 border-border border-t pt-2">
								<Button
									className="h-7 w-full font-mono text-xs"
									onClick={() =>
										handleFilterChange({ ...filters, categories: [] })
									}
									size="sm"
									variant="ghost"
								>
									Clear Selection
								</Button>
							</div>
						)}
					</PopoverContent>
				</Popover>

				{/* Clear Filters Button */}
				{activeFilterCount > 0 && (
					<Button
						className="h-9 gap-1 font-mono text-muted-foreground text-xs hover:text-foreground"
						data-testid="marketplace-filter-clear"
						onClick={handleClearFilters}
						variant="ghost"
					>
						<X className="h-3.5 w-3.5" />
						Clear ({activeFilterCount})
					</Button>
				)}
			</div>

			{/* Right side: Count and Sort */}
			<div className="flex items-center gap-3">
				{/* Results count */}
				{totalCount !== undefined && (
					<span
						className="font-mono text-muted-foreground text-xs"
						data-testid="marketplace-filter-count"
					>
						{totalCount} {totalCount === 1 ? "strategy" : "strategies"}
					</span>
				)}

				{/* Sort Dropdown */}
				<Select
					onValueChange={(value) =>
						handleFilterChange({
							...filters,
							sort: value as MarketplaceSortOption,
						})
					}
					value={filters.sort}
				>
					<SelectTrigger
						className="h-9 w-[150px] font-mono text-xs"
						data-testid="marketplace-filter-sort"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MARKETPLACE_SORT_OPTIONS.map((option) => (
							<SelectItem
								className="font-mono text-xs"
								data-testid={`marketplace-filter-sort-${option}`}
								key={option}
								value={option}
							>
								{SORT_LABELS[option]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
