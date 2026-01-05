import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/shared";

interface DayData {
	day: string;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	avgPnl: number;
}

interface DayOfWeekChartProps {
	data: DayData[];
	className?: string;
}

/**
 * Terminal-styled horizontal bar visualization for day of week performance
 */
export function DayOfWeekChart({ data, className }: DayOfWeekChartProps) {
	// Find max absolute P&L for scaling bars
	const maxAbsPnl = useMemo(() => {
		const max = Math.max(...data.map((d) => Math.abs(d.pnl)));
		return max > 0 ? max : 1;
	}, [data]);

	// Find best and worst days
	const { bestDay, worstDay } = useMemo(() => {
		if (data.length === 0) return { bestDay: null, worstDay: null };

		const sorted = [...data].sort((a, b) => b.pnl - a.pnl);
		const best = sorted[0];
		const worst = sorted[sorted.length - 1];

		return {
			bestDay: best && best.pnl > 0 ? best : null,
			worstDay: worst && worst.pnl < 0 ? worst : null,
		};
	}, [data]);

	const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);

	if (totalTrades === 0) {
		return (
			<div
				className={cn(
					"flex h-[280px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No trade data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Best/Worst indicators */}
			<div className="flex gap-4 font-mono text-xs">
				{bestDay && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Best:</span>
						<span className="text-profit">
							{bestDay.day} ({formatCurrency(bestDay.pnl)})
						</span>
					</div>
				)}
				{worstDay && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Worst:</span>
						<span className="text-loss">
							{worstDay.day} ({formatCurrency(worstDay.pnl)})
						</span>
					</div>
				)}
			</div>

			{/* Column headers */}
			<div className="flex items-center gap-3 border-border border-b pb-2 font-mono text-[10px] text-muted-foreground">
				<div className="w-10">Day</div>
				<div className="flex-1">Performance</div>
				<div className="w-20 text-right">P&L</div>
				<div className="w-12 text-right">Trades</div>
				<div className="w-12 text-right">Win %</div>
			</div>

			{/* Day bars */}
			<div className="space-y-1">
				{data.map((day) => {
					const barWidth = Math.abs(day.pnl) / maxAbsPnl;
					const isProfit = day.pnl >= 0;
					const isBest = bestDay?.day === day.day;
					const isWorst = worstDay?.day === day.day;

					return (
						<div
							className={cn(
								"group relative rounded border border-transparent p-2 transition-all",
								"hover:border-border hover:bg-secondary/30",
								isBest && "border-profit/30 bg-profit/5",
								isWorst && "border-loss/30 bg-loss/5",
							)}
							key={day.day}
						>
							<div className="flex items-center gap-3">
								{/* Day label */}
								<div className="w-10 font-mono text-muted-foreground text-xs">
									{day.day}
								</div>

								{/* Bar container */}
								<div className="relative h-6 flex-1">
									{/* Background track */}
									<div className="absolute inset-0 rounded bg-secondary/50" />

									{/* Filled bar */}
									<div
										className={cn(
											"absolute inset-y-0 left-0 rounded transition-all duration-500",
											isProfit ? "bg-profit/70" : "bg-loss/70",
											"group-hover:opacity-100",
											day.trades === 0 && "opacity-30",
										)}
										style={{ width: `${barWidth * 100}%` }}
									/>

									{/* Glow effect for significant days */}
									{(isBest || isWorst) && (
										<div
											className={cn(
												"absolute inset-y-0 left-0 rounded blur-sm",
												isBest ? "bg-profit/30" : "bg-loss/30",
											)}
											style={{ width: `${barWidth * 100}%` }}
										/>
									)}
								</div>

								{/* Stats */}
								<div className="flex items-center gap-4 font-mono text-xs">
									{/* P&L */}
									<div
										className={cn(
											"w-20 text-right tabular-nums",
											isProfit ? "text-profit" : "text-loss",
											day.trades === 0 && "text-muted-foreground",
										)}
									>
										{day.trades > 0 ? formatCurrency(day.pnl) : "—"}
									</div>

									{/* Trades count */}
									<div className="w-12 text-right text-muted-foreground tabular-nums">
										{day.trades > 0 ? `${day.trades}t` : "—"}
									</div>

									{/* Win rate */}
									<div
										className={cn(
											"w-12 text-right tabular-nums",
											day.winRate >= 50 ? "text-profit/70" : "text-loss/70",
											day.trades === 0 && "text-muted-foreground",
										)}
									>
										{day.trades > 0 ? `${day.winRate.toFixed(0)}%` : "—"}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
