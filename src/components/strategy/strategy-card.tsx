"use client";

import { Copy, ListChecks, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { StrategyStatsSummary } from "@/components/strategy/strategy-stats-summary";
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
	onEdit?: () => void;
	onDuplicate?: () => void;
	onDelete?: () => void;
	isMobile?: boolean;
}

export function StrategyCard({
	strategy,
	onEdit,
	onDuplicate,
	onDelete,
	isMobile = false,
}: StrategyCardProps) {
	const color = strategy.color ?? "#d4ff00";

	return (
		<div
			className={cn(
				"group hover:-translate-y-0.5 relative rounded border border-white/5 bg-white/1 p-4 transition-all hover:border-white/10 sm:p-5",
				!strategy.isActive && "opacity-60",
			)}
			data-testid={`strategy-card-${strategy.id}`}
		>
			{/* Color bar on left edge - 4px wide, full height */}
			<div
				className="absolute top-0 left-0 h-full w-1 rounded-l"
				style={{ backgroundColor: color }}
			/>

			{/* Header */}
			<div className="mb-3 flex items-start justify-between gap-2 pl-2 sm:mb-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Link
							className="font-mono font-semibold text-base transition-colors hover:text-primary sm:text-lg"
							data-testid={`strategy-card-link-${strategy.id}`}
							href={`/strategies/${strategy.id}`}
						>
							{strategy.name}
						</Link>
						{!strategy.isActive && (
							<Badge
								className="font-mono text-[10px]"
								data-testid={`strategy-card-inactive-badge-${strategy.id}`}
								variant="secondary"
							>
								Inactive
							</Badge>
						)}
					</div>
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
							data-testid={`strategy-card-menu-${strategy.id}`}
							size="icon"
							variant="ghost"
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="min-h-[44px] sm:min-h-0"
							data-testid={`strategy-card-edit-${strategy.id}`}
							onClick={onEdit}
						>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							className="min-h-[44px] sm:min-h-0"
							data-testid={`strategy-card-duplicate-${strategy.id}`}
							onClick={onDuplicate}
						>
							<Copy className="mr-2 h-4 w-4" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="min-h-[44px] text-loss focus:text-loss sm:min-h-0"
							data-testid={`strategy-card-delete-${strategy.id}`}
							onClick={onDelete}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Stats row using StrategyStatsSummary compact mode */}
			<div className="mb-3 pl-2 sm:mb-4">
				<StrategyStatsSummary compact strategyId={strategy.id} />
			</div>

			{/* Footer: Rules count badge */}
			<div className="flex items-center gap-2 border-border border-t pt-3 pl-2 sm:pt-4">
				<Badge
					className="gap-1 font-mono text-[10px]"
					data-testid={`strategy-card-rules-badge-${strategy.id}`}
					variant="outline"
				>
					<ListChecks className="h-3 w-3" />
					{strategy._count.rules}{" "}
					{strategy._count.rules === 1 ? "rule" : "rules"}
				</Badge>
			</div>
		</div>
	);
}
