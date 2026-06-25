"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/shared/utils";
import {
	formatElapsed,
	getActiveStageIndex,
	getProgressWidth,
	PIPELINE_STAGES,
	PROGRESS_STAGE_LABELS,
	type ReportItem,
	TOOL_DETAIL_LABELS,
} from "./report-shared";

/** Live "now" tick, 1s cadence — only used while a generation is on screen. */
function useTick(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [active]);
	return now;
}

/** A counter that briefly flashes (re-mounts → fade-in) whenever its value grows. */
function LiveCounter({ value, label }: { value: number; label: string }) {
	return (
		<span className="flex items-baseline gap-1">
			<span
				className="animate-fade-in-up font-mono text-accent text-xs tabular-nums"
				key={value}
			>
				{value.toLocaleString()}
			</span>
			<span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
				{label}
			</span>
		</span>
	);
}

interface ReportProgressMonitorProps {
	report: ReportItem;
}

/**
 * The live generation experience: a six-stage pipeline stepper, an honest
 * "elapsed since submitted" timer, a continuous progress bar, the current
 * stage detail line, and flashing data counters (rounds / tool calls / charts).
 */
export function ReportProgressMonitor({ report }: ReportProgressMonitorProps) {
	const now = useTick(true);
	const elapsedMs = now - new Date(report.createdAt).getTime();

	const activeIndex = getActiveStageIndex(report.progressStage);
	const widthPct = getProgressWidth(
		report.progressStage,
		report.currentRound,
		20,
	);

	const isGathering =
		report.progressStage === "gathering_data" ||
		report.progressStage === "analyzing";

	const stageLine =
		isGathering && report.progressDetail
			? (TOOL_DETAIL_LABELS[report.progressDetail] ?? "Gathering your data…")
			: (PROGRESS_STAGE_LABELS[report.progressStage ?? "queued"] ??
				"Processing…");

	const round = report.currentRound ?? 0;
	const toolCalls = report.totalToolCalls ?? 0;
	const charts = report.chartsGenerated ?? 0;
	const hasCounters = round > 0 || toolCalls > 0 || charts > 0;

	return (
		<div
			className="rounded border border-accent/20 bg-accent/[0.03] p-3"
			data-testid={`report-progress-${report.id}`}
		>
			{/* Header: live pulse + elapsed timer */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="pulse-dot size-1.5 rounded-full bg-accent" />
					<span className="font-mono text-[10px] text-accent uppercase tracking-wider">
						Working
					</span>
				</div>
				<span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
					{formatElapsed(elapsedMs)} elapsed
				</span>
			</div>

			{/* Six-stage pipeline stepper */}
			<div className="mb-2 grid grid-cols-6 gap-1">
				{PIPELINE_STAGES.map((stage, i) => {
					const isDone = i < activeIndex;
					const isCurrent = i === activeIndex;
					return (
						<div className="flex flex-col gap-1" key={stage.key}>
							<div
								className={cn(
									"h-0.5 rounded-full transition-colors duration-500",
									isDone && "bg-primary",
									isCurrent && "animate-pulse bg-accent",
									!isDone && !isCurrent && "bg-white/10",
								)}
							/>
							<span
								className={cn(
									"block whitespace-nowrap font-mono text-[8px] uppercase transition-colors",
									isDone && "text-foreground/60",
									isCurrent && "text-accent",
									!isDone && !isCurrent && "text-muted-foreground/30",
								)}
							>
								{stage.label}
							</span>
						</div>
					);
				})}
			</div>

			{/* Continuous progress bar (preserved for granular within-stage motion) */}
			<div
				aria-label="Report generation progress"
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={Math.round(widthPct)}
				className="h-1 overflow-hidden rounded-full bg-accent/10"
				data-testid={`report-progress-bar-${report.id}`}
				role="progressbar"
			>
				<div
					className="h-full rounded-full bg-accent/60 transition-all duration-700"
					style={{ width: `${widthPct.toString()}%` }}
				/>
			</div>

			{/* Current stage line */}
			<p
				aria-live="polite"
				className="mt-2 font-mono text-[11px] text-accent"
				data-testid={`report-progress-stage-${report.id}`}
			>
				{stageLine}
			</p>

			{/* Live data counters */}
			{hasCounters && (
				<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
					{round > 0 && <LiveCounter label="round" value={round} />}
					{toolCalls > 0 && <LiveCounter label="queries" value={toolCalls} />}
					{charts > 0 && <LiveCounter label="charts" value={charts} />}
				</div>
			)}
		</div>
	);
}
