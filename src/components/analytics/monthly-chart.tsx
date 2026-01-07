import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import {
	ANALYTICS_COLORS,
	CHART_AXIS_STYLE,
	CHART_DIMENSIONS,
	formatMonth as formatMonthIndex,
} from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/shared";

interface MonthData {
	month: string; // YYYY-MM format
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	avgPnl: number;
}

/** Chart data point with computed fields */
interface MonthlyChartData extends MonthData {
	cumulative: number;
	pnlRounded: number;
	monthLabel: string;
}

interface MonthlyChartProps {
	data: MonthData[];
	className?: string;
}

/**
 * Format month string (YYYY-MM) to display format (Jan '24)
 */
function formatMonth(monthStr: string): string {
	const [year, month] = monthStr.split("-");
	if (!year || !month) return monthStr;

	const monthIndex = parseInt(month, 10) - 1;
	const monthName = formatMonthIndex(monthIndex) || month;

	return `${monthName} '${year.slice(-2)}`;
}

/**
 * Terminal-styled monthly performance chart using AG Charts
 * Displays cumulative P&L as an area chart
 */
export function MonthlyChart({ data, className }: MonthlyChartProps) {
	// Calculate stats and transform data for AG Charts
	const { stats, chartData } = useMemo(() => {
		const profitableMonths = data.filter((d) => d.pnl > 0).length;
		const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
		const avgMonthlyPnl = data.length > 0 ? totalPnl / data.length : 0;
		const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);

		// Build chart data with cumulative values
		let cumulative = 0;
		const transformed = data.map((d) => {
			cumulative += d.pnl;
			return {
				...d,
				cumulative: Math.round(cumulative * 100) / 100,
				pnlRounded: Math.round(d.pnl * 100) / 100,
				monthLabel: formatMonth(d.month),
			};
		});

		return {
			stats: {
				profitableMonths,
				totalMonths: data.length,
				avgMonthlyPnl,
				totalPnl,
				totalTrades,
			},
			chartData: transformed,
		};
	}, [data]);

	// AG Charts configuration
	const chartOptions: AgCartesianChartOptions<MonthlyChartData> =
		useMemo(() => {
			if (chartData.length === 0) return {};

			return {
				background: { fill: "transparent" },
				data: chartData,
				series: [
					{
						type: "area" as const,
						xKey: "monthLabel",
						yKey: "cumulative",
						yName: "Cumulative P&L",
						fill:
							stats.totalPnl >= 0
								? ANALYTICS_COLORS.profitFill
								: ANALYTICS_COLORS.lossFill,
						stroke:
							stats.totalPnl >= 0
								? ANALYTICS_COLORS.profit
								: ANALYTICS_COLORS.loss,
						strokeWidth: CHART_DIMENSIONS.monthly.strokeWidth,
						marker: {
							enabled: true,
							size: CHART_DIMENSIONS.monthly.markerSize,
							fill:
								stats.totalPnl >= 0
									? ANALYTICS_COLORS.profit
									: ANALYTICS_COLORS.loss,
							stroke: ANALYTICS_COLORS.background,
							strokeWidth: 1,
						},
						tooltip: {
							renderer: (params: {
								datum: {
									monthLabel: string;
									pnlRounded: number;
									cumulative: number;
									trades: number;
									winRate: number;
								};
							}) => {
								const d = params.datum;
								const pnlColor =
									d.pnlRounded >= 0
										? ANALYTICS_COLORS.profit
										: ANALYTICS_COLORS.loss;
								const cumulativeColor =
									d.cumulative >= 0
										? ANALYTICS_COLORS.profit
										: ANALYTICS_COLORS.loss;

								return {
									title: d.monthLabel,
									content: `
									<div style="margin-bottom: 4px;">Cumulative: <b style="color: ${cumulativeColor}">${formatCurrency(d.cumulative)}</b></div>
									<div style="margin-bottom: 4px;">Monthly P&L: <b style="color: ${pnlColor}">${formatCurrency(d.pnlRounded)}</b></div>
									<div style="color: ${ANALYTICS_COLORS.mutedLight};">${d.trades} trades · ${d.winRate.toFixed(0)}% win rate</div>
								`,
								};
							},
						},
					},
				],
				axes: [
					{
						type: "category" as const,
						position: "bottom" as const,
						label: {
							color: CHART_AXIS_STYLE.label.fill,
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 10,
						},
						line: { stroke: CHART_AXIS_STYLE.line.stroke },
						tick: { stroke: CHART_AXIS_STYLE.tick.stroke },
						gridLine: { enabled: false },
						paddingInner: 0.2,
					},
					{
						type: "number" as const,
						position: "left" as const,
						label: {
							color: CHART_AXIS_STYLE.label.fill,
							fontFamily: "JetBrains Mono, monospace",
							fontSize: 10,
							formatter: (params: { value: number }) => {
								const v = params.value;
								if (Math.abs(v) >= 1000) {
									return `$${(v / 1000).toFixed(1)}k`;
								}
								return `$${v.toFixed(0)}`;
							},
						},
						line: { stroke: CHART_AXIS_STYLE.line.stroke },
						tick: { stroke: CHART_AXIS_STYLE.tick.stroke },
						gridLine: { style: [{ stroke: ANALYTICS_COLORS.gridMedium }] },
					},
				],
				legend: { enabled: false },
				padding: {
					top: 40,
					right: 20,
					bottom: 20,
					left: 10,
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
				No monthly data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			{/* Summary stats - compact row */}
			<div className="flex items-center gap-4 font-mono text-xs">
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Profitable:</span>
					<span
						className={
							stats.profitableMonths > stats.totalMonths / 2
								? "text-profit"
								: "text-loss"
						}
					>
						{stats.profitableMonths}/{stats.totalMonths}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Avg:</span>
					<span
						className={stats.avgMonthlyPnl >= 0 ? "text-profit" : "text-loss"}
					>
						{formatCurrency(stats.avgMonthlyPnl)}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Trades:</span>
					<span className="text-foreground">{stats.totalTrades}</span>
				</div>
			</div>

			{/* Chart */}
			<div className="relative">
				<AgCharts
					options={chartOptions}
					style={{ height: CHART_DIMENSIONS.monthly.height }}
				/>

				{/* Cumulative P&L label */}
				<div className="absolute top-0 right-2 text-right">
					<div
						className={cn(
							"font-bold font-mono text-xl",
							stats.totalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(stats.totalPnl)}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						cumulative
					</div>
				</div>
			</div>
		</div>
	);
}
