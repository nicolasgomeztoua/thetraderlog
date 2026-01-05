"use client";

import { Copy, MoreVertical, Pencil, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/shared";

interface StrategyCardProps {
	strategy: {
		id: string;
		name: string;
		description: string | null;
		color: string | null;
		isActive: boolean | null;
		_count: {
			rules: number;
			trades: number;
		};
	};
	stats?: {
		winRate: number;
		totalPnl: number;
		avgPnl: number;
	} | null;
	onEdit?: () => void;
	onDuplicate?: () => void;
	onDelete?: () => void;
}

export function StrategyCard({
	strategy,
	stats,
	onEdit,
	onDuplicate,
	onDelete,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";

	return (
		<div
			className={cn(
				"group relative rounded border border-white/5 bg-white/2 p-5 transition-all hover:border-white/10",
				!strategy.isActive && "opacity-60",
			)}
		>
			{/* Color indicator */}
			<div
				className="absolute top-0 left-0 h-full w-1 rounded-l"
				style={{ backgroundColor: color }}
			/>

			{/* Header */}
			<div className="mb-4 flex items-start justify-between">
				<div className="flex-1">
					<Link
						className="font-mono font-semibold text-lg transition-colors hover:text-primary"
						href={`/strategies/${strategy.id}`}
					>
						{strategy.name}
					</Link>
					{!strategy.isActive && (
						<Badge className="ml-2 font-mono text-[10px]" variant="secondary">
							Inactive
						</Badge>
					)}
					{strategy.description && (
						<p className="mt-1 line-clamp-2 font-mono text-muted-foreground text-sm">
							{strategy.description}
						</p>
					)}
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onDuplicate}>
							<Copy className="mr-2 h-4 w-4" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-loss focus:text-loss"
							onClick={onDelete}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Trades
					</div>
					<div className="mt-1 font-bold font-mono text-lg">
						{strategy._count.trades}
					</div>
				</div>

				<div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Rules
					</div>
					<div className="mt-1 font-bold font-mono text-lg">
						{strategy._count.rules}
					</div>
				</div>

				{stats && strategy._count.trades > 0 ? (
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Win Rate
						</div>
						<div
							className={cn(
								"mt-1 flex items-center gap-1 font-bold font-mono text-lg",
								stats.winRate >= 50 ? "text-profit" : "text-loss",
							)}
						>
							<TrendingUp className="h-4 w-4" />
							{stats.winRate.toFixed(0)}%
						</div>
					</div>
				) : (
					<div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Win Rate
						</div>
						<div className="mt-1 font-mono text-lg text-muted-foreground">
							—
						</div>
					</div>
				)}
			</div>

			{/* P&L if available */}
			{stats && strategy._count.trades > 0 && (
				<div className="mt-4 border-border border-t pt-4">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Total P&L
						</span>
						<span
							className={cn(
								"font-bold font-mono",
								stats.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{stats.totalPnl >= 0 ? "+" : ""}$
							{Math.abs(stats.totalPnl).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
