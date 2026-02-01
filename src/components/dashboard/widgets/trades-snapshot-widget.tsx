"use client";

import { ArrowDownIcon, ArrowUpIcon, ListIcon } from "lucide-react";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

// Format relative time (e.g., "2h ago", "3d ago")
function formatTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Recent Trades Snapshot Widget for the Command Center dashboard.
 *
 * Shows:
 * - Last 5 trades in compact list
 * - Symbol, direction icon, P&L (colored), time ago
 * - Today's quick stats: trade count and P&L
 */
export function TradesSnapshotWidget() {
	const { selectedAccountId } = useAccount();

	// Get recent trades (last 5)
	const { data: recentTrades, isLoading } = api.trades.getAll.useQuery(
		{
			limit: 5,
			sortField: "entry",
			sortDirection: "desc",
			accountId: selectedAccountId ?? undefined,
		},
		{ staleTime: 30000 },
	);

	// Memoize date calculation to prevent infinite re-renders
	// (new Date objects would create new query keys on every render)
	const todayStart = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

	const { data: todayStats } = api.trades.getStats.useQuery(
		{
			accountId: selectedAccountId ?? undefined,
			startDate: todayStart.toISOString(),
		},
		{ staleTime: 30000 },
	);

	const trades = recentTrades?.items ?? [];
	const hasTrades = trades.length > 0;

	// Calculate today's P&L from todayStats
	const todayPnl = todayStats?.totalPnl ?? 0;
	const todayTradeCount = todayStats?.totalTrades ?? 0;

	return (
		<DashboardWidget
			data-testid="widget-trades-snapshot"
			href="/journal"
			icon={ListIcon}
			loading={isLoading}
			skeletonVariant="list"
			title="recent-trades"
		>
			{!hasTrades ? (
				<WidgetEmptyState icon={ListIcon} message="No trades yet" />
			) : (
				<div className="flex h-full flex-col">
					{/* Trade list */}
					<div className="flex-1 space-y-1">
						{trades.map((trade) => (
							<div
								className="flex items-center gap-2 rounded bg-muted/50 p-1.5"
								key={trade.id}
							>
								{/* Direction icon */}
								<div
									className={cn(
										"flex h-5 w-5 shrink-0 items-center justify-center rounded",
										trade.direction === "long"
											? "bg-profit/20 text-profit"
											: "bg-loss/20 text-loss",
									)}
								>
									{trade.direction === "long" ? (
										<ArrowUpIcon className="h-3 w-3" />
									) : (
										<ArrowDownIcon className="h-3 w-3" />
									)}
								</div>

								{/* Symbol */}
								<span className="min-w-0 flex-1 truncate font-mono text-[11px]">
									{trade.symbol}
								</span>

								{/* P&L */}
								<span
									className={cn(
										"shrink-0 font-mono font-semibold text-[11px]",
										trade.netPnl
											? Number.parseFloat(trade.netPnl) >= 0
												? "text-profit"
												: "text-loss"
											: "text-muted-foreground",
									)}
								>
									{trade.netPnl
										? formatCurrency(Number.parseFloat(trade.netPnl))
										: "-"}
								</span>

								{/* Time ago */}
								<span className="shrink-0 font-mono text-[9px] text-muted-foreground">
									{formatTimeAgo(new Date(trade.entryTime))}
								</span>
							</div>
						))}
					</div>

					{/* Today's quick stats */}
					<div className="mt-2 flex items-center justify-between border-border/50 border-t pt-2">
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Today
						</div>
						<div className="flex items-center gap-3">
							<span className="font-mono text-[11px]">
								{todayTradeCount} trade{todayTradeCount !== 1 && "s"}
							</span>
							<span
								className={cn(
									"font-mono font-semibold text-[11px]",
									todayPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(todayPnl)}
							</span>
						</div>
					</div>
				</div>
			)}
		</DashboardWidget>
	);
}
