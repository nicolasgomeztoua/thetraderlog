"use client";

import {
	CalendarDaysIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatCurrency,
	getEndOfMonth,
	getStartOfMonth,
	toDateString,
} from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget } from "../dashboard-widget";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayData {
	date: string;
	hasTrades: boolean;
	tradeCount: number;
	pnl: number;
	hasJournal: boolean;
	journalWordCount: number;
	checklistCompletion: number;
}

type DayStatus =
	| "traded-journaled"
	| "traded-not-journaled"
	| "no-trades"
	| "future";

function getDayStatus(day: DayData | undefined, dateStr: string): DayStatus {
	const today = toDateString(new Date());
	if (dateStr > today) return "future";
	if (!day) return "no-trades";
	if (day.hasTrades && day.hasJournal) return "traded-journaled";
	if (day.hasTrades && !day.hasJournal) return "traded-not-journaled";
	return "no-trades";
}

const STATUS_STYLES: Record<
	DayStatus,
	{ bg: string; text: string; ring: string }
> = {
	"traded-journaled": {
		bg: "bg-profit/20",
		text: "text-profit",
		ring: "ring-profit/40",
	},
	"traded-not-journaled": {
		bg: "bg-loss/20",
		text: "text-loss",
		ring: "ring-loss/40",
	},
	"no-trades": {
		bg: "bg-muted",
		text: "text-muted-foreground",
		ring: "ring-white/10",
	},
	future: {
		bg: "bg-transparent",
		text: "text-muted-foreground/40",
		ring: "ring-transparent",
	},
};

function calculateStreak(data: DayData[]): number {
	const today = toDateString(new Date());
	// Sort by date descending
	const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

	let streak = 0;
	let checkDate = today;

	for (const day of sorted) {
		// Skip future dates
		if (day.date > today) continue;

		// We need consecutive trading days that were journaled
		if (day.date !== checkDate) {
			// Not consecutive - gap in dates
			// But we only break streak on trading days without journal
			if (day.hasTrades && !day.hasJournal) {
				break;
			}
			// Non-trading day, continue looking back
			continue;
		}

		if (day.hasTrades) {
			if (day.hasJournal) {
				streak++;
			} else {
				// Trading day without journal breaks streak
				break;
			}
		}

		// Move to previous day
		const prev = new Date(checkDate);
		prev.setDate(prev.getDate() - 1);
		checkDate = toDateString(prev);
	}

	return streak;
}

function calculateCompletionRate(data: DayData[]): {
	completed: number;
	total: number;
} {
	const today = toDateString(new Date());
	const tradingDays = data.filter((d) => d.hasTrades && d.date <= today);
	const journaledDays = tradingDays.filter((d) => d.hasJournal);
	return {
		completed: journaledDays.length,
		total: tradingDays.length,
	};
}

/**
 * Journal Streak Calendar Widget for the Command Center dashboard.
 *
 * Shows:
 * - Mini calendar with color-coded days (traded+journaled, traded+no journal, no trades)
 * - Current streak count
 * - Completion rate for the month
 * - Hover tooltips with day details
 * - Click to navigate to /daily-journal for that date
 */
export function JournalStreakWidget() {
	const { selectedAccountId } = useAccount();
	const [currentMonth, setCurrentMonth] = useState(() => new Date());

	// Get date range for the current month view
	const { startDate, endDate, calendarDays } = useMemo(() => {
		const monthStart = getStartOfMonth(currentMonth);
		const monthEnd = getEndOfMonth(currentMonth);

		// Get the first day of the calendar (may be in previous month)
		const calStart = new Date(monthStart);
		calStart.setDate(calStart.getDate() - calStart.getDay());

		// Get the last day of the calendar (may be in next month)
		const calEnd = new Date(monthEnd);
		const daysToAdd = 6 - calEnd.getDay();
		calEnd.setDate(calEnd.getDate() + daysToAdd);

		// Generate all calendar days
		const days: string[] = [];
		const current = new Date(calStart);
		while (current <= calEnd) {
			days.push(toDateString(current));
			current.setDate(current.getDate() + 1);
		}

		return {
			startDate: toDateString(calStart),
			endDate: toDateString(calEnd),
			calendarDays: days,
		};
	}, [currentMonth]);

	// Fetch journal adjacency data
	const { data, isLoading } = api.dailyJournal.getJournalAdjacency.useQuery(
		{
			accountId: selectedAccountId ?? undefined,
			startDate,
			endDate,
		},
		{ staleTime: 30000 },
	);

	// Create a map for quick lookup
	const dayDataMap = useMemo(() => {
		const map = new Map<string, DayData>();
		if (data) {
			for (const day of data) {
				map.set(day.date, day);
			}
		}
		return map;
	}, [data]);

	// Calculate streak and completion
	const streak = useMemo(() => (data ? calculateStreak(data) : 0), [data]);
	const completion = useMemo(
		() => (data ? calculateCompletionRate(data) : { completed: 0, total: 0 }),
		[data],
	);

	const handlePrevMonth = () => {
		setCurrentMonth((prev) => {
			const next = new Date(prev);
			next.setMonth(next.getMonth() - 1);
			return next;
		});
	};

	const handleNextMonth = () => {
		setCurrentMonth((prev) => {
			const next = new Date(prev);
			next.setMonth(next.getMonth() + 1);
			return next;
		});
	};

	const isCurrentMonth =
		currentMonth.getMonth() === new Date().getMonth() &&
		currentMonth.getFullYear() === new Date().getFullYear();

	const monthLabel = currentMonth.toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});

	return (
		<DashboardWidget
			data-testid="widget-journal-streak"
			href="/daily-journal"
			icon={CalendarDaysIcon}
			loading={isLoading}
			skeletonVariant="calendar"
			title="journal-streak"
		>
			<div className="flex h-full flex-col">
				{/* Stats row */}
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-4">
						{/* Streak */}
						<div>
							<div className="font-mono font-semibold text-lg text-profit">
								{streak}
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Day Streak
							</div>
						</div>

						<div className="h-8 w-px bg-muted/300" />

						{/* Completion */}
						<div>
							<div className="font-mono font-semibold text-lg">
								<span
									className={
										completion.total > 0 &&
										completion.completed === completion.total
											? "text-profit"
											: ""
									}
								>
									{completion.completed}
								</span>
								<span className="text-muted-foreground">
									/{completion.total}
								</span>
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Journaled
							</div>
						</div>
					</div>
				</div>

				{/* Month navigation */}
				<div className="mb-2 flex items-center justify-between">
					<Button
						className="h-6 w-6"
						onClick={handlePrevMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronLeftIcon className="h-4 w-4" />
					</Button>
					<span className="font-mono text-[11px] text-muted-foreground">
						{monthLabel}
					</span>
					<Button
						className="h-6 w-6"
						disabled={isCurrentMonth}
						onClick={handleNextMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronRightIcon className="h-4 w-4" />
					</Button>
				</div>

				{/* Calendar grid */}
				<div className="flex-1">
					{/* Day labels */}
					<div className="mb-1 grid grid-cols-7 gap-0.5">
						{DAY_LABELS.map((day) => (
							<div
								className="text-center font-mono text-[9px] text-muted-foreground"
								key={day}
							>
								{day.charAt(0)}
							</div>
						))}
					</div>

					{/* Calendar days */}
					<div className="grid grid-cols-7 gap-0.5">
						{calendarDays.map((dateStr) => {
							const day = dayDataMap.get(dateStr);
							const status = getDayStatus(day, dateStr);
							const styles = STATUS_STYLES[status];
							const dayNum = Number.parseInt(dateStr.split("-")[2] ?? "1", 10);
							const isToday = dateStr === toDateString(new Date());
							const isCurrentMonthDay =
								dateStr.substring(0, 7) ===
								toDateString(currentMonth).substring(0, 7);

							return (
								<Tooltip key={dateStr}>
									<TooltipTrigger asChild>
										<Link
											className={cn(
												"relative flex aspect-square items-center justify-center rounded text-[10px] transition-all",
												styles.bg,
												styles.text,
												!isCurrentMonthDay && "opacity-40",
												status !== "future" && "hover:ring-1",
												styles.ring,
												isToday && "ring-1 ring-primary",
											)}
											href={`/daily-journal?date=${dateStr}`}
										>
											{dayNum}
										</Link>
									</TooltipTrigger>
									{status !== "future" && (
										<TooltipContent className="font-mono text-xs">
											<div className="space-y-1">
												<div className="font-semibold">
													{new Date(`${dateStr}T12:00:00`).toLocaleDateString(
														"en-US",
														{
															weekday: "short",
															month: "short",
															day: "numeric",
														},
													)}
												</div>
												{day?.hasTrades ? (
													<>
														<div>
															{day.tradeCount} trade
															{day.tradeCount !== 1 && "s"}
														</div>
														<div
															className={
																day.pnl >= 0 ? "text-profit" : "text-loss"
															}
														>
															{formatCurrency(day.pnl)}
														</div>
														<div
															className={
																day.hasJournal ? "text-profit" : "text-loss"
															}
														>
															{day.hasJournal ? "Journaled" : "Not journaled"}
														</div>
													</>
												) : (
													<div className="text-muted-foreground">No trades</div>
												)}
											</div>
										</TooltipContent>
									)}
								</Tooltip>
							);
						})}
					</div>
				</div>

				{/* Legend */}
				<div className="mt-2 flex items-center justify-center gap-3 font-mono text-[9px] text-muted-foreground">
					<span className="flex items-center gap-1">
						<div className="h-2 w-2 rounded bg-profit/40" />
						Journaled
					</span>
					<span className="flex items-center gap-1">
						<div className="h-2 w-2 rounded bg-loss/40" />
						Missing
					</span>
					<span className="flex items-center gap-1">
						<div className="h-2 w-2 rounded bg-muted/300" />
						No trades
					</span>
				</div>
			</div>
		</DashboardWidget>
	);
}
