"use client";

import { BarChart3Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/account-context";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

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

// Circular gauge for win rate
function WinRateGauge({ value, size = 56 }: { value: number; size?: number }) {
	const strokeWidth = 5;
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const percent = Math.min(Math.max(value / 100, 0), 1);
	const offset = circumference - percent * circumference;

	const color = value >= 50 ? "stroke-profit" : "stroke-loss";

	return (
		<div className="relative">
			<svg
				aria-hidden="true"
				className="-rotate-90 transform"
				height={size}
				width={size}
			>
				<circle
					className="stroke-white/10"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					strokeWidth={strokeWidth}
				/>
				<circle
					className={cn(color, "transition-all duration-500")}
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("font-mono font-semibold text-xs", color)}>
					{Math.round(value)}%
				</span>
			</div>
		</div>
	);
}

// Mini sparkline for cumulative P&L
function CumulativePnLSparkline({
	data,
	height = 24,
	width = 80,
}: {
	data: number[];
	height?: number;
	width?: number;
}) {
	if (data.length === 0) return null;

	// Calculate cumulative values
	const cumulative: number[] = [];
	let sum = 0;
	for (const val of data) {
		sum += val;
		cumulative.push(sum);
	}

	const max = Math.max(...cumulative, 0);
	const min = Math.min(...cumulative, 0);
	const range = max - min || 1;

	// Create path
	const points = cumulative
		.map((val, i) => {
			const x = (i / Math.max(cumulative.length - 1, 1)) * width;
			const y = height - ((val - min) / range) * height;
			return `${x},${y}`;
		})
		.join(" ");

	// Determine color based on final value
	const finalValue = cumulative[cumulative.length - 1] ?? 0;
	const strokeColor = finalValue >= 0 ? "stroke-profit" : "stroke-loss";

	return (
		<svg
			aria-hidden="true"
			className="overflow-visible"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<polyline
				className={cn("fill-none", strokeColor)}
				points={points}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
			/>
		</svg>
	);
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
					<div className="mt-3 flex items-center justify-between border-white/5 border-t pt-3">
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
