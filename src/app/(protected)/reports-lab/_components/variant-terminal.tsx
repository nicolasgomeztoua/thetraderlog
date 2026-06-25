"use client";

import Link from "next/link";
import { useState } from "react";
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

function OutputBlock({
	report,
	onRetry,
}: {
	report: ReportLike;
	onRetry: (id: string) => void;
}) {
	const now = useNow(isActive(report));
	const active = getActiveStageIndex(report.progressStage);

	if (report.status === "complete") {
		return (
			<div className="border-profit/20 border-l pl-3">
				<p className="text-profit">✓ report ready</p>
				<p className="text-muted-foreground/50">
					{modelLabel(report.model)}
					{report.chartsGenerated ? ` · ${report.chartsGenerated} charts` : ""}
					{report.totalToolCalls ? ` · ${report.totalToolCalls} queries` : ""} ·{" "}
					{relativeTime(report.createdAt)}
				</p>
				<Link
					className="inline-block text-accent transition-colors hover:text-primary hover:underline"
					href={`/ai/reports/${report.id}`}
				>
					→ open report
				</Link>
			</div>
		);
	}

	if (report.status === "failed") {
		return (
			<div className="border-loss/20 border-l pl-3">
				<p className="text-loss">
					✗ error: {report.errorMessage ?? "generation failed"}
				</p>
				<button
					className="text-foreground/70 transition-colors hover:text-loss hover:underline"
					onClick={() => onRetry(report.id)}
					type="button"
				>
					↻ retry
				</button>
			</div>
		);
	}

	// queued / generating — stream the pipeline
	return (
		<div className="border-accent/20 border-l pl-3">
			{PIPELINE_STAGES.map((s, i) => {
				if (i < active)
					return (
						<p className="text-profit/70" key={s.key}>
							✓ {s.label.toLowerCase()}
						</p>
					);
				if (i === active)
					return (
						<p className="text-accent" key={s.key}>
							▸ {stageLineFor(report).toLowerCase()}
							<span className="ml-0.5 cursor-blink text-accent" />
						</p>
					);
				return (
					<p className="text-muted-foreground/30" key={s.key}>
						· {s.label.toLowerCase()}
					</p>
				);
			})}
			<p className="mt-1 text-muted-foreground/40">
				[{formatElapsed(now - new Date(report.createdAt).getTime())}
				{report.totalToolCalls ? ` · ${report.totalToolCalls} tool calls` : ""}
				{report.chartsGenerated ? ` · ${report.chartsGenerated} charts` : ""}]
			</p>
		</div>
	);
}

export function VariantTerminal({
	reports,
	onGenerate,
	onRetry,
}: VariantProps) {
	const [cmd, setCmd] = useState("");
	const [model, setModel] = useState<string>(LAB_DEFAULT_MODEL);

	// REPL order: oldest at top, newest just above the prompt.
	const scrollback = [...reports].reverse();

	const run = () => {
		if (!cmd.trim()) return;
		onGenerate(cmd.trim(), model);
		setCmd("");
	};

	return (
		<div className="px-4 py-8">
			<div className="relative flex h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-[#070707]">
				{/* scanline atmosphere */}
				<div className="scanlines pointer-events-none absolute inset-0 opacity-40" />

				{/* title bar */}
				<div className="flex items-center gap-2 border-white/5 border-b px-4 py-2.5">
					<span className="size-2.5 rounded-full bg-loss/60" />
					<span className="size-2.5 rounded-full bg-breakeven/60" />
					<span className="size-2.5 rounded-full bg-profit/60" />
					<span className="ml-2 font-mono text-[11px] text-muted-foreground/50">
						analyst@traderlog — reports
					</span>
				</div>

				{/* scrollback */}
				<div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
					<p className="text-muted-foreground/40">
						TheTraderLog analysis shell · type a request and press enter to
						generate a report. {scrollback.length} in history.
					</p>
					{scrollback.map((r) => (
						<div key={r.id}>
							<p className="text-foreground/90">
								<span className="text-primary">$</span> analyze{" "}
								<span className="text-foreground/60">
									--model={modelLabel(r.model)}
								</span>{" "}
								"{r.title}"
							</p>
							<div className="mt-1">
								<OutputBlock onRetry={onRetry} report={r} />
							</div>
						</div>
					))}
				</div>

				{/* prompt input */}
				<div className="border-white/5 border-t">
					<div className="flex items-center gap-2 px-4 py-3 font-mono text-xs">
						<span className="shrink-0 text-primary">$</span>
						<input
							aria-label="Run an analysis command"
							className="min-w-0 flex-1 bg-transparent text-foreground caret-[#d4ff00] placeholder:text-muted-foreground/30 focus:outline-none"
							onChange={(e) => setCmd(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") run();
							}}
							placeholder="analyze my drawdowns after a winning streak…"
							value={cmd}
						/>
					</div>
					<div className="flex items-center gap-2 border-white/5 border-t px-4 py-1.5">
						<span className="font-mono text-[10px] text-muted-foreground/30">
							--model
						</span>
						{LAB_MODELS.map((m) => (
							<button
								className={cn(
									"font-mono text-[10px] transition-colors",
									model === m.id
										? "text-primary"
										: "text-muted-foreground/40 hover:text-foreground",
								)}
								key={m.id}
								onClick={() => setModel(m.id)}
								type="button"
							>
								{model === m.id ? `[${m.label}]` : m.label}
							</button>
						))}
						<span className="ml-auto font-mono text-[10px] text-muted-foreground/30">
							↵ run
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
