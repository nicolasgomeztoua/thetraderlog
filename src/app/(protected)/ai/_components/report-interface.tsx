"use client";

import {
	ArrowRight,
	BarChart3,
	ChevronDown,
	Clock,
	Database,
	FileText,
	Loader2,
	type LucideIcon,
	RefreshCw,
	Send,
	Sparkles,
	Timer,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	UsageLimitBanner,
	useReportLimitReached,
} from "@/components/billing/usage-limit-banner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/contexts/account-context";
import {
	DEFAULT_REPORT_MODEL,
	SUGGESTED_REPORT_PROMPTS,
} from "@/lib/constants/ai";
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
	queued: "Waiting in queue...",
	building_context: "Loading your trading profile...",
	planning: "Planning analysis...",
	gathering_data: "Gathering your data...",
	writing: "Writing report...",
	validating: "Validating output...",
	analyzing: "Analyzing your data...",
	complete: "Complete",
	failed: "Failed",
};

const TOOL_DETAIL_LABELS: Record<string, string> = {
	run_query: "Querying your trades...",
	call_analytics: "Crunching the numbers...",
	get_market_data: "Fetching market data...",
	run_python: "Generating visualizations...",
};

// Ordered pipeline stages surfaced as a compact stepper on active rows.
const STAGE_STEPS: { key: string; label: string }[] = [
	{ key: "building_context", label: "CONTEXT" },
	{ key: "planning", label: "PLAN" },
	{ key: "gathering_data", label: "GATHER" },
	{ key: "writing", label: "WRITE" },
	{ key: "validating", label: "VALIDATE" },
];

// Icons cycled across the suggested-analysis cards (matches the chat surface).
const SUGGESTION_ICONS: LucideIcon[] = [
	TrendingUp,
	BarChart3,
	Database,
	Zap,
	Sparkles,
	Clock,
];

// Known multi-token model slugs that need bespoke casing.
const MODEL_TOKEN_OVERRIDES: Record<string, string> = {
	mimo: "MiMo",
	k2: "K2",
	glm: "GLM",
	gpt: "GPT",
	vl: "VL",
	ai: "AI",
	moe: "MoE",
	pro: "Pro",
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
			return 10;
		case "planning":
			return 20;
		case "gathering_data": {
			const round = currentRound ?? 0;
			return 30 + Math.min(round / totalRounds, 1) * 40;
		}
		case "writing":
			return 75;
		case "validating":
			return 90;
		case "analyzing": {
			// Legacy stage name (kept for backward compat)
			const round = currentRound ?? 0;
			return 20 + Math.min(round / totalRounds, 1) * 70;
		}
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
// PURE DISPLAY HELPERS
// =============================================================================

/** Compact, terminal-style "time since" — "now", "5m", "3h", "2d", or "Jun 18". */
function relativeTime(date: Date | string | null | undefined): string {
	if (!date) return "—";
	const d = typeof date === "string" ? new Date(date) : date;
	const ms = Date.now() - d.getTime();
	const s = Math.floor(ms / 1000);
	if (s < 60) return "now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	const days = Math.floor(h / 24);
	if (days < 7) return `${days}d`;
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Wall-clock generation time — "—" while incomplete, else "45s" / "2m 10s" / "1h 4m". */
function formatDuration(
	start: Date | string,
	end: Date | string | null | undefined,
): string {
	if (!end) return "—";
	const startMs = (
		typeof start === "string" ? new Date(start) : start
	).getTime();
	const endMs = (typeof end === "string" ? new Date(end) : end).getTime();
	const total = Math.max(0, Math.round((endMs - startMs) / 1000));
	if (total < 60) return `${total}s`;
	const m = Math.floor(total / 60);
	const s = total % 60;
	if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
	const h = Math.floor(m / 60);
	const remM = m % 60;
	return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

/** "xiaomi/mimo-v2-pro" -> "MiMo v2 Pro". Never throws, never returns blank. */
function prettifyModel(rawId: string | null | undefined): string {
	if (!rawId) return "Default";
	const slug = rawId.includes("/") ? (rawId.split("/").pop() ?? rawId) : rawId;
	const tokens = slug.split(/[-_]/).filter(Boolean);
	if (tokens.length === 0) return rawId;
	const pretty = tokens
		.map((t) => {
			const lower = t.toLowerCase();
			if (MODEL_TOKEN_OVERRIDES[lower]) return MODEL_TOKEN_OVERRIDES[lower];
			// Preserve version-like tokens (v2, 4o, 2.5) as written.
			if (/^v?\d/.test(lower)) return lower;
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join(" ");
	return pretty || rawId;
}

/** Token / count formatter — "980", "12.4k", "1.2M". */
function compactNumber(n: number | null | undefined): string {
	if (!n || n <= 0) return "0";
	if (n < 1000) return String(n);
	if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

type ReportItem = {
	status: string | null;
	chartsGenerated: number | null;
	tokensUsed: number | null;
	createdAt: Date | string | null;
};

/** Single-pass blotter aggregates that drive the stats strip + footer ledger. */
function computeStats(items: ReportItem[]) {
	let complete = 0;
	let inProgress = 0;
	let charts = 0;
	let tokens = 0;
	let lastRunAt: Date | null = null;
	for (const r of items) {
		if (r.status === "complete") complete += 1;
		if (r.status === "queued" || r.status === "generating") inProgress += 1;
		charts += r.chartsGenerated ?? 0;
		tokens += r.tokensUsed ?? 0;
		if (r.createdAt) {
			const c = new Date(r.createdAt);
			if (!lastRunAt || c > lastRunAt) lastRunAt = c;
		}
	}
	return {
		total: items.length,
		complete,
		inProgress,
		charts,
		tokens,
		lastRunAt,
	};
}

function suggestionIcon(index: number): LucideIcon {
	return SUGGESTION_ICONS[index % SUGGESTION_ICONS.length] ?? Sparkles;
}

/** Map the live progressStage onto the ordered pipeline stepper. */
function stageSteps(
	progressStage: string | null | undefined,
): { key: string; label: string; state: "done" | "current" | "future" }[] {
	// "analyzing" is the legacy name for the gather phase.
	const normalized =
		progressStage === "analyzing" ? "gathering_data" : progressStage;
	const currentIdx = STAGE_STEPS.findIndex((s) => s.key === normalized);
	return STAGE_STEPS.map((step, i) => {
		let state: "done" | "current" | "future";
		if (currentIdx === -1)
			state = "future"; // queued / unknown — nothing active yet
		else if (i < currentIdx) state = "done";
		else if (i === currentIdx) state = "current";
		else state = "future";
		return { ...step, state };
	});
}

// =============================================================================
// SUGGESTION CARD (shared by composer + empty state)
// =============================================================================

function SuggestionCard({
	prompt,
	index,
	onSelect,
	testId,
}: {
	prompt: string;
	index: number;
	onSelect: (prompt: string) => void;
	testId?: string;
}) {
	const Icon = suggestionIcon(index);
	return (
		<button
			className="group flex items-start gap-2.5 rounded border border-white/5 bg-white/[0.02] p-2.5 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.02]"
			data-testid={testId}
			onClick={() => onSelect(prompt)}
			type="button"
		>
			<span className="mt-0.5 shrink-0 rounded bg-primary/10 p-1.5">
				<Icon className="h-3.5 w-3.5 text-primary" />
			</span>
			{/* textContent of this button === `prompt`, so a click sets the textarea
			    to exactly this value (icons carry no text). */}
			<span className="line-clamp-2 min-w-0 flex-1 font-mono text-[11px] text-muted-foreground/70 leading-relaxed group-hover:text-foreground">
				{prompt}
			</span>
			<ArrowRight className="-translate-x-1 mt-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
		</button>
	);
}

// =============================================================================
// STATS STRIP
// =============================================================================

function StatCell({
	label,
	value,
	valueClass,
	pulse,
	loading,
}: {
	label: string;
	value: string;
	valueClass: string;
	pulse?: boolean;
	loading?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1 bg-card px-3 py-2">
			{loading ? (
				<Skeleton className="h-5 w-10" />
			) : (
				<div className="flex items-center gap-1.5">
					<span
						className={`font-mono text-lg tabular-nums leading-none ${valueClass}`}
					>
						{value}
					</span>
					{pulse && (
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
					)}
				</div>
			)}
			<span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
				{label}
			</span>
		</div>
	);
}

// =============================================================================
// REPORT INTERFACE
// =============================================================================

export function ReportInterface({ mode, onModeChange }: ReportInterfaceProps) {
	const [prompt, setPrompt] = useState("");
	const [dateRangeStart, setDateRangeStart] = useState("");
	const [dateRangeEnd, setDateRangeEnd] = useState("");
	const [activePreset, setActivePreset] = useState<string | null>(null);
	const [dateError, setDateError] = useState("");
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { selectedAccountId } = useAccount();
	const reportLimitReached = useReportLimitReached();

	const utils = api.useUtils();

	// Fetch reports
	const { data: reports, isLoading: isReportsLoading } =
		api.ai.listReports.useQuery(
			{ limit: 20 },
			{
				refetchOnWindowFocus: true,
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

	const items = reports?.items ?? [];
	const stats = useMemo(
		() => computeStats(reports?.items ?? []),
		[reports?.items],
	);

	// Mutations
	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			setPrompt("");
			void utils.billing.getUsage.invalidate();
			void utils.ai.listReports.invalidate();
		},
		onError: (err) => {
			if (err.data?.code === "FORBIDDEN") {
				void utils.billing.getUsage.invalidate();
			}
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
			...(selectedAccountId && { accountId: selectedAccountId }),
		});
	};

	const handleRefresh = () => {
		setIsRefreshing(true);
		void utils.ai.listReports.invalidate().then(() => {
			setTimeout(() => setIsRefreshing(false), 500);
		});
	};

	// Top-bar model indicator chip — static placeholder for the report model.
	const modelChip = (
		<div className="ml-auto inline-flex items-center gap-1.5 rounded border border-white/10 border-l-primary/40 bg-white/[0.01] px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
			<Zap className="h-3 w-3 text-primary/60" />
			<span className="hidden sm:inline">
				{prettifyModel(DEFAULT_REPORT_MODEL)}
			</span>
			<ChevronDown className="hidden h-3 w-3 opacity-40 sm:block" />
		</div>
	);

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded border border-border bg-card"
			data-testid="ai-report-interface"
		>
			<ModelSelector
				mode={mode}
				onModeChange={onModeChange}
				rightSlot={modelChip}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:p-4">
				{/* ================================================================ */}
				{/* ORDER TICKET (composer) */}
				{/* ================================================================ */}
				<div className="flex w-full shrink-0 flex-col overflow-hidden rounded border border-border bg-card lg:w-[420px]">
					{/* Header — terminal chrome */}
					<div className="flex items-center gap-2 border-white/5 border-b bg-white/[0.01] px-4 py-3">
						<div className="flex gap-1.5">
							<span className="h-2 w-2 rounded-full bg-loss/60" />
							<span className="h-2 w-2 rounded-full bg-breakeven/60" />
							<span className="h-2 w-2 rounded-full bg-profit/60" />
						</div>
						<FileText className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Order Ticket
						</span>
					</div>

					<ScrollArea className="flex-1">
						<div className="flex flex-col gap-5 p-3 sm:p-4">
							{/* Prompt */}
							<div>
								<div className="mb-2 flex items-center justify-between">
									<label
										className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
										htmlFor="report-prompt"
									>
										Analysis Prompt
									</label>
									<span
										className={`font-mono text-[10px] tabular-nums ${
											prompt.length > CHAR_WARN_THRESHOLD
												? "text-loss/60"
												: "text-muted-foreground/30"
										}`}
									>
										{prompt.length.toLocaleString()}
									</span>
								</div>
								<div className="rounded border border-white/10 bg-white/[0.02] p-1 transition-all focus-within:border-primary/40 focus-within:shadow-[0_0_15px_rgba(212,255,0,0.08)]">
									<textarea
										className="min-h-[120px] w-full resize-none bg-transparent px-2.5 py-2 font-mono text-sm placeholder:text-muted-foreground/40 focus:outline-none"
										data-testid="report-prompt-input"
										id="report-prompt"
										onChange={(e) => setPrompt(e.target.value)}
										onKeyDown={(e) => {
											if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
												e.preventDefault();
												handleGenerateReport();
											}
										}}
										placeholder="Add as much detail as possible about the analysis you want..."
										value={prompt}
									/>
									<div className="flex justify-end px-1 pb-0.5">
										<span className="font-mono text-[10px] text-muted-foreground/30">
											⌘↵ to generate
										</span>
									</div>
								</div>
							</div>

							{/* Quick Date Presets — segmented control */}
							<div>
								<span className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Date Range
								</span>
								<div className="mb-2 inline-flex w-full rounded border border-white/10 bg-white/[0.01] p-0.5">
									{QUICK_DATE_PRESETS.map((preset) => (
										<button
											className={`flex-1 rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
												activePreset === preset.label
													? "bg-primary/10 text-primary"
													: "text-muted-foreground hover:text-foreground"
											}`}
											key={preset.label}
											onClick={() => {
												const { start, end } = getDatePreset(preset);
												setDateRangeStart(start);
												setDateRangeEnd(end);
												setActivePreset(preset.label);
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
										className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors focus:border-white/20 focus:outline-none"
										data-testid="report-date-start"
										onChange={(e) => {
											setDateRangeStart(e.target.value);
											setActivePreset(null);
											setDateError("");
										}}
										type="date"
										value={dateRangeStart}
									/>
									<span className="font-mono text-[10px] text-muted-foreground/40">
										→
									</span>
									<input
										className="h-9 flex-1 rounded border border-white/10 bg-transparent px-2.5 font-mono text-foreground text-xs transition-colors focus:border-white/20 focus:outline-none"
										data-testid="report-date-end"
										onChange={(e) => {
											setDateRangeEnd(e.target.value);
											setActivePreset(null);
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

							{/* Usage Limit Banner */}
							{reportLimitReached && <UsageLimitBanner type="reports" />}

							{/* Generate Button — primary lime CTA */}
							<button
								className="flex w-full items-center justify-center gap-2 rounded bg-primary/10 py-2.5 font-mono text-primary text-xs uppercase tracking-wider transition-all hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(212,255,0,0.15)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
								data-testid="report-generate-button"
								disabled={
									startReport.isPending || !prompt.trim() || reportLimitReached
								}
								onClick={handleGenerateReport}
								type="button"
							>
								{startReport.isPending ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Send className="h-3.5 w-3.5" />
								)}
								{startReport.isPending ? "Generating…" : "Generate Report"}
							</button>

							{/* Suggested Prompts — chat-native icon cards */}
							<div>
								<span className="mb-2 block font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Quick Analyses
								</span>
								<div
									className="flex flex-col gap-1.5"
									data-testid="report-suggested-prompts"
								>
									{SUGGESTED_REPORT_PROMPTS.map((p, i) => (
										<SuggestionCard
											index={i}
											key={p}
											onSelect={setPrompt}
											prompt={p}
											testId="report-suggested-prompt"
										/>
									))}
								</div>
							</div>
						</div>
					</ScrollArea>
				</div>

				{/* ================================================================ */}
				{/* THE BLOTTER (history) */}
				{/* ================================================================ */}
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border bg-card">
					{/* Zone 1 — header */}
					<div className="flex items-center gap-2 border-white/5 border-b bg-white/[0.01] px-3 py-2 sm:px-4">
						<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Blotter
						</span>
						{items.length > 0 && (
							<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/5 px-1 font-mono text-[9px] text-muted-foreground">
								{items.length}
							</span>
						)}
						<div className="ml-auto flex items-center gap-3">
							{stats.lastRunAt && (
								<span className="hidden font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider sm:inline">
									Last run · {relativeTime(stats.lastRunAt)}
								</span>
							)}
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
					</div>

					{/* Zone 2 — stats strip */}
					<div className="grid grid-cols-2 gap-px border-white/5 border-b bg-border/40 sm:grid-cols-3 lg:grid-cols-5">
						<StatCell
							label="Total"
							loading={isReportsLoading}
							value={String(stats.total)}
							valueClass="text-foreground"
						/>
						<StatCell
							label="Complete"
							loading={isReportsLoading}
							value={String(stats.complete)}
							valueClass="text-profit"
						/>
						<StatCell
							label="In Progress"
							loading={isReportsLoading}
							pulse={stats.inProgress > 0}
							value={String(stats.inProgress)}
							valueClass="text-accent"
						/>
						<StatCell
							label="Charts"
							loading={isReportsLoading}
							value={String(stats.charts)}
							valueClass="text-foreground/80"
						/>
						<StatCell
							label="Last Run"
							loading={isReportsLoading}
							value={stats.lastRunAt ? relativeTime(stats.lastRunAt) : "—"}
							valueClass="text-foreground/80"
						/>
					</div>

					{/* Zone 3 — the list */}
					<ScrollArea className="min-h-0 flex-1">
						{isReportsLoading ? (
							<div className="divide-y divide-white/5">
								{Array.from({ length: 5 }).map((_, i) => (
									<div className="px-3 py-2.5" key={`skeleton-${i.toString()}`}>
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-16" />
											<Skeleton className="h-4 w-2/5" />
										</div>
										<Skeleton className="mt-2 h-3 w-2/3" />
									</div>
								))}
							</div>
						) : items.length === 0 ? (
							<div
								className="flex flex-col items-center justify-center px-4 py-12 text-center"
								data-testid="report-empty-state"
							>
								<FileText className="mb-3 size-8 animate-pulse text-muted-foreground/20" />
								<p className="font-mono text-muted-foreground/50 text-xs">
									No reports yet
								</p>
								<p className="mt-1 font-mono text-[10px] text-muted-foreground/30">
									Fire your first analysis from the order ticket →
								</p>
								<div className="mt-5 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
									{SUGGESTED_REPORT_PROMPTS.slice(0, 4).map((p, i) => (
										<SuggestionCard
											index={i}
											key={p}
											onSelect={setPrompt}
											prompt={p}
										/>
									))}
								</div>
							</div>
						) : (
							<div className="divide-y divide-white/5">
								{items.map((report) => {
									const isActive =
										report.status === "queued" ||
										report.status === "generating";
									const isFailed = report.status === "failed";
									const isComplete = report.status === "complete";

									const rail = isComplete
										? "border-l-profit/40"
										: isFailed
											? "border-l-loss/50"
											: report.status === "generating"
												? "border-l-accent/50"
												: "border-l-white/10";

									// Line 1: status pill + title (+ view affordance on complete).
									const line1 = (
										<div className="flex items-center gap-2">
											<span
												className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
													report.status === "queued"
														? "border-white/10 text-muted-foreground"
														: report.status === "generating"
															? "animate-pulse border-accent/20 text-accent"
															: report.status === "complete"
																? "border-profit/20 text-profit"
																: "border-loss/20 text-loss"
												}`}
												data-testid={`report-status-${report.id}`}
											>
												{report.status === "generating" && (
													<Loader2 className="mr-1 inline size-2.5 animate-spin" />
												)}
												{(report.status ?? "queued").toUpperCase()}
											</span>
											<span className="min-w-0 flex-1 truncate font-mono text-foreground text-xs">
												{report.title ?? report.prompt}
											</span>
											{isComplete && (
												<span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider transition-colors group-hover:text-primary">
													View Report
													<ArrowRight className="-translate-x-1 size-3 transition-transform group-hover:translate-x-0" />
												</span>
											)}
										</div>
									);

									// Line 2 (complete): the aligned metadata blotter line.
									const metaLine = (
										<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
											<span className="inline-flex items-center gap-1">
												<Zap className="size-2.5 text-primary/50" />
												{prettifyModel(report.model)}
											</span>
											<span className="inline-flex items-center gap-1">
												<span className="text-muted-foreground/20">·</span>
												<Clock className="size-2.5" />
												{relativeTime(report.createdAt)}
											</span>
											{report.completedAt && (
												<span className="inline-flex items-center gap-1">
													<span className="text-muted-foreground/20">·</span>
													<Timer className="size-2.5" />
													{formatDuration(report.createdAt, report.completedAt)}
												</span>
											)}
											{(report.chartsGenerated ?? 0) > 0 && (
												<span className="hidden items-center gap-1 sm:inline-flex">
													<span className="text-muted-foreground/20">·</span>
													<BarChart3 className="size-2.5" />
													{report.chartsGenerated}
												</span>
											)}
											{(report.totalToolCalls ?? 0) > 0 && (
												<span className="hidden items-center gap-1 sm:inline-flex">
													<span className="text-muted-foreground/20">·</span>
													<Database className="size-2.5" />
													{report.totalToolCalls}
												</span>
											)}
											{(report.tokensUsed ?? 0) > 0 && (
												<span className="hidden items-center gap-1 sm:inline-flex">
													<span className="text-muted-foreground/20">·</span>
													<TrendingUp className="size-2.5" />
													{compactNumber(report.tokensUsed)}
												</span>
											)}
										</div>
									);

									// Line 2 (active): live console — stage label, stepper, bar, telemetry.
									const stageLabel =
										(report.progressStage === "analyzing" ||
											report.progressStage === "gathering_data") &&
										report.progressDetail
											? (TOOL_DETAIL_LABELS[report.progressDetail] ??
												"Gathering your data...")
											: (PROGRESS_STAGE_LABELS[
													report.progressStage ?? "queued"
												] ?? "Processing");

									const showTelemetry =
										(report.currentRound ?? 0) > 0 ||
										(report.totalToolCalls ?? 0) > 0 ||
										(report.chartsGenerated ?? 0) > 0;

									const progressBlock = (
										<div
											className="mt-2"
											data-testid={`report-progress-${report.id}`}
										>
											<div className="flex items-center gap-2">
												<Loader2 className="size-3 animate-spin text-accent" />
												<span
													className="font-mono text-[11px] text-accent"
													data-testid={`report-progress-stage-${report.id}`}
												>
													{stageLabel}
												</span>
											</div>
											{/* Pipeline stepper */}
											<div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[9px] uppercase tracking-wider">
												{stageSteps(report.progressStage).map((step, i) => (
													<span
														className="inline-flex items-center gap-1.5"
														key={step.key}
													>
														{i > 0 && (
															<span className="text-muted-foreground/20">
																·
															</span>
														)}
														<span
															className={
																step.state === "done"
																	? "text-profit"
																	: step.state === "current"
																		? "cursor-blink text-accent"
																		: "text-muted-foreground/30"
															}
														>
															{step.label}
														</span>
													</span>
												))}
											</div>
											{/* Progress bar — single inner fill div (test contract) */}
											<div
												className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent/10"
												data-testid={`report-progress-bar-${report.id}`}
											>
												<div
													className="h-full rounded-full bg-accent/50 transition-all duration-700"
													style={{
														width: `${getProgressWidth(report.progressStage, report.currentRound, 20).toString()}%`,
													}}
												/>
											</div>
											{showTelemetry && (
												<div className="mt-1.5 flex gap-3 font-mono text-[10px] text-muted-foreground/50">
													{report.currentRound != null &&
														report.currentRound > 0 && (
															<span>
																Round {report.currentRound.toString()}
															</span>
														)}
													{report.totalToolCalls != null &&
														report.totalToolCalls > 0 && (
															<span>
																{report.totalToolCalls.toString()} tool calls
															</span>
														)}
													{report.chartsGenerated != null &&
														report.chartsGenerated > 0 && (
															<span>
																{report.chartsGenerated.toString()} charts
															</span>
														)}
												</div>
											)}
										</div>
									);

									// Line 2 (failed): error + retry (sibling, never inside an anchor).
									const failedBlock = (
										<div className="mt-2 flex items-start justify-between gap-2">
											<p className="min-w-0 flex-1 font-mono text-[10px] text-loss/80">
												{report.errorMessage ??
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
									);

									return (
										<div
											className={`group relative border-l-2 transition-all hover:bg-white/[0.02] ${rail} ${
												isComplete
													? "hover:shadow-[0_0_15px_rgba(212,255,0,0.06)]"
													: ""
											}`}
											data-testid={`report-item-${report.id}`}
											key={report.id}
										>
											{isComplete ? (
												<a
													className="block px-3 py-2.5"
													data-testid={`report-view-${report.id}`}
													href={`/ai/reports/${report.id}`}
												>
													{line1}
													{metaLine}
												</a>
											) : (
												<div className="px-3 py-2.5">
													{line1}
													{isActive ? progressBlock : null}
													{isFailed ? failedBlock : null}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</ScrollArea>

					{/* Zone 4 — footer ledger (pinned, outside the scroll area) */}
					{items.length > 0 && (
						<div className="flex items-center justify-between gap-2 border-white/5 border-t bg-white/[0.01] px-3 py-2 font-mono text-[10px] text-muted-foreground/40">
							<span className="tabular-nums">
								Σ {compactNumber(stats.tokens)} tokens · {items.length} report
								{items.length === 1 ? "" : "s"}
							</span>
							<span className="hidden items-center gap-1 sm:flex">
								{"// END OF BLOTTER"}
								<span className="cursor-blink" />
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
