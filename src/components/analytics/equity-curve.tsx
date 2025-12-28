import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface EquityPoint {
	date: string;
	equity: number;
	peak: number;
	drawdown: number;
	drawdownPercent: number;
	pnl: number;
	tradeIndex: number;
	tradeId: number | null;
	symbol: string | null;
}

interface EquityCurveProps {
	data: EquityPoint[];
	className?: string;
}

/**
 * Cumulative P&L curve with drawdown highlighting using AG Charts
 * Shows the running profit/loss starting from $0 with red-shaded drawdown periods
 */
export function EquityCurve({ data, className }: EquityCurveProps) {
	// Calculate stats for summary cards
	const { stats, isInDrawdown, chartData } = useMemo(() => {
		if (data.length === 0) {
			return {
				stats: {
					totalPnl: 0,
					peakPnl: 0,
					maxDrawdown: 0,
					maxDrawdownPercent: 0,
				},
				isInDrawdown: false,
				chartData: [],
			};
		}

		// equity field is now cumulative P&L (starting at $0)
		const totalPnl = data[data.length - 1]?.equity ?? 0;
		const peakPnl = data[data.length - 1]?.peak ?? 0;

		// Find max drawdown (use $ amount, works from $0 start)
		const maxDdPoint = data.reduce(
			(max, current) =>
				current.drawdown > (max?.drawdown ?? 0) ? current : max,
			null as EquityPoint | null,
		);

		const lastPoint = data[data.length - 1];
		const inDrawdown = (lastPoint?.drawdown ?? 0) > 0;

		// Transform data for AG Charts - round values to fix floating-point precision
		const transformed = data.map((d) => ({
			...d,
			// Round to 2 decimal places to avoid floating-point display issues
			equity: Math.round(d.equity * 100) / 100,
			peak: Math.round(d.peak * 100) / 100,
			pnl: Math.round(d.pnl * 100) / 100,
			drawdown: Math.round(d.drawdown * 100) / 100,
			dateObj: new Date(d.date),
			displayDate: new Date(d.date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
		}));

		return {
			stats: {
				totalPnl,
				peakPnl,
				maxDrawdown: maxDdPoint?.drawdown ?? 0,
			},
			isInDrawdown: inDrawdown,
			chartData: transformed,
		};
	}, [data]);

	// AG Charts configuration
	const chartOptions = useMemo(() => {
		if (chartData.length === 0) return {};

		return {
			background: { fill: "transparent" },
			data: chartData,
			series: [
				// Peak area (will show as "underwater" drawdown when below peak)
				{
					type: "area" as const,
					xKey: "tradeIndex",
					yKey: "peak",
					yName: "Peak",
					fill: "#ff3b3b20",
					stroke: "#64748b",
					strokeWidth: 1,
					strokeOpacity: 0.3,
					lineDash: [4, 4],
					marker: { enabled: false },
					tooltip: { enabled: false },
				},
				// Main cumulative P&L area (stacked on top, covers peak area where not in DD)
				{
					type: "area" as const,
					xKey: "tradeIndex",
					yKey: "equity",
					yName: "Cumulative P&L",
					fill: stats.totalPnl >= 0 ? "#00ff8820" : "#ff3b3b20",
					stroke: stats.totalPnl >= 0 ? "#00ff88" : "#ff3b3b",
					strokeWidth: 2,
					marker: {
						enabled: true,
						size: 5,
						fill: stats.totalPnl >= 0 ? "#00ff88" : "#ff3b3b",
						stroke: "#050505",
						strokeWidth: 1,
					},
					tooltip: {
						renderer: (params: {
							datum: {
								symbol: string | null;
								displayDate: string;
								tradeIndex: number;
								equity: number;
								pnl: number;
								drawdown: number;
							};
						}) => {
							const d = params.datum;
							// Values are already rounded in chartData transformation
							const pnlColor = d.pnl >= 0 ? "#00ff88" : "#ff3b3b";
							const cumulativeColor = d.equity >= 0 ? "#00ff88" : "#ff3b3b";
							const ddText =
								d.drawdown > 0
									? `<div style="color: #ff3b3b; margin-top: 4px;">Drawdown: <b>-${formatCurrency(d.drawdown)}</b></div>`
									: "";

							return {
								title: `${d.displayDate} · Trade #${d.tradeIndex}`,
								content: `
									${d.symbol ? `<div style="color: #d4ff00; font-weight: bold;">${d.symbol}</div>` : ""}
									<div style="margin-top: 4px;">Cumulative P&L: <b style="color: ${cumulativeColor}">${formatCurrency(d.equity)}</b></div>
									<div>Trade P&L: <b style="color: ${pnlColor}">${formatCurrency(d.pnl)}</b></div>
									${ddText}
								`,
							};
						},
					},
				},
			],
			axes: [
				{
					type: "number" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) => `#${params.value}`,
					},
					line: { color: "#1e293b" },
					tick: { color: "#1e293b" },
					gridLine: { enabled: false },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) => {
							const v = Math.round(params.value * 100) / 100;
							if (Math.abs(v) >= 1000) {
								return `$${(v / 1000).toFixed(1)}k`;
							}
							return `$${v.toFixed(0)}`;
						},
					},
					line: { color: "#1e293b" },
					tick: { color: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
			],
			legend: { enabled: false },
			tooltip: {
				class: "ag-chart-tooltip-dark",
			},
		};
	}, [chartData, stats.totalPnl]);

	if (data.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No P&L data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary stats */}
			<div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="text-muted-foreground">Cumulative P&L</div>
					<div className={stats.totalPnl >= 0 ? "text-profit" : "text-loss"}>
						{formatCurrency(stats.totalPnl)}
					</div>
				</div>
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="text-muted-foreground">Peak P&L</div>
					<div className={stats.peakPnl >= 0 ? "text-profit" : "text-loss"}>
						{formatCurrency(stats.peakPnl)}
					</div>
				</div>
				<div className="rounded border border-loss/30 bg-loss/5 p-2">
					<div className="text-muted-foreground">Max Drawdown</div>
					<div className="text-loss">{formatCurrency(stats.maxDrawdown)}</div>
				</div>
				<div
					className={cn(
						"rounded border p-2",
						isInDrawdown
							? "border-loss/30 bg-loss/5"
							: "border-profit/30 bg-profit/5",
					)}
				>
					<div className="text-muted-foreground">Status</div>
					<div className={isInDrawdown ? "text-loss" : "text-profit"}>
						{isInDrawdown ? "In Drawdown" : "At Peak"}
					</div>
				</div>
			</div>

			{/* Chart */}
			<div className="relative">
				{/* biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing */}
				<AgCharts options={chartOptions as any} style={{ height: 280 }} />

				{/* Legend overlay */}
				<div className="absolute right-4 bottom-8 flex items-center gap-4 font-mono text-[10px]">
					<div className="flex items-center gap-1.5">
						<div className="h-0.5 w-4 rounded bg-profit" />
						<span className="text-muted-foreground">P&L</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-0.5 w-4 rounded border border-muted-foreground/40 border-dashed" />
						<span className="text-muted-foreground">Peak</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-3 w-4 rounded bg-loss/20" />
						<span className="text-muted-foreground">Drawdown</span>
					</div>
				</div>

				{/* Total P&L label */}
				<div className="absolute top-2 right-4">
					<div className="font-mono text-[10px] text-muted-foreground">
						Total P&L
					</div>
					<div
						className={cn(
							"font-bold font-mono text-lg",
							stats.totalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(stats.totalPnl)}
					</div>
				</div>
			</div>

			{/* Trade count */}
			<div className="font-mono text-muted-foreground text-xs">
				{data.length} trades · Hover chart for details
			</div>
		</div>
	);
}
