"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { NON_SORTABLE_COLUMNS, type TradeSort } from "@/lib/constants";
import { cn } from "@/lib/shared";

interface SortableHeaderProps {
	columnId: string;
	label: string;
	sort: TradeSort;
	onSort: (columnId: string) => void;
	className?: string;
}

export function SortableHeader({
	columnId,
	label,
	sort,
	onSort,
	className,
}: SortableHeaderProps) {
	const isSortable = !NON_SORTABLE_COLUMNS.includes(columnId);
	const isActive = sort.field === columnId;

	if (!isSortable || !label) {
		return <span className={className}>{label}</span>;
	}

	return (
		<button
			className={cn(
				"flex items-center gap-1 transition-colors hover:text-foreground",
				className,
			)}
			onClick={() => onSort(columnId)}
			type="button"
		>
			{label}
			{isActive ? (
				sort.direction === "asc" ? (
					<ArrowUp className="h-3 w-3 text-primary" />
				) : (
					<ArrowDown className="h-3 w-3 text-primary" />
				)
			) : (
				<ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
			)}
		</button>
	);
}
