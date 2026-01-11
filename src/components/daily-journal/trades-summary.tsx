"use client";

import {
	ArrowDownIcon,
	ArrowUpIcon,
	ExternalLinkIcon,
	Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { cn, formatPnL } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface TradesSummaryProps {
	selectedDate: Date;
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Summary component showing trades for the selected date.
 * Lists trades with symbol, direction, P&L and links to trade detail.
 */
export function TradesSummary({ selectedDate, className }: TradesSummaryProps) {
	const dateString = selectedDate.toISOString().split("T")[0] ?? "";

	// Fetch journal with trades for the date
	const { data, isLoading } = api.dailyJournal.getWithTrades.useQuery(
		{ date: dateString },
		{ enabled: !!dateString },
	);

	// Calculate total P&L
	const totalPnL = useMemo(() => {
		if (!data?.trades || data.trades.length === 0) return null;

		return data.trades.reduce((sum, trade) => {
			const pnl = trade.realizedPnl ? parseFloat(trade.realizedPnl) : 0;
			return sum + pnl;
		}, 0);
	}, [data?.trades]);

	// Count wins/losses
	const stats = useMemo(() => {
		if (!data?.trades || data.trades.length === 0) return null;

		const wins = data.trades.filter((t) => {
			const pnl = t.realizedPnl ? parseFloat(t.realizedPnl) : 0;
			return pnl > 0;
		}).length;

		const losses = data.trades.filter((t) => {
			const pnl = t.realizedPnl ? parseFloat(t.realizedPnl) : 0;
			return pnl < 0;
		}).length;

		return { total: data.trades.length, wins, losses };
	}, [data?.trades]);

	return (
		<div className={cn("space-y-3", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Trades
				</span>
				{stats && (
					<span className="font-mono text-[10px] text-muted-foreground">
						{stats.total} trade{stats.total !== 1 ? "s" : ""} ({stats.wins}W /{" "}
						{stats.losses}L)
					</span>
				)}
			</div>

			{/* Loading state */}
			{isLoading && (
				<div className="flex items-center justify-center py-4">
					<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
				</div>
			)}

			{/* Empty state */}
			{!isLoading && (!data?.trades || data.trades.length === 0) && (
				<div className="py-4 text-center">
					<p className="font-mono text-muted-foreground text-xs">
						No trades for this date
					</p>
				</div>
			)}

			{/* Trades list */}
			{!isLoading && data?.trades && data.trades.length > 0 && (
				<div className="space-y-1">
					{data.trades.map((trade) => {
						const pnl = trade.realizedPnl ? parseFloat(trade.realizedPnl) : 0;
						const isProfit = pnl > 0;
						const isLoss = pnl < 0;

						return (
							<Link
								className="group flex items-center justify-between rounded border border-white/5 bg-white/[0.01] p-2 transition-colors hover:border-white/10 hover:bg-white/[0.02]"
								href={`/journal/${trade.id}`}
								key={trade.id}
							>
								{/* Left: Direction icon + Symbol */}
								<div className="flex items-center gap-2">
									{trade.direction === "long" ? (
										<ArrowUpIcon className="size-3 text-profit" />
									) : (
										<ArrowDownIcon className="size-3 text-loss" />
									)}
									<span className="font-mono text-sm">{trade.symbol}</span>
									{trade.account && (
										<span className="font-mono text-[10px] text-muted-foreground">
											{trade.account.name}
										</span>
									)}
								</div>

								{/* Right: P&L + Link icon */}
								<div className="flex items-center gap-2">
									<span
										className={cn(
											"font-mono text-sm",
											isProfit && "text-profit",
											isLoss && "text-loss",
											!isProfit && !isLoss && "text-muted-foreground",
										)}
									>
										{formatPnL(pnl)}
									</span>
									<ExternalLinkIcon className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								</div>
							</Link>
						);
					})}
				</div>
			)}

			{/* Total P&L */}
			{!isLoading &&
				totalPnL !== null &&
				data?.trades &&
				data.trades.length > 0 && (
					<div className="flex items-center justify-between border-white/5 border-t pt-3">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Daily P&L
						</span>
						<span
							className={cn(
								"font-medium font-mono text-sm",
								totalPnL > 0 && "text-profit",
								totalPnL < 0 && "text-loss",
								totalPnL === 0 && "text-muted-foreground",
							)}
						>
							{formatPnL(totalPnL)}
						</span>
					</div>
				)}
		</div>
	);
}
