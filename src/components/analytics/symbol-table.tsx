"use client";

import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

interface SymbolData {
	symbol: string;
	pnl: number;
	trades: number;
	wins: number;
	losses: number;
	winRate: number;
	profitFactor: number;
	avgTrade: number;
	avgWin: number;
	avgLoss: number;
}

interface SymbolTableProps {
	data: SymbolData[];
	className?: string;
}

type SortField =
	| "symbol"
	| "pnl"
	| "trades"
	| "winRate"
	| "profitFactor"
	| "avgTrade";
type SortDirection = "asc" | "desc";

/**
 * Terminal-styled sortable table showing per-symbol performance metrics
 */
export function SymbolTable({ data, className }: SymbolTableProps) {
	const [sortField, setSortField] = useState<SortField>("pnl");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const sortedData = useMemo(() => {
		return [...data].sort((a, b) => {
			let aVal: number | string;
			let bVal: number | string;

			switch (sortField) {
				case "symbol":
					aVal = a.symbol;
					bVal = b.symbol;
					break;
				case "pnl":
					aVal = a.pnl;
					bVal = b.pnl;
					break;
				case "trades":
					aVal = a.trades;
					bVal = b.trades;
					break;
				case "winRate":
					aVal = a.winRate;
					bVal = b.winRate;
					break;
				case "profitFactor":
					// Handle Infinity values for sorting
					aVal = a.profitFactor === Infinity ? 999999 : a.profitFactor;
					bVal = b.profitFactor === Infinity ? 999999 : b.profitFactor;
					break;
				case "avgTrade":
					aVal = a.avgTrade;
					bVal = b.avgTrade;
					break;
				default:
					return 0;
			}

			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDirection === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			return sortDirection === "asc"
				? (aVal as number) - (bVal as number)
				: (bVal as number) - (aVal as number);
		});
	}, [data, sortField, sortDirection]);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("desc");
		}
	};

	// Calculate totals for footer (must be before early return to follow hooks rules)
	const totals = useMemo(() => {
		if (data.length === 0) {
			return { totalPnl: 0, totalTrades: 0, winRate: 0, avgTrade: 0 };
		}
		const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
		const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);
		const totalWins = data.reduce((sum, d) => sum + d.wins, 0);
		const totalLosses = data.reduce((sum, d) => sum + d.losses, 0);
		const winRate =
			totalWins + totalLosses > 0
				? (totalWins / (totalWins + totalLosses)) * 100
				: 0;
		const avgTrade = totalTrades > 0 ? totalPnl / totalTrades : 0;

		return { totalPnl, totalTrades, winRate, avgTrade };
	}, [data]);

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) {
			return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
		}
		return sortDirection === "asc" ? (
			<ArrowUp className="h-3 w-3 text-primary" />
		) : (
			<ArrowDown className="h-3 w-3 text-primary" />
		);
	};

	if (data.length === 0) {
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
		<div className={cn("overflow-x-auto", className)}>
			<table className="w-full font-mono text-xs">
				<thead>
					<tr className="border-border border-b text-left text-muted-foreground">
						<th className="pr-4 pb-3">
							<button
								className="flex items-center gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("symbol")}
								type="button"
							>
								Symbol
								<SortIcon field="symbol" />
							</button>
						</th>
						<th className="pr-4 pb-3 text-right">
							<button
								className="flex items-center justify-end gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("pnl")}
								type="button"
							>
								P&L
								<SortIcon field="pnl" />
							</button>
						</th>
						<th className="pr-4 pb-3 text-right">
							<button
								className="flex items-center justify-end gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("trades")}
								type="button"
							>
								Trades
								<SortIcon field="trades" />
							</button>
						</th>
						<th className="pr-4 pb-3 text-right">
							<button
								className="flex items-center justify-end gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("winRate")}
								type="button"
							>
								Win Rate
								<SortIcon field="winRate" />
							</button>
						</th>
						<th className="pr-4 pb-3 text-right">
							<button
								className="flex items-center justify-end gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("profitFactor")}
								type="button"
							>
								PF
								<SortIcon field="profitFactor" />
							</button>
						</th>
						<th className="pb-3 text-right">
							<button
								className="flex items-center justify-end gap-1 transition-colors hover:text-foreground"
								onClick={() => handleSort("avgTrade")}
								type="button"
							>
								Avg Trade
								<SortIcon field="avgTrade" />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{sortedData.map((row, idx) => (
						<tr
							className={cn(
								"border-border border-b transition-colors hover:bg-secondary/30",
								idx === sortedData.length - 1 && "border-b-0",
							)}
							key={row.symbol}
						>
							<td className="py-3 pr-4">
								<div className="flex items-center gap-2">
									{row.pnl >= 0 ? (
										<TrendingUp className="h-3.5 w-3.5 text-profit" />
									) : (
										<TrendingDown className="h-3.5 w-3.5 text-loss" />
									)}
									<span className="font-medium">{row.symbol}</span>
								</div>
							</td>
							<td
								className={cn(
									"py-3 pr-4 text-right tabular-nums",
									row.pnl >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{formatCurrency(row.pnl)}
							</td>
							<td className="py-3 pr-4 text-right text-muted-foreground tabular-nums">
								{row.trades}
								<span className="ml-1 text-muted-foreground/60">
									({row.wins}W/{row.losses}L)
								</span>
							</td>
							<td
								className={cn(
									"py-3 pr-4 text-right tabular-nums",
									row.winRate >= 50 ? "text-profit" : "text-loss",
								)}
							>
								{formatPercent(row.winRate, 1).replace("+", "")}
							</td>
							<td
								className={cn(
									"py-3 pr-4 text-right tabular-nums",
									row.profitFactor >= 1 ? "text-profit" : "text-loss",
								)}
							>
								{row.profitFactor === Infinity
									? "\u221E"
									: row.profitFactor.toFixed(2)}
							</td>
							<td
								className={cn(
									"py-3 text-right tabular-nums",
									row.avgTrade >= 0 ? "text-profit/80" : "text-loss/80",
								)}
							>
								{formatCurrency(row.avgTrade)}
							</td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr className="border-border border-t bg-secondary/20 font-medium">
						<td className="py-3 pr-4">
							<span className="text-muted-foreground">
								Total ({data.length} symbols)
							</span>
						</td>
						<td
							className={cn(
								"py-3 pr-4 text-right tabular-nums",
								totals.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{formatCurrency(totals.totalPnl)}
						</td>
						<td className="py-3 pr-4 text-right text-muted-foreground tabular-nums">
							{totals.totalTrades}
						</td>
						<td
							className={cn(
								"py-3 pr-4 text-right tabular-nums",
								totals.winRate >= 50 ? "text-profit" : "text-loss",
							)}
						>
							{formatPercent(totals.winRate, 1).replace("+", "")}
						</td>
						<td className="py-3 pr-4 text-right text-muted-foreground">-</td>
						<td
							className={cn(
								"py-3 text-right tabular-nums",
								totals.avgTrade >= 0 ? "text-profit/80" : "text-loss/80",
							)}
						>
							{formatCurrency(totals.avgTrade)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>
	);
}
