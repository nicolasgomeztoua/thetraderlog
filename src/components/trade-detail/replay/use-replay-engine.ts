import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartBar } from "@/lib/market-data";
import { calculateForexPnL, calculateFuturesPnL } from "@/lib/market-data";
import type { ReplaySpeed } from "@/stores/replay-preferences-store";

// =============================================================================
// TYPES
// =============================================================================

export interface ReplayExecution {
	id: string;
	executionType: "entry" | "exit" | "scale_in" | "scale_out";
	price: string;
	quantity: string;
	executedAt: Date | string;
	realizedPnl?: string | null;
}

export interface ReplayState {
	isPlaying: boolean;
	currentTime: number; // Timestamp in seconds (UTC)
	speed: ReplaySpeed;
	progress: number; // 0-100 percentage
	visibleBars: ChartBar[];
	visibleExecutions: ReplayExecution[];
	runningPnl: number;
	startTime: number; // Replay start timestamp (seconds)
	endTime: number; // Replay end timestamp (seconds)
	duration: number; // Total duration in seconds
}

interface UseReplayEngineOptions {
	bars: ChartBar[];
	executions: ReplayExecution[];
	entryTime: Date | string | null;
	exitTime: Date | string | null;
	entryPrice: string | null;
	direction: "long" | "short";
	symbol: string;
	instrumentType: "futures" | "forex";
	initialSpeed?: ReplaySpeed;
}

// Speed multipliers: 1 real second = X minutes of market time
const SPEED_MULTIPLIERS: Record<ReplaySpeed, number> = {
	"1x": 1,
	"2x": 2,
	"5x": 5,
	"10x": 10,
};

// =============================================================================
// REPLAY ENGINE HOOK
// =============================================================================

export function useReplayEngine({
	bars,
	executions,
	entryTime,
	exitTime,
	entryPrice: _entryPrice,
	direction,
	symbol,
	instrumentType,
	initialSpeed = "1x",
}: UseReplayEngineOptions) {
	// Convert times to timestamps (seconds)
	const startTimeRef = useRef(0);
	const endTimeRef = useRef(0);

	// Calculate start and end times from trade data
	useEffect(() => {
		if (entryTime) {
			const entryTs = Math.floor(new Date(entryTime).getTime() / 1000);
			// Add 5 minutes of context before entry
			startTimeRef.current = entryTs - 5 * 60;
		} else if (bars.length > 0 && bars[0]) {
			startTimeRef.current = bars[0].time;
		}

		if (exitTime) {
			const exitTs = Math.floor(new Date(exitTime).getTime() / 1000);
			// Add 2 minutes of context after exit
			endTimeRef.current = exitTs + 2 * 60;
		} else if (bars.length > 0) {
			const lastBar = bars[bars.length - 1];
			if (lastBar) {
				endTimeRef.current = lastBar.time;
			}
		}
	}, [bars, entryTime, exitTime]);

	// State
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(startTimeRef.current);
	const [speed, setSpeed] = useState<ReplaySpeed>(initialSpeed);

	// Refs for animation
	const rafIdRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef<number>(0);

	// Reset to start when trade data changes
	useEffect(() => {
		if (entryTime) {
			const entryTs = Math.floor(new Date(entryTime).getTime() / 1000);
			startTimeRef.current = entryTs - 5 * 60;
			setCurrentTime(startTimeRef.current);
			setIsPlaying(false);
		}
	}, [entryTime]);

	// Animation loop
	const animate = useCallback(
		(frameTime: number) => {
			if (!isPlaying) return;

			const delta = lastFrameTimeRef.current
				? frameTime - lastFrameTimeRef.current
				: 0;
			lastFrameTimeRef.current = frameTime;

			// 1 real second = 1 minute of market time at 1x speed
			// delta is in milliseconds, convert to seconds
			const deltaSeconds = delta / 1000;
			// Market time advance = real seconds * speed * 60 (minutes to seconds)
			const marketTimeAdvance = deltaSeconds * SPEED_MULTIPLIERS[speed] * 60;

			setCurrentTime((prev) => {
				const next = prev + marketTimeAdvance;
				if (next >= endTimeRef.current) {
					setIsPlaying(false);
					return endTimeRef.current;
				}
				return next;
			});

			rafIdRef.current = requestAnimationFrame(animate);
		},
		[isPlaying, speed],
	);

	// Start/stop animation
	useEffect(() => {
		if (isPlaying) {
			lastFrameTimeRef.current = 0;
			rafIdRef.current = requestAnimationFrame(animate);
		} else {
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		}

		return () => {
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
			}
		};
	}, [isPlaying, animate]);

	// Filter bars visible up to currentTime
	const visibleBars = bars.filter((bar) => bar.time <= currentTime);

	// Filter executions visible up to currentTime
	const visibleExecutions = executions.filter((exec) => {
		const execTs = Math.floor(new Date(exec.executedAt).getTime() / 1000);
		return execTs <= currentTime;
	});

	// Calculate running P&L using proper point/pip values
	const runningPnl = calculateRunningPnl(
		visibleExecutions,
		visibleBars,
		direction,
		symbol,
		instrumentType,
	);

	// Calculate progress percentage
	const duration = endTimeRef.current - startTimeRef.current;
	const elapsed = currentTime - startTimeRef.current;
	const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

	// Control functions
	const play = useCallback(() => {
		if (currentTime >= endTimeRef.current) {
			// Reset to start if at end
			setCurrentTime(startTimeRef.current);
		}
		setIsPlaying(true);
	}, [currentTime]);

	const pause = useCallback(() => {
		setIsPlaying(false);
	}, []);

	const togglePlay = useCallback(() => {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
	}, [isPlaying, play, pause]);

	const seekTo = useCallback((time: number) => {
		setCurrentTime(
			Math.max(startTimeRef.current, Math.min(endTimeRef.current, time)),
		);
	}, []);

	const seekToProgress = useCallback(
		(progressPercent: number) => {
			const targetTime =
				startTimeRef.current + (duration * progressPercent) / 100;
			seekTo(targetTime);
		},
		[duration, seekTo],
	);

	const jumpBackward = useCallback(
		(seconds: number = 60) => {
			seekTo(currentTime - seconds);
		},
		[currentTime, seekTo],
	);

	const jumpForward = useCallback(
		(seconds: number = 60) => {
			seekTo(currentTime + seconds);
		},
		[currentTime, seekTo],
	);

	const reset = useCallback(() => {
		setIsPlaying(false);
		setCurrentTime(startTimeRef.current);
	}, []);

	const changeSpeed = useCallback((newSpeed: ReplaySpeed) => {
		setSpeed(newSpeed);
	}, []);

	return {
		// State
		isPlaying,
		currentTime,
		speed,
		progress,
		visibleBars,
		visibleExecutions,
		runningPnl,
		startTime: startTimeRef.current,
		endTime: endTimeRef.current,
		duration,
		// Controls
		play,
		pause,
		togglePlay,
		seekTo,
		seekToProgress,
		jumpBackward,
		jumpForward,
		reset,
		changeSpeed,
	};
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateRunningPnl(
	visibleExecutions: ReplayExecution[],
	visibleBars: ChartBar[],
	direction: "long" | "short",
	symbol: string,
	instrumentType: "futures" | "forex",
): number {
	if (visibleExecutions.length === 0 || visibleBars.length === 0) {
		return 0;
	}

	// Find the entry execution
	const entryExec = visibleExecutions.find((e) => e.executionType === "entry");
	if (!entryExec) return 0;

	const entry = parseFloat(entryExec.price);
	const quantity = parseFloat(entryExec.quantity);
	const currentPrice = visibleBars[visibleBars.length - 1]?.close ?? entry;

	// Calculate unrealized P&L using proper point/pip values
	const unrealizedPnl =
		instrumentType === "futures"
			? calculateFuturesPnL(symbol, entry, currentPrice, quantity, direction)
			: calculateForexPnL(symbol, entry, currentPrice, quantity, direction);

	// Sum realized P&L from scale-outs and exits
	const realizedPnl = visibleExecutions
		.filter(
			(e) => e.executionType === "exit" || e.executionType === "scale_out",
		)
		.reduce((sum, e) => sum + (parseFloat(e.realizedPnl ?? "0") || 0), 0);

	return unrealizedPnl + realizedPnl;
}
