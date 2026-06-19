"use client";

import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import { ANALYTICS_COLORS, CHART_AXIS_STYLE } from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface EquityCurvePoint {
	date: Date;
	equity: number;
	peak: number;
	drawdown: number;
	drawdownPercent: number;
}

interface DrawdownChartProps {
	equityCurve: EquityCurvePoint[];
	maxDrawdownPercent: number;
	dailyLossLimit: number;
	initialBalance: number;
	className?: string;
}

/** Chart data with computed display fields */
interface ChartDataPoint extends EquityCurvePoint {
	index: number;
	displayDate: string;
	/** Threshold line: max drawdown $ below initial (negative P&L) */
	maxDrawdownThreshold: number;
	/** Threshold line: daily loss limit $ below initial (negative P&L) */
	dailyLossThreshold: number;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Prop drawdown chart — equity curve overlaid with max drawdown
 * and daily loss threshold lines. Shaded danger zone below drawdown threshold.
 */
export function DrawdownChart({
	equityCurve,
	maxDrawdownPercent,
	dailyLossLimit,
	initialBalance,
	className,
}: DrawdownChartProps) {
	const { chartData, stats } = useMemo(() => {
		if (equityCurve.length === 0) {
			return { chartData: [], stats: null };
		}

		// Convert percentage thresholds to dollar amounts (as negative P&L from $0 start)
		const maxDdDollar = -(initialBalance * (maxDrawdownPercent / 100));
		const dailyLossDollar = -(initialBalance * (dailyLossLimit / 100));

		const transformed: ChartDataPoint[] = equityCurve.map((p, i) => ({
			...p,
			index: i + 1,
			equity: Math.round(p.equity * 100) / 100,
			peak: Math.round(p.peak * 100) / 100,
			drawdown: Math.round(p.drawdown * 100) / 100,
			displayDate: new Date(p.date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
			maxDrawdownThreshold: Math.round(maxDdDollar * 100) / 100,
			dailyLossThreshold: Math.round(dailyLossDollar * 100) / 100,
		}));

		const lastPoint = equityCurve[equityCurve.length - 1];
		const totalPnl = lastPoint?.equity ?? 0;
		const currentDrawdown = lastPoint?.drawdown ?? 0;
		const distanceToThreshold = Math.abs(maxDdDollar) - currentDrawdown;

		return {
			chartData: transformed,
			stats: {
				totalPnl,
				currentDrawdown,
				distanceToThreshold,
				maxDdDollar: Math.abs(maxDdDollar),
				dailyLossDollar: Math.abs(dailyLossDollar),
			},
		};
	}, [equityCurve, maxDrawdownPercent, dailyLossLimit, initialBalance]);

	const chartOptions: AgCartesianChartOptions<ChartDataPoint> = useMemo(() => {
		if (chartData.length === 0) return { data: [] };

		return {
			background: { fill: "transparent" },
			data: chartData,
			series: [
				// Danger zone fill below max drawdown threshold
				{
					type: "area" as const,
					xKey: "index",
					yKey: "maxDrawdownThreshold",
					yName: "Danger Zone",
					fill: `${ANALYTICS_COLORS.loss}10`,
					stroke: "transparent",
					marker: { enabled: false },
					tooltip: { enabled: false },
				},
				// Max drawdown threshold line (red dashed)
				{
					type: "line" as const,
					xKey: "index",
					yKey: "maxDrawdownThreshold",
					yName: "Max Drawdown",
					stroke: ANALYTICS_COLORS.loss,
					strokeWidth: 1.5,
					lineDash: [6, 4],
					marker: { enabled: false },
					tooltip: { enabled: false },
				},
				// Daily loss limit threshold line (orange dashed)
				{
					type: "line" as const,
					xKey: "index",
					yKey: "dailyLossThreshold",
					yName: "Daily Loss Limit",
					stroke: ANALYTICS_COLORS.breakeven,
					strokeWidth: 1,
					lineDash: [4, 4],
					marker: { enabled: false },
					tooltip: { enabled: false },
				},
				// Main equity curve area
				{
					type: "area" as const,
					xKey: "index",
					yKey: "equity",
					yName: "Cumulative P&L",
					fill:
						(stats?.totalPnl ?? 0) >= 0
							? ANALYTICS_COLORS.profitFill
							: ANALYTICS_COLORS.lossFill,
					stroke:
						(stats?.totalPnl ?? 0) >= 0
							? ANALYTICS_COLORS.profit
							: ANALYTICS_COLORS.loss,
					strokeWidth: 2,
					marker: {
						enabled: true,
						size: 4,
						fill:
							(stats?.totalPnl ?? 0) >= 0
								? ANALYTICS_COLORS.profit
								: ANALYTICS_COLORS.loss,
						stroke: ANALYTICS_COLORS.background,
						strokeWidth: 1,
					},
					tooltip: {
						renderer: (params: { datum: ChartDataPoint }) => {
							const d = params.datum;
							const pnlColor =
								d.equity >= 0 ? ANALYTICS_COLORS.profit : ANALYTICS_COLORS.loss;
							const ddText =
								d.drawdown > 0
									? `<div style="color: ${ANALYTICS_COLORS.loss}; margin-top: 4px;">Drawdown: <b>-${formatCurrency(d.drawdown)}</b> (${d.drawdownPercent.toFixed(1)}%)</div>`
									: "";
							const distText = stats
								? `<div style="color: ${ANALYTICS_COLORS.muted}; margin-top: 4px;">Distance to limit: <b>${formatCurrency(stats.maxDdDollar - d.drawdown)}</b></div>`
								: "";

							return {
								title: `${d.displayDate} · Trade #${d.index}`,
								content: `
									<div>Cumulative P&L: <b style="color: ${pnlColor}">${formatCurrency(d.equity)}</b></div>
									${ddText}
									${distText}
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
						color: CHART_AXIS_STYLE.label.fill,
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) => `#${params.value}`,
					},
					line: { stroke: CHART_AXIS_STYLE.line.stroke },
					tick: { stroke: CHART_AXIS_STYLE.tick.stroke },
					gridLine: { enabled: false },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: CHART_AXIS_STYLE.label.fill,
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
					line: { stroke: CHART_AXIS_STYLE.line.stroke },
					tick: { stroke: CHART_AXIS_STYLE.tick.stroke },
					gridLine: {
						style: [{ stroke: ANALYTICS_COLORS.gridLight }],
					},
				},
			],
			legend: { enabled: false },
		};
	}, [chartData, stats]);

	if (equityCurve.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[280px] items-center justify-center rounded border border-white/5 bg-white/1 font-mono text-muted-foreground text-xs",
					className,
				)}
				data-testid="drawdown-chart-empty"
			>
				No equity data — add trades to see drawdown chart
			</div>
		);
	}

	return (
		<div
			className={cn(
				"h-fit rounded border border-white/5 bg-white/1 p-4",
				className,
			)}
			data-testid="drawdown-chart"
		>
			{/* Header */}
			<div className="mb-3 flex items-center justify-between">
				<div>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Equity Curve
					</span>
					<h3 className="font-mono font-semibold text-sm">
						Drawdown vs Thresholds
					</h3>
				</div>
				{stats && (
					<div className="text-right">
						<div className="font-mono text-[10px] text-muted-foreground">
							Distance to Limit
						</div>
						<div
							className={cn(
								"font-mono font-semibold text-sm",
								stats.distanceToThreshold > stats.maxDdDollar * 0.3
									? "text-profit"
									: stats.distanceToThreshold > stats.maxDdDollar * 0.1
										? "text-primary"
										: "text-loss",
							)}
							data-testid="drawdown-chart-distance"
						>
							{formatCurrency(stats.distanceToThreshold)}
						</div>
					</div>
				)}
			</div>

			{/* Chart */}
			<div className="relative" data-testid="drawdown-chart-area">
				<AgCharts options={chartOptions} style={{ height: 280 }} />

				{/* Legend overlay */}
				<div className="absolute right-4 bottom-8 flex flex-wrap items-center gap-3 font-mono text-[10px]">
					<div className="flex items-center gap-1.5">
						<div className="h-0.5 w-4 rounded bg-profit" />
						<span className="text-muted-foreground">P&L</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-0.5 w-4 rounded border border-loss border-dashed" />
						<span className="text-muted-foreground">Max DD</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-0.5 w-4 rounded border border-breakeven border-dashed" />
						<span className="text-muted-foreground">Daily Loss</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="h-3 w-4 rounded bg-loss/10" />
						<span className="text-muted-foreground">Danger Zone</span>
					</div>
				</div>
			</div>

			{/* Summary stats */}
			{stats && (
				<div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
					<div className="rounded border border-white/5 bg-white/2 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Current P&L
						</div>
						<div className={stats.totalPnl >= 0 ? "text-profit" : "text-loss"}>
							{formatCurrency(stats.totalPnl)}
						</div>
					</div>
					<div className="rounded border border-white/5 bg-white/2 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Drawdown
						</div>
						<div
							className={
								stats.currentDrawdown > 0
									? "text-loss"
									: "text-muted-foreground"
							}
						>
							{stats.currentDrawdown > 0
								? `-${formatCurrency(stats.currentDrawdown)}`
								: "$0.00"}
						</div>
					</div>
					<div className="rounded border border-loss/20 bg-loss/5 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Max DD Limit
						</div>
						<div className="text-loss">
							-{formatCurrency(stats.maxDdDollar)}
						</div>
					</div>
					<div className="rounded border border-breakeven/20 bg-breakeven/5 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Daily Loss Limit
						</div>
						<div className="text-breakeven">
							-{formatCurrency(stats.dailyLossDollar)}
						</div>
					</div>
				</div>
			)}

			{/* Trade count */}
			<div className="mt-2 font-mono text-muted-foreground text-xs">
				{equityCurve.length} trades · Hover chart for details
			</div>
		</div>
	);
}
