"use client";

import {
	ArrowDownUp,
	FileText,
	Loader2,
	RefreshCw,
	Rows3,
	Search,
	StretchHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/shared/utils";
import { type ReportDensity, ReportRow } from "./report-row";
import type { ReportItem } from "./report-shared";

type StatusFilter = "all" | "active" | "complete" | "failed";
type SortOrder = "newest" | "oldest";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "active", label: "Active" },
	{ key: "complete", label: "Done" },
	{ key: "failed", label: "Failed" },
];

function isActive(r: ReportItem): boolean {
	return r.status === "queued" || r.status === "generating";
}

interface ReportArchiveProps {
	items: ReportItem[];
	isLoading: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => void;
	onRetry: (reportId: string) => void;
	isRetrying: boolean;
	onRefresh: () => void;
	isRefreshing: boolean;
}

export function ReportArchive({
	items,
	isLoading,
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
	onRetry,
	isRetrying,
	onRefresh,
	isRefreshing,
}: ReportArchiveProps) {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [sort, setSort] = useState<SortOrder>("newest");
	const [density, setDensity] = useState<ReportDensity>("comfortable");

	const scrollRef = useRef<HTMLDivElement>(null);

	// Latest values held in refs so the sentinel callback ref stays stable
	// (and the observer re-attaches whenever the sentinel mounts/unmounts —
	// e.g. when filters hide then re-show it).
	const observerRef = useRef<IntersectionObserver | null>(null);
	const fetchNextPageRef = useRef(fetchNextPage);
	const hasNextPageRef = useRef(hasNextPage);
	const isFetchingNextPageRef = useRef(isFetchingNextPage);
	useEffect(() => {
		fetchNextPageRef.current = fetchNextPage;
		hasNextPageRef.current = hasNextPage;
		isFetchingNextPageRef.current = isFetchingNextPage;
	});

	const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
		observerRef.current?.disconnect();
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0]?.isIntersecting &&
					hasNextPageRef.current &&
					!isFetchingNextPageRef.current
				) {
					fetchNextPageRef.current();
				}
			},
			{ root: scrollRef.current, rootMargin: "240px" },
		);
		observer.observe(node);
		observerRef.current = observer;
	}, []);

	useEffect(() => () => observerRef.current?.disconnect(), []);

	const activeCount = useMemo(() => items.filter(isActive).length, [items]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		const result = items.filter((r) => {
			if (statusFilter === "active" && !isActive(r)) return false;
			if (statusFilter === "complete" && r.status !== "complete") return false;
			if (statusFilter === "failed" && r.status !== "failed") return false;
			if (q) {
				const haystack = `${r.title ?? ""} ${r.prompt}`.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
		// listReports is already desc(createdAt); only reverse for "oldest".
		return sort === "oldest" ? [...result].reverse() : result;
	}, [items, search, statusFilter, sort]);

	const hasReports = items.length > 0;
	const isFiltering = !!search.trim() || statusFilter !== "all";

	return (
		<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded border border-border bg-card">
			{/* Toolbar */}
			<div className="flex flex-col gap-2 border-white/5 border-b bg-white/[0.01] px-3 py-2.5 sm:px-4">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Archive
						</span>
						{hasReports && (
							<span className="font-mono text-[10px] text-muted-foreground/40">
								{items.length}
							</span>
						)}
						{activeCount > 0 && (
							<span className="flex items-center gap-1 rounded-full border border-accent/20 bg-accent/5 px-1.5 py-0.5 font-mono text-[9px] text-accent uppercase tracking-wider">
								<span className="pulse-dot size-1 rounded-full bg-accent" />
								{activeCount} running
							</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						{/* Sort */}
						<button
							className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
							onClick={() =>
								setSort((s) => (s === "newest" ? "oldest" : "newest"))
							}
							title="Toggle sort order"
							type="button"
						>
							<ArrowDownUp className="size-3" />
							{sort === "newest" ? "Newest" : "Oldest"}
						</button>
						{/* Density */}
						<div className="flex rounded border border-white/10 bg-white/[0.02] p-0.5">
							<button
								aria-label="Comfortable density"
								aria-pressed={density === "comfortable"}
								className={cn(
									"rounded p-1 transition-colors",
									density === "comfortable"
										? "bg-white/5 text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setDensity("comfortable")}
								title="Comfortable"
								type="button"
							>
								<StretchHorizontal className="size-3" />
							</button>
							<button
								aria-label="Compact density"
								aria-pressed={density === "compact"}
								className={cn(
									"rounded p-1 transition-colors",
									density === "compact"
										? "bg-white/5 text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setDensity("compact")}
								title="Compact"
								type="button"
							>
								<Rows3 className="size-3" />
							</button>
						</div>
						{/* Refresh */}
						<button
							aria-busy={isRefreshing}
							aria-label="Refresh reports"
							className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
							data-testid="report-refresh-button"
							onClick={onRefresh}
							title="Refresh"
							type="button"
						>
							<RefreshCw
								className={cn("size-3", isRefreshing && "animate-spin")}
							/>
						</button>
					</div>
				</div>

				{/* Search + status filters */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="relative flex-1">
						<Search
							aria-hidden="true"
							className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3 text-muted-foreground/40"
						/>
						<input
							aria-label="Search reports"
							className="h-8 w-full rounded border border-white/10 bg-transparent pr-2.5 pl-8 font-mono text-foreground text-xs transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none"
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search reports…"
							type="search"
							value={search}
						/>
					</div>
					<div className="flex rounded border border-white/10 bg-white/[0.02] p-0.5">
						{STATUS_FILTERS.map((f) => (
							<button
								aria-pressed={statusFilter === f.key}
								className={cn(
									"rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
									statusFilter === f.key
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
								key={f.key}
								onClick={() => setStatusFilter(f.key)}
								type="button"
							>
								{f.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* List */}
			<div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
				<div className="flex flex-col gap-2 p-3 sm:p-4">
					{/* Loading skeletons */}
					{isLoading &&
						Array.from({ length: 4 }).map((_, i) => (
							<div
								className="rounded border border-white/5 bg-white/[0.01] p-3"
								key={`skeleton-${i.toString()}`}
							>
								<Skeleton className="h-4 w-3/4" />
								<div className="mt-3 flex items-center gap-2">
									<Skeleton className="h-3 w-16" />
									<Skeleton className="h-3 w-20" />
								</div>
							</div>
						))}

					{/* Rows */}
					{!isLoading &&
						filtered.map((report) => (
							<ReportRow
								density={density}
								isRetrying={isRetrying}
								key={report.id}
								onRetry={onRetry}
								report={report}
							/>
						))}

					{/* Empty: no reports at all */}
					{!isLoading && !hasReports && (
						<div
							className="flex flex-col items-center justify-center py-16 text-center"
							data-testid="report-empty-state"
						>
							<FileText className="mb-3 size-8 animate-pulse text-muted-foreground/20" />
							<p className="font-mono text-muted-foreground/60 text-xs">
								No reports yet
							</p>
							<p className="mt-1 max-w-[34ch] font-mono text-[10px] text-muted-foreground/30 leading-relaxed">
								Describe an analysis on the left and run your first report.
							</p>
						</div>
					)}

					{/* Empty: filtered out everything */}
					{!isLoading && hasReports && filtered.length === 0 && (
						<div className="flex flex-col items-center justify-center py-16 text-center">
							<Search className="mb-3 size-6 text-muted-foreground/20" />
							<p className="font-mono text-muted-foreground/50 text-xs">
								No matching reports
							</p>
							{isFiltering && (
								<button
									className="mt-2 font-mono text-[10px] text-primary/70 uppercase tracking-wider hover:text-primary"
									onClick={() => {
										setSearch("");
										setStatusFilter("all");
									}}
									type="button"
								>
									Clear filters
								</button>
							)}
						</div>
					)}

					{/* Infinite-scroll sentinel + load more */}
					{!isLoading && hasNextPage && filtered.length > 0 && (
						<div
							className="flex items-center justify-center py-3"
							ref={setSentinelRef}
						>
							<button
								className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider transition-colors hover:text-foreground disabled:opacity-50"
								disabled={isFetchingNextPage}
								onClick={fetchNextPage}
								type="button"
							>
								{isFetchingNextPage ? (
									<Loader2 className="size-3 animate-spin" />
								) : null}
								{isFetchingNextPage ? "Loading…" : "Load more"}
							</button>
						</div>
					)}

					{/* Honest note: client search only spans loaded reports */}
					{!isLoading && hasNextPage && isFiltering && filtered.length > 0 && (
						<p className="pb-1 text-center font-mono text-[9px] text-muted-foreground/30">
							Filtering loaded reports — load more to search older
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
