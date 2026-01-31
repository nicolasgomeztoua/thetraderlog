"use client";

import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/shared";

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
	isTopPerformer?: boolean;
}

export function StrategyCard({
	strategy,
	stats,
	onEdit,
	onDuplicate,
	onDelete,
	isMobile = false,
	isTopPerformer = false,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";
	const hasTrades = strategy._count.trades > 0;
	const isActive = strategy.isActive !== false;
	const pnl = stats?.totalPnl ?? 0;
	const isProfit = hasTrades && pnl > 0;
	const isLoss = hasTrades && pnl < 0;

	return (
		<div
			className={cn(
				"group relative overflow-hidden rounded border transition-all duration-200",
				// Base border styling
				!isActive && "opacity-60",
				// Top performer gets primary border and glow
				isTopPerformer && isActive && "border-primary/50",
				// P&L-based border accents (only when not top performer)
				!isTopPerformer && isActive && isProfit && "border-profit/30",
				!isTopPerformer && isActive && isLoss && "border-loss/30",
				// Default border for strategies without clear P&L status
				!isTopPerformer && isActive && !isProfit && !isLoss && "border-border",
				// Inactive strategies get muted border
				!isActive && "border-border",
				// Hover states (only for active)
				isActive && "hover:border-primary/30",
			)}
			data-testid="strategy-card"
			style={
				{
					"--strategy-color": color,
				} as React.CSSProperties
			}
		>
			{/* Top performer persistent glow */}
			{isTopPerformer && isActive && (
				<div className="absolute inset-0 shadow-[inset_0_0_40px_hsl(var(--primary)/0.08),0_0_30px_hsl(var(--primary)/0.05)]" />
			)}

			{/* Hover glow effect using strategy color (only for active, non-top-performer) */}
			{!isTopPerformer && (
				<div
					className={cn(
						"absolute inset-0 opacity-0 transition-opacity duration-200",
						isActive && "group-hover:opacity-100",
					)}
					style={{
						boxShadow: `inset 0 0 30px ${color}15, 0 0 20px ${color}10`,
					}}
				/>
			)}

			{/* Terminal window chrome header */}
			<div className="relative flex min-h-[36px] items-center justify-between border-border/50 border-b bg-muted px-2 py-1.5 sm:min-h-0 sm:px-3 sm:py-2">
				<div className="flex items-center gap-1 sm:gap-1.5">
					<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
					<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
				</div>
				<span
					className="max-w-[120px] truncate font-mono text-[9px] uppercase tracking-wider sm:max-w-none sm:text-[10px]"
					data-testid="strategy-card-title"
					style={{ color }}
				>
					{strategy.name}
				</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className={cn(
								"h-8 w-8 shrink-0 transition-opacity sm:h-6 sm:w-6",
								isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
							)}
							data-testid="strategy-card-menu-trigger"
							size="icon"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4 sm:h-3 sm:w-3" />
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

			{/* Color gradient header area */}
			<div
				className="relative h-16 sm:h-20"
				style={{
					background: `linear-gradient(135deg, ${color}20 0%, ${color}05 50%, transparent 100%)`,
				}}
			>
				{/* Strategy color dot and status */}
				<div className="absolute top-3 left-3 flex items-center gap-2">
					<div
						className="h-3 w-3 rounded-full"
						style={{ backgroundColor: color }}
					/>
					{isActive ? (
						<div className="flex items-center gap-1.5">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-75" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-profit" />
							</span>
							<span className="font-mono text-[10px] text-profit uppercase tracking-wider">
								Active
							</span>
						</div>
					) : (
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Inactive
						</span>
					)}
				</div>

				{/* Top performer badge */}
				{isTopPerformer && isActive && (
					<div
						className="absolute top-3 right-3"
						data-testid="strategy-card-top-performer-badge"
					>
						<span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary uppercase tracking-wider">
							★ Top Performer
						</span>
					</div>
				)}

				{/* No trades badge */}
				{!hasTrades && isActive && !isTopPerformer && (
					<div
						className="absolute top-3 right-3"
						data-testid="strategy-card-no-trades-badge"
					>
						<span className="rounded border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							No trades yet
						</span>
					</div>
				)}

				{/* Rule count badge */}
				<div className="absolute right-3 bottom-3">
					<span className="rounded border border-border bg-card/80 px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{strategy._count.rules}{" "}
						{strategy._count.rules === 1 ? "rule" : "rules"} defined
					</span>
				</div>
			</div>

			{/* Card content */}
			<div className="relative bg-card p-4">
				{/* Clickable strategy name */}
				<Link
					className="mb-3 block font-mono font-semibold text-lg transition-colors hover:text-primary"
					data-testid="strategy-card-link"
					href={`/strategies/${strategy.id}`}
				>
					{strategy.name}
				</Link>

				{/* Stats grid */}
				<div
					className="grid grid-cols-3 gap-3"
					data-testid="strategy-card-stats"
				>
					<div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Trades
						</div>
						<div className="mt-1 font-bold font-mono text-base sm:text-lg">
							{strategy._count.trades}
						</div>
					</div>

					<div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Win Rate
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-base sm:text-lg",
								hasTrades && stats
									? stats.winRate >= 50
										? "text-profit"
										: "text-loss"
									: "text-muted-foreground",
							)}
						>
							{hasTrades && stats ? `${stats.winRate.toFixed(0)}%` : "—"}
						</div>
					</div>

					<div>
						<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Total P&L
						</div>
						<div
							className={cn(
								"mt-1 font-bold font-mono text-base sm:text-lg",
								hasTrades && stats
									? stats.totalPnl >= 0
										? "text-profit"
										: "text-loss"
									: "text-muted-foreground",
							)}
						>
							{hasTrades && stats ? formatCurrency(stats.totalPnl) : "—"}
						</div>
					</div>
				</div>

				{/* Description if available */}
				{strategy.description && (
					<p className="mt-3 line-clamp-2 border-border/50 border-t pt-3 font-mono text-muted-foreground text-xs">
						{strategy.description}
					</p>
				)}
			</div>
		</div>
	);
}
