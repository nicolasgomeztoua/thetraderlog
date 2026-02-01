"use client";

import { TrendingDownIcon, TrendingUpIcon, ZapIcon } from "lucide-react";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";
import { WinRateGauge } from "./chart-components";

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

	// Memoize date calculations to prevent infinite re-renders
	// (new Date objects would create new query keys on every render)
	const todayStart = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

	const thirtyDaysAgo = useMemo(() => {
		const d = new Date();
		d.setDate(d.getDate() - 30);
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

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
			skeletonVariant="performance"
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
