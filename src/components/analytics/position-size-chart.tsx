import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { Info, Layers } from "lucide-react";
import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/shared";

interface PositionSizeBucket {
	label: string;
	range: string;
	trades: number;
	wins: number;
	losses: number;
	totalPnl: number;
	avgPnl: number;
	winRate: number;
}

/** Chart data point with fill color */
interface PositionSizeChartData extends PositionSizeBucket {
	fill: string;
}

interface PositionSizeStats {
	totalTrades: number;
	avgSize: number;
	minSize: number;
	maxSize: number;
}

interface PositionSizeChartProps {
	buckets: PositionSizeBucket[];
	stats: PositionSizeStats;
	className?: string;
}

/**
 * Position Sizing Analysis Chart
 * Shows performance by position size buckets (neutral, no opinions)
 */
export function PositionSizeChart({
	buckets,
	stats,
	className,
}: PositionSizeChartProps) {
	const chartOptions: AgCartesianChartOptions<PositionSizeChartData> =
		useMemo(() => {
			// Prepare data with colors based on P&L
			const dataWithColors = buckets.map((bucket) => ({
				...bucket,
				fill: bucket.avgPnl >= 0 ? "#00ff88" : "#ff3b3b",
			}));

			return {
				background: { fill: "transparent" },
				data: dataWithColors,
				series: [
					{
						type: "bar" as const,
						xKey: "label",
						yKey: "avgPnl",
						fill: "#00ff88",
						cornerRadius: 2,
						formatter: (params: { datum: { avgPnl: number } }) => ({
							fill: params.datum.avgPnl >= 0 ? "#00ff88" : "#ff3b3b",
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
						},
						line: { stroke: "#1e293b" },
						title: {
							text: "Percentile",
							color: "#64748b",
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 10,
						},
					},
					{
						type: "number" as const,
						position: "left" as const,
						label: {
							color: "#64748b",
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 9,
							formatter: (params: { value: number }) => `$${params.value}`,
						},
						line: { stroke: "#1e293b" },
						gridLine: { style: [{ stroke: "#ffffff08" }] },
						title: {
							text: "Avg P&L",
							color: "#64748b",
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 10,
						},
					},
				],
			};
		}, [buckets]);

	const hasData = stats.totalTrades > 0;

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary/50">
						<Layers className="h-5 w-5 text-primary" />
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono text-muted-foreground text-xs">
								Position Size Distribution
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										aria-label="Learn about Position Sizing"
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
											Shows your performance grouped by position size
											percentiles.
										</p>
									</div>
									<div>
										<span className="font-medium text-primary text-xs">
											How:
										</span>
										<p className="text-muted-foreground text-xs">
											Trades are grouped into quartiles based on quantity. Each
											bucket shows how you performed at that size level.
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
						<div className="font-mono text-[10px] text-muted-foreground">
							{stats.totalTrades} trades analyzed
						</div>
					</div>
				</div>

				{/* Size range */}
				<div className="text-right">
					<div className="font-bold font-mono text-foreground text-lg">
						{hasData
							? `${stats.minSize.toFixed(2)} - ${stats.maxSize.toFixed(2)}`
							: "—"}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						Size Range
					</div>
				</div>
			</div>

			{/* Chart */}
			{hasData ? (
				<div className="h-[180px]">
					<AgCharts options={chartOptions} style={{ height: "100%" }} />
				</div>
			) : (
				<div className="flex h-[180px] items-center justify-center rounded border border-border border-dashed bg-secondary/20">
					<div className="text-center">
						<Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
						<p className="font-mono text-muted-foreground text-xs">
							No trade data available
						</p>
					</div>
				</div>
			)}

			{/* Bucket breakdown table */}
			{hasData && (
				<div className="overflow-hidden rounded border border-border">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-secondary/50">
								<th className="px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground">
									Percentile
								</th>
								<th className="px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground">
									Qty Range
								</th>
								<th className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
									Trades
								</th>
								<th className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
									Win %
								</th>
								<th className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
									Avg P&L
								</th>
							</tr>
						</thead>
						<tbody>
							{buckets.map((bucket) => (
								<tr
									className="border-border border-b last:border-b-0"
									key={bucket.label}
								>
									<td className="px-2 py-1.5 font-mono text-xs">
										{bucket.label}
									</td>
									<td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
										{bucket.range}
									</td>
									<td className="px-2 py-1.5 text-right font-mono text-muted-foreground text-xs">
										{bucket.trades}
									</td>
									<td
										className={cn(
											"px-2 py-1.5 text-right font-mono text-xs",
											bucket.winRate >= 50 ? "text-profit" : "text-loss",
										)}
									>
										{bucket.trades > 0 ? `${bucket.winRate.toFixed(0)}%` : "—"}
									</td>
									<td
										className={cn(
											"px-2 py-1.5 text-right font-mono text-xs",
											bucket.avgPnl > 0
												? "text-profit"
												: bucket.avgPnl < 0
													? "text-loss"
													: "text-muted-foreground",
										)}
									>
										{bucket.trades > 0 ? formatCurrency(bucket.avgPnl) : "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
