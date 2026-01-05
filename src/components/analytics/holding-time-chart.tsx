"use client";

import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface HoldingTimeBucket {
	label: string;
	minMinutes: number;
	maxMinutes: number;
	trades: number;
	wins: number;
	losses: number;
	totalPnl: number;
	avgPnl: number;
	winRate: number;
}

interface HoldingTimeChartProps {
	buckets: HoldingTimeBucket[];
	optimalDuration: { label: string; avgPnl: number } | null;
	totalTrades: number;
	className?: string;
}

/**
 * Terminal-styled holding time analysis chart
 * Shows performance by trade duration buckets
 */
export function HoldingTimeChart({
	buckets,
	optimalDuration,
	totalTrades,
	className,
}: HoldingTimeChartProps) {
	// Find max values for scaling
	const { maxAbsPnl, maxTrades } = useMemo(() => {
		const absMax = Math.max(1, ...buckets.map((b) => Math.abs(b.avgPnl)));
		const tradesMax = Math.max(1, ...buckets.map((b) => b.trades));
		return { maxAbsPnl: absMax, maxTrades: tradesMax };
	}, [buckets]);

	const hasData = buckets.some((b) => b.trades > 0);

	if (!hasData) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No holding time data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Optimal Duration Card */}
			{optimalDuration && (
				<div className="flex items-center justify-between rounded border border-profit/20 bg-profit/5 p-3">
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Optimal Holding Time
						</div>
						<div className="mt-1 font-bold font-mono text-profit text-xl">
							{optimalDuration.label}
						</div>
					</div>
					<div className="text-right">
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Avg P&L
						</div>
						<div className="mt-1 font-medium font-mono text-lg text-profit">
							{formatCurrency(optimalDuration.avgPnl)}
						</div>
					</div>
				</div>
			)}

			{/* Duration Buckets */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Performance by Duration
					</div>
					<div className="font-mono text-muted-foreground/60 text-xs">
						{totalTrades} total trades
					</div>
				</div>

				<div className="space-y-1">
					{buckets.map((bucket) => {
						const isOptimal = optimalDuration?.label === bucket.label;
						const barWidth = Math.abs(bucket.avgPnl) / maxAbsPnl;
						const isProfit = bucket.avgPnl >= 0;
						const tradesPct = (bucket.trades / maxTrades) * 100;

						return (
							<div
								className={cn(
									"group relative rounded border border-transparent p-2 transition-all",
									"hover:border-border hover:bg-secondary/30",
									isOptimal && "border-profit/30 bg-profit/5",
								)}
								key={bucket.label}
							>
								<div className="flex items-center gap-3">
									{/* Duration label */}
									<div className="w-20 font-mono text-xs">
										<span
											className={cn(
												isOptimal
													? "font-medium text-profit"
													: "text-muted-foreground",
											)}
										>
											{bucket.label}
										</span>
									</div>

									{/* Bar container */}
									<div className="relative h-6 flex-1">
										{/* Background track */}
										<div className="absolute inset-0 rounded bg-secondary/50" />

										{/* Filled bar */}
										<div
											className={cn(
												"absolute inset-y-0 left-0 rounded transition-all",
												isProfit ? "bg-profit/70" : "bg-loss/70",
												bucket.trades === 0 && "opacity-0",
											)}
											style={{ width: `${barWidth * 100}%` }}
										/>

										{/* Glow for optimal */}
										{isOptimal && (
											<div
												className="absolute inset-y-0 left-0 rounded bg-profit/20 blur-sm"
												style={{ width: `${barWidth * 100}%` }}
											/>
										)}
									</div>

									{/* Stats */}
									<div className="flex items-center gap-3 font-mono text-xs">
										{/* Avg P&L */}
										<div
											className={cn(
												"w-16 text-right tabular-nums",
												bucket.trades === 0
													? "text-muted-foreground/50"
													: isProfit
														? "text-profit"
														: "text-loss",
											)}
										>
											{bucket.trades > 0 ? formatCurrency(bucket.avgPnl) : "-"}
										</div>

										{/* Trade distribution bar */}
										<div className="w-20">
											<div className="flex items-center gap-1">
												<div className="relative h-1.5 flex-1 rounded bg-secondary/50">
													<div
														className="absolute inset-y-0 left-0 rounded bg-muted-foreground/40"
														style={{ width: `${tradesPct}%` }}
													/>
												</div>
												<span className="w-8 text-right text-muted-foreground tabular-nums">
													{bucket.trades}
												</span>
											</div>
										</div>

										{/* Win rate */}
										<div
											className={cn(
												"w-12 text-right tabular-nums",
												bucket.trades === 0
													? "text-muted-foreground/50"
													: bucket.winRate >= 50
														? "text-profit/70"
														: "text-loss/70",
											)}
										>
											{bucket.trades > 0
												? `${bucket.winRate.toFixed(0)}%`
												: "-"}
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Column headers */}
				<div className="flex items-center justify-end gap-3 font-mono text-[10px] text-muted-foreground/60">
					<div className="w-16 text-right">Avg P&L</div>
					<div className="w-20 text-right">Trades</div>
					<div className="w-12 text-right">Win%</div>
				</div>
			</div>

			{/* Insights */}
			<div className="space-y-2 border-border border-t pt-4">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Insights
				</div>
				<div className="grid grid-cols-2 gap-2 font-mono text-xs">
					{/* Scalpers (< 5min) */}
					<div className="rounded bg-secondary/30 p-2">
						<div className="text-muted-foreground">Quick Trades (&lt;5min)</div>
						{(() => {
							const quickBucket = buckets.find((b) => b.label === "0-5min");
							if (!quickBucket || quickBucket.trades === 0) {
								return <div className="text-muted-foreground/60">No data</div>;
							}
							return (
								<>
									<div
										className={cn(
											"font-medium",
											quickBucket.avgPnl >= 0 ? "text-profit" : "text-loss",
										)}
									>
										{formatCurrency(quickBucket.avgPnl)} avg
									</div>
									<div className="text-muted-foreground/60">
										{quickBucket.trades} trades (
										{((quickBucket.trades / totalTrades) * 100).toFixed(0)}%)
									</div>
								</>
							);
						})()}
					</div>

					{/* Longer holds (> 30min) */}
					<div className="rounded bg-secondary/30 p-2">
						<div className="text-muted-foreground">Long Holds (&gt;30min)</div>
						{(() => {
							const longBuckets = buckets.filter((b) => b.minMinutes >= 30);
							const longTrades = longBuckets.reduce(
								(sum, b) => sum + b.trades,
								0,
							);
							const longPnl = longBuckets.reduce(
								(sum, b) => sum + b.totalPnl,
								0,
							);
							if (longTrades === 0) {
								return <div className="text-muted-foreground/60">No data</div>;
							}
							const avgPnl = longPnl / longTrades;
							return (
								<>
									<div
										className={cn(
											"font-medium",
											avgPnl >= 0 ? "text-profit" : "text-loss",
										)}
									>
										{formatCurrency(avgPnl)} avg
									</div>
									<div className="text-muted-foreground/60">
										{longTrades} trades (
										{((longTrades / totalTrades) * 100).toFixed(0)}%)
									</div>
								</>
							);
						})()}
					</div>
				</div>
			</div>
		</div>
	);
}
