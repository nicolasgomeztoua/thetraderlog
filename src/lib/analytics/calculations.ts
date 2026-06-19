/**
 * Utility functions for analytics calculations.
 * Threshold lookups, formatters, and chart utilities.
 */

import { ANALYTICS_COLORS, MONTHS } from "./constants";
import {
	CORRELATION_THRESHOLDS,
	DISCIPLINE_SCORE_THRESHOLDS,
	DRAWDOWN_SEVERITY_THRESHOLDS,
	EFFICIENCY_RATING_THRESHOLDS,
	HEATMAP_INTENSITY_THRESHOLDS,
	KELLY_THRESHOLDS,
	MONTE_CARLO_PROBABILITY_THRESHOLDS,
	OVERTRADING_THRESHOLDS,
	REVENGE_TRADING_THRESHOLDS,
	RISK_OF_RUIN_THRESHOLDS,
	TILT_SCORE_THRESHOLDS,
} from "./thresholds";

// ============================================================================
// THRESHOLD LOOKUP UTILITIES
// ============================================================================

// Default fallbacks (type-safe alternatives to non-null assertions)
const DEFAULT_BEHAVIORAL_LEVEL = {
	max: Number.POSITIVE_INFINITY,
	label: "Unknown",
	description: "Unable to determine level",
	colorClass: "text-muted-foreground",
	bgClass: "bg-muted-foreground",
} as const;

const DEFAULT_MIN_LEVEL = {
	min: 0,
	label: "Unknown",
	description: "Unable to determine level",
	colorClass: "text-muted-foreground",
	bgClass: "bg-muted-foreground",
} as const;

const DEFAULT_RISK_LEVEL = {
	max: Number.POSITIVE_INFINITY,
	label: "Unknown",
	color: ANALYTICS_COLORS.muted,
	colorKey: "muted" as const,
} as const;

const DEFAULT_DRAWDOWN_LEVEL = {
	ratio: 0,
	label: "Unknown",
	colorClass: "text-muted-foreground",
	bgClass: "bg-muted-foreground",
} as const;

/**
 * Get the tilt score level for a given score.
 */
export function getTiltScoreLevel(score: number) {
	return (
		TILT_SCORE_THRESHOLDS.find((t) => score < t.max) ?? DEFAULT_BEHAVIORAL_LEVEL
	);
}

/**
 * Get the discipline score level for a given score.
 */
export function getDisciplineScoreLevel(score: number) {
	return (
		DISCIPLINE_SCORE_THRESHOLDS.find((t) => score >= t.min) ?? DEFAULT_MIN_LEVEL
	);
}

/**
 * Get the overtrading level for a given count.
 */
export function getOvertradingLevel(count: number) {
	return (
		OVERTRADING_THRESHOLDS.find((t) => count < t.max) ??
		DEFAULT_BEHAVIORAL_LEVEL
	);
}

/**
 * Get the risk of ruin level for a given RoR percentage.
 */
export function getRiskOfRuinLevel(ror: number) {
	return (
		RISK_OF_RUIN_THRESHOLDS.find((t) => ror <= t.max) ?? DEFAULT_RISK_LEVEL
	);
}

/**
 * Get the Kelly criterion level for a given percentage.
 */
export function getKellyLevel(kelly: number) {
	return (
		KELLY_THRESHOLDS.find((t) => kelly <= t.max) ?? DEFAULT_BEHAVIORAL_LEVEL
	);
}

/**
 * Get the efficiency rating level for a given percentage.
 */
export function getEfficiencyRatingLevel(efficiency: number) {
	return (
		EFFICIENCY_RATING_THRESHOLDS.find((t) => efficiency >= t.min) ??
		DEFAULT_MIN_LEVEL
	);
}

/**
 * Get the Monte Carlo probability level.
 */
export function getMonteCarloProbabilityLevel(probability: number) {
	return (
		MONTE_CARLO_PROBABILITY_THRESHOLDS.find((t) => probability >= t.min) ?? {
			min: 0,
			label: "Unknown",
			colorClass: "text-muted-foreground",
			bgClass: "bg-muted-foreground",
		}
	);
}

/**
 * Get the correlation level for overtrading analysis.
 */
export function getCorrelationLevel(correlation: number) {
	return (
		CORRELATION_THRESHOLDS.find((t) => correlation < t.max) ??
		DEFAULT_BEHAVIORAL_LEVEL
	);
}

/**
 * Get the revenge trading risk level.
 */
export function getRevengeTradingLevel(riskScore: number) {
	return (
		REVENGE_TRADING_THRESHOLDS.find((t) => riskScore < t.max) ??
		DEFAULT_BEHAVIORAL_LEVEL
	);
}

/**
 * Get the drawdown severity level based on ratio to max.
 */
export function getDrawdownSeverityLevel(ratio: number) {
	return (
		DRAWDOWN_SEVERITY_THRESHOLDS.find((t) => ratio >= t.ratio) ??
		DEFAULT_DRAWDOWN_LEVEL
	);
}

// ============================================================================
// HEATMAP UTILITIES
// ============================================================================

/**
 * Get heatmap intensity for a value relative to max.
 */
export function getHeatmapIntensity(value: number, max: number): number {
	if (max === 0) return 0;
	const normalized = Math.abs(value) / max;

	for (const { threshold, intensity } of HEATMAP_INTENSITY_THRESHOLDS) {
		if (normalized < threshold) {
			return intensity;
		}
	}
	// Default to highest intensity if no threshold matched
	return 0.8;
}

/**
 * Get the color for a P&L value (profit green or loss red).
 */
export function getPnlColor(value: number): string {
	return value >= 0 ? ANALYTICS_COLORS.profit : ANALYTICS_COLORS.loss;
}

/**
 * Get the fill color for a P&L value (with transparency).
 */
export function getPnlFillColor(value: number): string {
	return value >= 0 ? ANALYTICS_COLORS.profitFill : ANALYTICS_COLORS.lossFill;
}

/**
 * Get a color from the palette by index (wraps around).
 */
export function getPaletteColor(index: number): string {
	const color =
		ANALYTICS_COLORS.palette[index % ANALYTICS_COLORS.palette.length];
	return color ?? ANALYTICS_COLORS.primary;
}

// ============================================================================
// TIME FORMATTERS
// ============================================================================

/**
 * Format hour in 12-hour format with am/pm.
 */
export function formatHour12(hour: number): string {
	if (hour === 0) return "12am";
	if (hour === 12) return "12pm";
	return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/**
 * Format hour in 24-hour format (HH:00).
 */
export function formatHour24(hour: number): string {
	return `${hour.toString().padStart(2, "0")}:00`;
}

/**
 * Get month short label (Jan, Feb, etc.).
 */
export function formatMonth(monthIndex: number): string {
	return MONTHS[monthIndex]?.label ?? "";
}

/**
 * Get month full name (January, February, etc.).
 */
export function formatMonthFull(monthIndex: number): string {
	return MONTHS[monthIndex]?.full ?? "";
}

// ============================================================================
// NUMBER FORMATTERS
// NOTE: formatCurrency and formatPercent live in @/lib/shared/utils.ts
// Use those for consistency across the codebase.
// ============================================================================

/**
 * Format a number with appropriate suffix (K, M, B).
 */
export function formatCompactNumber(value: number): string {
	if (Math.abs(value) >= 1e9) {
		return `${(value / 1e9).toFixed(1)}B`;
	}
	if (Math.abs(value) >= 1e6) {
		return `${(value / 1e6).toFixed(1)}M`;
	}
	if (Math.abs(value) >= 1e3) {
		return `${(value / 1e3).toFixed(1)}K`;
	}
	return value.toFixed(0);
}

// ============================================================================
// CHART AXIS STYLES
// ============================================================================

/**
 * Common axis styling for Recharts.
 */
export const CHART_AXIS_STYLE = {
	label: { fill: ANALYTICS_COLORS.muted },
	line: { stroke: ANALYTICS_COLORS.surface },
	tick: { stroke: ANALYTICS_COLORS.surface },
} as const;

/**
 * Common grid styling for Recharts.
 */
export const CHART_GRID_STYLE = {
	strokeDasharray: "3 3",
	stroke: ANALYTICS_COLORS.gridLight,
	vertical: false,
} as const;

/**
 * Common tooltip styling for Recharts.
 */
export const CHART_TOOLTIP_STYLE = {
	contentStyle: {
		backgroundColor: ANALYTICS_COLORS.background,
		border: `1px solid ${ANALYTICS_COLORS.surface}`,
		borderRadius: "8px",
	},
	labelStyle: { color: ANALYTICS_COLORS.mutedLight },
} as const;
