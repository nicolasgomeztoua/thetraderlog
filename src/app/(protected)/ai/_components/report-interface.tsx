"use client";

import { Download, FileText, Loader2, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SUGGESTED_REPORT_PROMPTS } from "@/lib/constants/ai";
import { api } from "@/trpc/react";

interface ReportInterfaceProps {
	model: string;
	"data-testid"?: string;
}

const DEFAULT_STATUS = { label: "QUEUED", color: "text-muted-foreground" };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
	queued: DEFAULT_STATUS,
	generating: { label: "GENERATING", color: "text-[#00d4ff]" },
	complete: { label: "COMPLETE", color: "text-profit" },
	failed: { label: "FAILED", color: "text-loss" },
};

export function ReportInterface({ model, ...props }: ReportInterfaceProps) {
	const [prompt, setPrompt] = useState("");
	const [dateRangeStart, setDateRangeStart] = useState("");
	const [dateRangeEnd, setDateRangeEnd] = useState("");

	const utils = api.useUtils();

	// Fetch reports
	const { data: reports } = api.ai.listReports.useQuery({ limit: 20 });

	// Mutations
	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			setPrompt("");
			setDateRangeStart("");
			setDateRangeEnd("");
			void utils.ai.listReports.invalidate();
		},
	});

	const handleGenerateReport = () => {
		const content = prompt.trim();
		if (!content) return;

		startReport.mutate({
			prompt: content,
			model,
			...(dateRangeStart && {
				dateRangeStart: new Date(dateRangeStart).toISOString(),
			}),
			...(dateRangeEnd && {
				dateRangeEnd: new Date(dateRangeEnd).toISOString(),
			}),
		});
	};

	const handleSuggestedPrompt = (p: string) => {
		setPrompt(p);
	};

	return (
		<div
			className="flex h-full flex-col gap-3 sm:flex-row"
			data-testid={props["data-testid"]}
		>
			{/* Report Request Form */}
			<div className="flex flex-col rounded border border-border bg-card sm:w-[400px]">
				<div className="border-border border-b bg-secondary px-3 py-2 sm:px-4">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						New Report
					</span>
				</div>

				<div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
					{/* Prompt */}
					<div>
						<label
							className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
							htmlFor="report-prompt"
						>
							Analysis Prompt
						</label>
						<textarea
							className="min-h-[120px] w-full resize-none rounded border border-border bg-transparent p-2.5 font-mono text-sm placeholder:text-muted-foreground/50 focus:border-[#00d4ff]/50 focus:outline-none"
							data-testid="report-prompt-input"
							id="report-prompt"
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Describe the analysis you want..."
							value={prompt}
						/>
					</div>

					{/* Date Range */}
					<div className="flex gap-2">
						<div className="flex-1">
							<label
								className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
								htmlFor="report-date-start"
							>
								Start Date
							</label>
							<input
								className="h-9 w-full rounded border border-border bg-transparent px-2.5 font-mono text-foreground text-xs focus:border-[#00d4ff]/50 focus:outline-none"
								data-testid="report-date-start"
								id="report-date-start"
								onChange={(e) => setDateRangeStart(e.target.value)}
								type="date"
								value={dateRangeStart}
							/>
						</div>
						<div className="flex-1">
							<label
								className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
								htmlFor="report-date-end"
							>
								End Date
							</label>
							<input
								className="h-9 w-full rounded border border-border bg-transparent px-2.5 font-mono text-foreground text-xs focus:border-[#00d4ff]/50 focus:outline-none"
								data-testid="report-date-end"
								id="report-date-end"
								onChange={(e) => setDateRangeEnd(e.target.value)}
								type="date"
								value={dateRangeEnd}
							/>
						</div>
					</div>

					{/* Generate Button */}
					<Button
						className="min-h-[44px] font-mono text-xs uppercase tracking-wider"
						data-testid="report-generate-button"
						disabled={startReport.isPending || !prompt.trim()}
						onClick={handleGenerateReport}
					>
						{startReport.isPending ? (
							<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
						) : (
							<Send className="mr-2 h-3.5 w-3.5" />
						)}
						Generate Report
					</Button>

					{/* Suggested Prompts */}
					<div>
						<span className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Suggested
						</span>
						<div
							className="flex flex-col gap-1"
							data-testid="report-suggested-prompts"
						>
							{SUGGESTED_REPORT_PROMPTS.map((p) => (
								<button
									className="rounded border border-border bg-secondary p-2 text-left font-mono text-[10px] text-muted-foreground transition-colors hover:border-[#00d4ff]/50 hover:text-[#00d4ff]"
									data-testid="report-suggested-prompt"
									key={p}
									onClick={() => handleSuggestedPrompt(p)}
									type="button"
								>
									{p}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Report History */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Report History
					</span>
					<Button
						className="h-6 px-2 font-mono text-[10px] text-muted-foreground"
						data-testid="report-refresh-button"
						onClick={() => void utils.ai.listReports.invalidate()}
						size="sm"
						variant="ghost"
					>
						<RefreshCw className="size-3" />
					</Button>
				</div>
				<ScrollArea className="flex-1">
					<div className="p-2 sm:p-3">
						{reports?.items.map((report) => {
							const status = STATUS_LABELS[report.status] ?? DEFAULT_STATUS;
							return (
								<div
									className="mb-2 rounded border border-border bg-secondary/50 p-3 last:mb-0"
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
													className={`font-mono text-[10px] uppercase tracking-wider ${status.color}`}
													data-testid={`report-status-${report.id}`}
												>
													{report.status === "generating" && (
														<Loader2 className="mr-1 inline size-2.5 animate-spin" />
													)}
													{status.label}
												</span>
												{report.createdAt && (
													<span className="font-mono text-[10px] text-muted-foreground">
														{new Date(report.createdAt).toLocaleDateString()}
													</span>
												)}
											</div>
										</div>
										{report.status === "complete" && report.pdfUrl && (
											<a
												data-testid={`report-download-${report.id}`}
												href={report.pdfUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												<Button
													className="h-7 gap-1.5 font-mono text-[10px] text-primary"
													size="sm"
													variant="outline"
												>
													<Download className="size-3" />
													PDF
												</Button>
											</a>
										)}
									</div>
								</div>
							);
						})}
						{(!reports?.items || reports.items.length === 0) && (
							<div
								className="flex flex-col items-center justify-center py-12 text-center"
								data-testid="report-empty-state"
							>
								<FileText className="mb-3 size-8 text-muted-foreground/50" />
								<p className="font-mono text-muted-foreground text-xs">
									No reports generated yet
								</p>
								<p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
									Use the form to request a deep analysis report
								</p>
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
