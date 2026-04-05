"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface LeaderboardEntry {
	strategyId: string;
	strategyName: string;
	strategyColor: string | null;
	totalPnl: number;
	winRate: number;
	totalTrades: number;
}

// =============================================================================
// RANK BADGE
// =============================================================================

function RankBadge({ rank }: { rank: 1 | 2 | 3 }) {
	const styles = {
		1: {
			bg: "bg-primary/20",
			border: "border-primary/50",
			text: "text-primary",
			glow: "shadow-[0_0_20px_hsl(var(--primary)/0.3)]",
		},
		2: {
			bg: "bg-muted",
			border: "border-border",
			text: "text-foreground",
			glow: "",
		},
		3: {
			bg: "bg-accent/10",
			border: "border-accent/30",
			text: "text-accent",
			glow: "",
		},
	};

	const style = styles[rank];

	return (
		<div
			className={cn(
				"flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-bold font-mono text-xs sm:h-8 sm:w-8 sm:text-sm",
				style.bg,
				style.border,
				style.text,
				style.glow,
			)}
		>
			{rank}
		</div>
	);
}

// =============================================================================
// LEADERBOARD ENTRY ROW
// =============================================================================

function LeaderboardRow({
	entry,
	rank,
	isTopPerformer,
}: {
	entry: LeaderboardEntry;
	rank: 1 | 2 | 3;
	isTopPerformer: boolean;
}) {
	return (
		<Link
			className={cn(
				"group flex min-h-14 items-center gap-3 rounded border bg-card p-3 transition-all hover:bg-muted sm:min-h-0 sm:gap-4 sm:p-4",
				isTopPerformer
					? "border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
					: "border-border hover:border-primary/20",
			)}
			data-testid={`leaderboard-entry-${rank}`}
			href={`/strategies/${entry.strategyId}`}
		>
			{/* Rank Badge */}
			<RankBadge rank={rank} />

			{/* Strategy Info */}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<div
						className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
						style={{ backgroundColor: entry.strategyColor ?? "#d4ff00" }}
					/>
					<span className="truncate font-mono font-semibold text-sm transition-colors group-hover:text-primary sm:text-base">
						{entry.strategyName}
					</span>
				</div>
				<div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:mt-1 sm:gap-3 sm:text-xs">
					<span>{entry.totalTrades} trades</span>
					<span className="text-border">|</span>
					<span
						className={cn(entry.winRate >= 50 ? "text-profit" : "text-loss")}
					>
						{entry.winRate.toFixed(0)}%
					</span>
				</div>
			</div>

			{/* P&L */}
			<div className="text-right">
				<span
					className={cn(
						"font-bold font-mono text-sm sm:text-lg",
						entry.totalPnl >= 0 ? "text-profit" : "text-loss",
					)}
				>
					{formatCurrency(entry.totalPnl)}
				</span>
			</div>
		</Link>
	);
}

// =============================================================================
// LOADING STATE
// =============================================================================

function LeaderboardSkeleton() {
	return (
		<div
			className="overflow-hidden rounded border border-border bg-card"
			data-testid="leaderboard-section"
		>
			{/* Terminal header */}
			<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-2 sm:px-4">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
				</div>
				<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
					leaderboard.tsx
				</span>
			</div>

			{/* Content */}
			<div className="space-y-2 p-3 sm:p-4">
				<Skeleton className="h-14 w-full sm:h-16" />
				<Skeleton className="h-14 w-full sm:h-16" />
				<Skeleton className="h-14 w-full sm:h-16" />
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StrategyLeaderboard() {
	const { data: stats, isLoading } = api.strategies.getAllStats.useQuery();

	if (isLoading) {
		return <LeaderboardSkeleton />;
	}

	if (!stats || stats.length === 0) {
		return null;
	}

	// Only show strategies with trades
	const strategiesWithTrades = stats.filter((s) => s.totalTrades > 0);
	if (strategiesWithTrades.length === 0) {
		return null;
	}

	// Sort by total P&L descending and get top 3
	const sortedStats = [...strategiesWithTrades].sort(
		(a, b) => b.totalPnl - a.totalPnl,
	);
	const topThree = sortedStats.slice(0, 3) as LeaderboardEntry[];

	return (
		<div
			className="overflow-hidden rounded border border-border bg-card"
			data-testid="leaderboard-section"
		>
			{/* Terminal header with traffic light dots */}
			<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-2 sm:px-4">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
					<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
				</div>
				<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
					leaderboard.tsx
				</span>
			</div>

			{/* Content */}
			<div className="p-3 sm:p-4">
				{/* Section header */}
				<div className="mb-3 flex items-center gap-2 sm:mb-4">
					<Trophy className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
					<h2 className="font-mono text-[10px] text-primary uppercase tracking-widest sm:text-[11px]">
						Top Performers
					</h2>
				</div>

				{/* Leaderboard entries */}
				<div className="space-y-2">
					{topThree.map((entry, index) => (
						<LeaderboardRow
							entry={entry}
							isTopPerformer={index === 0}
							key={entry.strategyId}
							rank={(index + 1) as 1 | 2 | 3}
						/>
					))}
				</div>

				{/* Show count of remaining strategies */}
				{sortedStats.length > 3 && (
					<div className="mt-3 border-border/50 border-t pt-2 sm:mt-4 sm:pt-3">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							+{sortedStats.length - 3} more{" "}
							{sortedStats.length - 3 === 1 ? "strategy" : "strategies"}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
