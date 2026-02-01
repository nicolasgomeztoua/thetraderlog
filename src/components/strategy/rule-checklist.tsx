"use client";

import { CheckCircle, CheckCircle2, Circle, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useOptimisticState } from "@/hooks/use-debounced-mutation";
import { cn } from "@/lib/shared";
import type { AutoEvaluationResult, RuleType } from "@/lib/strategy";
import { api } from "@/trpc/react";

interface Rule {
	id: string;
	text: string;
	category: "entry" | "exit" | "risk" | "management";
	order: number;
	ruleType?: RuleType;
}

interface RuleCheck {
	ruleId: string;
	checked: boolean;
	evaluationResult?: string | null;
	wasAutoEvaluated?: boolean;
	userOverride?: boolean | null;
}

interface RuleChecklistProps {
	tradeId: string;
	rules: Rule[];
	checks: RuleCheck[];
	relevantRuleIds?: string[];
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

// Helper to parse evaluation result JSON
function parseEvaluationResult(
	jsonStr: string | null | undefined,
): AutoEvaluationResult | null {
	if (!jsonStr) return null;
	try {
		return JSON.parse(jsonStr) as AutoEvaluationResult;
	} catch {
		return null;
	}
}

// Format actual/expected for display
function formatEvalValue(value: number | string | null): string {
	if (value === null) return "N/A";
	if (typeof value === "number") {
		// Format numbers nicely (e.g., percentages, dollar amounts)
		if (Math.abs(value) >= 1000) {
			return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
		}
		return value.toFixed(2);
	}
	return String(value);
}

export function RuleChecklist({
	tradeId,
	rules,
	checks,
	relevantRuleIds,
	onComplianceChange,
}: RuleChecklistProps) {
	// Track which rules are in override mode (user clicked Override button)
	const [overrideMode, setOverrideMode] = useState<Set<string>>(new Set());

	// Use shared optimistic state utility
	const {
		applyUpdate: applyOptimisticUpdate,
		clearUpdate: clearOptimisticUpdate,
		updates: optimisticUpdates,
	} = useOptimisticState<{ checked: boolean }>();

	const checkRule = api.strategies.checkRule.useMutation({
		onMutate: ({ ruleId, checked }) => {
			// Apply optimistic update immediately - this IS the source of truth
			applyOptimisticUpdate(ruleId, { checked });
		},
		onError: (_error, variables) => {
			// Only revert on actual error
			clearOptimisticUpdate(variables.ruleId);
			toast.error("Failed to update rule");
		},
		// No onSettled - we don't refetch or clear optimistic state
		// The optimistic state IS correct, backend just persists quietly
	});

	const handleCheck = useCallback(
		(ruleId: string, checked: boolean, isOverride = false) => {
			checkRule.mutate({
				tradeId,
				ruleId,
				checked,
				userOverride: isOverride ? true : undefined,
			});
		},
		[tradeId, checkRule],
	);

	const toggleOverrideMode = useCallback((ruleId: string) => {
		setOverrideMode((prev) => {
			const next = new Set(prev);
			if (next.has(ruleId)) {
				next.delete(ruleId);
			} else {
				next.add(ruleId);
			}
			return next;
		});
	}, []);

	// Filter rules to only include relevant ones
	const filteredRules = useMemo(() => {
		// If no relevantRuleIds provided, show all rules (backwards compatibility)
		if (!relevantRuleIds) {
			return rules;
		}
		const relevantSet = new Set(relevantRuleIds);
		return rules.filter((rule) => relevantSet.has(rule.id));
	}, [rules, relevantRuleIds]);

	// Group rules by category
	const groupedRules = useMemo(() => {
		const groups: Record<string, Rule[]> = {};
		for (const rule of filteredRules) {
			const category = rule.category;
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(rule);
		}
		return groups;
	}, [filteredRules]);

	// Get check data for a rule
	const getCheckData = useCallback(
		(ruleId: string): RuleCheck | undefined => {
			return checks.find((c) => c.ruleId === ruleId);
		},
		[checks],
	);

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

	// Calculate optimistic compliance based on filtered (relevant) rules
	const optimisticCompliance = useMemo(() => {
		if (filteredRules.length === 0) return 100;
		const checkedCount = filteredRules.filter((r) => isChecked(r.id)).length;
		return (checkedCount / filteredRules.length) * 100;
	}, [filteredRules, isChecked]);

	// Notify parent of compliance changes
	useEffect(() => {
		onComplianceChange?.(optimisticCompliance);
	}, [optimisticCompliance, onComplianceChange]);

	if (filteredRules.length === 0) {
		return (
			<div className="py-8 text-center">
				<p className="font-mono text-muted-foreground text-sm">
					No relevant rules for this trade
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6" data-testid="rule-checklist">
			{/* Compliance indicator */}
			<div
				className="flex items-center justify-between rounded border border-border bg-muted p-4"
				data-testid="rule-checklist-compliance"
			>
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
						data-testid="rule-checklist-compliance-value"
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
									const checkData = getCheckData(rule.id);
									const evalResult = parseEvaluationResult(
										checkData?.evaluationResult,
									);
									const isAutoEvaluated = checkData?.wasAutoEvaluated ?? false;
									const isInOverrideMode = overrideMode.has(rule.id);
									const isAutoRule =
										rule.ruleType === "auto" || rule.ruleType === "semi_auto";

									// For auto-evaluated rules: disable checkbox unless user is overriding
									const isCheckboxDisabled =
										isAutoRule && isAutoEvaluated && !isInOverrideMode;

									return (
										<div
											className={cn(
												"rounded border border-border/50 bg-card p-3 transition-all hover:border-border",
												checked && "border-profit/20 bg-profit/5",
												!checked &&
													isAutoEvaluated &&
													evalResult &&
													"border-loss/20 bg-loss/5",
											)}
											data-testid={`rule-checklist-item-${rule.id}`}
											key={rule.id}
										>
											<div className="flex items-start gap-3">
												{/* Checkbox or Auto-evaluation indicator */}
												{isAutoRule && isAutoEvaluated && !isInOverrideMode ? (
													<div className="mt-0.5">
														{checked ? (
															<CheckCircle
																className="h-4 w-4 text-profit"
																data-testid={`rule-eval-passed-${rule.id}`}
															/>
														) : (
															<XCircle
																className="h-4 w-4 text-loss"
																data-testid={`rule-eval-failed-${rule.id}`}
															/>
														)}
													</div>
												) : (
													<Checkbox
														checked={checked}
														className="mt-0.5"
														disabled={isCheckboxDisabled}
														id={checkboxId}
														onCheckedChange={(value) =>
															handleCheck(
																rule.id,
																value === true,
																isInOverrideMode,
															)
														}
													/>
												)}

												{/* Rule content */}
												<div className="flex-1">
													<label
														className={cn(
															"font-mono text-sm",
															isCheckboxDisabled
																? "cursor-default"
																: "cursor-pointer",
															checked
																? "text-foreground"
																: "text-muted-foreground",
														)}
														htmlFor={
															isCheckboxDisabled ? undefined : checkboxId
														}
													>
														{rule.text}
													</label>

													{/* Evaluation details for auto rules */}
													{isAutoEvaluated && evalResult && (
														<div
															className="mt-1.5 flex items-center gap-2"
															data-testid={`rule-eval-details-${rule.id}`}
														>
															<span className="font-mono text-[10px] text-muted-foreground">
																Actual: {formatEvalValue(evalResult.actual)}
															</span>
															<span className="text-muted-foreground/50">
																/
															</span>
															<span className="font-mono text-[10px] text-muted-foreground">
																Expected: {formatEvalValue(evalResult.expected)}
															</span>
															{evalResult.dataQuality !== "full" && (
																<span className="font-mono text-[8px] text-breakeven">
																	({evalResult.dataQuality})
																</span>
															)}
														</div>
													)}
												</div>

												{/* Override button for auto-evaluated rules */}
												{isAutoRule && isAutoEvaluated && (
													<Button
														className="h-6 shrink-0 font-mono text-[9px]"
														data-testid={`rule-override-btn-${rule.id}`}
														onClick={() => toggleOverrideMode(rule.id)}
														size="sm"
														variant="ghost"
													>
														{isInOverrideMode ? "Cancel" : "Override"}
													</Button>
												)}
											</div>
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
