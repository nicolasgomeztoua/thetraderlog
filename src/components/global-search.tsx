"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	SEARCH_DEBOUNCE_MS,
	SEARCH_EMPTY_STATE,
	SEARCH_ERROR_STATE,
	SEARCH_INITIAL_HINT,
	SEARCH_MIN_LENGTH_HINT,
	SEARCH_MIN_QUERY_LENGTH,
	SEARCH_PLACEHOLDER,
} from "@/lib/constants/search";
import { formatDateString, getUTCDateString } from "@/lib/shared/timezone";
import { api } from "@/trpc/react";

export function GlobalSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();

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
		data: results,
		isLoading,
		isError,
	} = api.dailyJournal.search.useQuery(
		{ query: debouncedQuery },
		{ enabled: shouldSearch },
	);

	const handleSelect = useCallback(
		(dateString: string) => {
			// Append T12:00:00 so page.tsx's new Date() parses as local noon,
			// avoiding the UTC-midnight off-by-one for UTC-negative timezones
			router.push(`/daily-journal?date=${dateString}T12:00:00`);
			setOpen(false);
		},
		[router],
	);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!results || results.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const selected = results[selectedIndex];
				if (selected) {
					handleSelect(
						getUTCDateString(
							selected.date instanceof Date
								? selected.date
								: String(selected.date),
						),
					);
				}
			}
		},
		[results, selectedIndex, handleSelect],
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
						className="max-h-80 overflow-y-auto"
						data-testid="global-search-results"
					>
						{shouldSearch && !isLoading && isError && (
							<div className="p-6 text-center font-mono text-destructive text-xs">
								{SEARCH_ERROR_STATE}
							</div>
						)}

						{shouldSearch &&
							!isLoading &&
							!isError &&
							results &&
							results.length === 0 && (
								<div className="p-6 text-center font-mono text-muted-foreground text-xs">
									{SEARCH_EMPTY_STATE}
								</div>
							)}

						{shouldSearch && !isLoading && results && results.length > 0 && (
							<div className="py-1">
								{results.map((result, index) => {
									const dateStr = getUTCDateString(
										result.date instanceof Date
											? result.date
											: String(result.date),
									);
									return (
										<button
											className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left ${
												index === selectedIndex
													? "bg-primary/10"
													: "hover:bg-muted/50"
											}`}
											data-testid="global-search-result-item"
											key={result.journalId}
											onClick={() => handleSelect(dateStr)}
											onMouseEnter={() => setSelectedIndex(index)}
											type="button"
										>
											<span className="font-mono text-primary text-xs">
												{formatDateString(dateStr, "EEE, MMM d, yyyy")}
											</span>
											<span
												className="line-clamp-2 font-mono text-muted-foreground text-xs [&>mark]:bg-primary/20 [&>mark]:text-primary"
												// biome-ignore lint/security/noDangerouslySetInnerHtml: ts_headline generates safe HTML
												dangerouslySetInnerHTML={{ __html: result.snippet }}
											/>
										</button>
									);
								})}
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
