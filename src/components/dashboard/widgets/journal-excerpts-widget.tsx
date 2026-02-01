"use client";

import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatCurrency,
	getLastNDaysRange,
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

	// Fetch actual journal content for these dates using getRange
	// Note: getRange returns content in query but strips it in the return
	// So we'll fetch getByDate for each - this is acceptable for just 3 entries
	const date1Query = api.dailyJournal.getByDate.useQuery(
		{ date: recentJournalDates[0]?.date ?? "" },
		{ enabled: recentJournalDates.length >= 1, staleTime: 60000 },
	);
	const date2Query = api.dailyJournal.getByDate.useQuery(
		{ date: recentJournalDates[1]?.date ?? "" },
		{ enabled: recentJournalDates.length >= 2, staleTime: 60000 },
	);
	const date3Query = api.dailyJournal.getByDate.useQuery(
		{ date: recentJournalDates[2]?.date ?? "" },
		{ enabled: recentJournalDates.length >= 3, staleTime: 60000 },
	);

	const isLoading =
		adjacencyLoading ||
		(recentJournalDates.length >= 1 && date1Query.isLoading) ||
		(recentJournalDates.length >= 2 && date2Query.isLoading) ||
		(recentJournalDates.length >= 3 && date3Query.isLoading);

	// Combine adjacency data with journal content
	const excerpts: JournalExcerpt[] = useMemo(() => {
		const result: JournalExcerpt[] = [];
		const queries = [date1Query, date2Query, date3Query];

		for (let i = 0; i < recentJournalDates.length; i++) {
			const dayData = recentJournalDates[i];
			const journalData = queries[i]?.data;

			if (dayData && journalData) {
				result.push({
					date: dayData.date,
					excerpt: getExcerpt(journalData.content, 100),
					pnl: dayData.pnl,
					tradeCount: dayData.tradeCount,
				});
			}
		}

		return result;
	}, [
		recentJournalDates,
		date1Query.data,
		date2Query.data,
		date3Query.data,
		date3Query,
		date1Query,
		date2Query,
	]);

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
								"group rounded border border-white/5 bg-white/2 p-3",
								"transition-all hover:border-primary/20 hover:bg-white/5",
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
