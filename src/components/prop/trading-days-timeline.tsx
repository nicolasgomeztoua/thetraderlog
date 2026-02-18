"use client";

import { useMemo } from "react";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface TradingDaysData {
	daysTraded: number;
	minRequired: number;
	remaining: number;
	dates: string[];
}

interface TimelineData {
	startDate: Date | string | null;
	endDate: Date | string | null;
	daysRemaining: number | null;
	daysElapsed: number | null;
}

interface TradingDaysTimelineProps {
	tradingDays: TradingDaysData;
	timeline: TimelineData;
	className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Get the day-of-week index (0=Sun, 6=Sat) for a YYYY-MM-DD string */
function getDayOfWeek(dateStr: string): number {
	const parts = dateStr.split("-").map(Number);
	const y = parts[0] ?? 0;
	const m = parts[1] ?? 1;
	const d = parts[2] ?? 1;
	return new Date(y, m - 1, d).getDay();
}

/** Generate all YYYY-MM-DD strings between two dates (inclusive) */
function generateDateRange(start: Date, end: Date): string[] {
	const dates: string[] = [];
	const current = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate(),
	);
	const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

	while (current <= endDay) {
		const yyyy = current.getFullYear();
		const mm = String(current.getMonth() + 1).padStart(2, "0");
		const dd = String(current.getDate()).padStart(2, "0");
		dates.push(`${yyyy}-${mm}-${dd}`);
		current.setDate(current.getDate() + 1);
	}
	return dates;
}

/** Parse a date value that may be Date, string, or null */
function parseDate(value: Date | string | null): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

// =============================================================================
// CALENDAR GRID
// =============================================================================

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarGrid({
	dates,
	tradingDates,
	startDate,
}: {
	dates: string[];
	tradingDates: Set<string>;
	startDate: string;
}) {
	// Compute padding for week alignment
	const startDow = getDayOfWeek(startDate);

	// Build week rows
	const cells = useMemo(() => {
		const padding: (string | null)[] = Array(startDow).fill(null);
		return [...padding, ...dates];
	}, [dates, startDow]);

	const weeks = useMemo(() => {
		const result: (string | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) {
			result.push(cells.slice(i, i + 7));
		}
		return result;
	}, [cells]);

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

	return (
		<div data-testid="trading-days-calendar">
			{/* Day of week headers */}
			<div className="mb-1 grid grid-cols-7 gap-0.5">
				{DAY_LABELS.map((label, i) => (
					<div
						className="text-center font-mono text-[8px] text-muted-foreground/50 uppercase"
						key={`dow-${i.toString()}`}
					>
						{label}
					</div>
				))}
			</div>

			{/* Calendar cells */}
			<div className="grid gap-0.5">
				{weeks.map((week, wi) => (
					<div
						className="grid grid-cols-7 gap-0.5"
						key={`week-${wi.toString()}`}
					>
						{week.map((dateStr, di) => {
							if (!dateStr) {
								return (
									<div
										className="h-3 w-full"
										key={`pad-${wi}-${di.toString()}`}
									/>
								);
							}

							const isTraded = tradingDates.has(dateStr);
							const isToday = dateStr === todayStr;
							const isPast = dateStr < todayStr;

							return (
								<div
									className={cn(
										"h-3 w-full rounded-sm transition-colors",
										isTraded
											? "bg-profit/60"
											: isPast
												? "bg-white/5"
												: "bg-white/2",
										isToday && "ring-1 ring-primary/40",
									)}
									key={dateStr}
									title={`${dateStr}${isTraded ? " — Traded" : ""}`}
								/>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// PACE INDICATOR
// =============================================================================

function PaceIndicator({
	daysTraded,
	minRequired,
	daysElapsed,
	totalDays,
}: {
	daysTraded: number;
	minRequired: number;
	daysElapsed: number;
	totalDays: number;
}) {
	if (minRequired === 0 || totalDays === 0) return null;

	// Expected days traded by now to be on pace
	const expectedPace = (daysElapsed / totalDays) * minRequired;
	const isOnPace = daysTraded >= expectedPace;
	const pacePercent =
		expectedPace > 0
			? Math.round((daysTraded / expectedPace) * 100)
			: daysTraded > 0
				? 100
				: 0;

	return (
		<div className="flex items-center gap-2" data-testid="trading-days-pace">
			<span
				className={cn(
					"inline-block h-1.5 w-1.5 rounded-full",
					isOnPace ? "bg-profit" : "bg-loss",
				)}
			/>
			<span
				className={cn(
					"font-mono text-[10px]",
					isOnPace ? "text-profit" : "text-loss",
				)}
			>
				{isOnPace ? "On pace" : "Behind pace"} ({pacePercent}%)
			</span>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Trading Days Timeline — shows days traded vs minimum required,
 * a calendar grid highlighting active trading days, and a countdown
 * to the challenge deadline.
 */
export function TradingDaysTimeline({
	tradingDays,
	timeline,
	className,
}: TradingDaysTimelineProps) {
	const startDate = parseDate(timeline.startDate);
	const endDate = parseDate(timeline.endDate);

	const { allDates, tradingDatesSet, totalDays } = useMemo(() => {
		const tradingSet = new Set(tradingDays.dates);

		if (!startDate || !endDate) {
			return { allDates: [], tradingDatesSet: tradingSet, totalDays: 0 };
		}

		const range = generateDateRange(startDate, endDate);
		const total = range.length;

		return { allDates: range, tradingDatesSet: tradingSet, totalDays: total };
	}, [tradingDays.dates, startDate, endDate]);

	// Progress bar percentage
	const progressPercent =
		tradingDays.minRequired > 0
			? Math.min((tradingDays.daysTraded / tradingDays.minRequired) * 100, 100)
			: tradingDays.daysTraded > 0
				? 100
				: 0;

	const isComplete = tradingDays.remaining <= 0;

	return (
		<div
			className={cn("rounded border border-white/5 bg-white/1 p-4", className)}
			data-testid="trading-days-timeline"
		>
			{/* Header */}
			<div className="mb-3 flex items-center justify-between">
				<div>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Trading Days
					</span>
					<h3 className="font-mono font-semibold text-sm">
						Progress & Timeline
					</h3>
				</div>
				{timeline.daysRemaining !== null && (
					<div className="text-right" data-testid="trading-days-countdown">
						<div
							className={cn(
								"font-mono font-semibold text-lg",
								timeline.daysRemaining <= 5
									? "text-loss"
									: timeline.daysRemaining <= 14
										? "text-primary"
										: "text-muted-foreground",
							)}
						>
							{timeline.daysRemaining}
						</div>
						<span className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">
							Days Left
						</span>
					</div>
				)}
			</div>

			{/* Days traded progress */}
			<div className="mb-4">
				<div className="mb-1.5 flex items-baseline justify-between">
					<span
						className={cn(
							"font-mono font-semibold text-2xl",
							isComplete ? "text-profit" : "text-foreground",
						)}
						data-testid="trading-days-count"
					>
						{tradingDays.daysTraded}
						<span className="font-normal text-muted-foreground text-sm">
							{" "}
							/ {tradingDays.minRequired}
						</span>
					</span>
					{tradingDays.remaining > 0 && (
						<span className="font-mono text-[10px] text-muted-foreground">
							{tradingDays.remaining} more needed
						</span>
					)}
					{isComplete && (
						<span className="font-mono text-[10px] text-profit">
							Requirement met
						</span>
					)}
				</div>

				{/* Progress bar */}
				<div className="h-1.5 overflow-hidden rounded bg-white/5">
					<div
						className={cn(
							"h-full transition-all duration-300",
							isComplete ? "bg-profit" : "bg-primary",
						)}
						data-testid="trading-days-progress-bar"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			</div>

			{/* Pace indicator */}
			{timeline.daysElapsed !== null &&
				totalDays > 0 &&
				tradingDays.minRequired > 0 &&
				!isComplete && (
					<div className="mb-4">
						<PaceIndicator
							daysElapsed={timeline.daysElapsed}
							daysTraded={tradingDays.daysTraded}
							minRequired={tradingDays.minRequired}
							totalDays={totalDays}
						/>
					</div>
				)}

			{/* Calendar grid */}
			{allDates.length > 0 && startDate && (
				<div className="mb-3">
					<div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Activity
					</div>
					<CalendarGrid
						dates={allDates}
						startDate={allDates[0] ?? ""}
						tradingDates={tradingDatesSet}
					/>
				</div>
			)}

			{/* Timeline footer stats */}
			<div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
				{startDate && (
					<div className="rounded border border-white/5 bg-white/2 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Start
						</div>
						<div>
							{startDate.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							})}
						</div>
					</div>
				)}
				{endDate && (
					<div className="rounded border border-white/5 bg-white/2 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							End
						</div>
						<div>
							{endDate.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							})}
						</div>
					</div>
				)}
				{timeline.daysElapsed !== null && (
					<div className="rounded border border-white/5 bg-white/2 p-2">
						<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
							Elapsed
						</div>
						<div>{timeline.daysElapsed} days</div>
					</div>
				)}
				<div className="rounded border border-white/5 bg-white/2 p-2">
					<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
						Traded
					</div>
					<div>{tradingDays.daysTraded} days</div>
				</div>
			</div>
		</div>
	);
}
