import { AgCharts } from "ag-charts-react";
import { BarChart3, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RMultipleBucket {
	label: string;
	count: number;
	totalPnl: number;
	avgR: number;
}

interface RMultipleStats {
	totalTrades: number;
	tradesWithR: number;
	avgRMultiple: number;
	avgWinR: number;
	avgLossR: number;
	maxR: number;
	minR: number;
}

interface RMultipleChartProps {
	buckets: RMultipleBucket[];
	stats: RMultipleStats;
	className?: string;
}

/**
 * R-Multiple Distribution chart
 * Shows histogram of trades grouped by R-multiple buckets
 */
export function RMultipleChart({
	buckets,
	stats,
	className,
}: RMultipleChartProps) {
	const chartOptions = useMemo(() => {
		// Add colors to buckets based on R value
		const dataWithColors = buckets.map((bucket) => ({
			...bucket,
			fill: bucket.avgR >= 0 ? "#00ff88" : "#ff3b3b",
		}));

		return {
			background: { fill: "transparent" },
			data: dataWithColors,
			series: [
				{
					type: "bar" as const,
					xKey: "label",
					yKey: "count",
					fill: "#00ff88",
					cornerRadius: 2,
					formatter: (params: { datum: { avgR: number } }) => ({
						fill: params.datum.avgR >= 0 ? "#00ff88" : "#ff3b3b",
					}),
				},
			],
			axes: [
				{
					type: "category" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						rotation: -45,
					},
					line: { color: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
					},
					line: { color: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
					title: {
						text: "Trades",
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 10,
					},
				},
			],
		};
	}, [buckets]);

	const hasData = stats.tradesWithR > 0;
	const coverage =
		stats.totalTrades > 0
			? ((stats.tradesWithR / stats.totalTrades) * 100).toFixed(0)
			: "0";

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header with stats */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<BarChart3 className="h-5 w-5 text-primary" />
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono text-muted-foreground text-xs">
								R-Multiple Distribution
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										aria-label="Learn about R-Multiple"
										className="text-muted-foreground/60 transition-colors hover:text-primary"
										type="button"
									>
										<Info className="h-3 w-3" />
									</button>
								</TooltipTrigger>
								<TooltipContent
									className="max-w-[280px] space-y-2 border border-border bg-card p-3 text-foreground"
									side="top"
								>
									<div>
										<span className="font-medium text-primary text-xs">
											What:
										</span>
										<p className="text-muted-foreground text-xs">
											R-Multiple = Actual P&L ÷ Planned Risk. Shows how many
											times your risk you won or lost.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Why:
										</span>
										<p className="text-muted-foreground text-xs">
											Normalizes performance across different position sizes. 1R
											= hit stop loss, 2R = made 2x your risk.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											Goal:
										</span>
										<p className="text-muted-foreground text-xs">
											Average R {">"} 0.5 is good. Distribution should skew
											right (more big winners than losers).
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{stats.tradesWithR} of {stats.totalTrades} trades ({coverage}%
							have stop loss)
						</div>
					</div>
				</div>

				{/* Average R-Multiple */}
				<div className="text-right">
					<div
						className={cn(
							"font-bold font-mono text-2xl",
							stats.avgRMultiple > 0
								? "text-profit"
								: stats.avgRMultiple < 0
									? "text-loss"
									: "text-muted-foreground",
						)}
					>
						{hasData
							? `${stats.avgRMultiple >= 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R`
							: "—"}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Avg R-Multiple
					</div>
				</div>
			</div>

			{/* Chart */}
			{hasData ? (
				<div className="h-[200px]">
					{/* biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing */}
					<AgCharts options={chartOptions as any} style={{ height: "100%" }} />
				</div>
			) : (
				<div className="flex h-[200px] items-center justify-center rounded border border-border border-dashed bg-secondary/20">
					<div className="text-center">
						<BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
						<p className="font-mono text-muted-foreground text-xs">
							No trades with stop loss data
						</p>
						<p className="font-mono text-[10px] text-muted-foreground/60">
							Add stop loss to trades to see R-Multiple analysis
						</p>
					</div>
				</div>
			)}

			{/* Stats grid */}
			{hasData && (
				<div className="grid grid-cols-4 gap-2">
					<div className="rounded border border-border bg-secondary/30 p-2 text-center">
						<div className="flex items-center justify-center gap-1">
							<TrendingUp className="h-3 w-3 text-profit" />
							<span className="font-mono text-[10px] text-muted-foreground">
								Avg Win
							</span>
						</div>
						<div className="font-bold font-mono text-profit text-sm">
							+{stats.avgWinR.toFixed(2)}R
						</div>
					</div>
					<div className="rounded border border-border bg-secondary/30 p-2 text-center">
						<div className="flex items-center justify-center gap-1">
							<TrendingDown className="h-3 w-3 text-loss" />
							<span className="font-mono text-[10px] text-muted-foreground">
								Avg Loss
							</span>
						</div>
						<div className="font-bold font-mono text-loss text-sm">
							{stats.avgLossR.toFixed(2)}R
						</div>
					</div>
					<div className="rounded border border-border bg-secondary/30 p-2 text-center">
						<div className="font-mono text-[10px] text-muted-foreground">
							Best
						</div>
						<div className="font-bold font-mono text-profit text-sm">
							+{stats.maxR.toFixed(2)}R
						</div>
					</div>
					<div className="rounded border border-border bg-secondary/30 p-2 text-center">
						<div className="font-mono text-[10px] text-muted-foreground">
							Worst
						</div>
						<div className="font-bold font-mono text-loss text-sm">
							{stats.minR.toFixed(2)}R
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
