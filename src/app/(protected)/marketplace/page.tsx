"use client";

import { Loader2, ShoppingCart, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { SearchBar } from "@/components/marketplace/search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ALL_INSTRUMENTS,
	MARKETPLACE_SORT_OPTIONS,
	STRATEGY_CATEGORIES,
} from "@/lib/constants";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface MarketplaceFilters {
	search: string;
	instrument: string | null;
	category: string | null;
	sort: string;
}

// =============================================================================
// FILTER CHIPS COMPONENT
// =============================================================================

interface ActiveFilter {
	key: keyof MarketplaceFilters;
	value: string;
	label: string;
}

function FilterChips({
	filters,
	onClear,
}: {
	filters: MarketplaceFilters;
	onClear: (key: keyof MarketplaceFilters) => void;
}) {
	const activeFilters: ActiveFilter[] = [];

	if (filters.search) {
		activeFilters.push({
			key: "search",
			value: filters.search,
			label: `Search: "${filters.search}"`,
		});
	}

	if (filters.instrument) {
		const instrument = ALL_INSTRUMENTS.find(
			(i) => i.value === filters.instrument,
		);
		activeFilters.push({
			key: "instrument",
			value: filters.instrument,
			label: `Instrument: ${instrument?.label ?? filters.instrument}`,
		});
	}

	if (filters.category) {
		const category = STRATEGY_CATEGORIES.find(
			(c) => c.value === filters.category,
		);
		activeFilters.push({
			key: "category",
			value: filters.category,
			label: `Category: ${category?.label ?? filters.category}`,
		});
	}

	if (activeFilters.length === 0) return null;

	return (
		<div
			className="flex flex-wrap items-center gap-2"
			data-testid="marketplace-active-filters"
		>
			{activeFilters.map((filter) => (
				<Badge
					className="flex items-center gap-1 bg-muted px-2 py-1 font-mono text-xs"
					key={filter.key}
					variant="outline"
				>
					{filter.label}
					<button
						className="ml-1 rounded hover:bg-white/10"
						data-testid={`marketplace-filter-clear-${filter.key}`}
						onClick={() => onClear(filter.key)}
						type="button"
					>
						<XIcon className="h-3 w-3" />
					</button>
				</Badge>
			))}
		</div>
	);
}

// =============================================================================
// FILTERS ROW COMPONENT
// =============================================================================

function MarketplaceFiltersRow({
	filters,
	onFilterChange,
}: {
	filters: MarketplaceFilters;
	onFilterChange: <K extends keyof MarketplaceFilters>(
		key: K,
		value: MarketplaceFilters[K],
	) => void;
}) {
	return (
		<div
			className="flex flex-col gap-3 sm:flex-row sm:items-center"
			data-testid="marketplace-filters"
		>
			{/* Instrument filter */}
			<Select
				onValueChange={(v) =>
					onFilterChange("instrument", v === "all" ? null : v)
				}
				value={filters.instrument ?? "all"}
			>
				<SelectTrigger
					className="w-full font-mono text-xs sm:w-44"
					data-testid="marketplace-filter-instrument"
				>
					<SelectValue placeholder="Instrument" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Instruments</SelectItem>
					{ALL_INSTRUMENTS.map((instrument) => (
						<SelectItem key={instrument.value} value={instrument.value}>
							{instrument.symbol} - {instrument.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Category filter */}
			<Select
				onValueChange={(v) =>
					onFilterChange("category", v === "all" ? null : v)
				}
				value={filters.category ?? "all"}
			>
				<SelectTrigger
					className="w-full font-mono text-xs sm:w-44"
					data-testid="marketplace-filter-category"
				>
					<SelectValue placeholder="Category" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Categories</SelectItem>
					{STRATEGY_CATEGORIES.map((category) => (
						<SelectItem key={category.value} value={category.value}>
							{category.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Sort dropdown */}
			<Select
				onValueChange={(v) => onFilterChange("sort", v)}
				value={filters.sort}
			>
				<SelectTrigger
					className="w-full font-mono text-xs sm:w-40"
					data-testid="marketplace-filter-sort"
				>
					<SelectValue placeholder="Sort by" />
				</SelectTrigger>
				<SelectContent>
					{MARKETPLACE_SORT_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

// =============================================================================
// STRATEGY CARD SKELETON
// =============================================================================

function StrategyCardSkeleton() {
	return (
		<div className="space-y-3 rounded-lg border border-border bg-card p-4">
			{/* Cover image skeleton */}
			<Skeleton className="aspect-video w-full rounded" />

			{/* Title and description */}
			<div className="space-y-2">
				<Skeleton className="h-5 w-3/4" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>

			{/* Stats row */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-20" />
			</div>

			{/* Author */}
			<div className="flex items-center gap-2 border-border border-t pt-3">
				<Skeleton className="h-6 w-6 rounded-full" />
				<Skeleton className="h-4 w-24" />
			</div>
		</div>
	);
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<div
			className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/50 py-16"
			data-testid="marketplace-empty"
		>
			<ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground/50" />
			<h3 className="font-mono text-lg">
				{hasFilters ? "No strategies found" : "No strategies available yet"}
			</h3>
			<p className="mt-2 max-w-sm text-center font-mono text-muted-foreground text-sm">
				{hasFilters
					? "Try adjusting your filters or search term to find what you're looking for."
					: "Be the first to publish your trading strategy to the marketplace!"}
			</p>
		</div>
	);
}

// =============================================================================
// MAIN PAGE CONTENT
// =============================================================================

function MarketplaceContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Initialize filters from URL params
	const [filters, setFilters] = useState<MarketplaceFilters>({
		search: searchParams.get("q") ?? "",
		instrument: searchParams.get("instrument"),
		category: searchParams.get("category"),
		sort: searchParams.get("sort") ?? "votes",
	});

	// Track loading state (mock - real implementation will use tRPC query)
	const [isLoading, setIsLoading] = useState(true);
	const [strategies, setStrategies] = useState<unknown[]>([]);

	// Mock loading - real implementation will use api.marketplace.search.useQuery
	useEffect(() => {
		setIsLoading(true);
		const timer = setTimeout(() => {
			// Mock empty results - real API will be implemented in future stories
			setStrategies([]);
			setIsLoading(false);
		}, 500);

		return () => clearTimeout(timer);
	}, []);

	// Update URL when filters change
	const updateUrl = useCallback(
		(newFilters: MarketplaceFilters) => {
			const params = new URLSearchParams();

			if (newFilters.search) {
				params.set("q", newFilters.search);
			}
			if (newFilters.instrument) {
				params.set("instrument", newFilters.instrument);
			}
			if (newFilters.category) {
				params.set("category", newFilters.category);
			}
			if (newFilters.sort !== "votes") {
				params.set("sort", newFilters.sort);
			}

			const queryString = params.toString();
			router.push(queryString ? `?${queryString}` : "/marketplace", {
				scroll: false,
			});
		},
		[router],
	);

	// Handle filter changes
	const handleFilterChange = useCallback(
		<K extends keyof MarketplaceFilters>(
			key: K,
			value: MarketplaceFilters[K],
		) => {
			const newFilters = { ...filters, [key]: value };
			setFilters(newFilters);
			updateUrl(newFilters);
		},
		[filters, updateUrl],
	);

	// Handle filter clear
	const handleClearFilter = useCallback(
		(key: keyof MarketplaceFilters) => {
			const newFilters = {
				...filters,
				[key]: key === "sort" ? "votes" : key === "search" ? "" : null,
			};
			setFilters(newFilters);
			updateUrl(newFilters);
		},
		[filters, updateUrl],
	);

	const hasFilters =
		!!filters.search || !!filters.instrument || !!filters.category;

	return (
		<div
			className="mx-auto w-[95%] max-w-none space-y-6 py-4 sm:py-6"
			data-testid="marketplace-page"
		>
			{/* Header */}
			<div className="text-center" data-testid="marketplace-header">
				<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
					Strategy Marketplace
				</h1>
				<p className="mt-2 font-mono text-muted-foreground text-sm">
					Discover and download trading strategies from the community
				</p>
			</div>

			{/* Search Bar (centered, prominent) */}
			<div className="mx-auto flex justify-center">
				<SearchBar
					onChange={(v) => handleFilterChange("search", v)}
					value={filters.search}
				/>
			</div>

			{/* Filter Row */}
			<MarketplaceFiltersRow
				filters={filters}
				onFilterChange={handleFilterChange}
			/>

			{/* Active Filter Chips */}
			<FilterChips filters={filters} onClear={handleClearFilter} />

			{/* Results Count */}
			<div
				className="flex items-center justify-between"
				data-testid="marketplace-results-header"
			>
				<span className="font-mono text-muted-foreground text-sm">
					{isLoading ? (
						<span className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading...
						</span>
					) : (
						`Showing ${strategies.length} strategies`
					)}
				</span>
			</div>

			{/* Strategy Grid or Empty State */}
			{isLoading ? (
				<div
					className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
					data-testid="marketplace-loading"
				>
					{[...Array(6)].map((_, i) => (
						<StrategyCardSkeleton key={`skeleton-${i.toString()}`} />
					))}
				</div>
			) : strategies.length === 0 ? (
				<EmptyState hasFilters={hasFilters} />
			) : (
				<div
					className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
					data-testid="marketplace-grid"
				>
					{/* Strategy cards will be rendered here in future stories */}
				</div>
			)}

			{/* Load More Button (placeholder for future implementation) */}
			{!isLoading && strategies.length > 0 && (
				<div className="flex justify-center">
					<Button
						className={cn(
							"font-mono text-xs uppercase tracking-wider",
							"min-h-[44px] sm:min-h-0",
						)}
						data-testid="marketplace-load-more"
						variant="outline"
					>
						Load More
					</Button>
				</div>
			)}
		</div>
	);
}

// =============================================================================
// MAIN PAGE (with Suspense for useSearchParams)
// =============================================================================

export default function MarketplacePage() {
	return (
		<Suspense
			fallback={
				<div
					className="mx-auto w-[95%] max-w-none space-y-6 py-4 sm:py-6"
					data-testid="marketplace-page"
				>
					{/* Header skeleton */}
					<div className="text-center">
						<Skeleton className="mx-auto h-8 w-64" />
						<Skeleton className="mx-auto mt-2 h-4 w-96" />
					</div>

					{/* Search skeleton */}
					<div className="mx-auto flex justify-center">
						<Skeleton className="h-11 w-full max-w-xl" />
					</div>

					{/* Filter skeleton */}
					<div className="flex flex-col gap-3 sm:flex-row">
						<Skeleton className="h-10 w-44" />
						<Skeleton className="h-10 w-44" />
						<Skeleton className="h-10 w-40" />
					</div>

					{/* Grid skeleton */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{[...Array(6)].map((_, i) => (
							<StrategyCardSkeleton key={`skeleton-${i.toString()}`} />
						))}
					</div>
				</div>
			}
		>
			<MarketplaceContent />
		</Suspense>
	);
}
