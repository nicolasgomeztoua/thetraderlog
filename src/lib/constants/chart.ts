// =============================================================================
// CHART DRAWING TOOL CONSTANTS
// =============================================================================

/** Cycling palette for user-drawn chart annotations */
export const DRAWING_COLORS = [
	"#d4ff00",
	"#00d4ff",
	"#ff3b3b",
	"#00ff88",
	"#71717a",
];

/** Default color for new annotations (Electric Chartreuse) */
export const DEFAULT_ANNOTATION_COLOR = "#d4ff00";

/** Map line style names to lightweight-charts LineStyle enum values */
export const LINE_STYLE_MAP: Record<"solid" | "dashed", number> = {
	solid: 0, // LineStyle.Solid
	dashed: 2, // LineStyle.Dashed
};
