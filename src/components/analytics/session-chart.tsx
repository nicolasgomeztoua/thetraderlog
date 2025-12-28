import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import { type TradingSession, useSettingsStore } from "@/stores/settings-store";

interface SessionData {
	session: string;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	avgPnl: number;
	color?: string; // Custom color from user settings
}

interface SessionChartProps {
	data: SessionData[];
	className?: string;
}

/**
 * Format a UTC hour to local time in the user's timezone
 * @param utcHour - Hour in UTC (0-23)
 * @param timezone - User's timezone (e.g., "America/New_York")
 * @returns Formatted time string (e.g., "19:00")
 */
function formatUtcHourInTimezone(utcHour: number, timezone: string): string {
	// Create a date at that UTC hour (using today's date for DST accuracy)
	const date = new Date();
	date.setUTCHours(utcHour, 0, 0, 0);

	// Format in user's timezone
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: timezone,
		hour12: false,
	});
}

/**
 * Get time range display string for a session in user's timezone
 */
function getSessionTimeRange(
	session: TradingSession,
	timezone: string,
	timezoneAbbr: string,
): string {
	const startTime = formatUtcHourInTimezone(session.startHour, timezone);
	const endTime = formatUtcHourInTimezone(session.endHour, timezone);
	return `${startTime} - ${endTime} ${timezoneAbbr}`;
}

/**
 * Terminal-styled session performance cards
 */
export function SessionChart({ data, className }: SessionChartProps) {
	// Get settings from store
	const tradingSessions = useSettingsStore((state) => state.tradingSessions);
	const timezone = useSettingsStore((state) => state.timezone);
	const timezoneAbbr = useSettingsStore((state) => state.timezoneAbbr);

	// Create a map of session name -> session config for lookups
	const sessionConfigMap = useMemo(() => {
		const map = new Map<string, TradingSession>();
		for (const session of tradingSessions) {
			map.set(session.name, session);
		}
		return map;
	}, [tradingSessions]);

	// Find best session and max P&L for scaling
	const { bestSession, maxAbsPnl } = useMemo(() => {
		const withTrades = data.filter((d) => d.trades > 0);
		if (withTrades.length === 0) return { bestSession: null, maxAbsPnl: 1 };

		const best = withTrades.reduce((b, c) => (c.pnl > b.pnl ? c : b));
		const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)));

		return {
			bestSession: best.pnl > 0 ? best : null,
			maxAbsPnl: maxAbs > 0 ? maxAbs : 1,
		};
	}, [data]);

	const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);

	if (totalTrades === 0) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No trade data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Session cards */}
			<div className="grid gap-3">
				{data.map((session) => {
					// Get session config from store (for color and time range)
					const sessionConfig = sessionConfigMap.get(session.session);
					const barWidth = Math.abs(session.pnl) / maxAbsPnl;
					const isProfit = session.pnl >= 0;
					const isBest = bestSession?.session === session.session;

					// Get time range in user's timezone
					const timeRange = sessionConfig
						? getSessionTimeRange(sessionConfig, timezone, timezoneAbbr)
						: "";

					return (
						<div
							className={cn(
								"group relative overflow-hidden rounded border border-border bg-card p-4 transition-all",
								"hover:border-primary/30",
								isBest && "border-profit/50 ring-1 ring-profit/20",
							)}
							key={session.session}
						>
							{/* Glow effect for best session */}
							{isBest && (
								<div className="absolute inset-0 bg-gradient-to-r from-profit/5 to-transparent" />
							)}

							<div className="relative flex items-start justify-between">
								{/* Left side: Session info */}
								<div className="space-y-3">
									{/* Header */}
									<div className="flex items-center gap-2">
										<div
											className="h-3 w-3 rounded-full"
											style={{
												backgroundColor:
													session.color ?? sessionConfig?.color ?? "#6366f1",
											}}
										/>
										<span className="font-medium text-sm">
											{session.session}
										</span>
										{isBest && (
											<span className="rounded bg-profit/20 px-1.5 py-0.5 font-mono text-[10px] text-profit">
												BEST
											</span>
										)}
									</div>

									{/* Time range in user's timezone */}
									<div className="font-mono text-[10px] text-muted-foreground">
										{timeRange}
									</div>

									{/* Progress bar */}
									<div className="h-2 w-48 overflow-hidden rounded-full bg-secondary">
										<div
											className={cn(
												"h-full rounded-full transition-all duration-700",
												isProfit ? "bg-profit" : "bg-loss",
											)}
											style={{
												width: `${barWidth * 100}%`,
											}}
										/>
									</div>
								</div>

								{/* Right side: Stats */}
								<div className="text-right">
									{/* P&L - Large */}
									<div
										className={cn(
											"font-bold font-mono text-2xl tabular-nums",
											isProfit ? "text-profit" : "text-loss",
										)}
									>
										{formatCurrency(session.pnl)}
									</div>

									{/* Secondary stats */}
									<div className="mt-2 space-y-1 font-mono text-xs">
										<div className="flex items-center justify-end gap-2">
											<span className="text-muted-foreground">Trades</span>
											<span className="w-8 text-right tabular-nums">
												{session.trades}
											</span>
										</div>
										<div className="flex items-center justify-end gap-2">
											<span className="text-muted-foreground">Win Rate</span>
											<span
												className={cn(
													"w-8 text-right tabular-nums",
													session.winRate >= 50 ? "text-profit" : "text-loss",
												)}
											>
												{session.trades > 0
													? `${session.winRate.toFixed(0)}%`
													: "—"}
											</span>
										</div>
										<div className="flex items-center justify-end gap-2">
											<span className="text-muted-foreground">Avg</span>
											<span
												className={cn(
													"w-16 text-right tabular-nums",
													session.avgPnl >= 0
														? "text-profit/70"
														: "text-loss/70",
												)}
											>
												{session.trades > 0
													? formatCurrency(session.avgPnl)
													: "—"}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Settings hint */}
			<div className="flex items-center justify-end">
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
							href="/settings?tab=trading"
						>
							<Settings2 className="h-3 w-3" />
							<span>Configure sessions</span>
						</Link>
					</TooltipTrigger>
					<TooltipContent
						className="border border-border bg-card p-2 text-foreground"
						side="top"
					>
						<p className="font-mono text-xs">
							Customize trading session times in Settings
						</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
