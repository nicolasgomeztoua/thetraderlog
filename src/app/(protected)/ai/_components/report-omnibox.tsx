"use client";

import {
	CalendarRange,
	CornerDownLeft,
	FileText,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { UsageLimitBanner } from "@/components/billing/usage-limit-banner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_MODEL_OPTIONS, SUGGESTED_REPORT_PROMPTS } from "@/lib/constants/ai";
import { ERR_VALIDATION_DATE_RANGE } from "@/lib/constants/errors";
import { cn } from "@/lib/shared/utils";
import { ReportLiveCard } from "./report-live-card";
import { ReportResultRow } from "./report-result-row";
import {
	getDatePreset,
	isActive,
	QUICK_DATE_PRESETS,
	type ReportItem,
} from "./report-shared";

interface ReportOmniboxProps {
	reports: ReportItem[];
	selectedModel: string;
	onModelChange: (model: string) => void;
	onGenerate: (input: {
		prompt: string;
		dateRangeStart?: string;
		dateRangeEnd?: string;
	}) => void;
	onRetry: (id: string) => void;
	isRetrying: boolean;
	onDelete: (id: string) => void;
	isPending: boolean;
	limitReached: boolean;
	isLoading: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => void;
	onRefresh: () => void;
	isRefreshing: boolean;
}

export function ReportOmnibox({
	reports,
	selectedModel,
	onModelChange,
	onGenerate,
	onRetry,
	isRetrying,
	onDelete,
	isPending,
	limitReached,
	isLoading,
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
	onRefresh,
	isRefreshing,
}: ReportOmniboxProps) {
	const [query, setQuery] = useState("");
	const [dateStart, setDateStart] = useState("");
	const [dateEnd, setDateEnd] = useState("");
	const [dateError, setDateError] = useState("");

	const canSubmit = !!query.trim() && !isPending && !limitReached;

	const submit = () => {
		const content = query.trim();
		if (!content || isPending || limitReached) return;
		if (dateStart && dateEnd && dateEnd < dateStart) {
			setDateError(ERR_VALIDATION_DATE_RANGE);
			return;
		}
		setDateError("");
		onGenerate({
			prompt: content,
			dateRangeStart: dateStart || undefined,
			dateRangeEnd: dateEnd || undefined,
		});
		setQuery("");
	};

	// ---- Infinite scroll (callback ref + refs so it re-attaches on remount) ----
	const scrollRef = useRef<HTMLDivElement>(null);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const fetchRef = useRef(fetchNextPage);
	const hasNextRef = useRef(hasNextPage);
	const fetchingRef = useRef(isFetchingNextPage);
	fetchRef.current = fetchNextPage;
	hasNextRef.current = hasNextPage;
	fetchingRef.current = isFetchingNextPage;

	const setSentinel = useCallback((node: HTMLDivElement | null) => {
		observerRef.current?.disconnect();
		if (!node) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (
					entries[0]?.isIntersecting &&
					hasNextRef.current &&
					!fetchingRef.current
				) {
					fetchRef.current();
				}
			},
			{ root: scrollRef.current, rootMargin: "240px" },
		);
		obs.observe(node);
		observerRef.current = obs;
	}, []);

	// ---- Derived lists ----
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

	const scopeActive = !!dateStart || !!dateEnd;
	const scopeLabel = scopeActive
		? `${dateStart || "…"} → ${dateEnd || "…"}`
		: "All time";

	return (
		<div className="flex h-full flex-col">
			{/* ===== Composer (pinned) ===== */}
			<div className="shrink-0 border-white/5 border-b px-4 pt-8 pb-4">
				<div className="mx-auto max-w-3xl">
					<div className="text-center">
						<h2 className="font-display font-semibold text-2xl text-foreground tracking-tight">
							What do you want to understand?
						</h2>
						<p className="mt-1 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-[0.2em]">
							Search your analyses · or describe a new one
						</p>
					</div>

					{/* Omnibox bar */}
					<div className="mt-4 rounded-xl border border-primary/30 bg-card shadow-[0_0_50px_-12px_rgba(212,255,0,0.16)] focus-within:border-primary/60">
						<div className="flex items-center gap-3 px-4 py-3.5">
							<Sparkles className="size-4 shrink-0 text-primary" />
							<input
								aria-label="Search or describe an analysis"
								className="min-w-0 flex-1 bg-transparent font-sans text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
								data-testid="report-prompt-input"
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") submit();
								}}
								placeholder="e.g. how does my win rate change after a 3-loss streak?"
								value={query}
							/>
							<button
								aria-label="Generate report"
								className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-mono text-[10px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-muted-foreground/50"
								data-testid="report-generate-button"
								disabled={!canSubmit}
								onClick={submit}
								type="button"
							>
								<CornerDownLeft className="size-3" />
								Run
							</button>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 border-white/5 border-t px-3 py-2">
							{/* Scope */}
							<Popover>
								<PopoverTrigger asChild>
									<button
										className={cn(
											"flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] transition-colors",
											scopeActive
												? "bg-primary/10 text-primary"
												: "text-muted-foreground/60 hover:text-foreground",
										)}
										data-testid="report-scope-trigger"
										type="button"
									>
										<CalendarRange className="size-3" />
										{scopeLabel}
									</button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-72">
									<p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Report scope
									</p>
									<div className="mb-2 flex flex-wrap gap-1">
										{QUICK_DATE_PRESETS.map((preset) => (
											<button
												className="rounded border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
												key={preset.label}
												onClick={() => {
													const { start, end } = getDatePreset(preset);
													setDateStart(start);
													setDateEnd(end);
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
											aria-label="Start date"
											className="h-8 flex-1 rounded border border-white/10 bg-transparent px-2 font-mono text-foreground text-xs [color-scheme:dark] focus:border-primary/40 focus:outline-none"
											data-testid="report-date-start"
											onChange={(e) => {
												setDateStart(e.target.value);
												setDateError("");
											}}
											type="date"
											value={dateStart}
										/>
										<span
											aria-hidden="true"
											className="font-mono text-[10px] text-muted-foreground/40"
										>
											→
										</span>
										<input
											aria-label="End date"
											className="h-8 flex-1 rounded border border-white/10 bg-transparent px-2 font-mono text-foreground text-xs [color-scheme:dark] focus:border-primary/40 focus:outline-none"
											data-testid="report-date-end"
											onChange={(e) => {
												setDateEnd(e.target.value);
												setDateError("");
											}}
											type="date"
											value={dateEnd}
										/>
									</div>
									{scopeActive && (
										<button
											className="mt-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider hover:text-foreground"
											onClick={() => {
												setDateStart("");
												setDateEnd("");
												setDateError("");
											}}
											type="button"
										>
											Clear scope
										</button>
									)}
								</PopoverContent>
							</Popover>

							{/* Model pills */}
							<div className="flex items-center gap-1">
								<span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
									Model
								</span>
								{AI_MODEL_OPTIONS.map((m) => (
									<button
										aria-pressed={selectedModel === m.id}
										className={cn(
											"rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
											selectedModel === m.id
												? "bg-primary/15 text-primary"
												: "text-muted-foreground/60 hover:text-foreground",
										)}
										key={m.id}
										onClick={() => onModelChange(m.id)}
										type="button"
									>
										{m.label}
									</button>
								))}
							</div>
						</div>
					</div>

					{dateError && (
						<p className="mt-1.5 animate-shake text-center font-mono text-[10px] text-loss">
							{dateError}
						</p>
					)}

					{limitReached && (
						<div className="mt-3">
							<UsageLimitBanner type="reports" />
						</div>
					)}

					{/* Suggestions when idle */}
					{!query.trim() && (
						<div className="mt-3" data-testid="report-suggested-prompts">
							<div className="flex flex-wrap justify-center gap-1.5">
								{SUGGESTED_REPORT_PROMPTS.map((s) => (
									<button
										className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-left font-sans text-muted-foreground text-xs transition-colors hover:border-primary/30 hover:text-foreground"
										data-testid="report-suggested-prompt"
										key={s}
										onClick={() => setQuery(s)}
										type="button"
									>
										<span className="line-clamp-1 max-w-[40ch]">{s}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ===== Results (scroll) ===== */}
			<div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
				<div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5">
					{/* Live work */}
					{live.map((r) => (
						<ReportLiveCard key={r.id} onDelete={onDelete} report={r} />
					))}

					{/* Loading */}
					{isLoading &&
						Array.from({ length: 4 }).map((_, i) => (
							<div
								className="rounded-lg border border-white/5 bg-white/[0.01] p-3"
								key={`sk-${i.toString()}`}
							>
								<Skeleton className="h-4 w-2/3" />
							</div>
						))}

					{/* Header — label + refresh (always reachable once loaded) */}
					{!isLoading && (
						<div className="flex items-center justify-between px-1">
							<p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider">
								{q
									? `Matches · ${matches.length}`
									: `Recent · ${finished.length}`}
							</p>
							<button
								aria-busy={isRefreshing}
								aria-label="Refresh reports"
								className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-white/5 hover:text-foreground"
								data-testid="report-refresh-button"
								onClick={onRefresh}
								type="button"
							>
								<RefreshCw
									className={cn("size-3", isRefreshing && "animate-spin")}
								/>
							</button>
						</div>
					)}

					{/* Empty: zero reports */}
					{!isLoading && reports.length === 0 && (
						<div
							className="flex flex-col items-center justify-center py-16 text-center"
							data-testid="report-empty-state"
						>
							<FileText className="mb-3 size-8 animate-pulse text-muted-foreground/20" />
							<p className="font-mono text-muted-foreground/60 text-xs">
								No reports yet
							</p>
							<p className="mt-1 font-mono text-[10px] text-muted-foreground/30">
								Describe an analysis above to run your first.
							</p>
						</div>
					)}

					{/* List */}
					{!isLoading && finished.length > 0 && (
						<div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-lg border border-white/5">
							{matches.map((r) => (
								<ReportResultRow
									isRetrying={isRetrying}
									key={r.id}
									onDelete={onDelete}
									onRetry={onRetry}
									report={r}
								/>
							))}
							{matches.length === 0 && (
								<p className="px-3 py-6 text-center font-mono text-muted-foreground/40 text-xs">
									No matches — press ↵ to analyze “{query.trim()}”
								</p>
							)}
						</div>
					)}

					{/* Infinite scroll sentinel */}
					{!isLoading && hasNextPage && matches.length > 0 && (
						<div className="flex justify-center py-2" ref={setSentinel}>
							<button
								className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider transition-colors hover:text-foreground disabled:opacity-50"
								disabled={isFetchingNextPage}
								onClick={fetchNextPage}
								type="button"
							>
								{isFetchingNextPage ? "Loading…" : "Load more"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
