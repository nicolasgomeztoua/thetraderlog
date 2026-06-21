"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/account-context";
import {
	cn,
	formatCurrency,
	formatPnL,
	getEndOfMonth,
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
const WEEKDAY_ABBREVS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface DayData {
	date: string;
	hasTrades: boolean;
	tradeCount: number;
	pnl: number;
}

/** Mobile list item: a single day row, or a collapsed run of no-trade days. */
type MobileItem =
	| { type: "day"; dateStr: string }
	| { type: "gap"; from: string; to: string; count: number };

/** Format a stored "YYYY-MM-DD" as "MON DD". */
function formatShortDate(dateStr: string): string {
	const parts = dateStr.split("-");
	const monthIdx = Number.parseInt(parts[1] ?? "1", 10) - 1;
	const dayNum = Number.parseInt(parts[2] ?? "1", 10);
	return `${MONTH_ABBREVS[monthIdx] ?? "JAN"} ${dayNum}`;
}

/**
 * P&L Calendar Widget for the Command Center dashboard — "Heat Wall Ledger".
 *
 * A magnitude-scaled color-mass grid: each trading day is an intensity-tinted
 * tile with a loud hero P&L and solid sign-colored accent bar, empty days
 * recede into obsidian negative space, and the month reads as a green-vs-red
 * battlefield at a glance. All dynamic tints use color-mix on theme tokens so
 * they recolor correctly across every theme.
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

	// Calculate stats + heat data for the current month only
	const monthStats = useMemo(() => {
		const empty = {
			totalPnl: 0,
			tradingDays: 0,
			totalTrades: 0,
			monthMaxAbs: 1,
			greenDays: 0,
			redDays: 0,
			breakevenDays: 0,
			greenPct: 0,
			bestDay: null as { dateStr: string; pnl: number } | null,
			worstDay: null as { dateStr: string; pnl: number } | null,
		};
		if (!data) return empty;

		const monthStr = toDateString(currentMonth).substring(0, 7);
		const monthData = data.filter(
			(d) => d.date.startsWith(monthStr) && d.hasTrades,
		);
		if (monthData.length === 0) return empty;

		let greenDays = 0;
		let redDays = 0;
		let breakevenDays = 0;
		let bestDay: { dateStr: string; pnl: number } | null = null;
		let worstDay: { dateStr: string; pnl: number } | null = null;

		for (const d of monthData) {
			if (d.pnl > 0) greenDays++;
			else if (d.pnl < 0) redDays++;
			else breakevenDays++;
			if (d.pnl > 0 && (!bestDay || d.pnl > bestDay.pnl)) {
				bestDay = { dateStr: d.date, pnl: d.pnl };
			}
			if (d.pnl < 0 && (!worstDay || d.pnl < worstDay.pnl)) {
				worstDay = { dateStr: d.date, pnl: d.pnl };
			}
		}

		const decided = greenDays + redDays;

		return {
			totalPnl: monthData.reduce((sum, d) => sum + d.pnl, 0),
			tradingDays: monthData.length,
			totalTrades: monthData.reduce((sum, d) => sum + d.tradeCount, 0),
			monthMaxAbs: Math.max(1, ...monthData.map((d) => Math.abs(d.pnl))),
			greenDays,
			redDays,
			breakevenDays,
			greenPct: decided === 0 ? 0 : (greenDays / decided) * 100,
			bestDay,
			worstDay,
		};
	}, [data, currentMonth]);

	// Chunk calendar days into week rows + derive per-week net P&L (for WK column)
	const weeks = useMemo(() => {
		const monthStr = toDateString(currentMonth).substring(0, 7);
		const rows: {
			days: string[];
			weekNet: number;
			weekHasTrades: boolean;
		}[] = [];
		for (let i = 0; i < calendarDays.length; i += 7) {
			const days = calendarDays.slice(i, i + 7);
			let weekNet = 0;
			let weekHasTrades = false;
			for (const dateStr of days) {
				if (!dateStr.startsWith(monthStr)) continue;
				const d = dayDataMap.get(dateStr);
				if (d?.hasTrades) {
					weekNet += d.pnl;
					weekHasTrades = true;
				}
			}
			rows.push({ days, weekNet, weekHasTrades });
		}
		const weekMaxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.weekNet)));
		return { rows, weekMaxAbs };
	}, [calendarDays, dayDataMap, currentMonth]);

	// Theme-safe dynamic intensity tint (color-mix on theme tokens, never hardcoded rgb)
	const tileBg = (pnl: number) => {
		const t = Math.sqrt(Math.min(Math.abs(pnl) / monthStats.monthMaxAbs, 1));
		const fillPct = Math.round((0.1 + 0.42 * t) * 100); // 10–52
		if (pnl > 0)
			return `color-mix(in srgb, var(--profit) ${fillPct}%, transparent)`;
		if (pnl < 0)
			return `color-mix(in srgb, var(--loss) ${fillPct}%, transparent)`;
		return `color-mix(in srgb, var(--breakeven) ${Math.round(fillPct * 0.7)}%, transparent)`;
	};

	// Signed, compact form for the tight WK column ("+$1.5k", "-$72"). The sign
	// is explicit so weekly direction survives without relying on color alone.
	const abbrevCurrency = (x: number) => {
		const sign = x > 0 ? "+" : x < 0 ? "-" : "";
		const abs = Math.abs(x);
		return abs >= 1000
			? `${sign}$${(abs / 1000).toFixed(1)}k`
			: `${sign}$${Math.round(abs)}`;
	};

	const dateStampColor = (opacity: number) =>
		`color-mix(in srgb, var(--foreground) ${opacity}%, transparent)`;

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

	const today = toDateString(new Date());
	const monthStr = toDateString(currentMonth).substring(0, 7);
	const pos = monthStats.totalPnl >= 0;
	const { bestDay, worstDay, greenDays, redDays, greenPct, tradingDays } =
		monthStats;
	const decidedDays = greenDays + redDays;
	const isEmptyMonth = tradingDays === 0;

	// Mobile list: trading days + today get their own row; consecutive no-trade
	// days collapse into a single dim "gap" divider so the list never feels empty.
	const mobileItems: MobileItem[] = [];
	for (const dateStr of calendarDays) {
		if (!dateStr.startsWith(monthStr)) continue;
		const day = dayDataMap.get(dateStr);
		const isFutureDay = dateStr > today;
		const keepAsRow = (!!day?.hasTrades && !isFutureDay) || dateStr === today;
		if (keepAsRow) {
			mobileItems.push({ type: "day", dateStr });
		} else {
			const last = mobileItems[mobileItems.length - 1];
			if (last && last.type === "gap") {
				last.to = dateStr;
				last.count += 1;
			} else {
				mobileItems.push({ type: "gap", from: dateStr, to: dateStr, count: 1 });
			}
		}
	}

	// Shared desktop tile renderer (used for the 7 day cells of each week row)
	const renderDesktopDay = (dateStr: string) => {
		const day = dayDataMap.get(dateStr);
		const isFuture = dateStr > today;
		const isToday = dateStr === today;
		const isCurrentMonthDay = dateStr.startsWith(monthStr);

		const dateParts = dateStr.split("-");
		const monthIdx = Number.parseInt(dateParts[1] ?? "1", 10) - 1;
		const dayNum = Number.parseInt(dateParts[2] ?? "1", 10);
		const monthAbbrev = MONTH_ABBREVS[monthIdx] ?? "JAN";

		const isTrading = !!day?.hasTrades && !isFuture;
		// bestDay/worstDay are already scoped to the viewed month, so the ring
		// must show on whatever month is on screen — not only the live month.
		const isBest = bestDay?.dateStr === dateStr;
		const isWorst = worstDay?.dateStr === dateStr;
		const pnl = day?.pnl ?? 0;

		// Compose a single boxShadow string (today wins outright).
		let boxShadow: string | undefined;
		const style: React.CSSProperties = {};

		if (isTrading) {
			style.backgroundColor = tileBg(pnl);
			const win = pnl > 0;
			const t = Math.sqrt(Math.min(Math.abs(pnl) / monthStats.monthMaxAbs, 1));
			const glow =
				t > 0.55
					? `0 0 ${Math.round(8 + 10 * t)}px color-mix(in srgb, var(--${
							win ? "profit" : "loss"
						}) ${Math.round((0.1 + 0.18 * t) * 100)}%, transparent)`
					: null;

			if (isToday) {
				boxShadow =
					"0 0 0 1px color-mix(in srgb, var(--primary) 70%, transparent), 0 0 10px 1px color-mix(in srgb, var(--primary) 20%, transparent)";
			} else if (isBest) {
				const ring =
					"0 0 0 1px color-mix(in srgb, var(--profit) 60%, transparent), 0 0 14px 2px color-mix(in srgb, var(--profit) 28%, transparent)";
				boxShadow = glow ? `${ring}, ${glow}` : ring;
			} else if (isWorst) {
				const ring =
					"0 0 0 1px color-mix(in srgb, var(--loss) 60%, transparent), 0 0 14px 2px color-mix(in srgb, var(--loss) 25%, transparent)";
				boxShadow = glow ? `${ring}, ${glow}` : ring;
			} else if (glow) {
				boxShadow = glow;
			}
		} else if (isToday) {
			boxShadow =
				"0 0 0 1px color-mix(in srgb, var(--primary) 70%, transparent), 0 0 10px 1px color-mix(in srgb, var(--primary) 20%, transparent)";
		}
		if (boxShadow) style.boxShadow = boxShadow;

		// Background/opacity class by tile state precedence.
		let stateClass: string;
		if (!isCurrentMonthDay) stateClass = "bg-transparent opacity-40";
		else if (isFuture) stateClass = "bg-card opacity-30";
		else if (isTrading)
			stateClass =
				"motion-safe:hover:-translate-y-px motion-safe:hover:brightness-110";
		else stateClass = "bg-card hover:bg-muted/40";

		const abbrevOpacity = !isCurrentMonthDay
			? 20
			: isFuture
				? 25
				: isTrading
					? 65
					: 38;
		const dayNumOpacity = !isCurrentMonthDay
			? 20
			: isFuture
				? 25
				: isTrading
					? 85
					: 38;

		return (
			<Link
				className={cn(
					"group relative flex flex-col justify-between p-2 transition-all duration-150 hover:z-10",
					stateClass,
				)}
				href={`/daily-journal?date=${dateStr}`}
				key={dateStr}
				style={style}
			>
				{/* Sign accent / recede marker */}
				{isTrading ? (
					<span
						className={cn(
							"absolute inset-y-0 left-0 w-[3px]",
							pnl > 0 ? "bg-profit" : pnl < 0 ? "bg-loss" : "bg-breakeven",
						)}
					/>
				) : isCurrentMonthDay && !isFuture ? (
					<span
						className="absolute inset-y-0 left-0 border-l border-dashed"
						style={{
							borderColor: "color-mix(in srgb, var(--border) 60%, transparent)",
						}}
					/>
				) : null}

				{/* TODAY dot */}
				{isToday && (
					<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
				)}

				{/* Date stamp */}
				<div className="flex items-center gap-1">
					<span
						className="font-mono text-[10px] uppercase tracking-wide"
						style={{ color: dateStampColor(abbrevOpacity) }}
					>
						{monthAbbrev}
					</span>
					<span
						className={cn(
							"font-medium font-mono text-[12px]",
							isToday && "font-bold text-primary",
						)}
						style={
							isToday ? undefined : { color: dateStampColor(dayNumOpacity) }
						}
					>
						{dayNum}
					</span>
				</div>

				{/* Hero P&L (trading days only) */}
				{isTrading && (
					<div className="mt-auto">
						<div
							className={cn(
								"font-bold font-mono text-[17px] tabular-nums leading-none tracking-tight",
								pnl > 0
									? "text-profit"
									: pnl < 0
										? "text-loss"
										: "text-breakeven",
							)}
						>
							{formatCurrency(pnl)}
						</div>
						<div
							className="font-mono text-[9px]"
							style={{
								color: `color-mix(in srgb, var(--${
									pnl > 0 ? "profit" : pnl < 0 ? "loss" : "breakeven"
								}) 55%, transparent)`,
							}}
						>
							{day?.tradeCount ?? 0}T
						</div>
					</div>
				)}
			</Link>
		);
	};

	const rowCount = Math.ceil(calendarDays.length / 7);

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
					<div className="flex flex-col items-center gap-0.5">
						<span className="font-mono text-sm uppercase tracking-wide">
							{monthLabel}
						</span>
						{isEmptyMonth ? (
							<span className="rounded px-1.5 py-0.5 font-bold font-mono text-[11px] text-muted-foreground">
								—
							</span>
						) : (
							<span
								className="rounded px-1.5 py-0.5 font-bold font-mono text-[11px]"
								style={{
									backgroundColor: `color-mix(in srgb, var(--${
										pos ? "profit" : "loss"
									}) 12%, transparent)`,
									color: `var(--${pos ? "profit" : "loss"})`,
									textShadow: `0 0 8px color-mix(in srgb, var(--${
										pos ? "profit" : "loss"
									}) 40%, transparent)`,
								}}
							>
								{formatPnL(monthStats.totalPnl)}
							</span>
						)}
					</div>
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

				{/* Desktop heat wall - hidden on mobile, shown on sm+ */}
				<div className="hidden flex-1 flex-col sm:flex">
					{/* Day labels (+ WK label at lg) */}
					<div className="grid grid-cols-7 gap-px bg-border lg:grid-cols-[repeat(7,1fr)_72px]">
						{DAY_LABELS.map((d) => (
							<div
								className="bg-card py-1 text-center font-mono text-[9px] text-muted-foreground"
								key={d.key}
							>
								{d.label}
							</div>
						))}
						<div className="hidden bg-card py-1 text-center font-mono text-[9px] text-muted-foreground lg:block">
							WK
						</div>
					</div>

					{/* The wall - continuous-mass grid over an obsidian frame */}
					<div
						className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-[4px] bg-border lg:grid-cols-[repeat(7,1fr)_72px]"
						style={{
							gridTemplateRows: `repeat(${rowCount}, 1fr)`,
						}}
					>
						{weeks.rows.map((week) => {
							const weekKey = week.days[0] ?? "week";
							return [
								...week.days.map((dateStr) => renderDesktopDay(dateStr)),
								<div
									className="hidden flex-col items-center justify-center gap-1 bg-card px-1 lg:flex"
									key={`wk-${weekKey}`}
								>
									{week.weekHasTrades ? (
										<>
											<span
												className={cn(
													"font-bold font-mono text-[11px] tabular-nums",
													week.weekNet > 0
														? "text-profit"
														: week.weekNet < 0
															? "text-loss"
															: "text-breakeven",
												)}
											>
												{abbrevCurrency(week.weekNet)}
											</span>
											<span
												className="h-[2px] rounded-full"
												style={{
													width: `${Math.max(
														8,
														(Math.abs(week.weekNet) / weeks.weekMaxAbs) * 100,
													)}%`,
													backgroundColor: `var(--${
														week.weekNet >= 0 ? "profit" : "loss"
													})`,
												}}
											/>
										</>
									) : (
										<span className="font-mono text-[11px] text-muted-foreground/40">
											—
										</span>
									)}
								</div>,
							];
						})}
					</div>
				</div>

				{/* Mobile: single-column heat-bar list; no-trade runs collapse to dividers */}
				<div className="-mx-4 max-h-[400px] flex-1 overflow-y-auto px-4 sm:hidden">
					{mobileItems.map((item) => {
						if (item.type === "gap") {
							return (
								<div
									className="my-px flex items-center gap-2 px-3 py-1 text-muted-foreground/40"
									key={`gap-${item.from}`}
								>
									<span className="h-px flex-1 bg-border" />
									<span className="shrink-0 font-mono text-[9px] uppercase tracking-wider">
										{item.count === 1
											? formatShortDate(item.from)
											: `${formatShortDate(item.from)} – ${formatShortDate(
													item.to,
												)}`}{" "}
										· no trades
									</span>
									<span className="h-px flex-1 bg-border" />
								</div>
							);
						}

						const dateStr = item.dateStr;
						const day = dayDataMap.get(dateStr);
						const isFuture = dateStr > today;
						const isToday = dateStr === today;
						const isTrading = !!day?.hasTrades && !isFuture;
						const isBest = bestDay?.dateStr === dateStr;
						const isWorst = worstDay?.dateStr === dateStr;
						const pnl = day?.pnl ?? 0;
						const isWin = pnl > 0;
						const isLoss = pnl < 0;
						const sign = isWin ? "profit" : isLoss ? "loss" : "breakeven";

						const dayNum = Number.parseInt(dateStr.split("-")[2] ?? "1", 10);
						const weekdayAbbrev =
							WEEKDAY_ABBREVS[new Date(`${dateStr}T00:00:00`).getDay()] ?? "";

						const style: React.CSSProperties = {};
						if (isTrading) style.backgroundColor = tileBg(pnl);
						if (isToday) {
							style.boxShadow =
								"0 0 0 1px color-mix(in srgb, var(--primary) 70%, transparent)";
						} else if (isBest) {
							style.boxShadow =
								"0 0 0 1px color-mix(in srgb, var(--profit) 60%, transparent), 0 0 14px 2px color-mix(in srgb, var(--profit) 28%, transparent)";
						} else if (isWorst) {
							style.boxShadow =
								"0 0 0 1px color-mix(in srgb, var(--loss) 60%, transparent), 0 0 14px 2px color-mix(in srgb, var(--loss) 25%, transparent)";
						}

						if (isTrading) {
							return (
								<Link
									className="relative my-px flex items-center justify-between overflow-hidden rounded-[3px] px-3 py-2.5 transition-all"
									href={`/daily-journal?date=${dateStr}`}
									key={dateStr}
									style={style}
								>
									<span
										className={cn(
											"absolute inset-y-0 left-0 w-[3px]",
											isWin ? "bg-profit" : isLoss ? "bg-loss" : "bg-breakeven",
										)}
									/>
									{isToday && (
										<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
									)}
									<div>
										<div
											className={cn(
												"font-mono text-xs",
												isToday && "text-primary",
											)}
										>
											{weekdayAbbrev} {dayNum}
										</div>
										<div
											className="font-mono text-[10px]"
											style={{
												color: `color-mix(in srgb, var(--${sign}) 55%, transparent)`,
											}}
										>
											{day?.tradeCount ?? 0}T
										</div>
									</div>
									<span
										className={cn(
											"font-bold font-mono text-base tabular-nums",
											isWin
												? "text-profit"
												: isLoss
													? "text-loss"
													: "text-breakeven",
										)}
									>
										{formatCurrency(pnl)}
									</span>
								</Link>
							);
						}

						// Non-trading today: a short highlighted row.
						return (
							<Link
								className="relative my-px flex min-h-[30px] items-center rounded-[3px] px-3 py-1 transition-all"
								href={`/daily-journal?date=${dateStr}`}
								key={dateStr}
								style={isToday ? style : undefined}
							>
								{isToday && (
									<span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
								)}
								<span
									className={cn(
										"font-mono text-[11px]",
										isToday ? "text-primary" : "text-muted-foreground/40",
									)}
								>
									{weekdayAbbrev} {dayNum}
								</span>
							</Link>
						);
					})}
				</div>

				{/* Footer - shared structure; desktop and mobile variants */}
				{isEmptyMonth && !isLoading ? (
					<div className="mt-3 border-border/50 border-t pt-3 text-center font-mono text-[10px] text-muted-foreground">
						No trades this month
					</div>
				) : (
					<div className="mt-3 border-border/50 border-t pt-3">
						{/* Tier 1: green/red ratio bar */}
						<div className="mb-2 flex items-center gap-2">
							<span className="font-mono text-[9px] text-profit">
								{greenDays}W
							</span>
							<div className="flex h-[6px] flex-1 overflow-hidden rounded-full bg-muted">
								<div
									className="bg-profit transition-[width] duration-300"
									style={{
										width: `${decidedDays === 0 ? 0 : greenPct}%`,
										boxShadow:
											"0 0 6px color-mix(in srgb, var(--profit) 40%, transparent)",
									}}
								/>
								<div
									className="bg-loss transition-[width] duration-300"
									style={{
										width: `${decidedDays === 0 ? 0 : 100 - greenPct}%`,
									}}
								/>
							</div>
							<span className="font-mono text-[9px] text-loss">{redDays}L</span>
						</div>

						{/* Tier 2: NET / DAYS / BEST / WORST */}
						{/* Desktop: single row */}
						<div className="hidden items-end justify-between font-mono sm:flex">
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Net
								</div>
								<div
									className={cn(
										"font-bold text-[13px]",
										pos ? "text-profit" : "text-loss",
									)}
								>
									{formatPnL(monthStats.totalPnl)}
								</div>
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Days
								</div>
								<div className="font-semibold text-[13px]">{tradingDays}</div>
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Best
								</div>
								<div className="font-semibold text-[13px] text-profit">
									{bestDay ? formatCurrency(bestDay.pnl) : "—"}
								</div>
								{bestDay && (
									<div className="text-[8px] text-muted-foreground">
										{formatShortDate(bestDay.dateStr)}
									</div>
								)}
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Worst
								</div>
								<div className="font-semibold text-[13px] text-loss">
									{worstDay ? formatCurrency(worstDay.pnl) : "—"}
								</div>
								{worstDay && (
									<div className="text-[8px] text-muted-foreground">
										{formatShortDate(worstDay.dateStr)}
									</div>
								)}
							</div>
						</div>

						{/* Mobile: 2x2 grid */}
						<div className="grid grid-cols-2 gap-2 font-mono sm:hidden">
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Net
								</div>
								<div
									className={cn(
										"font-bold text-[13px]",
										pos ? "text-profit" : "text-loss",
									)}
								>
									{formatPnL(monthStats.totalPnl)}
								</div>
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Days
								</div>
								<div className="font-semibold text-[13px]">{tradingDays}</div>
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Best
								</div>
								<div className="font-semibold text-[13px] text-profit">
									{bestDay ? formatCurrency(bestDay.pnl) : "—"}
								</div>
								{bestDay && (
									<div className="text-[8px] text-muted-foreground">
										{formatShortDate(bestDay.dateStr)}
									</div>
								)}
							</div>
							<div>
								<div className="text-[8px] text-muted-foreground uppercase tracking-wider">
									Worst
								</div>
								<div className="font-semibold text-[13px] text-loss">
									{worstDay ? formatCurrency(worstDay.pnl) : "—"}
								</div>
								{worstDay && (
									<div className="text-[8px] text-muted-foreground">
										{formatShortDate(worstDay.dateStr)}
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</DashboardWidget>
	);
}
