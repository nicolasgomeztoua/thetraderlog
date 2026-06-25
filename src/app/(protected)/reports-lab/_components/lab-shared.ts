"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import {
	AI_MODEL_OPTIONS,
	DEFAULT_REPORT_MODEL,
	SUGGESTED_REPORT_PROMPTS,
} from "@/lib/constants/ai";

// =============================================================================
// TYPES — a structural subset of the real listReports item, so real rows are
// assignable to it directly and sample rows can be hand-authored.
// =============================================================================

export type LabStatus = "queued" | "generating" | "complete" | "failed";

export interface ReportLike {
	id: string;
	title: string;
	prompt: string;
	model: string;
	status: LabStatus;
	chartsGenerated?: number | null;
	totalToolCalls?: number | null;
	currentRound?: number | null;
	progressStage?: string | null;
	progressDetail?: string | null;
	errorMessage?: string | null;
	createdAt: string | Date;
}

/** Props every variant receives — they are otherwise purely presentational. */
export interface VariantProps {
	reports: ReportLike[];
	onGenerate: (prompt: string, model: string) => void;
	onRetry: (id: string) => void;
	isGenerating: boolean;
}

// =============================================================================
// CONSTANTS (real product values)
// =============================================================================

export const LAB_MODELS = AI_MODEL_OPTIONS;
export const LAB_SUGGESTED = SUGGESTED_REPORT_PROMPTS;
export const LAB_DEFAULT_MODEL: string = DEFAULT_REPORT_MODEL;

export function modelLabel(modelId: string): string {
	return AI_MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId;
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

export function stageLineFor(r: ReportLike): string {
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

export function isActive(r: ReportLike): boolean {
	return r.status === "queued" || r.status === "generating";
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

// =============================================================================
// SAMPLE DATA — covers every state so each variant renders fully without
// needing a live generation in flight.
// =============================================================================

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

export const SAMPLE_REPORTS: ReportLike[] = [
	{
		id: "smpl_gen",
		title: "Analyze my revenge-trading days — triggers and what they cost me",
		prompt:
			"Break down my revenge-trading days: what triggers them, the position-sizing drift afterward, and the realized cost vs my baseline.",
		model: "z-ai/glm-5.2",
		status: "generating",
		progressStage: "gathering_data",
		progressDetail: "run_query",
		currentRound: 7,
		totalToolCalls: 23,
		chartsGenerated: 2,
		createdAt: ago(1.6),
	},
	{
		id: "smpl_queued",
		title: "Prop challenge compliance + probability of passing",
		prompt:
			"Generate a prop challenge compliance report with drawdown analysis, daily-loss tracking, and a probability of passing at my current pace.",
		model: "xiaomi/mimo-v2.5-pro",
		status: "queued",
		progressStage: "queued",
		createdAt: ago(0.4),
	},
	{
		id: "smpl_done_1",
		title: "Comprehensive monthly performance review",
		prompt:
			"Generate a comprehensive monthly performance review with equity-curve analysis, win-rate trends, and behavioral pattern insights.",
		model: "z-ai/glm-5.2",
		status: "complete",
		chartsGenerated: 6,
		totalToolCalls: 41,
		createdAt: ago(126),
	},
	{
		id: "smpl_done_2",
		title: "Where am I leaving money on the table, session by session?",
		prompt:
			"Create a detailed session-by-session breakdown showing where I'm leaving money on the table and where I'm most disciplined.",
		model: "deepseek/deepseek-v4-pro",
		status: "complete",
		chartsGenerated: 3,
		totalToolCalls: 28,
		createdAt: ago(60 * 26),
	},
	{
		id: "smpl_failed",
		title: "Strategy comparison: which setups should I stop trading?",
		prompt:
			"Build a strategy comparison report showing which setups have the best expectancy and which I should stop trading.",
		model: "z-ai/glm-5.2",
		status: "failed",
		errorMessage: "Something went wrong while generating your report.",
		createdAt: ago(60 * 72),
	},
	{
		id: "smpl_done_3",
		title: "Risk management across all accounts",
		prompt:
			"Analyze my risk management across all accounts — compare position sizing, R-multiples, and drawdown patterns.",
		model: "z-ai/glm-5.2",
		status: "complete",
		chartsGenerated: 9,
		totalToolCalls: 53,
		createdAt: ago(60 * 120),
	},
];
