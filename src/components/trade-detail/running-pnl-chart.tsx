import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { formatInTimeZone } from "date-fns-tz";
import { useMemo } from "react";
import { useTimezone } from "@/hooks/use-timezone";
import { ANALYTICS_COLORS, CHART_AXIS_STYLE } from "@/lib/analytics";
import { cn, formatCurrency, toUnixTimestamp } from "@/lib/shared";
import type { Execution, RunningPnlPoint } from "@/lib/trades/running-pnl";
import { calculateRunningPnlAtTime } from "@/lib/trades/running-pnl";

// =============================================================================
// TYPES
// =============================================================================

interface RunningPnlChartProps {
	/** P&L data points from generateRunningPnlSeries */
	data: RunningPnlPoint[];
	/** Trade executions to display as markers */
	executions?: Execution[];
	/** Trade direction for P&L calculation */
	direction?: "long" | "short";
	/** Trading symbol (e.g., "ES", "EUR/USD") */
	symbol?: string;
	/** Instrument type for P&L calculation */
	instrumentType?: "futures" | "forex";
	/** Optional CSS class */
	className?: string;
}

/** Chart data point with formatted time label */
interface ChartDataPoint extends RunningPnlPoint {
	timeLabel: string;
	pnlRounded: number;
}

/** Execution marker data point for scatter series */
interface ExecutionMarkerPoint {
	timeLabel: string;
	pnl: number;
	executionType: "entry" | "exit" | "scale_in" | "scale_out";
	price: number;
	quantity: number;
	time: number; // Unix timestamp for tooltip
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Marker colors following Terminal design system */
const MARKER_COLORS = {
	entry: ANALYTICS_COLORS.primary, // Chartreuse (#d4ff00)
	exit: ANALYTICS_COLORS.secondary, // Ice blue (#00d4ff)
	scale_in: ANALYTICS_COLORS.primary, // Chartreuse (smaller)
	scale_out: ANALYTICS_COLORS.secondary, // Ice blue (smaller)
} as const;

/** Marker sizes - entries/exits larger, scale operations smaller */
const MARKER_SIZES = {
	entry: 14,
	exit: 12,
	scale_in: 10,
	scale_out: 10,
} as const;

/** Execution type display labels */
const EXECUTION_TYPE_LABELS: Record<
	ExecutionMarkerPoint["executionType"],
	string
> = {
	entry: "Entry",
	exit: "Exit",
	scale_in: "Scale In",
	scale_out: "Scale Out",
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Running P&L area chart with split coloring and execution markers.
 * Shows green fill above zero, red fill below zero.
 * Entry markers: chartreuse diamond
 * Exit markers: ice blue circle
 * Scale markers: smaller versions of entry/exit
 * Uses Terminal design system styling (transparent background, monospace labels).
 */
export function RunningPnlChart({
	data,
	executions,
	direction,
	symbol,
	instrumentType,
	className,
}: RunningPnlChartProps) {
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

	// Transform executions into marker data points
	const executionMarkers = useMemo((): ExecutionMarkerPoint[] => {
		if (!executions || !direction || !symbol || !instrumentType) {
			return [];
		}

		return executions.map((exec) => {
			const execTime = toUnixTimestamp(exec.executedAt);
			const date = new Date(execTime * 1000);
			const timeLabel = formatInTimeZone(date, timezone, "HH:mm");

			// Get executions visible at this execution's time
			const visibleExecutions = executions.filter((e) => {
				const eTime = toUnixTimestamp(e.executedAt);
				return eTime <= execTime;
			});

			// Calculate P&L at this execution point
			const execPrice = parseFloat(exec.price);
			const pnl = calculateRunningPnlAtTime(
				visibleExecutions,
				execPrice,
				direction,
				symbol,
				instrumentType,
			);

			return {
				timeLabel,
				pnl: Math.round(pnl * 100) / 100,
				executionType: exec.executionType,
				price: execPrice,
				quantity: parseFloat(exec.quantity),
				time: execTime,
			};
		});
	}, [executions, direction, symbol, instrumentType, timezone]);

	// Create scatter series configurations for each execution type
	const createExecutionScatterSeries = useMemo(() => {
		// Group markers by execution type for separate series
		const entryMarkers = executionMarkers.filter(
			(m) => m.executionType === "entry",
		);
		const exitMarkers = executionMarkers.filter(
			(m) => m.executionType === "exit",
		);
		const scaleInMarkers = executionMarkers.filter(
			(m) => m.executionType === "scale_in",
		);
		const scaleOutMarkers = executionMarkers.filter(
			(m) => m.executionType === "scale_out",
		);

		// Create tooltip renderer for execution markers
		const createTooltipRenderer = (
			execType: ExecutionMarkerPoint["executionType"],
		) => {
			return (params: { datum: ExecutionMarkerPoint }) => {
				const d = params.datum;
				const date = new Date(d.time * 1000);
				const fullTime = formatInTimeZone(date, timezone, "MMM d, HH:mm:ss");
				const pnlColor =
					d.pnl >= 0 ? ANALYTICS_COLORS.profit : ANALYTICS_COLORS.loss;
				const markerColor = MARKER_COLORS[execType];

				return {
					title: `<span style="color: ${markerColor}">${EXECUTION_TYPE_LABELS[execType]}</span>`,
					content: `
						<div>Time: ${fullTime}</div>
						<div>Price: <b>${formatCurrency(d.price)}</b></div>
						<div>Quantity: <b>${d.quantity}</b></div>
						<div>P&L: <b style="color: ${pnlColor}">${formatCurrency(d.pnl)}</b></div>
					`,
				};
			};
		};

		// Build series array (only include types that have data)
		const scatterSeries: Array<{
			type: "scatter";
			data: ExecutionMarkerPoint[];
			xKey: string;
			yKey: string;
			yName: string;
			marker: {
				size: number;
				fill: string;
				stroke: string;
				strokeWidth: number;
				shape: "diamond" | "circle" | "triangle" | "square";
			};
			tooltip: {
				renderer: (params: { datum: ExecutionMarkerPoint }) => {
					title: string;
					content: string;
				};
			};
		}> = [];

		if (entryMarkers.length > 0) {
			scatterSeries.push({
				type: "scatter" as const,
				data: entryMarkers,
				xKey: "timeLabel",
				yKey: "pnl",
				yName: "Entry",
				marker: {
					size: MARKER_SIZES.entry,
					fill: MARKER_COLORS.entry,
					stroke: ANALYTICS_COLORS.background,
					strokeWidth: 2,
					shape: "diamond" as const,
				},
				tooltip: { renderer: createTooltipRenderer("entry") },
			});
		}

		if (exitMarkers.length > 0) {
			scatterSeries.push({
				type: "scatter" as const,
				data: exitMarkers,
				xKey: "timeLabel",
				yKey: "pnl",
				yName: "Exit",
				marker: {
					size: MARKER_SIZES.exit,
					fill: MARKER_COLORS.exit,
					stroke: ANALYTICS_COLORS.background,
					strokeWidth: 2,
					shape: "circle" as const,
				},
				tooltip: { renderer: createTooltipRenderer("exit") },
			});
		}

		if (scaleInMarkers.length > 0) {
			scatterSeries.push({
				type: "scatter" as const,
				data: scaleInMarkers,
				xKey: "timeLabel",
				yKey: "pnl",
				yName: "Scale In",
				marker: {
					size: MARKER_SIZES.scale_in,
					fill: MARKER_COLORS.scale_in,
					stroke: ANALYTICS_COLORS.background,
					strokeWidth: 1,
					shape: "triangle" as const,
				},
				tooltip: { renderer: createTooltipRenderer("scale_in") },
			});
		}

		if (scaleOutMarkers.length > 0) {
			scatterSeries.push({
				type: "scatter" as const,
				data: scaleOutMarkers,
				xKey: "timeLabel",
				yKey: "pnl",
				yName: "Scale Out",
				marker: {
					size: MARKER_SIZES.scale_out,
					fill: MARKER_COLORS.scale_out,
					stroke: ANALYTICS_COLORS.background,
					strokeWidth: 1,
					shape: "square" as const,
				},
				tooltip: { renderer: createTooltipRenderer("scale_out") },
			});
		}

		return scatterSeries;
	}, [executionMarkers, timezone]);

	// AG Charts configuration
	const chartOptions: AgCartesianChartOptions = useMemo(() => {
		if (chartData.length === 0) return {};

		// Build series array: area series first, then execution markers on top
		const series: AgCartesianChartOptions["series"] = [
			{
				type: "area" as const,
				data: chartData,
				xKey: "timeLabel",
				yKey: "pnlRounded",
				yName: "P&L",
				fill: fillColor,
				stroke: strokeColor,
				strokeWidth: 2,
				marker: {
					enabled: chartData.length <= 50 && executionMarkers.length === 0,
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
			// Add execution marker scatter series
			...createExecutionScatterSeries,
		];

		return {
			background: { fill: "transparent" },
			series,
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
	}, [
		chartData,
		fillColor,
		strokeColor,
		timezone,
		createExecutionScatterSeries,
		executionMarkers.length,
	]);

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
