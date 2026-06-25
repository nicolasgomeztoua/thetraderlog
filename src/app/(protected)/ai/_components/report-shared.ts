import type { RouterOutputs } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

/** A single report as returned by `listReports` (one item from a page). */
export type ReportItem = RouterOutputs["ai"]["listReports"]["items"][number];

export type ReportStatus = ReportItem["status"];

// =============================================================================
// DATE RANGE PRESETS
// =============================================================================

export const QUICK_DATE_PRESETS = [
	{ label: "Last 7 days", days: 7 },
	{ label: "Last 30 days", days: 30 },
	{ label: "This month", days: 0 },
	{ label: "Last month", days: -1 },
] as const;

export type QuickDatePreset = (typeof QUICK_DATE_PRESETS)[number];

export function getDatePreset(preset: QuickDatePreset): {
	start: string;
	end: string;
} {
	const now = new Date();
	const end = now.toISOString().split("T")[0] ?? "";

	if (preset.days === 0) {
		// This month
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		return { start: start.toISOString().split("T")[0] ?? "", end };
	}
	if (preset.days === -1) {
		// Last month
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
		const lastMonthStart = new Date(
			lastMonthEnd.getFullYear(),
			lastMonthEnd.getMonth(),
			1,
		);
		return {
			start: lastMonthStart.toISOString().split("T")[0] ?? "",
			end: lastMonthEnd.toISOString().split("T")[0] ?? "",
		};
	}
	// N days ago
	const start = new Date(now);
	start.setDate(start.getDate() - preset.days);
	return { start: start.toISOString().split("T")[0] ?? "", end };
}

// =============================================================================
// PIPELINE / PROGRESS
// =============================================================================

/**
 * The generation pipeline, in order. Mirrors the server-side report phases
 * (queued → building_context → planning → gathering_data → writing → validating).
 * Rendered as a six-stage stepper in the live monitor.
 */
export const PIPELINE_STAGES = [
	{ key: "queued", label: "Queue" },
	{ key: "building_context", label: "Context" },
	{ key: "planning", label: "Plan" },
	{ key: "gathering_data", label: "Gather" },
	{ key: "writing", label: "Write" },
	{ key: "validating", label: "Verify" },
] as const;

/** Human-readable line shown for the report's current stage. */
export const PROGRESS_STAGE_LABELS: Record<string, string> = {
	queued: "Waiting in queue…",
	building_context: "Loading your trading profile…",
	planning: "Planning the analysis…",
	gathering_data: "Gathering your data…",
	writing: "Writing the report…",
	validating: "Validating output…",
	analyzing: "Analyzing your data…",
	complete: "Complete",
	failed: "Failed",
};

/** When a tool is running mid-gather, surface what it's doing. */
export const TOOL_DETAIL_LABELS: Record<string, string> = {
	run_query: "Querying your trades…",
	call_analytics: "Crunching the numbers…",
	get_market_data: "Fetching market data…",
	run_python: "Generating visualizations…",
};

/**
 * Index of the currently-active stage within PIPELINE_STAGES.
 * Stages before it are "done", stages after are "pending".
 * Returns PIPELINE_STAGES.length once complete (everything done).
 */
export function getActiveStageIndex(stage: string | null | undefined): number {
	switch (stage) {
		case "queued":
			return 0;
		case "building_context":
			return 1;
		case "planning":
			return 2;
		case "gathering_data":
		case "analyzing": // legacy stage name
			return 3;
		case "writing":
			return 4;
		case "validating":
			return 5;
		case "complete":
			return PIPELINE_STAGES.length;
		default:
			return 0;
	}
}

/** Continuous 0–100 progress estimate (drives the thin accent bar). */
export function getProgressWidth(
	stage: string | null | undefined,
	currentRound: number | null | undefined,
	totalRounds: number,
): number {
	switch (stage) {
		case "queued":
			return 5;
		case "building_context":
			return 10;
		case "planning":
			return 20;
		case "gathering_data": {
			const round = currentRound ?? 0;
			return 30 + Math.min(round / totalRounds, 1) * 40;
		}
		case "writing":
			return 75;
		case "validating":
			return 90;
		case "analyzing": {
			// Legacy stage name (kept for backward compat)
			const round = currentRound ?? 0;
			return 20 + Math.min(round / totalRounds, 1) * 70;
		}
		case "complete":
			return 100;
		default:
			return 5;
	}
}

// =============================================================================
// FORMATTING
// =============================================================================

/** Compact elapsed time, e.g. "0:42", "3:07", "1:04:20". */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const mm =
		hours > 0 ? minutes.toString().padStart(2, "0") : minutes.toString();
	const ss = seconds.toString().padStart(2, "0");
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
