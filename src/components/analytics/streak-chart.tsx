"use client";

import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface StreakDistribution {
	streakLength: number;
	count: number;
	totalPnl: number;
}

interface PerformanceDuringStreaks {
	duringWinStreak: { trades: number; pnl: number; avgPnl: number };
	duringLossStreak: { trades: number; pnl: number; avgPnl: number };
	noStreak: { trades: number; pnl: number; avgPnl: number };
}

interface StreakChartProps {
	currentStreak: { type: "win" | "loss" | "none"; count: number };
	maxWinStreak: number;
	maxLossStreak: number;
	streakDistribution: {
		wins: StreakDistribution[];
		losses: StreakDistribution[];
	};
	performanceDuringStreaks: PerformanceDuringStreaks;
	className?: string;
}

/**
 * Terminal-styled streak analysis visualization
 * Shows current/max streaks and streak distribution
 */
export function StreakChart({
	currentStreak,
	maxWinStreak,
	maxLossStreak,
	streakDistribution,
	performanceDuringStreaks,
	className,
}: StreakChartProps) {
	// Find max count for scaling bars
	const maxCount = useMemo(() => {
		const allCounts = [
			...streakDistribution.wins.map((s) => s.count),
			...streakDistribution.losses.map((s) => s.count),
		];
		return Math.max(1, ...allCounts);
	}, [streakDistribution]);

	// Combine wins and losses for display
	const maxStreakLength = useMemo(() => {
		const winMax = Math.max(
			0,
			...streakDistribution.wins.map((s) => s.streakLength),
		);
		const lossMax = Math.max(
			0,
			...streakDistribution.losses.map((s) => s.streakLength),
		);
		return Math.max(winMax, lossMax, 5);
	}, [streakDistribution]);

	const hasData =
		streakDistribution.wins.length > 0 || streakDistribution.losses.length > 0;

	if (!hasData) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No streak data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Current and Max Streak Cards */}
			<div className="grid grid-cols-3 gap-3">
				{/* Current Streak */}
				<div
					className={cn(
						"rounded border p-3",
						currentStreak.type === "win"
							? "border-profit/30 bg-profit/5"
							: currentStreak.type === "loss"
								? "border-loss/30 bg-loss/5"
								: "border-border bg-secondary/30",
					)}
				>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Current
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-xl",
							currentStreak.type === "win"
								? "text-profit"
								: currentStreak.type === "loss"
									? "text-loss"
									: "text-muted-foreground",
						)}
					>
						{currentStreak.type === "none"
							? "0"
							: `${currentStreak.count}${currentStreak.type === "win" ? "W" : "L"}`}
					</div>
				</div>

				{/* Max Win Streak */}
				<div className="rounded border border-profit/20 bg-profit/5 p-3">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Max Wins
					</div>
					<div className="mt-1 font-bold font-mono text-profit text-xl">
						{maxWinStreak}
					</div>
				</div>

				{/* Max Loss Streak */}
				<div className="rounded border border-loss/20 bg-loss/5 p-3">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Max Losses
					</div>
					<div className="mt-1 font-bold font-mono text-loss text-xl">
						{maxLossStreak}
					</div>
				</div>
			</div>

			{/* Streak Distribution Chart */}
			<div className="space-y-3">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Streak Distribution
				</div>

				<div className="space-y-2">
					{Array.from({ length: maxStreakLength }, (_, i) => i + 1).map(
						(streakLength) => {
							const winData = streakDistribution.wins.find(
								(s) => s.streakLength === streakLength,
							);
							const lossData = streakDistribution.losses.find(
								(s) => s.streakLength === streakLength,
							);

							const winCount = winData?.count ?? 0;
							const lossCount = lossData?.count ?? 0;
							const winWidth = (winCount / maxCount) * 100;
							const lossWidth = (lossCount / maxCount) * 100;

							return (
								<div
									className="group flex items-center gap-3"
									key={streakLength}
								>
									{/* Streak length label */}
									<div className="w-8 font-mono text-muted-foreground text-xs">
										{streakLength}x
									</div>

									{/* Bars container */}
									<div className="flex flex-1 gap-2">
										{/* Win bar */}
										<div className="relative h-5 flex-1">
											<div className="absolute inset-0 rounded bg-secondary/30" />
											{winCount > 0 && (
												<div
													className="absolute inset-y-0 left-0 rounded bg-profit/60 transition-all group-hover:bg-profit/80"
													style={{ width: `${winWidth}%` }}
												/>
											)}
										</div>

										{/* Loss bar */}
										<div className="relative h-5 flex-1">
											<div className="absolute inset-0 rounded bg-secondary/30" />
											{lossCount > 0 && (
												<div
													className="absolute inset-y-0 left-0 rounded bg-loss/60 transition-all group-hover:bg-loss/80"
													style={{ width: `${lossWidth}%` }}
												/>
											)}
										</div>
									</div>

									{/* Counts */}
									<div className="flex w-24 gap-3 font-mono text-xs">
										<span
											className={cn(
												"w-10 text-right",
												winCount > 0
													? "text-profit"
													: "text-muted-foreground/50",
											)}
										>
											{winCount > 0 ? winCount : "-"}
										</span>
										<span
											className={cn(
												"w-10 text-right",
												lossCount > 0
													? "text-loss"
													: "text-muted-foreground/50",
											)}
										>
											{lossCount > 0 ? lossCount : "-"}
										</span>
									</div>
								</div>
							);
						},
					)}
				</div>

				{/* Legend */}
				<div className="flex justify-end gap-4 font-mono text-[10px]">
					<div className="flex items-center gap-1.5">
						<div className="h-2 w-2 rounded bg-profit" />
						<span className="text-muted-foreground">Win Streaks</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-2 w-2 rounded bg-loss" />
						<span className="text-muted-foreground">Loss Streaks</span>
					</div>
				</div>
			</div>

			{/* Performance During Streaks */}
			<div className="space-y-2 border-border border-t pt-4">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Performance During Streaks
				</div>
				<div className="grid grid-cols-3 gap-2 font-mono text-xs">
					<div className="rounded bg-secondary/30 p-2">
						<div className="text-muted-foreground">During Win Streak</div>
						<div
							className={cn(
								"font-medium",
								performanceDuringStreaks.duringWinStreak.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{formatCurrency(performanceDuringStreaks.duringWinStreak.avgPnl)}{" "}
							avg
						</div>
						<div className="text-muted-foreground/60">
							{performanceDuringStreaks.duringWinStreak.trades} trades
						</div>
					</div>
					<div className="rounded bg-secondary/30 p-2">
						<div className="text-muted-foreground">During Loss Streak</div>
						<div
							className={cn(
								"font-medium",
								performanceDuringStreaks.duringLossStreak.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{formatCurrency(performanceDuringStreaks.duringLossStreak.avgPnl)}{" "}
							avg
						</div>
						<div className="text-muted-foreground/60">
							{performanceDuringStreaks.duringLossStreak.trades} trades
						</div>
					</div>
					<div className="rounded bg-secondary/30 p-2">
						<div className="text-muted-foreground">No Streak</div>
						<div
							className={cn(
								"font-medium",
								performanceDuringStreaks.noStreak.avgPnl >= 0
									? "text-profit"
									: "text-loss",
							)}
						>
							{formatCurrency(performanceDuringStreaks.noStreak.avgPnl)} avg
						</div>
						<div className="text-muted-foreground/60">
							{performanceDuringStreaks.noStreak.trades} trades
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
