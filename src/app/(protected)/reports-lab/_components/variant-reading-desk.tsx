"use client";

import {
	ArrowUpRight,
	BarChart3,
	Plus,
	RefreshCw,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/shared/utils";
import {
	formatElapsed,
	getActiveStageIndex,
	isActive,
	LAB_DEFAULT_MODEL,
	LAB_MODELS,
	modelLabel,
	PIPELINE_STAGES,
	type ReportLike,
	relativeTime,
	stageLineFor,
	useNow,
	type VariantProps,
} from "./lab-shared";

function dotClass(r: ReportLike): string {
	if (r.status === "complete") return "bg-profit";
	if (r.status === "failed") return "bg-loss";
	if (r.status === "generating") return "bg-accent";
	return "bg-muted-foreground/40";
}

function ReadingPane({
	report,
	onRetry,
}: {
	report: ReportLike;
	onRetry: (id: string) => void;
}) {
	const now = useNow(isActive(report));
	const active = getActiveStageIndex(report.progressStage);

	return (
		<div className="flex h-full flex-col overflow-y-auto p-6">
			<div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
				<span className={cn("size-1.5 rounded-full", dotClass(report))} />
				<span
					className={cn(
						report.status === "complete" && "text-profit",
						report.status === "failed" && "text-loss",
						isActive(report) && "text-accent",
					)}
				>
					{report.status}
				</span>
				<span className="text-muted-foreground/30">·</span>
				<span className="text-muted-foreground/50">
					{modelLabel(report.model)}
				</span>
				<span className="text-muted-foreground/30">·</span>
				<span className="text-muted-foreground/50">
					{relativeTime(report.createdAt)}
				</span>
			</div>

			<h2 className="font-display font-semibold text-2xl text-foreground leading-tight tracking-tight">
				{report.title}
			</h2>

			{/* Generating */}
			{isActive(report) && (
				<div className="mt-6 rounded-lg border border-accent/20 bg-accent/[0.03] p-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="flex items-center gap-2 font-mono text-[10px] text-accent uppercase tracking-wider">
							<span className="pulse-dot size-1.5 rounded-full bg-accent" />
							{stageLineFor(report)}
						</span>
						<span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">
							{formatElapsed(now - new Date(report.createdAt).getTime())}
						</span>
					</div>
					<div className="grid grid-cols-6 gap-1">
						{PIPELINE_STAGES.map((s, i) => (
							<div className="flex flex-col gap-1" key={s.key}>
								<div
									className={cn(
										"h-0.5 rounded-full",
										i < active && "bg-primary",
										i === active && "animate-pulse bg-accent",
										i > active && "bg-white/10",
									)}
								/>
								<span
									className={cn(
										"font-mono text-[8px] uppercase",
										i === active ? "text-accent" : "text-muted-foreground/30",
									)}
								>
									{s.label}
								</span>
							</div>
						))}
					</div>
					{(report.totalToolCalls || report.chartsGenerated) && (
						<div className="mt-3 flex gap-4 font-mono text-[10px] text-muted-foreground/50">
							{report.currentRound ? (
								<span>Round {report.currentRound}</span>
							) : null}
							{report.totalToolCalls ? (
								<span>{report.totalToolCalls} queries</span>
							) : null}
							{report.chartsGenerated ? (
								<span>{report.chartsGenerated} charts</span>
							) : null}
						</div>
					)}
				</div>
			)}

			{/* Failed */}
			{report.status === "failed" && (
				<div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-loss/20 bg-loss/[0.03] p-4">
					<span className="font-mono text-loss/80 text-xs">
						{report.errorMessage ?? "Generation failed"}
					</span>
					<button
						className="flex shrink-0 items-center gap-1.5 rounded border border-white/10 px-3 py-1.5 font-mono text-[11px] text-foreground transition-colors hover:border-loss/40 hover:text-loss"
						onClick={() => onRetry(report.id)}
						type="button"
					>
						<RefreshCw className="size-3" /> Retry
					</button>
				</div>
			)}

			{/* The request (always) */}
			<div className="mt-6">
				<p className="mb-2 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
					The request
				</p>
				<blockquote className="border-primary/40 border-l-2 pl-3 font-sans text-foreground/80 text-sm leading-relaxed">
					{report.prompt}
				</blockquote>
			</div>

			{/* Complete — open CTA */}
			{report.status === "complete" && (
				<div className="mt-6 flex items-center gap-3 border-white/5 border-t pt-5">
					<Link
						className="flex items-center gap-2 rounded bg-primary px-4 py-2.5 font-mono text-[11px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90"
						href={`/ai/reports/${report.id}`}
					>
						Open full report <ArrowUpRight className="size-3.5" />
					</Link>
					{report.chartsGenerated ? (
						<span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/50">
							<BarChart3 className="size-3" />
							{report.chartsGenerated} charts inside
						</span>
					) : null}
				</div>
			)}
		</div>
	);
}

export function VariantReadingDesk({
	reports,
	onGenerate,
	onRetry,
}: VariantProps) {
	const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
	const [search, setSearch] = useState("");
	const [composing, setComposing] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState<string>(LAB_DEFAULT_MODEL);

	const q = search.trim().toLowerCase();
	const list = useMemo(
		() =>
			q
				? reports.filter((r) =>
						`${r.title} ${r.prompt}`.toLowerCase().includes(q),
					)
				: reports,
		[reports, q],
	);
	const selected =
		reports.find((r) => r.id === selectedId) ?? list[0] ?? reports[0];

	return (
		<div className="px-4 py-8">
			<div className="flex h-[560px] overflow-hidden rounded-xl border border-border bg-card">
				{/* Left: library */}
				<div className="flex w-[300px] shrink-0 flex-col border-white/5 border-r">
					<div className="flex items-center justify-between border-white/5 border-b px-3 py-3">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Library
						</span>
						<button
							className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary uppercase tracking-wider transition-colors hover:bg-primary/20"
							onClick={() => setComposing(true)}
							type="button"
						>
							<Plus className="size-3" /> New
						</button>
					</div>
					<div className="border-white/5 border-b p-2">
						<div className="relative">
							<Search
								aria-hidden="true"
								className="-translate-y-1/2 absolute top-1/2 left-2 size-3 text-muted-foreground/40"
							/>
							<input
								aria-label="Search library"
								className="h-8 w-full rounded border border-white/10 bg-transparent pr-2 pl-7 font-mono text-foreground text-xs placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none"
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search…"
								type="search"
								value={search}
							/>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{list.map((r) => (
							<button
								className={cn(
									"flex w-full items-start gap-2 border-white/[0.03] border-b px-3 py-2.5 text-left transition-colors",
									r.id === selected?.id
										? "bg-primary/[0.06]"
										: "hover:bg-white/[0.02]",
								)}
								key={r.id}
								onClick={() => setSelectedId(r.id)}
								type="button"
							>
								<span
									className={cn(
										"mt-1.5 size-1.5 shrink-0 rounded-full",
										dotClass(r),
									)}
								/>
								<span className="min-w-0 flex-1">
									<span className="line-clamp-2 font-sans text-foreground text-xs leading-snug">
										{r.title}
									</span>
									<span className="mt-0.5 block font-mono text-[9px] text-muted-foreground/40">
										{relativeTime(r.createdAt)}
									</span>
								</span>
							</button>
						))}
					</div>
				</div>

				{/* Right: reading pane (+ compose overlay) */}
				<div className="relative min-w-0 flex-1">
					{selected ? (
						<ReadingPane onRetry={onRetry} report={selected} />
					) : (
						<div className="flex h-full items-center justify-center font-mono text-muted-foreground/40 text-xs">
							Select a report
						</div>
					)}

					{composing && (
						<div className="absolute inset-0 flex flex-col bg-card/95 p-6 backdrop-blur-sm">
							<div className="mb-3 flex items-center justify-between">
								<span className="font-mono text-[10px] text-primary uppercase tracking-wider">
									New analysis
								</span>
								<button
									aria-label="Cancel"
									className="text-muted-foreground/50 hover:text-foreground"
									onClick={() => setComposing(false)}
									type="button"
								>
									<X className="size-4" />
								</button>
							</div>
							<textarea
								className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.02] p-3 font-sans text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
								onChange={(e) => setPrompt(e.target.value)}
								placeholder="Describe the analysis you want — the more specific, the deeper the report."
								value={prompt}
							/>
							<div className="mt-3 flex items-center justify-between gap-2">
								<div className="flex flex-wrap gap-1">
									{LAB_MODELS.map((m) => (
										<button
											className={cn(
												"rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
												model === m.id
													? "bg-primary/15 text-primary"
													: "text-muted-foreground/60 hover:text-foreground",
											)}
											key={m.id}
											onClick={() => setModel(m.id)}
											type="button"
										>
											{m.label}
										</button>
									))}
								</div>
								<button
									className="flex items-center gap-1.5 rounded bg-primary px-4 py-2 font-mono text-[11px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 disabled:opacity-40"
									disabled={!prompt.trim()}
									onClick={() => {
										onGenerate(prompt.trim(), model);
										setPrompt("");
										setComposing(false);
									}}
									type="button"
								>
									<Sparkles className="size-3" /> Run report
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
