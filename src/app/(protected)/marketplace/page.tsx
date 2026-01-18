"use client";

import { Loader2, Store } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import {
	DEFAULT_MARKETPLACE_FILTERS,
	FilterBar,
	type MarketplaceFilters,
	type MarketplaceStrategyData,
	StrategyCard,
} from "@/components/marketplace";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { api } from "@/trpc/react";

// =============================================================================
// LOADING SKELETON
// =============================================================================

function StrategyCardSkeleton() {
	return (
		<div className="overflow-hidden rounded border border-border bg-card">
			{/* Cover image skeleton */}
			<Skeleton className="aspect-[3/1] w-full" />
			{/* Content */}
			<div className="p-4">
				<Skeleton className="mb-2 h-5 w-3/4" />
				<Skeleton className="mb-4 h-4 w-full" />
				<div className="flex items-center justify-between">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
				</div>
			</div>
		</div>
	);
}

function LoadingSkeleton() {
	return (
		<div
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
			data-testid="marketplace-loading"
		>
			{[...Array(6)].map((_, i) => (
				<StrategyCardSkeleton key={`skeleton-${i.toString()}`} />
			))}
		</div>
	);
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
	return (
		<div
			className="flex flex-col items-center justify-center rounded border border-white/5 bg-white/2 px-4 py-16"
			data-testid="marketplace-empty"
		>
			<Store className="mb-4 h-12 w-12 text-muted-foreground/50" />
			<h2 className="font-semibold text-lg">No strategies yet</h2>
			<p className="mt-1 max-w-sm text-center font-mono text-muted-foreground text-xs">
				Be the first to share your trading strategy with the community. Publish
				your strategy from the strategy detail page.
			</p>
		</div>
	);
}

// =============================================================================
// MAIN PAGE CONTENT
// =============================================================================

function MarketplaceContent() {
	// Filter state
	const [filters, setFilters] = useState<MarketplaceFilters>(
		DEFAULT_MARKETPLACE_FILTERS,
	);

	// Fetch marketplace strategies with infinite scroll
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		api.marketplace.list.useInfiniteQuery(
			{
				limit: 20,
				sort: filters.sort,
				search: filters.search || undefined,
				instruments:
					filters.instruments.length > 0 ? filters.instruments : undefined,
				categories:
					filters.categories.length > 0 ? filters.categories : undefined,
			},
			{
				getNextPageParam: (lastPage) => lastPage?.nextCursor,
			},
		);

	// Flatten all pages into a single array and get currentUserId
	const strategies = useMemo(() => {
		return data?.pages.flatMap((page) => page.items) ?? [];
	}, [data]);

	// Get currentUserId from the first page (same across all pages)
	const currentUserId = data?.pages[0]?.currentUserId ?? null;

	// Infinite scroll hook
	const { sentinelRef } = useInfiniteScroll({
		onLoadMore: () => fetchNextPage(),
		hasMore: !!hasNextPage,
		isLoading: isFetchingNextPage,
	});

	return (
		<div
			className="mx-auto w-[95%] max-w-none space-y-6 py-4 sm:space-y-8 sm:py-6"
			data-testid="marketplace-page"
		>
			{/* Hero Section */}
			<div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 sm:p-8">
				{/* Gradient orbs */}
				<div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
				<div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

				{/* Content */}
				<div className="relative">
					<div className="mb-2 flex items-center gap-2">
						<Store className="h-5 w-5 text-primary" />
						<span className="font-mono text-primary text-xs uppercase tracking-wider">
							Community
						</span>
					</div>
					<h1
						className="mb-2 font-bold text-2xl tracking-tight sm:text-3xl"
						data-testid="marketplace-heading"
					>
						Strategy Marketplace
					</h1>
					<p className="max-w-2xl font-mono text-muted-foreground text-sm">
						Discover and download proven trading strategies shared by the
						community. Each strategy shows verified performance metrics based on
						real trades.
					</p>
				</div>
			</div>

			{/* Filter Bar */}
			<FilterBar
				filters={filters}
				onChange={setFilters}
				totalCount={strategies.length > 0 ? strategies.length : undefined}
			/>

			{/* Strategy Grid */}
			{isLoading ? (
				<LoadingSkeleton />
			) : strategies.length === 0 ? (
				<EmptyState />
			) : (
				<>
					<div
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
						data-testid="marketplace-grid"
					>
						{strategies.map((strategy) => (
							<StrategyCard
								currentUserId={currentUserId ?? undefined}
								key={strategy.id}
								strategy={strategy as MarketplaceStrategyData}
							/>
						))}
					</div>

					{/* Infinite scroll sentinel */}
					<div className="h-1" ref={sentinelRef} />

					{/* Loading indicator */}
					{isFetchingNextPage && (
						<div className="flex justify-center py-4">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{/* End of list indicator */}
					{!hasNextPage && strategies.length > 0 && (
						<div className="py-4 text-center font-mono text-muted-foreground text-xs">
							End of strategies
						</div>
					)}
				</>
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
				<div className="mx-auto w-[95%] max-w-none space-y-6 py-4 sm:space-y-8 sm:py-6">
					<Skeleton className="h-32 w-full rounded-lg" />
					<Skeleton className="h-10 w-full" />
					<LoadingSkeleton />
				</div>
			}
		>
			<MarketplaceContent />
		</Suspense>
	);
}
