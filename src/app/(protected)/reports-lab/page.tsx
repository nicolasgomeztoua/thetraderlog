"use client";

import { FlaskConical } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/shared/utils";
import { api } from "@/trpc/react";
import { type ReportLike, SAMPLE_REPORTS } from "./_components/lab-shared";
import { VariantBriefing } from "./_components/variant-briefing";
import { VariantGallery } from "./_components/variant-gallery";
import { VariantOmnibox } from "./_components/variant-omnibox";
import { VariantReadingDesk } from "./_components/variant-reading-desk";
import { VariantTerminal } from "./_components/variant-terminal";

type Source = "sample" | "live";

const VARIANTS = [
	{
		id: "a",
		letter: "A",
		name: "Omnibox",
		blurb:
			"Search and create are the same action — one command surface, no form/list split.",
		Component: VariantOmnibox,
	},
	{
		id: "b",
		letter: "B",
		name: "Gallery Wall",
		blurb: "Reports as a portfolio of visual artifacts; compose is a tile.",
		Component: VariantGallery,
	},
	{
		id: "c",
		letter: "C",
		name: "Reading Desk",
		blurb: "Read in place like an inbox; composing is an ephemeral overlay.",
		Component: VariantReadingDesk,
	},
	{
		id: "d",
		letter: "D",
		name: "Terminal",
		blurb:
			"A REPL — type analyses as commands, outputs stream into the scrollback.",
		Component: VariantTerminal,
	},
	{
		id: "e",
		letter: "E",
		name: "Briefing",
		blurb:
			"An editorial front page — latest analysis as the lead story, the rest as back issues.",
		Component: VariantBriefing,
	},
] as const;

export default function ReportsLabPage() {
	const [source, setSource] = useState<Source>("sample");
	const utils = api.useUtils();

	const { data } = api.ai.listReports.useQuery(
		{ limit: 20 },
		{
			refetchInterval: (query) => {
				const items = query.state.data?.items;
				if (!items) return false;
				const hasActive = items.some(
					(r) => r.status === "queued" || r.status === "generating",
				);
				return hasActive ? 5000 : false;
			},
		},
	);

	const reports: ReportLike[] =
		source === "sample" ? SAMPLE_REPORTS : (data?.items ?? []);

	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			void utils.ai.listReports.invalidate();
			setSource("live");
			toast.success("Report queued — now showing live data");
		},
		onError: (e) => toast.error(e.message || "Could not start report"),
	});

	const retryReport = api.ai.retryReport.useMutation({
		onSuccess: () => void utils.ai.listReports.invalidate(),
		onError: (e) => toast.error(e.message || "Could not retry"),
	});

	const onGenerate = useCallback(
		(prompt: string, model: string) => {
			startReport.mutate({ prompt, model: model as never });
		},
		[startReport],
	);

	const onRetry = useCallback(
		(id: string) => {
			if (source === "sample") {
				toast.info("Retry works on live reports — switch to Live data");
				return;
			}
			retryReport.mutate({ reportId: id });
		},
		[retryReport, source],
	);

	return (
		<div className="min-h-screen bg-background">
			{/* Sticky lab header */}
			<header className="sticky top-0 z-20 border-white/5 border-b bg-background/90 backdrop-blur-md">
				<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<FlaskConical className="size-4 text-primary" />
							<span className="font-display font-semibold text-foreground text-sm">
								Reports Lab
							</span>
							<span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
								5 paradigms · pick one, we delete the rest
							</span>
						</div>
						{/* Data source toggle */}
						<div className="flex items-center gap-2">
							<span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
								Data
							</span>
							<div className="flex rounded border border-white/10 bg-white/[0.02] p-0.5">
								{(["sample", "live"] as const).map((s) => (
									<button
										className={cn(
											"rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
											source === s
												? "bg-primary/10 text-primary"
												: "text-muted-foreground hover:text-foreground",
										)}
										key={s}
										onClick={() => setSource(s)}
										type="button"
									>
										{s}
									</button>
								))}
							</div>
						</div>
					</div>
					{/* Quick nav */}
					<nav className="flex flex-wrap gap-1.5">
						{VARIANTS.map((v) => (
							<a
								className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
								href={`#variant-${v.id}`}
								key={v.id}
							>
								<span className="font-semibold text-primary">{v.letter}</span>
								{v.name}
							</a>
						))}
					</nav>
				</div>
			</header>

			{/* Variants */}
			<main className="mx-auto max-w-6xl pb-24">
				{VARIANTS.map(({ id, letter, name, blurb, Component }) => (
					<section
						className="scroll-mt-28 border-white/5 border-b py-6"
						id={`variant-${id}`}
						key={id}
					>
						<div className="flex items-start gap-3 px-4">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.06] font-bold font-display text-lg text-primary">
								{letter}
							</span>
							<div>
								<h2 className="font-display font-semibold text-foreground text-lg leading-tight">
									{name}
								</h2>
								<p className="font-sans text-muted-foreground/60 text-xs">
									{blurb}
								</p>
							</div>
						</div>
						<Component
							isGenerating={startReport.isPending}
							onGenerate={onGenerate}
							onRetry={onRetry}
							reports={reports}
						/>
					</section>
				))}
			</main>
		</div>
	);
}
