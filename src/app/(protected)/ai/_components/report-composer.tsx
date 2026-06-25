"use client";

import { ArrowRight, FileText, Loader2, Sparkles } from "lucide-react";
import { UsageLimitBanner } from "@/components/billing/usage-limit-banner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SUGGESTED_REPORT_PROMPTS } from "@/lib/constants/ai";
import { cn } from "@/lib/shared/utils";
import { getDatePreset, QUICK_DATE_PRESETS } from "./report-shared";

const CHAR_WARN_THRESHOLD = 2000;

interface ReportComposerProps {
	prompt: string;
	onPromptChange: (value: string) => void;
	dateRangeStart: string;
	dateRangeEnd: string;
	onDateRangeStartChange: (value: string) => void;
	onDateRangeEndChange: (value: string) => void;
	dateError: string;
	onGenerate: () => void;
	isPending: boolean;
	limitReached: boolean;
	modelLabel: string;
}

export function ReportComposer({
	prompt,
	onPromptChange,
	dateRangeStart,
	dateRangeEnd,
	onDateRangeStartChange,
	onDateRangeEndChange,
	dateError,
	onGenerate,
	isPending,
	limitReached,
	modelLabel,
}: ReportComposerProps) {
	const showCharCount = prompt.length > CHAR_WARN_THRESHOLD;
	const canGenerate = !!prompt.trim() && !isPending && !limitReached;

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// ⌘/Ctrl + Enter submits — matches power-user muscle memory.
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canGenerate) {
			e.preventDefault();
			onGenerate();
		}
	};

	return (
		<div className="flex max-h-[55svh] w-full shrink-0 flex-col overflow-hidden rounded border border-border bg-card lg:max-h-none lg:w-[400px]">
			{/* Header */}
			<div className="flex items-center gap-2 border-white/5 border-b bg-white/[0.01] px-4 py-3">
				<FileText className="size-3.5 text-primary" />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					New Report
				</span>
			</div>

			<ScrollArea className="flex-1">
				<div className="flex flex-col gap-5 p-4">
					{/* Prompt */}
					<div>
						<label
							className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
							htmlFor="report-prompt"
						>
							Analysis Prompt
						</label>
						<div
							className={cn(
								"rounded border p-1 transition-colors",
								prompt
									? "border-primary/30 bg-white/[0.02]"
									: "border-white/10 bg-white/[0.01]",
							)}
						>
							<textarea
								className="min-h-[140px] w-full resize-none bg-transparent px-2.5 py-2 font-sans text-foreground text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
								data-testid="report-prompt-input"
								id="report-prompt"
								onChange={(e) => onPromptChange(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Describe the analysis you want — the more specific, the deeper the report. e.g. “Break down my revenge-trading days: what triggers them and what they cost me.”"
								value={prompt}
							/>
						</div>
						{showCharCount && (
							<div className="mt-1 flex justify-end">
								<span className="font-mono text-[10px] text-muted-foreground/40">
									{prompt.length.toLocaleString()}
								</span>
							</div>
						)}
					</div>

					{/* Date range */}
					<div>
						<span className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Date Range{" "}
							<span className="text-muted-foreground/40 normal-case">
								— optional
							</span>
						</span>
						<div className="mb-2 flex flex-wrap gap-1">
							{QUICK_DATE_PRESETS.map((preset) => {
								const active =
									dateRangeStart === getDatePreset(preset).start &&
									dateRangeEnd === getDatePreset(preset).end;
								return (
									<button
										className={cn(
											"rounded border px-2 py-1 font-mono text-[10px] transition-colors",
											active
												? "border-primary/40 bg-primary/10 text-primary"
												: "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-primary/30 hover:text-foreground",
										)}
										key={preset.label}
										onClick={() => {
											const { start, end } = getDatePreset(preset);
											onDateRangeStartChange(start);
											onDateRangeEndChange(end);
										}}
										type="button"
									>
										{preset.label}
									</button>
								);
							})}
						</div>
						<div className="flex items-center gap-2">
							<input
								aria-label="Start date"
								className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors [color-scheme:dark] focus:border-primary/40 focus:outline-none"
								data-testid="report-date-start"
								onChange={(e) => onDateRangeStartChange(e.target.value)}
								type="date"
								value={dateRangeStart}
							/>
							<span
								aria-hidden="true"
								className="font-mono text-[10px] text-muted-foreground/40"
							>
								→
							</span>
							<input
								aria-label="End date"
								className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors [color-scheme:dark] focus:border-primary/40 focus:outline-none"
								data-testid="report-date-end"
								onChange={(e) => onDateRangeEndChange(e.target.value)}
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

					{/* Usage limit */}
					{limitReached && <UsageLimitBanner type="reports" />}

					{/* Generate */}
					<div>
						<button
							className="flex w-full items-center justify-center gap-2 rounded bg-primary py-3 font-mono text-[11px] text-primary-foreground uppercase tracking-wider transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(212,255,0,0.18)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-muted-foreground disabled:shadow-none"
							data-testid="report-generate-button"
							disabled={!canGenerate}
							onClick={onGenerate}
							type="button"
						>
							{isPending ? (
								<>
									<Loader2 className="size-3.5 animate-spin" />
									Submitting…
								</>
							) : (
								<>
									<Sparkles className="size-3.5" />
									Run Report
								</>
							)}
						</button>
						<p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground/40">
							Runs on {modelLabel} · ⌘↵ to submit
						</p>
					</div>

					{/* Suggested */}
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
									className="group flex items-center justify-between gap-2 rounded border border-white/5 bg-white/[0.02] p-2 text-left font-mono text-[10px] text-muted-foreground transition-all hover:border-primary/20 hover:text-foreground"
									data-testid="report-suggested-prompt"
									key={p}
									onClick={() => onPromptChange(p)}
									type="button"
								>
									<span className="line-clamp-1">{p}</span>
									<ArrowRight className="-translate-x-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
								</button>
							))}
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}
