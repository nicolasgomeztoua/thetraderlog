"use client";

import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	format,
	getDay,
	isSameDay,
	isSameMonth,
	isToday,
	startOfMonth,
	subMonths,
} from "date-fns";
import {
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FlameIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency, getDateStringInTimezone } from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/trpc/react";

interface CalendarSidebarProps {
	selectedDate: Date;
	onDateSelect: (date: Date) => void;
	className?: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Get color class based on P&L
 */
function getPnLColorClass(pnl: number, maxAbsPnl: number): string {
	if (pnl === 0 || maxAbsPnl === 0) return "";

	const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);

	if (pnl > 0) {
		// Profit: green shades
		if (intensity < 0.25) return "bg-profit/20";
		if (intensity < 0.5) return "bg-profit/40";
		if (intensity < 0.75) return "bg-profit/60";
		return "bg-profit/80";
	}
	// Loss: red shades
	if (intensity < 0.25) return "bg-loss/20";
	if (intensity < 0.5) return "bg-loss/40";
	if (intensity < 0.75) return "bg-loss/60";
	return "bg-loss/80";
}

/**
 * Calendar sidebar with month view, P&L colors, and journal indicators
 */
export function CalendarSidebar({
	selectedDate,
	onDateSelect,
	className,
}: CalendarSidebarProps) {
	// Month being displayed (independent of selectedDate)
	const [displayMonth, setDisplayMonth] = useState<Date>(() => selectedDate);

	// Get timezone from settings store
	const timezone = useSettingsStore((state) => state.timezone);

	// Calculate start and end of the displayed month
	const monthStart = startOfMonth(displayMonth);
	const monthEnd = endOfMonth(displayMonth);

	// Fetch P&L data for the displayed month
	const { data: calendarData } = api.analytics.getCalendarData.useQuery(
		undefined,
		{
			// Refetch when month changes
			staleTime: 1000 * 60 * 5, // 5 minutes
		},
	);

	// Fetch journal data for the displayed month
	const { data: journalData } = api.dailyJournal.getRange.useQuery({
		startDate: monthStart.toISOString(),
		endDate: monthEnd.toISOString(),
	});

	// Fetch journaling streak
	const { data: streakData } = api.dailyJournal.getStreak.useQuery();

	// Fetch compliance stats for the displayed month
	const { data: complianceData } = api.dailyJournal.getComplianceStats.useQuery(
		{
			startDate: monthStart.toISOString(),
			endDate: monthEnd.toISOString(),
		},
	);

	// Create lookup maps
	const pnlMap = useMemo(() => {
		const map = new Map<string, { pnl: number; trades: number }>();
		if (!calendarData) return map;
		for (const day of calendarData) {
			map.set(day.date, { pnl: day.pnl, trades: day.trades });
		}
		return map;
	}, [calendarData]);

	const journalMap = useMemo(() => {
		const map = new Map<string, boolean>();
		if (!journalData) return map;
		for (const journal of journalData) {
			// Convert journal date to YYYY-MM-DD string
			const dateStr = format(new Date(journal.date), "yyyy-MM-dd");
			map.set(dateStr, journal.hasContent);
		}
		return map;
	}, [journalData]);

	// Calculate max absolute P&L for color scaling (from visible month only)
	const maxAbsPnl = useMemo(() => {
		if (!calendarData) return 0;

		// Filter to only the displayed month's data
		const monthStartStr = format(monthStart, "yyyy-MM-dd");
		const monthEndStr = format(monthEnd, "yyyy-MM-dd");

		const monthData = calendarData.filter(
			(d) => d.date >= monthStartStr && d.date <= monthEndStr,
		);

		if (monthData.length === 0) return 0;
		return Math.max(...monthData.map((d) => Math.abs(d.pnl)));
	}, [calendarData, monthStart, monthEnd]);

	// Generate days of the month with padding for week alignment
	const calendarDays = useMemo(() => {
		const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

		// Get the day of week the month starts on (0 = Sunday)
		const startDayOfWeek = getDay(monthStart);

		// Add null padding for days before month starts
		const padding: null[] = Array(startDayOfWeek).fill(null);

		return [...padding, ...days];
	}, [monthStart, monthEnd]);

	// Split into weeks with stable keys
	const weeks = useMemo(() => {
		const result: { key: string; days: (Date | null)[] }[] = [];
		for (let i = 0; i < calendarDays.length; i += 7) {
			const week = calendarDays.slice(i, i + 7);
			// Pad last week if needed
			while (week.length < 7) {
				week.push(null);
			}
			// Use the first non-null day for key, or week index as fallback
			const firstDay = week.find((d) => d !== null);
			const key = firstDay
				? format(firstDay, "yyyy-MM-dd")
				: `week-${result.length}`;
			result.push({ key, days: week });
		}
		return result;
	}, [calendarDays]);

	// Navigation handlers
	const handlePreviousMonth = () => {
		setDisplayMonth((prev) => subMonths(prev, 1));
	};

	const handleNextMonth = () => {
		setDisplayMonth((prev) => addMonths(prev, 1));
	};

	const handleTodayClick = () => {
		const today = new Date();
		setDisplayMonth(today);
		onDateSelect(today);
	};

	return (
		<div className={cn("space-y-3", className)}>
			{/* Month header with navigation */}
			<div className="flex items-center justify-between">
				<Button
					aria-label="Previous month"
					onClick={handlePreviousMonth}
					size="icon-sm"
					variant="ghost"
				>
					<ChevronLeftIcon className="size-4" />
				</Button>

				<button
					className="font-mono text-sm uppercase tracking-wider hover:text-primary"
					onClick={handleTodayClick}
					type="button"
				>
					{format(displayMonth, "MMMM yyyy")}
				</button>

				<Button
					aria-label="Next month"
					onClick={handleNextMonth}
					size="icon-sm"
					variant="ghost"
				>
					<ChevronRightIcon className="size-4" />
				</Button>
			</div>

			{/* Day labels */}
			<div className="grid grid-cols-7 gap-1">
				{DAY_LABELS.map((day) => (
					<div
						className="py-1 text-center font-mono text-[10px] text-muted-foreground uppercase"
						key={day}
					>
						{day.slice(0, 2)}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div className="space-y-1">
				{weeks.map((week) => (
					<div className="grid grid-cols-7 gap-1" key={week.key}>
						{week.days.map((day, dayIndex) => {
							if (!day) {
								// Use week key + position for stable empty day keys
								return (
									<div
										className="aspect-square"
										key={`${week.key}-empty-${dayIndex}`}
									/>
								);
							}

							// Get date string for lookups
							const dateStr = getDateStringInTimezone(day, timezone);
							const pnlData = pnlMap.get(dateStr);
							const hasJournal = journalMap.get(dateStr) ?? false;

							const isSelected = isSameDay(day, selectedDate);
							const isCurrentMonth = isSameMonth(day, displayMonth);
							const isTodayDate = isToday(day);
							const hasTrades = pnlData && pnlData.trades > 0;

							// Determine background color
							const pnlColorClass = hasTrades
								? getPnLColorClass(pnlData.pnl, maxAbsPnl)
								: "";

							return (
								<Tooltip key={dateStr}>
									<TooltipTrigger asChild>
										<button
											className={cn(
												"relative flex aspect-square items-center justify-center rounded-sm font-mono text-xs transition-all",
												// Base styling
												isCurrentMonth
													? "text-foreground"
													: "text-muted-foreground/50",
												// P&L background color
												pnlColorClass,
												// No trades - subtle background
												!hasTrades && "hover:bg-white/5",
												// Today indicator
												isTodayDate && !isSelected && "ring-1 ring-primary/50",
												// Selected state
												isSelected &&
													"bg-primary text-primary-foreground ring-2 ring-primary",
												// Hover state for days with trades
												hasTrades &&
													!isSelected &&
													"hover:ring-1 hover:ring-white/30",
											)}
											onClick={() => onDateSelect(day)}
											type="button"
										>
											{format(day, "d")}

											{/* Journal indicator dot */}
											{hasJournal && (
												<span
													className={cn(
														"absolute right-0.5 bottom-0.5 size-1.5 rounded-full",
														isSelected ? "bg-primary-foreground" : "bg-primary",
													)}
												/>
											)}
										</button>
									</TooltipTrigger>
									<TooltipContent
										className="border border-border bg-card p-2 text-foreground"
										side="top"
									>
										<div className="font-mono text-xs">
											<div className="mb-1 text-muted-foreground">
												{format(day, "EEE, MMM d, yyyy")}
											</div>
											{hasTrades ? (
												<div
													className={
														pnlData.pnl >= 0 ? "text-profit" : "text-loss"
													}
												>
													P&L: {formatCurrency(pnlData.pnl)} ({pnlData.trades}{" "}
													trade{pnlData.trades !== 1 ? "s" : ""})
												</div>
											) : (
												<div className="text-muted-foreground">No trades</div>
											)}
											{hasJournal && (
												<div className="mt-1 text-primary">
													Has journal entry
												</div>
											)}
										</div>
									</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				))}
			</div>

			{/* Legend */}
			<div className="flex items-center justify-between border-border border-t pt-3">
				<div className="flex items-center gap-1.5">
					<span className="font-mono text-[10px] text-muted-foreground">
						Loss
					</span>
					<div className="flex gap-[2px]">
						<div className="size-2.5 rounded-sm bg-loss/80" />
						<div className="size-2.5 rounded-sm bg-loss/40" />
						<div className="size-2.5 rounded-sm bg-secondary/50" />
						<div className="size-2.5 rounded-sm bg-profit/40" />
						<div className="size-2.5 rounded-sm bg-profit/80" />
					</div>
					<span className="font-mono text-[10px] text-muted-foreground">
						Profit
					</span>
				</div>

				<div className="flex items-center gap-1">
					<span className="size-1.5 rounded-full bg-primary" />
					<span className="font-mono text-[10px] text-muted-foreground">
						Journal
					</span>
				</div>
			</div>

			{/* Streak and Compliance Stats */}
			<div className="flex items-center justify-between border-border border-t pt-3">
				{/* Journaling Streak */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<FlameIcon
								className={cn(
									"size-4",
									streakData?.streak && streakData.streak > 0
										? "text-orange-500"
										: "text-muted-foreground",
								)}
							/>
							<span className="font-mono text-sm">
								{streakData?.streak ?? 0}
							</span>
							<span className="font-mono text-[10px] text-muted-foreground uppercase">
								day{(streakData?.streak ?? 0) !== 1 ? "s" : ""}
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent
						className="border border-border bg-card p-2 text-foreground"
						side="top"
					>
						<div className="font-mono text-xs">
							<div className="mb-1">Journaling Streak</div>
							<div className="text-muted-foreground">
								{(streakData?.streak ?? 0) > 0
									? `${streakData?.streak} consecutive day${(streakData?.streak ?? 0) !== 1 ? "s" : ""} with journal entries`
									: "Start journaling to build your streak!"}
							</div>
						</div>
					</TooltipContent>
				</Tooltip>

				{/* Monthly Compliance */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<CheckCircle2Icon
								className={cn(
									"size-4",
									complianceData?.averageCompliance !== null &&
										complianceData?.averageCompliance !== undefined
										? complianceData.averageCompliance >= 75
											? "text-profit"
											: complianceData.averageCompliance >= 50
												? "text-primary"
												: "text-muted-foreground"
										: "text-muted-foreground",
								)}
							/>
							<span className="font-mono text-sm">
								{complianceData?.averageCompliance !== null &&
								complianceData?.averageCompliance !== undefined
									? `${Math.round(complianceData.averageCompliance)}%`
									: "—"}
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent
						className="border border-border bg-card p-2 text-foreground"
						side="top"
					>
						<div className="font-mono text-xs">
							<div className="mb-1">
								{format(displayMonth, "MMMM")} Checklist Compliance
							</div>
							<div className="text-muted-foreground">
								{complianceData?.averageCompliance !== null &&
								complianceData?.averageCompliance !== undefined
									? `${Math.round(complianceData.averageCompliance)}% average compliance across ${complianceData.totalDays} day${complianceData.totalDays !== 1 ? "s" : ""}`
									: "No checklist data for this month"}
							</div>
						</div>
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
