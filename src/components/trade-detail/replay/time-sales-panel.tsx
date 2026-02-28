"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/shared";
import type { ReplayExecution } from "./use-replay-engine";

// =============================================================================
// TYPES
// =============================================================================

interface TimeSalesPanelProps {
	executions: ReplayExecution[];
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TimeSalesPanel({ executions, className }: TimeSalesPanelProps) {
	const { formatTime } = useTimezone();
	const scrollRef = useRef<HTMLDivElement>(null);
	const lastExecutionCountRef = useRef(0);

	// Auto-scroll to bottom when new executions appear
	useEffect(() => {
		if (
			executions.length > lastExecutionCountRef.current &&
			scrollRef.current
		) {
			const scrollContainer = scrollRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}
		lastExecutionCountRef.current = executions.length;
	}, [executions.length]);

	const getExecutionLabel = (type: ReplayExecution["executionType"]) => {
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
	};

	const isAddType = (type: ReplayExecution["executionType"]) => {
		return type === "entry" || type === "scale_in";
	};

	const sizeLabel = "cts";

	// Sort executions by time (most recent first for display)
	const sortedExecutions = [...executions].sort(
		(a, b) =>
			new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
	);

	return (
		<div
			className={cn(
				"flex h-full flex-col rounded-lg border border-border bg-muted/50",
				className,
			)}
		>
			{/* Header */}
			<div className="shrink-0 border-border border-b px-3 py-2">
				<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Time & Sales
				</h3>
			</div>

			{/* Execution Feed */}
			<ScrollArea className="flex-1" ref={scrollRef}>
				<div className="p-2">
					{sortedExecutions.length > 0 ? (
						<div className="space-y-1">
							{sortedExecutions.map((execution, index) => (
								<div
									className={cn(
										"flex items-center gap-2 rounded px-2 py-1.5 transition-all",
										// Highlight most recent execution
										index === 0 && "bg-muted/50",
									)}
									key={execution.id}
								>
									{/* Icon */}
									<div
										className={cn(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded",
											isAddType(execution.executionType)
												? "bg-profit/10 text-profit"
												: "bg-loss/10 text-loss",
										)}
									>
										{isAddType(execution.executionType) ? (
											<Plus className="h-3 w-3" />
										) : (
											<Minus className="h-3 w-3" />
										)}
									</div>

									{/* Details */}
									<div className="min-w-0 flex-1">
										{/* Type & Price */}
										<div className="flex items-baseline gap-2">
											<span className="font-mono text-[11px] text-muted-foreground">
												{getExecutionLabel(execution.executionType)}
											</span>
											<span className="font-mono text-xs">
												{parseFloat(execution.price).toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 5,
												})}
											</span>
										</div>

										{/* Quantity & Time */}
										<div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
											<span>
												{parseFloat(execution.quantity).toLocaleString()}{" "}
												{sizeLabel}
											</span>
											<span className="opacity-50">
												{formatTime(execution.executedAt)}
											</span>
										</div>
									</div>

									{/* P&L (for exits/scale-outs) */}
									{execution.realizedPnl && (
										<span
											className={cn(
												"shrink-0 font-mono text-[11px]",
												parseFloat(execution.realizedPnl) >= 0
													? "text-profit"
													: "text-loss",
											)}
										>
											{parseFloat(execution.realizedPnl) >= 0 ? "+" : ""}$
											{parseFloat(execution.realizedPnl).toLocaleString(
												undefined,
												{
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												},
											)}
										</span>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="flex h-32 flex-col items-center justify-center text-center">
							<p className="font-mono text-[11px] text-muted-foreground">
								No executions yet
							</p>
							<p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
								Executions will appear as the replay progresses
							</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Footer - Running Summary */}
			{executions.length > 0 && (
				<div className="shrink-0 border-border border-t px-3 py-2">
					<div className="flex items-center justify-between font-mono text-[10px]">
						<span className="text-muted-foreground uppercase tracking-wider">
							Executions
						</span>
						<span>{executions.length}</span>
					</div>
				</div>
			)}
		</div>
	);
}
