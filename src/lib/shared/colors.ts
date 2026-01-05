/**
 * Centralized color constants for the Terminal Design System.
 * Single source of truth for all colors used across the application.
 */

// =============================================================================
// CORE DESIGN SYSTEM COLORS
// =============================================================================

export const COLORS = {
	// Primary palette
	primary: "#d4ff00", // Electric Chartreuse
	secondary: "#00d4ff", // Ice Blue
	profit: "#00ff88", // Profit Green
	loss: "#ff3b3b", // Loss Red
	breakeven: "#fbbf24", // Amber/Yellow

	// Background
	background: "#050505", // Dark background
	surface: "#1e293b", // Slate-800
	inputBg: "#141414", // Input background

	// Text
	text: "#fafafa", // Primary text
	muted: "#64748b", // Slate-500
	mutedLight: "#94a3b8", // Slate-400
} as const;

// =============================================================================
// PRESET COLOR PALETTES (Tags, Strategies, Sessions)
// =============================================================================

export const PRESET_COLORS = [
	"#d4ff00", // Chartreuse (primary)
	"#00d4ff", // Ice blue (secondary)
	"#00ff88", // Profit green
	"#ff3b3b", // Loss red
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#8b5cf6", // Violet
	"#14b8a6", // Teal
	"#f97316", // Orange
	"#6366f1", // Indigo
] as const;

export const DEFAULT_COLOR = "#6366f1"; // Indigo fallback

// =============================================================================
// ACCOUNT TYPE COLORS (Tailwind classes)
// =============================================================================

export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
	prop_challenge: "bg-amber-500",
	prop_funded: "bg-purple-500",
	live: "bg-profit",
	demo: "bg-accent",
};

// =============================================================================
// CHALLENGE STATUS COLORS (Tailwind classes)
// =============================================================================

export const CHALLENGE_STATUS_COLORS: Record<string, string> = {
	active: "bg-amber-500",
	passed: "bg-green-500",
	failed: "bg-red-500",
};

// =============================================================================
// CHART COLORS
// =============================================================================

export const CHART_COLORS = {
	// Candlesticks
	candleUp: "#00ff88",
	candleDown: "#ff3b3b",

	// Grid & axes
	grid: "rgba(255, 255, 255, 0.03)",
	gridMedium: "rgba(255, 255, 255, 0.08)",
	axisLabel: "#64748b",
	axisLine: "#1e293b",

	// Annotations
	entryLine: "#d4ff00",
	exitLine: "#00d4ff",
	annotationBg: "rgba(212, 255, 0, 0.5)",
} as const;

// =============================================================================
// RISK LEVEL COLORS
// =============================================================================

export const RISK_COLORS = {
	low: "#00ff88", // RoR <= 1%
	moderate: "#00d4ff", // RoR <= 5%
	elevated: "#fbbf24", // RoR <= 20%
	critical: "#ff3b3b", // RoR > 20%
} as const;

// =============================================================================
// CLERK THEME CONFIGURATION
// =============================================================================

export const CLERK_THEME = {
	colorPrimary: COLORS.primary,
	colorBackground: COLORS.background,
	colorInputBackground: COLORS.inputBg,
	colorInputText: COLORS.text,
} as const;
