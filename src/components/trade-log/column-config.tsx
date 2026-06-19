import { Columns3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TradeColumn } from "@/hooks/use-trade-columns";

interface ColumnConfigProps {
	columns: TradeColumn[];
	onToggle: (columnId: string) => void;
	onReset: () => void;
}

export function ColumnConfig({
	columns,
	onToggle,
	onReset,
}: ColumnConfigProps) {
	// Filter out non-configurable columns
	const configurableColumns = columns.filter(
		(col) => col.id !== "checkbox" && col.id !== "actions",
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className="font-mono text-xs uppercase tracking-wider"
					size="sm"
					variant="outline"
				>
					<Columns3 className="mr-2 h-3.5 w-3.5" />
					Columns
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Visible Columns
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{configurableColumns.map((column) => (
					<DropdownMenuItem
						className="flex items-center gap-2 font-mono text-xs"
						key={column.id}
						onSelect={(e) => {
							e.preventDefault();
							onToggle(column.id);
						}}
					>
						<Checkbox
							checked={column.visible}
							className="h-3.5 w-3.5"
							onCheckedChange={() => onToggle(column.id)}
						/>
						{column.label}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="font-mono text-muted-foreground text-xs"
					onClick={onReset}
				>
					<RotateCcw className="mr-2 h-3.5 w-3.5" />
					Reset to Default
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
