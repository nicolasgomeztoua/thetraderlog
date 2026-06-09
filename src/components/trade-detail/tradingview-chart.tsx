import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	createSeriesMarkers,
	type IChartApi,
	type IChartApiBase,
	type IPriceLine,
	type IPrimitivePaneRenderer,
	type IPrimitivePaneView,
	type ISeriesApi,
	type ISeriesPrimitive,
	type ISeriesPrimitiveAxisView,
	LineStyle,
	type SeriesAttachedParameter,
	type SeriesMarker,
	type SeriesType,
	type Time,
	type UTCTimestamp,
} from "lightweight-charts";
import {
	ExternalLink,
	Loader2,
	Maximize2,
	Minus,
	SeparatorVertical,
	Trash2,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/contexts/theme-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	DEFAULT_ANNOTATION_COLOR,
	DRAWING_COLORS,
	LINE_STYLE_MAP,
} from "@/lib/constants/chart";
import {
	ERR_ANNOTATION_CLEAR_FAILED,
	ERR_ANNOTATION_CREATE_FAILED,
} from "@/lib/constants/errors";
import { aggregateBars, getTradingViewSymbol } from "@/lib/market-data";
import {
	type ChartInterval,
	cn,
	INTERVAL_LABELS,
	INTERVAL_MS,
	roundToCandle,
	STALE_TIME_MEDIUM,
} from "@/lib/shared";
import { ids } from "@/lib/shared/id";
import { getErrorMessage } from "@/lib/shared/utils";
import { getThemeById } from "@/lib/ui";
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
	tradeId: string;
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

type DrawingTool = "horizontal" | "vertical" | null;

type LineStyleOption = "solid" | "dashed";

// =============================================================================
// CONSTANTS
// =============================================================================

// =============================================================================
// VERTICAL LINE PRIMITIVE (ISeriesPrimitive)
// =============================================================================

class VerticalLinePaneView implements IPrimitivePaneView {
	private _primitive: VerticalLinePrimitive;

	constructor(primitive: VerticalLinePrimitive) {
		this._primitive = primitive;
	}

	zOrder(): "normal" {
		return "normal";
	}

	renderer(): IPrimitivePaneRenderer | null {
		const primitive = this._primitive;
		return {
			draw: (target) => {
				const chart = primitive.chart();
				if (!chart) return;

				const timeCoord = chart
					.timeScale()
					.timeToCoordinate(primitive.time as Time);
				if (timeCoord === null) return;

				const drawScope = target.useMediaCoordinateSpace.bind(target);
				drawScope(({ context, mediaSize }) => {
					context.beginPath();
					context.strokeStyle = primitive.color;
					context.lineWidth = 1;
					if (primitive.lineStyleValue !== LineStyle.Solid) {
						context.setLineDash([5, 3]);
					} else {
						context.setLineDash([]);
					}
					context.moveTo(timeCoord, 0);
					context.lineTo(timeCoord, mediaSize.height);
					context.stroke();
					context.setLineDash([]);
				});
			},
		};
	}
}

class VerticalLineTimeAxisView implements ISeriesPrimitiveAxisView {
	private _primitive: VerticalLinePrimitive;

	constructor(primitive: VerticalLinePrimitive) {
		this._primitive = primitive;
	}

	coordinate(): number {
		const chart = this._primitive.chart();
		if (!chart) return -1000;
		const coord = chart
			.timeScale()
			.timeToCoordinate(this._primitive.time as Time);
		return coord ?? -1000;
	}

	text(): string {
		const ts = this._primitive.time as number;
		const d = new Date(ts * 1000);
		const h = d.getUTCHours().toString().padStart(2, "0");
		const m = d.getUTCMinutes().toString().padStart(2, "0");
		return `${h}:${m}`;
	}

	textColor(): string {
		return "#050505";
	}

	backColor(): string {
		return this._primitive.color;
	}
}

class VerticalLinePrimitive implements ISeriesPrimitive {
	readonly time: UTCTimestamp;
	readonly color: string;
	readonly lineStyleValue: LineStyle;

	private _chart: IChartApiBase<Time> | null = null;
	private _paneViews: readonly IPrimitivePaneView[];
	private _timeAxisViews: readonly ISeriesPrimitiveAxisView[];

	constructor(time: UTCTimestamp, color: string, lineStyle: LineStyleOption) {
		this.time = time;
		this.color = color;
		this.lineStyleValue =
			lineStyle === "dashed" ? LineStyle.Dashed : LineStyle.Solid;
		this._paneViews = [new VerticalLinePaneView(this)];
		this._timeAxisViews = [new VerticalLineTimeAxisView(this)];
	}

	attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
		this._chart = param.chart;
	}

	detached(): void {
		this._chart = null;
	}

	chart(): IChartApiBase<Time> | null {
		return this._chart;
	}

	updateAllViews(): void {
		// Views recalculate on each draw
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
		return this._timeAxisViews;
	}
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
// TIMEFRAME SELECTOR COMPONENT
// =============================================================================

const CHART_INTERVALS: ChartInterval[] = [
	"1min",
	"5min",
	"15min",
	"30min",
	"1h",
];

function TimeframeSelector({
	interval,
	onIntervalChange,
	disabled,
	isMobile,
}: {
	interval: ChartInterval;
	onIntervalChange: (interval: ChartInterval) => void;
	disabled?: boolean;
	isMobile?: boolean;
}) {
	// Mobile: Use dropdown select
	if (isMobile) {
		return (
			<Select
				disabled={disabled}
				onValueChange={(value) => onIntervalChange(value as ChartInterval)}
				value={interval}
			>
				<SelectTrigger
					className="h-7 min-h-9 w-auto min-w-15 gap-1 border-none bg-muted px-2 font-mono text-[10px] uppercase hover:bg-muted/80"
					size="sm"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{CHART_INTERVALS.map((tf) => (
						<SelectItem
							className="min-h-11 font-mono text-xs uppercase"
							key={tf}
							value={tf}
						>
							{INTERVAL_LABELS[tf]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	// Desktop: Use button row
	return (
		<div className="flex items-center gap-1">
			{CHART_INTERVALS.map((tf) => (
				<button
					className={cn(
						"rounded px-2 py-1 font-mono text-[10px] uppercase transition-colors",
						"disabled:cursor-not-allowed disabled:opacity-50",
						interval === tf
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-muted/80",
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
	tradeId,
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
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const ohlcSnapLineRef = useRef<IPriceLine | null>(null);
	const currentSnappedPriceRef = useRef<number | null>(null);

	// Drawing tool state
	const [activeTool, setActiveTool] = useState<DrawingTool>(null);
	const [drawingLineStyle, setDrawingLineStyle] =
		useState<LineStyleOption>("solid");
	const [drawingColorIndex, setDrawingColorIndex] = useState(0);
	const activeToolRef = useRef<DrawingTool>(null);
	const drawingLineStyleRef = useRef<LineStyleOption>("solid");
	const drawingColorRef = useRef(DRAWING_COLORS[0]);

	// Track user-drawn annotation price lines for removal
	const annotationPriceLinesRef = useRef<IPriceLine[]>([]);

	// Track vertical line primitives for removal
	const verticalLinePrimitivesRef = useRef<VerticalLinePrimitive[]>([]);

	// Track in-flight create mutations to avoid premature invalidation
	const pendingCreateCountRef = useRef(0);

	// Track crosshair time for vertical line placement
	const crosshairTimeRef = useRef<UTCTimestamp | null>(null);

	// Keep refs in sync with state
	useEffect(() => {
		activeToolRef.current = activeTool;
	}, [activeTool]);
	useEffect(() => {
		drawingLineStyleRef.current = drawingLineStyle;
	}, [drawingLineStyle]);
	useEffect(() => {
		drawingColorRef.current = DRAWING_COLORS[drawingColorIndex];
	}, [drawingColorIndex]);

	// Mobile detection
	const isMobile = useIsMobile();

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

	// For opening TradingView in new tab
	const tvSymbol = getTradingViewSymbol(symbol);
	const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;

	// Determine which endpoint to use based on interval
	const canFetchRealData = !!entryTime;
	const isHourly = interval === "1h";

	// =========================================================================
	// ANNOTATION QUERIES & MUTATIONS
	// =========================================================================

	const utils = api.useUtils();

	const { data: annotations } = api.chartAnnotations.list.useQuery(
		{ tradeId },
		{ staleTime: STALE_TIME_MEDIUM },
	);

	const createAnnotation = api.chartAnnotations.create.useMutation({
		onMutate: async (newAnnotation) => {
			await utils.chartAnnotations.list.cancel({ tradeId });
			const tempId = ids.chartAnnotation();
			pendingCreateCountRef.current += 1;

			// Optimistically add the new annotation to the cache
			utils.chartAnnotations.list.setData({ tradeId }, (old) => [
				...(old ?? []),
				{
					id: tempId,
					tradeId,
					userId: "",
					type: newAnnotation.type,
					value: newAnnotation.value,
					lineStyle: newAnnotation.lineStyle ?? "solid",
					color: newAnnotation.color ?? DEFAULT_ANNOTATION_COLOR,
					createdAt: new Date(),
				},
			]);

			return { tempId };
		},
		onError: (error, _variables, context) => {
			// Remove only the failed optimistic annotation by tempId
			if (context?.tempId) {
				utils.chartAnnotations.list.setData(
					{ tradeId },
					(old) => old?.filter((a) => a.id !== context.tempId) ?? [],
				);
			}
			toast.error(getErrorMessage(error, ERR_ANNOTATION_CREATE_FAILED));
		},
		onSettled: () => {
			// Only invalidate once all in-flight creates have settled
			pendingCreateCountRef.current -= 1;
			if (pendingCreateCountRef.current === 0) {
				utils.chartAnnotations.list.invalidate({ tradeId });
			}
		},
	});

	const clearAllAnnotations = api.chartAnnotations.clearAll.useMutation({
		onMutate: async () => {
			await utils.chartAnnotations.list.cancel({ tradeId });

			const previousData = utils.chartAnnotations.list.getData({ tradeId });

			// Optimistically clear all annotations
			utils.chartAnnotations.list.setData({ tradeId }, () => []);

			return { previousData };
		},
		onError: (error, _variables, context) => {
			if (context?.previousData) {
				utils.chartAnnotations.list.setData({ tradeId }, context.previousData);
			}
			toast.error(getErrorMessage(error, ERR_ANNOTATION_CLEAR_FAILED));
		},
		onSettled: () => {
			utils.chartAnnotations.list.invalidate({ tradeId });
		},
	});

	// =========================================================================
	// DRAWING TOOL HANDLERS
	// =========================================================================

	const toggleTool = useCallback((tool: DrawingTool) => {
		setActiveTool((prev) => (prev === tool ? null : tool));
	}, []);

	const cycleLineStyle = useCallback(() => {
		setDrawingLineStyle((prev) => (prev === "solid" ? "dashed" : "solid"));
	}, []);

	const cycleColor = useCallback(() => {
		setDrawingColorIndex((prev) => (prev + 1) % DRAWING_COLORS.length);
	}, []);

	const handleClearAll = useCallback(() => {
		// Remove all annotation price lines from chart
		if (seriesRef.current) {
			for (const line of annotationPriceLinesRef.current) {
				seriesRef.current.removePriceLine(line);
			}
			// Detach all vertical line primitives
			for (const primitive of verticalLinePrimitivesRef.current) {
				seriesRef.current.detachPrimitive(primitive);
			}
		}
		annotationPriceLinesRef.current = [];
		verticalLinePrimitivesRef.current = [];
		clearAllAnnotations.mutate({ tradeId });
	}, [clearAllAnnotations, tradeId]);

	// =========================================================================
	// KEYBOARD SHORTCUTS
	// =========================================================================

	useEffect(() => {
		const container = containerRef.current?.parentElement;
		if (!container) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Only respond when chart container or its children are focused
			if (
				!container.contains(document.activeElement) &&
				document.activeElement !== container
			)
				return;

			if (e.key === "h" || e.key === "H") {
				e.preventDefault();
				toggleTool("horizontal");
			} else if (e.key === "v" || e.key === "V") {
				e.preventDefault();
				toggleTool("vertical");
			} else if (e.key === "Escape") {
				e.preventDefault();
				setActiveTool(null);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleTool]);

	// Sub-hourly: fetch extended range (±3 days) of 1-min data, then aggregate client-side
	const { data: rawChartData, isLoading: isLoadingSubHourly } =
		api.marketData.getFullDayChartData.useQuery(
			{
				symbol,
				entryTime: entryTime
					? new Date(entryTime).toISOString()
					: new Date().toISOString(),
				exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
			},
			{
				enabled: canFetchRealData && !isHourly,
				staleTime: STALE_TIME_MEDIUM,
			},
		);

	// 1h: fetch extended date range (~7 trading sessions) of 1h bars server-side
	const { data: extendedChartData, isLoading: isLoadingHourly } =
		api.marketData.getExtendedChartData.useQuery(
			{
				symbol,
				entryTime: entryTime
					? new Date(entryTime).toISOString()
					: new Date().toISOString(),
				exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
			},
			{
				enabled: canFetchRealData && isHourly,
				staleTime: STALE_TIME_MEDIUM,
			},
		);

	const isLoading = isHourly ? isLoadingHourly : isLoadingSubHourly;

	// Aggregate 1-min bars to selected interval client-side (instant!)
	// For 1h, use extended data directly (already 1h bars from server)
	const chartData = useMemo(() => {
		if (isHourly) {
			if (!extendedChartData?.bars?.length) return null;
			return {
				bars: extendedChartData.bars,
				source: extendedChartData.source,
				dataQuality: extendedChartData.dataQuality,
				barCount: extendedChartData.barCount,
			};
		}

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
	}, [rawChartData, extendedChartData, interval, isHourly]);

	// Determine if we have real data
	const hasRealData = chartData && chartData.bars.length > 0;

	// Data quality survives even when there are zero bars (chartData is null),
	// so the empty state can distinguish "not published yet" from "no data".
	const dataQuality = isHourly
		? extendedChartData?.dataQuality
		: rawChartData?.dataQuality;

	// A same-day trade is missing only TODAY's candles: the data provider
	// publishes each session the next morning (UTC), so the chart shows prior
	// sessions with a blank edge around today's markers until the backfill runs.
	const effectiveEnd = exitTime ? new Date(exitTime) : new Date();
	const now = new Date();
	const tradeEndsToday =
		effectiveEnd.getUTCFullYear() === now.getUTCFullYear() &&
		effectiveEnd.getUTCMonth() === now.getUTCMonth() &&
		effectiveEnd.getUTCDate() === now.getUTCDate();
	const isAwaitingTodaysData =
		tradeEndsToday && (dataQuality === "pending" || dataQuality === "partial");

	// Build markers array - elegant entry/exit indicators
	const markers = useMemo(() => {
		const markerList: SeriesMarker<UTCTimestamp>[] = [];
		const intervalMs = INTERVAL_MS[interval];

		// Entry marker - arrow in trade direction
		if (entryTime) {
			const entryTs = roundToCandle(entryTime, intervalMs) as UTCTimestamp;
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
			const exitTs = roundToCandle(exitTime, intervalMs) as UTCTimestamp;
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

				const execTs = roundToCandle(
					execution.executedAt,
					intervalMs,
				) as UTCTimestamp;

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

		// Set real chart data
		const chartBars: CandleDataPoint[] = hasRealData
			? chartData.bars.map((bar) => ({
					time: bar.time as UTCTimestamp,
					open: bar.open,
					high: bar.high,
					low: bar.low,
					close: bar.close,
				}))
			: [];

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
				currentSnappedPriceRef.current = null;
				crosshairTimeRef.current = null;
				return;
			}

			// Store crosshair time for vertical line placement
			crosshairTimeRef.current = param.time as UTCTimestamp;

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

			// Store for click-to-copy
			currentSnappedPriceRef.current = nearest.price;

			// Update or create the snap line
			if (ohlcSnapLineRef.current) {
				ohlcSnapLineRef.current.applyOptions({
					price: nearest.price,
					title: nearest.label,
				});
			} else {
				ohlcSnapLineRef.current = seriesRef.current.createPriceLine({
					price: nearest.price,
					color: colors.crosshair, // Same as vertical crosshair
					lineWidth: 1,
					lineStyle: 2, // Dashed
					axisLabelVisible: true,
					axisLabelColor: colors.crosshairLabel,
					title: nearest.label,
				});
			}
		});

		// Subscribe to click — drawing mode or copy-to-clipboard
		chart.subscribeClick(() => {
			// Drawing mode: place horizontal line
			if (
				activeToolRef.current === "horizontal" &&
				seriesRef.current &&
				currentSnappedPriceRef.current !== null
			) {
				const price = currentSnappedPriceRef.current;
				const color = drawingColorRef.current;
				const style = drawingLineStyleRef.current;

				// Create visual price line immediately
				const priceLine = seriesRef.current.createPriceLine({
					price,
					color,
					lineWidth: 1,
					lineStyle: LINE_STYLE_MAP[style],
					axisLabelVisible: true,
					title: "",
				});
				annotationPriceLinesRef.current.push(priceLine);

				// Persist to DB
				createAnnotation.mutate({
					tradeId,
					type: "horizontal",
					value: price.toString(),
					lineStyle: style,
					color,
				});

				toast("Line placed", {
					description: `Horizontal @ ${price}`,
					duration: 1500,
				});
				return;
			}

			// Drawing mode: place vertical line
			if (
				activeToolRef.current === "vertical" &&
				seriesRef.current &&
				crosshairTimeRef.current !== null
			) {
				const time = crosshairTimeRef.current;
				const color = drawingColorRef.current ?? "#d4ff00";
				const style = drawingLineStyleRef.current;

				// Create visual vertical line primitive
				const primitive = new VerticalLinePrimitive(time, color, style);
				seriesRef.current.attachPrimitive(primitive);
				verticalLinePrimitivesRef.current.push(primitive);

				// Persist to DB (value = Unix timestamp in seconds)
				createAnnotation.mutate({
					tradeId,
					type: "vertical",
					value: time.toString(),
					lineStyle: style,
					color,
				});

				const d = new Date((time as number) * 1000);
				const timeStr = `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
				toast("Line placed", {
					description: `Vertical @ ${timeStr}`,
					duration: 1500,
				});
				return;
			}

			// Default mode: copy price to clipboard
			if (currentSnappedPriceRef.current === null) return;
			navigator.clipboard.writeText(currentSnappedPriceRef.current.toString());
			toast("Price copied", {
				description: currentSnappedPriceRef.current.toString(),
				duration: 1500,
			});
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
			annotationPriceLinesRef.current = [];
			// Detach vertical line primitives before removing chart
			if (seriesRef.current) {
				for (const primitive of verticalLinePrimitivesRef.current) {
					seriesRef.current.detachPrimitive(primitive);
				}
			}
			verticalLinePrimitivesRef.current = [];
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [
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
		tradeId,
		createAnnotation.mutate,
	]);

	// Render persisted annotations separately to avoid full chart recreation on annotation changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: interval triggers chart rebuild; annotations must re-apply on the new series
	useEffect(() => {
		if (!seriesRef.current || !annotations) return;

		// Remove previous annotation visuals
		for (const line of annotationPriceLinesRef.current) {
			seriesRef.current.removePriceLine(line);
		}
		for (const primitive of verticalLinePrimitivesRef.current) {
			seriesRef.current.detachPrimitive(primitive);
		}
		annotationPriceLinesRef.current = [];
		verticalLinePrimitivesRef.current = [];

		// Re-apply from query data
		for (const ann of annotations) {
			if (ann.type === "horizontal") {
				const priceLine = seriesRef.current.createPriceLine({
					price: parseFloat(ann.value),
					color: ann.color,
					lineWidth: 1,
					lineStyle: LINE_STYLE_MAP[ann.lineStyle as LineStyleOption] ?? 0,
					axisLabelVisible: true,
					title: "",
				});
				annotationPriceLinesRef.current.push(priceLine);
			} else if (ann.type === "vertical") {
				const primitive = new VerticalLinePrimitive(
					parseFloat(ann.value) as UTCTimestamp,
					ann.color,
					ann.lineStyle as LineStyleOption,
				);
				seriesRef.current.attachPrimitive(primitive);
				verticalLinePrimitivesRef.current.push(primitive);
			}
		}
	}, [annotations, interval]);

	// Show loading state
	if (isLoading) {
		return (
			<div
				className={cn(
					"relative flex h-full w-full flex-col items-center justify-center overflow-hidden",
					className,
				)}
			>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="font-mono text-xs">Loading chart data...</span>
				</div>
			</div>
		);
	}

	// Show empty state when no data available. A "pending" quality means the
	// session simply hasn't been published yet (same-day / pre-release), not
	// that the symbol has no data — it will backfill after the session settles.
	if (!hasRealData) {
		const isPending = dataQuality === "pending";
		return (
			<div
				className={cn(
					"relative flex h-full w-full flex-col items-center justify-center overflow-hidden",
					className,
				)}
			>
				<p className="font-mono text-muted-foreground text-sm">
					{isPending
						? "Chart data not available yet"
						: "No chart data available"}
				</p>
				<p className="mt-1 font-mono text-[11px] text-muted-foreground/50">
					{isPending
						? "Same-day candles publish after the session closes — check back tomorrow"
						: "Market data may not be available for this symbol"}
				</p>
			</div>
		);
	}

	const drawingColor = DRAWING_COLORS[drawingColorIndex];

	return (
		<div
			className={cn(
				"relative h-full w-full overflow-hidden",
				activeTool && "cursor-crosshair",
				className,
			)}
			data-testid="chart-container"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: chart needs focus for keyboard shortcuts (H, Escape)
			tabIndex={0}
		>
			{/* Chart container */}
			<div className="h-full w-full" ref={containerRef} />

			{/* Same-day notice: today's candles publish after the session settles */}
			{isAwaitingTodaysData && (
				<div className="-translate-x-1/2 absolute bottom-3 left-1/2 z-10 rounded border border-border bg-background/80 px-2.5 py-1 backdrop-blur-sm">
					<span className="font-mono text-[10px] text-muted-foreground sm:text-[11px]">
						Today's candles publish after the session closes — check back
						tomorrow
					</span>
				</div>
			)}

			{/* Top controls bar */}
			<div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 sm:gap-2">
				{/* Symbol badge */}
				<div className="rounded bg-background/80 px-1.5 py-1 backdrop-blur-sm sm:px-2">
					<span className="font-bold font-mono text-[10px] sm:text-xs">
						{symbol}
					</span>
				</div>

				{/* Timeframe selector */}
				<TimeframeSelector
					disabled={isLoading}
					interval={interval}
					isMobile={isMobile}
					onIntervalChange={setInterval}
				/>

				{/* Fit to trade button */}
				<button
					className="flex min-h-9 min-w-9 items-center justify-center gap-1 rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground sm:min-h-0 sm:min-w-0"
					data-testid="chart-button-fit"
					onClick={handleFitToTrade}
					title="Fit to trade"
					type="button"
				>
					<Maximize2 className="h-3 w-3" />
					<span className="hidden sm:inline">Fit</span>
				</button>

				{/* Drawing toolbar separator */}
				<div className="mx-0.5 h-5 w-px bg-border" />

				{/* Horizontal line tool */}
				<button
					className={cn(
						"flex min-h-9 min-w-9 items-center justify-center rounded px-2 py-1 font-mono text-[10px] transition-colors sm:min-h-0 sm:min-w-0",
						activeTool === "horizontal"
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-muted/80",
					)}
					data-testid="chart-button-horizontal-line"
					onClick={() => toggleTool("horizontal")}
					title="Horizontal line (H)"
					type="button"
				>
					<Minus className="h-3 w-3" />
				</button>

				{/* Vertical line tool */}
				<button
					className={cn(
						"flex min-h-9 min-w-9 items-center justify-center rounded px-2 py-1 font-mono text-[10px] transition-colors sm:min-h-0 sm:min-w-0",
						activeTool === "vertical"
							? "bg-primary text-primary-foreground"
							: "bg-muted text-muted-foreground hover:bg-muted/80",
					)}
					data-testid="chart-button-vertical-line"
					onClick={() => toggleTool("vertical")}
					title="Vertical line (V)"
					type="button"
				>
					<SeparatorVertical className="h-3 w-3" />
				</button>

				{/* Line style toggle */}
				<button
					className="flex min-h-9 min-w-9 items-center justify-center rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 sm:min-h-0 sm:min-w-0"
					data-testid="chart-button-line-style"
					onClick={cycleLineStyle}
					title={`Line style: ${drawingLineStyle}`}
					type="button"
				>
					{drawingLineStyle === "solid" ? (
						<span className="block h-0.5 w-3 bg-current" />
					) : (
						<span className="block h-0.5 w-3 border-current border-t-2 border-dashed" />
					)}
				</button>

				{/* Color picker cycling button */}
				<button
					className="flex min-h-9 min-w-9 items-center justify-center rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 sm:min-h-0 sm:min-w-0"
					data-testid="chart-button-color"
					onClick={cycleColor}
					title="Drawing color"
					type="button"
				>
					<span
						className="block h-3 w-3 rounded-full"
						style={{ backgroundColor: drawingColor }}
					/>
				</button>

				{/* Clear all button */}
				<button
					className="flex min-h-9 min-w-9 items-center justify-center rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-destructive sm:min-h-0 sm:min-w-0"
					data-testid="chart-button-clear-all"
					onClick={handleClearAll}
					title="Clear all drawings"
					type="button"
				>
					<Trash2 className="h-3 w-3" />
				</button>
			</div>

			{/* Data source notice overlay */}
			<div className="absolute right-3 bottom-3 z-10 flex items-center gap-2">
				<span className="font-mono text-[10px] text-primary/70">
					{chartData?.source === "cache"
						? `${chartData.barCount} bars (cached)`
						: `${chartData?.barCount ?? 0} bars`}
				</span>
				<a
					className="flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
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
