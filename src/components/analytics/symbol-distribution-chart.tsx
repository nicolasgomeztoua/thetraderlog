"use client";

import { AgCharts } from "ag-charts-react";
import { useMemo, useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";

interface SymbolData {
	symbol: string;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	profitFactor: number;
	avgTrade: number;
}

interface SymbolDistributionChartProps {
	data: SymbolData[];
	className?: string;
}

type ViewMode = "trades" | "pnl";

// Terminal-themed color palette for symbols
const SYMBOL_COLORS = [
	"#d4ff00", // Primary chartreuse
	"#00d4ff", // Ice blue
	"#00ff88", // Profit green
	"#ff3b3b", // Loss red
	"#fbbf24", // Amber
	"#a78bfa", // Purple
	"#f472b6", // Pink
	"#38bdf8", // Sky blue
	"#34d399", // Emerald
	"#fb923c", // Orange
];

/**
 * Donut chart showing trade distribution by symbol
 * Supports toggle between trade count and P&L views
 */
export function SymbolDistributionChart({
	data,
	className,
}: SymbolDistributionChartProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("trades");

	const chartOptions = useMemo(() => {
		if (!data || data.length === 0) return null;

		// For P&L view, we need to handle negative values
		// Show absolute values but indicate profit/loss with color
		const chartData = data.map((d, i) => ({
			symbol: d.symbol,
			value: viewMode === "trades" ? d.trades : Math.abs(d.pnl),
			actualValue: viewMode === "trades" ? d.trades : d.pnl,
			color:
				viewMode === "pnl"
					? d.pnl >= 0
						? "#00ff88"
						: "#ff3b3b"
					: SYMBOL_COLORS[i % SYMBOL_COLORS.length],
		}));

		// Sort by value descending for better visualization
		chartData.sort((a, b) => b.value - a.value);

		return {
			background: { fill: "transparent" },
			data: chartData,
			series: [
				{
					type: "donut" as const,
					angleKey: "value",
					calloutLabelKey: "symbol",
					sectorLabelKey: "value",
					fills: chartData.map((d) => d.color),
					innerRadiusRatio: 0.6,
					calloutLabel: {
						enabled: chartData.length <= 8,
						color: "#94a3b8",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 10,
					},
					sectorLabel: {
						enabled: false,
					},
					tooltip: {
						renderer: (params: {
							datum: { symbol: string; actualValue: number; value: number };
						}) => {
							const d = params.datum;
							const displayValue =
								viewMode === "trades"
									? `${d.value} trades`
									: formatCurrency(d.actualValue);
							return {
								content: `<div style="font-family: JetBrains Mono, monospace; font-size: 11px;">
									<strong>${d.symbol}</strong><br/>
									${displayValue}
								</div>`,
							};
						},
					},
					highlightStyle: {
						item: {
							fillOpacity: 0.8,
							strokeWidth: 2,
						},
					},
				},
			],
			legend: {
				position: "right" as const,
				item: {
					label: {
						color: "#94a3b8",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 10,
					},
					marker: {
						size: 10,
					},
				},
				spacing: 8,
			},
		};
	}, [data, viewMode]);

	// Calculate summary stats
	const summary = useMemo(() => {
		if (!data || data.length === 0) return null;

		const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);
		const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
		const profitableSymbols = data.filter((d) => d.pnl > 0).length;
		const topSymbol = [...data].sort((a, b) => b.trades - a.trades)[0];

		return {
			totalTrades,
			totalPnl,
			symbolCount: data.length,
			profitableSymbols,
			topSymbol: topSymbol?.symbol ?? "-",
			topSymbolTrades: topSymbol?.trades ?? 0,
		};
	}, [data]);

	if (!data || data.length === 0) {
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
			{/* View toggle */}
			<div className="flex items-center justify-between">
				<div className="flex gap-1 rounded border border-border bg-secondary/50 p-0.5">
					<button
						className={cn(
							"rounded px-3 py-1 font-mono text-[10px] transition-colors",
							viewMode === "trades"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setViewMode("trades")}
						type="button"
					>
						BY TRADES
					</button>
					<button
						className={cn(
							"rounded px-3 py-1 font-mono text-[10px] transition-colors",
							viewMode === "pnl"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setViewMode("pnl")}
						type="button"
					>
						BY P&L
					</button>
				</div>

				{/* Summary stats */}
				{summary && (
					<div className="flex gap-4 font-mono text-[10px]">
						<div className="text-muted-foreground">
							Most traded:{" "}
							<span className="text-foreground">{summary.topSymbol}</span>
						</div>
						<div className="text-muted-foreground">
							Profitable:{" "}
							<span className="text-profit">
								{summary.profitableSymbols}/{summary.symbolCount}
							</span>
						</div>
					</div>
				)}
			</div>

			{/* Chart */}
			{chartOptions && (
				// biome-ignore lint/suspicious/noExplicitAny: ag-charts has complex typing
				<AgCharts options={chartOptions as any} style={{ height: 280 }} />
			)}

			{/* Bottom stats row */}
			{summary && (
				<div className="grid grid-cols-3 gap-4 border-border border-t pt-4">
					<div className="text-center">
						<div className="font-mono text-[10px] text-muted-foreground uppercase">
							Symbols
						</div>
						<div className="font-bold font-mono text-lg tabular-nums">
							{summary.symbolCount}
						</div>
					</div>
					<div className="text-center">
						<div className="font-mono text-[10px] text-muted-foreground uppercase">
							Total Trades
						</div>
						<div className="font-bold font-mono text-lg tabular-nums">
							{summary.totalTrades}
						</div>
					</div>
					<div className="text-center">
						<div className="font-mono text-[10px] text-muted-foreground uppercase">
							Total P&L
						</div>
						<div
							className={cn(
								"font-bold font-mono text-lg tabular-nums",
								summary.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{formatCurrency(summary.totalPnl)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
