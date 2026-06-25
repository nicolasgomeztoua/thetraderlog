"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowRight, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { AI_MODEL_OPTIONS } from "@/lib/constants/ai";
import { cn } from "@/lib/shared/utils";
import { ReportProgressMonitor } from "./report-progress-monitor";
import type { ReportItem, ReportStatus } from "./report-shared";

export type ReportDensity = "comfortable" | "compact";

// =============================================================================
// HELPERS
// =============================================================================

function modelLabel(modelId: string): string {
	return AI_MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId;
}

function relativeTime(date: Date | string): string {
	return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function absoluteTime(date: Date | string): string {
	return new Date(date).toLocaleString();
}

const STATUS_TONE: Record<
	ReportStatus,
	{ dot: string; text: string; spine: string }
> = {
	queued: {
		dot: "bg-muted-foreground/40",
		text: "text-muted-foreground",
		spine: "border-l-white/10",
	},
	generating: {
		dot: "bg-accent",
		text: "text-accent",
		spine: "border-l-accent/40",
	},
	complete: {
		dot: "bg-profit",
		text: "text-profit",
		spine: "border-l-profit/40",
	},
	failed: {
		dot: "bg-loss",
		text: "text-loss",
		spine: "border-l-loss/40",
	},
};

// =============================================================================
// STATUS BADGE — testid + exact uppercase text required by e2e contract
// =============================================================================

function StatusBadge({ report }: { report: ReportItem }) {
	const tone = STATUS_TONE[report.status];
	return (
		<span className="inline-flex items-center gap-1.5">
			{report.status === "generating" ? (
				<Loader2 className={cn("size-2.5 animate-spin", tone.text)} />
			) : (
				<span className={cn("size-1.5 rounded-full", tone.dot)} />
			)}
			<span
				className={cn(
					"font-mono text-[10px] uppercase tracking-wider",
					tone.text,
				)}
				data-testid={`report-status-${report.id}`}
			>
				{report.status.toUpperCase()}
			</span>
		</span>
	);
}

function ViewReportLink({
	report,
	compact = false,
}: {
	report: ReportItem;
	compact?: boolean;
}) {
	return (
		<a
			className={cn(
				"flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] font-mono text-foreground transition-colors hover:border-primary/40 hover:text-primary",
				compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
			)}
			data-testid={`report-view-${report.id}`}
			href={`/ai/reports/${report.id}`}
		>
			View Report
			<ArrowRight className="size-3" />
		</a>
	);
}

function MetaStrip({ report }: { report: ReportItem }) {
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground/50">
			<span className="text-muted-foreground/70">
				{modelLabel(report.model)}
			</span>
			{report.chartsGenerated != null && report.chartsGenerated > 0 && (
				<span className="flex items-center gap-1">
					<BarChart3 className="size-2.5" />
					{report.chartsGenerated} charts
				</span>
			)}
			<span title={absoluteTime(report.createdAt)}>
				{relativeTime(report.createdAt)}
			</span>
		</div>
	);
}

// =============================================================================
// REPORT ROW
// =============================================================================

interface ReportRowProps {
	report: ReportItem;
	density: ReportDensity;
	onRetry: (reportId: string) => void;
	isRetrying: boolean;
}

export function ReportRow({
	report,
	density,
	onRetry,
	isRetrying,
}: ReportRowProps) {
	const isActive = report.status === "queued" || report.status === "generating";
	const isFailed = report.status === "failed";
	const isComplete = report.status === "complete";
	const tone = STATUS_TONE[report.status];

	// ---- Active: always render the full live monitor regardless of density ----
	if (isActive) {
		return (
			<article
				className="animate-fade-in-up rounded border border-accent/20 bg-accent/[0.02] p-3"
				data-testid={`report-item-${report.id}`}
			>
				<div className="mb-2 flex items-start justify-between gap-3">
					<p className="line-clamp-2 min-w-0 flex-1 font-sans text-foreground text-sm leading-snug">
						{report.title ?? report.prompt}
					</p>
					<StatusBadge report={report} />
				</div>
				<ReportProgressMonitor report={report} />
			</article>
		);
	}

	// ---- Failed: error + retry ----
	if (isFailed) {
		return (
			<article
				className={cn(
					"rounded border border-white/5 border-l-2 bg-white/[0.01] p-3",
					tone.spine,
				)}
				data-testid={`report-item-${report.id}`}
			>
				<div className="flex items-start justify-between gap-3">
					<p className="line-clamp-2 min-w-0 flex-1 font-sans text-foreground text-sm leading-snug">
						{report.title ?? report.prompt}
					</p>
					<StatusBadge report={report} />
				</div>
				<div className="mt-2 flex items-end justify-between gap-3">
					<p className="min-w-0 flex-1 font-mono text-[10px] text-loss/80">
						{report.errorMessage ?? "Something went wrong. Please try again."}
					</p>
					<button
						className="flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px] text-foreground transition-colors hover:border-loss/40 hover:text-loss active:scale-[0.98] disabled:opacity-50"
						data-testid={`report-retry-${report.id}`}
						disabled={isRetrying}
						onClick={() => onRetry(report.id)}
						type="button"
					>
						{isRetrying ? (
							<Loader2 className="size-3 animate-spin" />
						) : (
							<RefreshCw className="size-3" />
						)}
						Retry
					</button>
				</div>
			</article>
		);
	}

	// ---- Complete: compact row ----
	if (isComplete && density === "compact") {
		return (
			<article
				className={cn(
					"group flex items-center gap-3 rounded border border-white/5 border-l-2 bg-white/[0.01] px-3 py-2 transition-colors hover:border-white/10 hover:bg-white/[0.02]",
					tone.spine,
				)}
				data-testid={`report-item-${report.id}`}
			>
				<span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
				<p className="min-w-0 flex-1 truncate font-sans text-foreground text-sm">
					{report.title ?? report.prompt}
				</p>
				<span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/60 sm:inline">
					{modelLabel(report.model)}
				</span>
				<span
					className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/40 md:inline"
					title={absoluteTime(report.createdAt)}
				>
					{relativeTime(report.createdAt)}
				</span>
				{/* status badge kept for the e2e contract, visually subtle here */}
				<span className="sr-only">
					<StatusBadge report={report} />
				</span>
				<ViewReportLink compact report={report} />
			</article>
		);
	}

	// ---- Complete: comfortable card ----
	return (
		<article
			className={cn(
				"group rounded border border-white/5 border-l-2 bg-white/[0.01] p-3 transition-all hover:border-white/10 hover:bg-white/[0.02]",
				tone.spine,
			)}
			data-testid={`report-item-${report.id}`}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="line-clamp-2 min-w-0 flex-1 font-sans text-foreground text-sm leading-snug">
					{report.title ?? report.prompt}
				</p>
				<StatusBadge report={report} />
			</div>
			<div className="mt-3 flex items-end justify-between gap-3">
				<MetaStrip report={report} />
				<ViewReportLink report={report} />
			</div>
		</article>
	);
}
