"use client";

import { AlertCircle, ClipboardCheck } from "lucide-react";
import { useCallback, useId, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared";
import {
	type ConditionalChecklistItem,
	generateConditionalChecklists,
	type StrategyForConditionalChecklist,
} from "@/lib/strategies/conditional-checklists";
import { calculateAchievedR } from "@/lib/strategies/risk-compliance";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface ConditionalChecklistDisplayProps {
	trade: {
		id: string;
		symbol: string;
		instrumentType: "futures" | "forex";
		direction: "long" | "short";
		entryPrice: string;
		exitPrice: string | null;
		stopLoss: string | null;
		takeProfit: string | null;
		quantity: string;
		netPnl: string | null;
		strategyId: string | null;
	};
	className?: string;
}

// =============================================================================
// CHECKLIST ITEM COMPONENT
// =============================================================================

interface ChecklistItemProps {
	item: ConditionalChecklistItem;
	isChecked: boolean;
	onToggle: (checked: boolean) => void;
	isLoading: boolean;
}

function ChecklistItem({
	item,
	isChecked,
	onToggle,
	isLoading,
}: ChecklistItemProps) {
	const checkboxId = useId();

	if (!item.triggered) {
		// Non-triggered item - grayed out
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className="flex items-center gap-3 rounded-sm bg-white/1 px-2.5 py-2 opacity-50"
						data-testid={`checklist-item-${item.id}-disabled`}
					>
						<div className="flex h-4 w-4 items-center justify-center rounded border border-white/10 bg-white/5">
							<span className="text-[10px] text-muted-foreground">—</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="font-mono text-[11px] text-muted-foreground line-through">
								{item.label}
							</span>
							<span className="font-mono text-[9px] text-muted-foreground/60">
								Trade didn&apos;t hit {item.triggerR}R
							</span>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent className="max-w-[250px]" side="top">
					<p className="font-mono text-xs">{item.description}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	// Triggered item - checkable
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-sm px-2.5 py-2 transition-colors",
				isChecked ? "bg-profit/5" : "bg-white/2 hover:bg-white/3",
			)}
			data-testid={`checklist-item-${item.id}`}
		>
			<Checkbox
				checked={isChecked}
				disabled={isLoading}
				id={checkboxId}
				onCheckedChange={(checked) => onToggle(checked === true)}
			/>
			<label
				className={cn(
					"flex cursor-pointer flex-col gap-0.5",
					isLoading && "pointer-events-none opacity-50",
				)}
				htmlFor={checkboxId}
			>
				<span
					className={cn(
						"font-mono text-[11px] transition-colors",
						isChecked ? "text-profit" : "text-foreground",
					)}
				>
					{item.label}
				</span>
				<span className="font-mono text-[9px] text-muted-foreground/70">
					{isChecked
						? "Confirmed"
						: `Confirm you followed this rule at ${item.triggerR}R`}
				</span>
			</label>
		</div>
	);
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ChecklistSkeleton() {
	return (
		<div className="space-y-2" data-testid="checklist-skeleton">
			<Skeleton className="h-4 w-32" />
			<div className="space-y-1.5">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ConditionalChecklistDisplay({
	trade,
	className,
}: ConditionalChecklistDisplayProps) {
	const utils = api.useUtils();

	// Fetch strategy to get trailing/scaling rules
	const { data: strategy, isLoading: isLoadingStrategy } =
		api.strategies.getById.useQuery(
			{ id: trade.strategyId ?? "" },
			{ enabled: !!trade.strategyId },
		);

	// Fetch existing rule checks for this trade
	const { data: ruleChecksData, isLoading: isLoadingChecks } =
		api.strategies.getTradeRuleChecks.useQuery(
			{ tradeId: trade.id },
			{ enabled: !!trade.strategyId },
		);

	// Check rule mutation - simple invalidation pattern (fast enough without optimistic updates)
	const checkRuleMutation = api.strategies.checkRule.useMutation({
		onSuccess: () => {
			// Refresh data after successful save
			utils.strategies.getTradeRuleChecks.invalidate({ tradeId: trade.id });
		},
	});

	// Generate conditional checklist items
	const checklistItems = useMemo(() => {
		if (!strategy) return [];

		// Build strategy for checklist generation
		const strategyForChecklist: StrategyForConditionalChecklist = {
			id: strategy.id,
			trailingRules:
				strategy.trailingRules as StrategyForConditionalChecklist["trailingRules"],
			scalingRules:
				strategy.scalingRules as StrategyForConditionalChecklist["scalingRules"],
			targetRMultiples: strategy.riskParameters?.targetRMultiples ?? null,
		};

		// Convert trade data
		const tradeData = {
			id: trade.id,
			symbol: trade.symbol,
			instrumentType: trade.instrumentType,
			direction: trade.direction,
			entryPrice: parseFloat(trade.entryPrice),
			exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice) : null,
			stopLoss: trade.stopLoss ? parseFloat(trade.stopLoss) : null,
			takeProfit: trade.takeProfit ? parseFloat(trade.takeProfit) : null,
			quantity: parseFloat(trade.quantity),
			realizedPnl: trade.netPnl ? parseFloat(trade.netPnl) : null,
		};

		return generateConditionalChecklists(tradeData, strategyForChecklist);
	}, [strategy, trade]);

	// Build a map of rule checks for quick lookup
	const checkMap = useMemo(() => {
		const map = new Map<string, boolean>();
		if (ruleChecksData?.checks) {
			for (const check of ruleChecksData.checks) {
				map.set(check.ruleId, check.checked);
			}
		}
		return map;
	}, [ruleChecksData]);

	// Handle toggle
	const handleToggle = useCallback(
		(itemId: string, checked: boolean) => {
			checkRuleMutation.mutate({
				tradeId: trade.id,
				ruleId: itemId,
				checked,
			});
		},
		[checkRuleMutation, trade.id],
	);

	// Calculate achieved R for display
	const achievedR = useMemo(() => {
		const tradeData = {
			id: trade.id,
			symbol: trade.symbol,
			instrumentType: trade.instrumentType,
			direction: trade.direction,
			entryPrice: parseFloat(trade.entryPrice),
			exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice) : null,
			stopLoss: trade.stopLoss ? parseFloat(trade.stopLoss) : null,
			takeProfit: trade.takeProfit ? parseFloat(trade.takeProfit) : null,
			quantity: parseFloat(trade.quantity),
			realizedPnl: trade.netPnl ? parseFloat(trade.netPnl) : null,
		};
		return calculateAchievedR(tradeData);
	}, [trade]);

	// No strategy assigned
	if (!trade.strategyId) {
		return null;
	}

	// Loading state
	if (isLoadingStrategy || isLoadingChecks) {
		return (
			<div className={cn("space-y-3", className)}>
				<ChecklistSkeleton />
			</div>
		);
	}

	// No conditional rules configured
	if (checklistItems.length === 0) {
		return (
			<div className={cn("space-y-3", className)} data-testid="checklist-empty">
				<div className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
					Conditional Checklist
				</div>
				<div className="flex items-center gap-2 rounded-sm bg-white/2 px-2.5 py-2">
					<AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
					<span className="font-mono text-[11px] text-muted-foreground">
						No management rules configured
					</span>
				</div>
			</div>
		);
	}

	// Calculate completion stats
	const triggeredItems = checklistItems.filter((item) => item.triggered);
	const checkedCount = triggeredItems.filter((item) =>
		checkMap.get(item.id),
	).length;
	const completionPercent =
		triggeredItems.length > 0
			? Math.round((checkedCount / triggeredItems.length) * 100)
			: 0;

	return (
		<div
			className={cn("space-y-3", className)}
			data-testid="conditional-checklist"
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground/70" />
					<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
						Conditional Checklist
					</span>
				</div>
				{triggeredItems.length > 0 && (
					<span
						className={cn(
							"font-mono text-[11px] tabular-nums",
							completionPercent === 100 && "text-profit",
							completionPercent > 0 &&
								completionPercent < 100 &&
								"text-breakeven",
							completionPercent === 0 && "text-muted-foreground",
						)}
						data-testid="checklist-completion"
					>
						{checkedCount}/{triggeredItems.length} confirmed
					</span>
				)}
			</div>

			{/* Achieved R indicator */}
			{achievedR !== null && (
				<div className="flex items-center gap-2 rounded-sm bg-white/1 px-2.5 py-1.5">
					<span className="font-mono text-[10px] text-muted-foreground">
						Trade Result:
					</span>
					<span
						className={cn(
							"font-mono text-[11px] tabular-nums",
							achievedR >= 0 ? "text-profit" : "text-loss",
						)}
						data-testid="achieved-r-display"
					>
						{achievedR >= 0 ? "+" : ""}
						{achievedR.toFixed(2)}R
					</span>
				</div>
			)}

			{/* Checklist items */}
			<div className="space-y-1.5" data-testid="checklist-items">
				{checklistItems.map((item) => (
					<ChecklistItem
						isChecked={checkMap.get(item.id) ?? false}
						isLoading={checkRuleMutation.isPending}
						item={item}
						key={item.id}
						onToggle={(checked) => handleToggle(item.id, checked)}
					/>
				))}
			</div>

			{/* Summary for triggered items */}
			{triggeredItems.length > 0 && checkedCount === triggeredItems.length && (
				<div
					className="flex items-center gap-2 rounded-sm bg-profit/5 px-2.5 py-1.5"
					data-testid="checklist-complete-message"
				>
					<ClipboardCheck className="h-3.5 w-3.5 text-profit" />
					<span className="font-mono text-[11px] text-profit">
						All triggered rules confirmed
					</span>
				</div>
			)}
		</div>
	);
}
