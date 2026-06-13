"use client";

import { CheckCircle2, Circle, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/ui/star-rating";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, getPnLColorClass } from "@/lib/shared";
import { calculateActualRMultiple } from "@/lib/trades/calculations";
import type { RouterOutputs } from "@/trpc/react";

/** A single trade row as returned by the journal's trades.getAll query. */
export type JournalTrade = RouterOutputs["trades"]["getAll"]["items"][number];

/** Strategy option shown in the per-row strategy selector. */
export type StrategyOption =
	RouterOutputs["strategies"]["getSimpleList"][number];

export interface TradeRowCallbacks {
	onSelectTrade: (id: string, checked: boolean) => void;
	onNavigate: (id: string) => void;
	onRate: (args: { id: string; rating: number }) => void;
	onToggleReviewed: (args: { id: string; isReviewed: boolean }) => void;
	onChangeStrategy: (args: { id: string; strategyId: string | null }) => void;
	onRequestDelete: (id: string) => void;
	formatDateTime: (date: Date | string | null | undefined) => string;
}

interface TradeRowProps extends TradeRowCallbacks {
	trade: JournalTrade;
	isSelected: boolean;
	visibleColumns: { id: string }[];
	strategiesList: StrategyOption[] | undefined;
}

// Columns whose own click handlers must not bubble up to the row's navigate.
const STOP_PROPAGATION_COLUMNS = new Set([
	"checkbox",
	"actions",
	"rating",
	"reviewed",
	"strategy",
]);

function renderCell(
	columnId: string,
	trade: JournalTrade,
	props: TradeRowProps,
): React.ReactNode {
	const {
		isSelected,
		strategiesList,
		onSelectTrade,
		onRate,
		onToggleReviewed,
		onChangeStrategy,
		onRequestDelete,
		formatDateTime,
	} = props;

	switch (columnId) {
		case "checkbox":
			return (
				<Checkbox
					checked={isSelected}
					onCheckedChange={(checked) => onSelectTrade(trade.id, !!checked)}
				/>
			);
		case "symbol":
			return <span className="font-bold font-mono">{trade.symbol}</span>;
		case "side":
			return (
				<span
					className={cn(
						"font-mono text-xs uppercase",
						trade.direction === "long" ? "text-profit" : "text-loss",
					)}
				>
					{trade.direction === "long" ? "Long" : "Short"}
				</span>
			);
		case "entry":
			return (
				<div>
					<div className="font-mono text-sm">
						{parseFloat(trade.entryPrice).toFixed(2)}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						{formatDateTime(trade.entryTime)}
					</div>
				</div>
			);
		case "exit":
			return trade.exitPrice ? (
				<div>
					<div className="font-mono text-sm">
						{parseFloat(trade.exitPrice).toFixed(2)}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground">
						{formatDateTime(trade.exitTime)}
					</div>
				</div>
			) : (
				<span className="font-mono text-muted-foreground text-xs">—</span>
			);
		case "size":
			return (
				<span className="font-mono text-sm">
					{parseFloat(trade.quantity).toFixed(2)}
				</span>
			);
		case "pnl":
			return (
				<span
					className={cn(
						"font-bold font-mono",
						trade.netPnl
							? getPnLColorClass(trade.netPnl)
							: "text-muted-foreground",
					)}
				>
					{trade.netPnl ? formatCurrency(parseFloat(trade.netPnl)) : "—"}
				</span>
			);
		case "result":
			return trade.status === "open" ? (
				<span className="font-mono text-muted-foreground text-xs">Open</span>
			) : trade.exitReason === "take_profit" || trade.takeProfitHit ? (
				<span className="font-mono text-profit text-xs">TP</span>
			) : trade.exitReason === "stop_loss" || trade.stopLossHit ? (
				<span className="font-mono text-loss text-xs">SL</span>
			) : trade.exitReason === "trailing_stop" ? (
				<span className="font-mono text-accent text-xs">Trail</span>
			) : trade.exitReason === "breakeven" ? (
				<span className="font-mono text-breakeven text-xs">BE</span>
			) : (
				<span className="font-mono text-muted-foreground text-xs">Manual</span>
			);
		case "rating":
			return (
				<StarRating
					onChange={(rating) => onRate({ id: trade.id, rating: rating ?? 0 })}
					size="sm"
					value={trade.rating ?? 0}
				/>
			);
		case "reviewed":
			return (
				<button
					className="flex items-center justify-center"
					onClick={(e) => {
						e.stopPropagation();
						onToggleReviewed({
							id: trade.id,
							isReviewed: !trade.isReviewed,
						});
					}}
					type="button"
				>
					{trade.isReviewed ? (
						<CheckCircle2 className="h-4 w-4 text-profit" />
					) : (
						<Circle className="h-4 w-4 text-muted-foreground/30" />
					)}
				</button>
			);
		case "setup":
			return (
				<span className="font-mono text-muted-foreground text-xs">
					{trade.setupType || "—"}
				</span>
			);
		case "fees":
			return (
				<span className="font-mono text-muted-foreground text-xs">
					{trade.fees ? formatCurrency(parseFloat(trade.fees)) : "—"}
				</span>
			);
		case "duration": {
			if (!trade.exitTime)
				return (
					<span className="font-mono text-muted-foreground text-xs">—</span>
				);
			const duration =
				new Date(trade.exitTime).getTime() -
				new Date(trade.entryTime).getTime();
			const minutes = Math.floor(duration / 60000);
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);
			if (days > 0)
				return (
					<span className="font-mono text-xs">
						{days}d {hours % 24}h
					</span>
				);
			if (hours > 0)
				return (
					<span className="font-mono text-xs">
						{hours}h {minutes % 60}m
					</span>
				);
			return <span className="font-mono text-xs">{minutes}m</span>;
		}
		case "rMultiple": {
			// Calculate R-Multiple using actual P&L and proper risk calculation
			const rMultiple = calculateActualRMultiple(
				trade.netPnl ? parseFloat(trade.netPnl) : null,
				parseFloat(trade.entryPrice),
				trade.stopLoss ? parseFloat(trade.stopLoss) : null,
				parseFloat(trade.quantity),
				trade.symbol,
			);
			if (rMultiple === null) {
				return (
					<span className="font-mono text-muted-foreground text-xs">—</span>
				);
			}
			return (
				<span
					className={cn(
						"font-mono text-xs",
						rMultiple > 0
							? "text-profit"
							: rMultiple < 0
								? "text-loss"
								: "text-muted-foreground",
					)}
				>
					{rMultiple.toFixed(2)}R
				</span>
			);
		}
		case "tags":
			return (
				<div className="flex flex-wrap gap-1">
					{trade.tradeTags?.slice(0, 2).map((tt) => (
						<Badge
							className="px-1 py-0 text-[10px]"
							key={tt.tagId}
							style={{
								borderColor: tt.tag.color ?? undefined,
								color: tt.tag.color ?? undefined,
							}}
							variant="outline"
						>
							{tt.tag.name}
						</Badge>
					))}
					{trade.tradeTags && trade.tradeTags.length > 2 && (
						<Badge className="px-1 py-0 text-[10px]" variant="secondary">
							+{trade.tradeTags.length - 2}
						</Badge>
					)}
				</div>
			);
		case "account":
			return (
				<span className="font-mono text-muted-foreground text-xs">
					{trade.account?.name || "—"}
				</span>
			);
		case "strategy":
			return (
				<Select
					onValueChange={(value) => {
						const strategyId = value === "none" ? null : value;
						onChangeStrategy({ id: trade.id, strategyId });
					}}
					value={trade.strategyId?.toString() ?? "none"}
				>
					<SelectTrigger className="h-7 w-[130px] border-transparent bg-transparent px-2 font-mono text-xs hover:border-border focus:ring-0 focus:ring-offset-0">
						<SelectValue>
							{trade.strategy ? (
								<div className="flex items-center gap-1.5">
									<div
										className="h-1.5 w-1.5 shrink-0 rounded-full"
										style={{
											backgroundColor: trade.strategy.color ?? "#d4ff00",
										}}
									/>
									<span className="truncate">{trade.strategy.name}</span>
								</div>
							) : (
								<span className="text-muted-foreground/50">None</span>
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">
							<span className="text-muted-foreground">None</span>
						</SelectItem>
						{strategiesList?.map((s) => (
							<SelectItem key={s.id} value={s.id.toString()}>
								<div className="flex items-center gap-1.5">
									<div
										className="h-1.5 w-1.5 shrink-0 rounded-full"
										style={{ backgroundColor: s.color ?? "#d4ff00" }}
									/>
									{s.name}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		case "actions":
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
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
							onClick={() => onRequestDelete(trade.id)}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		default:
			return null;
	}
}

/**
 * Memoized desktop trade row. Only re-renders when its own trade object,
 * selection state, or the visible columns / strategy list change — so toggling
 * one row's selection no longer re-renders every other loaded row.
 */
function TradeRowComponent(props: TradeRowProps) {
	const { trade, isSelected, visibleColumns, onNavigate } = props;
	return (
		<TableRow
			className={cn(
				"cursor-pointer border-border transition-colors hover:bg-secondary",
				isSelected && "bg-accent",
			)}
			onClick={() => onNavigate(trade.id)}
		>
			{visibleColumns.map((col) => (
				<TableCell
					key={col.id}
					onClick={(e) => {
						if (STOP_PROPAGATION_COLUMNS.has(col.id)) {
							e.stopPropagation();
						}
					}}
				>
					{renderCell(col.id, trade, props)}
				</TableCell>
			))}
		</TableRow>
	);
}

export const TradeRow = memo(TradeRowComponent);
