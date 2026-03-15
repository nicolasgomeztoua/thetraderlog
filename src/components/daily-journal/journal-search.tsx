"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
	SEARCH_DEBOUNCE_MS,
	SEARCH_EMPTY_STATE,
	SEARCH_HELPER_TEXT,
	SEARCH_MIN_QUERY_LENGTH,
	SEARCH_PLACEHOLDER,
} from "@/lib/constants/search";
import { api } from "@/trpc/react";

interface JournalSearchProps {
	onSelectDate: (date: Date) => void;
}

export function JournalSearch({ onSelectDate }: JournalSearchProps) {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounce input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query]);

	const shouldSearch = debouncedQuery.length >= SEARCH_MIN_QUERY_LENGTH;

	const { data: results, isLoading } = api.dailyJournal.search.useQuery(
		{ query: debouncedQuery },
		{ enabled: shouldSearch },
	);

	// Close dropdown on outside click
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = useCallback(
		(dateStr: string) => {
			const date = new Date(dateStr);
			onSelectDate(date);
			setQuery("");
			setDebouncedQuery("");
			setIsOpen(false);
		},
		[onSelectDate],
	);

	const handleClear = () => {
		setQuery("");
		setDebouncedQuery("");
		setIsOpen(false);
		inputRef.current?.focus();
	};

	const showDropdown = isOpen && query.length >= SEARCH_MIN_QUERY_LENGTH;

	return (
		<div
			className="relative w-full"
			data-testid="journal-search"
			ref={containerRef}
		>
			<div className="relative">
				<SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
				<Input
					className="h-9 bg-muted/30 pr-9 pl-9 font-mono text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary"
					data-testid="journal-search-input"
					onChange={(e) => {
						setQuery(e.target.value);
						setIsOpen(true);
					}}
					onFocus={() => {
						if (query.length >= SEARCH_MIN_QUERY_LENGTH) {
							setIsOpen(true);
						}
					}}
					placeholder={SEARCH_PLACEHOLDER}
					ref={inputRef}
					value={query}
				/>
				{query && (
					<button
						className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
						data-testid="journal-search-button-clear"
						onClick={handleClear}
						type="button"
					>
						<XIcon className="size-4" />
					</button>
				)}
				{isLoading && shouldSearch && (
					<Loader2Icon className="-translate-y-1/2 absolute top-1/2 right-3 size-4 animate-spin text-muted-foreground" />
				)}
			</div>

			{!showDropdown && query.length === 0 && (
				<p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
					{SEARCH_HELPER_TEXT}
				</p>
			)}

			{showDropdown && (
				<div
					className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded border border-border bg-background shadow-lg"
					data-testid="journal-search-results"
				>
					{isLoading ? (
						<div className="flex items-center justify-center p-4">
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : results && results.length > 0 ? (
						results.map((result) => (
							<button
								className="flex w-full flex-col gap-1 border-border border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
								data-testid="journal-search-result-item"
								key={result.journalId}
								onClick={() =>
									handleSelect(
										result.date instanceof Date
											? result.date.toISOString()
											: String(result.date),
									)
								}
								type="button"
							>
								<span className="font-mono text-primary text-xs">
									{new Date(
										result.date instanceof Date
											? result.date
											: String(result.date),
									).toLocaleDateString("en-US", {
										weekday: "short",
										month: "short",
										day: "numeric",
										year: "numeric",
									})}
								</span>
								<span
									className="line-clamp-2 font-mono text-muted-foreground text-xs [&>mark]:bg-primary/20 [&>mark]:text-primary"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: ts_headline generates safe HTML
									dangerouslySetInnerHTML={{ __html: result.snippet }}
								/>
							</button>
						))
					) : (
						<div className="p-4 text-center font-mono text-muted-foreground text-xs">
							{SEARCH_EMPTY_STATE}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
