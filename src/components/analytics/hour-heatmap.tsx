import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";

interface HourData {
	hour: number;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	avgPnl: number;
}

interface HourHeatmapProps {
	data: HourData[];
	className?: string;
}

/**
 * Get color based on P&L intensity
 */
function getPnLColor(pnl: number, maxAbsPnl: number): string {
	if (pnl === 0 || maxAbsPnl === 0) return "bg-secondary";

	const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);

	if (pnl > 0) {
		if (intensity < 0.25) return "bg-profit/20";
		if (intensity < 0.5) return "bg-profit/40";
		if (intensity < 0.75) return "bg-profit/60";
		return "bg-profit/80";
	}
	if (intensity < 0.25) return "bg-loss/20";
	if (intensity < 0.5) return "bg-loss/40";
	if (intensity < 0.75) return "bg-loss/60";
	return "bg-loss/80";
}

/**
 * Format hour for display (12-hour format)
 */
function formatHour(hour: number): string {
	if (hour === 0) return "12am";
	if (hour === 12) return "12pm";
	if (hour < 12) return `${hour}am`;
	return `${hour - 12}pm`;
}

/**
 * 24-hour grid showing performance by hour of day
 */
export function HourHeatmap({ data, className }: HourHeatmapProps) {
	// Get timezone abbreviation from settings store
	const timezoneAbbr = useSettingsStore((state) => state.timezoneAbbr);
	const maxAbsPnl = useMemo(() => {
		if (data.length === 0) return 0;
		return Math.max(...data.map((d) => Math.abs(d.pnl)));
	}, [data]);

	// Find best and worst hours
	const { bestHour, worstHour } = useMemo(() => {
		const withTrades = data.filter((d) => d.trades > 0);
		if (withTrades.length === 0) return { bestHour: null, worstHour: null };

		const sorted = [...withTrades].sort((a, b) => b.pnl - a.pnl);
		const best = sorted[0];
		const worst = sorted[sorted.length - 1];

		return {
			bestHour: best && best.pnl > 0 ? best : null,
			worstHour: worst && worst.pnl < 0 ? worst : null,
		};
	}, [data]);

	const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);

	if (totalTrades === 0) {
		return (
			<div
				className={cn(
					"flex h-[180px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No trade data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Best/Worst indicators */}
			<div className="flex flex-wrap gap-3 font-mono text-xs sm:gap-4">
				{bestHour && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Best Hour:</span>
						<span className="text-profit">
							{formatHour(bestHour.hour)} ({formatCurrency(bestHour.pnl)})
						</span>
					</div>
				)}
				{worstHour && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Worst Hour:</span>
						<span className="text-loss">
							{formatHour(worstHour.hour)} ({formatCurrency(worstHour.pnl)})
						</span>
					</div>
				)}
			</div>

			{/* 24-hour grid - 2 rows of 12, scrollable on mobile */}
			<div className="space-y-4 overflow-x-auto">
				{/* AM Hours (0-11) */}
				<div className="min-w-[320px]">
					<div className="mb-2 font-mono text-[10px] text-muted-foreground">
						AM ({timezoneAbbr})
					</div>
					<div className="grid grid-cols-12 gap-1">
						{data.slice(0, 12).map((hourData) => (
							<Tooltip key={hourData.hour}>
								<TooltipTrigger asChild>
									<div className="flex flex-col items-center gap-1">
										<div
											className={cn(
												"h-8 w-full min-w-[24px] rounded transition-colors",
												hourData.trades > 0
													? getPnLColor(hourData.pnl, maxAbsPnl)
													: "bg-secondary/30",
												"hover:ring-1 hover:ring-primary/50",
											)}
										/>
										<span className="font-mono text-[9px] text-muted-foreground">
											{hourData.hour}
										</span>
									</div>
								</TooltipTrigger>
								<TooltipContent
									className="border border-border bg-card p-2 text-foreground"
									side="top"
								>
									<div className="font-mono text-xs">
										<div className="mb-1 font-medium">
											{formatHour(hourData.hour)} {timezoneAbbr}
										</div>
										{hourData.trades > 0 ? (
											<>
												<div
													className={
														hourData.pnl >= 0 ? "text-profit" : "text-loss"
													}
												>
													P&L: {formatCurrency(hourData.pnl)}
												</div>
												<div className="text-muted-foreground">
													{hourData.trades} trades
												</div>
												<div className="text-muted-foreground">
													Win rate: {hourData.winRate.toFixed(1)}%
												</div>
												<div className="text-muted-foreground">
													Avg: {formatCurrency(hourData.avgPnl)}
												</div>
											</>
										) : (
											<div className="text-muted-foreground">No trades</div>
										)}
									</div>
								</TooltipContent>
							</Tooltip>
						))}
					</div>
				</div>

				{/* PM Hours (12-23) */}
				<div className="min-w-[320px]">
					<div className="mb-2 font-mono text-[10px] text-muted-foreground">
						PM ({timezoneAbbr})
					</div>
					<div className="grid grid-cols-12 gap-1">
						{data.slice(12, 24).map((hourData) => (
							<Tooltip key={hourData.hour}>
								<TooltipTrigger asChild>
									<div className="flex flex-col items-center gap-1">
										<div
											className={cn(
												"h-8 w-full min-w-[24px] rounded transition-colors",
												hourData.trades > 0
													? getPnLColor(hourData.pnl, maxAbsPnl)
													: "bg-secondary/30",
												"hover:ring-1 hover:ring-primary/50",
											)}
										/>
										<span className="font-mono text-[9px] text-muted-foreground">
											{hourData.hour}
										</span>
									</div>
								</TooltipTrigger>
								<TooltipContent
									className="border border-border bg-card p-2 text-foreground"
									side="top"
								>
									<div className="font-mono text-xs">
										<div className="mb-1 font-medium">
											{formatHour(hourData.hour)} {timezoneAbbr}
										</div>
										{hourData.trades > 0 ? (
											<>
												<div
													className={
														hourData.pnl >= 0 ? "text-profit" : "text-loss"
													}
												>
													P&L: {formatCurrency(hourData.pnl)}
												</div>
												<div className="text-muted-foreground">
													{hourData.trades} trades
												</div>
												<div className="text-muted-foreground">
													Win rate: {hourData.winRate.toFixed(1)}%
												</div>
												<div className="text-muted-foreground">
													Avg: {formatCurrency(hourData.avgPnl)}
												</div>
											</>
										) : (
											<div className="text-muted-foreground">No trades</div>
										)}
									</div>
								</TooltipContent>
							</Tooltip>
						))}
					</div>
				</div>
			</div>

			{/* Legend */}
			<div className="flex items-center gap-2">
				<span className="font-mono text-[10px] text-muted-foreground">
					Loss
				</span>
				<div className="flex gap-[2px]">
					<div className="h-[10px] w-[10px] rounded-sm bg-loss/80" />
					<div className="h-[10px] w-[10px] rounded-sm bg-loss/40" />
					<div className="h-[10px] w-[10px] rounded-sm bg-secondary" />
					<div className="h-[10px] w-[10px] rounded-sm bg-profit/40" />
					<div className="h-[10px] w-[10px] rounded-sm bg-profit/80" />
				</div>
				<span className="font-mono text-[10px] text-muted-foreground">
					Profit
				</span>
			</div>
		</div>
	);
}
