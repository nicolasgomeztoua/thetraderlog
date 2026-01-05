"use client";

import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { aggregateBars, type ChartInterval } from "@/lib/market-data";
import { cn } from "@/lib/shared";
import { useChartPreferencesStore } from "@/stores/chart-preferences-store";
import { useReplayPreferencesStore } from "@/stores/replay-preferences-store";
import { api } from "@/trpc/react";
import { ReplayChart } from "./replay-chart";
import { ReplayControls } from "./replay-controls";
import { type ReplayExecution, useReplayEngine } from "./use-replay-engine";

// =============================================================================
// TYPES
// =============================================================================

interface TradeReplayProps {
	tradeId: string;
	symbol: string;
	direction: "long" | "short";
	instrumentType: "futures" | "forex";
	entryPrice: string | null;
	exitPrice?: string | null;
	entryTime: Date | string | null;
	exitTime?: Date | string | null;
	stopLoss?: string | null;
	takeProfit?: string | null;
	quantity?: string | null;
	executions?: Array<{
		id: string;
		executionType: "entry" | "exit" | "scale_in" | "scale_out";
		executedAt: Date | string;
		price: string;
		quantity: string;
		realizedPnl?: string | null;
	}>;
	className?: string;
}

// Interval labels for the selector
const INTERVAL_LABELS: Record<ChartInterval, string> = {
	"1min": "1m",
	"5min": "5m",
	"15min": "15m",
	"30min": "30m",
	"1h": "1h",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function TradeReplay({
	tradeId: _tradeId,
	symbol,
	direction,
	instrumentType,
	entryPrice,
	exitPrice: _exitPrice,
	entryTime,
	exitTime,
	stopLoss,
	takeProfit,
	quantity,
	executions = [],
	className,
}: TradeReplayProps) {
	// Preferences from stores
	const interval = useChartPreferencesStore((s) => s.interval);
	const setInterval = useChartPreferencesStore((s) => s.setInterval);
	const defaultSpeed = useReplayPreferencesStore((s) => s.defaultSpeed);

	// Fetch chart data
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
				enabled: !!entryTime,
				staleTime: 1000 * 60 * 5, // 5 minutes
				refetchOnWindowFocus: false,
			},
		);

	// Aggregate bars to selected interval
	const chartBars = useMemo(() => {
		if (!rawChartData?.bars?.length) return [];

		return interval === "1min"
			? rawChartData.bars
			: aggregateBars(rawChartData.bars, interval);
	}, [rawChartData, interval]);

	// Convert executions to replay format - include synthetic entry from trade data
	const replayExecutions: ReplayExecution[] = useMemo(() => {
		const execs: ReplayExecution[] = [];

		// Add synthetic entry execution from trade data
		if (entryTime && entryPrice) {
			execs.push({
				id: "entry-synthetic",
				executionType: "entry",
				price: entryPrice,
				quantity: quantity ?? "1",
				executedAt: entryTime,
				realizedPnl: null,
			});
		}

		// Add other executions (scale_in, scale_out, exit)
		execs.push(
			...executions.map((exec) => ({
				id: exec.id,
				executionType: exec.executionType,
				price: exec.price,
				quantity: exec.quantity,
				executedAt: exec.executedAt,
				realizedPnl: exec.realizedPnl,
			})),
		);

		return execs;
	}, [executions, entryTime, entryPrice, quantity]);

	// Initialize replay engine
	const replay = useReplayEngine({
		bars: chartBars,
		executions: replayExecutions,
		entryTime,
		exitTime: exitTime ?? null,
		entryPrice,
		direction,
		symbol,
		instrumentType: instrumentType,
		initialSpeed: defaultSpeed,
	});

	// Handle no data state
	if (!entryTime) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<p className="font-mono text-muted-foreground text-sm">
					Entry time required for replay
				</p>
			</div>
		);
	}

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
					Loading chart data...
				</p>
			</div>
		);
	}

	// No data state
	if (chartBars.length === 0) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center",
					className,
				)}
			>
				<p className="font-mono text-muted-foreground text-sm">
					No chart data available for replay
				</p>
				<p className="mt-1 font-mono text-[11px] text-muted-foreground/50">
					Market data may not be available for this symbol
				</p>
			</div>
		);
	}

	return (
		<div className={cn("flex h-full flex-col", className)}>
			{/* Top Bar: Interval Selector */}
			<div className="flex shrink-0 items-center border-white/10 border-b px-3 py-2">
				{/* Interval Selector */}
				<div className="flex items-center gap-1">
					{(Object.keys(INTERVAL_LABELS) as ChartInterval[]).map((tf) => (
						<button
							className={cn(
								"rounded px-2 py-1 font-mono text-[10px] uppercase transition-colors",
								interval === tf
									? "bg-primary text-primary-foreground"
									: "bg-white/5 text-muted-foreground hover:bg-white/10",
							)}
							key={tf}
							onClick={() => setInterval(tf)}
							type="button"
						>
							{INTERVAL_LABELS[tf]}
						</button>
					))}
				</div>
			</div>

			{/* Chart Area */}
			<div className="min-h-0 flex-1">
				<ReplayChart
					allBars={chartBars}
					className="h-full"
					currentTime={replay.currentTime}
					direction={direction}
					interval={interval}
					runningPnl={replay.runningPnl}
					stopLoss={stopLoss}
					symbol={symbol}
					takeProfit={takeProfit}
					visibleBars={replay.visibleBars}
					visibleExecutions={replay.visibleExecutions}
				/>
			</div>

			{/* Controls */}
			<div className="shrink-0 border-white/10 border-t p-3">
				<ReplayControls
					currentTime={replay.currentTime}
					endTime={replay.endTime}
					interval={interval}
					isPlaying={replay.isPlaying}
					onJumpBackward={replay.jumpBackward}
					onJumpForward={replay.jumpForward}
					onReset={replay.reset}
					onSeekToProgress={replay.seekToProgress}
					onSpeedChange={replay.changeSpeed}
					onTogglePlay={replay.togglePlay}
					progress={replay.progress}
					speed={replay.speed}
					startTime={replay.startTime}
				/>
			</div>
		</div>
	);
}
