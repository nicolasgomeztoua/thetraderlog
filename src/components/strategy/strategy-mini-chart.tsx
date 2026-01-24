"use client";

import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface StrategyMiniChartProps {
	/** Array of P&L values (cumulative or per-trade) */
	data: number[];
	/** Chart width in pixels */
	width?: number;
	/** Chart height in pixels */
	height?: number;
	/** Additional className */
	className?: string;
	/** Show as cumulative P&L (line) or individual trades (bars) */
	variant?: "line" | "area";
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
	profit: "#00ff88",
	profitFill: "rgba(0, 255, 136, 0.2)",
	loss: "#ff3b3b",
	lossFill: "rgba(255, 59, 59, 0.2)",
	neutral: "#888888",
	neutralFill: "rgba(136, 136, 136, 0.2)",
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Lightweight SVG sparkline chart for strategy cards.
 * Shows cumulative P&L trend with minimal footprint (no AG Charts).
 *
 * @example
 * // Basic usage with cumulative P&L
 * <StrategyMiniChart data={[0, 100, 50, 150, 120, 200]} />
 *
 * @example
 * // With custom dimensions
 * <StrategyMiniChart data={pnlData} width={120} height={60} />
 */
export function StrategyMiniChart({
	data,
	width = 100,
	height = 40,
	className,
	variant = "area",
}: StrategyMiniChartProps) {
	// Handle empty or insufficient data
	if (!data || data.length === 0) {
		return (
			<div
				className={cn(
					"flex items-center justify-center font-mono text-[10px] text-muted-foreground/50",
					className,
				)}
				data-testid="strategy-mini-chart-empty"
				style={{ width, height }}
			>
				No data
			</div>
		);
	}

	// Single data point - show flat line
	if (data.length === 1) {
		const color = (data[0] ?? 0) >= 0 ? COLORS.profit : COLORS.loss;
		return (
			<svg
				aria-hidden="true"
				className={cn("overflow-visible", className)}
				data-testid="strategy-mini-chart"
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				width={width}
			>
				<line
					stroke={color}
					strokeWidth={2}
					x1={0}
					x2={width}
					y1={height / 2}
					y2={height / 2}
				/>
			</svg>
		);
	}

	// Calculate min/max for scaling
	const minValue = Math.min(...data);
	const maxValue = Math.max(...data);
	const valueRange = maxValue - minValue || 1; // Avoid division by zero

	// Add padding to prevent clipping at edges
	const padding = { top: 2, bottom: 2, left: 2, right: 2 };
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;

	// Calculate point positions
	const points = data.map((value, index) => {
		const x = padding.left + (index / (data.length - 1)) * chartWidth;
		const normalizedValue = (value - minValue) / valueRange;
		// Invert Y because SVG Y increases downward
		const y = padding.top + (1 - normalizedValue) * chartHeight;
		return { x, y, value };
	});

	// Build SVG path
	const linePath = points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
		.join(" ");

	// Build area path (for filled variant)
	const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${height} L ${padding.left} ${height} Z`;

	// Determine color based on final value (or overall trend)
	const finalValue = data[data.length - 1] ?? 0;
	const initialValue = data[0] ?? 0;
	const isPositive = finalValue >= initialValue;
	const strokeColor = isPositive ? COLORS.profit : COLORS.loss;

	return (
		<svg
			aria-hidden="true"
			className={cn("overflow-visible", className)}
			data-testid="strategy-mini-chart"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			{/* Gradient definition for area fill */}
			<defs>
				<linearGradient
					id={`mini-chart-gradient-${isPositive ? "profit" : "loss"}`}
					x1="0"
					x2="0"
					y1="0"
					y2="1"
				>
					<stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
					<stop offset="100%" stopColor={strokeColor} stopOpacity={0.05} />
				</linearGradient>
			</defs>

			{/* Area fill (if area variant) */}
			{variant === "area" && (
				<path
					d={areaPath}
					fill={`url(#mini-chart-gradient-${isPositive ? "profit" : "loss"})`}
				/>
			)}

			{/* Line */}
			<path
				d={linePath}
				fill="none"
				stroke={strokeColor}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
			/>

			{/* End point indicator */}
			<circle
				cx={points[points.length - 1]?.x ?? 0}
				cy={points[points.length - 1]?.y ?? 0}
				fill={strokeColor}
				r={2}
			/>
		</svg>
	);
}
