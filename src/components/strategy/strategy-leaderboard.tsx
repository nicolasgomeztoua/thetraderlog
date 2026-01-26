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
			glow: "shadow-[0_0_20px_rgba(212,255,0,0.3)]",
		},
		2: {
			bg: "bg-white/10",
			border: "border-white/30",
			text: "text-white",
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
				"flex h-8 w-8 items-center justify-center rounded-full border font-bold font-mono text-sm",
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
				"group flex items-center gap-4 rounded border bg-white/2 p-3 transition-all hover:bg-white/5 sm:p-4",
				isTopPerformer
					? "border-primary/30 shadow-[0_0_15px_rgba(212,255,0,0.15)]"
					: "border-white/5 hover:border-white/10",
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
						className="h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: entry.strategyColor ?? "#d4ff00" }}
					/>
					<span className="truncate font-mono font-semibold text-sm transition-colors group-hover:text-primary sm:text-base">
						{entry.strategyName}
					</span>
				</div>
				<div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-xs">
					<span>{entry.totalTrades} trades</span>
					<span className="text-white/20">|</span>
					<span
						className={cn(entry.winRate >= 50 ? "text-profit" : "text-loss")}
					>
						{entry.winRate.toFixed(1)}% win
					</span>
				</div>
			</div>

			{/* P&L */}
			<div className="text-right">
				<span
					className={cn(
						"font-bold font-mono text-base sm:text-lg",
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
			className="overflow-hidden rounded border border-white/10 bg-black/80"
			data-testid="leaderboard-section"
		>
			{/* Terminal header */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
				<div className="flex items-center gap-2">
					<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					leaderboard.tsx
				</span>
			</div>

			{/* Content */}
			<div className="space-y-3 p-4">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
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
			className="overflow-hidden rounded border border-white/10 bg-black/80"
			data-testid="leaderboard-section"
		>
			{/* Terminal header with traffic light dots */}
			<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2">
				<div className="flex items-center gap-2">
					<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
					<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					leaderboard.tsx
				</span>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Section header */}
				<div className="mb-4 flex items-center gap-2">
					<Trophy className="h-4 w-4 text-primary" />
					<h2 className="font-mono text-[11px] text-primary uppercase tracking-widest">
						Top Performers
					</h2>
				</div>

				{/* Leaderboard entries */}
				<div className="space-y-2 sm:space-y-3">
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
					<div className="mt-4 border-white/5 border-t pt-3">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							+{sortedStats.length - 3} more{" "}
							{sortedStats.length - 3 === 1 ? "strategy" : "strategies"}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
