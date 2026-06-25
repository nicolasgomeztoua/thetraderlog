"use client";

import { CheckCircle2, Circle, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarRating } from "@/components/ui/star-rating";
import { TRADE_RESULT_META } from "@/lib/constants/trade-result";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
import { calculateActualRMultiple } from "@/lib/trades/calculations";
import { deriveTradeResult } from "@/lib/trades/result";
import type { JournalTrade } from "./trade-row";

interface TradeCardProps {
	trade: JournalTrade;
	isSelected: boolean;
	onSelectTrade: (id: string, checked: boolean) => void;
	onNavigate: (id: string) => void;
	onRate: (args: { id: string; rating: number }) => void;
	onToggleReviewed: (args: { id: string; isReviewed: boolean }) => void;
	onRequestDelete: (id: string) => void;
	formatDateTime: (date: Date | string | null | undefined) => string;
}

/**
 * Memoized mobile trade card. Only re-renders when its own trade or selection
 * state changes, instead of re-rendering every card on each parent render.
 */
function TradeCardComponent({
	trade,
	isSelected,
	onSelectTrade,
	onNavigate,
	onRate,
	onToggleReviewed,
	onRequestDelete,
	formatDateTime,
}: TradeCardProps) {
	const rMultiple = calculateActualRMultiple(
		trade.netPnl ? parseFloat(trade.netPnl) : null,
		parseFloat(trade.entryPrice),
		trade.stopLoss ? parseFloat(trade.stopLoss) : null,
		parseFloat(trade.quantity),
		trade.symbol,
	);

	return (
		<button
			className={cn(
				"flex w-full cursor-pointer flex-col gap-3 border-border border-b bg-transparent p-4 text-left transition-colors active:bg-secondary",
				isSelected && "bg-accent",
			)}
			onClick={() => onNavigate(trade.id)}
			type="button"
		>
			{/* Top row: checkbox, symbol, direction, P&L */}
			<div className="flex w-full items-center justify-between">
				<div className="flex items-center gap-3">
					<Checkbox
						checked={isSelected}
						onCheckedChange={(checked) => {
							onSelectTrade(trade.id, !!checked);
						}}
						onClick={(e) => e.stopPropagation()}
					/>
					<div className="flex items-center gap-2">
						<span className="font-bold font-mono text-sm">{trade.symbol}</span>
						<span
							className={cn(
								"font-mono text-xs uppercase",
								trade.direction === "long" ? "text-profit" : "text-loss",
							)}
						>
							{trade.direction === "long" ? "L" : "S"}
						</span>
					</div>
				</div>
				<span
					className={cn(
						"font-bold font-mono text-sm",
						trade.netPnl
							? getPnLColorClass(trade.netPnl)
							: "text-muted-foreground",
					)}
				>
					{trade.netPnl ? formatCurrency(parseFloat(trade.netPnl)) : "—"}
				</span>
			</div>

			{/* Middle row: entry/exit info */}
			<div className="flex w-full items-center justify-between font-mono text-muted-foreground text-xs">
				<span>{formatDateTime(trade.entryTime)}</span>
				<div className="flex items-center gap-2">
					{rMultiple !== null && (
						<span
							className={cn(
								rMultiple > 0
									? "text-profit"
									: rMultiple < 0
										? "text-loss"
										: "text-muted-foreground",
							)}
						>
							{rMultiple.toFixed(2)}R
						</span>
					)}
					{(() => {
						const meta = TRADE_RESULT_META[deriveTradeResult(trade)];
						return <span className={meta.className}>{meta.label}</span>;
					})()}
				</div>
			</div>

			{/* Bottom row: rating, reviewed, actions */}
			<div className="flex w-full items-center justify-between">
				<div className="flex items-center gap-3">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
					<span onClick={(e) => e.stopPropagation()}>
						<StarRating
							onChange={(rating) =>
								onRate({ id: trade.id, rating: rating ?? 0 })
							}
							size="sm"
							value={trade.rating ?? 0}
						/>
					</span>
					{/* biome-ignore lint/a11y/useSemanticElements: nested interactive element inside button */}
					<span
						className="flex items-center justify-center"
						onClick={(e) => {
							e.stopPropagation();
							onToggleReviewed({
								id: trade.id,
								isReviewed: !trade.isReviewed,
							});
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.stopPropagation();
								e.preventDefault();
								onToggleReviewed({
									id: trade.id,
									isReviewed: !trade.isReviewed,
								});
							}
						}}
						role="button"
						tabIndex={0}
					>
						{trade.isReviewed ? (
							<CheckCircle2 className="h-4 w-4 text-profit" />
						) : (
							<Circle className="h-4 w-4 text-muted-foreground/30" />
						)}
					</span>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
						<Button className="h-8 w-8" size="icon" variant="ghost">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem asChild className="font-mono text-xs">
							<Link href={`/journal/${trade.id}`}>View Details</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="font-mono text-destructive text-xs focus:text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onRequestDelete(trade.id);
							}}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</button>
	);
}

export const TradeCard = memo(TradeCardComponent);
