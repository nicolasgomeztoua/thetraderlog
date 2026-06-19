import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	cn,
	formatCurrency,
	formatDateString,
	generateDateStringsInTimezone,
	getDayOfWeekFromDateString,
	getMonthFromDateString,
} from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";

interface CalendarDay {
	date: string;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
}

interface CalendarHeatmapProps {
	data: CalendarDay[];
	className?: string;
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Get color intensity based on P&L
 * Green for profit, red for loss, intensity based on magnitude
 */
function getPnLColor(pnl: number, maxAbsPnl: number): string {
	if (pnl === 0 || maxAbsPnl === 0) return "bg-secondary";

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
 * GitHub-style calendar heatmap for daily P&L
 */
export function CalendarHeatmap({ data, className }: CalendarHeatmapProps) {
	// Get timezone from settings store
	const tz = useSettingsStore((state) => state.timezone);
	// Create a map for quick lookup
	const dataMap = useMemo(() => {
		const map = new Map<string, CalendarDay>();
		for (const day of data) {
			map.set(day.date, day);
		}
		return map;
	}, [data]);

	// Calculate max absolute P&L for color scaling
	const maxAbsPnl = useMemo(() => {
		if (data.length === 0) return 0;
		return Math.max(...data.map((d) => Math.abs(d.pnl)));
	}, [data]);

	// Generate last 52 weeks of dates using timezone-aware string generation
	const weeks = useMemo(() => {
		// Generate 365 days of date strings (364 days back to today)
		const allDates = generateDateStringsInTimezone(-364, 0, tz);

		// Find the day of week for the first date to calculate Sunday alignment
		const firstDateDayOfWeek = getDayOfWeekFromDateString(
			allDates[0] ?? "2026-01-01",
		);

		// Calculate padding dates (days before our data starts)
		// These are dates before our 364-day window, used for week alignment
		const paddingDates = generateDateStringsInTimezone(
			-364 - firstDateDayOfWeek,
			-365,
			tz,
		);

		const result: string[][] = [];
		let currentWeek: string[] = [];

		// Add padding dates for alignment to Sunday (if first date isn't Sunday)
		for (const padDate of paddingDates) {
			currentWeek.push(padDate);
		}

		for (const dateStr of allDates) {
			currentWeek.push(dateStr);

			if (currentWeek.length === 7) {
				result.push(currentWeek);
				currentWeek = [];
			}
		}

		// Add remaining days
		if (currentWeek.length > 0) {
			result.push(currentWeek);
		}

		return result;
	}, [tz]);

	// Get month labels with their positions
	const monthLabels = useMemo(() => {
		const labels: { month: string; weekIndex: number }[] = [];
		let lastMonth = -1;

		for (let i = 0; i < weeks.length; i++) {
			const week = weeks[i];
			if (!week || week.length === 0) continue;

			// Use the first non-empty day of the week to determine month
			const firstDay = week.find((d) => d !== "");
			if (!firstDay) continue;

			const month = getMonthFromDateString(firstDay);
			if (month !== lastMonth) {
				const monthName = MONTHS[month];
				if (monthName) {
					labels.push({ month: monthName, weekIndex: i });
				}
				lastMonth = month;
			}
		}

		return labels;
	}, [weeks]);

	// Calculate totals
	const totals = useMemo(() => {
		let totalPnl = 0;
		let totalTrades = 0;
		let tradingDays = 0;

		for (const day of data) {
			totalPnl += day.pnl;
			totalTrades += day.trades;
			tradingDays++;
		}

		return { totalPnl, totalTrades, tradingDays };
	}, [data]);

	if (weeks.length === 0) {
		return (
			<div className="flex h-[180px] items-center justify-center font-mono text-muted-foreground text-xs">
				No data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary stats */}
			<div className="flex flex-wrap gap-3 font-mono text-xs sm:gap-6">
				<div>
					<span className="text-muted-foreground">Trading Days:</span>{" "}
					<span className="text-foreground">{totals.tradingDays}</span>
				</div>
				<div>
					<span className="text-muted-foreground">Total Trades:</span>{" "}
					<span className="text-foreground">{totals.totalTrades}</span>
				</div>
				<div>
					<span className="text-muted-foreground">Net P&L:</span>{" "}
					<span className={totals.totalPnl >= 0 ? "text-profit" : "text-loss"}>
						{formatCurrency(totals.totalPnl)}
					</span>
				</div>
			</div>

			{/* Calendar grid */}
			<div className="overflow-x-auto">
				<div className="inline-block min-w-full">
					{/* Month labels */}
					<div className="mb-1 flex">
						<div className="w-8" /> {/* Spacer for day labels */}
						<div className="relative flex flex-1">
							{monthLabels.map(({ month, weekIndex }) => (
								<div
									className="absolute font-mono text-[10px] text-muted-foreground"
									key={`${month}-${weekIndex}`}
									style={{ left: `${weekIndex * 14}px` }}
								>
									{month}
								</div>
							))}
						</div>
					</div>

					{/* Grid with day labels */}
					<div className="flex">
						{/* Day labels */}
						<div className="mr-1 flex w-7 flex-col gap-[3px]">
							{DAYS.map((day, i) => (
								<div
									className={cn(
										"h-3 font-mono text-[9px] text-muted-foreground",
										i % 2 === 0 ? "opacity-100" : "opacity-0",
									)}
									key={day}
								>
									{day}
								</div>
							))}
						</div>

						{/* Weeks grid */}
						<div className="flex gap-[3px]">
							{weeks.map((week, weekIndex) => {
								// Use first non-empty day of week for unique key
								const firstDayKey =
									week.find((d) => d !== "") ?? `w${weekIndex}`;
								return (
									<div
										className="flex flex-col gap-[3px]"
										key={`week-${firstDayKey}`}
										style={{
											contentVisibility: "auto",
											containIntrinsicSize: "12px 102px",
										}}
									>
										{week.map((dateStr) => {
											// Use date string directly to match backend format
											const dayData = dataMap.get(dateStr);
											const hasTrades = dayData && dayData.trades > 0;

											return (
												<Tooltip key={dateStr}>
													<TooltipTrigger asChild>
														<div
															className={cn(
																"h-3 w-3 rounded-sm transition-colors",
																hasTrades
																	? getPnLColor(dayData.pnl, maxAbsPnl)
																	: "bg-secondary/50",
																"hover:ring-1 hover:ring-primary/50",
															)}
														/>
													</TooltipTrigger>
													<TooltipContent
														className="border border-border bg-card p-2 text-foreground"
														side="top"
													>
														<div className="font-mono text-xs">
															<div className="mb-1 text-muted-foreground">
																{formatDateString(dateStr, "EEE, MMM d, yyyy")}
															</div>
															{hasTrades ? (
																<>
																	<div
																		className={
																			dayData.pnl >= 0
																				? "text-profit"
																				: "text-loss"
																		}
																	>
																		P&L: {formatCurrency(dayData.pnl)}
																	</div>
																	<div className="text-muted-foreground">
																		{dayData.trades} trade
																		{dayData.trades !== 1 ? "s" : ""} (
																		{dayData.wins}W / {dayData.losses}L)
																	</div>
																</>
															) : (
																<div className="text-muted-foreground">
																	No trades
																</div>
															)}
														</div>
													</TooltipContent>
												</Tooltip>
											);
										})}
									</div>
								);
							})}
						</div>
					</div>

					{/* Legend */}
					<div className="mt-3 flex items-center gap-2">
						<span className="font-mono text-[10px] text-muted-foreground">
							Less
						</span>
						<div className="flex gap-0.5">
							<div className="h-2.5 w-2.5 rounded-sm bg-loss/80" />
							<div className="h-2.5 w-2.5 rounded-sm bg-loss/40" />
							<div className="h-2.5 w-2.5 rounded-sm bg-secondary" />
							<div className="h-2.5 w-2.5 rounded-sm bg-profit/40" />
							<div className="h-2.5 w-2.5 rounded-sm bg-profit/80" />
						</div>
						<span className="font-mono text-[10px] text-muted-foreground">
							More
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
