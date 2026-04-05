"use client";

import { ArrowRight, BookMarked, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	UpgradeButtonCompact,
	useHasFeature,
} from "@/components/billing/upgrade-prompt";
import { StrategyCard, StrategyLeaderboard } from "@/components/strategy";
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
import { FEATURE_CUSTOM_STRATEGIES } from "@/lib/constants/billing";
import {
	ERR_STRATEGY_DELETE_FAILED,
	ERR_STRATEGY_DUPLICATE_UI_FAILED,
} from "@/lib/constants/errors";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function StrategiesPage() {
	const { hasAccess: hasStrategies } = useHasFeature(FEATURE_CUSTOM_STRATEGIES);
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [strategyToDelete, setStrategyToDelete] = useState<string | null>(null);
	const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
	const [strategyToDuplicate, setStrategyToDuplicate] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const utils = api.useUtils();

	const { data: strategies, isLoading } = api.strategies.getAll.useQuery({
		includeInactive: true,
	});

	const deleteMutation = api.strategies.delete.useMutation({
		onSuccess: () => {
			toast.success("Strategy deleted");
			utils.strategies.getAll.invalidate();
			utils.strategies.getAllStats.invalidate();
			setDeleteDialogOpen(false);
			setStrategyToDelete(null);
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_STRATEGY_DELETE_FAILED));
		},
	});

	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			setDuplicateDialogOpen(false);
			setStrategyToDuplicate(null);
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_STRATEGY_DUPLICATE_UI_FAILED));
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

	const handleDuplicate = (id: string, name: string) => {
		setStrategyToDuplicate({ id, name });
		setDuplicateDialogOpen(true);
	};

	const confirmDuplicate = () => {
		if (strategyToDuplicate) {
			duplicateMutation.mutate({ id: strategyToDuplicate.id });
		}
	};

	// Get stats for each strategy
	const strategyStats = api.useQueries((t) =>
		(strategies ?? []).map((s) => t.strategies.getStats({ id: s.id })),
	);

	const statsMap = new Map<
		string,
		{ winRate: number; totalPnl: number; avgPnl: number }
	>();
	strategies?.forEach((s, i) => {
		const stats = strategyStats[i]?.data;
		if (stats) {
			statsMap.set(s.id, {
				winRate: stats.winRate,
				totalPnl: stats.totalPnl,
				avgPnl: stats.avgPnl,
			});
		}
	});

	// Find the top performer (highest positive P&L among strategies with trades)
	const topPerformerId = (() => {
		let topId: string | null = null;
		let topPnl = 0;
		for (const [id, stats] of statsMap) {
			const strategy = strategies?.find((s) => s.id === id);
			// Only consider active strategies with trades
			if (
				strategy &&
				strategy.isActive !== false &&
				strategy._count.trades > 0 &&
				stats.totalPnl > topPnl
			) {
				topId = id;
				topPnl = stats.totalPnl;
			}
		}
		return topId;
	})();

	const isMobile = useIsMobile();

	return (
		<div className="relative min-h-screen">
			{/* Background Effects */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				{/* Grid pattern */}
				<div
					className="absolute inset-0 opacity-30"
					style={{
						backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
						backgroundSize: "60px 60px",
					}}
				/>
				{/* Primary gradient orb */}
				<div className="-left-32 absolute top-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[150px]" />
				{/* Accent gradient orb */}
				<div className="-right-32 absolute top-1/3 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[120px]" />
			</div>

			<div className="relative mx-auto w-[95%] max-w-none space-y-6 py-4 sm:space-y-8 sm:py-6">
				{/* Hero Header */}
				<div
					className="relative overflow-hidden rounded border border-border bg-muted p-4 sm:p-8"
					data-testid="strategies-header"
				>
					{/* Header background accent */}
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

					<div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div className="space-y-2 sm:space-y-3">
							{/* Section label with command prompt */}
							<div className="flex items-center gap-1.5 sm:gap-2">
								<span className="font-mono text-primary text-xs sm:text-sm">
									$
								</span>
								<span className="font-mono text-[10px] text-primary uppercase tracking-widest sm:text-[11px]">
									STRATEGIES
								</span>
							</div>

							{/* Main headline */}
							<h1 className="font-bold text-2xl tracking-tight sm:text-4xl lg:text-5xl">
								Your Trading <span className="text-primary">Strategies</span>
							</h1>

							{/* Subheadline */}
							<p className="max-w-xl font-mono text-muted-foreground text-xs leading-relaxed sm:text-sm">
								Document your edge with entry rules, risk parameters, and
								pre-trade checklists. Track which strategies generate alpha.
							</p>
						</div>

						{/* CTA Button */}
						{hasStrategies ? (
							<Button
								asChild
								className="group min-h-12 shrink-0 px-4 font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:px-6"
								data-testid="strategies-header-new-button"
							>
								<Link href="/strategies/new">
									<Plus className="mr-2 h-4 w-4" />
									New Strategy
									<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
								</Link>
							</Button>
						) : (
							<UpgradeButtonCompact feature={FEATURE_CUSTOM_STRATEGIES} />
						)}
					</div>
				</div>

				{/* Strategy Leaderboard */}
				{!isLoading && strategies && strategies.length > 0 && (
					<StrategyLeaderboard />
				)}

				{/* Loading state */}
				{isLoading && (
					<div className="space-y-6 sm:space-y-8">
						{/* Leaderboard skeleton */}
						<div className="overflow-hidden rounded border border-border">
							<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
								<div className="flex items-center gap-1 sm:gap-1.5">
									<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
									<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
									<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
								</div>
								<Skeleton className="h-2.5 w-20 sm:h-3 sm:w-28" />
								<div className="w-10 sm:w-14" />
							</div>
							<div className="p-3 sm:p-6">
								<div className="space-y-2 sm:space-y-3">
									{[1, 2, 3].map((i) => (
										<div
											className="flex min-h-12 items-center justify-between rounded border border-border/50 bg-muted p-2.5 sm:min-h-0 sm:p-3"
											key={i}
										>
											<div className="flex items-center gap-2 sm:gap-3">
												<Skeleton className="h-5 w-5 rounded-full sm:h-6 sm:w-6" />
												<Skeleton className="h-3 w-24 sm:h-4 sm:w-32" />
											</div>
											<Skeleton className="h-3 w-16 sm:h-4 sm:w-20" />
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Cards grid skeleton */}
						<div className="space-y-3 sm:space-y-4">
							<Skeleton className="h-2.5 w-24 sm:h-3 sm:w-28" />
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
								{[1, 2, 3].map((i) => (
									<div
										className="overflow-hidden rounded border border-border"
										key={i}
									>
										{/* Terminal chrome header */}
										<div className="flex items-center justify-between border-border/50 border-b bg-muted px-2 py-1.5 sm:px-3 sm:py-2">
											<div className="flex items-center gap-1 sm:gap-1.5">
												<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
												<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
												<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
											</div>
											<Skeleton className="h-2 w-20 sm:h-2.5 sm:w-24" />
											<Skeleton className="h-6 w-6 rounded sm:h-5 sm:w-5" />
										</div>
										{/* Color gradient header skeleton */}
										<div className="relative h-16 bg-gradient-to-br from-white/5 via-white/2 to-transparent sm:h-20">
											<div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 sm:top-3 sm:left-3 sm:gap-2">
												<Skeleton className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3" />
												<Skeleton className="h-2 w-10 sm:h-2.5 sm:w-12" />
											</div>
											<div className="absolute right-2.5 bottom-2.5 sm:right-3 sm:bottom-3">
												<Skeleton className="h-4 w-16 sm:h-5 sm:w-20" />
											</div>
										</div>
										{/* Card content skeleton */}
										<div className="bg-card p-3 sm:p-4">
											<Skeleton className="mb-2.5 h-4 w-28 sm:mb-3 sm:h-5 sm:w-32" />
											<div className="grid grid-cols-3 gap-2 sm:gap-3">
												{[1, 2, 3].map((j) => (
													<div key={j}>
														<Skeleton className="mb-1 h-2 w-8 sm:h-2.5 sm:w-10" />
														<Skeleton className="h-4 w-10 sm:h-5 sm:w-12" />
													</div>
												))}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Empty state */}
				{!isLoading && (!strategies || strategies.length === 0) && (
					<div
						className="relative overflow-hidden rounded border border-border bg-muted"
						data-testid="strategies-empty-state"
					>
						{/* Grid pattern background */}
						<div
							className="pointer-events-none absolute inset-0 opacity-40"
							style={{
								backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
								backgroundSize: "40px 40px",
							}}
						/>

						{/* Terminal window chrome */}
						<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
							<div className="flex items-center gap-1 sm:gap-1.5">
								<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
							</div>
							<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
								strategies — empty
							</span>
							<div className="w-10 sm:w-14" />
						</div>

						{/* Content area */}
						<div className="relative flex flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-20">
							{/* Icon with terminal styling */}
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded border border-border bg-muted sm:mb-6 sm:h-20 sm:w-20">
								<BookMarked className="h-7 w-7 text-muted-foreground/60 sm:h-10 sm:w-10" />
							</div>

							{/* Command prompt indicator */}
							<div className="mb-2 flex items-center gap-1.5 sm:mb-3 sm:gap-2">
								<span className="font-mono text-primary text-xs sm:text-sm">
									$
								</span>
								<span className="font-mono text-[10px] text-primary uppercase tracking-widest sm:text-[11px]">
									NO STRATEGIES DEFINED
								</span>
							</div>

							{/* Main message */}
							<h2 className="font-semibold text-base sm:text-xl">
								Start building your edge
							</h2>

							{/* Description */}
							<p className="mt-2 max-w-md text-center font-mono text-[10px] text-muted-foreground leading-relaxed sm:mt-3 sm:text-sm">
								Strategies document your trading approach with entry rules, risk
								parameters, and pre-trade checklists. Track what works.
							</p>

							{/* Terminal-style command hint */}
							<div className="mt-4 rounded border border-border/50 bg-muted px-3 py-1.5 sm:mt-6 sm:px-4 sm:py-2">
								<div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground sm:gap-2 sm:text-xs">
									<span className="text-primary">→</span>
									<span>Create your first strategy to begin tracking</span>
								</div>
							</div>

							{/* CTA Button */}
							<Button
								asChild
								className="group mt-6 min-h-12 px-6 font-mono text-xs uppercase tracking-wider sm:mt-8 sm:min-h-0 sm:px-8"
								data-testid="strategies-empty-state-cta"
							>
								<Link href="/strategies/new">
									<span className="mr-2 text-primary-foreground/70">$</span>
									CREATE FIRST STRATEGY
									<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
								</Link>
							</Button>
						</div>
					</div>
				)}

				{/* Strategies grid */}
				{!isLoading && strategies && strategies.length > 0 && (
					<div className="space-y-3 sm:space-y-4">
						<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
							Your Strategies
						</h2>
						<div
							className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
							data-testid="strategies-grid"
						>
							{strategies.map((strategy) => (
								<StrategyCard
									isMobile={isMobile}
									isTopPerformer={strategy.id === topPerformerId}
									key={strategy.id}
									onDelete={() => handleDelete(strategy.id)}
									onDuplicate={() =>
										handleDuplicate(strategy.id, strategy.name)
									}
									onEdit={() => router.push(`/strategies/${strategy.id}`)}
									stats={statsMap.get(strategy.id) ?? null}
									strategy={strategy}
								/>
							))}
							{/* Create Strategy CTA Card */}
							{hasStrategies ? (
								<Link
									className="group flex min-h-[200px] flex-col items-center justify-center gap-4 rounded border-2 border-border border-dashed bg-muted p-6 transition-all hover:border-primary/50 hover:bg-muted"
									data-testid="strategies-create-cta"
									href="/strategies/new"
								>
									<div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
										<Plus className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
									</div>
									<div className="text-center">
										<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider transition-colors group-hover:text-primary">
											Create New Strategy
										</span>
									</div>
								</Link>
							) : (
								<div className="group flex min-h-[200px] flex-col items-center justify-center gap-4 rounded border-2 border-border border-dashed bg-muted p-6">
									<div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
										<Lock className="h-6 w-6 text-muted-foreground" />
									</div>
									<div className="text-center">
										<UpgradeButtonCompact feature={FEATURE_CUSTOM_STRATEGIES} />
									</div>
								</div>
							)}
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
								Are you sure you want to delete this strategy? This will remove
								it from all associated trades.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
							<Button
								className="min-h-11 sm:min-h-0"
								onClick={() => setDeleteDialogOpen(false)}
								variant="ghost"
							>
								Cancel
							</Button>
							<Button
								className="min-h-11 sm:min-h-0"
								disabled={deleteMutation.isPending}
								onClick={confirmDelete}
								variant="destructive"
							>
								{deleteMutation.isPending ? "Deleting..." : "Delete"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Duplicate confirmation dialog */}
				<Dialog
					onOpenChange={setDuplicateDialogOpen}
					open={duplicateDialogOpen}
				>
					<DialogContent className="border-border bg-background">
						<DialogHeader>
							<DialogTitle className="font-mono uppercase tracking-wider">
								Duplicate Strategy
							</DialogTitle>
							<DialogDescription className="font-mono text-xs">
								Create a copy of &quot;{strategyToDuplicate?.name}&quot;? The
								new strategy will be named &quot;{strategyToDuplicate?.name}{" "}
								(Copy) &quot;.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
							<Button
								className="min-h-11 sm:min-h-0"
								onClick={() => setDuplicateDialogOpen(false)}
								variant="ghost"
							>
								Cancel
							</Button>
							<Button
								className="min-h-11 sm:min-h-0"
								disabled={duplicateMutation.isPending}
								onClick={confirmDuplicate}
							>
								{duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
