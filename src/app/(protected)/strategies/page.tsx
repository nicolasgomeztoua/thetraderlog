"use client";

import { BookMarked, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StrategyCard } from "@/components/strategy";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/trpc/react";

// =============================================================================
// LOADING SKELETON
// =============================================================================

function StrategyCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-lg border border-white/5 bg-card">
			{/* Top color bar skeleton */}
			<Skeleton className="h-1 w-full" />
			<div className="p-4 sm:p-5">
				{/* Header */}
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-4 w-48" />
					</div>
					<Skeleton className="h-8 w-8" />
				</div>
				{/* Stats row */}
				<div className="flex items-end justify-between gap-4">
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-1">
							<Skeleton className="h-3 w-12" />
							<Skeleton className="h-6 w-8" />
						</div>
						<div className="space-y-1">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-6 w-12" />
						</div>
						<div className="space-y-1">
							<Skeleton className="h-3 w-8" />
							<Skeleton className="h-6 w-16" />
						</div>
					</div>
					{/* Mini chart skeleton */}
					<Skeleton className="h-12 w-[100px]" />
				</div>
				{/* Footer */}
				<div className="mt-4 border-border border-t pt-3">
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyState() {
	return (
		<div
			className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-card px-6 py-16 text-center"
			data-testid="strategies-empty-state"
		>
			<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
				<BookMarked className="h-8 w-8 text-primary" />
			</div>
			<h2 className="font-mono font-semibold text-lg">No strategies yet</h2>
			<p className="mt-2 max-w-md font-mono text-muted-foreground text-sm leading-relaxed">
				Create your first strategy to document your trading approach, define
				entry rules, and track rule compliance across your trades.
			</p>
			<Button
				asChild
				className="mt-8 min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
				data-testid="create-first-strategy-btn"
			>
				<Link href="/strategies/new">
					<Plus className="mr-2 h-4 w-4" />
					Create Your First Strategy
				</Link>
			</Button>
		</div>
	);
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function StrategiesPage() {
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [strategyToDelete, setStrategyToDelete] = useState<string | null>(null);
	const isMobile = useIsMobile();

	const utils = api.useUtils();

	// Fetch strategies
	const { data: strategies, isLoading: strategiesLoading } =
		api.strategies.getAll.useQuery({
			includeInactive: true,
		});

	// Fetch performance data for mini charts
	const { data: performanceData, isLoading: performanceLoading } =
		api.strategies.getPerformanceByStrategy.useQuery();

	const isLoading = strategiesLoading || performanceLoading;

	// Create a map of strategyId -> performance data
	const performanceMap = new Map(
		performanceData?.map((p) => [
			p.strategyId,
			{
				winRate: p.winRate,
				totalPnl: p.totalPnl,
				profitFactor: p.profitFactor,
				avgPnl: p.avgPnl,
				tradesCount: p.tradesCount,
				recentPnlSeries: p.recentPnlSeries,
			},
		]) ?? [],
	);

	const deleteMutation = api.strategies.delete.useMutation({
		onSuccess: () => {
			toast.success("Strategy deleted");
			utils.strategies.getAll.invalidate();
			utils.strategies.getPerformanceByStrategy.invalidate();
			setDeleteDialogOpen(false);
			setStrategyToDelete(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete strategy");
		},
	});

	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			utils.strategies.getPerformanceByStrategy.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	const handleDelete = (id: string) => {
		setStrategyToDelete(id);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		if (strategyToDelete) {
			deleteMutation.mutate({ id: strategyToDelete });
		}
	};

	return (
		<div
			className="mx-auto w-[95%] max-w-7xl space-y-8 py-6 sm:py-8"
			data-testid="strategies-page"
		>
			{/* Terminal-styled Header */}
			<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-2">
					<span className="font-mono text-primary text-xs uppercase tracking-wider">
						Trading Playbook
					</span>
					<h1 className="flex items-center gap-3 font-bold text-2xl tracking-tight sm:text-3xl">
						<TrendingUp className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
						Strategies
					</h1>
					<p className="max-w-lg font-mono text-muted-foreground text-sm leading-relaxed">
						Document your trading strategies with entry rules, risk management,
						and checklists. Track performance and rule compliance.
					</p>
				</div>
				<Button
					asChild
					className="min-h-[44px] w-full shrink-0 font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:w-auto"
					data-testid="create-strategy-btn"
				>
					<Link href="/strategies/new">
						<Plus className="mr-2 h-4 w-4" />
						New Strategy
					</Link>
				</Button>
			</div>

			{/* Loading state */}
			{isLoading && (
				<div
					className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
					data-testid="strategies-loading"
				>
					{[1, 2, 3].map((i) => (
						<StrategyCardSkeleton key={i} />
					))}
				</div>
			)}

			{/* Empty state */}
			{!isLoading && (!strategies || strategies.length === 0) && <EmptyState />}

			{/* Strategies grid */}
			{!isLoading && strategies && strategies.length > 0 && (
				<div className="space-y-4">
					<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
						{strategies.length}{" "}
						{strategies.length === 1 ? "Strategy" : "Strategies"}
					</h2>
					<div
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
						data-testid="strategies-grid"
					>
						{strategies.map((strategy) => (
							<StrategyCard
								isMobile={isMobile}
								key={strategy.id}
								onDelete={() => handleDelete(strategy.id)}
								onDuplicate={() =>
									duplicateMutation.mutate({ id: strategy.id })
								}
								onEdit={() => router.push(`/strategies/${strategy.id}`)}
								performance={performanceMap.get(strategy.id) ?? null}
								strategy={strategy}
							/>
						))}
					</div>
				</div>
			)}

			{/* Delete confirmation dialog */}
			<Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<DialogContent className="border-border bg-background">
					<DialogHeader>
						<DialogTitle className="font-mono uppercase tracking-wider">
							Delete Strategy
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">
							Are you sure you want to delete this strategy? This will remove it
							from all associated trades.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
						<Button
							className="min-h-[44px] sm:min-h-0"
							onClick={() => setDeleteDialogOpen(false)}
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							className="min-h-[44px] sm:min-h-0"
							disabled={deleteMutation.isPending}
							onClick={confirmDelete}
							variant="destructive"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
