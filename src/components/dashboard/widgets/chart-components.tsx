"use client";

import { cn } from "@/lib/shared";

/**
 * Circular gauge for displaying win rate percentage.
 * Used by multiple dashboard widgets.
 *
 * @param value - Win rate as percentage (0-100)
 * @param size - Diameter of the gauge in pixels
 * @param strokeWidth - Width of the gauge ring
 */
export function WinRateGauge({
	value,
	size = 48,
	strokeWidth = 4,
}: {
	value: number;
	size?: number;
	strokeWidth?: number;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const percent = Math.min(Math.max(value / 100, 0), 1);
	const offset = circumference - percent * circumference;

	const color = value >= 50 ? "stroke-profit" : "stroke-loss";
	const textColor = value >= 50 ? "text-profit" : "text-loss";

	// Adjust text size based on gauge size
	const textClass = size >= 56 ? "text-xs" : "text-[10px]";

	return (
		<div className="relative">
			<svg
				aria-hidden="true"
				className="-rotate-90 transform"
				height={size}
				width={size}
			>
				<circle
					className="stroke-white/10"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					strokeWidth={strokeWidth}
				/>
				<circle
					className={cn(color, "transition-all duration-500")}
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span className={cn("font-mono font-semibold", textClass, textColor)}>
					{Math.round(value)}%
				</span>
			</div>
		</div>
	);
}

/**
 * Simple sparkline chart for visualizing data trends.
 *
 * @param data - Array of numeric values to plot
 * @param height - Height of the sparkline in pixels
 * @param width - Width of the sparkline in pixels
 * @param color - Optional fixed color class, otherwise uses primary color
 */
export function Sparkline({
	data,
	height = 32,
	width = 100,
	color = "stroke-primary",
}: {
	data: number[];
	height?: number;
	width?: number;
	color?: string;
}) {
	if (data.length === 0) return null;

	const max = Math.max(...data, 1);
	const min = 0;
	const range = max - min;

	const points = data
		.map((val, i) => {
			const x = (i / Math.max(data.length - 1, 1)) * width;
			const y = height - ((val - min) / range) * height;
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<svg
			aria-hidden="true"
			className="overflow-visible"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<polyline
				className={cn("fill-none", color)}
				points={points}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
			/>
		</svg>
	);
}

/**
 * Sparkline showing cumulative P&L (profit/loss colored).
 * Calculates cumulative values from input data and colors based on final value.
 *
 * @param data - Array of individual P&L values (not cumulative)
 * @param height - Height of the sparkline in pixels
 * @param width - Width of the sparkline in pixels
 */
export function CumulativePnLSparkline({
	data,
	height = 24,
	width = 80,
}: {
	data: number[];
	height?: number;
	width?: number;
}) {
	if (data.length === 0) return null;

	// Calculate cumulative values
	const cumulative: number[] = [];
	let sum = 0;
	for (const val of data) {
		sum += val;
		cumulative.push(sum);
	}

	const max = Math.max(...cumulative, 0);
	const min = Math.min(...cumulative, 0);
	const range = max - min || 1;

	// Create path
	const points = cumulative
		.map((val, i) => {
			const x = (i / Math.max(cumulative.length - 1, 1)) * width;
			const y = height - ((val - min) / range) * height;
			return `${x},${y}`;
		})
		.join(" ");

	// Determine color based on final value
	const finalValue = cumulative[cumulative.length - 1] ?? 0;
	const strokeColor = finalValue >= 0 ? "stroke-profit" : "stroke-loss";

	return (
		<svg
			aria-hidden="true"
			className="overflow-visible"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<polyline
				className={cn("fill-none", strokeColor)}
				points={points}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
			/>
		</svg>
	);
}

/**
 * Mini donut chart for displaying distribution data.
 *
 * @param segments - Array of segments with value and color
 * @param size - Diameter of the donut in pixels
 * @param thickness - Thickness of the donut ring
 */
export function MiniDonut({
	segments,
	size = 40,
	thickness = 6,
}: {
	segments: Array<{ value: number; color: string }>;
	size?: number;
	thickness?: number;
}) {
	const total = segments.reduce((sum, s) => sum + s.value, 0);
	if (total === 0) return null;

	const radius = (size - thickness) / 2;
	const circumference = radius * 2 * Math.PI;

	let currentOffset = 0;
	const segmentElements = segments.map((segment, i) => {
		const segmentLength = (segment.value / total) * circumference;
		const dashArray = `${segmentLength} ${circumference - segmentLength}`;
		const element = (
			<circle
				className={segment.color}
				cx={size / 2}
				cy={size / 2}
				fill="none"
				key={`segment-${i}-${segment.value}`}
				r={radius}
				strokeDasharray={dashArray}
				strokeDashoffset={-currentOffset}
				strokeWidth={thickness}
			/>
		);
		currentOffset += segmentLength;
		return element;
	});

	return (
		<svg
			aria-hidden="true"
			className="-rotate-90 transform"
			height={size}
			width={size}
		>
			{segmentElements}
		</svg>
	);
}
