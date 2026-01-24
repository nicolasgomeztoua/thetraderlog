"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useOptimisticState } from "@/hooks/use-debounced-mutation";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

interface Rule {
	id: string;
	text: string;
	category: "entry" | "exit" | "risk" | "management";
	order: number;
}

interface RuleCheck {
	ruleId: string;
	checked: boolean;
}

interface RuleChecklistProps {
	tradeId: string;
	rules: Rule[];
	checks: RuleCheck[];
	onUpdate?: () => void;
	onComplianceChange?: (compliance: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
	entry: "Entry Rules",
	exit: "Exit Rules",
	risk: "Risk Rules",
	management: "Management Rules",
};

const CATEGORY_COLORS: Record<string, string> = {
	entry: "text-profit",
	exit: "text-loss",
	risk: "text-breakeven",
	management: "text-accent",
};

export function RuleChecklist({
	tradeId,
	rules,
	checks,
	onUpdate,
	onComplianceChange,
}: RuleChecklistProps) {
	// Use shared optimistic state utility
	const {
		applyUpdate: applyOptimisticUpdate,
		clearUpdate: clearOptimisticUpdate,
		updates: optimisticUpdates,
	} = useOptimisticState<{ checked: boolean }>();

	// Track in-flight mutations per rule to prevent premature clearing of optimistic state
	const inFlightMutationsRef = useRef<Map<string, number>>(new Map());

	const checkRule = api.strategies.checkRule.useMutation({
		onMutate: ({ ruleId, checked }) => {
			// Increment in-flight count for this rule
			const currentCount = inFlightMutationsRef.current.get(ruleId) ?? 0;
			inFlightMutationsRef.current.set(ruleId, currentCount + 1);
			// Apply optimistic update immediately
			applyOptimisticUpdate(ruleId, { checked });
		},
		onError: (_error, variables) => {
			// Decrement in-flight count
			const currentCount =
				inFlightMutationsRef.current.get(variables.ruleId) ?? 1;
			const newCount = currentCount - 1;
			if (newCount <= 0) {
				inFlightMutationsRef.current.delete(variables.ruleId);
				// Only clear optimistic state if no more mutations in flight
				clearOptimisticUpdate(variables.ruleId);
			} else {
				inFlightMutationsRef.current.set(variables.ruleId, newCount);
			}
			toast.error("Failed to update rule");
		},
		onSettled: async (_data, error, variables) => {
			// Skip if onError already handled this
			if (error) return;

			// Decrement in-flight count
			const currentCount =
				inFlightMutationsRef.current.get(variables.ruleId) ?? 1;
			const newCount = currentCount - 1;

			if (newCount <= 0) {
				inFlightMutationsRef.current.delete(variables.ruleId);
				// Only refetch and clear optimistic state when last mutation completes
				await onUpdate?.();
				clearOptimisticUpdate(variables.ruleId);
			} else {
				inFlightMutationsRef.current.set(variables.ruleId, newCount);
			}
		},
	});

	const handleCheck = useCallback(
		(ruleId: string, checked: boolean) => {
			checkRule.mutate({ tradeId, ruleId, checked });
		},
		[tradeId, checkRule],
	);

	// Group rules by category
	const groupedRules = useMemo(() => {
		const groups: Record<string, Rule[]> = {};
		for (const rule of rules) {
			const category = rule.category;
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(rule);
		}
		return groups;
	}, [rules]);

	// Get check status for a rule (with optimistic updates)
	const isChecked = useCallback(
		(ruleId: string): boolean => {
			// Check optimistic state first
			const optimistic = optimisticUpdates.get(ruleId);
			if (optimistic?.checked !== undefined) {
				return optimistic.checked;
			}
			// Fall back to server data
			return checks.find((c) => c.ruleId === ruleId)?.checked ?? false;
		},
		[optimisticUpdates, checks],
	);

	// Calculate optimistic compliance
	const optimisticCompliance = useMemo(() => {
		if (rules.length === 0) return 100;
		const checkedCount = rules.filter((r) => isChecked(r.id)).length;
		return (checkedCount / rules.length) * 100;
	}, [rules, isChecked]);

	// Notify parent of compliance changes
	useEffect(() => {
		onComplianceChange?.(optimisticCompliance);
	}, [optimisticCompliance, onComplianceChange]);

	if (rules.length === 0) {
		return (
			<div className="py-8 text-center">
				<p className="font-mono text-muted-foreground text-sm">
					No rules defined for this strategy
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Compliance indicator */}
			<div className="flex items-center justify-between rounded border border-white/10 bg-white/3 p-4">
				<div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Rule Compliance
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-2xl",
							optimisticCompliance >= 80
								? "text-profit"
								: optimisticCompliance >= 50
									? "text-breakeven"
									: "text-loss",
						)}
					>
						{optimisticCompliance.toFixed(0)}%
					</div>
				</div>

				<div className="flex items-center gap-2">
					{optimisticCompliance >= 80 ? (
						<CheckCircle2 className="h-8 w-8 text-profit" />
					) : (
						<Circle className="h-8 w-8 text-muted-foreground" />
					)}
				</div>
			</div>

			{/* Rules by category */}
			{(["entry", "exit", "risk", "management"] as const).map((category) => {
				const categoryRules = groupedRules[category];
				if (!categoryRules || categoryRules.length === 0) return null;

				return (
					<div key={category}>
						<h4
							className={cn(
								"mb-3 font-mono text-[11px] uppercase tracking-wider",
								CATEGORY_COLORS[category],
							)}
						>
							{CATEGORY_LABELS[category]}
						</h4>
						<div className="space-y-2">
							{categoryRules
								.sort((a, b) => a.order - b.order)
								.map((rule) => {
									const checked = isChecked(rule.id);
									const checkboxId = `rule-check-${rule.id}`;
									return (
										<div
											className={cn(
												"flex cursor-pointer items-start gap-3 rounded border border-white/5 bg-white/1 p-3 transition-all hover:border-white/10",
												checked && "border-profit/20 bg-profit/5",
											)}
											key={rule.id}
										>
											<Checkbox
												checked={checked}
												className="mt-0.5"
												id={checkboxId}
												onCheckedChange={(value) =>
													handleCheck(rule.id, value === true)
												}
											/>
											<label
												className={cn(
													"flex-1 cursor-pointer font-mono text-sm",
													checked ? "text-foreground" : "text-muted-foreground",
												)}
												htmlFor={checkboxId}
											>
												{rule.text}
											</label>
										</div>
									);
								})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
