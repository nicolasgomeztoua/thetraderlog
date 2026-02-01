"use client";

import { TrendingDownIcon, TrendingUpIcon, ZapIcon } from "lucide-react";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import { cn, formatCurrency, toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

// Circular gauge for win rate
function WinRateGauge({ value, size = 48 }: { value: number; size?: number }) {
	const strokeWidth = 4;
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
				<span className={cn("font-mono font-semibold text-[10px]", color)}>
					{Math.round(value)}%
				</span>
			</div>
		</div>
	);
}

// Progress bar for daily loss limit (prop accounts)
function DailyLossProgress({
	currentLoss,
	limit,
}: {
	currentLoss: number;
	limit: number;
}) {
	// currentLoss should be positive (absolute loss)
	const absLoss = Math.abs(currentLoss);
	const progress = limit > 0 ? Math.min((absLoss / limit) * 100, 100) : 0;
	const isWarning = progress >= 70;
	const isDanger = progress >= 90;

	return (
		<div className="mt-3 border-white/5 border-t pt-3">
			<div className="mb-1 flex items-center justify-between">
				<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					Daily Loss Limit
				</span>
				<span
					className={cn(
						"font-mono text-[10px]",
						isDanger
							? "text-loss"
							: isWarning
								? "text-primary"
								: "text-muted-foreground",
					)}
				>
					{formatCurrency(absLoss)} / {formatCurrency(limit)}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded bg-white/10">
				<div
					className={cn(
						"h-full transition-all duration-300",
						isDanger ? "bg-loss" : isWarning ? "bg-primary" : "bg-profit",
					)}
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}

/**
 * Today's Performance Widget for the Command Center dashboard.
 *
 * Shows:
 * - Large P&L display with profit/loss coloring
 * - Trade count, Win/Loss count, Win rate gauge
 * - Comparison to daily average (if available)
 * - For prop accounts: Daily loss limit progress bar
 */
export function TodayPerformanceWidget() {
	const { selectedAccountId, selectedAccount } = useAccount();

	// Get today's date range
	const today = toDateString(new Date());
	const todayStart = new Date(today);
	todayStart.setHours(0, 0, 0, 0);

	// Get today's stats
	const { data: todayStats, isLoading: todayLoading } =
		api.trades.getStats.useQuery(
			{
				accountId: selectedAccountId ?? undefined,
				startDate: todayStart.toISOString(),
			},
			{ staleTime: 30000 },
		);

	// Get overall stats for comparison (last 30 days average)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const { data: overallStats, isLoading: overallLoading } =
		api.trades.getStats.useQuery(
			{
				accountId: selectedAccountId ?? undefined,
				startDate: thirtyDaysAgo.toISOString(),
			},
			{ staleTime: 60000 },
		);

	const isLoading = todayLoading || overallLoading;

	// Calculate daily average from 30-day stats
	const dailyAverage = useMemo(() => {
		if (!overallStats || overallStats.totalTrades === 0) return null;
		// Rough estimate: assume 20 trading days in 30 calendar days
		const tradingDays = 20;
		return overallStats.totalPnl / tradingDays;
	}, [overallStats]);

	// Check for daily loss limit (prop accounts)
	const dailyLossLimit = selectedAccount?.dailyLossLimit
		? Number.parseFloat(selectedAccount.dailyLossLimit)
		: null;

	const hasTrades = todayStats && todayStats.totalTrades > 0;
	const todayPnl = todayStats?.totalPnl ?? 0;
	const currentLoss = todayPnl < 0 ? Math.abs(todayPnl) : 0;

	// Determine if above/below daily average
	const comparedToAverage =
		dailyAverage !== null ? todayPnl - dailyAverage : null;

	return (
		<DashboardWidget
			data-testid="widget-today-performance"
			icon={ZapIcon}
			loading={isLoading}
			title="today"
		>
			{!hasTrades ? (
				<WidgetEmptyState icon={ZapIcon} message="No trades today yet" />
			) : (
				<div className="flex h-full flex-col">
					{/* Main P&L display */}
					<div className="flex items-start justify-between">
						<div>
							<div
								className={cn(
									"font-bold font-mono text-3xl",
									todayPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(todayPnl)}
							</div>
							{comparedToAverage !== null && (
								<div className="mt-1 flex items-center gap-1">
									{comparedToAverage >= 0 ? (
										<TrendingUpIcon className="h-3 w-3 text-profit" />
									) : (
										<TrendingDownIcon className="h-3 w-3 text-loss" />
									)}
									<span
										className={cn(
											"font-mono text-[10px]",
											comparedToAverage >= 0 ? "text-profit" : "text-loss",
										)}
									>
										{comparedToAverage >= 0 ? "+" : ""}
										{formatCurrency(comparedToAverage)} vs avg
									</span>
								</div>
							)}
						</div>

						{/* Win rate gauge */}
						<WinRateGauge value={todayStats.winRate} />
					</div>

					{/* Stats row */}
					<div className="mt-4 flex items-center gap-4">
						{/* Trade count */}
						<div>
							<div className="font-mono font-semibold text-lg">
								{todayStats.totalTrades}
							</div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								Trades
							</div>
						</div>

						<div className="h-8 w-px bg-white/10" />

						{/* Win/Loss */}
						<div>
							<div className="font-mono font-semibold text-lg">
								<span className="text-profit">{todayStats.wins}</span>
								<span className="text-muted-foreground">/</span>
								<span className="text-loss">{todayStats.losses}</span>
							</div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								W/L
							</div>
						</div>

						<div className="h-8 w-px bg-white/10" />

						{/* Profit Factor */}
						<div>
							<div
								className={cn(
									"font-mono font-semibold text-lg",
									todayStats.profitFactor >= 1 ? "text-profit" : "text-loss",
								)}
							>
								{todayStats.profitFactor === Infinity
									? "∞"
									: todayStats.profitFactor.toFixed(2)}
							</div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
								PF
							</div>
						</div>
					</div>

					{/* Daily loss limit (prop accounts) */}
					{dailyLossLimit !== null && dailyLossLimit > 0 && (
						<DailyLossProgress
							currentLoss={currentLoss}
							limit={dailyLossLimit}
						/>
					)}
				</div>
			)}
		</DashboardWidget>
	);
}
