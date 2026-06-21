"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatPnL,
	getEndOfMonth,
	getPnLColorClass,
	getStartOfMonth,
	toDateString,
} from "@/lib/shared";
import { api } from "@/trpc/react";
import { DashboardWidget } from "../dashboard-widget";

const DAY_LABELS = [
	{ key: "sun", label: "S" },
	{ key: "mon", label: "M" },
	{ key: "tue", label: "T" },
	{ key: "wed", label: "W" },
	{ key: "thu", label: "T" },
	{ key: "fri", label: "F" },
	{ key: "sat", label: "S" },
];
const MONTH_ABBREVS = [
	"JAN",
	"FEB",
	"MAR",
	"APR",
	"MAY",
	"JUN",
	"JUL",
	"AUG",
	"SEP",
	"OCT",
	"NOV",
	"DEC",
];

interface DayData {
	date: string;
	hasTrades: boolean;
	tradeCount: number;
	pnl: number;
}

/**
 * P&L Calendar Widget for the Command Center dashboard.
 *
 * Shows:
 * - Full month calendar grid with date, trade count, and P&L per cell
 * - TODAY badge on current day
 * - Month navigation
 * - Summary stats for displayed month
 * - Links to daily journal for each day
 */
export function PnLCalendarWidget() {
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

	// Fetch journal adjacency data (has P&L per day)
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

	// Calculate stats for the current month only
	const monthStats = useMemo(() => {
		if (!data) return { totalPnl: 0, tradingDays: 0, totalTrades: 0 };

		const monthStr = toDateString(currentMonth).substring(0, 7);
		const monthData = data.filter(
			(d) => d.date.startsWith(monthStr) && d.hasTrades,
		);

		return {
			totalPnl: monthData.reduce((sum, d) => sum + d.pnl, 0),
			tradingDays: monthData.length,
			totalTrades: monthData.reduce((sum, d) => sum + d.tradeCount, 0),
		};
	}, [data, currentMonth]);

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
		month: "long",
		year: "numeric",
	});

	return (
		<DashboardWidget
			data-testid="widget-pnl-calendar"
			href="/daily-journal"
			icon={CalendarIcon}
			loading={isLoading}
			skeletonVariant="calendar"
			title="pnl-calendar"
		>
			<div className="flex h-full flex-col">
				{/* Month navigation - touch-friendly buttons */}
				<div className="mb-3 flex items-center justify-between">
					<Button
						className="h-11 w-11 sm:h-7 sm:w-7"
						onClick={handlePrevMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronLeftIcon className="h-4 w-4" />
					</Button>
					<span className="font-mono text-sm">{monthLabel}</span>
					<Button
						className="h-11 w-11 sm:h-7 sm:w-7"
						disabled={isCurrentMonth}
						onClick={handleNextMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronRightIcon className="h-4 w-4" />
					</Button>
				</div>

				{/* Calendar grid - hidden on mobile, shown on sm+ */}
				<div className="hidden flex-1 flex-col sm:flex">
					{/* Day labels */}
					<div className="grid grid-cols-7 border-border border-t border-l">
						{DAY_LABELS.map((day) => (
							<div
								className="border-border border-r border-b py-1 text-center font-mono text-[9px] text-muted-foreground"
								key={day.key}
							>
								{day.label}
							</div>
						))}
					</div>

					{/* Calendar days - grid rows fill available height */}
					<div
						className="grid flex-1 grid-cols-7 border-border border-l"
						style={{
							gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, 1fr)`,
						}}
					>
						{calendarDays.map((dateStr) => {
							const day = dayDataMap.get(dateStr);
							const today = toDateString(new Date());
							const isFuture = dateStr > today;
							const isToday = dateStr === today;
							const isCurrentMonthDay =
								dateStr.substring(0, 7) ===
								toDateString(currentMonth).substring(0, 7);

							const dateParts = dateStr.split("-");
							const monthIdx = Number.parseInt(dateParts[1] ?? "1", 10) - 1;
							const dayNum = Number.parseInt(dateParts[2] ?? "1", 10);
							const monthAbbrev = MONTH_ABBREVS[monthIdx] ?? "JAN";

							return (
								<Link
									className={cn(
										"flex flex-col justify-between border-border border-r border-b p-1.5 transition-colors hover:bg-muted",
										!isCurrentMonthDay && "opacity-40",
										isFuture && "opacity-30",
									)}
									href={`/daily-journal?date=${dateStr}`}
									key={dateStr}
								>
									{/* Top: Date + TODAY badge */}
									<div className="flex items-center gap-1">
										<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide">
											{monthAbbrev}
										</span>
										<span className="font-medium font-mono text-[11px]">
											{dayNum}
										</span>
										{isToday && (
											<span className="rounded bg-primary/20 px-1 font-mono text-[7px] text-primary">
												TODAY
											</span>
										)}
									</div>

									{/* Bottom: Trade data (only if has trades) */}
									{day?.hasTrades && !isFuture && (
										<div className="mt-auto">
											<div className="font-mono text-[8px] text-muted-foreground">
												{day.tradeCount} Trade{day.tradeCount !== 1 && "s"}
											</div>
											<div
												className={cn(
													"font-mono font-semibold text-[10px]",
													getPnLColorClass(day.pnl),
												)}
											>
												{formatPnL(day.pnl)}
											</div>
										</div>
									)}
								</Link>
							);
						})}
					</div>
				</div>

				{/* Mobile: 2-column calendar grid */}
				<div className="-mx-4 max-h-[400px] flex-1 overflow-y-auto sm:hidden">
					<div className="grid grid-cols-2 border-border border-t border-l">
						{calendarDays
							.filter((dateStr) => {
								// Only show days from current month on mobile
								return (
									dateStr.substring(0, 7) ===
									toDateString(currentMonth).substring(0, 7)
								);
							})
							.map((dateStr) => {
								const day = dayDataMap.get(dateStr);
								const today = toDateString(new Date());
								const isFuture = dateStr > today;
								const isToday = dateStr === today;

								const dateParts = dateStr.split("-");
								const dayNum = Number.parseInt(dateParts[2] ?? "1", 10);

								return (
									<Link
										className={cn(
											"flex flex-col justify-between border-border border-r border-b p-3",
											isToday && "bg-primary/5",
											isFuture && "opacity-40",
										)}
										href={`/daily-journal?date=${dateStr}`}
										key={dateStr}
									>
										{/* Day number */}
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"font-medium font-mono text-lg",
													isToday && "text-primary",
												)}
											>
												{dayNum}
											</span>
											{isToday && (
												<span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary">
													TODAY
												</span>
											)}
										</div>

										{/* Trade data */}
										{day?.hasTrades && !isFuture ? (
											<div className="mt-2">
												<div className="font-mono text-muted-foreground text-xs">
													{day.tradeCount} Trade{day.tradeCount !== 1 && "s"}
												</div>
												<div
													className={cn(
														"font-mono font-semibold text-sm",
														getPnLColorClass(day.pnl),
													)}
												>
													{formatPnL(day.pnl)}
												</div>
											</div>
										) : (
											<div className="mt-2 h-9.5" />
										)}
									</Link>
								);
							})}
					</div>
				</div>

				{/* Summary row - desktop only */}
				<div className="mt-3 hidden items-center justify-between border-border/50 border-t pt-3 sm:flex">
					<div className="text-center">
						<div
							className={cn(
								"font-mono font-semibold",
								getPnLColorClass(monthStats.totalPnl),
							)}
						>
							{formatPnL(monthStats.totalPnl)}
						</div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
							P&L
						</div>
					</div>
					<div className="text-center">
						<div className="font-mono font-semibold">
							{monthStats.tradingDays}
						</div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
							Days
						</div>
					</div>
					<div className="text-center">
						<div className="font-mono font-semibold">
							{monthStats.totalTrades}
						</div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
							Trades
						</div>
					</div>
				</div>
			</div>
		</DashboardWidget>
	);
}
