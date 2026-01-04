import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	createSeriesMarkers,
	type IChartApi,
	type IPriceLine,
	type ISeriesApi,
	type SeriesMarker,
	type UTCTimestamp,
} from "lightweight-charts";
import { ExternalLink, Loader2, Maximize2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/contexts/theme-context";
import { aggregateBars, type ChartInterval } from "@/lib/candle-aggregation";
import { getTradingViewSymbol } from "@/lib/symbols";
import { getThemeById } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useChartPreferencesStore } from "@/stores/chart-preferences-store";
import { api } from "@/trpc/react";

// =============================================================================
// THEME-AWARE CHART COLORS
// Derives colors from each theme's preview palette
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
		crosshair: isDark
			? `${preview.primary}50` // 50 = 30% opacity in hex
			: `${preview.primary}40`,
		crosshairLabel: preview.primary,
		accent: preview.accent,
	};
}

// =============================================================================
// TYPES
// =============================================================================

interface ChartProps {
	symbol: string;
	instrumentType?: "futures" | "forex";
	entryPrice?: string | null;
	exitPrice?: string | null;
	entryTime?: Date | string | null;
	exitTime?: Date | string | null;
	stopLoss?: string | null;
	takeProfit?: string | null;
	direction?: "long" | "short";
	status?: "open" | "closed";
	executions?: Array<{
		executionType: "entry" | "exit" | "scale_in" | "scale_out";
		executedAt: Date | string;
		price: string;
		quantity: string;
	}>;
	wasTrailed?: boolean;
	trailedStopLoss?: string | null;
	maePrice?: string | null;
	mfePrice?: string | null;
	className?: string;
}

type CandleDataPoint = CandlestickData<UTCTimestamp>;

// Interval display labels
const INTERVAL_LABELS: Record<ChartInterval, string> = {
	"1min": "1m",
	"5min": "5m",
	"15min": "15m",
	"30min": "30m",
	"1h": "1h",
};

// Interval durations in milliseconds
const INTERVAL_MS: Record<ChartInterval, number> = {
	"1min": 60 * 1000,
	"5min": 5 * 60 * 1000,
	"15min": 15 * 60 * 1000,
	"30min": 30 * 60 * 1000,
	"1h": 60 * 60 * 1000,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Round a timestamp to the nearest candle bucket for the given interval
 */
function roundToCandle(time: Date | string, intervalMs: number): UTCTimestamp {
	const timestamp = new Date(time).getTime();
	const rounded = Math.floor(timestamp / intervalMs) * intervalMs;
	return Math.floor(rounded / 1000) as UTCTimestamp;
}

/**
 * Calculate the visible range for auto-fit
 * Shows trade duration plus context candles on each side
 */
function calculateVisibleRange(
	entryTime: Date | string | null,
	exitTime: Date | string | null,
	intervalMs: number,
	contextCandles: number = 3,
): { from: UTCTimestamp; to: UTCTimestamp } | null {
	if (!entryTime) return null;

	const entryTs = Math.floor(new Date(entryTime).getTime() / 1000);
	const exitTs = exitTime
		? Math.floor(new Date(exitTime).getTime() / 1000)
		: Math.floor(Date.now() / 1000);

	const candleSeconds = intervalMs / 1000;

	return {
		from: (entryTs - contextCandles * candleSeconds) as UTCTimestamp,
		to: (exitTs + contextCandles * candleSeconds) as UTCTimestamp,
	};
}

// =============================================================================
// MOCK DATA GENERATOR (Fallback when real data unavailable)
// =============================================================================

function generateMockCandles(
	basePrice: number,
	count: number = 100,
): CandleDataPoint[] {
	const candles: CandleDataPoint[] = [];
	let currentPrice = basePrice;
	const now = new Date();

	for (let i = count; i > 0; i--) {
		const date = new Date(now);
		date.setMinutes(date.getMinutes() - i * 15); // 15-min candles

		const volatility = basePrice * 0.002; // 0.2% volatility
		const change = (Math.random() - 0.5) * volatility * 2;
		const open = currentPrice;
		const close = currentPrice + change;
		const high = Math.max(open, close) + Math.random() * volatility;
		const low = Math.min(open, close) - Math.random() * volatility;

		candles.push({
			time: Math.floor(date.getTime() / 1000) as UTCTimestamp,
			open: Number(open.toFixed(2)),
			high: Number(high.toFixed(2)),
			low: Number(low.toFixed(2)),
			close: Number(close.toFixed(2)),
		});

		currentPrice = close;
	}

	return candles;
}

// =============================================================================
// TIMEFRAME SELECTOR COMPONENT
// =============================================================================

function TimeframeSelector({
	interval,
	onIntervalChange,
	disabled,
}: {
	interval: ChartInterval;
	onIntervalChange: (interval: ChartInterval) => void;
	disabled?: boolean;
}) {
	const intervals: ChartInterval[] = ["1min", "5min", "15min", "30min", "1h"];

	return (
		<div className="flex items-center gap-1">
			{intervals.map((tf) => (
				<button
					className={cn(
						"rounded px-2 py-1 font-mono text-[10px] uppercase transition-colors",
						"disabled:cursor-not-allowed disabled:opacity-50",
						interval === tf
							? "bg-primary text-primary-foreground"
							: "bg-white/5 text-muted-foreground hover:bg-white/10",
					)}
					disabled={disabled}
					key={tf}
					onClick={() => onIntervalChange(tf)}
					type="button"
				>
					{INTERVAL_LABELS[tf]}
				</button>
			))}
		</div>
	);
}

// =============================================================================
// LIGHTWEIGHT CHART COMPONENT
// =============================================================================

function LightweightChartInner({
	symbol,
	entryPrice,
	exitTime,
	entryTime,
	stopLoss,
	takeProfit,
	direction,
	status,
	executions,
	wasTrailed,
	trailedStopLoss,
	maePrice,
	mfePrice,
	className,
}: ChartProps) {
	// entryPrice used for mock data fallback base price
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const ohlcSnapLineRef = useRef<IPriceLine | null>(null);

	// Chart preferences from persistent store
	const interval = useChartPreferencesStore((s) => s.interval);
	const setInterval = useChartPreferencesStore((s) => s.setInterval);

	// Use refs for zoom to avoid re-renders - only apply on initial load
	const setVisibleBarsCountRef = useRef(
		useChartPreferencesStore.getState().setVisibleBarsCount,
	);
	const initialVisibleBarsCountRef = useRef(
		useChartPreferencesStore.getState().visibleBarsCount,
	);
	const hasAppliedInitialZoomRef = useRef(false);
	const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Reset initial zoom flag when navigating to a different trade
	// biome-ignore lint/correctness/useExhaustiveDependencies: entryTime triggers reset for new trades
	useEffect(() => {
		hasAppliedInitialZoomRef.current = false;
		initialVisibleBarsCountRef.current =
			useChartPreferencesStore.getState().visibleBarsCount;
	}, [entryTime]);

	// Handler to fit chart to trade (called from Fit button)
	const handleFitToTrade = useCallback(() => {
		if (chartRef.current) {
			chartRef.current.timeScale().fitContent();
		}
	}, []);

	// Get theme colors from the actual theme configuration
	const { theme } = useTheme();
	const themeConfig = getThemeById(theme);
	const colors = getChartColors(themeConfig);

	// Get base price from entry price for mock data fallback
	const basePrice = entryPrice ? parseFloat(entryPrice) : 100;

	// For opening TradingView in new tab
	const tvSymbol = getTradingViewSymbol(symbol);
	const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;

	// Fetch full day(s) of 1-min data once - then aggregate client-side
	const canFetchRealData = !!entryTime;
	const { data: rawChartData, isLoading } =
		api.marketData.getFullDayChartData.useQuery(
			{
				symbol,
				entryTime: entryTime
					? new Date(entryTime).toISOString()
					: new Date().toISOString(),
				exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
			},
			{
				enabled: canFetchRealData,
				staleTime: 1000 * 60 * 5, // 5 minutes - data doesn't change often
				refetchOnWindowFocus: false,
			},
		);

	// Aggregate 1-min bars to selected interval client-side (instant!)
	const chartData = useMemo(() => {
		if (!rawChartData?.bars?.length) return null;

		const aggregatedBars =
			interval === "1min"
				? rawChartData.bars
				: aggregateBars(rawChartData.bars, interval);

		return {
			bars: aggregatedBars,
			source: rawChartData.source,
			dataQuality: rawChartData.dataQuality,
			barCount: aggregatedBars.length,
		};
	}, [rawChartData, interval]);

	// Determine data source for display
	const hasRealData = chartData && chartData.bars.length > 0;
	const dataSource = hasRealData
		? chartData.source === "cache"
			? "cached"
			: "live"
		: "mock";

	// Build markers array - elegant entry/exit indicators
	const markers = useMemo(() => {
		const markerList: SeriesMarker<UTCTimestamp>[] = [];
		const intervalMs = INTERVAL_MS[interval];

		// Entry marker - arrow in trade direction
		if (entryTime) {
			const entryTs = roundToCandle(entryTime, intervalMs);
			markerList.push({
				time: entryTs,
				position: direction === "long" ? "belowBar" : "aboveBar",
				shape: direction === "long" ? "arrowUp" : "arrowDown",
				color: "#d4ff00", // Primary accent (Electric Chartreuse)
				size: 1,
			});
		}

		// Exit marker - grey circle
		if (status === "closed" && exitTime) {
			const exitTs = roundToCandle(exitTime, intervalMs);
			markerList.push({
				time: exitTs,
				position: direction === "long" ? "aboveBar" : "belowBar",
				shape: "circle",
				color: "#71717a", // Zinc-500, muted
				size: 1,
			});
		}

		// Scale-in/out markers - smaller arrows
		if (executions && executions.length > 0) {
			for (const execution of executions) {
				// Skip primary entry/exit (already marked)
				if (
					execution.executionType === "entry" ||
					execution.executionType === "exit"
				) {
					continue;
				}

				const execTs = roundToCandle(execution.executedAt, intervalMs);

				if (execution.executionType === "scale_in") {
					markerList.push({
						time: execTs,
						position: direction === "long" ? "belowBar" : "aboveBar",
						shape: direction === "long" ? "arrowUp" : "arrowDown",
						color: "rgba(212, 255, 0, 0.5)", // Primary accent, transparent
						size: 0,
					});
				}

				if (execution.executionType === "scale_out") {
					markerList.push({
						time: execTs,
						position: direction === "long" ? "aboveBar" : "belowBar",
						shape: direction === "long" ? "arrowDown" : "arrowUp",
						color: "rgba(113, 113, 122, 0.5)", // Zinc-500, transparent
						size: 0,
					});
				}
			}
		}

		// Sort markers by time
		markerList.sort((a, b) => (a.time as number) - (b.time as number));

		return markerList;
	}, [entryTime, exitTime, direction, status, executions, interval]);

	useEffect(() => {
		if (!containerRef.current) return;

		// Create chart with theme-aware colors
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
					visible: false, // Hidden - we use custom OHLC-snapping line
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

		// Use real data if available, otherwise fall back to mock
		let chartBars: CandleDataPoint[];
		if (hasRealData) {
			chartBars = chartData.bars.map((bar) => ({
				time: bar.time as UTCTimestamp,
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
			}));
		} else {
			chartBars = generateMockCandles(basePrice, 100);
		}

		candlestickSeries.setData(chartBars);

		// Add markers for entry/exit/executions
		let markersPrimitive: { detach: () => void } | null = null;
		if (markers.length > 0 && hasRealData) {
			markersPrimitive = createSeriesMarkers(candlestickSeries, markers);
		}

		// Add price lines for SL/TP (these are levels, not time events)
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

		// Add trailed stop loss line (orange, dashed)
		if (wasTrailed && trailedStopLoss) {
			candlestickSeries.createPriceLine({
				price: parseFloat(trailedStopLoss),
				color: "#ffa500", // Orange
				lineWidth: 1,
				lineStyle: 2, // Dashed
				axisLabelVisible: true,
				title: "Trailed SL",
			});
		}

		// Add MAE/MFE lines (dotted, semi-transparent)
		if (maePrice) {
			candlestickSeries.createPriceLine({
				price: parseFloat(maePrice),
				color: "#ff3b3b80", // Red with opacity
				lineWidth: 1,
				lineStyle: 1, // Dotted
				axisLabelVisible: true,
				title: "MAE",
			});
		}

		if (mfePrice) {
			candlestickSeries.createPriceLine({
				price: parseFloat(mfePrice),
				color: "#00ff8880", // Green with opacity
				lineWidth: 1,
				lineStyle: 1, // Dotted
				axisLabelVisible: true,
				title: "MFE",
			});
		}

		// Apply zoom: only on initial load, use saved visibleBarsCount or auto-fit
		const savedBarsCount = initialVisibleBarsCountRef.current;
		const shouldApplyInitialZoom =
			!hasAppliedInitialZoomRef.current &&
			savedBarsCount &&
			chartBars.length > 0 &&
			entryTime;

		if (shouldApplyInitialZoom) {
			// User has a saved zoom preference - center on trade entry
			const entryTs = Math.floor(new Date(entryTime).getTime() / 1000);
			const entryIndex = chartBars.findIndex(
				(bar) => (bar.time as number) >= entryTs,
			);
			if (entryIndex >= 0) {
				const halfVisible = savedBarsCount / 2;
				chart.timeScale().setVisibleLogicalRange({
					from: entryIndex - halfVisible,
					to: entryIndex + halfVisible,
				});
			} else {
				chart.timeScale().fitContent();
			}
			hasAppliedInitialZoomRef.current = true;
		} else if (!hasAppliedInitialZoomRef.current) {
			// No saved zoom - auto-fit to show trade window with context
			if (hasRealData && entryTime) {
				const range = calculateVisibleRange(
					entryTime,
					exitTime ?? null,
					INTERVAL_MS[interval],
					3,
				);
				if (range) {
					// Ensure we have at least 5 candles visible
					const minVisibleSeconds = 5 * (INTERVAL_MS[interval] / 1000);
					const actualRange = (range.to as number) - (range.from as number);
					if (actualRange < minVisibleSeconds) {
						const padding = (minVisibleSeconds - actualRange) / 2;
						range.from = ((range.from as number) - padding) as UTCTimestamp;
						range.to = ((range.to as number) + padding) as UTCTimestamp;
					}
					chart.timeScale().setVisibleRange(range);
				} else {
					chart.timeScale().fitContent();
				}
			} else {
				chart.timeScale().fitContent();
			}
			hasAppliedInitialZoomRef.current = true;
		}

		// Subscribe to zoom changes to persist for next trade load
		const zoomHandler = (range: { from: number; to: number } | null) => {
			if (range) {
				const barsVisible = Math.round(range.to - range.from);
				// Debounced save to store (won't cause re-renders due to refs)
				if (zoomDebounceRef.current) {
					clearTimeout(zoomDebounceRef.current);
				}
				zoomDebounceRef.current = setTimeout(() => {
					setVisibleBarsCountRef.current(barsVisible);
				}, 300);
			}
		};
		chart.timeScale().subscribeVisibleLogicalRangeChange(zoomHandler);

		// Subscribe to crosshair move for OHLC snapping
		chart.subscribeCrosshairMove((param) => {
			if (!param.point || !param.time || !seriesRef.current) {
				// Mouse left chart - remove snap line
				if (ohlcSnapLineRef.current && seriesRef.current) {
					seriesRef.current.removePriceLine(ohlcSnapLineRef.current);
					ohlcSnapLineRef.current = null;
				}
				return;
			}

			// Get the bar data at the crosshair time
			const barData = param.seriesData.get(seriesRef.current);
			if (!barData || !("open" in barData)) return;

			// Calculate which OHLC value is closest to cursor Y position
			const price = seriesRef.current.coordinateToPrice(param.point.y);
			if (price === null) return;

			const ohlcValues = [
				{ label: "O", price: barData.open },
				{ label: "H", price: barData.high },
				{ label: "L", price: barData.low },
				{ label: "C", price: barData.close },
			];

			// Find nearest OHLC value
			const nearest = ohlcValues.reduce((prev, curr) =>
				Math.abs(curr.price - price) < Math.abs(prev.price - price)
					? curr
					: prev,
			);

			// Update or create the snap line
			if (ohlcSnapLineRef.current) {
				ohlcSnapLineRef.current.applyOptions({
					price: nearest.price,
					title: nearest.label,
				});
			} else {
				ohlcSnapLineRef.current = seriesRef.current.createPriceLine({
					price: nearest.price,
					color: colors.crosshairLabel,
					lineWidth: 1,
					lineStyle: 0, // Solid
					axisLabelVisible: true,
					title: nearest.label,
				});
			}
		});

		// Cleanup
		return () => {
			chart.timeScale().unsubscribeVisibleLogicalRangeChange(zoomHandler);
			if (zoomDebounceRef.current) {
				clearTimeout(zoomDebounceRef.current);
			}
			if (markersPrimitive) {
				markersPrimitive.detach();
			}
			// Clean up OHLC snap line
			if (ohlcSnapLineRef.current && seriesRef.current) {
				seriesRef.current.removePriceLine(ohlcSnapLineRef.current);
				ohlcSnapLineRef.current = null;
			}
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [
		basePrice,
		stopLoss,
		takeProfit,
		wasTrailed,
		trailedStopLoss,
		colors,
		hasRealData,
		chartData,
		markers,
		entryTime,
		exitTime,
		interval,
		maePrice,
		mfePrice,
	]);

	return (
		<div className={cn("relative h-full w-full overflow-hidden", className)}>
			{/* Chart container */}
			<div className="h-full w-full" ref={containerRef} />

			{/* Loading overlay */}
			{isLoading && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span className="font-mono text-xs">Loading chart data...</span>
					</div>
				</div>
			)}

			{/* Top controls bar */}
			<div className="absolute top-3 left-3 z-10 flex items-center gap-2">
				{/* Symbol badge */}
				<div className="rounded bg-background/80 px-2 py-1 backdrop-blur-sm">
					<span className="font-bold font-mono text-xs">{symbol}</span>
				</div>

				{/* Timeframe selector */}
				<TimeframeSelector
					disabled={isLoading}
					interval={interval}
					onIntervalChange={setInterval}
				/>

				{/* Fit to trade button */}
				<button
					className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
					onClick={handleFitToTrade}
					title="Fit to trade"
					type="button"
				>
					<Maximize2 className="h-3 w-3" />
					<span>Fit</span>
				</button>
			</div>

			{/* Data source notice overlay */}
			<div className="absolute right-3 bottom-3 z-10 flex items-center gap-2">
				<span
					className={cn(
						"font-mono text-[10px]",
						dataSource === "mock"
							? "text-muted-foreground/50"
							: "text-primary/70",
					)}
				>
					{dataSource === "mock" && "Mock data"}
					{dataSource === "cached" &&
						`${chartData?.barCount ?? 0} bars (cached)`}
					{dataSource === "live" && `${chartData?.barCount ?? 0} bars`}
				</span>
				<a
					className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
					href={tradingViewUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					<ExternalLink className="h-3 w-3" />
					TradingView
				</a>
			</div>
		</div>
	);
}

// Memoize to prevent unnecessary re-renders
export const TradingViewChart = memo(LightweightChartInner);
