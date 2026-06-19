"use client";

import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo, useState } from "react";
import { cn, formatCurrency } from "@/lib/shared";

interface MonthData {
	month: string;
	pnl: number;
	cumulative: number;
}

interface SymbolTrendData {
	symbol: string;
	data: MonthData[];
	totalPnl: number;
}

interface SymbolTrendChartProps {
	months: string[];
	symbols: SymbolTrendData[];
	className?: string;
}

type ViewMode = "cumulative" | "monthly";

// Terminal-themed color palette for symbols
const SYMBOL_COLORS = [
	"#d4ff00", // Primary chartreuse
	"#00d4ff", // Ice blue
	"#00ff88", // Profit green
	"#fbbf24", // Amber
	"#a78bfa", // Purple
	"#f472b6", // Pink
	"#38bdf8", // Sky blue
	"#34d399", // Emerald
	"#fb923c", // Orange
	"#ff3b3b", // Loss red
];

/**
 * Line chart showing P&L trend per symbol over time
 * Supports toggle between cumulative and monthly views
 */
export function SymbolTrendChart({
	months,
	symbols,
	className,
}: SymbolTrendChartProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("cumulative");
	const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => {
		// Default to top 5 symbols by total P&L
		const topSymbols = symbols.slice(0, 5).map((s) => s.symbol);
		return new Set(topSymbols);
	});

	const toggleSymbol = (symbol: string) => {
		setSelectedSymbols((prev) => {
			const next = new Set(prev);
			if (next.has(symbol)) {
				// Don't allow deselecting all
				if (next.size > 1) {
					next.delete(symbol);
				}
			} else {
				next.add(symbol);
			}
			return next;
		});
	};

	const selectAll = () => {
		setSelectedSymbols(new Set(symbols.map((s) => s.symbol)));
	};

	const selectTopN = (n: number) => {
		setSelectedSymbols(new Set(symbols.slice(0, n).map((s) => s.symbol)));
	};

	const chartOptions: AgCartesianChartOptions<
		Record<string, string | number>
	> | null = useMemo(() => {
		if (!symbols || symbols.length === 0 || months.length === 0) return null;

		// Filter to selected symbols
		const filteredSymbols = symbols.filter((s) =>
			selectedSymbols.has(s.symbol),
		);

		// Transform data for AG Charts
		// Each month is a data point with values for each symbol
		const chartData = months.map((month) => {
			const point: Record<string, string | number> = { month };
			for (const sym of filteredSymbols) {
				const monthData = sym.data.find((d) => d.month === month);
				point[sym.symbol] =
					viewMode === "cumulative"
						? (monthData?.cumulative ?? 0)
						: (monthData?.pnl ?? 0);
			}
			return point;
		});

		// Create series for each symbol
		const series = filteredSymbols.map((sym, i) => ({
			type: "line" as const,
			xKey: "month",
			yKey: sym.symbol,
			yName: sym.symbol,
			stroke: SYMBOL_COLORS[i % SYMBOL_COLORS.length],
			strokeWidth: 2,
			marker: {
				enabled: months.length <= 12,
				size: 4,
				fill: SYMBOL_COLORS[i % SYMBOL_COLORS.length],
			},
			tooltip: {
				renderer: (params: {
					datum: Record<string, string | number>;
					xKey: string;
					yKey: string;
				}) => {
					const value = params.datum[params.yKey];
					return {
						title: String(params.yKey),
						content: `${params.datum.month}: ${formatCurrency(Number(value))}`,
					};
				},
			},
		}));

		return {
			background: { fill: "transparent" },
			data: chartData,
			series,
			axes: [
				{
					type: "category" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						rotation: months.length > 6 ? 45 : 0,
					},
					line: { stroke: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) =>
							`$${(params.value / 1000).toFixed(params.value >= 1000 ? 0 : 1)}k`,
					},
					line: { stroke: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
			],
			legend: {
				enabled: filteredSymbols.length <= 8,
				position: "bottom" as const,
				item: {
					label: {
						color: "#94a3b8",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 10,
					},
					marker: {
						size: 8,
					},
				},
			},
		};
	}, [symbols, months, selectedSymbols, viewMode]);

	if (!symbols || symbols.length === 0) {
		return (
			<div
				className={cn(
					"flex h-[300px] items-center justify-center font-mono text-muted-foreground text-xs",
					className,
				)}
			>
				No trend data available
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Controls row */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* View toggle */}
				<div className="flex gap-1 rounded border border-border bg-secondary/50 p-0.5">
					<button
						className={cn(
							"rounded px-3 py-1 font-mono text-[10px] transition-colors",
							viewMode === "cumulative"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setViewMode("cumulative")}
						type="button"
					>
						CUMULATIVE
					</button>
					<button
						className={cn(
							"rounded px-3 py-1 font-mono text-[10px] transition-colors",
							viewMode === "monthly"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setViewMode("monthly")}
						type="button"
					>
						MONTHLY
					</button>
				</div>

				{/* Quick select buttons */}
				<div className="flex gap-2">
					<button
						className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
						onClick={() => selectTopN(3)}
						type="button"
					>
						TOP 3
					</button>
					<button
						className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
						onClick={() => selectTopN(5)}
						type="button"
					>
						TOP 5
					</button>
					<button
						className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
						onClick={selectAll}
						type="button"
					>
						ALL
					</button>
				</div>
			</div>

			{/* Symbol selection chips */}
			<div className="flex flex-wrap gap-2">
				{symbols.map((sym, i) => (
					<button
						className={cn(
							"flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] transition-all",
							selectedSymbols.has(sym.symbol)
								? "border-primary/50 bg-primary/10 text-foreground"
								: "border-border bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50",
						)}
						key={sym.symbol}
						onClick={() => toggleSymbol(sym.symbol)}
						type="button"
					>
						<div
							className="h-2 w-2 rounded-full"
							style={{
								backgroundColor: selectedSymbols.has(sym.symbol)
									? SYMBOL_COLORS[i % SYMBOL_COLORS.length]
									: "#64748b",
							}}
						/>
						{sym.symbol}
						<span
							className={cn(
								"ml-1",
								sym.totalPnl >= 0 ? "text-profit/70" : "text-loss/70",
							)}
						>
							{formatCurrency(sym.totalPnl)}
						</span>
					</button>
				))}
			</div>

			{/* Chart */}
			{chartOptions && (
				<AgCharts options={chartOptions} style={{ height: 300 }} />
			)}
		</div>
	);
}
