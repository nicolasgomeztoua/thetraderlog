"use client";

import { Loader2, Store, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
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
// PLACEHOLDER STRATEGY CARD (will be replaced in US-028)
// =============================================================================

interface MarketplaceStrategy {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	coverImageUrl: string | null;
	instruments: string[] | null;
	categoryTags: string[] | null;
	creator: {
		id: string;
		name: string | null;
		imageUrl: string | null;
	} | null;
	stats: {
		totalTrades: number;
		winRate: number;
		profitFactor: number | null;
	} | null;
	trackRecordStatus: "limited" | "normal" | "verified";
	engagement: {
		voteScore: number;
		downloadCount: number;
	};
	hasVoted: number | null;
}

function PlaceholderStrategyCard({
	strategy,
}: {
	strategy: MarketplaceStrategy;
}) {
	return (
		<a
			className="group block overflow-hidden rounded border border-border bg-card transition-all hover:border-primary/30"
			data-testid={`marketplace-strategy-card-${strategy.id}`}
			href={`/marketplace/${strategy.id}`}
		>
			{/* Cover image or gradient placeholder */}
			<div
				className="relative aspect-[3/1] w-full overflow-hidden"
				style={{
					background: strategy.coverImageUrl
						? undefined
						: `linear-gradient(135deg, ${strategy.color ?? "#d4ff00"}20 0%, ${strategy.color ?? "#d4ff00"}05 50%, transparent 100%)`,
				}}
			>
				{strategy.coverImageUrl && (
					<Image
						alt={strategy.name}
						className="h-full w-full object-cover transition-transform group-hover:scale-105"
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						src={strategy.coverImageUrl}
					/>
				)}
				{/* Track record badge */}
				{strategy.trackRecordStatus === "verified" && (
					<div className="absolute top-2 right-2 rounded bg-profit/20 px-2 py-0.5 font-mono text-[10px] text-profit uppercase">
						Verified
					</div>
				)}
				{strategy.trackRecordStatus === "limited" && (
					<div className="absolute top-2 right-2 rounded bg-yellow-500/20 px-2 py-0.5 font-mono text-[10px] text-yellow-500 uppercase">
						Limited Data
					</div>
				)}
			</div>

			{/* Content */}
			<div className="p-4">
				<h3 className="mb-1 truncate font-medium font-mono text-sm">
					{strategy.name}
				</h3>
				{strategy.description && (
					<p className="mb-3 line-clamp-2 font-mono text-muted-foreground text-xs">
						{strategy.description}
					</p>
				)}

				{/* Creator */}
				<div className="mb-3 flex items-center gap-2">
					{strategy.creator ? (
						<>
							{strategy.creator.imageUrl ? (
								<Image
									alt={strategy.creator.name ?? "Creator"}
									className="rounded-full"
									height={20}
									src={strategy.creator.imageUrl}
									width={20}
								/>
							) : (
								<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
									<span className="font-mono text-[10px] text-primary">
										{strategy.creator.name?.charAt(0).toUpperCase() ?? "?"}
									</span>
								</div>
							)}
							<span className="font-mono text-muted-foreground text-xs">
								{strategy.creator.name ?? "Anonymous"}
							</span>
						</>
					) : (
						<span className="font-mono text-muted-foreground text-xs italic">
							Anonymous
						</span>
					)}
				</div>

				{/* Stats row */}
				{strategy.stats && (
					<div className="mb-3 flex items-center gap-4 font-mono text-xs">
						<span>
							<span className="text-muted-foreground">Win: </span>
							<span
								className={
									strategy.stats.winRate >= 50 ? "text-profit" : "text-loss"
								}
							>
								{strategy.stats.winRate.toFixed(1)}%
							</span>
						</span>
						<span>
							<span className="text-muted-foreground">PF: </span>
							<span
								className={
									(strategy.stats.profitFactor ?? 0) >= 1
										? "text-profit"
										: "text-loss"
								}
							>
								{strategy.stats.profitFactor === null
									? "N/A"
									: strategy.stats.profitFactor.toFixed(2)}
							</span>
						</span>
						<span className="text-muted-foreground">
							{strategy.stats.totalTrades} trades
						</span>
					</div>
				)}

				{/* Engagement row */}
				<div className="flex items-center justify-between border-border border-t pt-3">
					<div className="flex items-center gap-3 font-mono text-xs">
						<span className="flex items-center gap-1 text-muted-foreground">
							<TrendingUp className="h-3 w-3" />
							{strategy.engagement.voteScore}
						</span>
						<span className="text-muted-foreground">
							{strategy.engagement.downloadCount} downloads
						</span>
					</div>
					{/* Instruments badges */}
					{strategy.instruments && strategy.instruments.length > 0 && (
						<div className="flex items-center gap-1">
							{strategy.instruments.slice(0, 2).map((instrument) => (
								<span
									className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
									key={instrument}
								>
									{instrument}
								</span>
							))}
							{strategy.instruments.length > 2 && (
								<span className="font-mono text-[10px] text-muted-foreground">
									+{strategy.instruments.length - 2}
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</a>
	);
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function MarketplacePage() {
	// Fetch marketplace strategies with infinite scroll
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		api.marketplace.list.useInfiniteQuery(
			{
				limit: 20,
				sort: "votes",
			},
			{
				getNextPageParam: (lastPage) => lastPage?.nextCursor,
			},
		);

	// Flatten all pages into a single array
	const strategies = useMemo(() => {
		return data?.pages.flatMap((page) => page.items) ?? [];
	}, [data]);

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

			{/* Filter Bar placeholder - will be added in US-027 */}
			<div
				className="flex items-center justify-between"
				data-testid="marketplace-filter-placeholder"
			>
				<span className="font-mono text-muted-foreground text-xs">
					{strategies.length > 0 &&
						`${strategies.length} ${strategies.length === 1 ? "strategy" : "strategies"}`}
				</span>
			</div>

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
							<PlaceholderStrategyCard
								key={strategy.id}
								strategy={strategy as MarketplaceStrategy}
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
