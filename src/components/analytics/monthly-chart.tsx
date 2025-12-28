import { useMemo } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface MonthData {
	month: string; // YYYY-MM format
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	avgPnl: number;
}

interface MonthlyChartProps {
	data: MonthData[];
	className?: string;
}

/**
 * Format month string (YYYY-MM) to display format (Jan '24)
 */
function formatMonth(monthStr: string): string {
	const [year, month] = monthStr.split("-");
	if (!year || !month) return monthStr;

	const monthNames = [
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
	const monthIndex = parseInt(month, 10) - 1;
	const monthName = monthNames[monthIndex] ?? month;

	return `${monthName} '${year.slice(-2)}`;
}

/**
 * Terminal-styled monthly performance chart with cumulative line
 */
export function MonthlyChart({ data, className }: MonthlyChartProps) {
	// Calculate stats and cumulative data
	const { stats, chartData, maxAbsPnl, maxCumulative, minCumulative } =
		useMemo(() => {
			const profitableMonths = data.filter((d) => d.pnl > 0).length;
			const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
			const avgMonthlyPnl = data.length > 0 ? totalPnl / data.length : 0;

			const bestMonth = data.reduce(
				(best, current) => (current.pnl > best.pnl ? current : best),
				data[0] ?? { month: "", pnl: -Infinity },
			);
			const worstMonth = data.reduce(
				(worst, current) => (current.pnl < worst.pnl ? current : worst),
				data[0] ?? { month: "", pnl: Infinity },
			);

			// Build cumulative data
			let cumulative = 0;
			const withCumulative = data.map((d) => {
				cumulative += d.pnl;
				return { ...d, cumulative };
			});

			const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
			const maxCum = Math.max(...withCumulative.map((d) => d.cumulative), 0);
			const minCum = Math.min(...withCumulative.map((d) => d.cumulative), 0);

			return {
				stats: {
					profitableMonths,
					totalMonths: data.length,
					avgMonthlyPnl,
					bestMonth: bestMonth.pnl > 0 ? bestMonth : null,
					worstMonth: worstMonth.pnl < 0 ? worstMonth : null,
					totalPnl,
				},
				chartData: withCumulative,
				maxAbsPnl: maxAbs,
				maxCumulative: maxCum,
				minCumulative: minCum,
			};
		}, [data]);

	if (data.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[350px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No monthly data available
			</div>
		);
	}

	// Calculate cumulative line position (percentage from bottom)
	const getCumulativeY = (cumulative: number) => {
		const range = maxCumulative - minCumulative;
		if (range === 0) return 50;
		return ((cumulative - minCumulative) / range) * 100;
	};

	return (
		<div className={cn("space-y-4", className)}>
			{/* Summary stats */}
			<div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="text-muted-foreground">Profitable</div>
					<div
						className={
							stats.profitableMonths > stats.totalMonths / 2
								? "text-profit"
								: "text-loss"
						}
					>
						{stats.profitableMonths} / {stats.totalMonths}
					</div>
				</div>
				<div className="rounded border border-border bg-secondary/30 p-2">
					<div className="text-muted-foreground">Avg Monthly</div>
					<div
						className={stats.avgMonthlyPnl >= 0 ? "text-profit" : "text-loss"}
					>
						{formatCurrency(stats.avgMonthlyPnl)}
					</div>
				</div>
				{stats.bestMonth && (
					<div className="rounded border border-profit/30 bg-profit/5 p-2">
						<div className="text-muted-foreground">Best</div>
						<div className="text-profit">
							{formatMonth(stats.bestMonth.month)}
						</div>
					</div>
				)}
				{stats.worstMonth && (
					<div className="rounded border border-loss/30 bg-loss/5 p-2">
						<div className="text-muted-foreground">Worst</div>
						<div className="text-loss">
							{formatMonth(stats.worstMonth.month)}
						</div>
					</div>
				)}
			</div>

			{/* Chart area */}
			<div className="relative h-[200px] rounded border border-border bg-secondary/20 p-4">
				{/* Zero line */}
				<div
					className="absolute right-4 left-4 border-muted-foreground/20 border-t border-dashed"
					style={{ top: `${100 - getCumulativeY(0)}%` }}
				/>

				{/* Cumulative area */}
				<svg
					aria-labelledby="cumulative-pnl-title"
					className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]"
					preserveAspectRatio="none"
					role="img"
				>
					<title id="cumulative-pnl-title">Cumulative P&L chart</title>
					{/* Area fill */}
					<defs>
						<linearGradient
							id="cumulativeGradient"
							x1="0%"
							x2="0%"
							y1="0%"
							y2="100%"
						>
							<stop
								offset="0%"
								stopColor={stats.totalPnl >= 0 ? "#00ff88" : "#ff3b3b"}
								stopOpacity="0.3"
							/>
							<stop
								offset="100%"
								stopColor={stats.totalPnl >= 0 ? "#00ff88" : "#ff3b3b"}
								stopOpacity="0.05"
							/>
						</linearGradient>
					</defs>

					{/* Area path */}
					<path
						d={`
							M 0 ${100 - getCumulativeY(0)}
							${chartData
								.map((d, i) => {
									const x = (i / (chartData.length - 1 || 1)) * 100;
									const y = 100 - getCumulativeY(d.cumulative);
									return `L ${x} ${y}`;
								})
								.join(" ")}
							L 100 ${100 - getCumulativeY(0)}
							Z
						`}
						fill="url(#cumulativeGradient)"
					/>

					{/* Line path */}
					<path
						d={chartData
							.map((d, i) => {
								const x = (i / (chartData.length - 1 || 1)) * 100;
								const y = 100 - getCumulativeY(d.cumulative);
								return `${i === 0 ? "M" : "L"} ${x} ${y}`;
							})
							.join(" ")}
						fill="none"
						stroke={stats.totalPnl >= 0 ? "#00ff88" : "#ff3b3b"}
						strokeWidth="2"
						vectorEffect="non-scaling-stroke"
					/>

					{/* Data points */}
					{chartData.map((d, i) => {
						const x = (i / (chartData.length - 1 || 1)) * 100;
						const y = 100 - getCumulativeY(d.cumulative);
						return (
							<circle
								className="drop-shadow-sm"
								cx={`${x}%`}
								cy={`${y}%`}
								fill={d.pnl >= 0 ? "#00ff88" : "#ff3b3b"}
								key={d.month}
								r="3"
							/>
						);
					})}
				</svg>

				{/* Current total label */}
				<div className="absolute top-4 right-4">
					<div className="font-mono text-[10px] text-muted-foreground">
						Cumulative
					</div>
					<div
						className={cn(
							"font-bold font-mono text-lg",
							stats.totalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{formatCurrency(stats.totalPnl)}
					</div>
				</div>
			</div>

			{/* Month bars */}
			<div className="flex items-end gap-1">
				{chartData.map((month) => {
					const barHeight = (Math.abs(month.pnl) / maxAbsPnl) * 100;
					const isProfit = month.pnl >= 0;

					return (
						<div
							className="group flex flex-1 flex-col items-center gap-1"
							key={month.month}
						>
							{/* Bar */}
							<div className="relative h-16 w-full">
								<div
									className={cn(
										"absolute right-0 bottom-0 left-0 rounded-t transition-all",
										isProfit
											? "bg-profit/60 group-hover:bg-profit"
											: "bg-loss/60 group-hover:bg-loss",
									)}
									style={{ height: `${Math.max(barHeight, 4)}%` }}
								/>
							</div>

							{/* Label */}
							<div className="font-mono text-[9px] text-muted-foreground">
								{formatMonth(month.month).split(" ")[0]}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
