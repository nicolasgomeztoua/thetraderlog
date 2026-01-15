/**
 * Centralized constants for analytics components.
 * Single source of truth for colors, time values, emotional states, and filter options.
 */

// ============================================================================
// COLORS (Terminal Design System)
// ============================================================================

export const ANALYTICS_COLORS = {
	// Data colors
	profit: "#00ff88",
	profitFill: "#00ff8820",
	loss: "#ff3b3b",
	lossFill: "#ff3b3b20",
	breakeven: "#fbbf24",

	// UI colors
	primary: "#d4ff00",
	secondary: "#00d4ff",
	muted: "#64748b",
	mutedLight: "#94a3b8",
	background: "#050505",
	surface: "#1e293b",

	// Grid/overlay
	gridLight: "#ffffff08",
	gridMedium: "#ffffff10",

	// Chart palette (for multi-series data like symbols)
	palette: [
		"#d4ff00", // chartreuse (primary)
		"#00d4ff", // ice blue (secondary)
		"#00ff88", // profit green
		"#ff3b3b", // loss red
		"#fbbf24", // amber
		"#a78bfa", // purple
		"#f472b6", // pink
		"#38bdf8", // sky blue
		"#34d399", // emerald
		"#fb923c", // orange
	],
} as const;

// ============================================================================
// TIME CONSTANTS
// ============================================================================

export const DAYS_OF_WEEK = [
	{ value: 0, label: "Sun", full: "Sunday" },
	{ value: 1, label: "Mon", full: "Monday" },
	{ value: 2, label: "Tue", full: "Tuesday" },
	{ value: 3, label: "Wed", full: "Wednesday" },
	{ value: 4, label: "Thu", full: "Thursday" },
	{ value: 5, label: "Fri", full: "Friday" },
	{ value: 6, label: "Sat", full: "Saturday" },
] as const;

export const MONTHS = [
	{ value: 0, label: "Jan", full: "January" },
	{ value: 1, label: "Feb", full: "February" },
	{ value: 2, label: "Mar", full: "March" },
	{ value: 3, label: "Apr", full: "April" },
	{ value: 4, label: "May", full: "May" },
	{ value: 5, label: "Jun", full: "June" },
	{ value: 6, label: "Jul", full: "July" },
	{ value: 7, label: "Aug", full: "August" },
	{ value: 8, label: "Sep", full: "September" },
	{ value: 9, label: "Oct", full: "October" },
	{ value: 10, label: "Nov", full: "November" },
	{ value: 11, label: "Dec", full: "December" },
] as const;

export const TRADING_SESSIONS = [
	{ id: "asia", label: "Asia", startHour: 0, endHour: 8 },
	{ id: "london", label: "London", startHour: 8, endHour: 16 },
	{ id: "new_york", label: "New York", startHour: 13, endHour: 21 },
] as const;

/**
 * Key trading hours for filter UI.
 * Includes market open/close times for major sessions.
 */
export const KEY_HOURS = [
	{ value: 0, label: "00:00" },
	{ value: 4, label: "04:00" },
	{ value: 8, label: "08:00" },
	{ value: 9, label: "09:00" },
	{ value: 10, label: "10:00" },
	{ value: 11, label: "11:00" },
	{ value: 12, label: "12:00" },
	{ value: 13, label: "13:00" },
	{ value: 14, label: "14:00" },
	{ value: 15, label: "15:00" },
	{ value: 16, label: "16:00" },
	{ value: 20, label: "20:00" },
] as const;

/**
 * All 24 hours for complete hour selection.
 */
export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => ({
	value: i,
	label: `${i.toString().padStart(2, "0")}:00`,
})) as readonly { value: number; label: string }[];

// ============================================================================
// EMOTIONAL STATES
// ============================================================================

export const EMOTIONAL_STATES = {
	confident: { label: "Confident", colorClass: "text-profit" },
	fearful: { label: "Fearful", colorClass: "text-amber-400" },
	greedy: { label: "Greedy", colorClass: "text-loss" },
	neutral: { label: "Neutral", colorClass: "text-muted-foreground" },
	frustrated: { label: "Frustrated", colorClass: "text-loss" },
	excited: { label: "Excited", colorClass: "text-amber-400" },
	anxious: { label: "Anxious", colorClass: "text-amber-400" },
	untracked: { label: "Untracked", colorClass: "text-muted-foreground/60" },
} as const;

export type EmotionalState = keyof typeof EMOTIONAL_STATES;

// ============================================================================
// FILTER OPTIONS
// ============================================================================

export const OUTCOME_OPTIONS = [
	{ value: "all", label: "All Trades" },
	{ value: "win", label: "Winners" },
	{ value: "loss", label: "Losers" },
	{ value: "breakeven", label: "Breakeven" },
] as const;

export const REVIEW_STATUS_OPTIONS = [
	{ value: "all", label: "All Trades" },
	{ value: "reviewed", label: "Reviewed" },
	{ value: "unreviewed", label: "Unreviewed" },
] as const;

/**
 * Query condition options (for query builder)
 */
export const QUERY_OUTCOME_OPTIONS = [
	{ value: "win", label: "Win" },
	{ value: "loss", label: "Loss" },
	{ value: "breakeven", label: "Breakeven" },
] as const;

export const QUERY_REVIEWED_OPTIONS = [
	{ value: "true", label: "Reviewed" },
	{ value: "false", label: "Not reviewed" },
] as const;

// ============================================================================
// CHART DIMENSIONS
// ============================================================================

export const CHART_DIMENSIONS = {
	equityCurve: { height: 280, strokeWidth: 2, markerSize: 5 },
	monthly: { height: 240, strokeWidth: 2, markerSize: 6 },
	riskGauge: { size: 200, strokeWidth: 14, innerOffset: 20, outerOffset: 8 },
	runningPnl: { height: 200, strokeWidth: 1.5 },
} as const;

// ============================================================================
// HOLDING TIME BUCKETS
// ============================================================================

export const HOLDING_TIME_BUCKETS = [
	{ id: "0-5min", label: "0-5min", maxMinutes: 5 },
	{ id: "5-15min", label: "5-15min", maxMinutes: 15 },
	{ id: "15-30min", label: "15-30min", maxMinutes: 30 },
	{ id: "30-60min", label: "30-60min", maxMinutes: 60 },
	{ id: "1-4h", label: "1-4h", maxMinutes: 240 },
	{ id: "4h+", label: "4h+", maxMinutes: Number.POSITIVE_INFINITY },
] as const;
