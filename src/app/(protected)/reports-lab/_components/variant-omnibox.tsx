"use client";

import { ArrowUpRight, CornerDownLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/shared/utils";
import {
	formatElapsed,
	getActiveStageIndex,
	isActive,
	LAB_DEFAULT_MODEL,
	LAB_MODELS,
	LAB_SUGGESTED,
	modelLabel,
	PIPELINE_STAGES,
	type ReportLike,
	relativeTime,
	stageLineFor,
	useNow,
	type VariantProps,
} from "./lab-shared";

function LiveBanner({ report }: { report: ReportLike }) {
	const now = useNow(true);
	const elapsed = formatElapsed(now - new Date(report.createdAt).getTime());
	const active = getActiveStageIndex(report.progressStage);
	return (
		<div className="rounded-lg border border-accent/25 bg-accent/[0.04] px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="pulse-dot size-1.5 shrink-0 rounded-full bg-accent" />
					<span className="truncate font-sans text-foreground text-sm">
						{report.title}
					</span>
				</div>
				<span className="shrink-0 font-mono text-[10px] text-muted-foreground/60 tabular-nums">
					{elapsed}
				</span>
			</div>
			<div className="mt-2 flex items-center gap-1">
				{PIPELINE_STAGES.map((s, i) => (
					<div
						className={cn(
							"h-0.5 flex-1 rounded-full transition-colors",
							i < active && "bg-primary",
							i === active && "animate-pulse bg-accent",
							i > active && "bg-white/10",
						)}
						key={s.key}
					/>
				))}
			</div>
			<p className="mt-1.5 font-mono text-[10px] text-accent/80">
				{stageLineFor(report)}
				{report.totalToolCalls ? ` · ${report.totalToolCalls} queries` : ""}
				{report.chartsGenerated ? ` · ${report.chartsGenerated} charts` : ""}
			</p>
		</div>
	);
}

export function VariantOmnibox({ reports, onGenerate, onRetry }: VariantProps) {
	const [query, setQuery] = useState("");
	const [model, setModel] = useState<string>(LAB_DEFAULT_MODEL);

	const live = reports.filter(isActive);
	const finished = reports.filter((r) => !isActive(r));

	const q = query.trim().toLowerCase();
	const matches = useMemo(
		() =>
			q
				? finished.filter((r) =>
						`${r.title} ${r.prompt}`.toLowerCase().includes(q),
					)
				: finished,
		[finished, q],
	);

	const submit = () => {
		if (!query.trim()) return;
		onGenerate(query.trim(), model);
		setQuery("");
	};

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
			<div className="text-center">
				<h2 className="font-display font-semibold text-2xl text-foreground tracking-tight">
					What do you want to understand?
				</h2>
				<p className="mt-1 font-mono text-[11px] text-muted-foreground/50 uppercase tracking-[0.2em]">
					Search your analyses · or describe a new one
				</p>
			</div>

			{/* The omnibox */}
			<div className="rounded-xl border border-primary/30 bg-card shadow-[0_0_50px_-12px_rgba(212,255,0,0.18)] focus-within:border-primary/60">
				<div className="flex items-center gap-3 px-4 py-3.5">
					<Sparkles className="size-4 shrink-0 text-primary" />
					<input
						aria-label="Search or describe an analysis"
						className="min-w-0 flex-1 bg-transparent font-sans text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
						}}
						placeholder="e.g. how does my win rate change after a 3-loss streak?"
						value={query}
					/>
					<kbd className="hidden shrink-0 items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/50 sm:flex">
						<CornerDownLeft className="size-2.5" /> run
					</kbd>
				</div>
				<div className="flex items-center justify-between gap-2 border-white/5 border-t px-4 py-2">
					<span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
						Model
					</span>
					<div className="flex gap-1">
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
				</div>
			</div>

			{/* Create affordance when typing */}
			{query.trim() && (
				<button
					className="group flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/[0.06] px-4 py-3 text-left transition-colors hover:bg-primary/[0.12]"
					onClick={submit}
					type="button"
				>
					<span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
						<Sparkles className="size-3.5" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-mono text-[10px] text-primary uppercase tracking-wider">
							Generate new report
						</span>
						<span className="block truncate font-sans text-foreground text-sm">
							“{query.trim()}”
						</span>
					</span>
					<CornerDownLeft className="size-4 shrink-0 text-primary/60 transition-transform group-hover:translate-x-0.5" />
				</button>
			)}

			{/* Live work */}
			{live.length > 0 && (
				<div className="flex flex-col gap-2">
					{live.map((r) => (
						<LiveBanner key={r.id} report={r} />
					))}
				</div>
			)}

			{/* Suggestions when idle */}
			{!query.trim() && (
				<div>
					<p className="mb-2 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
						Try
					</p>
					<div className="flex flex-wrap gap-2">
						{LAB_SUGGESTED.slice(0, 4).map((s) => (
							<button
								className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-left font-sans text-muted-foreground text-xs transition-colors hover:border-primary/30 hover:text-foreground"
								key={s}
								onClick={() => setQuery(s)}
								type="button"
							>
								{s.length > 52 ? `${s.slice(0, 52)}…` : s}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Results / recents */}
			<div>
				<p className="mb-2 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
					{q ? `Matches (${matches.length})` : "Recent"}
				</p>
				<div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-lg border border-white/5">
					{matches.map((r) => {
						const done = r.status === "complete";
						const failed = r.status === "failed";
						const body = (
							<>
								<span
									className={cn(
										"size-1.5 shrink-0 rounded-full",
										done && "bg-profit",
										failed && "bg-loss",
										!done && !failed && "bg-muted-foreground/40",
									)}
								/>
								<span className="min-w-0 flex-1 truncate font-sans text-foreground text-sm">
									{r.title}
								</span>
								{failed ? (
									<button
										className="shrink-0 font-mono text-[10px] text-loss/80 uppercase tracking-wider hover:text-loss"
										onClick={(e) => {
											e.preventDefault();
											onRetry(r.id);
										}}
										type="button"
									>
										Retry
									</button>
								) : (
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">
										{relativeTime(r.createdAt)}
									</span>
								)}
								{done && (
									<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
								)}
							</>
						);
						return done ? (
							<Link
								className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
								href={`/ai/reports/${r.id}`}
								key={r.id}
							>
								{body}
							</Link>
						) : (
							<div
								className="group flex items-center gap-3 px-4 py-2.5"
								key={r.id}
							>
								{body}
							</div>
						);
					})}
					{matches.length === 0 && (
						<div className="flex items-center gap-2 px-4 py-6 text-muted-foreground/40">
							<Loader2 className="hidden size-3" />
							<span className="font-mono text-xs">
								No matches — press enter to analyze “{query.trim()}”
							</span>
						</div>
					)}
				</div>
				<p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/30">
					Showing {LAB_MODELS.length} models · {finished.length} past reports ·
					default {modelLabel(LAB_DEFAULT_MODEL)}
				</p>
			</div>
		</div>
	);
}
