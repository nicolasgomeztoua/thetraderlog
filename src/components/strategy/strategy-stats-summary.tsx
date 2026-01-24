"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
import { api } from "@/trpc/react";

interface StrategyStatsSummaryProps {
	/** The strategy ID to fetch stats for */
	strategyId: string;
	/** Compact mode shows 3 metrics (for cards), full mode shows 6 */
	compact?: boolean;
}

/**
 * Displays lightweight performance and compliance stats for a strategy.
 * Compact mode (default): Win Rate, Total P&L, Profit Factor
 * Full mode: adds Trades count, Avg R, Compliance %
 */
export function StrategyStatsSummary({
	strategyId,
	compact = false,
}: StrategyStatsSummaryProps) {
	const { data: stats, isLoading } = api.strategies.getStats.useQuery({
		id: strategyId,
	});

	if (isLoading) {
		return <StrategyStatsSummarySkeleton compact={compact} />;
	}

	if (!stats) {
		return null;
	}

	// Format profit factor - show "∞" for infinite (no losses)
	const formatProfitFactor = (pf: number | null | undefined) => {
		if (pf === null || pf === undefined) return "—";
		if (!Number.isFinite(pf)) return "∞";
		return pf.toFixed(2);
	};

	// Format win rate - handle no trades case
	const formatWinRate = (wr: number | null | undefined) => {
		if (wr === null || wr === undefined) return "—";
		return `${wr.toFixed(0)}%`;
	};

	// Calculate average R (avgPnl / avgLoss as proxy for R when no explicit R data)
	// This is a simplified approach - full R calculation would need trade-level data
	const avgR =
		stats.avgLoss && stats.avgLoss !== 0
			? stats.avgPnl / Math.abs(stats.avgLoss)
			: null;

	const formatAvgR = (r: number | null) => {
		if (r === null) return "—";
		const sign = r >= 0 ? "+" : "";
		return `${sign}${r.toFixed(2)}R`;
	};

	// Get color class for win rate
	const getWinRateColorClass = (wr: number | null | undefined) => {
		if (wr === null || wr === undefined) return "text-muted-foreground";
		return wr >= 50 ? "text-profit" : "text-loss";
	};

	// Get color class for profit factor
	const getProfitFactorColorClass = (pf: number | null | undefined) => {
		if (pf === null || pf === undefined) return "text-muted-foreground";
		if (!Number.isFinite(pf)) return "text-profit"; // Infinite is good (no losses)
		return pf >= 1 ? "text-profit" : "text-loss";
	};

	// Get color class for avg R
	const getAvgRColorClass = (r: number | null) => {
		if (r === null) return "text-muted-foreground";
		return r >= 0 ? "text-profit" : "text-loss";
	};

	if (compact) {
		return (
			<div className="grid grid-cols-3 gap-2">
				{/* Win Rate */}
				<StatItem
					colorClass={getWinRateColorClass(stats.winRate)}
					label="Win Rate"
					value={formatWinRate(stats.winRate)}
				/>

				{/* Total P&L */}
				<StatItem
					colorClass={getPnLColorClass(stats.totalPnl)}
					label="Total P&L"
					value={stats.totalPnl !== null ? formatCurrency(stats.totalPnl) : "—"}
				/>

				{/* Profit Factor */}
				<StatItem
					colorClass={getProfitFactorColorClass(stats.profitFactor)}
					label="Profit Factor"
					value={formatProfitFactor(stats.profitFactor)}
				/>
			</div>
		);
	}

	// Full mode: 6 metrics in 2 rows
	return (
		<div className="grid grid-cols-3 gap-3">
			{/* Row 1: Win Rate, Total P&L, Profit Factor */}
			<StatItem
				colorClass={getWinRateColorClass(stats.winRate)}
				label="Win Rate"
				value={formatWinRate(stats.winRate)}
			/>

			<StatItem
				colorClass={getPnLColorClass(stats.totalPnl)}
				label="Total P&L"
				value={stats.totalPnl !== null ? formatCurrency(stats.totalPnl) : "—"}
			/>

			<StatItem
				colorClass={getProfitFactorColorClass(stats.profitFactor)}
				label="Profit Factor"
				value={formatProfitFactor(stats.profitFactor)}
			/>

			{/* Row 2: Trades, Avg R, Compliance */}
			<StatItem
				colorClass="text-foreground"
				label="Trades"
				value={stats.totalTrades.toString()}
			/>

			<StatItem
				colorClass={getAvgRColorClass(avgR)}
				label="Avg R"
				value={formatAvgR(avgR)}
			/>

			{/* Compliance placeholder - will be enhanced when auto-compliance endpoint is ready */}
			<StatItem
				colorClass="text-muted-foreground"
				label="Compliance"
				value="—"
			/>
		</div>
	);
}

interface StatItemProps {
	label: string;
	value: string;
	colorClass: string;
}

function StatItem({ colorClass, label, value }: StatItemProps) {
	return (
		<div>
			<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</div>
			<div className={cn("mt-0.5 font-bold font-mono text-sm", colorClass)}>
				{value}
			</div>
		</div>
	);
}

// Skeleton labels for consistent display
const SKELETON_LABELS = [
	"stat-1",
	"stat-2",
	"stat-3",
	"stat-4",
	"stat-5",
	"stat-6",
] as const;

function StrategyStatsSummarySkeleton({ compact }: { compact: boolean }) {
	const labels = compact ? SKELETON_LABELS.slice(0, 3) : SKELETON_LABELS;

	return (
		<div className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-3")}>
			{labels.map((label) => (
				<div key={label}>
					<Skeleton className="mb-1 h-3 w-12" />
					<Skeleton className="h-4 w-16" />
				</div>
			))}
		</div>
	);
}
