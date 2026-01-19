"use client";

import { Copy, MoreVertical, Pencil, Trash2, TrendingUp } from "lucide-react";
import Image from "next/image";
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

// =============================================================================
// TYPES
// =============================================================================

interface StrategyCardProps {
	strategy: {
		id: string;
		name: string;
		description: string | null;
		color: string | null;
		coverImageUrl?: string | null;
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

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Strategy card component with cover image/gradient and stats.
 *
 * Features:
 * - Cover image at top (16:9 cropped to ~120px) or gradient fallback
 * - Strategy name with color bar accent
 * - Description truncated to 2 lines
 * - Stats row: trades, win rate, rules
 * - Hover effect: scale + shadow
 * - Actions menu in top-right of cover
 * - Click navigates to detail page
 */
export function StrategyCard({
	strategy,
	stats,
	onEdit,
	onDuplicate,
	onDelete,
	isMobile = false,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";
	const hasCoverImage = !!strategy.coverImageUrl;

	return (
		<div
			className={cn(
				"group relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-200",
				"hover:scale-[1.02] hover:border-primary/30 hover:shadow-black/20 hover:shadow-lg",
				!strategy.isActive && "opacity-60",
			)}
			data-testid="strategy-card"
		>
			{/* Cover image/gradient */}
			<div className="relative h-28 w-full overflow-hidden sm:h-32">
				{hasCoverImage ? (
					<Image
						alt={`${strategy.name} cover`}
						className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
						fill
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						src={strategy.coverImageUrl ?? ""}
					/>
				) : (
					<div
						className="h-full w-full"
						style={{
							background: `linear-gradient(135deg, ${color} 0%, ${color}66 100%)`,
						}}
					/>
				)}

				{/* Gradient overlay for text visibility */}
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

				{/* Actions menu - positioned on cover */}
				<div className="absolute top-2 right-2 z-10">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className={cn(
									"h-8 w-8 bg-black/40 backdrop-blur-sm transition-opacity hover:bg-black/60",
									isMobile
										? "opacity-100"
										: "opacity-0 group-hover:opacity-100",
								)}
								size="icon"
								variant="ghost"
							>
								<MoreVertical className="h-4 w-4 text-white" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								className="min-h-[44px] cursor-pointer font-mono text-xs sm:min-h-0"
								onClick={onEdit}
							>
								<Pencil className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								className="min-h-[44px] cursor-pointer font-mono text-xs sm:min-h-0"
								onClick={onDuplicate}
							>
								<Copy className="mr-2 h-4 w-4" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="min-h-[44px] cursor-pointer font-mono text-loss text-xs focus:text-loss sm:min-h-0"
								onClick={onDelete}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Inactive badge */}
				{!strategy.isActive && (
					<Badge
						className="absolute top-2 left-2 font-mono text-[10px]"
						variant="secondary"
					>
						Inactive
					</Badge>
				)}
			</div>

			{/* Content area */}
			<div className="p-4">
				{/* Name with color bar */}
				<div className="flex items-start gap-2">
					<div
						className="mt-1.5 h-4 w-1 shrink-0 rounded-full"
						style={{ backgroundColor: color }}
					/>
					<Link
						className="flex-1 font-mono font-semibold text-base transition-colors hover:text-primary"
						href={`/strategies/${strategy.id}`}
					>
						{strategy.name}
					</Link>
				</div>

				{/* Description */}
				{strategy.description && (
					<p className="mt-2 line-clamp-2 font-mono text-muted-foreground text-xs">
						{strategy.description}
					</p>
				)}

				{/* Stats row */}
				<div className="mt-4 flex items-center justify-between gap-4 border-border border-t pt-3">
					{/* Trades */}
					<div className="text-center">
						<div className="font-bold font-mono text-lg">
							{strategy._count.trades}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Trades
						</div>
					</div>

					{/* Win Rate */}
					<div className="text-center">
						{stats && strategy._count.trades > 0 ? (
							<>
								<div
									className={cn(
										"flex items-center justify-center gap-1 font-bold font-mono text-lg",
										stats.winRate >= 50 ? "text-profit" : "text-loss",
									)}
								>
									<TrendingUp className="h-4 w-4" />
									{stats.winRate.toFixed(0)}%
								</div>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Win Rate
								</div>
							</>
						) : (
							<>
								<div className="font-mono text-lg text-muted-foreground">—</div>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Win Rate
								</div>
							</>
						)}
					</div>

					{/* Rules */}
					<div className="text-center">
						<div className="font-bold font-mono text-lg">
							{strategy._count.rules}
						</div>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Rules
						</div>
					</div>
				</div>

				{/* P&L if available */}
				{stats && strategy._count.trades > 0 && (
					<div className="mt-3 flex items-center justify-between border-border border-t pt-3">
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Total P&L
						</span>
						<span
							className={cn(
								"font-bold font-mono text-sm",
								stats.totalPnl >= 0 ? "text-profit" : "text-loss",
							)}
						>
							{formatCurrency(stats.totalPnl)}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
