/**
 * Centralized threshold definitions for analytics components.
 * All numeric thresholds with their labels and descriptions.
 */

import { ANALYTICS_COLORS } from "./constants";

// ============================================================================
// RISK THRESHOLDS
// ============================================================================

export const RISK_OF_RUIN_THRESHOLDS = [
	{
		max: 1,
		label: "Low Risk",
		color: ANALYTICS_COLORS.profit,
		colorKey: "profit" as const,
	},
	{
		max: 5,
		label: "Moderate",
		color: ANALYTICS_COLORS.secondary,
		colorKey: "secondary" as const,
	},
	{
		max: 20,
		label: "Elevated",
		color: ANALYTICS_COLORS.breakeven,
		colorKey: "breakeven" as const,
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "Critical",
		color: ANALYTICS_COLORS.loss,
		colorKey: "loss" as const,
	},
] as const;

export const KELLY_THRESHOLDS = [
	{
		max: 0,
		label: "No Edge",
		description: "Strategy has negative expectancy",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
	{
		max: 5,
		label: "Conservative",
		description: "Small edge detected - consider paper trading",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		max: 15,
		label: "Moderate Edge",
		description: "Solid positive expectancy",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		max: 30,
		label: "Strong Edge",
		description: "Significant advantage detected",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "Very High",
		description: "Consider half-Kelly for safety",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
] as const;

// ============================================================================
// BEHAVIORAL THRESHOLDS
// ============================================================================

export const TILT_SCORE_THRESHOLDS = [
	{
		max: 30,
		label: "Excellent",
		description: "Consistent emotional control",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		max: 50,
		label: "Stable",
		description: "Generally stable performance",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		max: 70,
		label: "Some Tilt",
		description: "Occasional tilt patterns detected",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "High Risk",
		description: "Significant tilt detected",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const DISCIPLINE_SCORE_THRESHOLDS = [
	{
		min: 80,
		label: "Highly Disciplined",
		description: "Excellent rule adherence",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		min: 60,
		label: "Good Discipline",
		description: "Generally follows trading plan",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		min: 40,
		label: "Room for Improvement",
		description: "Inconsistent rule following",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		min: 0,
		label: "Low Adherence",
		description: "Significant discipline issues",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const OVERTRADING_THRESHOLDS = [
	{
		max: 10,
		label: "Controlled",
		description: "Trading frequency is well managed",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		max: 20,
		label: "Active",
		description: "Moderate trading activity",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		max: 30,
		label: "High Frequency",
		description: "Consider reducing trade count",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "Overtrading",
		description: "Excessive trading detected",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const REVENGE_TRADING_THRESHOLDS = [
	{
		max: 20,
		label: "Low Risk",
		description: "Good emotional control after losses",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		max: 40,
		label: "Moderate",
		description: "Some reactive trading patterns",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		max: 60,
		label: "Elevated",
		description: "Notable revenge trading tendency",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "High Risk",
		description: "Significant revenge trading detected",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

export const EFFICIENCY_RATING_THRESHOLDS = [
	{
		min: 80,
		label: "Excellent",
		description: "Highly efficient risk-reward capture",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		min: 60,
		label: "Good",
		description: "Solid risk-reward execution",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		min: 40,
		label: "Fair",
		description: "Room for improvement",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		min: 0,
		label: "Poor",
		description: "Significant efficiency issues",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const MONTE_CARLO_PROBABILITY_THRESHOLDS = [
	{
		min: 70,
		label: "High Probability",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		min: 50,
		label: "Moderate Probability",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		min: 0,
		label: "Low Probability",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const CORRELATION_THRESHOLDS = [
	{
		max: -0.3,
		label: "Negative Correlation",
		description: "More trades correlate with worse performance",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
	{
		max: 0.1,
		label: "No Correlation",
		description: "Trade count does not affect performance",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		max: Number.POSITIVE_INFINITY,
		label: "Positive Correlation",
		description: "More trades may indicate overtrading",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
] as const;

export const DRAWDOWN_SEVERITY_THRESHOLDS = [
	{
		ratio: 0.8,
		label: "Severe",
		colorClass: "text-loss",
		bgClass: "bg-loss",
	},
	{
		ratio: 0.5,
		label: "Moderate",
		colorClass: "text-amber-400",
		bgClass: "bg-amber-400",
	},
	{
		ratio: 0.25,
		label: "Minor",
		colorClass: "text-accent",
		bgClass: "bg-accent",
	},
	{
		ratio: 0,
		label: "Minimal",
		colorClass: "text-profit",
		bgClass: "bg-profit",
	},
] as const;

// ============================================================================
// HEATMAP INTENSITY THRESHOLDS
// ============================================================================

export const HEATMAP_INTENSITY_THRESHOLDS = [
	{ threshold: 0.25, intensity: 0.2 },
	{ threshold: 0.5, intensity: 0.4 },
	{ threshold: 0.75, intensity: 0.6 },
	{ threshold: 1.0, intensity: 0.8 },
] as const;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const RISK_DEFAULTS = {
	ruinThresholdPercent: 50,
	riskPerTradePercent: 2,
	minTradesForMonteCarlo: 10,
	monteCarloIterations: 1000,
} as const;
