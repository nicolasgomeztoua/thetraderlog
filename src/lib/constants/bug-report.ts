// =============================================================================
// BUG REPORT CONSTANTS
// =============================================================================

export const BUG_CATEGORY_OPTIONS = [
	{ value: "ui", label: "UI / VISUAL" },
	{ value: "data", label: "DATA / CALCULATIONS" },
	{ value: "performance", label: "PERFORMANCE" },
	{ value: "crash", label: "CRASH / ERROR" },
	{ value: "other", label: "OTHER" },
] as const;

export const BUG_REPORT_MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

export const BUG_REPORT_ALLOWED_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;
