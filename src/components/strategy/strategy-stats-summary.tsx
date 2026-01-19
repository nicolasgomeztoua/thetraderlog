"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";

interface StrategyStats {
	totalTrades: number;
	wins: number;
	losses: number;
	breakevens: number;
	winRate: number;
	totalPnl: number;
	avgPnl: number;
	profitFactor: number;
	avgWin: number;
	avgLoss: number;
}

interface StrategyStatsSummaryProps {
	stats: StrategyStats | null | undefined;
	isLoading: boolean;
	strategyId: string;
}

/**
 * Strategy Stats Summary Component
 *
 * Displays key performance stats for a strategy at a glance.
 * Responsive grid: 2 cols on mobile, 5 cols on desktop.
 */
export function StrategyStatsSummary({
	stats,
	isLoading,
	strategyId,
}: StrategyStatsSummaryProps) {
	// Loading skeleton state
	if (isLoading) {
		return (
			<div
				className="grid grid-cols-2 gap-3 sm:grid-cols-5"
				data-testid="strategy-stats-summary-loading"
			>
				{[...Array(5)].map((_, i) => (
					<div
						className="rounded border border-border bg-card p-3"
						key={`skeleton-stat-${i.toString()}`}
					>
						<Skeleton className="mb-2 h-3 w-16" />
						<Skeleton className="h-6 w-20" />
					</div>
				))}
			</div>
		);
	}

	// Empty state: no trades yet
	if (!stats || stats.totalTrades === 0) {
		return (
			<div
				className="rounded border border-border border-dashed bg-card/50 p-6 text-center"
				data-testid="strategy-stats-summary-empty"
			>
				<p className="font-mono text-muted-foreground text-sm">No trades yet</p>
				<Link
					className="mt-2 inline-flex items-center gap-1 font-mono text-primary text-xs hover:underline"
					href={`/trades?strategyId=${strategyId}`}
				>
					Link your first trade
					<ExternalLink className="h-3 w-3" />
				</Link>
			</div>
		);
	}

	return (
		<div
			className="grid grid-cols-2 gap-3 sm:grid-cols-5"
			data-testid="strategy-stats-summary"
		>
			{/* Total Trades - links to filtered trade log */}
			<StatCard
				label="Total Trades"
				link={`/trades?strategyId=${strategyId}`}
				testId="stat-total-trades"
				value={stats.totalTrades.toString()}
			/>

			{/* Win Rate - colored by 50% threshold */}
			<StatCard
				colorClass={stats.winRate >= 50 ? "text-profit" : "text-loss"}
				description={`${stats.wins}W / ${stats.losses}L`}
				label="Win Rate"
				testId="stat-win-rate"
				value={`${stats.winRate.toFixed(0)}%`}
			/>

			{/* Total P&L - colored by profit/loss */}
			<StatCard
				colorClass={getPnLColorClass(stats.totalPnl)}
				label="Total P&L"
				testId="stat-total-pnl"
				value={formatCurrency(stats.totalPnl)}
			/>

			{/* Profit Factor - colored by 1.0 threshold */}
			<StatCard
				colorClass={stats.profitFactor >= 1 ? "text-profit" : "text-loss"}
				label="Profit Factor"
				testId="stat-profit-factor"
				value={
					stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
				}
			/>

			{/* Avg P&L - colored by positive/negative */}
			<StatCard
				colorClass={getPnLColorClass(stats.avgPnl)}
				label="Avg Trade"
				testId="stat-avg-pnl"
				value={formatCurrency(stats.avgPnl)}
			/>
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: string;
	colorClass?: string;
	description?: string;
	link?: string;
	testId: string;
}

function StatCard({
	label,
	value,
	colorClass,
	description,
	link,
	testId,
}: StatCardProps) {
	const content = (
		<>
			<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</div>
			<div
				className={cn(
					"mt-1 font-bold font-mono text-lg",
					colorClass ?? "text-foreground",
				)}
			>
				{value}
			</div>
			{description && (
				<div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
					{description}
				</div>
			)}
		</>
	);

	if (link) {
		return (
			<Link
				className="group rounded border border-border bg-card p-3 transition-all hover:border-primary/30"
				data-testid={testId}
				href={link}
			>
				{content}
				<div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
					View trades <ExternalLink className="h-2.5 w-2.5" />
				</div>
			</Link>
		);
	}

	return (
		<div
			className="rounded border border-border bg-card p-3"
			data-testid={testId}
		>
			{content}
		</div>
	);
}
