import {
	type CandlestickData,
	CandlestickSeries,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type UTCTimestamp,
} from "lightweight-charts";
import { ExternalLink, Loader2 } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/theme-context";
import { getTradingViewSymbol } from "@/lib/symbols";
import { getThemeById } from "@/lib/themes";
import { cn } from "@/lib/utils";
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
	className?: string;
}

type CandleDataPoint = CandlestickData<UTCTimestamp>;

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
// LIGHTWEIGHT CHART COMPONENT
// =============================================================================

function LightweightChartInner({
	symbol,
	entryPrice,
	exitPrice,
	entryTime,
	exitTime,
	stopLoss,
	takeProfit,
	direction,
	status,
	className,
}: ChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

	// Get theme colors from the actual theme configuration
	const { theme } = useTheme();
	const themeConfig = getThemeById(theme);
	const colors = getChartColors(themeConfig);

	// Get base price from entry price for mock data fallback
	const basePrice = entryPrice ? parseFloat(entryPrice) : 100;

	// For opening TradingView in new tab
	const tvSymbol = getTradingViewSymbol(symbol);
	const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;

	// Fetch real chart data from cache
	const canFetchRealData = !!entryTime;
	const { data: chartData, isLoading } = api.marketData.getChartData.useQuery(
		{
			symbol,
			entryTime: entryTime
				? new Date(entryTime).toISOString()
				: new Date().toISOString(),
			exitTime: exitTime ? new Date(exitTime).toISOString() : undefined,
			interval: "15min",
			contextBefore: 4,
			contextAfter: 2,
		},
		{
			enabled: canFetchRealData,
			staleTime: 1000 * 60 * 5, // 5 minutes - data doesn't change often
			refetchOnWindowFocus: false,
		},
	);

	// Determine data source for display
	const hasRealData = chartData && chartData.bars.length > 0;
	const dataSource = hasRealData
		? chartData.source === "cache"
			? "cached"
			: "live"
		: "mock";

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

		// Add price lines for entry/exit/SL/TP
		if (entryPrice) {
			candlestickSeries.createPriceLine({
				price: parseFloat(entryPrice),
				color: direction === "long" ? "#00ff88" : "#ff3b3b",
				lineWidth: 2,
				lineStyle: 0, // Solid
				axisLabelVisible: true,
				title: "Entry",
			});
		}

		if (status === "closed" && exitPrice) {
			candlestickSeries.createPriceLine({
				price: parseFloat(exitPrice),
				color: direction === "long" ? "#ff3b3b" : "#00ff88",
				lineWidth: 2,
				lineStyle: 0,
				axisLabelVisible: true,
				title: "Exit",
			});
		}

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

		// Fit content
		chart.timeScale().fitContent();

		// Cleanup
		return () => {
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [
		basePrice,
		entryPrice,
		exitPrice,
		stopLoss,
		takeProfit,
		direction,
		status,
		colors,
		hasRealData,
		chartData,
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

			{/* Symbol badge */}
			<div className="absolute top-3 left-3 z-10 rounded bg-background/80 px-2 py-1 backdrop-blur-sm">
				<span className="font-bold font-mono text-xs">{symbol}</span>
				<span className="ml-2 font-mono text-[10px] text-muted-foreground">
					15m
				</span>
			</div>
		</div>
	);
}

// Memoize to prevent unnecessary re-renders
export const TradingViewChart = memo(LightweightChartInner);
