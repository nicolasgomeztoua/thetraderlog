"use client";

import { BarChart3Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/account-context";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";
import { CumulativePnLSparkline, WinRateGauge } from "./chart-components";

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
	today: "Today",
	week: "Week",
	month: "Month",
};

// Get date range for period
function getDateRange(period: Period) {
	const end = new Date();
	const start = new Date();

	switch (period) {
		case "today":
			// Start of today
			start.setHours(0, 0, 0, 0);
			break;
		case "week":
			// Start of this week (Sunday)
			start.setDate(start.getDate() - start.getDay());
			start.setHours(0, 0, 0, 0);
			break;
		case "month":
			// Start of this month
			start.setDate(1);
			start.setHours(0, 0, 0, 0);
			break;
	}

	return {
		startDate: start.toISOString(),
		endDate: end.toISOString(),
	};
}

/**
 * Analytics Snapshot Widget for the Command Center dashboard.
 *
 * Shows:
 * - Win Rate gauge
 * - Profit Factor
 * - Expectancy (avg P&L per trade)
 * - Total trades
 * - Cumulative P&L sparkline
 * - Period toggle (Today/Week/Month)
 */
export function AnalyticsSnapshotWidget() {
	const { selectedAccountId } = useAccount();
	const [period, setPeriod] = useState<Period>("month");

	const dateRange = useMemo(() => getDateRange(period), [period]);

	const { data: stats, isLoading } = api.trades.getStats.useQuery(
		{
			accountId: selectedAccountId ?? undefined,
			startDate: dateRange.startDate,
			endDate: dateRange.endDate,
		},
		{ staleTime: 30000 },
	);

	// Get recent trades for sparkline (last 20)
	const { data: recentTrades } = api.trades.getAll.useQuery(
		{
			limit: 20,
			sortField: "entry",
			sortDirection: "desc",
			accountId: selectedAccountId ?? undefined,
			status: "closed",
		},
		{ staleTime: 60000 },
	);

	// Extract P&L values for sparkline (reversed to be chronological)
	const sparklineData = useMemo(() => {
		if (!recentTrades) return [];
		return recentTrades.items
			.filter((t) => t.netPnl)
			.map((t) => Number.parseFloat(t.netPnl ?? "0"))
			.reverse();
	}, [recentTrades]);

	const hasData = stats && stats.totalTrades > 0;

	return (
		<DashboardWidget
			data-testid="widget-analytics-snapshot"
			href="/analytics"
			icon={BarChart3Icon}
			loading={isLoading}
			skeletonVariant="metrics"
			title="analytics-snapshot"
		>
			{/* Period toggle */}
			<div className="mb-3 flex items-center gap-1">
				{(["today", "week", "month"] as Period[]).map((p) => (
					<Button
						className={cn(
							"h-6 px-2 font-mono text-[10px]",
							period === p
								? "bg-primary/20 text-primary"
								: "text-muted-foreground",
						)}
						key={p}
						onClick={() => setPeriod(p)}
						size="sm"
						variant="ghost"
					>
						{PERIOD_LABELS[p]}
					</Button>
				))}
			</div>

			{!hasData ? (
				<WidgetEmptyState
					icon={BarChart3Icon}
					message={`No trades ${period === "today" ? "today" : `this ${period}`}`}
				/>
			) : (
				<div className="flex h-full flex-col">
					{/* Top row: Win rate gauge and key metrics */}
					<div className="flex items-start gap-4">
						<WinRateGauge value={stats.winRate} />

						<div className="grid flex-1 grid-cols-2 gap-2">
							{/* Profit Factor */}
							<div>
								<div
									className={cn(
										"font-mono font-semibold text-sm",
										stats.profitFactor >= 1 ? "text-profit" : "text-loss",
									)}
								>
									{stats.profitFactor === Infinity
										? "∞"
										: stats.profitFactor.toFixed(2)}
								</div>
								<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
									PF
								</div>
							</div>

							{/* Expectancy */}
							<div>
								<div
									className={cn(
										"font-mono font-semibold text-sm",
										stats.avgPnl >= 0 ? "text-profit" : "text-loss",
									)}
								>
									{formatCurrency(stats.avgPnl)}
								</div>
								<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
									Exp.
								</div>
							</div>

							{/* Trades */}
							<div>
								<div className="font-mono font-semibold text-sm">
									{stats.totalTrades}
								</div>
								<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
									Trades
								</div>
							</div>

							{/* Win/Loss */}
							<div>
								<div className="font-mono font-semibold text-sm">
									<span className="text-profit">{stats.wins}</span>
									<span className="text-muted-foreground">/</span>
									<span className="text-loss">{stats.losses}</span>
								</div>
								<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
									W/L
								</div>
							</div>
						</div>
					</div>

					{/* Total P&L */}
					<div className="mt-3 flex items-center justify-between border-border/50 border-t pt-3">
						<div>
							<div
								className={cn(
									"font-mono font-semibold text-lg",
									stats.totalPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(stats.totalPnl)}
							</div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								Total P&L
							</div>
						</div>

						{/* Sparkline */}
						{sparklineData.length > 1 && (
							<CumulativePnLSparkline data={sparklineData} />
						)}
					</div>
				</div>
			)}
		</DashboardWidget>
	);
}
