"use client";

import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import {
	ANALYTICS_COLORS,
	CHART_AXIS_STYLE,
	CHART_DIMENSIONS,
} from "@/lib/analytics";
import {
	calculateForexPnL,
	calculateFuturesPnL,
} from "@/lib/market-data/symbols";
import { cn, formatCurrency, STALE_TIME_MEDIUM } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface Execution {
	id: string;
	executionType: "entry" | "exit" | "scale_in" | "scale_out";
	executedAt: Date | string;
	price: string;
	quantity: string;
	realizedPnl?: string | null;
}

interface RunningPnlChartProps {
	symbol: string;
	direction: "long" | "short";
	instrumentType: "futures" | "forex";
	entryTime: Date | string | null;
	exitTime?: Date | string | null;
	entryPrice: string | null;
	executions?: Execution[];
	className?: string;
}

interface PnlDataPoint {
	time: number; // Unix timestamp in seconds
	displayTime: string; // Formatted time for display
	pnl: number;
}

interface PnlStats {
	finalPnl: number;
	peakPnl: number;
	maxDrawdown: number;
}

// =============================================================================
// P&L TIME SERIES BUILDER
// =============================================================================

function buildPnlTimeSeries(
	bars: Array<{
		time: number;
		open: number;
		high: number;
		low: number;
		close: number;
	}>,
	entryTime: Date,
	exitTime: Date | null,
	entryPrice: number,
	direction: "long" | "short",
	symbol: string,
	instrumentType: "futures" | "forex",
	executions: Execution[],
): { dataPoints: PnlDataPoint[]; stats: PnlStats } {
	if (bars.length === 0) {
		return {
			dataPoints: [],
			stats: { finalPnl: 0, peakPnl: 0, maxDrawdown: 0 },
		};
	}

	const entryTimestamp = Math.floor(entryTime.getTime() / 1000);
	const exitTimestamp = exitTime
		? Math.floor(exitTime.getTime() / 1000)
		: (bars[bars.length - 1]?.time ?? entryTimestamp);

	// Sort executions by time
	const sortedExecutions = [...executions].sort((a, b) => {
		const timeA = new Date(a.executedAt).getTime();
		const timeB = new Date(b.executedAt).getTime();
		return timeA - timeB;
	});

	// Build execution timeline for quantity tracking
	const executionEvents: Array<{
		timestamp: number;
		type: "entry" | "exit" | "scale_in" | "scale_out";
		quantity: number;
		price: number;
		realizedPnl: number;
	}> = sortedExecutions.map((exec) => ({
		timestamp: Math.floor(new Date(exec.executedAt).getTime() / 1000),
		type: exec.executionType,
		quantity: parseFloat(exec.quantity),
		price: parseFloat(exec.price),
		realizedPnl: parseFloat(exec.realizedPnl ?? "0"),
	}));

	// Filter bars from entry to exit (or last bar for open trades)
	const filteredBars = bars.filter(
		(bar) => bar.time >= entryTimestamp && bar.time <= exitTimestamp,
	);

	if (filteredBars.length === 0) {
		return {
			dataPoints: [],
			stats: { finalPnl: 0, peakPnl: 0, maxDrawdown: 0 },
		};
	}

	// Calculate P&L at each bar
	const dataPoints: PnlDataPoint[] = [];
	let currentQuantity = 0;
	let cumulativeRealizedPnl = 0;
	let executionIndex = 0;

	// Find entry execution to get initial quantity
	const entryExec = executionEvents.find((e) => e.type === "entry");
	if (entryExec) {
		currentQuantity = entryExec.quantity;
	}

	// Track peak and drawdown
	let peakPnl = Number.NEGATIVE_INFINITY;
	let maxDrawdown = 0;

	for (const bar of filteredBars) {
		// Process any executions that happened before or at this bar's time
		let currentExec = executionEvents[executionIndex];
		while (
			executionIndex < executionEvents.length &&
			currentExec &&
			currentExec.timestamp <= bar.time
		) {
			const exec = currentExec;

			switch (exec.type) {
				case "entry":
					// Entry already handled above
					break;
				case "scale_in":
					currentQuantity += exec.quantity;
					break;
				case "scale_out":
				case "exit":
					currentQuantity -= exec.quantity;
					cumulativeRealizedPnl += exec.realizedPnl;
					break;
			}

			executionIndex++;
			currentExec = executionEvents[executionIndex];
		}

		// Calculate unrealized P&L based on current position
		let unrealizedPnl = 0;
		if (currentQuantity > 0) {
			const calculatePnl =
				instrumentType === "futures" ? calculateFuturesPnL : calculateForexPnL;
			unrealizedPnl = calculatePnl(
				symbol,
				entryPrice,
				bar.close,
				currentQuantity,
				direction,
			);
		}

		const totalPnl = unrealizedPnl + cumulativeRealizedPnl;

		// Round to 2 decimal places to avoid floating-point precision issues
		const roundedPnl = Math.round(totalPnl * 100) / 100;

		// Track peak and drawdown
		if (roundedPnl > peakPnl) {
			peakPnl = roundedPnl;
		}
		const currentDrawdown = peakPnl - roundedPnl;
		if (currentDrawdown > maxDrawdown) {
			maxDrawdown = currentDrawdown;
		}

		// Format time for display (HH:mm)
		const date = new Date(bar.time * 1000);
		const displayTime = date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		dataPoints.push({
			time: bar.time,
			displayTime,
			pnl: roundedPnl,
		});
	}

	const finalPnl = dataPoints[dataPoints.length - 1]?.pnl ?? 0;

	return {
		dataPoints,
		stats: {
			finalPnl,
			peakPnl: peakPnl === Number.NEGATIVE_INFINITY ? 0 : peakPnl,
			maxDrawdown,
		},
	};
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RunningPnlChart({
	symbol,
	direction,
	instrumentType,
	entryTime,
	exitTime,
	entryPrice,
	executions = [],
	className,
}: RunningPnlChartProps) {
	// Fetch market data
	// Note: entryTime is guaranteed to be truthy when query is enabled
	const { data: chartData, isLoading } =
		api.marketData.getFullDayChartData.useQuery(
			{
				symbol,
				entryTime: entryTime ? new Date(entryTime).toISOString() : "",
				exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
			},
			{
				enabled: !!entryTime && !!entryPrice,
				staleTime: STALE_TIME_MEDIUM,
				refetchOnWindowFocus: false,
			},
		);

	// Build P&L time series
	const { dataPoints, stats } = useMemo(() => {
		if (!chartData?.bars?.length || !entryTime || !entryPrice) {
			return {
				dataPoints: [],
				stats: { finalPnl: 0, peakPnl: 0, maxDrawdown: 0 },
			};
		}

		return buildPnlTimeSeries(
			chartData.bars,
			new Date(entryTime),
			exitTime ? new Date(exitTime) : null,
			parseFloat(entryPrice),
			direction,
			symbol,
			instrumentType,
			executions,
		);
	}, [
		chartData,
		entryTime,
		exitTime,
		entryPrice,
		direction,
		symbol,
		instrumentType,
		executions,
	]);

	// AG Charts configuration
	const chartOptions: AgCartesianChartOptions<PnlDataPoint> = useMemo(() => {
		if (dataPoints.length === 0) return { data: [] };

		const isProfitable = stats.finalPnl >= 0;

		return {
			background: { fill: "transparent" },
			data: dataPoints,
			series: [
				{
					type: "area" as const,
					xKey: "time",
					yKey: "pnl",
					yName: "P&L",
					fill: isProfitable
						? ANALYTICS_COLORS.profitFill
						: ANALYTICS_COLORS.lossFill,
					stroke: isProfitable
						? ANALYTICS_COLORS.profit
						: ANALYTICS_COLORS.loss,
					strokeWidth: CHART_DIMENSIONS.runningPnl.strokeWidth,
					marker: { enabled: false },
					tooltip: {
						renderer: (params: { datum: PnlDataPoint }) => {
							const d = params.datum;
							const pnlColor =
								d.pnl >= 0 ? ANALYTICS_COLORS.profit : ANALYTICS_COLORS.loss;

							return {
								title: d.displayTime,
								content: `<div>P&L: <b style="color: ${pnlColor}">${formatCurrency(d.pnl)}</b></div>`,
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
						formatter: (params: { value: number }) => {
							const date = new Date(params.value * 1000);
							return date.toLocaleTimeString("en-US", {
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							});
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
					gridLine: { style: [{ stroke: ANALYTICS_COLORS.gridLight }] },
				},
			],
			legend: { enabled: false },
		};
	}, [dataPoints, stats.finalPnl]);

	// Loading state
	if (isLoading) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
				<p className="font-mono text-muted-foreground text-xs">
					Loading market data...
				</p>
			</div>
		);
	}

	// No entry time or price
	if (!entryTime || !entryPrice) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center text-muted-foreground",
					className,
				)}
			>
				<p className="font-mono text-xs">Entry time and price required</p>
			</div>
		);
	}

	// No market data available
	if (dataPoints.length === 0) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center text-muted-foreground",
					className,
				)}
			>
				<p className="font-mono text-sm">No market data available</p>
				<p className="mt-1 font-mono text-[10px] opacity-50">
					Market data may not be available for this symbol or time period
				</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary stats row */}
			<div className="grid grid-cols-3 gap-3 font-mono text-xs">
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="text-muted-foreground">Final P&L</div>
					<div className={stats.finalPnl >= 0 ? "text-profit" : "text-loss"}>
						{formatCurrency(stats.finalPnl)}
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
					<div className="text-loss">
						{stats.maxDrawdown > 0
							? `-${formatCurrency(stats.maxDrawdown)}`
							: formatCurrency(0)}
					</div>
				</div>
			</div>

			{/* Chart */}
			<div className="relative">
				<AgCharts
					options={chartOptions}
					style={{ height: CHART_DIMENSIONS.runningPnl.height }}
				/>

				{/* Final P&L label overlay */}
				<div className="absolute top-2 right-4">
					<div className="font-mono text-[10px] text-muted-foreground">
						Final P&L
					</div>
					<div
						className={cn(
							"font-bold font-mono text-lg",
							stats.finalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(stats.finalPnl)}
					</div>
				</div>
			</div>

			{/* Data point count */}
			<div className="font-mono text-muted-foreground text-xs">
				{dataPoints.length} data points · Hover chart for details
			</div>
		</div>
	);
}
