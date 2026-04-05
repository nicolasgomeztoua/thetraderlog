"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	SEARCH_DEBOUNCE_MS,
	SEARCH_DEFAULT_LIMIT,
	SEARCH_EMPTY_STATE,
	SEARCH_ERROR_STATE,
	SEARCH_INITIAL_HINT,
	SEARCH_LABEL_JOURNAL,
	SEARCH_LABEL_TRADE_NOTE,
	SEARCH_MIN_LENGTH_HINT,
	SEARCH_MIN_QUERY_LENGTH,
	SEARCH_PLACEHOLDER,
} from "@/lib/constants/search";
import { formatDateString, getUTCDateString } from "@/lib/shared/timezone";
import { parseHighlightedSnippet } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

type SearchResult = {
	type: "journal" | "trade-note";
	id: string;
	label: string;
	snippet: string;
	rank: number;
	href: string;
};

export function GlobalSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();

	// Cmd+K / Ctrl+K shortcut
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Debounce input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query]);

	// Reset state when dialog opens/closes
	useEffect(() => {
		if (open) {
			setQuery("");
			setDebouncedQuery("");
			setSelectedIndex(0);
		}
	}, [open]);

	const shouldSearch = debouncedQuery.length >= SEARCH_MIN_QUERY_LENGTH;

	const {
		data: journalResults,
		isLoading: isJournalLoading,
		isError: isJournalError,
	} = api.dailyJournal.search.useQuery(
		{ query: debouncedQuery },
		{ enabled: shouldSearch },
	);

	const {
		data: tradeResults,
		isLoading: isTradeLoading,
		isError: isTradeError,
	} = api.trades.searchNotes.useQuery(
		{ query: debouncedQuery },
		{ enabled: shouldSearch },
	);

	const isLoading = isJournalLoading || isTradeLoading;
	const isError = isJournalError && isTradeError;

	// Merge and sort results by rank
	const mergedResults = useMemo<SearchResult[]>(() => {
		const merged: SearchResult[] = [];

		if (journalResults) {
			for (const r of journalResults) {
				const dateStr = getUTCDateString(
					r.date instanceof Date ? r.date : String(r.date),
				);
				merged.push({
					type: "journal",
					id: r.journalId,
					label: formatDateString(dateStr, "EEE, MMM d, yyyy"),
					snippet: r.snippet,
					rank: r.rank,
					href: `/daily-journal?date=${dateStr}`,
				});
			}
		}

		if (tradeResults) {
			for (const r of tradeResults) {
				const date =
					r.entryTime instanceof Date
						? r.entryTime
						: new Date(String(r.entryTime));
				const dateLabel = date.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
				merged.push({
					type: "trade-note",
					id: r.tradeId,
					label: `${r.symbol}  ${dateLabel}`,
					snippet: r.snippet,
					rank: r.rank,
					href: `/journal/${r.tradeId}?tab=notes`,
				});
			}
		}

		merged.sort((a, b) => b.rank - a.rank);
		return merged.slice(0, SEARCH_DEFAULT_LIMIT);
	}, [journalResults, tradeResults]);

	const handleNavigate = useCallback(
		(href: string) => {
			const basePath = href.split("?")[0] ?? href;
			startTransition(() => {
				if (pathname === basePath) {
					router.replace(href);
				} else {
					router.push(href);
				}
				setOpen(false);
			});
		},
		[router, pathname],
	);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (mergedResults.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) =>
					Math.min(prev + 1, mergedResults.length - 1),
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const selected = mergedResults[selectedIndex];
				if (selected) {
					handleNavigate(selected.href);
				}
			}
		},
		[mergedResults, selectedIndex, handleNavigate],
	);

	return (
		<>
			<Button
				className="gap-2 font-mono text-muted-foreground text-xs"
				data-testid="global-search-trigger"
				onClick={() => setOpen(true)}
				size="sm"
				variant="outline"
			>
				<SearchIcon className="size-3.5" />
				<span className="hidden sm:inline">Search</span>
				<kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
					⌘K
				</kbd>
			</Button>

			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent
					className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl"
					data-testid="global-search-dialog"
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						inputRef.current?.focus();
					}}
				>
					<DialogTitle className="sr-only">Search Journal</DialogTitle>
					<div className="flex items-center border-border border-b px-4">
						<SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
						<input
							className="flex-1 bg-transparent py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
							data-testid="global-search-input"
							onChange={(e) => {
								setQuery(e.target.value);
								setSelectedIndex(0);
							}}
							onKeyDown={handleKeyDown}
							placeholder={SEARCH_PLACEHOLDER}
							ref={inputRef}
							value={query}
						/>
						{isLoading && shouldSearch && (
							<Loader2Icon className="ml-2 size-4 animate-spin text-muted-foreground" />
						)}
					</div>

					<div
						className="relative max-h-80 overflow-y-auto"
						data-testid="global-search-results"
					>
						{isPending && (
							<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
								<Loader2Icon className="size-5 animate-spin text-primary" />
							</div>
						)}
						{shouldSearch && !isLoading && isError && (
							<div className="p-6 text-center font-mono text-destructive text-xs">
								{SEARCH_ERROR_STATE}
							</div>
						)}

						{shouldSearch &&
							!isLoading &&
							!isError &&
							mergedResults.length === 0 && (
								<div className="p-6 text-center font-mono text-muted-foreground text-xs">
									{SEARCH_EMPTY_STATE}
								</div>
							)}

						{shouldSearch && !isLoading && mergedResults.length > 0 && (
							<div className="py-1">
								{mergedResults.map((result, index) => (
									<Link
										className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left ${
											index === selectedIndex
												? "bg-primary/10"
												: "hover:bg-muted/50"
										}`}
										data-testid="global-search-result-item"
										href={result.href}
										key={`${result.type}-${result.id}`}
										onClick={(e) => {
											e.preventDefault();
											handleNavigate(result.href);
										}}
										onMouseEnter={() => setSelectedIndex(index)}
									>
										<span className="flex items-center gap-2">
											<span className="font-mono text-primary text-xs">
												{result.label}
											</span>
											<span
												className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
													result.type === "trade-note"
														? "border border-primary/30 text-primary"
														: "border border-muted-foreground/30 text-muted-foreground"
												}`}
											>
												{result.type === "trade-note"
													? SEARCH_LABEL_TRADE_NOTE
													: SEARCH_LABEL_JOURNAL}
											</span>
										</span>
										<span className="line-clamp-2 font-mono text-muted-foreground text-xs [&>mark]:bg-primary/20 [&>mark]:text-primary">
											{parseHighlightedSnippet(result.snippet).map((seg) =>
												seg.highlighted ? (
													<mark key={`h-${seg.text}`}>{seg.text}</mark>
												) : (
													seg.text
												),
											)}
										</span>
									</Link>
								))}
							</div>
						)}

						{!shouldSearch && query.length > 0 && (
							<div className="p-6 text-center font-mono text-muted-foreground text-xs">
								{SEARCH_MIN_LENGTH_HINT}
							</div>
						)}

						{query.length === 0 && (
							<div className="p-6 text-center font-mono text-muted-foreground text-xs">
								{SEARCH_INITIAL_HINT}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
