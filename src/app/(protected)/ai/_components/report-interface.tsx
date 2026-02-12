"use client";

import {
	ArrowRight,
	Download,
	FileText,
	Loader2,
	RefreshCw,
	Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SUGGESTED_REPORT_PROMPTS } from "@/lib/constants/ai";
import { ERR_VALIDATION_DATE_RANGE } from "@/lib/constants/errors";
import { api } from "@/trpc/react";
import { ModelSelector } from "./model-selector";

// =============================================================================
// CONSTANTS
// =============================================================================

interface ReportInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

const QUICK_DATE_PRESETS = [
	{ label: "Last 7 days", days: 7 },
	{ label: "Last 30 days", days: 30 },
	{ label: "This month", days: 0 },
	{ label: "Last month", days: -1 },
];

const CHAR_WARN_THRESHOLD = 2000;

const PROGRESS_STAGE_LABELS: Record<string, string> = {
	queued: "Queued",
	building_context: "Building context",
	analyzing: "Analyzing",
	generating_pdf: "Generating PDF",
	uploading: "Uploading",
	complete: "Complete",
	failed: "Failed",
};

function getProgressWidth(
	stage: string | null | undefined,
	currentRound: number | null | undefined,
	totalRounds: number,
): number {
	switch (stage) {
		case "queued":
			return 5;
		case "building_context":
			return 15;
		case "analyzing": {
			const round = currentRound ?? 0;
			return 20 + Math.min(round / totalRounds, 1) * 50;
		}
		case "generating_pdf":
			return 80;
		case "uploading":
			return 95;
		case "complete":
			return 100;
		default:
			return 5;
	}
}

function getDatePreset(preset: (typeof QUICK_DATE_PRESETS)[number]): {
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
// REPORT INTERFACE
// =============================================================================

export function ReportInterface({ mode, onModeChange }: ReportInterfaceProps) {
	const [prompt, setPrompt] = useState("");
	const [dateRangeStart, setDateRangeStart] = useState("");
	const [dateRangeEnd, setDateRangeEnd] = useState("");
	const [dateError, setDateError] = useState("");
	const [isRefreshing, setIsRefreshing] = useState(false);

	const utils = api.useUtils();

	// Fetch reports
	const { data: reports, isLoading: isReportsLoading } =
		api.ai.listReports.useQuery({ limit: 20 }, { refetchOnWindowFocus: true });

	// Find the first active report
	const activeReportId = useMemo(() => {
		if (!reports?.items) return null;
		const active = reports.items.find(
			(r) => r.status === "queued" || r.status === "generating",
		);
		return active?.id ?? null;
	}, [reports?.items]);

	// Poll active report status
	const { data: activeReportStatus } = api.ai.getReportStatus.useQuery(
		{ reportId: activeReportId ?? "" },
		{
			enabled: !!activeReportId,
			refetchInterval: 5000,
			refetchOnWindowFocus: true,
		},
	);

	// When status changes to complete/failed, refresh
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on status change
	useEffect(() => {
		if (
			activeReportStatus &&
			(activeReportStatus.status === "complete" ||
				activeReportStatus.status === "failed")
		) {
			void utils.ai.listReports.invalidate();
		}
	}, [activeReportStatus?.status]);

	// Mutations
	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			setPrompt("");
			void utils.ai.listReports.invalidate();
		},
	});

	const retryReport = api.ai.retryReport.useMutation({
		onSuccess: () => {
			void utils.ai.listReports.invalidate();
		},
	});

	const handleGenerateReport = () => {
		const content = prompt.trim();
		if (!content) return;

		// Date validation
		if (dateRangeStart && dateRangeEnd && dateRangeEnd < dateRangeStart) {
			setDateError(ERR_VALIDATION_DATE_RANGE);
			return;
		}
		setDateError("");

		startReport.mutate({
			prompt: content,
			...(dateRangeStart && {
				dateRangeStart: new Date(dateRangeStart).toISOString(),
			}),
			...(dateRangeEnd && {
				dateRangeEnd: new Date(dateRangeEnd).toISOString(),
			}),
		});
	};

	const handleRefresh = () => {
		setIsRefreshing(true);
		void utils.ai.listReports.invalidate().then(() => {
			setTimeout(() => setIsRefreshing(false), 500);
		});
	};

	const showCharCount = prompt.length > CHAR_WARN_THRESHOLD;

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded border border-border bg-card"
			data-testid="ai-report-interface"
		>
			<ModelSelector mode={mode} onModeChange={onModeChange} />

			<div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:p-4">
				{/* ================================================================ */}
				{/* FORM SECTION */}
				{/* ================================================================ */}
				<div className="flex w-full shrink-0 flex-col rounded border border-border bg-card lg:w-[420px]">
					{/* Form header */}
					<div className="flex items-center gap-2 border-white/5 border-b bg-white/[0.01] px-4 py-3">
						<FileText className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							New Report
						</span>
					</div>

					<div className="flex flex-1 flex-col gap-4 p-3 sm:p-4">
						{/* Prompt */}
						<div>
							<label
								className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
								htmlFor="report-prompt"
							>
								Analysis Prompt
							</label>
							<div
								className={`rounded border p-1 transition-colors ${
									prompt
										? "border-accent/40 bg-white/[0.02]"
										: "border-white/10 bg-white/[0.01]"
								}`}
							>
								<textarea
									className="min-h-[120px] w-full resize-none bg-transparent px-2.5 py-2 font-mono text-sm placeholder:text-muted-foreground/40 focus:outline-none"
									data-testid="report-prompt-input"
									id="report-prompt"
									onChange={(e) => setPrompt(e.target.value)}
									placeholder="Describe the analysis you want..."
									value={prompt}
								/>
							</div>
							{showCharCount && (
								<div className="mt-1 flex justify-end">
									<span
										className={`font-mono text-[10px] ${prompt.length > CHAR_WARN_THRESHOLD ? "text-loss/40" : "text-muted-foreground/40"}`}
									>
										{prompt.length.toLocaleString()}
									</span>
								</div>
							)}
						</div>

						{/* Quick Date Presets */}
						<div>
							<span className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Date Range
							</span>
							<div className="mb-2 flex flex-wrap gap-1">
								{QUICK_DATE_PRESETS.map((preset) => (
									<button
										className="rounded border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
										key={preset.label}
										onClick={() => {
											const { start, end } = getDatePreset(preset);
											setDateRangeStart(start);
											setDateRangeEnd(end);
											setDateError("");
										}}
										type="button"
									>
										{preset.label}
									</button>
								))}
							</div>
							<div className="flex items-center gap-2">
								<input
									className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors focus:border-accent/40 focus:outline-none"
									data-testid="report-date-start"
									onChange={(e) => {
										setDateRangeStart(e.target.value);
										setDateError("");
									}}
									type="date"
									value={dateRangeStart}
								/>
								<span className="font-mono text-[10px] text-muted-foreground/40">
									→
								</span>
								<input
									className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors focus:border-accent/40 focus:outline-none"
									data-testid="report-date-end"
									onChange={(e) => {
										setDateRangeEnd(e.target.value);
										setDateError("");
									}}
									type="date"
									value={dateRangeEnd}
								/>
							</div>
							{dateError && (
								<p className="mt-1 animate-shake font-mono text-[10px] text-loss">
									{dateError}
								</p>
							)}
						</div>

						{/* Generate Button */}
						<button
							className="flex w-full items-center justify-center gap-2 rounded bg-accent/10 py-2.5 font-mono text-accent text-xs uppercase tracking-wider transition-colors hover:bg-accent/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
							data-testid="report-generate-button"
							disabled={startReport.isPending || !prompt.trim()}
							onClick={handleGenerateReport}
							type="button"
						>
							{startReport.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Send className="h-3.5 w-3.5" />
							)}
							{startReport.isPending ? "Generating..." : "Generate Report"}
						</button>

						{/* Suggested Prompts */}
						<div>
							<span className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Suggested
							</span>
							<div
								className="flex flex-col gap-1"
								data-testid="report-suggested-prompts"
							>
								{SUGGESTED_REPORT_PROMPTS.map((p) => (
									<button
										className="group flex items-center justify-between rounded border border-white/5 bg-white/[0.02] p-2 text-left font-mono text-[10px] text-muted-foreground transition-all hover:border-accent/20 hover:text-foreground"
										data-testid="report-suggested-prompt"
										key={p}
										onClick={() => setPrompt(p)}
										type="button"
									>
										<span className="line-clamp-1">{p}</span>
										<ArrowRight className="-translate-x-1 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:text-accent group-hover:opacity-100" />
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* ================================================================ */}
				{/* HISTORY PANEL */}
				{/* ================================================================ */}
				<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
					{/* History header */}
					<div className="flex items-center justify-between border-white/5 border-b bg-white/[0.01] px-3 py-2 sm:px-4">
						<div className="flex items-center gap-2">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Report History
							</span>
							{reports?.items && reports.items.length > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/5 px-1 font-mono text-[9px] text-muted-foreground">
									{reports.items.length}
								</span>
							)}
						</div>
						<button
							className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
							data-testid="report-refresh-button"
							onClick={handleRefresh}
							type="button"
						>
							<RefreshCw
								className={`size-3 ${isRefreshing ? "animate-spin" : ""}`}
							/>
						</button>
					</div>

					<ScrollArea className="flex-1">
						<div className="p-2 sm:p-3">
							{/* Active Report Progress */}
							{activeReportId &&
								activeReportStatus &&
								(activeReportStatus.status === "queued" ||
									activeReportStatus.status === "generating") && (
									<div
										className="mb-3 animate-fade-in-up rounded border border-accent/20 bg-accent/5 p-3"
										data-testid="report-active-progress"
									>
										<div className="flex items-center gap-2">
											<Loader2 className="size-3.5 animate-spin text-accent" />
											<span className="font-mono text-accent text-xs">
												{PROGRESS_STAGE_LABELS[
													activeReportStatus.progressStage ?? "queued"
												] ?? "Processing"}
												{activeReportStatus.progressStage === "analyzing" &&
													activeReportStatus.currentRound != null &&
													activeReportStatus.currentRound > 0 &&
													` round ${activeReportStatus.currentRound.toString()}`}
												{activeReportStatus.progressStage ===
													"generating_pdf" &&
													activeReportStatus.chartsGenerated != null &&
													activeReportStatus.chartsGenerated > 0 &&
													` — ${activeReportStatus.chartsGenerated.toString()} charts`}
											</span>
										</div>
										{/* Real progress bar */}
										<div className="mt-2 h-1 overflow-hidden rounded-full bg-accent/10">
											<div
												className="h-full rounded-full bg-accent/50 transition-all duration-700"
												style={{
													width: `${getProgressWidth(activeReportStatus.progressStage, activeReportStatus.currentRound, 20).toString()}%`,
												}}
											/>
										</div>
										{/* Stats row */}
										{activeReportStatus.progressStage === "analyzing" && (
											<div className="mt-1.5 flex gap-3 font-mono text-[10px] text-muted-foreground/50">
												{activeReportStatus.currentRound != null &&
													activeReportStatus.currentRound > 0 && (
														<span>
															Round {activeReportStatus.currentRound.toString()}
														</span>
													)}
												{activeReportStatus.totalToolCalls != null &&
													activeReportStatus.totalToolCalls > 0 && (
														<span>
															{activeReportStatus.totalToolCalls.toString()}{" "}
															tool calls
														</span>
													)}
												{activeReportStatus.chartsGenerated != null &&
													activeReportStatus.chartsGenerated > 0 && (
														<span>
															{activeReportStatus.chartsGenerated.toString()}{" "}
															charts
														</span>
													)}
											</div>
										)}
									</div>
								)}

							{/* Loading skeletons */}
							{isReportsLoading &&
								Array.from({ length: 3 }).map((_, i) => (
									<div
										className="mb-2 rounded border border-white/5 bg-white/[0.01] p-3"
										key={`skeleton-${i.toString()}`}
									>
										<Skeleton className="h-4 w-3/4" />
										<div className="mt-2 flex items-center gap-2">
											<Skeleton className="h-3 w-16" />
											<Skeleton className="h-3 w-20" />
										</div>
									</div>
								))}

							{/* Report list */}
							{reports?.items.map((report) => {
								const reportStatus =
									report.id === activeReportId && activeReportStatus
										? activeReportStatus.status
										: report.status;
								const reportPdfUrl =
									report.id === activeReportId && activeReportStatus
										? activeReportStatus.pdfUrl
										: report.pdfUrl;
								const reportErrorMessage =
									report.id === activeReportId && activeReportStatus
										? activeReportStatus.errorMessage
										: report.errorMessage;

								const isFailed = reportStatus === "failed";
								const isComplete = reportStatus === "complete";

								return (
									<div
										className={`mb-2 rounded border p-3 transition-colors last:mb-0 hover:border-white/10 ${
											isFailed
												? "border-loss/20 border-l-2"
												: isComplete
													? "border-profit/20 border-white/5 border-l-2"
													: "border-white/5"
										} bg-white/[0.01]`}
										data-testid={`report-item-${report.id}`}
										key={report.id}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="line-clamp-1 font-mono text-foreground text-xs">
													{report.title ?? report.prompt}
												</p>
												<div className="mt-1 flex items-center gap-2">
													<span
														className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
															reportStatus === "queued"
																? "border-white/10 text-muted-foreground"
																: reportStatus === "generating"
																	? "animate-pulse border-accent/20 text-accent"
																	: reportStatus === "complete"
																		? "border-profit/20 text-profit"
																		: "border-loss/20 text-loss"
														}`}
														data-testid={`report-status-${report.id}`}
													>
														{reportStatus === "generating" && (
															<Loader2 className="mr-1 inline size-2.5 animate-spin" />
														)}
														{(reportStatus ?? "queued").toUpperCase()}
													</span>
													{report.createdAt && (
														<span className="font-mono text-[10px] text-muted-foreground/50">
															{new Date(report.createdAt).toLocaleDateString()}
														</span>
													)}
												</div>
											</div>
											{isComplete && reportPdfUrl && (
												<a
													className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
													data-testid={`report-download-${report.id}`}
													href={reportPdfUrl}
													rel="noopener noreferrer"
													target="_blank"
												>
													<Download className="size-3" />
													PDF
												</a>
											)}
										</div>
										{isFailed && (
											<div className="mt-2 flex items-start justify-between gap-2">
												<p className="min-w-0 flex-1 font-mono text-[10px] text-loss/80">
													{reportErrorMessage ??
														"Something went wrong. Please try again."}
												</p>
												<button
													className="flex shrink-0 items-center gap-1 rounded border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-loss/30 hover:text-loss active:scale-[0.98]"
													data-testid={`report-retry-${report.id}`}
													disabled={retryReport.isPending}
													onClick={() =>
														retryReport.mutate({ reportId: report.id })
													}
													type="button"
												>
													{retryReport.isPending ? (
														<Loader2 className="size-3 animate-spin" />
													) : (
														<RefreshCw className="size-3" />
													)}
													Retry
												</button>
											</div>
										)}
									</div>
								);
							})}

							{/* Empty state */}
							{!isReportsLoading &&
								(!reports?.items || reports.items.length === 0) && (
									<div
										className="flex flex-col items-center justify-center py-12 text-center"
										data-testid="report-empty-state"
									>
										<FileText className="mb-3 size-8 animate-pulse text-muted-foreground/20" />
										<p className="font-mono text-muted-foreground/50 text-xs">
											No reports yet
										</p>
										<p className="mt-1 font-mono text-[10px] text-muted-foreground/30">
											Generate your first analysis report
										</p>
									</div>
								)}
						</div>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
