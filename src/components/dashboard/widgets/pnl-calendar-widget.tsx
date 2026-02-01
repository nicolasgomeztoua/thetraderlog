"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
}

// Get heatmap color based on P&L value and intensity
function getPnLHeatmapColor(pnl: number, maxAbsPnl: number): string {
	if (pnl === 0) return "bg-breakeven/20";

	// Calculate intensity (0-1)
	const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);

	if (pnl > 0) {
		// Profit colors: from light to dark green
		if (intensity < 0.25) return "bg-profit/20";
		if (intensity < 0.5) return "bg-profit/40";
		if (intensity < 0.75) return "bg-profit/60";
		return "bg-profit/80";
	}
	// Loss colors: from light to dark red
	if (intensity < 0.25) return "bg-loss/20";
	if (intensity < 0.5) return "bg-loss/40";
	if (intensity < 0.75) return "bg-loss/60";
	return "bg-loss/80";
}

/**
 * P&L Calendar Widget for the Command Center dashboard.
 *
 * Shows:
 * - Full month calendar heatmap
 * - Color intensity based on P&L magnitude
 * - Hover tooltips with date, P&L, trade count
 * - Month navigation
 * - Summary stats for displayed month
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

	// Calculate max absolute P&L for intensity scaling
	const maxAbsPnl = useMemo(() => {
		if (!data) return 1000;
		const pnlValues = data
			.filter((d) => d.hasTrades)
			.map((d) => Math.abs(d.pnl));
		return Math.max(...pnlValues, 100); // Minimum of 100 to avoid division issues
	}, [data]);

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
			href="/analytics?tab=time"
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
				<div className="hidden flex-1 sm:block">
					{/* Day labels */}
					<div className="mb-1 grid grid-cols-7 gap-1">
						{DAY_LABELS.map((day) => (
							<div
								className="text-center font-mono text-[9px] text-muted-foreground"
								key={day}
							>
								{day}
							</div>
						))}
					</div>

					{/* Calendar days */}
					<div className="grid grid-cols-7 gap-1">
						{calendarDays.map((dateStr) => {
							const day = dayDataMap.get(dateStr);
							const today = toDateString(new Date());
							const isFuture = dateStr > today;
							const isToday = dateStr === today;
							const isCurrentMonthDay =
								dateStr.substring(0, 7) ===
								toDateString(currentMonth).substring(0, 7);

							const dayNum = Number.parseInt(dateStr.split("-")[2] ?? "1", 10);

							// Determine background color
							let bgColor = "bg-white/5";
							if (day?.hasTrades && !isFuture) {
								bgColor = getPnLHeatmapColor(day.pnl, maxAbsPnl);
							}

							return (
								<Tooltip key={dateStr}>
									<TooltipTrigger asChild>
										<Link
											className={cn(
												"relative flex aspect-square items-center justify-center rounded text-[10px] transition-all",
												bgColor,
												!isCurrentMonthDay && "opacity-40",
												isFuture && "opacity-30",
												isToday && "ring-1 ring-primary",
												!isFuture &&
													day?.hasTrades &&
													"hover:ring-1 hover:ring-white/30",
											)}
											href={`/analytics?tab=time&date=${dateStr}`}
										>
											<span
												className={cn(
													"font-mono",
													day?.hasTrades && !isFuture && day.pnl !== 0
														? "font-semibold text-white"
														: "text-muted-foreground",
												)}
											>
												{dayNum}
											</span>
										</Link>
									</TooltipTrigger>
									{!isFuture && day?.hasTrades && (
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
												<div
													className={day.pnl >= 0 ? "text-profit" : "text-loss"}
												>
													{formatCurrency(day.pnl)}
												</div>
												<div className="text-muted-foreground">
													{day.tradeCount} trade{day.tradeCount !== 1 && "s"}
												</div>
											</div>
										</TooltipContent>
									)}
								</Tooltip>
							);
						})}
					</div>
				</div>

				{/* Mobile: Compact summary view (replaces calendar grid) */}
				<div className="flex-1 sm:hidden">
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<div
								className={cn(
									"font-bold font-mono text-2xl",
									monthStats.totalPnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(monthStats.totalPnl)}
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Month P&L
							</div>
						</div>
						<div>
							<div className="font-bold font-mono text-2xl">
								{monthStats.tradingDays}
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Trading Days
							</div>
						</div>
						<div>
							<div className="font-bold font-mono text-2xl">
								{monthStats.totalTrades}
							</div>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Total Trades
							</div>
						</div>
					</div>
					{/* Mobile legend */}
					<div className="mt-4 flex items-center justify-center gap-1">
						<div className="h-3 w-3 rounded bg-loss/80" />
						<div className="h-3 w-3 rounded bg-loss/40" />
						<div className="h-3 w-3 rounded bg-white/10" />
						<div className="h-3 w-3 rounded bg-profit/40" />
						<div className="h-3 w-3 rounded bg-profit/80" />
						<span className="ml-2 font-mono text-muted-foreground text-xs">
							Loss → Profit
						</span>
					</div>
				</div>

				{/* Summary row - desktop only */}
				<div className="mt-3 hidden items-center justify-between border-white/5 border-t pt-3 sm:flex">
					<div className="text-center">
						<div
							className={cn(
								"font-mono font-semibold",
								monthStats.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{formatCurrency(monthStats.totalPnl)}
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

				{/* Legend - desktop only */}
				<div className="mt-2 hidden items-center justify-center gap-1 sm:flex">
					<div className="h-2 w-2 rounded bg-loss/80" />
					<div className="h-2 w-2 rounded bg-loss/40" />
					<div className="h-2 w-2 rounded bg-white/10" />
					<div className="h-2 w-2 rounded bg-profit/40" />
					<div className="h-2 w-2 rounded bg-profit/80" />
					<span className="ml-1 font-mono text-[8px] text-muted-foreground">
						Loss → Profit
					</span>
				</div>
			</div>
		</DashboardWidget>
	);
}
