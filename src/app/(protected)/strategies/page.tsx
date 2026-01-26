"use client";

import { ArrowRight, BookMarked, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { api } from "@/trpc/react";

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function StrategiesPage() {
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [strategyToDelete, setStrategyToDelete] = useState<string | null>(null);

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
			toast.error(error.message || "Failed to delete strategy");
		},
	});

	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
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
					className="relative overflow-hidden rounded border border-white/10 bg-white/2 p-6 sm:p-8"
					data-testid="strategies-header"
				>
					{/* Header background accent */}
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

					<div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div className="space-y-3">
							{/* Section label with command prompt */}
							<div className="flex items-center gap-2">
								<span className="font-mono text-primary text-sm">$</span>
								<span className="font-mono text-[11px] text-primary uppercase tracking-widest">
									PLAYBOOKS
								</span>
							</div>

							{/* Main headline */}
							<h1 className="font-bold text-3xl tracking-tight sm:text-4xl lg:text-5xl">
								Your Trading <span className="text-primary">Playbooks</span>
							</h1>

							{/* Subheadline */}
							<p className="max-w-xl font-mono text-muted-foreground text-sm leading-relaxed">
								Document your edge with entry rules, risk parameters, and
								pre-trade checklists. Track which strategies generate alpha.
							</p>
						</div>

						{/* CTA Button */}
						<Button
							asChild
							className="group min-h-[48px] shrink-0 px-6 font-mono text-xs uppercase tracking-wider sm:min-h-0"
							data-testid="strategies-header-new-button"
						>
							<Link href="/strategies/new">
								<Plus className="mr-2 h-4 w-4" />
								New Playbook
								<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Link>
						</Button>
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
						<div className="overflow-hidden rounded border border-white/10">
							<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
								<div className="flex items-center gap-1.5">
									<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
								</div>
								<Skeleton className="h-3 w-28" />
								<div className="w-14" />
							</div>
							<div className="p-4 sm:p-6">
								<div className="space-y-3">
									{[1, 2, 3].map((i) => (
										<div
											className="flex items-center justify-between rounded border border-white/5 bg-white/2 p-3"
											key={i}
										>
											<div className="flex items-center gap-3">
												<Skeleton className="h-6 w-6 rounded-full" />
												<Skeleton className="h-4 w-32" />
											</div>
											<Skeleton className="h-4 w-20" />
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Cards grid skeleton */}
						<div className="space-y-3 sm:space-y-4">
							<Skeleton className="h-3 w-28" />
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
								{[1, 2, 3].map((i) => (
									<div
										className="overflow-hidden rounded border border-white/10"
										key={i}
									>
										{/* Terminal chrome header */}
										<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-3 py-2">
											<div className="flex items-center gap-1.5">
												<div className="h-2 w-2 rounded-full bg-loss/60" />
												<div className="h-2 w-2 rounded-full bg-breakeven/60" />
												<div className="h-2 w-2 rounded-full bg-profit/60" />
											</div>
											<Skeleton className="h-2.5 w-24" />
											<Skeleton className="h-5 w-5 rounded" />
										</div>
										{/* Color gradient header skeleton */}
										<div className="relative h-16 bg-gradient-to-br from-white/5 via-white/2 to-transparent sm:h-20">
											<div className="absolute top-3 left-3 flex items-center gap-2">
												<Skeleton className="h-3 w-3 rounded-full" />
												<Skeleton className="h-2.5 w-12" />
											</div>
											<div className="absolute right-3 bottom-3">
												<Skeleton className="h-5 w-20" />
											</div>
										</div>
										{/* Card content skeleton */}
										<div className="bg-white/1 p-4">
											<Skeleton className="mb-3 h-5 w-32" />
											<div className="grid grid-cols-3 gap-3">
												{[1, 2, 3].map((j) => (
													<div key={j}>
														<Skeleton className="mb-1 h-2.5 w-10" />
														<Skeleton className="h-5 w-12" />
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
						className="relative overflow-hidden rounded border border-white/10 bg-white/2"
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
						<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
							<div className="flex items-center gap-1.5">
								<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
								<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
								<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
							</div>
							<span className="font-mono text-[10px] text-muted-foreground">
								playbooks — empty
							</span>
							<div className="w-14" />
						</div>

						{/* Content area */}
						<div className="relative flex flex-col items-center justify-center px-6 py-16 sm:py-20">
							{/* Icon with terminal styling */}
							<div className="mb-6 flex h-16 w-16 items-center justify-center rounded border border-white/10 bg-white/5 sm:h-20 sm:w-20">
								<BookMarked className="h-8 w-8 text-muted-foreground/60 sm:h-10 sm:w-10" />
							</div>

							{/* Command prompt indicator */}
							<div className="mb-3 flex items-center gap-2">
								<span className="font-mono text-primary text-sm">$</span>
								<span className="font-mono text-[11px] text-primary uppercase tracking-widest">
									NO PLAYBOOKS DEFINED
								</span>
							</div>

							{/* Main message */}
							<h2 className="font-semibold text-lg sm:text-xl">
								Start building your edge
							</h2>

							{/* Description */}
							<p className="mt-3 max-w-md text-center font-mono text-muted-foreground text-xs leading-relaxed sm:text-sm">
								Playbooks document your trading strategies with entry rules,
								risk parameters, and pre-trade checklists. Track what works.
							</p>

							{/* Terminal-style command hint */}
							<div className="mt-6 rounded border border-white/5 bg-white/2 px-4 py-2">
								<div className="flex items-center gap-2 font-mono text-muted-foreground text-xs">
									<span className="text-primary">→</span>
									<span>Create your first playbook to begin tracking</span>
								</div>
							</div>

							{/* CTA Button */}
							<Button
								asChild
								className="group mt-8 min-h-[48px] px-8 font-mono text-xs uppercase tracking-wider sm:min-h-0"
								data-testid="strategies-empty-state-cta"
							>
								<Link href="/strategies/new">
									<span className="mr-2 text-primary-foreground/70">$</span>
									CREATE FIRST PLAYBOOK
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
										duplicateMutation.mutate({ id: strategy.id })
									}
									onEdit={() => router.push(`/strategies/${strategy.id}`)}
									stats={statsMap.get(strategy.id) ?? null}
									strategy={strategy}
								/>
							))}
							{/* Create Strategy CTA Card */}
							<Link
								className="group flex min-h-[200px] flex-col items-center justify-center gap-4 rounded border-2 border-white/10 border-dashed bg-white/2 p-6 transition-all hover:border-primary/50 hover:bg-white/5"
								data-testid="strategies-create-cta"
								href="/strategies/new"
							>
								<div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
									<Plus className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
								</div>
								<div className="text-center">
									<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider transition-colors group-hover:text-primary">
										Create New Playbook
									</span>
								</div>
							</Link>
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
		</div>
	);
}
