"use client";

import {
	ChevronLeft,
	ChevronRight,
	Pause,
	Play,
	RotateCcw,
} from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTimezone } from "@/hooks/use-timezone";
import type { ChartInterval } from "@/lib/candle-aggregation";
import { cn } from "@/lib/utils";
import type { ReplaySpeed } from "@/stores/replay-preferences-store";

// Interval to seconds mapping for jump buttons
const INTERVAL_SECONDS: Record<ChartInterval, number> = {
	"1min": 60,
	"5min": 300,
	"15min": 900,
	"30min": 1800,
	"1h": 3600,
};

// =============================================================================
// TYPES
// =============================================================================

interface ReplayControlsProps {
	isPlaying: boolean;
	currentTime: number;
	progress: number;
	speed: ReplaySpeed;
	startTime: number;
	endTime: number;
	interval: ChartInterval;
	onTogglePlay: () => void;
	onReset: () => void;
	onSpeedChange: (speed: ReplaySpeed) => void;
	onSeekToProgress: (progress: number) => void;
	onJumpBackward: (seconds?: number) => void;
	onJumpForward: (seconds?: number) => void;
	className?: string;
}

const SPEEDS: ReplaySpeed[] = ["1x", "2x", "5x", "10x"];

// =============================================================================
// COMPONENT
// =============================================================================

export function ReplayControls({
	isPlaying,
	currentTime,
	progress,
	speed,
	startTime: _startTime,
	endTime,
	interval,
	onTogglePlay,
	onReset,
	onSpeedChange,
	onSeekToProgress,
	onJumpBackward,
	onJumpForward,
	className,
}: ReplayControlsProps) {
	const jumpSeconds = INTERVAL_SECONDS[interval];
	const { formatTime } = useTimezone();

	// Handle slider change
	const handleSliderChange = useCallback(
		(value: number[]) => {
			onSeekToProgress(value[0] ?? 0);
		},
		[onSeekToProgress],
	);

	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-white/10 bg-white/2 p-3",
				className,
			)}
		>
			{/* Timeline Scrubber */}
			<div className="flex items-center gap-3">
				{/* Current Time */}
				<span className="min-w-[70px] font-mono text-[11px] text-muted-foreground">
					{formatTime(new Date(currentTime * 1000), { includeSeconds: true })}
				</span>

				{/* Slider */}
				<Slider
					className="flex-1"
					max={100}
					min={0}
					onValueChange={handleSliderChange}
					step={0.1}
					value={[progress]}
				/>

				{/* End Time */}
				<span className="min-w-[70px] text-right font-mono text-[11px] text-muted-foreground">
					{formatTime(new Date(endTime * 1000), { includeSeconds: true })}
				</span>
			</div>

			{/* Controls Row */}
			<div className="flex items-center justify-between">
				{/* Left: Jump & Play Controls */}
				<div className="flex items-center gap-1">
					{/* Reset */}
					<Button
						className="h-8 w-8 p-0"
						onClick={onReset}
						size="sm"
						title="Reset to start"
						variant="ghost"
					>
						<RotateCcw className="h-4 w-4" />
					</Button>

					{/* Jump Backward */}
					<Button
						className="h-8 w-8 p-0"
						onClick={() => onJumpBackward(jumpSeconds)}
						size="sm"
						title={`Jump back 1 ${interval === "1h" ? "hour" : "candle"}`}
						variant="ghost"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					{/* Play/Pause */}
					<Button
						className="h-10 w-10 p-0"
						onClick={onTogglePlay}
						size="sm"
						title={isPlaying ? "Pause" : "Play"}
						variant="outline"
					>
						{isPlaying ? (
							<Pause className="h-5 w-5 fill-current" />
						) : (
							<Play className="h-5 w-5 fill-current" />
						)}
					</Button>

					{/* Jump Forward */}
					<Button
						className="h-8 w-8 p-0"
						onClick={() => onJumpForward(jumpSeconds)}
						size="sm"
						title={`Jump forward 1 ${interval === "1h" ? "hour" : "candle"}`}
						variant="ghost"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				{/* Right: Speed Selector */}
				<div className="flex items-center gap-1">
					<span className="mr-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Speed
					</span>
					{SPEEDS.map((s) => (
						<button
							className={cn(
								"rounded px-2 py-1 font-mono text-[10px] uppercase transition-colors",
								speed === s
									? "bg-primary text-primary-foreground"
									: "bg-white/5 text-muted-foreground hover:bg-white/10",
							)}
							key={s}
							onClick={() => onSpeedChange(s)}
							type="button"
						>
							{s}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
