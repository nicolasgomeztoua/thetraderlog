"use client";

import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/shared";

interface TradeCountBucket {
	tradeCount: number;
	days: number;
	totalPnl: number;
	avgDailyPnl: number;
	wins: number;
	losses: number;
	winRate: number;
}

interface OvertradingChartProps {
	byTradeCount: TradeCountBucket[];
	optimalRange: { min: number; max: number };
	overtradingThreshold: number;
	correlationScore: number;
	className?: string;
}

/**
 * Terminal-styled overtrading analysis chart
 * Shows performance by daily trade count
 */
export function OvertradingChart({
	byTradeCount,
	optimalRange,
	overtradingThreshold,
	correlationScore,
	className,
}: OvertradingChartProps) {
	// Find max values for scaling
	const { maxAbsPnl, maxDays } = useMemo(() => {
		const absMax = Math.max(
			1,
			...byTradeCount.map((b) => Math.abs(b.avgDailyPnl)),
		);
		const daysMax = Math.max(1, ...byTradeCount.map((b) => b.days));
		return { maxAbsPnl: absMax, maxDays: daysMax };
	}, [byTradeCount]);

	// Interpret correlation score
	const getCorrelationInterpretation = (score: number) => {
		if (score < -0.3) {
			return {
				label: "Overtrading Issue",
				description: "More trades = worse performance",
				color: "text-loss",
			};
		}
		if (score < 0.1) {
			return {
				label: "No Clear Pattern",
				description: "Trade count has minimal impact",
				color: "text-muted-foreground",
			};
		}
		return {
			label: "Good Scalability",
			description: "More trades = better performance",
			color: "text-profit",
		};
	};

	const correlation = getCorrelationInterpretation(correlationScore);

	if (byTradeCount.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No overtrading data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-3">
				{/* Optimal Range */}
				<div className="rounded border border-profit/20 bg-profit/5 p-3">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Optimal Range
					</div>
					<div className="mt-1 font-bold font-mono text-profit text-xl">
						{optimalRange.min}-{optimalRange.max}
					</div>
					<div className="font-mono text-muted-foreground/60 text-xs">
						trades/day
					</div>
				</div>

				{/* Overtrading Threshold */}
				<div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Caution After
					</div>
					<div className="mt-1 font-bold font-mono text-amber-400 text-xl">
						{overtradingThreshold}+
					</div>
					<div className="font-mono text-muted-foreground/60 text-xs">
						trades/day
					</div>
				</div>

				{/* Correlation */}
				<div className="rounded border border-border bg-secondary/30 p-3">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Pattern
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-sm",
							correlation.color,
						)}
					>
						{correlation.label}
					</div>
					<div className="font-mono text-muted-foreground/60 text-xs">
						r = {correlationScore.toFixed(2)}
					</div>
				</div>
			</div>

			{/* Trade Count Distribution */}
			<div className="space-y-3">
				<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Performance by Daily Trade Count
				</div>

				<div className="space-y-1">
					{byTradeCount.map((bucket) => {
						const isOptimal =
							bucket.tradeCount >= optimalRange.min &&
							bucket.tradeCount <= optimalRange.max;
						const isOvertrading = bucket.tradeCount >= overtradingThreshold;
						const barWidth = Math.abs(bucket.avgDailyPnl) / maxAbsPnl;
						const isProfit = bucket.avgDailyPnl >= 0;
						const daysWidth = (bucket.days / maxDays) * 100;

						return (
							<div
								className={cn(
									"group relative rounded border border-transparent p-2 transition-all",
									"hover:border-border hover:bg-secondary/30",
									isOptimal && "border-profit/30 bg-profit/5",
									isOvertrading &&
										!isOptimal &&
										"border-amber-500/30 bg-amber-500/5",
								)}
								key={bucket.tradeCount}
							>
								<div className="flex items-center gap-3">
									{/* Trade count label */}
									<div className="w-12 font-mono text-xs">
										<span
											className={cn(
												isOptimal
													? "text-profit"
													: isOvertrading
														? "text-amber-400"
														: "text-muted-foreground",
											)}
										>
											{bucket.tradeCount}t
										</span>
									</div>

									{/* Bar container */}
									<div className="relative h-6 flex-1">
										{/* Background track */}
										<div className="absolute inset-0 rounded bg-secondary/50" />

										{/* P&L bar from center */}
										<div
											className={cn(
												"absolute inset-y-0 rounded transition-all",
												isProfit ? "bg-profit/70" : "bg-loss/70",
											)}
											style={{
												width: `${barWidth * 50}%`,
												left: isProfit ? "50%" : `${50 - barWidth * 50}%`,
											}}
										/>

										{/* Center line */}
										<div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
									</div>

									{/* Stats */}
									<div className="flex items-center gap-3 font-mono text-xs">
										{/* Avg Daily P&L */}
										<div
											className={cn(
												"w-20 text-right tabular-nums",
												isProfit ? "text-profit" : "text-loss",
											)}
										>
											{formatCurrency(bucket.avgDailyPnl)}
										</div>

										{/* Days count with mini bar */}
										<div className="w-16">
											<div className="flex items-center gap-1">
												<div className="relative h-1.5 flex-1 rounded bg-secondary/50">
													<div
														className="absolute inset-y-0 left-0 rounded bg-muted-foreground/30"
														style={{ width: `${daysWidth}%` }}
													/>
												</div>
												<span className="text-muted-foreground tabular-nums">
													{bucket.days}d
												</span>
											</div>
										</div>

										{/* Win rate */}
										<div
											className={cn(
												"w-12 text-right tabular-nums",
												bucket.winRate >= 50
													? "text-profit/70"
													: "text-loss/70",
											)}
										>
											{bucket.winRate.toFixed(0)}%
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Legend */}
				<div className="flex items-center justify-between border-border border-t pt-3 font-mono text-[10px] text-muted-foreground">
					<div className="flex gap-4">
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded bg-profit/30 ring-1 ring-profit/50" />
							<span>Optimal Range</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded bg-amber-500/30 ring-1 ring-amber-500/50" />
							<span>Overtrading Zone</span>
						</div>
					</div>
					<div className="text-muted-foreground/60">Avg P&L | Days | Win%</div>
				</div>
			</div>
		</div>
	);
}
