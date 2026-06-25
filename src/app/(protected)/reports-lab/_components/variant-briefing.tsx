"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/shared/utils";
import {
	formatElapsed,
	getProgressWidth,
	isActive,
	LAB_DEFAULT_MODEL,
	LAB_MODELS,
	modelLabel,
	type ReportLike,
	relativeTime,
	stageLineFor,
	useNow,
	type VariantProps,
} from "./lab-shared";

function WireItem({ report }: { report: ReportLike }) {
	const now = useNow(true);
	return (
		<div className="border-accent/30 border-l-2 pl-3">
			<p className="flex items-center gap-2 font-mono text-[10px] text-accent uppercase tracking-[0.15em]">
				<span className="pulse-dot size-1.5 rounded-full bg-accent" /> On the
				wire
			</p>
			<p className="mt-1 font-display font-medium text-foreground text-sm leading-snug">
				{report.title}
			</p>
			<div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-accent/10">
				<div
					className="h-full rounded-full bg-accent/60 transition-all duration-700"
					style={{
						width: `${getProgressWidth(report.progressStage, report.currentRound)}%`,
					}}
				/>
			</div>
			<p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
				{stageLineFor(report)} ·{" "}
				{formatElapsed(now - new Date(report.createdAt).getTime())}
			</p>
		</div>
	);
}

export function VariantBriefing({
	reports,
	onGenerate,
	onRetry,
}: VariantProps) {
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState<string>(LAB_DEFAULT_MODEL);

	const completes = reports.filter((r) => r.status === "complete");
	const featured = completes[0];
	const backIssues = [
		...completes.slice(1),
		...reports.filter((r) => r.status === "failed"),
	];
	const wire = reports.filter(isActive);

	return (
		<div className="px-4 py-8">
			<div className="overflow-hidden rounded-xl border border-border bg-card">
				{/* Masthead */}
				<div className="border-foreground/10 border-b-2 px-6 pt-6 pb-4 text-center">
					<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-[0.4em]">
						Market Intelligence · Personal Edition
					</p>
					<h1 className="mt-1 font-bold font-display text-4xl text-foreground tracking-tight">
						THE DAILY EDGE
					</h1>
					<div className="mt-2 flex items-center justify-center gap-3 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
						<span>{completes.length} briefings filed</span>
						<span className="text-muted-foreground/20">|</span>
						<span>Powered by {modelLabel(LAB_DEFAULT_MODEL)}</span>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3">
					{/* Lead story + commission */}
					<div className="border-white/5 p-6 lg:col-span-2 lg:border-r">
						{featured ? (
							<article>
								<p className="font-mono text-[10px] text-primary uppercase tracking-[0.2em]">
									Lead Briefing
								</p>
								<Link href={`/ai/reports/${featured.id}`}>
									<h2 className="mt-1 font-bold font-display text-3xl text-foreground leading-[1.1] tracking-tight transition-colors hover:text-primary">
										{featured.title}
									</h2>
								</Link>
								<p className="mt-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
									By {modelLabel(featured.model)}
									{featured.chartsGenerated
										? ` · ${featured.chartsGenerated} exhibits`
										: ""}{" "}
									· filed {relativeTime(featured.createdAt)}
								</p>
								<p className="mt-3 font-sans text-foreground/80 text-sm leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:text-primary first-letter:leading-[0.8]">
									{featured.prompt}
								</p>
								<Link
									className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] text-primary uppercase tracking-wider hover:underline"
									href={`/ai/reports/${featured.id}`}
								>
									Read the full briefing <ArrowRight className="size-3" />
								</Link>
							</article>
						) : (
							<p className="font-mono text-muted-foreground/40 text-sm">
								No briefings filed yet — commission your first below.
							</p>
						)}

						{/* Commission box */}
						<div className="mt-6 border-foreground/10 border-t-2 pt-5">
							<p className="font-mono text-[10px] text-foreground uppercase tracking-[0.2em]">
								✎ Commission a briefing
							</p>
							<textarea
								className="mt-2 min-h-[64px] w-full resize-none rounded border border-white/10 bg-white/[0.02] p-3 font-sans text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
								onChange={(e) => setPrompt(e.target.value)}
								placeholder="Commission a custom analysis for tomorrow's edition…"
								value={prompt}
							/>
							<div className="mt-2 flex items-center justify-between gap-2">
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
									className="rounded bg-primary px-4 py-2 font-mono text-[10px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 disabled:opacity-40"
									disabled={!prompt.trim()}
									onClick={() => {
										onGenerate(prompt.trim(), model);
										setPrompt("");
									}}
									type="button"
								>
									Commission
								</button>
							</div>
						</div>
					</div>

					{/* Sidebar: wire + back issues */}
					<div className="flex flex-col gap-5 p-6">
						{wire.length > 0 && (
							<div className="flex flex-col gap-3">
								{wire.map((r) => (
									<WireItem key={r.id} report={r} />
								))}
							</div>
						)}

						<div>
							<p className="border-foreground/10 border-b pb-1 font-mono text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em]">
								Back Issues
							</p>
							<div className="mt-2 flex flex-col divide-y divide-white/5">
								{backIssues.map((r) => {
									const failed = r.status === "failed";
									return (
										<div className="py-2.5" key={r.id}>
											<p
												className={cn(
													"font-mono text-[9px] uppercase tracking-[0.15em]",
													failed ? "text-loss" : "text-muted-foreground/40",
												)}
											>
												{failed ? "Retracted" : modelLabel(r.model)} ·{" "}
												{relativeTime(r.createdAt)}
											</p>
											{failed ? (
												<div className="mt-0.5 flex items-start justify-between gap-2">
													<p className="font-display text-foreground/70 text-sm leading-snug">
														{r.title}
													</p>
													<button
														aria-label="Retry"
														className="shrink-0 text-muted-foreground/50 hover:text-loss"
														onClick={() => onRetry(r.id)}
														type="button"
													>
														<RefreshCw className="size-3" />
													</button>
												</div>
											) : (
												<Link href={`/ai/reports/${r.id}`}>
													<p className="mt-0.5 font-display text-foreground text-sm leading-snug transition-colors hover:text-primary">
														{r.title}
													</p>
												</Link>
											)}
										</div>
									);
								})}
								{backIssues.length === 0 && (
									<p className="py-2 font-mono text-[10px] text-muted-foreground/30">
										No back issues yet.
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
