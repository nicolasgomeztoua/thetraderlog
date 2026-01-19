"use client";

import { BookMarked, Download, ExternalLink, Plus, Store } from "lucide-react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// PERFORMANCE COMPARISON TABLE
// =============================================================================

function PerformanceComparisonTable() {
	const { data: stats, isLoading } = api.strategies.getAllStats.useQuery();

	if (isLoading) {
		return (
			<div className="space-y-2">
				{[...Array(3)].map((_, i) => (
					<Skeleton className="h-10 w-full" key={`skeleton-${i.toString()}`} />
				))}
			</div>
		);
	}

	if (!stats || stats.length === 0) {
		return null;
	}

	// Only show strategies with trades
	const strategiesWithTrades = stats.filter((s) => s.totalTrades > 0);
	if (strategiesWithTrades.length === 0) {
		return null;
	}

	// Sort by total P&L descending
	const sortedStats = [...strategiesWithTrades].sort(
		(a, b) => b.totalPnl - a.totalPnl,
	);

	return (
		<div className="space-y-4">
			<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
				Performance Comparison
			</h2>
			<div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<div className="min-w-[600px] overflow-hidden rounded border border-border sm:min-w-0">
					<Table>
						<TableHeader>
							<TableRow className="border-border hover:bg-transparent">
								<TableHead className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Strategy
								</TableHead>
								<TableHead className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Trades
								</TableHead>
								<TableHead className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Win Rate
								</TableHead>
								<TableHead className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Profit Factor
								</TableHead>
								<TableHead className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Total P&L
								</TableHead>
								<TableHead className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Avg R
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedStats.map((s) => (
								<TableRow className="border-border" key={s.strategyId}>
									<TableCell>
										<Link
											className="flex items-center gap-2 transition-colors hover:text-primary"
											href={`/strategies/${s.strategyId}`}
										>
											<div
												className="h-2 w-2 shrink-0 rounded-full"
												style={{
													backgroundColor: s.strategyColor ?? "#d4ff00",
												}}
											/>
											<span className="font-medium font-mono text-sm">
												{s.strategyName}
											</span>
										</Link>
									</TableCell>
									<TableCell className="text-right font-mono text-sm">
										{s.totalTrades}
									</TableCell>
									<TableCell className="text-right">
										<span
											className={cn(
												"font-mono text-sm",
												s.winRate >= 50 ? "text-profit" : "text-loss",
											)}
										>
											{s.winRate.toFixed(1)}%
										</span>
									</TableCell>
									<TableCell className="text-right">
										<span
											className={cn(
												"font-mono text-sm",
												s.profitFactor >= 1 ? "text-profit" : "text-loss",
											)}
										>
											{s.profitFactor === Infinity
												? "∞"
												: s.profitFactor.toFixed(2)}
										</span>
									</TableCell>
									<TableCell className="text-right">
										<span
											className={cn(
												"font-bold font-mono text-sm",
												s.totalPnl >= 0 ? "text-profit" : "text-loss",
											)}
										>
											{formatCurrency(s.totalPnl)}
										</span>
									</TableCell>
									<TableCell className="text-right">
										<span
											className={cn(
												"font-mono text-sm",
												s.avgRMultiple !== null
													? s.avgRMultiple >= 0
														? "text-profit"
														: "text-loss"
													: "text-muted-foreground",
											)}
										>
											{s.avgRMultiple !== null
												? `${s.avgRMultiple.toFixed(2)}R`
												: "—"}
										</span>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>
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

	const utils = api.useUtils();

	const { data: allStrategies, isLoading } = api.strategies.getAll.useQuery({
		includeInactive: true,
	});

	// Fetch downloaded strategies separately to get source info
	const { data: downloadedStrategies, isLoading: isLoadingDownloaded } =
		api.strategies.getDownloaded.useQuery();

	// Split strategies into "My Strategies" (originals) and "Downloaded"
	const myStrategies = allStrategies?.filter((s) => !s.sourceStrategyId) ?? [];
	const downloadedList = downloadedStrategies ?? [];

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
		(allStrategies ?? []).map((s) => t.strategies.getStats({ id: s.id })),
	);

	const statsMap = new Map<
		string,
		{ winRate: number; totalPnl: number; avgPnl: number }
	>();
	allStrategies?.forEach((s, i) => {
		const stats = strategyStats[i]?.data;
		if (stats) {
			statsMap.set(s.id, {
				winRate: stats.winRate,
				totalPnl: stats.totalPnl,
				avgPnl: stats.avgPnl,
			});
		}
	});

	// Check if there are any strategies at all
	const hasAnyStrategies = myStrategies.length > 0 || downloadedList.length > 0;

	const isMobile = useIsMobile();

	return (
		<div className="mx-auto w-[95%] max-w-none space-y-6 py-4 sm:space-y-8 sm:py-6">
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h1 className="font-bold text-xl tracking-tight sm:text-2xl">
						Strategies
					</h1>
					<p className="mt-1 hidden font-mono text-muted-foreground text-sm sm:block">
						Document your trading strategies with entry rules, risk management,
						and checklists.
					</p>
				</div>
				<Button
					asChild
					className="min-h-[44px] shrink-0 font-mono text-xs uppercase tracking-wider sm:min-h-0"
				>
					<Link href="/strategies/new">
						<Plus className="h-4 w-4 sm:mr-2" />
						<span className="hidden sm:inline">New Strategy</span>
					</Link>
				</Button>
			</div>

			{/* Performance Comparison Table */}
			{!isLoading && hasAnyStrategies && <PerformanceComparisonTable />}

			{/* Loading state */}
			{isLoading && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Skeleton className="h-40 sm:h-48" key={i} />
					))}
				</div>
			)}

			{/* Empty state - only show when no strategies at all */}
			{!isLoading && !isLoadingDownloaded && !hasAnyStrategies && (
				<div className="flex flex-col items-center justify-center rounded border border-white/5 bg-white/2 px-4 py-12 sm:py-16">
					<BookMarked className="mb-4 h-10 w-10 text-muted-foreground/50 sm:h-12 sm:w-12" />
					<h2 className="font-semibold text-base sm:text-lg">
						No strategies yet
					</h2>
					<p className="mt-1 max-w-sm text-center font-mono text-muted-foreground text-xs sm:text-sm">
						Create your first strategy to document your trading approach and
						track rule compliance, or browse the marketplace.
					</p>
					<div className="mt-6 flex flex-col gap-3 sm:flex-row">
						<Button
							asChild
							className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
						>
							<Link href="/strategies/new">
								<Plus className="mr-2 h-4 w-4" />
								Create Strategy
							</Link>
						</Button>
						<Button
							asChild
							className="min-h-[44px] font-mono text-xs uppercase tracking-wider sm:min-h-0"
							variant="outline"
						>
							<Link href="/marketplace">
								<Store className="mr-2 h-4 w-4" />
								Browse Marketplace
							</Link>
						</Button>
					</div>
				</div>
			)}

			{/* My Strategies section */}
			{!isLoading && myStrategies.length > 0 && (
				<div
					className="space-y-3 sm:space-y-4"
					data-testid="my-strategies-section"
				>
					<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
						My Strategies
					</h2>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
						{myStrategies.map((strategy) => (
							<StrategyCard
								isMobile={isMobile}
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
					</div>
				</div>
			)}

			{/* Downloaded from Marketplace section */}
			{!isLoadingDownloaded && downloadedList.length > 0 && (
				<div
					className="space-y-3 sm:space-y-4"
					data-testid="downloaded-strategies-section"
				>
					<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
						Downloaded from Marketplace
					</h2>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
						{downloadedList.map((strategy) => (
							<div className="relative" key={strategy.id}>
								{/* Downloaded badge */}
								<div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded bg-secondary/90 px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider backdrop-blur-sm">
									<Download className="h-3 w-3" />
									Downloaded
								</div>
								{/* Source strategy link */}
								<div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded bg-background/90 px-2 py-1 font-mono text-[10px] backdrop-blur-sm">
									<span className="text-muted-foreground">From</span>
									{strategy.sourceStrategy ? (
										strategy.sourceStrategy.isPublic ? (
											<Link
												className="flex items-center gap-0.5 text-primary hover:underline"
												href={`/marketplace/${strategy.sourceStrategy.id}`}
											>
												{strategy.sourceStrategy.name}
												<ExternalLink className="h-2.5 w-2.5" />
											</Link>
										) : (
											<span className="text-muted-foreground/70 italic">
												{strategy.sourceStrategy.name} (unavailable)
											</span>
										)
									) : (
										<span className="text-muted-foreground/70 italic">
											Source no longer available
										</span>
									)}
								</div>
								<StrategyCard
									isMobile={isMobile}
									onDelete={() => handleDelete(strategy.id)}
									onDuplicate={() =>
										duplicateMutation.mutate({ id: strategy.id })
									}
									onEdit={() => router.push(`/strategies/${strategy.id}`)}
									stats={statsMap.get(strategy.id) ?? null}
									strategy={{
										id: strategy.id,
										name: strategy.name,
										description: strategy.description,
										color: strategy.color,
										coverImageUrl: strategy.coverImageUrl,
										isActive: strategy.isActive,
										_count: {
											rules: 0,
											trades: 0,
										},
									}}
								/>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Empty downloaded state - show when user has original strategies but no downloads */}
			{!isLoading &&
				!isLoadingDownloaded &&
				myStrategies.length > 0 &&
				downloadedList.length === 0 && (
					<div
						className="flex flex-col items-center justify-center rounded border border-border border-dashed bg-card/50 px-4 py-8"
						data-testid="empty-downloaded-section"
					>
						<Store className="mb-2 h-6 w-6 text-muted-foreground/50" />
						<p className="font-mono text-muted-foreground text-sm">
							No downloaded strategies yet
						</p>
						<Button
							asChild
							className="mt-3 font-mono text-xs"
							size="sm"
							variant="outline"
						>
							<Link href="/marketplace">
								<Store className="mr-1.5 h-3 w-3" />
								Browse Marketplace
							</Link>
						</Button>
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
