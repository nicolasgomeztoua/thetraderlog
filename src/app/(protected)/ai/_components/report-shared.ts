"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { AI_MODEL_OPTIONS } from "@/lib/constants/ai";
import type { RouterOutputs } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

export type ReportItem = RouterOutputs["ai"]["listReports"]["items"][number];
export type ReportStatus = ReportItem["status"];

export function isActive(r: ReportItem): boolean {
	return r.status === "queued" || r.status === "generating";
}

export function modelLabel(modelId: string): string {
	return AI_MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId;
}

// =============================================================================
// DATE RANGE PRESETS (optional report scope)
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
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		return { start: start.toISOString().split("T")[0] ?? "", end };
	}
	if (preset.days === -1) {
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
	const start = new Date(now);
	start.setDate(start.getDate() - preset.days);
	return { start: start.toISOString().split("T")[0] ?? "", end };
}

// =============================================================================
// PIPELINE / PROGRESS
// =============================================================================

export const PIPELINE_STAGES = [
	{ key: "queued", label: "Queue" },
	{ key: "building_context", label: "Context" },
	{ key: "planning", label: "Plan" },
	{ key: "gathering_data", label: "Gather" },
	{ key: "writing", label: "Write" },
	{ key: "validating", label: "Verify" },
] as const;

export const STAGE_LINE: Record<string, string> = {
	queued: "Waiting in queue",
	building_context: "Loading your trading profile",
	planning: "Planning the analysis",
	gathering_data: "Gathering your data",
	writing: "Writing the report",
	validating: "Validating output",
	analyzing: "Analyzing your data",
};

export const TOOL_LINE: Record<string, string> = {
	run_query: "Querying your trades",
	call_analytics: "Crunching the numbers",
	get_market_data: "Fetching market data",
	run_python: "Generating visualizations",
};

export function stageLineFor(r: ReportItem): string {
	const isGather =
		r.progressStage === "gathering_data" || r.progressStage === "analyzing";
	if (isGather && r.progressDetail) {
		return TOOL_LINE[r.progressDetail] ?? "Gathering your data";
	}
	return STAGE_LINE[r.progressStage ?? "queued"] ?? "Processing";
}

export function getActiveStageIndex(stage: string | null | undefined): number {
	switch (stage) {
		case "queued":
			return 0;
		case "building_context":
			return 1;
		case "planning":
			return 2;
		case "gathering_data":
		case "analyzing":
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

export function getProgressWidth(
	stage: string | null | undefined,
	round: number | null | undefined,
): number {
	const r = round ?? 0;
	switch (stage) {
		case "queued":
			return 6;
		case "building_context":
			return 14;
		case "planning":
			return 24;
		case "gathering_data":
		case "analyzing":
			return 32 + Math.min(r / 20, 1) * 42;
		case "writing":
			return 80;
		case "validating":
			return 92;
		case "complete":
			return 100;
		default:
			return 6;
	}
}

// =============================================================================
// FORMATTING + HOOKS
// =============================================================================

export function formatElapsed(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
	return h > 0
		? `${h}:${mm}:${sec.toString().padStart(2, "0")}`
		: `${mm}:${sec.toString().padStart(2, "0")}`;
}

export function relativeTime(date: string | Date): string {
	return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Ticking clock; only runs while `active`. */
export function useNow(active: boolean, intervalMs = 1000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [active, intervalMs]);
	return now;
}
