"use client";

import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	createSeriesMarkers,
	type IChartApi,
	type ISeriesApi,
	type SeriesMarker,
	type UTCTimestamp,
} from "lightweight-charts";
import { memo, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useTimezone } from "@/hooks/use-timezone";
import type { ChartBar } from "@/lib/market-data";
import {
	type ChartInterval,
	cn,
	INTERVAL_MS,
	roundToCandle,
} from "@/lib/shared";
import { getThemeById } from "@/lib/ui";
import type { ReplayExecution } from "./use-replay-engine";

// =============================================================================
// TYPES
// =============================================================================

interface ReplayChartProps {
	visibleBars: ChartBar[];
	visibleExecutions: ReplayExecution[];
	allBars: ChartBar[];
	symbol: string;
	direction: "long" | "short";
	stopLoss?: string | null;
	takeProfit?: string | null;
	interval: ChartInterval;
	currentTime: number;
	runningPnl: number;
	className?: string;
}

type CandleDataPoint = CandlestickData<UTCTimestamp>;

// =============================================================================
// THEME COLORS
// =============================================================================

function getChartColors(themeConfig: ReturnType<typeof getThemeById>) {
	const isDark = themeConfig?.isDark ?? true;
	const preview = themeConfig?.preview ?? {
		background: "#050505",
		primary: "#d4ff00",
		accent: "#00d4ff",
	};

	return {
		background: preview.background,
		text: isDark ? "#a1a1aa" : "#3f3f46",
		grid: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)",
		border: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
		crosshair: isDark ? `${preview.primary}50` : `${preview.primary}40`,
		crosshairLabel: preview.primary,
	};
}

// =============================================================================
// COMPONENT
// =============================================================================

function ReplayChartInner({
	visibleBars,
	visibleExecutions,
	allBars: _allBars,
	symbol,
	direction,
	stopLoss,
	takeProfit,
	interval,
	currentTime,
	runningPnl,
	className,
}: ReplayChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const markersRef = useRef<{ detach: () => void } | null>(null);

	// Get theme colors (memoized to prevent chart recreation on every render)
	const { theme } = useTheme();
	const themeConfig = getThemeById(theme);
	const colors = useMemo(() => getChartColors(themeConfig), [themeConfig]);

	// Get timezone-aware time formatting
	const { formatTime } = useTimezone();

	// Initialize chart
	useEffect(() => {
		if (!containerRef.current) return;

		const chart = createChart(containerRef.current, {
			autoSize: true,
			layout: {
				background: { color: colors.background },
				textColor: colors.text,
				fontFamily: "JetBrains Mono, monospace",
			},
			grid: {
				vertLines: { color: colors.grid },
				horzLines: { color: colors.grid },
			},
			crosshair: {
				vertLine: {
					color: colors.crosshair,
					labelBackgroundColor: colors.crosshairLabel,
				},
				horzLine: {
					color: colors.crosshair,
					labelBackgroundColor: colors.crosshairLabel,
				},
			},
			rightPriceScale: {
				borderColor: colors.border,
			},
			timeScale: {
				borderColor: colors.border,
				timeVisible: true,
				secondsVisible: false,
			},
			localization: {
				timeFormatter: (time: number) => {
					const date = new Date(time * 1000);
					return formatTime(date, { includeSeconds: false });
				},
			},
		});

		chartRef.current = chart;

		// Add candlestick series
		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#00ff88",
			downColor: "#ff3b3b",
			borderUpColor: "#00ff88",
			borderDownColor: "#ff3b3b",
			wickUpColor: "#00ff88",
			wickDownColor: "#ff3b3b",
		});

		seriesRef.current = candlestickSeries;

		// Add SL/TP lines if provided
		if (stopLoss) {
			candlestickSeries.createPriceLine({
				price: parseFloat(stopLoss),
				color: "#ff3b3b",
				lineWidth: 1,
				lineStyle: 2, // Dashed
				axisLabelVisible: true,
				title: "SL",
			});
		}

		if (takeProfit) {
			candlestickSeries.createPriceLine({
				price: parseFloat(takeProfit),
				color: "#00ff88",
				lineWidth: 1,
				lineStyle: 2, // Dashed
				axisLabelVisible: true,
				title: "TP",
			});
		}

		// Cleanup
		return () => {
			if (markersRef.current) {
				markersRef.current.detach();
			}
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [colors, stopLoss, takeProfit, formatTime]);

	// Update chart data as replay progresses
	useEffect(() => {
		if (!seriesRef.current || !chartRef.current) return;

		// Convert bars to chart format
		const chartBars: CandleDataPoint[] = visibleBars.map((bar) => ({
			time: bar.time as UTCTimestamp,
			open: bar.open,
			high: bar.high,
			low: bar.low,
			close: bar.close,
		}));

		// Update series data
		seriesRef.current.setData(chartBars);

		// Build markers for visible executions
		const markers: SeriesMarker<UTCTimestamp>[] = [];
		const intervalMs = INTERVAL_MS[interval];

		for (const execution of visibleExecutions) {
			const execTs = roundToCandle(
				execution.executedAt,
				intervalMs,
			) as UTCTimestamp;

			if (execution.executionType === "entry") {
				markers.push({
					time: execTs,
					position: direction === "long" ? "belowBar" : "aboveBar",
					shape: direction === "long" ? "arrowUp" : "arrowDown",
					color: "#d4ff00",
					size: 1,
				});
			} else if (execution.executionType === "exit") {
				markers.push({
					time: execTs,
					position: direction === "long" ? "aboveBar" : "belowBar",
					shape: "circle",
					color: "#71717a",
					size: 1,
				});
			} else if (execution.executionType === "scale_in") {
				markers.push({
					time: execTs,
					position: direction === "long" ? "belowBar" : "aboveBar",
					shape: direction === "long" ? "arrowUp" : "arrowDown",
					color: "rgba(212, 255, 0, 0.5)",
					size: 0,
				});
			} else if (execution.executionType === "scale_out") {
				markers.push({
					time: execTs,
					position: direction === "long" ? "aboveBar" : "belowBar",
					shape: direction === "long" ? "arrowDown" : "arrowUp",
					color: "rgba(113, 113, 122, 0.5)",
					size: 0,
				});
			}
		}

		// Sort markers by time
		markers.sort((a, b) => (a.time as number) - (b.time as number));

		// Remove old markers and add new ones
		if (markersRef.current) {
			markersRef.current.detach();
		}

		if (markers.length > 0) {
			markersRef.current = createSeriesMarkers(seriesRef.current, markers);
		}
	}, [visibleBars, visibleExecutions, direction, interval]);

	return (
		<div className={cn("relative h-full w-full overflow-hidden", className)}>
			{/* Chart container */}
			<div className="h-full w-full" ref={containerRef} />

			{/* Symbol badge */}
			<div className="absolute top-3 left-3 z-10 flex items-center gap-2">
				<div className="rounded bg-background/80 px-2 py-1 backdrop-blur-sm">
					<span className="font-bold font-mono text-xs">{symbol}</span>
				</div>
				<div className="rounded bg-background/80 px-2 py-1 backdrop-blur-sm">
					<span className="font-mono text-[10px] text-muted-foreground uppercase">
						Replay
					</span>
				</div>
			</div>

			{/* Running P&L overlay */}
			<div className="absolute top-3 right-3 z-10">
				<div
					className={cn(
						"rounded bg-background/80 px-3 py-1.5 backdrop-blur-sm",
						"border",
						runningPnl >= 0 ? "border-profit/30" : "border-loss/30",
					)}
				>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Running P&L
					</div>
					<div
						className={cn(
							"font-bold font-mono text-lg",
							runningPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{runningPnl >= 0 ? "+" : ""}$
						{runningPnl.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						})}
					</div>
				</div>
			</div>

			{/* Current time indicator */}
			<div className="absolute right-3 bottom-3 z-10">
				<div className="rounded bg-background/80 px-2 py-1 backdrop-blur-sm">
					<span className="font-mono text-[10px] text-muted-foreground">
						{formatTime(new Date(currentTime * 1000), { includeSeconds: true })}
					</span>
				</div>
			</div>
		</div>
	);
}

// Memoize to prevent unnecessary re-renders
export const ReplayChart = memo(ReplayChartInner);
