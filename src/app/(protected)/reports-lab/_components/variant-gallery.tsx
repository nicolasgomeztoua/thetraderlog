"use client";

import {
	ArrowUpRight,
	BarChart3,
	Plus,
	RefreshCw,
	Sparkles,
	X,
} from "lucide-react";
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

function ComposeTile({
	onGenerate,
}: {
	onGenerate: (prompt: string, model: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState<string>(LAB_DEFAULT_MODEL);

	if (!open) {
		return (
			<button
				className="group flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-primary/25 border-dashed bg-primary/[0.02] transition-colors hover:border-primary/50 hover:bg-primary/[0.05]"
				onClick={() => setOpen(true)}
				type="button"
			>
				<span className="flex size-9 items-center justify-center rounded-full border border-primary/30 text-primary transition-transform group-hover:scale-110">
					<Plus className="size-4" />
				</span>
				<span className="font-mono text-[11px] text-primary uppercase tracking-wider">
					New analysis
				</span>
			</button>
		);
	}

	return (
		<div className="flex min-h-[180px] flex-col rounded-xl border border-primary/40 bg-card p-3 sm:col-span-2">
			<div className="mb-2 flex items-center justify-between">
				<span className="font-mono text-[10px] text-primary uppercase tracking-wider">
					New analysis
				</span>
				<button
					aria-label="Cancel"
					className="text-muted-foreground/50 hover:text-foreground"
					onClick={() => setOpen(false)}
					type="button"
				>
					<X className="size-3.5" />
				</button>
			</div>
			<textarea
				className="min-h-[70px] flex-1 resize-none rounded border border-white/10 bg-white/[0.02] p-2.5 font-sans text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
				onChange={(e) => setPrompt(e.target.value)}
				placeholder="Describe the analysis you want…"
				value={prompt}
			/>
			<div className="mt-2 flex items-center justify-between gap-2">
				<div className="flex flex-wrap gap-1">
					{LAB_MODELS.map((m) => (
						<button
							className={cn(
								"rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors",
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
					className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-mono text-[10px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 disabled:opacity-40"
					disabled={!prompt.trim()}
					onClick={() => {
						onGenerate(prompt.trim(), model);
						setPrompt("");
						setOpen(false);
					}}
					type="button"
				>
					<Sparkles className="size-3" /> Run
				</button>
			</div>
		</div>
	);
}

function GalleryTile({
	report,
	featured,
	onRetry,
}: {
	report: ReportLike;
	featured: boolean;
	onRetry: (id: string) => void;
}) {
	const now = useNow(isActive(report));
	const tone =
		report.status === "complete"
			? "profit"
			: report.status === "failed"
				? "loss"
				: "accent";

	const shell = cn(
		"group relative flex min-h-[180px] flex-col overflow-hidden rounded-xl border bg-card p-4 transition-all",
		report.status === "complete" &&
			"hover:-translate-y-0.5 border-white/8 hover:border-profit/30 hover:shadow-[0_8px_30px_-12px_rgba(0,255,136,0.25)]",
		report.status === "failed" && "border-loss/20",
		isActive(report) && "border-accent/30 bg-accent/[0.03]",
		featured && "sm:col-span-2",
	);

	const spine = cn(
		"absolute inset-x-0 top-0 h-0.5",
		tone === "profit" && "bg-profit/60",
		tone === "loss" && "bg-loss/60",
		tone === "accent" && "bg-accent/60",
	);

	return (
		<article className={shell}>
			<span className={spine} />

			<div className="mb-3 flex items-center justify-between">
				<span
					className={cn(
						"font-mono text-[10px] uppercase tracking-wider",
						tone === "profit" && "text-profit",
						tone === "loss" && "text-loss",
						tone === "accent" && "text-accent",
					)}
				>
					{report.status === "generating"
						? "Working"
						: report.status === "queued"
							? "Queued"
							: report.status}
				</span>
				<span className="font-mono text-[10px] text-muted-foreground/40">
					{relativeTime(report.createdAt)}
				</span>
			</div>

			<h3
				className={cn(
					"flex-1 font-display font-medium text-foreground leading-snug",
					featured ? "line-clamp-3 text-xl" : "line-clamp-3 text-base",
				)}
			>
				{report.title}
			</h3>

			{/* Active state */}
			{isActive(report) && (
				<div className="mt-3">
					<div className="h-1 overflow-hidden rounded-full bg-accent/10">
						<div
							className="h-full rounded-full bg-accent/60 transition-all duration-700"
							style={{
								width: `${getProgressWidth(report.progressStage, report.currentRound)}%`,
							}}
						/>
					</div>
					<div className="mt-2 flex items-center justify-between">
						<span className="font-mono text-[10px] text-accent/80">
							{stageLineFor(report)}
						</span>
						<span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">
							{formatElapsed(now - new Date(report.createdAt).getTime())}
						</span>
					</div>
				</div>
			)}

			{/* Failed state */}
			{report.status === "failed" && (
				<div className="mt-3 flex items-center justify-between gap-2">
					<span className="line-clamp-1 font-mono text-[10px] text-loss/70">
						{report.errorMessage ?? "Generation failed"}
					</span>
					<button
						className="flex shrink-0 items-center gap-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-loss/40 hover:text-loss"
						onClick={() => onRetry(report.id)}
						type="button"
					>
						<RefreshCw className="size-2.5" /> Retry
					</button>
				</div>
			)}

			{/* Complete state */}
			{report.status === "complete" && (
				<div className="mt-3 flex items-center justify-between">
					<div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/50">
						<span className="text-muted-foreground/70">
							{modelLabel(report.model)}
						</span>
						{report.chartsGenerated ? (
							<span className="flex items-center gap-1">
								<BarChart3 className="size-2.5" />
								{report.chartsGenerated}
							</span>
						) : null}
					</div>
					<Link
						className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors group-hover:text-profit"
						href={`/ai/reports/${report.id}`}
					>
						Open <ArrowUpRight className="size-3" />
					</Link>
				</div>
			)}
		</article>
	);
}

export function VariantGallery({ reports, onGenerate, onRetry }: VariantProps) {
	const firstCompleteId = reports.find((r) => r.status === "complete")?.id;
	return (
		<div className="px-4 py-8">
			<div className="mb-4 flex items-baseline justify-between">
				<h2 className="font-display font-semibold text-foreground text-lg">
					Your analyses
				</h2>
				<span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
					{reports.length} reports
				</span>
			</div>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<ComposeTile onGenerate={onGenerate} />
				{reports.map((r) => (
					<GalleryTile
						featured={r.id === firstCompleteId}
						key={r.id}
						onRetry={onRetry}
						report={r}
					/>
				))}
			</div>
		</div>
	);
}
