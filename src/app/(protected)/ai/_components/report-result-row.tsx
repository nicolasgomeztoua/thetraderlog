"use client";

import { ArrowUpRight, BarChart3, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/shared/utils";
import { ReportDeleteButton } from "./report-delete-button";
import { modelLabel, type ReportItem, relativeTime } from "./report-shared";

interface ReportResultRowProps {
	report: ReportItem;
	onRetry: (id: string) => void;
	isRetrying: boolean;
	onDelete: (id: string) => void;
}

export function ReportResultRow({
	report,
	onRetry,
	isRetrying,
	onDelete,
}: ReportResultRowProps) {
	// ---- Failed ----
	if (report.status === "failed") {
		return (
			<div
				className="group flex items-center gap-3 px-3 py-2.5"
				data-testid={`report-item-${report.id}`}
			>
				<span
					aria-hidden="true"
					className="size-1.5 shrink-0 rounded-full bg-loss"
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate font-sans text-foreground text-sm">
						{report.title}
					</p>
					<p className="truncate font-mono text-[10px] text-loss/70">
						{report.errorMessage ?? "Generation failed"}
					</p>
				</div>
				<span
					className="shrink-0 font-mono text-[10px] text-loss uppercase tracking-wider"
					data-testid={`report-status-${report.id}`}
				>
					{report.status.toUpperCase()}
				</span>
				<button
					className="flex shrink-0 items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-loss/40 hover:text-loss disabled:opacity-50"
					data-testid={`report-retry-${report.id}`}
					disabled={isRetrying}
					onClick={() => onRetry(report.id)}
					type="button"
				>
					{isRetrying ? (
						<Loader2 className="size-2.5 animate-spin" />
					) : (
						<RefreshCw className="size-2.5" />
					)}
					Retry
				</button>
				<ReportDeleteButton onConfirm={onDelete} reportId={report.id} />
			</div>
		);
	}

	// ---- Complete ----
	return (
		<div
			className="group flex items-center gap-1 pr-2"
			data-testid={`report-item-${report.id}`}
		>
			<Link
				className="flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
				data-testid={`report-view-${report.id}`}
				href={`/ai/reports/${report.id}`}
			>
				<span
					aria-hidden="true"
					className="size-1.5 shrink-0 rounded-full bg-profit"
				/>
				<span className="min-w-0 flex-1 truncate font-sans text-foreground text-sm">
					{report.title}
				</span>
				<span className="hidden shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground/40 sm:flex">
					{report.chartsGenerated ? (
						<span className="flex items-center gap-1">
							<BarChart3 className="size-2.5" />
							{report.chartsGenerated}
						</span>
					) : null}
					<span>{modelLabel(report.model)}</span>
					<span title={new Date(report.createdAt).toLocaleString()}>
						{relativeTime(report.createdAt)}
					</span>
				</span>
				<span
					className={cn(
						"flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/40 transition-all",
						"opacity-0 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100",
						"-translate-x-1",
					)}
				>
					View Report
					<ArrowUpRight className="size-3" />
				</span>
			</Link>
			<ReportDeleteButton onConfirm={onDelete} reportId={report.id} />
		</div>
	);
}
