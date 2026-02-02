"use client";

import { TargetIcon, TrophyIcon } from "lucide-react";
import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

/**
 * Strategies Snapshot Widget for the Command Center dashboard.
 *
 * Shows:
 * - Top 3 strategies by P&L (mini leaderboard)
 * - Strategy name, color dot, P&L, trade count
 * - Top Performer badge on #1
 * - Empty state when no strategies configured
 */
export function StrategiesSnapshotWidget() {
	// Get all strategy stats
	const { data: allStats, isLoading } = api.strategies.getAllStats.useQuery(
		undefined,
		{ staleTime: 60000 },
	);

	// Sort by P&L and take top 3
	const topStrategies = useMemo(() => {
		if (!allStats) return [];
		return [...allStats]
			.filter((s) => s.totalTrades > 0) // Only strategies with trades
			.sort((a, b) => b.totalPnl - a.totalPnl)
			.slice(0, 3);
	}, [allStats]);

	const hasStrategies = allStats && allStats.length > 0;
	const hasDataToShow = topStrategies.length > 0;

	return (
		<DashboardWidget
			data-testid="widget-strategies-snapshot"
			href="/strategies"
			icon={TargetIcon}
			loading={isLoading}
			skeletonVariant="list"
			title="strategies"
		>
			{!hasStrategies ? (
				<WidgetEmptyState
					icon={TargetIcon}
					message="No strategies configured"
				/>
			) : !hasDataToShow ? (
				<WidgetEmptyState
					icon={TargetIcon}
					message="No strategies with trades yet"
				/>
			) : (
				<div className="flex h-full flex-col gap-2">
					{topStrategies.map((strategy, index) => (
						<div
							className={cn(
								"flex items-center gap-3 rounded border border-border/50 p-2",
								index === 0 && "border-primary/20 bg-primary/5",
							)}
							key={strategy.strategyId}
						>
							{/* Rank / Trophy for #1 */}
							<div className="flex h-6 w-6 shrink-0 items-center justify-center">
								{index === 0 ? (
									<TrophyIcon className="h-4 w-4 text-primary" />
								) : (
									<span className="font-mono text-[10px] text-muted-foreground">
										#{index + 1}
									</span>
								)}
							</div>

							{/* Color dot and name */}
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<div
									className="h-2.5 w-2.5 shrink-0 rounded-full"
									style={{
										backgroundColor: strategy.strategyColor || "#888",
									}}
								/>
								<span className="truncate font-mono text-xs">
									{strategy.strategyName}
								</span>
							</div>

							{/* Stats */}
							<div className="shrink-0 text-right">
								<div
									className={cn(
										"font-mono font-semibold text-xs",
										strategy.totalPnl >= 0 ? "text-profit" : "text-loss",
									)}
								>
									{formatCurrency(strategy.totalPnl)}
								</div>
								<div className="font-mono text-[9px] text-muted-foreground">
									{strategy.totalTrades} trade
									{strategy.totalTrades !== 1 && "s"}
								</div>
							</div>
						</div>
					))}

					{/* Summary when more strategies exist */}
					{allStats && allStats.filter((s) => s.totalTrades > 0).length > 3 && (
						<div className="mt-auto pt-2 text-center font-mono text-[10px] text-muted-foreground">
							+{allStats.filter((s) => s.totalTrades > 0).length - 3} more
							strategies
						</div>
					)}
				</div>
			)}
		</DashboardWidget>
	);
}
