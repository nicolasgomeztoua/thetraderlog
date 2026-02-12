"use client";

import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatCurrency,
	getLastNDaysRange,
	getUTCDateString,
	toDateString,
} from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget, WidgetEmptyState } from "../dashboard-widget";

// Strip HTML tags and get first N characters
function getExcerpt(html: string | null, maxLength = 100): string {
	if (!html) return "";
	const text = html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
}

// Format date for display
function formatJournalDate(dateStr: string): string {
	const date = new Date(`${dateStr}T12:00:00`);
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

interface JournalExcerpt {
	date: string;
	excerpt: string;
	pnl: number;
	tradeCount: number;
}

/**
 * Recent Journal Excerpts Widget for the Command Center dashboard.
 *
 * Shows:
 * - Last 3 journal entries with content
 * - Date, excerpt (first ~100 chars), P&L badge
 * - Click to navigate to /daily-journal for that date
 */
export function JournalExcerptsWidget() {
	const { selectedAccountId } = useAccount();
	const dateRange = useMemo(() => getLastNDaysRange(30), []);

	// Get journal adjacency data for P&L and dates with journals
	const { data: adjacencyData, isLoading: adjacencyLoading } =
		api.dailyJournal.getJournalAdjacency.useQuery(
			{
				accountId: selectedAccountId ?? undefined,
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
			},
			{ staleTime: 60000 },
		);

	// Get the 3 most recent days with journals that have content
	const recentJournalDates = useMemo(() => {
		if (!adjacencyData) return [];
		const today = toDateString(new Date());
		return adjacencyData
			.filter((d) => d.hasJournal && d.journalWordCount > 0 && d.date <= today)
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 3);
	}, [adjacencyData]);

	// Fetch journal content for these dates using a single batch request
	const batchDates = useMemo(
		() => recentJournalDates.map((d) => d.date),
		[recentJournalDates],
	);

	const { data: batchJournals, isLoading: batchLoading } =
		api.dailyJournal.getBatchByDates.useQuery(
			{ dates: batchDates },
			{ enabled: batchDates.length > 0, staleTime: 60000 },
		);

	const isLoading = adjacencyLoading || (batchDates.length > 0 && batchLoading);

	// Combine adjacency data with journal content
	const excerpts: JournalExcerpt[] = useMemo(() => {
		if (!batchJournals) return [];

		// Build a lookup map by normalized date string (UTC midnight → YYYY-MM-DD)
		const journalByDate = new Map<string, string | null>();
		for (const journal of batchJournals) {
			const dateStr = getUTCDateString(journal.date);
			journalByDate.set(dateStr, journal.content);
		}

		const result: JournalExcerpt[] = [];
		for (const dayData of recentJournalDates) {
			const content = journalByDate.get(dayData.date);
			if (content !== undefined) {
				result.push({
					date: dayData.date,
					excerpt: getExcerpt(content, 100),
					pnl: dayData.pnl,
					tradeCount: dayData.tradeCount,
				});
			}
		}

		return result;
	}, [recentJournalDates, batchJournals]);

	return (
		<DashboardWidget
			data-testid="widget-journal-excerpts"
			href="/daily-journal"
			icon={FileTextIcon}
			loading={isLoading}
			skeletonVariant="list"
			title="recent-journals"
		>
			{excerpts.length === 0 ? (
				<WidgetEmptyState
					icon={FileTextIcon}
					message="No recent journal entries"
				/>
			) : (
				<div className="flex h-full flex-col gap-2">
					{excerpts.map((entry) => (
						<Link
							className={cn(
								"group rounded border border-border/50 bg-muted/50 p-3",
								"transition-all hover:border-primary/20 hover:bg-muted",
							)}
							href={`/daily-journal?date=${entry.date}`}
							key={entry.date}
						>
							{/* Header: Date and P&L */}
							<div className="mb-1 flex items-center justify-between">
								<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									{formatJournalDate(entry.date)}
								</span>
								{entry.tradeCount > 0 && (
									<span
										className={cn(
											"rounded px-1.5 py-0.5 font-mono text-[10px]",
											entry.pnl >= 0
												? "bg-profit/10 text-profit"
												: "bg-loss/10 text-loss",
										)}
									>
										{formatCurrency(entry.pnl)}
									</span>
								)}
							</div>

							{/* Excerpt */}
							<p className="line-clamp-2 font-mono text-[11px] text-foreground/80">
								{entry.excerpt || "No content..."}
							</p>

							{/* Read more link */}
							<span className="mt-1 inline-block font-mono text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
								Read more →
							</span>
						</Link>
					))}
				</div>
			)}
		</DashboardWidget>
	);
}
