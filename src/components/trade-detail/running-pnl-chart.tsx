import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { formatInTimeZone } from "date-fns-tz";
import { useMemo } from "react";
import { useTimezone } from "@/hooks/use-timezone";
import { ANALYTICS_COLORS, CHART_AXIS_STYLE } from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/shared";
import type { RunningPnlPoint } from "@/lib/trades/running-pnl";

// =============================================================================
// TYPES
// =============================================================================

interface RunningPnlChartProps {
	/** P&L data points from generateRunningPnlSeries */
	data: RunningPnlPoint[];
	/** Optional CSS class */
	className?: string;
}

/** Chart data point with formatted time label */
interface ChartDataPoint extends RunningPnlPoint {
	timeLabel: string;
	pnlRounded: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Running P&L area chart with split coloring.
 * Shows green fill above zero, red fill below zero.
 * Uses Terminal design system styling (transparent background, monospace labels).
 */
export function RunningPnlChart({ data, className }: RunningPnlChartProps) {
	const { timezone } = useTimezone();

	// Transform data with formatted time labels
	const { chartData, stats } = useMemo(() => {
		if (data.length === 0) {
			return { chartData: [], stats: { finalPnl: 0, maxPnl: 0, minPnl: 0 } };
		}

		// Calculate stats for coloring decision
		const finalPnl = data[data.length - 1]?.pnl ?? 0;
		let maxPnl = -Infinity;
		let minPnl = Infinity;

		const transformed: ChartDataPoint[] = data.map((point) => {
			if (point.pnl > maxPnl) maxPnl = point.pnl;
			if (point.pnl < minPnl) minPnl = point.pnl;

			// Format timestamp in user's timezone
			const date = new Date(point.time * 1000);
			const timeLabel = formatInTimeZone(date, timezone, "HH:mm");

			return {
				...point,
				timeLabel,
				pnlRounded: Math.round(point.pnl * 100) / 100,
			};
		});

		return {
			chartData: transformed,
			stats: { finalPnl, maxPnl, minPnl },
		};
	}, [data, timezone]);

	// Determine fill/stroke colors based on final P&L
	const isProfitable = stats.finalPnl >= 0;
	const fillColor = isProfitable
		? ANALYTICS_COLORS.profitFill
		: ANALYTICS_COLORS.lossFill;
	const strokeColor = isProfitable
		? ANALYTICS_COLORS.profit
		: ANALYTICS_COLORS.loss;

	// AG Charts configuration
	const chartOptions: AgCartesianChartOptions<ChartDataPoint> = useMemo(() => {
		if (chartData.length === 0) return {};

		return {
			background: { fill: "transparent" },
			data: chartData,
			series: [
				{
					type: "area" as const,
					xKey: "timeLabel",
					yKey: "pnlRounded",
					yName: "P&L",
					fill: fillColor,
					stroke: strokeColor,
					strokeWidth: 2,
					marker: {
						enabled: chartData.length <= 50, // Only show markers for smaller datasets
						size: 4,
						fill: strokeColor,
						stroke: ANALYTICS_COLORS.background,
						strokeWidth: 1,
					},
					tooltip: {
						renderer: (params: { datum: ChartDataPoint }) => {
							const d = params.datum;
							const pnlColor =
								d.pnlRounded >= 0
									? ANALYTICS_COLORS.profit
									: ANALYTICS_COLORS.loss;

							// Format full timestamp for tooltip
							const date = new Date(d.time * 1000);
							const fullTime = formatInTimeZone(
								date,
								timezone,
								"MMM d, HH:mm:ss",
							);

							return {
								title: fullTime,
								content: `<div>P&L: <b style="color: ${pnlColor}">${formatCurrency(d.pnlRounded)}</b></div>`,
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
						// Skip labels if too many data points
						formatter: (params: { value: string; index: number }) => {
							// Show every Nth label based on data density
							const totalPoints = chartData.length;
							const skipInterval =
								totalPoints > 100
									? 20
									: totalPoints > 50
										? 10
										: totalPoints > 20
											? 5
											: 1;
							return params.index % skipInterval === 0 ? params.value : "";
						},
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
					// Include zero in range for reference
					crosshair: {
						enabled: true,
						snap: true,
						stroke: ANALYTICS_COLORS.muted,
						strokeWidth: 1,
					},
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
	}, [chartData, fillColor, strokeColor, timezone]);

	// Empty state
	if (data.length === 0) {
		return (
			<div
				className={cn(
					"flex h-full items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No P&L data available
			</div>
		);
	}

	return (
		<div className={cn("flex h-full flex-col", className)}>
			{/* Chart fills available space */}
			<div className="relative flex-1">
				<AgCharts
					options={chartOptions}
					style={{ width: "100%", height: "100%" }}
				/>

				{/* Final P&L label - positioned in top right */}
				<div className="absolute top-0 right-2 text-right">
					<div
						className={cn(
							"font-bold font-mono text-xl",
							stats.finalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(stats.finalPnl)}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						final P&L
					</div>
				</div>
			</div>
		</div>
	);
}
