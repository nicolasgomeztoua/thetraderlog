"use client";

import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import { cn, formatCurrency } from "@/lib/shared";
import { StrategyMiniChart } from "./strategy-mini-chart";

// =============================================================================
// TYPES
// =============================================================================

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
	/** Performance metrics including mini chart data */
	performance?: {
		winRate: number;
		totalPnl: number;
		profitFactor: number;
		avgPnl: number;
		tradesCount: number;
		recentPnlSeries: number[];
	} | null;
	/** Legacy stats prop for backwards compatibility */
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

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Enhanced strategy card with mini chart and premium styling.
 * Features:
 * - Mini chart showing recent P&L trend
 * - Win rate circular gauge
 * - Color accent border with glow effect on hover
 * - Active/Inactive badge
 */
export function StrategyCard({
	strategy,
	performance,
	stats,
	onEdit,
	onDuplicate,
	onDelete,
	isMobile = false,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";

	// Use performance data if available, fall back to stats for backwards compatibility
	const winRate = performance?.winRate ?? stats?.winRate ?? 0;
	const totalPnl = performance?.totalPnl ?? stats?.totalPnl ?? 0;
	const tradesCount = performance?.tradesCount ?? strategy._count.trades;
	const hasData = tradesCount > 0;

	return (
		<article
			className={cn(
				"group relative overflow-hidden rounded-lg border border-white/5 bg-card transition-all duration-200",
				"hover:border-white/15 hover:shadow-lg",
				!strategy.isActive && "opacity-60",
			)}
			data-testid={`strategy-card-${strategy.id}`}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow = `0 4px 20px -4px ${color}20`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = `0 0 0 0 ${color}00`;
			}}
			style={{
				// Subtle glow effect on hover using strategy color
				boxShadow: `0 0 0 0 ${color}00`,
			}}
		>
			{/* Top color accent bar */}
			<div
				className="h-1 w-full"
				data-testid="strategy-card-color-bar"
				style={{ backgroundColor: color }}
			/>

			{/* Content */}
			<div className="p-4 sm:p-5">
				{/* Header row */}
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<Link
								className="truncate font-mono font-semibold text-base transition-colors hover:text-primary sm:text-lg"
								data-testid="strategy-card-name"
								href={`/strategies/${strategy.id}`}
							>
								{strategy.name}
							</Link>
							<Badge
								className={cn(
									"shrink-0 font-mono text-[10px]",
									strategy.isActive
										? "border-profit/30 bg-profit/10 text-profit"
										: "border-white/10 bg-white/5 text-muted-foreground",
								)}
								data-testid="strategy-card-status-badge"
								variant="outline"
							>
								{strategy.isActive ? "Active" : "Inactive"}
							</Badge>
						</div>
						{strategy.description && (
							<p className="mt-2 line-clamp-2 font-mono text-muted-foreground text-xs leading-relaxed">
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
								data-testid="strategy-card-menu-trigger"
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

				{/* Stats and chart row */}
				<div className="flex items-end justify-between gap-4">
					{/* Left: Stats */}
					<div className="grid grid-cols-3 gap-4">
						{/* Trades count */}
						<div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Trades
							</div>
							<div
								className="mt-1 font-bold font-mono text-lg sm:text-xl"
								data-testid="strategy-card-trades-count"
							>
								{tradesCount}
							</div>
						</div>

						{/* Win Rate */}
						<div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Win Rate
							</div>
							{hasData ? (
								<div
									className={cn(
										"mt-1 font-bold font-mono text-lg sm:text-xl",
										winRate >= 50 ? "text-profit" : "text-loss",
									)}
									data-testid="strategy-card-win-rate"
								>
									{winRate.toFixed(0)}%
								</div>
							) : (
								<div className="mt-1 font-mono text-lg text-muted-foreground/50 sm:text-xl">
									—
								</div>
							)}
						</div>

						{/* Total P&L */}
						<div>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								P&L
							</div>
							{hasData ? (
								<div
									className={cn(
										"mt-1 font-bold font-mono text-lg sm:text-xl",
										totalPnl >= 0 ? "text-profit" : "text-loss",
									)}
									data-testid="strategy-card-pnl"
								>
									{formatCurrency(totalPnl)}
								</div>
							) : (
								<div className="mt-1 font-mono text-lg text-muted-foreground/50 sm:text-xl">
									—
								</div>
							)}
						</div>
					</div>

					{/* Right: Mini chart */}
					<div className="shrink-0" data-testid="strategy-card-chart">
						<StrategyMiniChart
							data={performance?.recentPnlSeries ?? []}
							height={48}
							width={100}
						/>
					</div>
				</div>

				{/* Footer: Rules count */}
				<div className="mt-4 border-border border-t pt-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							{strategy._count.rules}{" "}
							{strategy._count.rules === 1 ? "Rule" : "Rules"} Defined
						</span>
						{performance?.profitFactor !== undefined &&
							performance.profitFactor > 0 &&
							hasData && (
								<span className="font-mono text-[10px] text-muted-foreground">
									PF:{" "}
									<span className="text-foreground">
										{performance.profitFactor.toFixed(2)}
									</span>
								</span>
							)}
					</div>
				</div>
			</div>
		</article>
	);
}
