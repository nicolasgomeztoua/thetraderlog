"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { ReportDeleteButton } from "./report-delete-button";
import {
	formatElapsed,
	getActiveStageIndex,
	getProgressWidth,
	PIPELINE_STAGES,
	type ReportItem,
	stageLineFor,
	useNow,
} from "./report-shared";

interface ReportLiveCardProps {
	report: ReportItem;
	onDelete: (id: string) => void;
}

export function ReportLiveCard({ report, onDelete }: ReportLiveCardProps) {
	const now = useNow(true);
	const elapsed = formatElapsed(now - new Date(report.createdAt).getTime());
	const active = getActiveStageIndex(report.progressStage);
	const widthPct = getProgressWidth(report.progressStage, report.currentRound);

	const round = report.currentRound ?? 0;
	const toolCalls = report.totalToolCalls ?? 0;
	const charts = report.chartsGenerated ?? 0;
	const hasCounters = round > 0 || toolCalls > 0 || charts > 0;

	return (
		<article
			className="group animate-fade-in-up rounded-lg border border-accent/25 bg-accent/[0.04] p-4"
			data-testid={`report-item-${report.id}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="pulse-dot size-1.5 shrink-0 rounded-full bg-accent" />
					<span className="min-w-0 truncate font-sans text-foreground text-sm">
						{report.title}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<span
						className="font-mono text-[10px] text-accent uppercase tracking-wider"
						data-testid={`report-status-${report.id}`}
					>
						{report.status.toUpperCase()}
					</span>
					<span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">
						{elapsed}
					</span>
					<ReportDeleteButton
						active
						onConfirm={onDelete}
						reportId={report.id}
					/>
				</div>
			</div>

			{/* Six-stage pipeline */}
			<div className="mt-3 grid grid-cols-6 gap-1">
				{PIPELINE_STAGES.map((s, i) => (
					<div className="flex flex-col gap-1" key={s.key}>
						<div
							className={cn(
								"h-0.5 rounded-full transition-colors duration-500",
								i < active && "bg-primary",
								i === active && "animate-pulse bg-accent",
								i > active && "bg-white/10",
							)}
						/>
						<span
							className={cn(
								"block whitespace-nowrap font-mono text-[8px] uppercase transition-colors",
								i < active && "text-foreground/60",
								i === active && "text-accent",
								i > active && "text-muted-foreground/30",
							)}
						>
							{s.label}
						</span>
					</div>
				))}
			</div>

			{/* Continuous bar (granular within-stage motion) */}
			<div
				aria-label="Report generation progress"
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={Math.round(widthPct)}
				className="mt-2 h-1 overflow-hidden rounded-full bg-accent/10"
				data-testid={`report-progress-bar-${report.id}`}
				role="progressbar"
			>
				<div
					className="h-full rounded-full bg-accent/60 transition-all duration-700"
					style={{ width: `${widthPct}%` }}
				/>
			</div>

			<div className="mt-2 flex items-center justify-between gap-2">
				<p
					aria-live="polite"
					className="flex items-center gap-1.5 font-mono text-[11px] text-accent"
					data-testid={`report-progress-stage-${report.id}`}
				>
					<Loader2 className="size-3 animate-spin" />
					{stageLineFor(report)}
				</p>
				{hasCounters && (
					<div className="flex shrink-0 gap-3 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
						{round > 0 && <span>rnd {round}</span>}
						{toolCalls > 0 && <span>{toolCalls} queries</span>}
						{charts > 0 && <span>{charts} charts</span>}
					</div>
				)}
			</div>
		</article>
	);
}
