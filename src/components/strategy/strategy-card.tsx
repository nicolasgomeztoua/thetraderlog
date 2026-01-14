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
	isMobile?: boolean;
}

export function StrategyCard({
	strategy,
	stats,
	onEdit,
	onDuplicate,
	onDelete,
	isMobile = false,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";

	return (
		<div
			className={cn(
				"group relative rounded border border-white/5 bg-white/2 p-4 transition-all hover:border-white/10 sm:p-5",
				!strategy.isActive && "opacity-60",
			)}
		>
			{/* Color indicator */}
			<div
				className="absolute top-0 left-0 h-full w-1 rounded-l"
				style={{ backgroundColor: color }}
			/>

			{/* Header */}
			<div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
				<div className="min-w-0 flex-1">
					<Link
						className="font-mono font-semibold text-base transition-colors hover:text-primary sm:text-lg"
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
						<p className="mt-1 line-clamp-2 font-mono text-muted-foreground text-xs sm:text-sm">
							{strategy.description}
						</p>
					)}
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className={cn(
								"h-8 w-8 shrink-0 transition-opacity",
								isMobile
									? "min-h-[36px] min-w-[36px] opacity-100"
									: "opacity-0 group-hover:opacity-100",
							)}
							size="icon"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="min-h-[44px] sm:min-h-0"
							onClick={onEdit}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							className="min-h-[44px] sm:min-h-0"
							onClick={onDuplicate}
						>
							<Copy className="mr-2 h-4 w-4" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="min-h-[44px] text-loss focus:text-loss sm:min-h-0"
							onClick={onDelete}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-2 sm:gap-4">
				<div>
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Trades
					</div>
					<div className="mt-0.5 font-bold font-mono text-base sm:mt-1 sm:text-lg">
						{strategy._count.trades}
					</div>
				</div>

				<div>
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Rules
					</div>
					<div className="mt-0.5 font-bold font-mono text-base sm:mt-1 sm:text-lg">
						{strategy._count.rules}
					</div>
				</div>

				{stats && strategy._count.trades > 0 ? (
					<div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Win Rate
						</div>
						<div
							className={cn(
								"mt-0.5 flex items-center gap-1 font-bold font-mono text-base sm:mt-1 sm:text-lg",
								stats.winRate >= 50 ? "text-profit" : "text-loss",
							)}
						>
							<TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
							{stats.winRate.toFixed(0)}%
						</div>
					</div>
				) : (
					<div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Win Rate
						</div>
						<div className="mt-0.5 font-mono text-base text-muted-foreground sm:mt-1 sm:text-lg">
							—
						</div>
					</div>
				)}
			</div>

			{/* P&L if available */}
			{stats && strategy._count.trades > 0 && (
				<div className="mt-3 border-border border-t pt-3 sm:mt-4 sm:pt-4">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Total P&L
						</span>
						<span
							className={cn(
								"font-bold font-mono text-sm sm:text-base",
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
