import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface Execution {
	id: string;
	executionType: "entry" | "exit" | "scale_in" | "scale_out";
	price: string;
	quantity: string;
	executedAt: string | Date;
	fees?: string | null;
	realizedPnl?: string | null;
	notes?: string | null;
}

interface ExecutionTimelineProps {
	executions: Execution[];
	onAddExecution?: (execution: Omit<Execution, "id">) => void;
	onDeleteExecution?: (id: string) => void;
	instrumentType?: string;
	className?: string;
}

// =============================================================================
// EXECUTION TIMELINE
// =============================================================================

export function ExecutionTimeline({
	executions,
	onAddExecution,
	onDeleteExecution,
	instrumentType = "futures",
	className,
}: ExecutionTimelineProps) {
	const { formatDate, formatTime } = useTimezone();
	const [isAddingExecution, setIsAddingExecution] = useState(false);
	const [newExecution, setNewExecution] = useState({
		executionType: "entry" as Execution["executionType"],
		price: "",
		quantity: "",
		executedAt: new Date().toISOString().slice(0, 16), // datetime-local format
		fees: "",
	});

	// Sort executions by time
	const sortedExecutions = [...executions].sort(
		(a, b) =>
			new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
	);

	function getExecutionLabel(type: Execution["executionType"]) {
		switch (type) {
			case "entry":
				return "Entry";
			case "scale_in":
				return "Scale In";
			case "scale_out":
				return "Scale Out";
			case "exit":
				return "Exit";
			default:
				return type;
		}
	}

	function isAddType(type: Execution["executionType"]) {
		return type === "entry" || type === "scale_in";
	}

	function handleAddExecution() {
		if (!newExecution.price || !newExecution.quantity) return;

		onAddExecution?.({
			executionType: newExecution.executionType,
			price: newExecution.price,
			quantity: newExecution.quantity,
			executedAt: new Date(newExecution.executedAt).toISOString(),
			fees: newExecution.fees || null,
		});

		setIsAddingExecution(false);
		setNewExecution({
			executionType: "entry",
			price: "",
			quantity: "",
			executedAt: new Date().toISOString().slice(0, 16),
			fees: "",
		});
	}

	const sizeLabel = instrumentType === "futures" ? "cts" : "lots";

	if (sortedExecutions.length === 0 && !onAddExecution) {
		return null;
	}

	return (
		<div className={cn("space-y-3", className)}>
			{sortedExecutions.length > 0 ? (
				<div className="space-y-1">
					{sortedExecutions.map((execution) => (
						<div
							className="group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-white/2"
							key={execution.id}
						>
							{/* Icon */}
							<div
								className={cn(
									"flex h-6 w-6 shrink-0 items-center justify-center rounded",
									isAddType(execution.executionType)
										? "bg-profit/10 text-profit"
										: "bg-loss/10 text-loss",
								)}
							>
								{isAddType(execution.executionType) ? (
									<Plus className="h-3.5 w-3.5" />
								) : (
									<Minus className="h-3.5 w-3.5" />
								)}
							</div>

							{/* Type */}
							<span className="w-20 font-mono text-muted-foreground text-xs">
								{getExecutionLabel(execution.executionType)}
							</span>

							{/* Quantity & Price */}
							<span className="font-mono text-sm">
								{parseFloat(execution.quantity).toLocaleString()} {sizeLabel} @{" "}
								{parseFloat(execution.price).toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 5,
								})}
							</span>

							{/* P&L for exits */}
							{execution.realizedPnl && (
								<span
									className={cn(
										"font-mono text-xs",
										parseFloat(execution.realizedPnl) >= 0
											? "text-profit"
											: "text-loss",
									)}
								>
									{parseFloat(execution.realizedPnl) >= 0 ? "+" : ""}$
									{parseFloat(execution.realizedPnl).toLocaleString(undefined, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</span>
							)}

							{/* Time */}
							<span className="ml-auto font-mono text-muted-foreground text-xs">
								{formatDate(execution.executedAt)}{" "}
								{formatTime(execution.executedAt)}
							</span>

							{/* Delete button (on hover) */}
							{onDeleteExecution && (
								<button
									className="ml-2 opacity-0 transition-opacity group-hover:opacity-100"
									onClick={() => onDeleteExecution(execution.id)}
									type="button"
								>
									<Minus className="h-4 w-4 text-muted-foreground hover:text-loss" />
								</button>
							)}
						</div>
					))}
				</div>
			) : (
				<p className="py-4 text-center font-mono text-muted-foreground text-xs">
					No executions recorded
				</p>
			)}

			{/* Add Execution Button */}
			{onAddExecution && (
				<Button
					className="w-full font-mono text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground"
					onClick={() => setIsAddingExecution(true)}
					size="sm"
					variant="ghost"
				>
					<Plus className="mr-2 h-3.5 w-3.5" />
					Add Execution
				</Button>
			)}

			{/* Add Execution Dialog */}
			<Dialog onOpenChange={setIsAddingExecution} open={isAddingExecution}>
				<DialogContent className="border-white/10 bg-background">
					<DialogHeader>
						<DialogTitle className="font-mono uppercase tracking-wider">
							Add Execution
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">
							Record an entry, exit, or scaling execution
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Type */}
						<div className="space-y-1">
							<label
								className="font-mono text-[11px] text-muted-foreground uppercase"
								htmlFor="exec-type"
							>
								Type
							</label>
							<select
								className="h-9 w-full rounded border border-white/10 bg-transparent px-3 font-mono text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
								id="exec-type"
								onChange={(e) =>
									setNewExecution({
										...newExecution,
										executionType: e.target.value as Execution["executionType"],
									})
								}
								value={newExecution.executionType}
							>
								<option value="entry">Entry</option>
								<option value="scale_in">Scale In</option>
								<option value="scale_out">Scale Out</option>
								<option value="exit">Exit</option>
							</select>
						</div>

						{/* Price & Quantity */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<label
									className="font-mono text-[11px] text-muted-foreground uppercase"
									htmlFor="exec-price"
								>
									Price
								</label>
								<Input
									className="font-mono"
									id="exec-price"
									onChange={(e) =>
										setNewExecution({ ...newExecution, price: e.target.value })
									}
									placeholder="0.00"
									step="any"
									type="number"
									value={newExecution.price}
								/>
							</div>
							<div className="space-y-1">
								<label
									className="font-mono text-[11px] text-muted-foreground uppercase"
									htmlFor="exec-quantity"
								>
									Quantity
								</label>
								<Input
									className="font-mono"
									id="exec-quantity"
									onChange={(e) =>
										setNewExecution({
											...newExecution,
											quantity: e.target.value,
										})
									}
									placeholder="1"
									step="any"
									type="number"
									value={newExecution.quantity}
								/>
							</div>
						</div>

						{/* Date/Time */}
						<div className="space-y-1">
							<label
								className="font-mono text-[11px] text-muted-foreground uppercase"
								htmlFor="exec-datetime"
							>
								Date & Time
							</label>
							<Input
								className="font-mono"
								id="exec-datetime"
								onChange={(e) =>
									setNewExecution({
										...newExecution,
										executedAt: e.target.value,
									})
								}
								type="datetime-local"
								value={newExecution.executedAt}
							/>
						</div>

						{/* Fees */}
						<div className="space-y-1">
							<label
								className="font-mono text-[11px] text-muted-foreground uppercase"
								htmlFor="exec-fees"
							>
								Fees (optional)
							</label>
							<Input
								className="font-mono"
								id="exec-fees"
								onChange={(e) =>
									setNewExecution({ ...newExecution, fees: e.target.value })
								}
								placeholder="0.00"
								step="any"
								type="number"
								value={newExecution.fees}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button onClick={() => setIsAddingExecution(false)} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={!newExecution.price || !newExecution.quantity}
							onClick={handleAddExecution}
						>
							Add Execution
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
